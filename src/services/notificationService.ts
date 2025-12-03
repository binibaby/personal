import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeApiCall } from './networkService';

export interface Notification {
  id: string;
  type: 'booking' | 'booking_confirmed' | 'booking_completed' | 'session_started' | 'message' | 'review' | 'new_review' | 'system' | 'payment_success' | 'profile_update_approved' | 'profile_update_rejected' | 'id_verification_approved' | 'id_verification_rejected';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  avatar?: any;
  action?: string;
  data?: any; // Additional data for the notification
  userId?: string; // Optional userId to target specific user
  readAt?: string; // Timestamp when notification was read
}

class NotificationService {
  private static instance: NotificationService;
  private listeners: ((notifications: Notification[]) => void)[] = [];

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Subscribe to notification updates
  subscribe(listener: (notifications: Notification[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners
  private notifyListeners(notifications: Notification[]) {
    this.listeners.forEach(listener => listener(notifications));
  }

  // Clean up notifications with incorrect timestamps and format
  private async cleanupInvalidTimestamps(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('notifications');
      if (!stored) return;
      
      const notifications: Notification[] = JSON.parse(stored);
      const now = new Date();
      const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      
      let hasInvalidTimestamps = false;
      
      const cleanedNotifications = notifications.map(notification => {
        try {
          const notificationDate = new Date(notification.time);
          
          // Check if time is in 24-hour format (contains "AM" or "PM" means 12-hour format)
          const is24HourFormat = !notification.time.includes('AM') && !notification.time.includes('PM');
          
          // If the notification time is in the future (more than 1 year from now), fix it
          if (notificationDate > oneYearFromNow || isNaN(notificationDate.getTime())) {
            console.log('🔧 Fixing invalid timestamp for notification:', notification.id);
            hasInvalidTimestamps = true;
            
            return {
              ...notification,
              time: this.formatToPhilippinesTime(new Date())
            };
          }
          
          // If it's in 12-hour format, convert to 24-hour format
          if (is24HourFormat && !isNaN(notificationDate.getTime())) {
            console.log('🔧 Converting 12-hour format to 24-hour format for notification:', notification.id);
            hasInvalidTimestamps = true;
            
            return {
              ...notification,
              time: this.formatToPhilippinesTime(notificationDate)
            };
          }
          
          return notification;
        } catch (error) {
          console.log('🔧 Error parsing notification time, fixing:', notification.id);
          hasInvalidTimestamps = true;
          
          return {
            ...notification,
            time: this.formatToPhilippinesTime(new Date())
          };
        }
      });
      
      if (hasInvalidTimestamps) {
        await AsyncStorage.setItem('notifications', JSON.stringify(cleanedNotifications));
        console.log('✅ Cleaned up notifications with invalid timestamps and converted to 12-hour format');
      }
    } catch (error) {
      console.error('❌ Error cleaning up invalid timestamps:', error);
    }
  }

  // Get all notifications
  async getNotifications(): Promise<Notification[]> {
    try {
      console.log('🔔 Getting notifications...');
      
      // Clean up any notifications with invalid timestamps first
      await this.cleanupInvalidTimestamps();
      
      // Get fresh data from API only - no local storage merge
      const apiNotifications = await this.fetchNotificationsFromAPI();
      console.log('📱 API notifications fetched:', apiNotifications.length);
      
      // Save API notifications to local storage for offline access
      await this.saveNotifications(apiNotifications);
      
      // Filter and return notifications for current user
      const filtered = await this.filterNotificationsByUserType(apiNotifications);
      console.log('📱 Filtered notifications for user:', filtered.length);
      
      return filtered;
    } catch (error) {
      console.error('❌ Error getting notifications:', error);
      // Fallback to local storage
      const stored = await AsyncStorage.getItem('notifications');
      const localNotifications = stored ? JSON.parse(stored) : [];
      return this.filterNotificationsByUserType(localNotifications);
    }
  }

  // Fetch notifications from API
  private async fetchNotificationsFromAPI(): Promise<Notification[]> {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        console.log('❌ No user found for API call');
        return [];
      }

      // Get auth token
      let token = user.token;
      console.log('🔍 User details for notifications:', {
        id: user.id,
        role: user.userRole,
        hasToken: !!token
      });
      
      if (!token) {
        // Fallback to hardcoded tokens for testing
        if (user.id === '5') {
          token = '64|dTO5Gio05Om1Buxtkta02gVpvQnetCTMrofsLjeudda0034b';
        } else if (user.id === '21') {
          token = '67|uCtobaBZatzbzDOeK8k1DytVHby0lpa07ERJJczu3cdfa507';
        } else if (user.id === '112') {
          token = '467|hyK770TmWQmZL6ihSgR4X8WOhGfVLRGCPogYrSLL5fd4ebb5';
        } else if (user.id === '113') {
          token = '471|GuG3QSUmuW9rvB7nuBgsM3R8nuBgMzivYRr2H0Lr3d105e12';
        } else if (user.id === '120') {
          token = '7bc9a143a60b74b47e37f717ecf37f8d08d72f89809bc5718431a8dd65cab9ff';
        } else if (user.id === '121') {
          token = '616|Mh2WHZIp1aFUXtMKiilSU84KTP3Snege7zRjE2bM00a52108';
        } else if (user.id === '126') {
          token = '688|fg2lyoMmhIR8BGBwHgVp9MuohtviVQJ911IUJBrb4be87cba';
        } else {
          console.log('❌ No token available for user:', user.id);
          return [];
        }
      }

      console.log('🔑 Fetching notifications from API for user:', user.id);

      const response = await makeApiCall('/api/notifications/', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📱 API notifications response:', data);
        console.log('📱 API notifications count:', data.notifications?.length || 0);
        console.log('📱 API unread count:', data.unread_count || 0);
        
        if (data.success && data.notifications && Array.isArray(data.notifications)) {
          // Convert API format to local format
          const notifications: Notification[] = data.notifications.map((apiNotif: any) => {
            // Parse the data field if it's a JSON string
            let parsedData = null;
            if (apiNotif.data) {
              try {
                parsedData = typeof apiNotif.data === 'string' ? JSON.parse(apiNotif.data) : apiNotif.data;
              } catch (error) {
                console.log('⚠️ Error parsing notification data:', error);
                parsedData = apiNotif.data;
              }
            }
            
            return {
              id: apiNotif.id.toString(),
              type: apiNotif.type || 'system',
              title: apiNotif.title || 'Notification',
              message: apiNotif.message || '',
              time: this.formatTimeTo24Hour(apiNotif.created_at),
              isRead: !!apiNotif.read_at,
              action: apiNotif.action || 'View Request', // Add action field
              data: parsedData,
              userId: user.id, // Add userId field for proper filtering
            };
          });
          
          console.log('✅ Converted API notifications:', notifications.length);
          console.log('📋 Notification details:', notifications.map(n => ({ id: n.id, type: n.type, title: n.title, isRead: n.isRead })));
          
          // Debug payment success notifications specifically
          const paymentNotifications = notifications.filter(n => n.type === 'payment_success');
          if (paymentNotifications.length > 0) {
            console.log('💰 Payment success notifications found:', paymentNotifications.length);
            paymentNotifications.forEach(notif => {
              console.log('💰 Payment notification data:', {
                id: notif.id,
                title: notif.title,
                message: notif.message,
                data: notif.data,
                sitterName: notif.data?.sitter_name,
                sitterAddress: notif.data?.sitter_address,
                sitterPhone: notif.data?.sitter_phone
              });
              
              // Check if data is properly parsed
              if (notif.data && typeof notif.data === 'object') {
                console.log('✅ Data is properly parsed as object');
                console.log('🔍 Available keys:', Object.keys(notif.data));
              } else {
                console.log('❌ Data is not properly parsed:', typeof notif.data);
              }
            });
          }
          
          return notifications;
        } else {
          console.log('⚠️ API response missing notifications array:', {
            success: data.success,
            hasNotifications: !!data.notifications,
            notificationsType: typeof data.notifications,
            notificationsIsArray: Array.isArray(data.notifications),
            fullResponse: data
          });
          
          // If notifications exists but is not an array, return empty array
          if (data.notifications && !Array.isArray(data.notifications)) {
            console.log('⚠️ notifications is not an array, returning empty array');
            return [];
          }
        }
      } else {
        console.log('⚠️ API call failed:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.log('⚠️ Error response data:', errorData);
      }
    } catch (error) {
      console.error('Error fetching notifications from API:', error);
    }
    
    return [];
  }

  // Get current user (import from auth service)
  private async getCurrentUser() {
    const { default: authService } = await import('./authService');
    return await authService.getCurrentUser();
  }

  // Filter notifications based on user type
  private async filterNotificationsByUserType(notifications: Notification[]): Promise<Notification[]> {
    try {
    const user = await this.getCurrentUser();
    if (!user) {
        console.log('🔍 No user found, returning all notifications');
        return notifications;
      }

      const isPetSitter = user.role === 'pet_sitter';
      console.log('🔍 Filtering notifications for user:', user.id, 'isPetSitter:', isPetSitter);
      console.log('🔍 Total notifications to filter:', notifications.length);
      
      const filtered = notifications.filter(notification => {
        // If notification has userId, only show to that specific user
        if (notification.userId) {
          const matches = String(notification.userId) === String(user.id);
          console.log(`🔍 Notification ${notification.id} has userId ${notification.userId}, matches current user ${user.id}: ${matches}`);
          return matches;
        }
        
        // Otherwise, use the old filtering logic
        if (isPetSitter) {
          // Pet sitters see: all booking notifications, messages, reviews, system notifications, profile updates, ID verification, payment/wallet notifications
          const allowedTypes = [
            'booking',
            'booking_confirmed',
            'booking_completed',
            'booking_cancelled',
            'session_started',
            'message',
            'review',
            'new_review',
            'system',
            'profile_update_approved',
            'profile_update_rejected',
            'id_verification_approved',
            'id_verification_rejected',
            'payment_received',
            'wallet_updated',
            'earnings_received'
          ];
          const matches = allowedTypes.includes(notification.type);
          console.log(`🔍 Pet sitter notification ${notification.id} (${notification.type}): ${matches}`);
          return matches;
        } else {
          // Pet owners see: all booking notifications, messages, system notifications, profile updates, payment success
          const isBooking = notification.type === 'booking';
          const isMessageOrSystem = notification.type === 'message' || notification.type === 'system';
          const isProfileUpdate = notification.type === 'profile_update_approved' || notification.type === 'profile_update_rejected';
          const isPaymentSuccess = notification.type === 'payment_success';
          const matches = isBooking || isMessageOrSystem || isProfileUpdate || isPaymentSuccess;
          console.log(`🔍 Pet owner notification ${notification.id} (${notification.type}): ${matches}`);
          return matches;
        }
      });
      
      console.log('🔍 Filtered notifications result:', filtered.length);
      console.log('🔍 Filtered notifications:');
      filtered.forEach((notif, index) => {
        console.log(`  ${index}: ID=${notif.id}, type=${notif.type}, userId=${notif.userId}, title=${notif.title}`);
      });
      
      return filtered;
    } catch (error) {
      console.error('❌ Error filtering notifications:', error);
      return notifications;
    }
  }

  // Save notifications to local storage
  private async saveNotifications(notifications: Notification[]) {
    try {
      await AsyncStorage.setItem('notifications', JSON.stringify(notifications));
      console.log('💾 Saved notifications to storage:', notifications.length);
    } catch (error) {
      console.error('❌ Error saving notifications:', error);
    }
  }

  // Format time to 24-hour format in Philippines timezone
  private formatTimeTo24Hour(dateString: string): string {
    try {
      console.log('🕐 Formatting time for notification:', dateString);
      
      // If dateString is null, undefined, or empty, use current time
      if (!dateString) {
        console.log('⚠️ Empty dateString, using current time');
        dateString = new Date().toISOString();
      }
      
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.log('⚠️ Invalid date, using current time');
        return this.formatToPhilippinesTime(new Date());
      }
      
      // Check if date is in the future (more than 1 year from now) - likely a bug
      const now = new Date();
      const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      
      if (date > oneYearFromNow) {
        console.log('⚠️ Date is in the future, using current time instead');
        return this.formatToPhilippinesTime(new Date());
      }
      
      const formattedTime = this.formatToPhilippinesTime(date);
      console.log('✅ Formatted time (Philippines):', formattedTime);
      return formattedTime;
    } catch (error) {
      console.error('❌ Error formatting time:', error);
      // Return current time as fallback
      return this.formatToPhilippinesTime(new Date());
    }
  }

