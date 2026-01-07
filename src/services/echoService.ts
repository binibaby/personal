import Pusher from '@pusher/pusher-websocket-react-native';
import Echo from 'laravel-echo';
import { EchoServiceInterface } from './echoServiceInterface';

class EchoService implements EchoServiceInterface {
  private echo: Echo<any> | null = null;
  private authToken: string | null = null;

  constructor() {
    // Ensure Pusher is globally available for Laravel Echo
    (global as any).Pusher = Pusher;
    
    // Configure Pusher for React Native
    // Note: logToConsole property may not exist on all Pusher versions
    if (Pusher && typeof (Pusher as any).logToConsole !== 'undefined') {
      (Pusher as any).logToConsole = __DEV__;
    }
    
    // Initialize Echo with proper configuration
    this.initializeEcho();
  }

  private initializeEcho() {
    try {
      // Check if Pusher is properly available
      if (!Pusher || typeof Pusher !== 'function') {
        console.warn('Pusher not available, Echo initialization will be skipped');
        return;
      }

      // Get the network service to get the correct base URL
      const { networkService } = require('./networkService');
      const baseUrl = networkService.getBaseUrl();
      
      // Extract host from base URL
      let host = 'localhost'; // Default to localhost
      try {
        const url = new URL(baseUrl);
        host = url.hostname;
      } catch (error) {
        // If baseUrl is not a full URL, use localhost
        if (!__DEV__) {
          host = 'localhost';
        } else {
          host = '192.168.100.13'; // Development fallback (matches primary IP)
        }
        console.warn('Could not parse base URL, using default host:', error);
      }

      this.echo = new Echo({
        broadcaster: 'reverb',
        key: process.env.EXPO_PUBLIC_REVERB_APP_KEY || 'iycawpww023mjumkvwsj',
        wsHost: host,
        wsPort: 8080,
        wssPort: 8080,
        forceTLS: false, // Use HTTP for local development
        disableStats: true,
        enabledTransports: ['ws', 'wss'],
        authEndpoint: `${baseUrl}/broadcasting/auth`,
        auth: {
          headers: {
            Authorization: `Bearer ${this.authToken || ''}`,
          },
        },
      });

      // Set up connection event listeners
      if (this.echo && this.echo.connector && this.echo.connector.pusher) {
        this.echo.connector.pusher.connection.bind('connected', () => {
          console.log('📡 Laravel Echo connected!');
        });

        this.echo.connector.pusher.connection.bind('disconnected', () => {
          console.log('📡 Laravel Echo disconnected!');
        });

        this.echo.connector.pusher.connection.bind('error', (err: any) => {
          console.error('📡 Laravel Echo connection error:', err);
        });
      }
    } catch (error) {
      console.error('Failed to initialize Echo:', error);
      this.echo = null; // Ensure echo is null on error
    }
  }

  setAuthToken(token: string) {
    this.authToken = token;
    if (this.echo) {
      // Reconfigure Echo with new token if already initialized
      this.disconnect();
      this.connect();
    }
  }

  async connect(): Promise<boolean> {
    if (!this.echo) {
      console.warn('Echo not initialized. Cannot connect.');
      return false;
    }

    if (!this.authToken) {
      console.warn('No auth token provided for Echo connection. Private channels will not work.');
      // return false; // Or connect without auth for public channels
    }

    try {
      // Update auth token if provided
      if (this.authToken && this.echo.connector && this.echo.connector.pusher) {
        this.echo.connector.pusher.config.auth.headers.Authorization = `Bearer ${this.authToken}`;
      }

      // Connect to the server
      if (this.echo.connector && this.echo.connector.pusher) {
        await this.echo.connector.pusher.connect();
      }

      return true;
    } catch (error) {
      console.error('Failed to connect to Laravel Echo:', error);
      return false;
    }
  }

  disconnect() {
    if (this.echo) {
      this.echo.disconnect();
      this.echo = null;
      console.log('Laravel Echo disconnected and cleaned up.');
    }
  }

  listenToVerificationUpdates(userId: string, callback: (data: any) => void) {
    if (!this.echo) {
      console.warn('Echo not initialized. Cannot listen to verification updates.');
      return null;
    }

    try {
      const channelName = `private-user.${userId}`;
      console.log(`👂 Listening to channel: ${channelName}`);

      return this.echo.private(channelName)
        .listen('.IdVerificationStatusUpdated', (e: any) => {
          console.log(`Received IdVerificationStatusUpdated event on channel ${channelName}:`, e);
          callback(e);
        })
        .error((error: any) => {
          console.error(`Error on channel ${channelName}:`, error);
        });
    } catch (error) {
      console.error('Failed to listen to verification updates:', error);
      return null;
    }
  }

  stopListeningToVerificationUpdates(userId: string) {
    if (this.echo) {
      const channelName = `private-user.${userId}`;
      this.echo.leave(channelName);
      console.log(`Stopped listening to channel: ${channelName}`);
    }
  }

  listenToUserNotifications(userId: string, callback: (data: any) => void) {
    if (!this.echo) {
      console.warn('Echo not initialized. Cannot listen to user notifications.');
      return null;
    }

    try {
      const channelName = `private-user.${userId}`;
      console.log(`👂 Listening to user notifications on channel: ${channelName}`);

      return this.echo.private(channelName)
        .listen('.profile-change-approved', (e: any) => {
          console.log(`Received profile-change-approved event on channel ${channelName}:`, e);
          callback(e);
        })
        .listen('.profile-change-rejected', (e: any) => {
          console.log(`Received profile-change-rejected event on channel ${channelName}:`, e);
          callback(e);
        })
        .error((error: any) => {
          console.error(`Error on user notifications channel ${channelName}:`, error);
        });
    } catch (error) {
      console.error('Failed to listen to user notifications:', error);
      return null;
    }
  }

  stopListeningToUserNotifications(userId: string) {
    if (this.echo) {
      const channelName = `private-user.${userId}`;
      this.echo.leave(channelName);
      console.log(`Stopped listening to user notifications channel: ${channelName}`);
    }
  }

  listenToAdminNotifications(callback: (data: any) => void) {
    if (!this.echo) {
      console.warn('Echo not initialized. Cannot listen to admin notifications.');
      return null;
    }

    try {
      const channelName = 'private-admin.notifications';
      console.log(`👂 Listening to admin notifications on channel: ${channelName}`);

      return this.echo.private(channelName)
        .listen('.profile-change-requested', (e: any) => {
          console.log(`Received profile-change-requested event on channel ${channelName}:`, e);
          callback(e);
        })
        .error((error: any) => {
          console.error(`Error on admin notifications channel ${channelName}:`, error);
        });
    } catch (error) {
      console.error('Failed to listen to admin notifications:', error);
      return null;
    }
  }

  stopListeningToAdminNotifications() {
    if (this.echo) {
      const channelName = 'private-admin.notifications';
      this.echo.leave(channelName);
      console.log(`Stopped listening to admin notifications channel: ${channelName}`);
    }
  }

  // Get the Echo instance
  getEcho(): Echo<any> | null {
    return this.echo;
  }

  // Initialize method for compatibility
  async initialize(): Promise<boolean> {
    return this.connect();
  }
}

export default new EchoService();