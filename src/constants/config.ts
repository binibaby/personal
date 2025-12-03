// Network detection utility for dual WiFi/mobile data support
const getNetworkIP = () => {
  if (__DEV__) {
    // Use current WiFi IP for development
    return '192.168.100.239';
  }
  // Production: Use localhost for local development
  return 'localhost';
};

// Network fallback configuration for dual connectivity
export const NETWORK_FALLBACK = {
  // Primary IPs to try in order - WiFi first for current connection
  PRIMARY_IPS: [
    '192.168.100.239',  // Current WiFi IP (primary)
    '192.168.100.225',  // Previous WiFi IP (fallback)
    '192.168.100.226',  // Previous WiFi IP (fallback)
    '172.20.10.2',      // Mobile data IP (fallback)
    '172.20.10.1',      // Mobile hotspot gateway
    '192.168.100.197',  // Previous WiFi IP (fallback)
    '127.0.0.1',        // Localhost fallback
  ],
  
  // Fallback IPs for different network scenarios
  FALLBACK_IPS: [
    '192.168.100.239',  // Current WiFi IP (primary)
    '192.168.100.225',  // Previous WiFi IP
    '192.168.100.226',  // Previous WiFi IP
    '172.20.10.2',      // Mobile data IP (fallback)
    '172.20.10.1',      // Mobile hotspot gateway
    '172.20.10.3',      // Additional mobile data IP
    '172.20.10.4',      // Additional mobile data IP
    '192.168.100.197',  // Previous WiFi IP
    '127.0.0.1',        // Localhost fallback
    '192.168.100.192',  // Previous WiFi IP
    '192.168.100.184',  // Previous WiFi IP
    '192.168.100.179',  // Previous WiFi IP
    '192.168.100.215',  // Previous WiFi IP
    '192.168.1.100',    // Common home WiFi
    '192.168.0.100',    // Common home WiFi
    '192.168.100.1',    // WiFi gateway (if server is on gateway)
    '192.168.43.1',     // Android hotspot
    '192.168.137.1',    // Windows mobile hotspot
    '10.0.0.100',       // Corporate networks
  ],
  
  // Connection test timeout (optimized for WiFi)
  CONNECTION_TIMEOUT: 2000, // 2 seconds for WiFi connection
  
  // Retry attempts
  MAX_RETRIES: 3,
  
  // Network type detection
  NETWORK_TYPES: {
    WIFI: ['192.168.', '10.0.0.', '172.16.', '172.17.', '172.18.', '172.19.'],
    MOBILE: ['172.20.10.', '172.20.11.', '172.20.12.', '172.20.13.'],
    HOTSPOT: ['192.168.43.', '192.168.137.', '172.20.10.'],
  },
};

// API Configuration
// In development, use local network IP with port
// In production, use Render URL (no port needed as Render handles it)
export const API_BASE_URL = __DEV__ 
  ? `http://${getNetworkIP()}:8000`
  : 'http://localhost:8000';

export const API_CONFIG = {
  // Dynamic IP detection for both WiFi and mobile data
  BASE_URL: API_BASE_URL,
  
  // API endpoints
  ENDPOINTS: {
    VERIFICATION: {
      SEND_CODE: '/api/send-verification-code',
      VERIFY_CODE: '/api/verify-phone-code',
      SKIP: '/api/verification/skip',
      SUBMIT_SIMPLE: '/api/verification/submit-simple',
      RESEND_CODE: '/api/resend-verification-code',
    },
    WALLET: {
      BALANCE: '/api/wallet/balance',
      PENDING_EARNINGS: '/api/wallet/pending_earnings',
      TRANSACTIONS: '/api/wallet/transactions',
      CASHOUT: '/api/wallet/cashout',
    },
    PAYMENT: '/api',
  },
  
  // Timeouts
  TIMEOUT: 8000, // 8 seconds (optimized for mobile data)
  
  // Headers
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

// Helper function to get full API URL (legacy - use networkService instead)
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// New helper function using network service for automatic IP detection
export const getApiUrlWithFallback = async (endpoint: string): Promise<string> => {
  const { networkService } = require('../services/networkService');
  const baseUrl = networkService.getBaseUrl();
  return `${baseUrl}${endpoint}`;
};

// Helper function to get headers with auth token
export const getAuthHeaders = (token?: string) => {
  const headers: Record<string, string> = { ...API_CONFIG.DEFAULT_HEADERS };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Network configuration
export const NETWORK_CONFIG = {
  // Retry configuration
  MAX_RETRIES: 1, // Minimal retries for mobile data
  RETRY_DELAY: 200, // 0.2 seconds (very fast retry)
  
  // Connection check
  CONNECTION_CHECK_URL: 'https://www.google.com',
  CONNECTION_TIMEOUT: 2000, // 2 seconds (very fast timeout)
};

// Development helpers
export const DEV_CONFIG = {
  // Enable/disable features in development
  ENABLE_LOGGING: __DEV__,
  ENABLE_NETWORK_LOGGING: __DEV__,
  ENABLE_ERROR_BOUNDARIES: __DEV__,
  
  // Mock data for development
  USE_MOCK_DATA: false,
  MOCK_DELAY: 1000,
};

// Phone verification configuration
export const VERIFICATION_CONFIG = {
  // Code length
  CODE_LENGTH: 6,
  
  // Expiration time (in seconds)
  CODE_EXPIRATION: 300, // 5 minutes
  
  // Max attempts
  MAX_ATTEMPTS: 3,
  
  // Cooldown period (in seconds)
  COOLDOWN_PERIOD: 60, // 1 minute
}; 