  // Helper function to format time to Philippines timezone
  private formatToPhilippinesTime(date: Date): string {
    // If the time is showing 8:42 but should be 4:42, we need to subtract 4 hours
    // This suggests the server time is already in a different timezone
    const philippinesTime = new Date(date.getTime() - (4 * 60 * 60 * 1000)); // Subtract 4 hours
    
    const year = philippinesTime.getFullYear();
    const month = String(philippinesTime.getMonth() + 1).padStart(2, '0');
    const day = String(philippinesTime.getDate()).padStart(2, '0');
    const hours = String(philippinesTime.getHours()).padStart(2, '0');
    const minutes = String(philippinesTime.getMinutes()).padStart(2, '0');
    const seconds = String(philippinesTime.getSeconds()).padStart(2, '0');
    
    
    return `${month}/${day}/${year}, ${hours}:${minutes}:${seconds}`;
  }

  // Add notification for specific user
  async addNotificationForUser(userId: string, notificationData: Omit<Notification, 'id' | 'time' | 'isRead'>) {
    try {
      console.log('🔔 Adding notification for user:', userId, notificationData.title);
    
    const newNotification: Notification = {
        ...notificationData,
      id: Date.now().toString(),
      time: this.formatToPhilippinesTime(new Date()),
      isRead: false,
        userId: userId,
      };

      console.log('🔔 New notification created:', newNotification);

      // Get existing notifications
    const stored = await AsyncStorage.getItem('notifications');
      const notifications = stored ? JSON.parse(stored) : [];
      
      // Add new notification
      notifications.push(newNotification);
      
      // Save to storage
      await this.saveNotifications(notifications);
      
      // Notify listeners
      this.notifyListeners(notifications);
      
      console.log('📋 Total notifications after adding for user:', notifications.length);
    return newNotification;
    } catch (error) {
      console.error('❌ Error adding notification for user:', error);
    }
  }

