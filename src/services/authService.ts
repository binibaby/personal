import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  userRole: 'Pet Owner' | 'Pet Sitter';
  role: 'pet_owner' | 'pet_sitter';
  phone?: string;
  age?: number;
  gender?: string;
  address?: string;
  experience?: string;
  hourlyRate?: string;
  maxPets?: number | string;
  max_pets?: number | string;
  aboutMe?: string;
  specialties?: string[];
  email_verified?: boolean;
  phone_verified?: boolean;
  selectedPetTypes?: ('dogs' | 'cats')[];
  selectedBreeds?: string[];
  profileImage?: string;
  token?: string;
  status?: 'active' | 'suspended' | 'banned' | 'pending' | 'denied';
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;
  private isLoggingOut: boolean = false; // Flag to prevent multiple simultaneous logout calls

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Test server connectivity
  async testServerConnection(ip: string): Promise<boolean> {
    try {
      console.log(`🔍 Testing server connection to ${ip}:8000`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const response = await fetch(`http://${ip}:8000/api/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log(`✅ ${ip}:8000 - Server is reachable (status: ${response.status})`);
      return true;
    } catch (error) {
      console.log(`❌ ${ip}:8000 - Server not reachable:`, error);
      return false;
    }
  }

  async login(email: string, password: string): Promise<User> {
    try {
      console.log('Attempting to login with backend API');
      
      // Clear all old user data before login
      await this.clearAllOldUserData();
      
      // Import network service for dynamic IP detection
      const { makeApiCall } = await import('./networkService');
      
      const response = await makeApiCall('/api/login', {
        method: 'POST',
        headers: {},
        body: JSON.stringify({
          email,
          password,
        }),
      });

      // Parse response even if not ok to get error messages
      let result: any;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        try {
          result = await response.json();
        } catch (e) {
          const errorText = await response.text();
          console.error('❌ Failed to parse JSON response:', errorText);
          throw new Error('Invalid response from server');
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Non-JSON response:', errorText);
        throw new Error('Server returned invalid response');
      }

      // Check if response is ok
      if (!response.ok) {
        console.error('❌ Login API error response:', response.status, response.statusText);
        console.error('Error response body:', result);
        
        // Handle specific error cases
        if (response.status === 401) {
          // Invalid credentials
          const errorMessage = result.message || 'Invalid email or password. Please check your credentials and try again.';
          throw new Error(errorMessage);
        } else if (response.status === 403) {
          // Check if user is banned or suspended
          if (result.status === 'banned') {
            const { Alert } = require('react-native');
            Alert.alert(
              'Account Banned',
              result.message || "Your account has been permanently banned. You will not be able to use the platform anymore. Please contact the admin at petsitconnectph@gmail.com if you have any questions.",
              [{ text: 'OK' }],
              { cancelable: false }
            );
            throw new Error(result.message || 'Account banned');
          }
          
          if (result.status === 'suspended') {
            const { Alert } = require('react-native');
            Alert.alert(
              'Account Suspended',
              result.message || "You have been suspended for 72 hours by the admin. Please email the admin at petsitconnectph@gmail.com for assistance.",
              [{ text: 'OK' }],
              { cancelable: false }
            );
            throw new Error(result.message || 'Account suspended');
          }
          
          // Other 403 errors
          throw new Error(result.message || 'Access denied');
        } else {
          // Other errors
          throw new Error(result.message || `Login failed: ${response.status} ${response.statusText}`);
        }
      }

      console.log('✅ Login API response:', result);
      
      // Double-check for banned or suspended status (in case backend returns success but with status)
      if (result.status === 'banned') {
        const { Alert } = require('react-native');
        Alert.alert(
          'Account Banned',
          result.message || "Your account has been permanently banned. You will not be able to use the platform anymore. Please contact the admin at petsitconnectph@gmail.com if you have any questions.",
          [{ text: 'OK' }],
          { cancelable: false }
        );
        throw new Error(result.message || 'Account banned');
      }
      
      if (result.status === 'suspended') {
        const { Alert } = require('react-native');
        Alert.alert(
          'Account Suspended',
          result.message || "You have been suspended for 72 hours by the admin. Please email the admin at petsitconnectph@gmail.com for assistance.",
          [{ text: 'OK' }],
          { cancelable: false }
        );
        throw new Error(result.message || 'Account suspended');
      }
          
      if (result.success) {
        console.log('✅ Login successful, user data from backend:', result.user);
        
        // Enhanced debugging for login user data
        console.log('🔍 LOGIN DEBUG - Backend user data:');
        console.log('  - result.user.first_name:', JSON.stringify(result.user.first_name));
        console.log('  - result.user.last_name:', JSON.stringify(result.user.last_name));
        console.log('  - result.user.name:', JSON.stringify(result.user.name));
            
        // Check if user data exists and has required fields
        if (!result.user || !result.user.id) {
          console.error('Invalid user data received from backend:', result);
          throw new Error('Invalid user data received from server');
        }
        
        // Create user object from backend response
        const user: User = {
          id: result.user.id.toString(),
          email: result.user.email || '',
          name: result.user.name || '',
          firstName: result.user.first_name || '',
          lastName: result.user.last_name || '',
          userRole: result.user.role === 'pet_owner' ? 'Pet Owner' : 'Pet Sitter',
          role: result.user.role || 'pet_owner',
          phone: result.user.phone || '',
          age: result.user.age,
          gender: result.user.gender || '',
          address: result.user.address || '',
          experience: result.user.experience || '',
          hourlyRate: result.user.hourly_rate !== null && result.user.hourly_rate !== undefined ? String(result.user.hourly_rate) : '',
          aboutMe: result.user.bio || '',
          specialties: result.user.specialties || [],
          email_verified: result.user.email_verified || false,
          phone_verified: result.user.phone_verified || false,
          selectedPetTypes: result.user.selected_pet_types || [],
          selectedBreeds: result.user.pet_breeds || [],
          profileImage: result.user.profile_image_url || result.user.profile_image || undefined,
          token: result.token || undefined,
          status: result.user.status || 'active',
        };

        this.currentUser = user;
        
        // Enhanced debugging for created user object
        console.log('🔍 LOGIN DEBUG - Created user object:');
        console.log('  - user.firstName:', JSON.stringify(user.firstName));
        console.log('  - user.lastName:', JSON.stringify(user.lastName));
        console.log('  - user.name:', JSON.stringify(user.name));
        
        await this.saveUserToStorage(user);
        
        // Clear availability data for new sitters or when switching users
        if (user.userRole === 'Pet Sitter') {
          await this.clearAvailabilityDataForNewSitter(user.id);
        }
        
        // Clear logout flag on successful login
        await AsyncStorage.removeItem('user_logged_out');
        console.log('AuthService: Logout flag cleared on login');
        
        // Restore profile data if available
        const userWithProfileData = await this.restoreProfileData(user);
        return userWithProfileData;
      } else {
        console.error('❌ Login failed:', result.message);
        throw new Error(result.message || 'Login failed');
      }
    } catch (error) {
      console.error('Error during login:', error);
      
      // Handle specific error types
      if ((error as any).name === 'AbortError') {
        throw new Error('Login request timed out. Please check your internet connection.');
      } else if ((error as any).message?.includes('NetworkError') || (error as any).message?.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      } else if ((error as any).message?.includes('JSON Parse error')) {
        throw new Error('Server error. Please try again later.');
      }
      
      throw error;
    }
  }

  async register(  userData: {
    email: string;
    password: string;
    name: string;
    firstName?: string;
    lastName?: string;
    userRole: 'Pet Owner' | 'Pet Sitter';
    selectedPetTypes?: ('dogs' | 'cats')[];
    selectedBreeds?: string[];
    phone?: string;
    address?: string;
    gender?: string;
    age?: number;
    experience?: string;
    hourlyRate?: string;
    specialties?: string[];
    aboutMe?: string;
  }): Promise<User> {
    try {
      console.log('Attempting to register with backend API');
      
      // Import network service for dynamic IP detection
      const { makeApiCall } = await import('./networkService');
      
      const response = await makeApiCall('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: userData.name,
          first_name: userData.firstName || (userData.name && typeof userData.name === 'string' ? userData.name.split(' ')[0] : ''),
          last_name: userData.lastName || (userData.name && typeof userData.name === 'string' ? userData.name.split(' ').slice(1).join(' ') : ''),
          email: userData.email,
          password: userData.password,
          password_confirmation: userData.password,
          role: userData.userRole === 'Pet Owner' ? 'pet_owner' : 'pet_sitter',
          phone: userData.phone || '',
          address: userData.address || '',
          gender: userData.gender || '',
          age: userData.age || null,
          experience: userData.experience || '',
          hourly_rate: userData.hourlyRate || null,
          max_pets: (userData as any).maxPets || 10,
          pet_breeds: userData.selectedBreeds || [],
          specialties: userData.specialties || [],
          selected_pet_types: userData.selectedPetTypes || [],
          bio: userData.aboutMe || '',
        }),
      });

      // Check if response is ok
      if (!response.ok) {
        console.error('Register API error response:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        throw new Error(`Registration failed: ${response.status} ${response.statusText}`);
      }

      // Check content type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Invalid content type:', contentType);
        const responseText = await response.text();
        console.error('Non-JSON response:', responseText);
        throw new Error('Server returned non-JSON response');
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('Registration successful, user data from backend:', result.user);
        console.log('Backend hourly_rate:', result.user.hourly_rate);
        console.log('Backend hourly_rate type:', typeof result.user.hourly_rate);
        console.log('Backend hourly_rate value:', JSON.stringify(result.user.hourly_rate));
        
        // Check if user data exists and has required fields
        if (!result.user || !result.user.id) {
          console.error('Invalid user data received from backend:', result);
          throw new Error('Invalid user data received from server');
        }
        
        // Create user object from backend response
        const user: User = {
          id: result.user.id.toString(),
          email: result.user.email || '',
          name: result.user.name || '',
          firstName: result.user.first_name || '',
          lastName: result.user.last_name || '',
          userRole: result.user.role === 'pet_owner' ? 'Pet Owner' : 'Pet Sitter',
          role: result.user.role || 'pet_owner',
          phone: result.user.phone || '',
          age: result.user.age,
          gender: result.user.gender || '',
          address: result.user.address || '',
          experience: result.user.experience || '',
          hourlyRate: result.user.hourly_rate !== null && result.user.hourly_rate !== undefined ? String(result.user.hourly_rate) : '',
          aboutMe: result.user.bio || '',
          specialties: result.user.specialties || [],
          email_verified: result.user.email_verified || false,
          phone_verified: result.user.phone_verified || false,
          selectedPetTypes: result.user.selected_pet_types || [],
          selectedBreeds: result.user.pet_breeds || [],
          profileImage: result.user.profile_image_url || result.user.profile_image || undefined,
          token: result.token || undefined,
          status: result.user.status || 'active',
        };

        this.currentUser = user;
        await this.saveUserToStorage(user);
        
        // Clear old profile data for fresh registrations
        await AsyncStorage.removeItem('user_profile_data');
        
        // Clear availability data for new sitters
        if (user.userRole === 'Pet Sitter') {
          await this.clearAvailabilityDataForNewSitter(user.id);
        }
        
        // For fresh registrations, don't restore old profile data
        // The backend data is the source of truth for new registrations
        console.log('Registration completed successfully with fresh user data:', user);
        return user;
      } else {
        console.error('Registration failed:', result.message);
        throw new Error(result.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Error during registration:', error);
      
      // Handle specific error types
      if ((error as any).name === 'AbortError') {
        throw new Error('Registration request timed out. Please check your internet connection.');
      } else if ((error as any).message?.includes('NetworkError') || (error as any).message?.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      } else if ((error as any).message?.includes('JSON Parse error')) {
        throw new Error('Server error. Please try again later.');
      }
      
      throw error;
    }
  }

  async logout(skipApiCalls: boolean = false): Promise<void> {
    // Prevent multiple simultaneous logout calls
    if (this.isLoggingOut) {
      console.log('AuthService: Logout already in progress, skipping duplicate call');
      return;
    }
    
    this.isLoggingOut = true;
    console.log('AuthService: Logging out user');
    
    try {
      // If user is a pet sitter, set them as offline on backend
      // Skip this if skipApiCalls is true (e.g., when user is suspended and API calls will fail)
      if (!skipApiCalls && this.currentUser && this.currentUser.role === 'pet_sitter') {
        console.log('AuthService: Setting pet sitter as offline on backend');
        try {
          const { makeApiCall } = await import('./networkService');
          const response = await makeApiCall('/api/location/status', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.currentUser.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              is_online: false,
            }),
          });
          
          if (response.ok) {
            console.log('AuthService: Pet sitter set as offline on backend');
          } else {
            console.warn('AuthService: Failed to set sitter offline on backend:', response.status);
          }
        } catch (error) {
          console.error('AuthService: Error setting sitter offline on backend:', error);
        }
      } else if (skipApiCalls) {
        console.log('AuthService: Skipping API calls during logout (user suspended/banned)');
      }
      
      // Save profile data before clearing user data
      if (this.currentUser) {
        const profileData = {
          profileImage: this.currentUser.profileImage,
          hourlyRate: this.currentUser.hourlyRate,
          experience: this.currentUser.experience,
          specialties: this.currentUser.specialties,
          aboutMe: this.currentUser.aboutMe,
          selectedPetTypes: this.currentUser.selectedPetTypes,
          selectedBreeds: this.currentUser.selectedBreeds,
          firstName: this.currentUser.firstName,
          lastName: this.currentUser.lastName,
          phone: this.currentUser.phone,
          age: this.currentUser.age,
          gender: this.currentUser.gender,
          address: this.currentUser.address,
        };
        
        // Store profile data separately for persistence
        await AsyncStorage.setItem('user_profile_data', JSON.stringify(profileData));
        console.log('AuthService: Profile data saved for persistence');
      }
    } catch (error) {
      console.error('Error saving profile data during logout:', error);
    }
    
    this.currentUser = null;
    
    try {
      // Clear all authentication and user data
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('user_logged_out');
      await AsyncStorage.removeItem('notifications');
      await AsyncStorage.removeItem('user_location');
      await AsyncStorage.removeItem('user_address');
      
      // Clear availability data to ensure clean state for next user
      await this.clearAllAvailabilityData();
      
      console.log('AuthService: All user data cleared');
      
      // Import and clear location service
      const { default: locationService } = await import('./locationService');
      locationService.stopLocationTracking();
      console.log('AuthService: Location tracking stopped');
      
      // Import and clear realtime location service
      const { default: realtimeLocationService } = await import('./realtimeLocationService');
      realtimeLocationService.clearAllSitters();
      console.log('AuthService: Sitter cache cleared');
      
      // Set logout flag to prevent dashboard access
      await AsyncStorage.setItem('user_logged_out', 'true');
      console.log('AuthService: Logout flag set');
      
      console.log('AuthService: User logged out successfully');
    } catch (error) {
      console.error('Error during logout:', error);
      // Continue with logout even if clearing data fails
    } finally {
      // Reset logout flag after a delay to allow cleanup
      setTimeout(() => {
        this.isLoggingOut = false;
      }, 1000);
    }
  }

  async clearAllData(): Promise<void> {
    this.currentUser = null;
    try {
      // Clear authentication data but preserve profile data
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('user_logged_out');
      console.log('clearAllData: Authentication data cleared, profile data preserved');
      
      console.log('Authentication data cleared successfully');
    } catch (error) {
      console.error('Error clearing user data:', error);
      // Continue even if there's an error
    }
  }

  // Method to clear current user from memory
  clearCurrentUser(): void {
    this.currentUser = null;
    console.log('AuthService: Current user cleared from memory');
  }

  // Method to completely clear all data including profile data (for "Start Fresh")
  async clearAllDataIncludingProfile(): Promise<void> {
    this.currentUser = null;
    try {
      // Clear all data including profile data
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('user_logged_out');
      await AsyncStorage.removeItem('user_profile_data');
      console.log('clearAllDataIncludingProfile: All data cleared including profile data');
    } catch (error) {
      console.error('Error clearing all data including profile:', error);
    }
  }

  async getCurrentUser(): Promise<User | null> {
    // Check if we have a current user in memory (from current session)
    if (this.currentUser) {
      console.log('getCurrentUser: Returning current session user:', this.currentUser.email);
      console.log('🔍 GET CURRENT USER DEBUG - Memory user name fields:');
      console.log('  - this.currentUser.firstName:', JSON.stringify(this.currentUser.firstName));
      console.log('  - this.currentUser.lastName:', JSON.stringify(this.currentUser.lastName));
      console.log('  - this.currentUser.name:', JSON.stringify(this.currentUser.name));
      
      // Check if user has a token, if not try to refresh it
      if (!this.currentUser.token) {
        console.log('⚠️ Current user has no token, attempting to refresh...');
        try {
          await this.refreshUserToken();
        } catch (error) {
          console.error('Failed to refresh token:', error);
        }
      }
      
      return this.currentUser;
    }
    
    // Try to restore from storage
    try {
      const stored = await AsyncStorage.getItem('user');
      if (stored) {
        const user = JSON.parse(stored);
        this.currentUser = user;
        console.log('getCurrentUser: Restored user from storage:', user.email);
        console.log('🔍 GET CURRENT USER DEBUG - Storage user name fields:');
        console.log('  - user.firstName:', JSON.stringify(user.firstName));
        console.log('  - user.lastName:', JSON.stringify(user.lastName));
        console.log('  - user.name:', JSON.stringify(user.name));
        
        // Check if restored user has a token, if not try to refresh it
        if (!user.token) {
          console.log('⚠️ Restored user has no token, attempting to refresh...');
          try {
            await this.refreshUserToken();
          } catch (error) {
            console.error('Failed to refresh token for restored user:', error);
          }
        }
        
        return user;
      }
    } catch (error) {
      console.error('Error restoring user from storage:', error);
    }
    
    console.log('getCurrentUser: No user found');
    return null;
  }

  // Method to refresh user token
  async refreshUserToken(): Promise<void> {
    if (!this.currentUser) {
      console.log('❌ Cannot refresh token: No current user');
      return;
    }

    try {
      console.log('🔄 Refreshing token for user:', this.currentUser.email);
      
      // Use direct fetch to avoid circular dependency with makeApiCall
      const { getApiUrl } = await import('./networkService');
      const url = await getApiUrl('/api/refresh-token');
      console.log('🔄 Refresh token URL:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: this.currentUser.email,
        }),
      });

      if (!response.ok) {
        console.error('❌ Token refresh failed:', response.status, response.statusText);
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Token refresh response:', result);
      
      if (result.success && result.token) {
        // Update the current user with the new token
        this.currentUser.token = result.token;
        
        // Update stored user data
        await AsyncStorage.setItem('user', JSON.stringify(this.currentUser));
        
        console.log('✅ Token refreshed successfully for user:', this.currentUser.email);
      } else {
        console.error('❌ Token refresh failed: Invalid response', result);
        throw new Error('Token refresh failed: Invalid response');
      }
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
      
      // If token refresh fails, try to generate a new token
      try {
        await this.generateNewToken();
      } catch (generateError) {
        console.error('❌ Failed to generate new token:', generateError);
        throw error; // Re-throw the original error
      }
    }
  }

  // Method to generate a new token for the user
  async generateNewToken(): Promise<void> {
    if (!this.currentUser) {
      console.log('❌ Cannot generate token: No current user');
      return;
    }

    try {
      console.log('🔄 Generating new token for user:', this.currentUser.email);
      
      // Use direct fetch to avoid circular dependency with makeApiCall
      const { getApiUrl } = await import('./networkService');
      const url = await getApiUrl('/api/generate-token');
      console.log('🔄 Generate token URL:', url);
      
      // Call the backend to generate a new token
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: this.currentUser.email,
        }),
      });

      if (!response.ok) {
        console.error('❌ Token generation failed:', response.status, response.statusText);
        throw new Error(`Token generation failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Token generation response:', result);
      
      if (result.success && result.token) {
        // Update the current user with the new token
        this.currentUser.token = result.token;
        
        // Update stored user data
        await AsyncStorage.setItem('user', JSON.stringify(this.currentUser));
        
        console.log('✅ New token generated successfully for user:', this.currentUser.email);
      } else {
        console.error('❌ Token generation failed: Invalid response', result);
        throw new Error('Token generation failed: Invalid response');
      }
    } catch (error) {
      console.error('❌ Error generating new token:', error);
      throw error;
    }
  }

  // Method to restore profile data from persistent storage
  async restoreProfileData(user: User): Promise<User> {
    try {
      const storedProfileData = await AsyncStorage.getItem('user_profile_data');
      if (storedProfileData) {
        const profileData = JSON.parse(storedProfileData);
        console.log('AuthService: Restoring profile data:', profileData);
        
        // Merge profile data with user data, prioritizing backend data for fresh registrations
        const restoredUser = {
          ...user,
          // Only use stored profile data if backend data is empty/missing
          hourlyRate: user.hourlyRate || profileData.hourlyRate || '',
          experience: user.experience || profileData.experience || '',
          specialties: user.specialties?.length ? user.specialties : (profileData.specialties || []),
          aboutMe: user.aboutMe || profileData.aboutMe || '',
          address: user.address || profileData.address || '',
          phone: user.phone || profileData.phone || '',
          age: user.age || profileData.age,
          gender: user.gender || profileData.gender || '',
          // CRITICAL: For name fields, prioritize backend data (fresh registration) over stored data
          firstName: user.firstName || profileData.firstName || '',
          lastName: user.lastName || profileData.lastName || '',
          selectedPetTypes: user.selectedPetTypes || profileData.selectedPetTypes || [],
          selectedBreeds: user.selectedBreeds || profileData.selectedBreeds || [],
          // CRITICAL: Always preserve profileImage from backend (source of truth)
          profileImage: user.profileImage || profileData.profileImage || undefined,
        };
        
        console.log('AuthService: Original user hourlyRate:', user.hourlyRate);
        console.log('AuthService: Stored profileData hourlyRate:', profileData.hourlyRate);
        console.log('AuthService: Restored user hourlyRate:', restoredUser.hourlyRate);
        
        // Enhanced debugging for name fields in restoreProfileData
        console.log('🔍 RESTORE PROFILE DATA DEBUG:');
        console.log('  - Original user firstName:', JSON.stringify(user.firstName));
        console.log('  - Original user lastName:', JSON.stringify(user.lastName));
        console.log('  - Stored profileData firstName:', JSON.stringify(profileData.firstName));
        console.log('  - Stored profileData lastName:', JSON.stringify(profileData.lastName));
        console.log('  - Restored user firstName:', JSON.stringify(restoredUser.firstName));
        console.log('  - Restored user lastName:', JSON.stringify(restoredUser.lastName));
        console.log('AuthService: Original user profileImage:', user.profileImage);
        console.log('AuthService: Stored profileData profileImage:', profileData.profileImage);
        console.log('AuthService: Restored user profileImage:', restoredUser.profileImage);
        
        this.currentUser = restoredUser;
        await this.saveUserToStorage(restoredUser);
        console.log('AuthService: Profile data restored successfully');
        console.log('AuthService: Restored hourlyRate:', restoredUser.hourlyRate);
        console.log('AuthService: Restored profileImage:', restoredUser.profileImage);
        return restoredUser;
      }
    } catch (error) {
      console.error('Error restoring profile data:', error);
    }
    
    return user;
  }


  async updateUserProfile(profileData: Partial<User>): Promise<User> {
    console.log('AuthService: updateUserProfile called with:', profileData);
    console.log('AuthService: Current user:', this.currentUser);
    console.log('AuthService: Profile image in update data:', profileData.profileImage);
    console.log('AuthService: Name fields in profileData:', {
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      name: profileData.name
    });
    
    // Validate profileData
    if (!profileData) {
      console.error('AuthService: profileData is null or undefined');
      throw new Error('Profile data is required');
    }
    
    // If no current user exists, create a new one
    if (!this.currentUser) {
      console.log('No current user found, creating new user from profile data:', profileData);
      
      // Ensure we have required fields for creating a new user
      if (!profileData.email) {
        console.error('AuthService: Email is required to create a new user');
        throw new Error('Email is required to create a new user');
      }
      
      const newUser: User = {
        id: profileData.id || Date.now().toString(),
        email: profileData.email || '',
        name: profileData.name || `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim(),
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        userRole: profileData.userRole || 'Pet Owner',
        role: profileData.userRole === 'Pet Sitter' ? 'pet_sitter' : 'pet_owner',
        phone: profileData.phone || '',
        age: profileData.age || undefined,
        gender: profileData.gender || '',
        address: profileData.address || '',
        experience: profileData.experience || '',
        hourlyRate: profileData.hourlyRate || '',
        aboutMe: profileData.aboutMe || '',
        specialties: profileData.specialties || [],
        email_verified: profileData.email_verified || false,
        phone_verified: profileData.phone_verified || false,
        selectedPetTypes: profileData.selectedPetTypes || [],
        selectedBreeds: profileData.selectedBreeds || [],
        profileImage: profileData.profileImage || undefined,
      };

      this.currentUser = newUser;
      await this.saveUserToStorage(newUser);
      
      // Clear availability for new pet sitters
      if (newUser.userRole === 'Pet Sitter') {
        await this.clearAvailabilityForNewSitter();
      }
      
      console.log('Created new user in updateUserProfile:', newUser);
      return newUser;
    }

    // Validate current user has required fields
    if (!this.currentUser.id) {
      console.error('AuthService: Current user missing id field:', this.currentUser);
      throw new Error('Current user is missing required id field');
    }
    
    // Ensure current user has firstName and lastName properties
    if (!this.currentUser.firstName) {
      this.currentUser.firstName = '';
    }
    if (!this.currentUser.lastName) {
      this.currentUser.lastName = '';
    }
    
    
    // Update the current user with new profile data
    // CRITICAL: Preserve selectedPetTypes and selectedBreeds if they're empty in profileData
    const updatedUser = { 
      ...this.currentUser, 
      ...profileData,
      // Only update selectedPetTypes and selectedBreeds if they have actual data
      selectedPetTypes: (profileData.selectedPetTypes && profileData.selectedPetTypes.length > 0) 
        ? profileData.selectedPetTypes 
        : this.currentUser.selectedPetTypes || [],
      selectedBreeds: (profileData.selectedBreeds && profileData.selectedBreeds.length > 0) 
        ? profileData.selectedBreeds 
        : this.currentUser.selectedBreeds || []
    };
    console.log('AuthService: Updated user profileImage:', updatedUser.profileImage);
    console.log('AuthService: Preserved selectedPetTypes:', updatedUser.selectedPetTypes);
    console.log('AuthService: Preserved selectedBreeds:', updatedUser.selectedBreeds);
    console.log('AuthService: Updated user name fields:', {
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      name: updatedUser.name
    });
    
    // Update the name field if firstName, lastName, or name changed
    if (profileData.firstName !== undefined || profileData.lastName !== undefined) {
      // If firstName or lastName are being updated, reconstruct the full name
      const firstName = profileData.firstName !== undefined ? profileData.firstName : (this.currentUser.firstName || '');
      const lastName = profileData.lastName !== undefined ? profileData.lastName : (this.currentUser.lastName || '');
      updatedUser.firstName = firstName;
      updatedUser.lastName = lastName;
      updatedUser.name = `${firstName} ${lastName}`.trim();
    } else if (profileData.name) {
      // If name is provided directly, use it and try to split into firstName/lastName
      updatedUser.name = profileData.name;
      const nameParts = profileData.name.trim().split(' ');
      if (nameParts.length >= 2) {
        updatedUser.firstName = nameParts[0];
        updatedUser.lastName = nameParts.slice(1).join(' ');
      } else if (nameParts.length === 1) {
        updatedUser.firstName = nameParts[0];
        updatedUser.lastName = '';
      }
    }

    this.currentUser = updatedUser;
    await this.saveUserToStorage(updatedUser);
    
    // Update profile on backend (single attempt for speed)
    try {
      // Silently update backend
      // console.log('AuthService: Updating profile on backend...');
      await this.updateProfileOnBackend(updatedUser);
      // console.log('AuthService: Profile updated on backend successfully');
    } catch (error) {
      // Silently handle backend update failure
      // console.error('AuthService: Backend update failed:', error instanceof Error ? error.message : 'Unknown error');
      // console.warn('AuthService: Profile updated locally but backend sync failed - will retry on next app open');
    }
    
    // Clear sitter cache to force refresh in find sitter map (regardless of backend success)
    try {
      const { default: realtimeLocationService } = await import('./realtimeLocationService');
      realtimeLocationService.clearSitterCache();
      // Silently clear cache
      // console.log('AuthService: Cleared sitter cache for profile update');
      } catch (cacheError) {
        // Silently handle cache error
        // console.error('AuthService: Error clearing sitter cache:', cacheError);
      }
    
    // Also save profile data persistently
    try {
      const profileData = {
        profileImage: updatedUser.profileImage,
        hourlyRate: updatedUser.hourlyRate,
        experience: updatedUser.experience,
        specialties: updatedUser.specialties,
        aboutMe: updatedUser.aboutMe,
        selectedPetTypes: updatedUser.selectedPetTypes,
        selectedBreeds: updatedUser.selectedBreeds,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phone: updatedUser.phone,
        age: updatedUser.age,
        gender: updatedUser.gender,
        address: updatedUser.address,
      };
      
      await AsyncStorage.setItem('user_profile_data', JSON.stringify(profileData));
      // console.log('AuthService: Profile data saved persistently');
    } catch (error) {
      // Silently handle save error
      // console.error('Error saving profile data persistently:', error);
    }
    
    // Silently log profile update
    // console.log('Updated user profile:', updatedUser);
    // console.log('AuthService: Final user profileImage after save:', updatedUser.profileImage);
    return updatedUser;
  }

  // Update profile on backend
  async updateProfileOnBackend(user: User): Promise<void> {
    try {
      // Silently update backend
      // console.log('AuthService: Updating profile on backend for user:', user.id);
      // console.log('AuthService: User object details:', {
      //   id: user.id,
      //   name: user.name,
      //   firstName: user.firstName,
      //   lastName: user.lastName,
      //   email: user.email,
      //   role: user.role,
      //   userRole: user.userRole
      // });
      
      // Validate required fields
      if (!user.id) {
        throw new Error('User ID is required for profile update');
      }
      if (!user.email) {
        throw new Error('User email is required for profile update');
      }
      if (!user.token) {
        console.warn('AuthService: No authentication token found, skipping backend update');
        console.warn('AuthService: User details:', {
          id: user.id,
          email: user.email,
          role: user.role,
          userRole: user.userRole,
          hasToken: !!user.token
        });
        return;
      }
      
      // Import network service for dynamic IP detection
      const { makeApiCall } = await import('./networkService');
      
      // Only send changed fields to reduce payload size and improve speed
      const updateData: any = {
        id: user.id,
        name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User',
        email: user.email,
        role: user.role || (user.userRole === 'Pet Sitter' ? 'pet_sitter' : 'pet_owner'),
      };
      
      console.log('AuthService: Backend update data - name field:', updateData.name);
      console.log('AuthService: Backend update data - firstName:', user.firstName);
      console.log('AuthService: Backend update data - lastName:', user.lastName);
      console.log('AuthService: Full backend update payload:', JSON.stringify(updateData, null, 2));
      
      // Always include name fields, but provide defaults for empty values
      updateData.first_name = user.firstName || 'User';
      // If last name is empty, use a single space to satisfy backend validation
      updateData.last_name = user.lastName || ' ';
      
      console.log('AuthService: Setting name fields in updateData:');
      console.log('  - user.firstName:', user.firstName);
      console.log('  - user.lastName:', user.lastName);
      console.log('  - updateData.first_name:', updateData.first_name);
      console.log('  - updateData.last_name:', updateData.last_name);
      
      // Ensure the main name field is always updated with the full name
      updateData.name = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User';
      if (user.phone) updateData.phone = user.phone;
      if (user.age) updateData.age = user.age;
      if (user.gender) updateData.gender = user.gender;
      if (user.address) updateData.address = user.address;
      if (user.experience) updateData.experience = user.experience;
      if (user.hourlyRate) updateData.hourly_rate = user.hourlyRate;
      if (user.aboutMe) updateData.bio = user.aboutMe;
      if (user.specialties && user.specialties.length > 0) updateData.specialties = user.specialties;
      if (user.selectedBreeds && user.selectedBreeds.length > 0) updateData.pet_breeds = user.selectedBreeds;
      if (user.selectedPetTypes && user.selectedPetTypes.length > 0) updateData.selected_pet_types = user.selectedPetTypes;
      if (user.profileImage) {
        // Convert full URL back to storage path if needed
        let profileImagePath = user.profileImage;
        if (profileImagePath.startsWith('http')) {
          // Extract storage path from full URL
          const urlParts = profileImagePath.split('/storage/');
          if (urlParts.length > 1) {
            profileImagePath = urlParts[1];
          }
        }
        updateData.profile_image = profileImagePath;
        console.log('AuthService: Backend update data - profile_image:', profileImagePath);
      }
      
      const response = await makeApiCall('/api/profile/update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Silently handle backend update failure
        // console.error('Backend profile update failed:', response.status, errorText);
        // console.error('Response URL:', response.url);
        // console.error('Response headers:', response.headers);
        // console.error('Request body sent:', JSON.stringify(updateData, null, 2));
        throw new Error(`Backend update failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      // console.log('Backend profile update successful:', result);
    } catch (error) {
      // Silently handle error
      // console.error('Error updating profile on backend:', error);
      throw error;
    }
  }

  // Clear availability for new pet sitters
  async clearAvailabilityForNewSitter(): Promise<void> {
    try {
      console.log('AuthService: Clearing availability for new pet sitter');
      await AsyncStorage.removeItem('petSitterAvailabilities');
      console.log('AuthService: Availability cleared for new sitter');
    } catch (error) {
      console.error('AuthService: Error clearing availability for new sitter:', error);
    }
  }

  // New method to store complete user data from backend registration
  async storeUserFromBackend(backendUser: any): Promise<User> {
    console.log('Storing user data from backend:', backendUser);
    console.log('Backend user hourly_rate:', backendUser.hourly_rate);
    console.log('Backend user role:', backendUser.role);
    console.log('Backend user object keys:', Object.keys(backendUser));
    console.log('Backend user role type:', typeof backendUser.role);
    console.log('Backend user role === pet_sitter:', backendUser.role === 'pet_sitter');
    
    // Enhanced debugging for backend user name fields
    console.log('🔍 STORE USER FROM BACKEND DEBUG:');
    console.log('  - backendUser.first_name:', JSON.stringify(backendUser.first_name));
    console.log('  - backendUser.last_name:', JSON.stringify(backendUser.last_name));
    console.log('  - backendUser.name:', JSON.stringify(backendUser.name));
    
    // Clear logout flag and old profile data when user registers
    await AsyncStorage.removeItem('user_logged_out');
    await AsyncStorage.removeItem('user_profile_data'); // Clear old profile data to prevent override
    
    // Check if backendUser exists and has required fields
    if (!backendUser || !backendUser.id) {
      console.error('Invalid backend user data received:', backendUser);
      throw new Error('Invalid user data received from backend');
    }
    
    const user: User = {
      id: backendUser.id.toString(),
      email: backendUser.email || '',
      name: backendUser.name || '',
      firstName: backendUser.first_name || '',
      lastName: backendUser.last_name || '',
      userRole: backendUser.role === 'pet_owner' ? 'Pet Owner' : 'Pet Sitter',
      role: backendUser.role || 'pet_owner',
      phone: backendUser.phone || '',
      age: backendUser.age,
      gender: backendUser.gender || '',
      address: backendUser.address || '',
      aboutMe: backendUser.bio || '',
      email_verified: backendUser.email_verified || false,
      phone_verified: backendUser.phone_verified || false,
      selectedPetTypes: backendUser.selected_pet_types || [],
      selectedBreeds: backendUser.pet_breeds || [],
      profileImage: backendUser.profile_image_url || backendUser.profile_image || undefined,
      token: backendUser.token || undefined,
      // Always include sitter-specific fields for pet sitters
      experience: (backendUser.role === 'pet_sitter' || backendUser.role === 'Pet Sitter') ? (backendUser.experience || '') : '',
      hourlyRate: (backendUser.role === 'pet_sitter' || backendUser.role === 'Pet Sitter') ? (backendUser.hourly_rate !== null && backendUser.hourly_rate !== undefined ? String(backendUser.hourly_rate) : '') : '',
      maxPets: (backendUser.role === 'pet_sitter' || backendUser.role === 'Pet Sitter') ? (backendUser.max_pets !== null && backendUser.max_pets !== undefined ? backendUser.max_pets : 10) : undefined,
      max_pets: (backendUser.role === 'pet_sitter' || backendUser.role === 'Pet Sitter') ? (backendUser.max_pets !== null && backendUser.max_pets !== undefined ? backendUser.max_pets : 10) : undefined,
      specialties: (backendUser.role === 'pet_sitter' || backendUser.role === 'Pet Sitter') ? (backendUser.specialties || []) : [],
    };

    console.log('Created user object:', user);
    console.log('User hourlyRate:', user.hourlyRate);
    console.log('User hourlyRate type:', typeof user.hourlyRate);
    console.log('User hourlyRate value:', JSON.stringify(user.hourlyRate));
    console.log('User role:', user.role);
    
    // Enhanced debugging for created user object in storeUserFromBackend
    console.log('🔍 STORE USER FROM BACKEND - Created user object:');
    console.log('  - user.firstName:', JSON.stringify(user.firstName));
    console.log('  - user.lastName:', JSON.stringify(user.lastName));
    console.log('  - user.name:', JSON.stringify(user.name));

    this.currentUser = user;
    await this.saveUserToStorage(user);
    
    // For fresh registrations, don't restore old profile data to prevent override
    // The backend data is the source of truth for new registrations
    console.log('User data stored from backend successfully (fresh registration):', user);
    console.log('Final hourlyRate:', user.hourlyRate);
    console.log('Final profileImage:', user.profileImage);
    console.log('Final firstName:', user.firstName);
    console.log('Final lastName:', user.lastName);
    return user;
  }

  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user !== null;
  }

  private async saveUserToStorage(user: User): Promise<void> {
    try {
      console.log('saveUserToStorage: Saving user to AsyncStorage:', user.email);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      console.log('saveUserToStorage: User saved successfully to AsyncStorage');
    } catch (error) {
      console.error('Error saving user to storage:', error);
    }
  }

  // Clear availability data for new sitters
  private async clearAvailabilityDataForNewSitter(userId: string): Promise<void> {
    try {
      console.log('🆕 Clearing availability data for new sitter:', userId);
      
      // Clear all availability data
      await AsyncStorage.removeItem('petSitterAvailabilities');
      await AsyncStorage.removeItem('petSitterWeeklyAvailabilities');
      
      // Mark this sitter as having initialized their availability
      await AsyncStorage.setItem(`sitter_${userId}_availability_initialized`, 'true');
      
      console.log('✅ Availability data cleared for new sitter');
    } catch (error) {
      console.error('❌ Error clearing availability data for new sitter:', error);
    }
  }

  // Clear all old user data (used during login)
  private async clearAllOldUserData(): Promise<void> {
    try {
      console.log('🧹 Clearing all old user data before login');
      
      // Clear all booking data
      await AsyncStorage.removeItem('bookings');
      
      // Clear all availability data (both old format and new user-specific format)
      await AsyncStorage.removeItem('petSitterAvailabilities');
      await AsyncStorage.removeItem('petSitterWeeklyAvailabilities');
      
      // Clear all user-specific availability data
      const keys = await AsyncStorage.getAllKeys();
      const availabilityKeys = keys.filter(key => 
        key.startsWith('petSitterAvailabilities_') || 
        key.startsWith('petSitterWeeklyAvailabilities_')
      );
      
      for (const key of availabilityKeys) {
        await AsyncStorage.removeItem(key);
      }
      
      // Clear all sitter initialization flags
      const sitterKeys = keys.filter(key => key.startsWith('sitter_') && key.endsWith('_availability_initialized'));
      
      for (const key of sitterKeys) {
        await AsyncStorage.removeItem(key);
      }
      
      // Clear notification data
      await AsyncStorage.removeItem('notifications');
      
      // Clear location data
      await AsyncStorage.removeItem('user_location');
      await AsyncStorage.removeItem('user_address');
      
      console.log('✅ All old user data cleared');
    } catch (error) {
      console.error('❌ Error clearing old user data:', error);
    }
  }

  // Clear all availability data (used during logout)
  private async clearAllAvailabilityData(): Promise<void> {
    try {
      console.log('🧹 Clearing all availability data during logout');
      
      // Get current user to clear their specific data
      const currentUser = this.currentUser;
      
      // Clear all availability data (both old format and new user-specific format)
      await AsyncStorage.removeItem('petSitterAvailabilities');
      await AsyncStorage.removeItem('petSitterWeeklyAvailabilities');
      
      // Clear user-specific availability data if user exists
      if (currentUser && currentUser.id) {
        await AsyncStorage.removeItem(`petSitterAvailabilities_${currentUser.id}`);
        await AsyncStorage.removeItem(`petSitterWeeklyAvailabilities_${currentUser.id}`);
        console.log(`✅ Cleared availability data for user: ${currentUser.id}`);
      }
      
      // Clear all sitter initialization flags
      const keys = await AsyncStorage.getAllKeys();
      const sitterKeys = keys.filter(key => key.startsWith('sitter_') && key.endsWith('_availability_initialized'));
      
      for (const key of sitterKeys) {
        await AsyncStorage.removeItem(key);
      }
      
      // Also clear any user-specific availability data for all users (cleanup)
      const availabilityKeys = keys.filter(key => 
        key.startsWith('petSitterAvailabilities_') || 
        key.startsWith('petSitterWeeklyAvailabilities_')
      );
      
      for (const key of availabilityKeys) {
        await AsyncStorage.removeItem(key);
      }
      
      console.log('✅ All availability data cleared');
    } catch (error) {
      console.error('❌ Error clearing all availability data:', error);
    }
  }
}

export default AuthService.getInstance(); 