  // Create booking notification
  async createBookingNotification(bookingData: any) {
    try {
      console.log('🔔 Creating booking notification for sitter:', bookingData.sitterId);
      console.log('🔔 Booking data received:', {
        date: bookingData.date,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        petOwnerName: bookingData.petOwnerName
      });
      
      // Import time utilities
      const { formatTime24To12, formatDate } = await import('../utils/timeUtils');

      const formattedStartTime = formatTime24To12(bookingData.startTime);
      const formattedEndTime = formatTime24To12(bookingData.endTime);
      const bookingType = bookingData.isWeekly ? 'Weekly' : 'Daily';
      const formattedDate = formatDate(bookingData.date);
      
      const notificationData = {
        type: 'booking' as const,
        title: `New ${bookingType} Booking Request`,
        message: `You have a new booking from ${bookingData.petOwnerName} on ${formattedDate}. Please check your schedule for details.`,
        action: 'View Request',
        data: {
          bookingId: bookingData.bookingId,
          petOwnerId: bookingData.petOwnerId,
          petOwnerName: bookingData.petOwnerName,
          sitterId: bookingData.sitterId,
          sitterName: bookingData.sitterName,
          date: bookingData.date,
          startTime: bookingData.startTime,
          endTime: bookingData.endTime,
          formattedStartTime,
          formattedEndTime,
          hourlyRate: bookingData.hourlyRate,
          isWeekly: bookingData.isWeekly || false,
          bookingType,
          status: 'pending'
        }
      };

      console.log('🔔 Notification data:', notificationData.data);
      console.log('🔔 Is weekly booking:', notificationData.data.isWeekly);

      return await this.addNotificationForUser(bookingData.sitterId, notificationData);
    } catch (error) {
      console.error('❌ Error creating booking notification:', error);
    }
  }

  // Create weekly booking notification
  async createWeeklyBookingNotification(bookingData: any) {
    try {
      console.log('🔔 Creating weekly booking notification for sitter:', bookingData.sitterId);
      
      // Format time properly
      const formatTime = (time: string) => {
        if (!time) return 'Invalid Time';
        try {
          const [hours, minutes] = time.split(':');
          const hour = parseInt(hours, 10);
          const minute = parseInt(minutes, 10);
          return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        } catch (error) {
          return time;
        }
      };

      const formattedStartTime = formatTime(bookingData.startTime);
      const formattedEndTime = formatTime(bookingData.endTime);
      
      // Format dates properly
      const formatDate = (dateString: string) => {
        if (!dateString) return 'Invalid Date';
        try {
          const date = new Date(dateString);
          const options: Intl.DateTimeFormatOptions = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          };
          return date.toLocaleDateString('en-US', options);
        } catch (error) {
          return dateString;
        }
      };

      const formattedStartDate = formatDate(bookingData.startDate);
      const formattedEndDate = formatDate(bookingData.endDate);
      
      const notificationData = {
        type: 'booking' as const,
        title: 'New Weekly Booking Request',
        message: `You have a new weekly booking from ${bookingData.petOwnerName} from ${formattedStartDate} to ${formattedEndDate}. Please check your schedule for details.`,
        action: 'View Request',
        data: {
          bookingId: bookingData.bookingId,
          petOwnerId: bookingData.petOwnerId,
          petOwnerName: bookingData.petOwnerName,
          sitterId: bookingData.sitterId,
          sitterName: bookingData.sitterName,
          startDate: bookingData.startDate,
          endDate: bookingData.endDate,
          startTime: bookingData.startTime,
          endTime: bookingData.endTime,
          formattedStartTime,
          formattedEndTime,
          hourlyRate: bookingData.hourlyRate,
          totalAmount: bookingData.totalAmount,
          isWeekly: true,
          bookingType: 'Weekly',
          status: 'pending'
        }
      };

      console.log('🔔 Weekly notification data:', notificationData.data);

      return await this.addNotificationForUser(bookingData.sitterId, notificationData);
    } catch (error) {
      console.error('❌ Error creating weekly booking notification:', error);
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: string) {
    try {
      console.log('📖 Marking notification as read:', notificationId);
      
      // Mark as read via API first (synchronous)
      console.log('🔑 Starting API call to mark notification as read:', notificationId);
      const apiSuccess = await this.markAsReadViaAPI(notificationId);
      console.log('🔑 API call result:', apiSuccess);
      if (!apiSuccess) {
        console.warn('⚠️ API call failed, but continuing with local update');
      }
      
      // Update local storage after API call
      const stored = await AsyncStorage.getItem('notifications');
      const notifications = stored ? JSON.parse(stored) : [];
      
      const notification = notifications.find((n: Notification) => n.id === notificationId);
      if (notification) {
        notification.isRead = true;
        notification.readAt = new Date().toISOString(); // Add timestamp for tracking
        await this.saveNotifications(notifications);
        this.notifyListeners(notifications);
        console.log('📖 Notification marked as read locally with timestamp:', notification.readAt);
      }
      
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      throw error; // Re-throw to allow calling code to handle
    }
  }

  // Sync read status to API for notifications that are read locally but not on server
  private async syncReadStatusToAPI(notifications: Notification[]): Promise<void> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return;

      // Get auth token
      let token = user.token;
      if (!token) {
        // Fallback to hardcoded tokens for testing
        if (user.id === '5') {
          token = '64|dTO5Gio05Om1Buxtkta02gVpvQnetCTMrofsLjeudda0034b';
        } else if (user.id === '21') {
          token = '67|uCtobaBZatzbzDOeK8k1DytVHby0lpa07ERJJczu3cdfa507';
        } else if (user.id === '74') {
          token = '287|HOTtxWRw3lHKLL7j2e6GQbvORaLsbq2W5lS0vWJcfdab31c9';
        } else {
          return;
        }
      }

      // Find notifications that are read locally but might not be synced to API
      const readNotifications = notifications.filter((n: Notification) => n.isRead && n.readAt);
      
      if (readNotifications.length === 0) {
        console.log('📱 No read notifications to sync to API');
        return;
      }

      console.log(`📱 Syncing ${readNotifications.length} read notifications to API`);

      // Sync each read notification to API
      const syncPromises = readNotifications.map(async (notification) => {
        try {
          const response = await makeApiCall(`/api/notifications/${notification.id}/read`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            console.log(`✅ Synced read status for notification ${notification.id}`);
          } else {
            console.log(`⚠️ Failed to sync read status for notification ${notification.id}:`, response.status);
          }
        } catch (error) {
          console.log(`⚠️ Error syncing notification ${notification.id}:`, error);
        }
      });

      await Promise.allSettled(syncPromises);
      console.log('📱 Read status sync to API completed');
    } catch (error) {
      console.error('❌ Error syncing read status to API:', error);
    }
  }

  // Mark notification as read via API
  private async markAsReadViaAPI(notificationId: string): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        console.log('❌ No user found for API call');
        return false;
      }

      // Get auth token
      let token = user.token;
      if (!token) {
        // Fallback to hardcoded tokens for testing
        if (user.id === '5') {
          token = '64|dTO5Gio05Om1Buxtkta02gVpvQnetCTMrofsLjeudda0034b';
        } else if (user.id === '21') {
          token = '67|uCtobaBZatzbzDOeK8k1DytVHby0lpa07ERJJczu3cdfa507';
        } else if (user.id === '74') {
          token = '287|HOTtxWRw3lHKLL7j2e6GQbvORaLsbq2W5lS0vWJcfdab31c9';
        } else {
          console.log('❌ No token available for user:', user.id);
          return false;
        }
      }

      console.log('🔑 Marking notification as read via API for user:', user.id);

      const response = await makeApiCall(`/api/notifications/${notificationId}/mark-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ Notification marked as read via API:', responseData);
        return true;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.log('⚠️ API call failed:', response.status, response.statusText, errorData);
        return false;
      }
    } catch (error) {
      console.error('Error marking notification as read via API:', error);
      return false;
    }
  }

  // Mark all notifications as read
  async markAllAsRead() {
    try {
      console.log('📖 Marking all notifications as read');
      
      // Mark all as read via API first (synchronous)
      await this.markAllAsReadViaAPI();
      
      // Update local storage after API call
      const stored = await AsyncStorage.getItem('notifications');
      const notifications = stored ? JSON.parse(stored) : [];
      
      notifications.forEach((notification: Notification) => {
        notification.isRead = true;
      });
      
      await this.saveNotifications(notifications);
      this.notifyListeners(notifications);
      console.log('📖 All notifications marked as read locally');
      
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
    }
  }

  // Mark all notifications as read via API
  private async markAllAsReadViaAPI() {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        console.log('❌ No user found for API call');
        return;
      }

      // Get auth token
      let token = user.token;
      if (!token) {
        // Fallback to hardcoded tokens for testing
        if (user.id === '5') {
          token = '64|dTO5Gio05Om1Buxtkta02gVpvQnetCTMrofsLjeudda0034b';
        } else if (user.id === '21') {
          token = '67|uCtobaBZatzbzDOeK8k1DytVHby0lpa07ERJJczu3cdfa507';
        } else if (user.id === '74') {
          token = '287|HOTtxWRw3lHKLL7j2e6GQbvORaLsbq2W5lS0vWJcfdab31c9';
        } else {
          console.log('❌ No token available for user:', user.id);
          return;
        }
      }

      console.log('🔑 Marking all notifications as read via API for user:', user.id);

      const response = await makeApiCall('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        console.log('✅ All notifications marked as read via API');
      } else {
        console.log('⚠️ API call failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error marking all notifications as read via API:', error);
    }
  }

  // Delete notification
  async deleteNotification(notificationId: string) {
    try {
      const stored = await AsyncStorage.getItem('notifications');
      const notifications = stored ? JSON.parse(stored) : [];
      
      const filteredNotifications = notifications.filter((n: Notification) => n.id !== notificationId);
      await this.saveNotifications(filteredNotifications);
      this.notifyListeners(filteredNotifications);
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
    }
  }

  // Get unread count
  async getUnreadCount(): Promise<number> {
    try {
      console.log('🔔 Getting unread notification count...');
      
      // Get all notifications
      const notifications = await this.getNotifications();
      
      // Count unread notifications
      const unreadCount = notifications.filter(notification => !notification.isRead).length;
      
      console.log('📊 Total notifications:', notifications.length);
      console.log('📊 Unread notifications count:', unreadCount);
      console.log('📊 Notification read statuses:', notifications.map(n => ({ id: n.id, isRead: n.isRead, title: n.title })));
      
      return unreadCount;
    } catch (error) {
      console.error('❌ Error getting unread count:', error);
      return 0;
    }
  }

  // Clear notification cache to force fresh data
  async clearCache(): Promise<void> {
    try {
      console.log('🧹 Clearing notification cache...');
      await AsyncStorage.removeItem('notifications');
      console.log('✅ Notification cache cleared');
    } catch (error) {
      console.error('❌ Error clearing notification cache:', error);
    }
  }

  // Clear cache and force fresh data from API (useful when user logs in)
  async forceRefreshFromAPI(): Promise<Notification[]> {
    try {
      console.log('🔄 Force refreshing notifications from API...');
      await this.clearCache();
      return await this.getNotifications();
    } catch (error) {
      console.error('❌ Error force refreshing notifications:', error);
      return [];
    }
  }

  // Create booking confirmation notification for pet owner
  async createBookingConfirmationNotification(bookingData: any) {
    try {
      console.log('🔔 Creating booking confirmation notification for owner:', bookingData.petOwnerId);
      
      const bookingType = bookingData.isWeekly ? 'Weekly' : 'Daily';
      const dateRange = bookingData.isWeekly 
        ? `from ${bookingData.startDate} to ${bookingData.endDate}`
        : `for ${bookingData.date}`;
      
      const notificationData = {
        type: 'booking' as const,
        title: `${bookingType} Booking Confirmed`,
        message: `Your ${bookingType.toLowerCase()} booking with ${bookingData.sitterName} ${dateRange} has been confirmed!`,
        action: 'View Booking',
      data: {
        bookingId: bookingData.bookingId,
        petOwnerId: bookingData.petOwnerId,
        petOwnerName: bookingData.petOwnerName,
          sitterId: bookingData.sitterId,
          sitterName: bookingData.sitterName,
          date: bookingData.date,
        startDate: bookingData.startDate,
        endDate: bookingData.endDate,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        hourlyRate: bookingData.hourlyRate,
          isWeekly: bookingData.isWeekly || false,
          bookingType,
          status: 'confirmed'
        }
      };

      return await this.addNotificationForUser(bookingData.petOwnerId, notificationData);
    } catch (error) {
      console.error('❌ Error creating booking confirmation notification:', error);
    }
  }

  // Create payment success notification for pet owner with sitter details
  async createPaymentSuccessNotification(paymentData: any) {
    try {
      console.log('🔔 Creating payment success notification for owner:', paymentData.petOwnerId);
      
      const notificationData = {
        type: 'payment_success' as const,
        title: 'Payment Successful',
        message: `Your payment of ₱${paymentData.amount} for booking with ${paymentData.sitterName} has been processed successfully. Your booking is now confirmed!`,
        action: 'View Booking',
        data: {
          paymentId: paymentData.paymentId,
          bookingId: paymentData.bookingId,
          petOwnerId: paymentData.petOwnerId,
          petOwnerName: paymentData.petOwnerName,
          sitterId: paymentData.sitterId,
          sitterName: paymentData.sitterName,
          sitterAddress: paymentData.sitterAddress || 'Address not available',
          sitterPhone: paymentData.sitterPhone || 'Phone not available',
          petName: paymentData.petName,
          date: paymentData.date,
          startTime: paymentData.startTime,
          endTime: paymentData.endTime,
          amount: paymentData.amount,
          status: 'completed'
        }
      };

      return await this.addNotificationForUser(paymentData.petOwnerId, notificationData);
    } catch (error) {
      console.error('❌ Error creating payment success notification:', error);
    }
  }

  // Create booking cancellation notification for pet owner
  async createBookingCancellationNotification(bookingData: any) {
    try {
      console.log('🔔 Creating booking cancellation notification for owner:', bookingData.petOwnerId);
      
      const bookingType = bookingData.isWeekly ? 'Weekly' : 'Daily';
      const dateRange = bookingData.isWeekly 
        ? `from ${bookingData.startDate} to ${bookingData.endDate}`
        : `for ${bookingData.date}`;
      
      const notificationData = {
        type: 'booking' as const,
        title: `${bookingType} Booking Cancelled`,
        message: `Your ${bookingType.toLowerCase()} booking with ${bookingData.sitterName} ${dateRange} has been cancelled.`,
        action: 'View Details',
      data: {
        bookingId: bookingData.bookingId,
        petOwnerId: bookingData.petOwnerId,
        petOwnerName: bookingData.petOwnerName,
          sitterId: bookingData.sitterId,
          sitterName: bookingData.sitterName,
          date: bookingData.date,
        startDate: bookingData.startDate,
        endDate: bookingData.endDate,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
          hourlyRate: bookingData.hourlyRate,
          isWeekly: bookingData.isWeekly || false,
          bookingType,
          status: 'cancelled'
        }
      };

      return await this.addNotificationForUser(bookingData.petOwnerId, notificationData);
    } catch (error) {
      console.error('❌ Error creating booking cancellation notification:', error);
    }
  }

  // Create session started notification for pet owner
  async createSessionStartedNotification(bookingData: any) {
    try {
      console.log('🔔 Creating session started notification for owner:', bookingData.petOwnerId);
      
      const bookingType = bookingData.isWeekly ? 'Weekly' : 'Daily';
      const dateRange = bookingData.isWeekly 
        ? `from ${bookingData.startDate} to ${bookingData.endDate}`
        : `for ${bookingData.date}`;
      
      const notificationData = {
        type: 'booking' as const,
        title: 'Session Started',
        message: `Your sitter ${bookingData.sitterName} has started the session for your ${bookingType.toLowerCase()} booking ${dateRange}.`,
        action: 'View Session',
        data: {
          bookingId: bookingData.bookingId,
          petOwnerId: bookingData.petOwnerId,
          petOwnerName: bookingData.petOwnerName,
          sitterId: bookingData.sitterId,
          sitterName: bookingData.sitterName,
          date: bookingData.date,
          startDate: bookingData.startDate,
          endDate: bookingData.endDate,
          startTime: bookingData.startTime,
          endTime: bookingData.endTime,
          hourlyRate: bookingData.hourlyRate,
          isWeekly: bookingData.isWeekly || false,
          bookingType,
          status: 'active'
        }
      };

      return await this.addNotificationForUser(bookingData.petOwnerId, notificationData);
    } catch (error) {
      console.error('❌ Error creating session started notification:', error);
    }
  }

  // Refresh notifications from API
  async refreshNotifications() {
    try {
      console.log('🔄 Refreshing notifications from API...');
      const notifications = await this.getNotifications();
      this.notifyListeners(notifications);
      return notifications;
    } catch (error) {
      console.error('❌ Error refreshing notifications:', error);
      return [];
    }
  }
}

export const notificationService = NotificationService.getInstance();
export default notificationService;
