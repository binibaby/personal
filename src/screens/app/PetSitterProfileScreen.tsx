import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import CertificateAlbum from '../../components/CertificateAlbum';
// import PullToRefreshWrapper from '../../components/PullToRefreshWrapper';
import { useAuth } from '../../contexts/AuthContext';
import echoService from '../../services/echoService';
import echoServiceFallback from '../../services/echoServiceFallback';
import { EchoServiceInterface } from '../../services/echoServiceInterface';
import { RealtimeNotificationData, realtimeNotificationService } from '../../services/realtimeNotificationService';
import verificationService from '../../services/verificationService';

const PetSitterProfileScreen = () => {
  const router = useRouter();
  const { user, logout, updateUserProfile, currentLocation, userAddress, startLocationTracking, refresh } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    hourlyRate: '',
    location: '',
    specialties: [] as string[],
    experience: '',
    maxPets: '',
    rating: 0,
    reviews: 0,
  });
  const [profileImage, setProfileImage] = useState<string | null>(user?.profileImage || null);
  const [imageError, setImageError] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [certificateAlbumVisible, setCertificateAlbumVisible] = useState(false);
  
  // Profile update request states
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [cooldownInfo, setCooldownInfo] = useState<any>(null);
  const [requestData, setRequestData] = useState<{
    firstName: string;
    lastName: string;
    phone: string;
    hourlyRate: string;
    experience: string;
    maxPets: string;
    reason: string;
  }>({
    firstName: '',
    lastName: '',
    phone: '',
    hourlyRate: '',
    experience: '',
    maxPets: '',
    reason: '',
  });
  
  // Verification states
  const [verification, setVerification] = useState<any>(null);
  const [isVerificationLoading, setIsVerificationLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [certificates, setCertificates] = useState([
    // Sample certificates - in real app, these would come from API
    {
      id: '1',
      name: 'Pet First Aid Certification',
      image: 'https://via.placeholder.com/300x200/4CAF50/white?text=Pet+First+Aid',
      date: '2024-01-15',
      issuer: 'Pet Care Academy',
    },
    {
      id: '2',
      name: 'Dog Training Certificate',
      image: 'https://via.placeholder.com/300x200/2196F3/white?text=Dog+Training',
      date: '2024-02-20',
      issuer: 'Canine Training Institute',
    },
  ]);
  
  const [verificationStatus, setVerificationStatus] = useState({
    isVerified: false,
    isLegitSitter: false,
    verificationBadges: [] as string[],
    verificationStatus: 'pending',
    reviewDeadline: null as string | null,
  });
  
  // Real-time notification state
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  // Auto-populate location field when userAddress is available
  useEffect(() => {
    if (userAddress) {
      console.log('📍 PetSitterProfileScreen: Auto-populating location field with:', userAddress);
      setProfile(prev => ({
        ...prev,
        location: userAddress
      }));
    }
  }, [userAddress]);

  // Load verification status and setup real-time connection
  useEffect(() => {
    loadVerificationStatus();
    setupRealTimeConnection();
    checkCooldownStatus();
    
    return () => {
      // Cleanup real-time connection
      if (user?.id) {
        echoService.stopListeningToVerificationUpdates(String(user.id));
        echoServiceFallback.stopListeningToVerificationUpdates(String(user.id));
      }
      echoService.disconnect();
      echoServiceFallback.disconnect();
    };
  }, []);

  // Setup real-time connection
  const setupRealTimeConnection = async () => {
    if (!user?.id) return;

    try {
      // Set auth token for private channels
      const authToken = await getAuthToken();
      if (authToken) {
        echoService.setAuthToken(authToken);
        echoServiceFallback.setAuthToken(authToken);
      }

      // Try main Echo service first
      let connected = await echoService.connect();
      let service: EchoServiceInterface = echoService;

      // If main service fails, use fallback
      if (!connected) {
        console.warn('Main Echo service failed, using fallback polling service');
        connected = await echoServiceFallback.connect();
        service = echoServiceFallback as EchoServiceInterface;
      }

      setIsConnected(connected);

      if (connected) {
        // Listen for verification updates
        const channel = service.listenToVerificationUpdates(String(user.id), async (data) => {
          console.log('📡 Real-time verification update received:', data);
          setLastUpdate(new Date());
          
          // Update verification status
          if (data.verification) {
            setVerification(data.verification);
            setVerificationStatus({
              isVerified: data.verification.verification_status === 'approved',
              isLegitSitter: data.verification.is_legit_sitter || false,
              verificationBadges: data.verification.badges_earned?.map((badge: any) => badge.id) || [],
              verificationStatus: data.verification.verification_status || 'pending',
              reviewDeadline: data.verification.review_deadline || null,
            });
          }
          
          // Show success/error message only once per verification update
          if (data.status === 'approved' || data.status === 'rejected') {
            const verificationId = data.verification_id || data.verification?.id;
            
            if (!verificationId) {
              console.warn('⚠️ No verification ID in update data, skipping alert tracking');
              return;
            }
            
            try {
              // Create a unique key for this verification status change
              const alertKey = `verification_${verificationId}_${data.status}`;
              
              // Check if we've already shown this alert for this verification
              const lastShownAlert = await AsyncStorage.getItem(`last_verification_alert_${user.id}`);
              
              // Only show alert if this is a different verification or status change
              if (lastShownAlert !== alertKey) {
                // Save that we've shown this alert
                await AsyncStorage.setItem(`last_verification_alert_${user.id}`, alertKey);
                
                if (data.status === 'approved') {
                  Alert.alert(
                    '🎉 Verification Approved!',
                    data.message || '🎉 Congratulations! Your ID verification has been approved! You can now start accepting jobs and bookings.',
                    [{ text: 'OK', onPress: () => refresh() }]
                  );
                } else if (data.status === 'rejected') {
                  Alert.alert(
                    '❌ Verification Rejected',
                    data.message || 'Your ID verification has been rejected. Please contact the admin at petsitconnectph@gmail.com for further assistance in resolving this issue.',
                    [{ text: 'OK' }]
                  );
                }
              } else {
                console.log('⏭️ Skipping alert - already shown for verification', verificationId, 'status', data.status);
              }
            } catch (error) {
              console.error('Error checking alert history:', error);
              // If error checking, show the alert anyway (better to show than miss)
              if (data.status === 'approved') {
                Alert.alert(
                  '🎉 Verification Approved!',
                  data.message || '🎉 Congratulations! Your ID verification has been approved! You can now start accepting jobs and bookings.',
                  [{ text: 'OK', onPress: () => refresh() }]
                );
              } else if (data.status === 'rejected') {
                Alert.alert(
                  '❌ Verification Rejected',
                  data.message || 'Your ID verification has been rejected. Please contact the admin at petsitconnectph@gmail.com for further assistance in resolving this issue.',
                  [{ text: 'OK' }]
                );
              }
            }
          }
        });

        if (channel) {
          console.log('👂 Real-time listener set up successfully');
        }
      }
    } catch (error) {
      console.error('❌ Failed to setup real-time connection:', error);
      setIsConnected(false);
    }
  };

  // Get auth token
  const getAuthToken = async (): Promise<string> => {
    try {
      const { default: authService } = await import('../../services/authService');
      if (!authService) {
        console.error('AuthService not found in import');
        return '';
      }
      const currentUser = await authService.getCurrentUser();
      return currentUser?.token || '';
    } catch (error) {
      console.error('Error getting auth token:', error);
      return '';
    }
  };

  // Load verification status
  const loadVerificationStatus = async () => {
    try {
      setIsVerificationLoading(true);
      const response = await verificationService.getVerificationStatusFromAPI();
      
      if (response.success) {
        setVerification(response.verification || null);
        setVerificationStatus({
          isVerified: response.verification?.verification_status === 'approved',
          isLegitSitter: response.verification?.is_legit_sitter || false,
          verificationBadges: response.badges?.map((badge: any) => badge.id) || [],
          verificationStatus: response.verification?.verification_status || 'pending',
          reviewDeadline: response.verification?.review_deadline || null,
        });
      }
    } catch (error) {
      console.error('Error loading verification status:', error);
    } finally {
      setIsVerificationLoading(false);
    }
  };

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadVerificationStatus();
    setRefreshing(false);
  }, []);

  const fetchVerificationStatus = async () => {
    try {
      // Fetch real verification status from API
      const { makeApiCall } = await import('../../services/networkService');
      const response = await makeApiCall('/api/verification/status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setVerificationStatus({
          isVerified: data.verification?.verification_status === 'approved',
          isLegitSitter: data.verification?.is_legit_sitter || false,
          verificationBadges: data.badges?.map((badge: any) => badge.id) || [],
          verificationStatus: data.verification?.verification_status || 'pending',
          reviewDeadline: data.verification?.review_deadline || null,
        });
      } else {
        // If no verification found, set to pending state
        setVerificationStatus({
          isVerified: false,
          isLegitSitter: false,
          verificationBadges: [],
          verificationStatus: 'pending',
          reviewDeadline: null,
        });
      }
    } catch (error) {
      console.error('Error fetching verification status:', error);
      // Set to pending state on error
      setVerificationStatus({
        isVerified: false,
        isLegitSitter: false,
        verificationBadges: [],
        verificationStatus: 'pending',
        reviewDeadline: null,
      });
    }
  };

  // Start location tracking when user logs in
  useEffect(() => {
    if (user && !currentLocation) {
      console.log('📍 PetSitterProfileScreen: Starting location tracking for user');
      startLocationTracking(1000);
    }
  }, [user, currentLocation, startLocationTracking]);

  // Load certificates from API when component mounts
  useEffect(() => {
    if (user) {
      loadCertificatesFromAPI();
      loadVerificationStatus(); // Fetch verification status when user loads
    }
  }, [user]);

  // Initialize real-time notifications for verification status updates
  useEffect(() => {
    if (!user) return;

    const initializeRealtime = async () => {
      try {
        console.log('🔔 Initializing real-time notifications for pet sitter profile:', user.id);
        const connected = await realtimeNotificationService.initialize(user.id, user.token || '');
        setRealtimeConnected(connected);
        
        if (connected) {
          console.log('✅ Real-time notifications connected for pet sitter profile');
        } else {
          console.warn('⚠️ Real-time notifications not available for pet sitter profile');
        }
      } catch (error) {
        console.error('❌ Error initializing real-time notifications:', error);
        setRealtimeConnected(false);
      }
    };

    initializeRealtime();

    // Set up real-time notification listener for verification updates
    const unsubscribe = realtimeNotificationService.subscribe((notification: RealtimeNotificationData) => {
      console.log('🔔 Real-time notification received in PetSitterProfileScreen:', notification);
      
      // Handle verification status updates
      if (notification.type === 'id_verification_approved' || notification.type === 'id_verification_rejected') {
        console.log('🔄 Verification status updated, refreshing profile...');
        // Refresh verification status immediately
        loadVerificationStatus();
        
        // Show notification to user
        Alert.alert(
          notification.title,
          notification.message,
          [
            { text: 'OK', onPress: () => console.log('User acknowledged verification update') }
          ]
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Update profile data when user changes
  useEffect(() => {
    if (user) {
      console.log('📱 PetSitterProfileScreen: Updating profile data from user:', user);
      console.log('📱 PetSitterProfileScreen: user.hourlyRate:', user.hourlyRate);
      console.log('📱 PetSitterProfileScreen: user.experience:', user.experience);
      console.log('📱 PetSitterProfileScreen: user.role:', user.role);
      console.log('📱 PetSitterProfileScreen: user.userRole:', user.userRole);
      
      // Split name into firstName and lastName
      const nameParts = (user.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const updatedProfile = {
        firstName: firstName,
        lastName: lastName,
        email: user.email || '',
        phone: user.phone || '',
        hourlyRate: user.hourlyRate || '',
        location: userAddress || '', // Use only real-time location
        specialties: user.specialties || [],
        experience: user.experience || '',
        maxPets: user.maxPets !== undefined && user.maxPets !== null ? String(user.maxPets) : (user.max_pets !== undefined && user.max_pets !== null ? String(user.max_pets) : ''),
        rating: 0,
        reviews: 0,
      };
      
      console.log('📱 PetSitterProfileScreen: Updated profile object:', updatedProfile);
      console.log('📱 PetSitterProfileScreen: Profile hourlyRate:', updatedProfile.hourlyRate);
      
      setProfile(updatedProfile);
    } else {
      console.log('📱 PetSitterProfileScreen: No user data available');
    }
  }, [user, userAddress]);

  // Refresh user data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 PetSitterProfileScreen: Screen focused, refreshing user data');
      console.log('📱 PetSitterProfileScreen: Current user:', user);
      console.log('📱 PetSitterProfileScreen: Current user hourlyRate:', user?.hourlyRate);
      console.log('📱 PetSitterProfileScreen: Current user maxPets:', user?.maxPets);
      console.log('📱 PetSitterProfileScreen: Current user max_pets:', user?.max_pets);
      
      // Refresh user data from backend if maxPets is missing
      if (user && user.role === 'pet_sitter' && (user.maxPets === undefined || user.max_pets === undefined)) {
        console.log('📱 PetSitterProfileScreen: maxPets missing, refreshing user data from backend');
        refresh().catch(error => {
          console.error('Error refreshing user data:', error);
        });
      }
      
      // Force update profile data when screen comes into focus
      if (user) {
        // Split name into firstName and lastName
        const nameParts = (user.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const updatedProfile = {
          firstName: firstName,
          lastName: lastName,
          email: user.email || '',
          phone: user.phone || '',
          hourlyRate: user.hourlyRate || '',
          location: user.address || '',
          specialties: user.specialties || [],
          experience: user.experience || '',
          rating: 0,
          reviews: 0,
        };
        
        console.log('📱 PetSitterProfileScreen: Force updating profile on focus:', updatedProfile);
        setProfile(updatedProfile);
        
        // Also fetch verification status when screen comes into focus
        loadVerificationStatus();
      }
    }, [user])
  );

  const handleBack = () => {
    router.back();
  };

  const handleSave = async () => {
    try {
      // Combine firstName and lastName into full name
      const fullName = `${profile.firstName} ${profile.lastName}`.trim();
      
      // Update the user profile with the new data
      await updateUserProfile({
        name: fullName,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        hourlyRate: profile.hourlyRate,
        address: profile.location,
        specialties: profile.specialties,
        experience: profile.experience,
      });
      
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  const handleEdit = () => {
    // Pre-populate request data with current user data
    if (user) {
      // Split name into firstName and lastName
      const nameParts = (user.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      setRequestData({
        firstName: firstName,
        lastName: lastName,
        phone: user.phone || '',
        hourlyRate: user.hourlyRate ? user.hourlyRate.toString() : '',
        experience: user.experience || '',
        maxPets: user.maxPets !== undefined && user.maxPets !== null ? String(user.maxPets) : (user.max_pets !== undefined && user.max_pets !== null ? String(user.max_pets) : ''),
        reason: '', // Leave reason empty for user to fill
      });
    }
    setIsEditing(true);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Refresh user data from the server
      await refresh();
      
      // Update profile data with fresh user data
      if (user) {
        const nameParts = (user.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        setProfile({
          firstName: firstName,
          lastName: lastName,
          email: user.email || '',
          phone: user.phone || '',
          location: user.address || '',
          hourlyRate: user.hourlyRate || '',
          experience: user.experience || '',
          maxPets: user.maxPets !== undefined && user.maxPets !== null ? String(user.maxPets) : (user.max_pets !== undefined && user.max_pets !== null ? String(user.max_pets) : ''),
          specialties: user.specialties || [],
          rating: 0, // Default value since rating is not in User type
          reviews: 0, // Default value since reviews is not in User type
        });
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
      Alert.alert('Error', 'Failed to refresh profile. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddCertificate = async (certificate: any) => {
    try {
      const newCertificate = {
        ...certificate,
        id: Date.now().toString(),
      };
      const updatedCertificates = [...certificates, newCertificate];
      setCertificates(updatedCertificates);
      
      // Save to API
      await saveCertificatesToAPI(updatedCertificates);
      
      Alert.alert('Success', 'Certificate added successfully!');
    } catch (error) {
      console.error('Error adding certificate:', error);
      Alert.alert('Error', 'Failed to add certificate. Please try again.');
    }
  };

  const handleDeleteCertificate = async (certificateId: string) => {
    try {
      const updatedCertificates = certificates.filter(cert => cert.id !== certificateId);
      setCertificates(updatedCertificates);
      
      // Save to API
      await saveCertificatesToAPI(updatedCertificates);
      
      Alert.alert('Success', 'Certificate deleted successfully!');
    } catch (error) {
      // Silently handle errors
      // console.error('Error deleting certificate:', error);
      Alert.alert('Error', 'Failed to delete certificate. Please try again.');
      // Revert the change on error
      // The certificates state will be restored from the API on next refresh
    }
  };

  const saveCertificatesToAPI = async (certificatesToSave: any[]) => {
    try {
      const { makeApiCall } = await import('../../services/networkService');
      const { default: authService } = await import('../../services/authService');
      if (!authService) {
        console.error('AuthService not found in import');
        return;
      }
      
      // Get fresh user data with token
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        Alert.alert(
          'Authentication Required',
          'Your session has expired. Please log in again.',
          [
            { text: 'OK', onPress: () => router.replace('/auth') }
          ]
        );
        throw new Error('No user found for certificates API call');
      }
      
      if (!currentUser.token) {
        console.error('No token found for user:', currentUser.email);
        
        // Try to refresh the token first
        try {
          console.log('🔄 Attempting to refresh token for user:', currentUser.email);
          await authService.refreshUserToken();
          
          // Get the user again after token refresh
          const refreshedUser = await authService.getCurrentUser();
          if (!refreshedUser || !refreshedUser.token) {
            throw new Error('Token refresh failed');
          }
          
          console.log('✅ Token refreshed successfully, retrying API call');
          // Retry the API call with the new token
          return saveCertificatesToAPI(certificatesToSave);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          Alert.alert(
            'Authentication Required',
            'Your session has expired. Please log in again.',
            [
              { text: 'OK', onPress: () => router.replace('/auth') }
            ]
          );
          throw new Error('No token found for user');
        }
      }
      
      // Ensure we always send a valid array, even if empty
      const certificatesArray = Array.isArray(certificatesToSave) ? certificatesToSave : [];
      
      // Always ensure certificates is an array, even if empty
      const requestBody = { 
        certificates: certificatesArray
      };
      
      // Silently log for debugging
      // console.log('📋 Sending certificates to API:', {
      //   certificatesCount: certificatesArray.length,
      //   certificates: certificatesArray,
      //   requestBody: requestBody
      // });
      // console.log('📋 Request body JSON:', JSON.stringify(requestBody, null, 2));

      const response = await makeApiCall('/api/profile/save-certificates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentUser.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // console.log('📋 API Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        // Silently handle API errors
        // console.error('API Error Response:', errorText);
        
        if (response.status === 401) {
          // Silently handle authentication errors
          // console.error('Authentication failed - token may be invalid or expired');
          // Try to refresh the user session
          try {
            const { default: authService } = await import('../../services/authService');
            if (!authService) {
              // console.error('AuthService not found in retry import');
              return;
            }
            const refreshedUser = await authService.getCurrentUser();
            if (refreshedUser?.token && refreshedUser.token !== currentUser.token) {
              // console.log('Token refreshed, retrying save certificates API call');
              // Retry with refreshed token - ensure proper request body format
              const certificatesArray = Array.isArray(certificatesToSave) ? certificatesToSave : [];
              const retryRequestBody = { certificates: certificatesArray };
              const retryResponse = await makeApiCall('/api/profile/save-certificates', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${refreshedUser.token}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                },
                body: JSON.stringify(retryRequestBody),
              });
              
              if (retryResponse.ok) {
                const retryResult = await retryResponse.json();
                // console.log('Certificates saved successfully after token refresh:', retryResult);
                return;
              }
            }
          } catch (refreshError) {
            // Silently handle refresh errors
            // console.error('Error refreshing user token:', refreshError);
          }
          throw new Error('Authentication failed. Please log in again.');
        }
        
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      // Silently handle success
      // console.log('Certificates saved successfully:', result);
    } catch (error) {
      // Silently handle errors
      // console.error('Error saving certificates to API:', error);
      throw error;
    }
  };

  const loadCertificatesFromAPI = async () => {
    try {
      const { makeApiCall } = await import('../../services/networkService');
      
      const { default: authService } = await import('../../services/authService');
      if (!authService) {
        console.error('AuthService not found in import');
        return;
      }
      
      // Get fresh user data with token
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        console.error('No user found for certificates API call');
        Alert.alert(
          'Authentication Required',
          'Your session has expired. Please log in again.',
          [
            { text: 'OK', onPress: () => router.replace('/auth') }
          ]
        );
        return;
      }
      
      if (!currentUser.token) {
        console.error('No token found for user:', currentUser.email);
        
        // Try to refresh the token first
        try {
          console.log('🔄 Attempting to refresh token for user:', currentUser.email);
          await authService.refreshUserToken();
          
          // Get the user again after token refresh
          const refreshedUser = await authService.getCurrentUser();
          if (!refreshedUser || !refreshedUser.token) {
            throw new Error('Token refresh failed');
          }
          
          console.log('✅ Token refreshed successfully, retrying API call');
          // Retry the API call with the new token
          return loadCertificatesFromAPI();
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          Alert.alert(
            'Authentication Required',
            'Your session has expired. Please log in again.',
            [
              { text: 'OK', onPress: () => router.replace('/auth') }
            ]
          );
          return;
        }
      }
      
      console.log('Loading certificates with token:', currentUser.token.substring(0, 10) + '...');
      
      const response = await makeApiCall('/api/profile/certificates', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${currentUser.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        
        if (response.status === 401) {
          console.error('Authentication failed - token may be invalid or expired');
          // Try to refresh the user session
          try {
            const { default: authService } = await import('../../services/authService');
            if (!authService) {
              console.error('AuthService not found in retry import');
              return;
            }
            const refreshedUser = await authService.getCurrentUser();
            if (refreshedUser?.token && refreshedUser.token !== currentUser.token) {
              console.log('Token refreshed, retrying API call');
              // Retry with refreshed token
              const retryResponse = await makeApiCall('/api/profile/certificates', {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${refreshedUser.token}`,
                  'Content-Type': 'application/json',
                },
              });
              
              if (retryResponse.ok) {
                const retryResult = await retryResponse.json();
                if (retryResult.success && retryResult.certificates) {
                  setCertificates(retryResult.certificates);
                  console.log('Certificates loaded successfully after token refresh:', retryResult.certificates);
                  return;
                }
              }
            }
          } catch (refreshError) {
            console.error('Error refreshing user token:', refreshError);
          }
        }
        
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      if (result.success && result.certificates) {
        setCertificates(result.certificates);
        console.log('Certificates loaded successfully:', result.certificates);
      }
    } catch (error) {
      console.error('Error loading certificates from API:', error);
      // Don't show error to user as this is a background operation
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset request data to empty values
    setRequestData({
      firstName: '',
      lastName: '',
      phone: '',
      hourlyRate: '',
      experience: '',
      reason: '',
    });
  };

  // Profile update request functions
  const checkCooldownStatus = async () => {
    try {
      const { makeApiCall } = await import('../../services/networkService');
      const { default: authService } = await import('../../services/authService');
      if (!authService) {
        console.error('AuthService not found in import');
        return;
      }
      
      // Get fresh user data with token
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        console.error('No user found for cooldown check');
        Alert.alert(
          'Authentication Required',
          'Please log in to check your profile update status.',
          [
            { text: 'OK', onPress: () => router.replace('/auth') }
          ]
        );
        return;
      }

      if (!currentUser.token) {
        console.error('No token found for user:', currentUser.email);
        
        // Try to refresh the token first
        try {
          console.log('🔄 Attempting to refresh token for cooldown check');
          await authService.refreshUserToken();
          
          // Get the user again after token refresh
          const refreshedUser = await authService.getCurrentUser();
          if (!refreshedUser || !refreshedUser.token) {
            throw new Error('Token refresh failed');
          }
          
          console.log('✅ Token refreshed successfully, retrying cooldown check');
          // Retry the API call with the new token
          return checkCooldownStatus();
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          Alert.alert(
            'Authentication Required',
            'Your session has expired. Please log in again.',
            [
              { text: 'OK', onPress: () => router.replace('/auth') }
            ]
          );
          return;
        }
      }
      
      const response = await makeApiCall('/api/profile/update-request/check-pending', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${currentUser.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        setCooldownInfo(result.cooldown_info || null);
      }
    } catch (error) {
      console.error('Error checking cooldown status:', error);
    }
  };

  const handleSubmitProfileRequest = async () => {
    try {
      setIsSubmittingRequest(true);
      
      // Validate required fields
      if (!requestData.firstName.trim() || !requestData.lastName.trim()) {
        Alert.alert('Validation Error', 'First name and last name are required');
        return;
      }
      
      if (!requestData.reason.trim()) {
        Alert.alert('Validation Error', 'Please provide a reason for the changes');
        return;
      }
      
      console.log('PetSitterProfileScreen: Submitting profile update request:', requestData);
      
      const { submitProfileUpdateRequest } = await import('../../services/networkService');
      const { default: authService } = await import('../../services/authService');
      if (!authService) {
        console.error('AuthService not found in import');
        return;
      }
      
      // Get fresh user data with token
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        Alert.alert(
          'Authentication Required',
          'Please log in to submit profile update requests.',
          [
            { text: 'OK', onPress: () => router.replace('/auth') }
          ]
        );
        return;
      }

      if (!currentUser.token) {
        console.error('No token found for user:', currentUser.email);
        
        // Try to refresh the token first
        try {
          console.log('🔄 Attempting to refresh token for profile update request');
          await authService.refreshUserToken();
          
          // Get the user again after token refresh
          const refreshedUser = await authService.getCurrentUser();
          if (!refreshedUser || !refreshedUser.token) {
            throw new Error('Token refresh failed');
          }
          
          console.log('✅ Token refreshed successfully, retrying profile update request');
          // Retry the API call with the new token
          return handleSubmitProfileRequest();
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          Alert.alert(
            'Authentication Required',
            'Your session has expired. Please log in again.',
            [
              { text: 'OK', onPress: () => router.replace('/auth') }
            ]
          );
          return;
        }
      }
      
      const response = await submitProfileUpdateRequest({
        firstName: requestData.firstName.trim(),
        lastName: requestData.lastName.trim(),
        phone: requestData.phone.trim(),
        hourlyRate: requestData.hourlyRate.trim(),
        experience: requestData.experience.trim(),
        maxPets: requestData.maxPets.trim(),
        reason: requestData.reason.trim(),
      }, currentUser.token, currentUser.role || 'pet_sitter');
      
      console.log('PetSitterProfileScreen: Profile update request response:', response);
      
      if (response.success) {
        Alert.alert(
          'Request Submitted', 
          'Your update request has been submitted. Please wait for the admin to examine and approve your changes.',
          [{ text: 'OK', onPress: () => setIsEditing(false) }]
        );
        // Reset form
        setRequestData({
          firstName: '',
          lastName: '',
          phone: '',
          hourlyRate: '',
          experience: '',
          reason: '',
        });
        // Refresh cooldown status
        await checkCooldownStatus();
      } else {
        // Check if it's a cooldown error
        if (response.cooldown_info && response.cooldown_info.in_cooldown) {
          Alert.alert(
            'Profile Update Cooldown',
            'You can submit another request in 14 days because you already submitted.',
            [{ text: 'OK' }]
          );
          setCooldownInfo(response.cooldown_info);
        } else {
          Alert.alert('Error', response.message || 'Failed to submit request. Please try again.');
        }
      }
    } catch (error) {
      console.error('PetSitterProfileScreen: Error submitting profile update request:', error);
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => router.replace('/auth') }
      ]
    );
  };


  const pickProfileImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        allowsMultipleSelection: false,
        selectionLimit: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        setProfileImage(imageUri);
        setImageError(false);
        
        // Upload image to backend
        await uploadProfileImage(imageUri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadProfileImage = async (imageUri: string) => {
    try {
      setIsUploadingImage(true);
      setImageError(false);
      
      // Check if user has a valid token
      if (!user?.token) {
        console.error('No authentication token available');
        Alert.alert('Error', 'Please log in again to upload images');
        return;
      }
      
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'profile_image.jpg',
      } as any);

      const { makeApiCall } = await import('../../services/networkService');
      const response = await makeApiCall('/api/profile/upload-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('PetSitterProfileScreen: Upload successful:', result.profile_image);
        console.log('PetSitterProfileScreen: Backend response fields:');
        console.log('  - result.profile_image:', result.profile_image);
        console.log('  - result.full_url:', result.full_url);
        console.log('  - result.profile_image_url:', result.profile_image_url);
        
        // Use the full URL from backend response if available, otherwise generate it
        const fullImageUrl = result.full_url || result.profile_image_url || getFullImageUrl(result.profile_image);
        console.log('PetSitterProfileScreen: Using full URL from backend:', fullImageUrl);
        
        // Update local state immediately for instant display
        setProfileImage(fullImageUrl);
        setImageError(false);
        
        // Update the user context with storage path for persistence
        await updateUserProfile({ profileImage: result.profile_image });
        console.log('PetSitterProfileScreen: User context updated with storage path');
        
        Alert.alert('Success', 'Profile image updated successfully!');
      } else {
        setImageError(true);
        Alert.alert('Error', result.message || 'Failed to upload profile image');
      }
    } catch (error) {
      console.error('Error uploading profile image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to upload profile image: ${errorMessage}`);
      setImageError(true);
    } finally {
      setIsUploadingImage(false);
    }
  };



  // Helper function to validate image URI
  const isValidImageUri = (uri: string | null): boolean => {
    if (!uri || uri.trim() === '') return false;
    // Check if it's a valid URL or local file path
    return uri.startsWith('http') || uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('data:') || uri.startsWith('/storage/');
  };

  // Helper function to get full image URL
  const getFullImageUrl = (uri: string | null): string | null => {
    if (!uri) return null;
    if (uri.startsWith('http')) return uri;
    if (uri.startsWith('file://') || uri.startsWith('content://')) return uri;
    if (uri.startsWith('/storage/') || uri.includes('profile_images/')) {
      const { networkService } = require('../../services/networkService');
      return networkService.getImageUrl(uri.startsWith('/storage/') ? uri : `/storage/${uri}`);
    }
    return uri;
  };

  // Handle image load error
  const handleImageError = () => {
    setImageError(true);
  };

  // Handle image load success
  const handleImageLoad = () => {
    setImageError(false);
  };

  // Profile image persistence - sync when user data changes
  useEffect(() => {
    console.log('🔄 PetSitterProfileScreen: useEffect triggered for profile image sync');
    console.log('🔄 PetSitterProfileScreen: user.profileImage:', user?.profileImage);
    console.log('🔄 PetSitterProfileScreen: current profileImage state:', profileImage);
    
    // Don't sync during upload to prevent blinking
    if (isUploadingImage) {
      console.log('⏳ PetSitterProfileScreen: Skipping sync during upload');
      return;
    }
    
    if (user && user.profileImage && user.profileImage !== profileImage) {
      console.log('✅ PetSitterProfileScreen: Updating profile image from user data:', user.profileImage);
      // Convert storage path to full URL if needed
      const fullUrl = user.profileImage.startsWith('http') ? user.profileImage : getFullImageUrl(user.profileImage);
      console.log('✅ PetSitterProfileScreen: Converted to full URL:', fullUrl);
      setProfileImage(fullUrl);
      setImageError(false);
    } else if (!user?.profileImage && profileImage && !profileImage.startsWith('file://') && !profileImage.startsWith('content://')) {
      // Only clear if the current image is not a local file (camera/gallery pick)
      console.log('❌ PetSitterProfileScreen: User has no profile image, clearing local state');
      setProfileImage(null);
      setImageError(false);
    } else {
      console.log('🔄 PetSitterProfileScreen: Profile image already in sync');
    }
  }, [user?.profileImage, isUploadingImage]);

  // Also sync when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('🎯 PetSitterProfileScreen: useFocusEffect triggered');
      if (user && user.profileImage) {
        console.log('✅ PetSitterProfileScreen: Focus sync - updating profile image:', user.profileImage);
        setProfileImage(user.profileImage);
        setImageError(false);
      } else if (user && !user.profileImage) {
        console.log('❌ PetSitterProfileScreen: Focus sync - no profile image in user data');
        setProfileImage(null);
        setImageError(false);
      }
    }, [user?.profileImage])
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#FF4444" />
        </TouchableOpacity>
      </View>

      {/* Real-time connection indicator - Hidden per user request */}
      {/* <View style={styles.connectionIndicator}>
        <View style={[styles.connectionDot, { backgroundColor: isConnected ? '#10B981' : '#EF4444' }]} />
        <Text style={styles.connectionText}>
          {isConnected ? 'Real-time connected' : 'Real-time disconnected'}
        </Text>
        {lastUpdate && (
          <Text style={styles.lastUpdateText}>
            Last update: {lastUpdate.toLocaleTimeString()}
          </Text>
        )}
      </View> */}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#3B82F6']} // Android
              tintColor="#3B82F6" // iOS
              title="Pull to refresh"
              titleColor="#6B7280"
            />
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={pickProfileImage} style={styles.profileImageContainer}>
            <Image 
              source={
                profileImage 
                  ? { uri: getFullImageUrl(profileImage) } 
                  : require('../../assets/images/default-avatar.png')
              } 
              style={styles.profileImage}
              onError={handleImageError}
              onLoad={handleImageLoad}
              defaultSource={require('../../assets/images/default-avatar.png')}
            />
            <View style={styles.imageEditOverlay}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{`${profile.firstName} ${profile.lastName}`.trim()}</Text>
            
            
            {/* Verification Status - Only ID Verified */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
              {/* ID Verified Badge - Shows when verification is approved */}
              {verificationStatus.isVerified && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginRight: 8, marginBottom: 4 }}>
                  <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                  <Text style={{ color: '#10B981', fontWeight: 'bold', fontSize: 13, marginLeft: 4 }}>🆔 ID Verified</Text>
                </View>
              )}

              {/* Pending Status */}
              {!verificationStatus.isVerified && verificationStatus.verificationStatus === 'pending' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginRight: 8, marginBottom: 4 }}>
                  <Ionicons name="time" size={14} color="#F59E0B" />
                  <Text style={{ color: '#F59E0B', fontWeight: 'bold', fontSize: 13, marginLeft: 4 }}>⏳ Under Review</Text>
                </View>
              )}

              {/* Rejected Status */}
              {verificationStatus.verificationStatus === 'rejected' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginRight: 8, marginBottom: 4 }}>
                  <Ionicons name="close-circle" size={14} color="#EF4444" />
                  <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 13, marginLeft: 4 }}>❌ Verification Rejected</Text>
                </View>
              )}

              {/* Not Verified Status */}
              {!verificationStatus.isVerified && verificationStatus.verificationStatus !== 'pending' && verificationStatus.verificationStatus !== 'rejected' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginRight: 8, marginBottom: 4 }}>
                  <Ionicons name="warning" size={14} color="#FF9800" />
                  <Text style={{ color: '#FF9800', fontWeight: 'bold', fontSize: 13, marginLeft: 4 }}>Not Verified Yet</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Add Certificates Button */}
        <View style={styles.verificationButtonsContainer}>
          <TouchableOpacity 
            style={styles.certificatesButton} 
            onPress={() => setCertificateAlbumVisible(true)}
            activeOpacity={0.8}
          >
            <View style={styles.certificatesButtonContent}>
              <Ionicons name="ribbon" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.certificatesButtonText}>Add Certificates</Text>
              <Ionicons name="chevron-forward" size={14} color="#fff" style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.experience}</Text>
            <Text style={styles.statLabel}>Years of Experience</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>₱{profile.hourlyRate || '0'}</Text>
            <Text style={styles.statLabel}>Per Hour</Text>
            {/* Debug info - remove this later */}
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {profile.maxPets !== undefined && profile.maxPets !== null && profile.maxPets !== '' 
                ? String(profile.maxPets) 
                : (profile.max_pets !== undefined && profile.max_pets !== null && profile.max_pets !== '' 
                  ? String(profile.max_pets) 
                  : (user?.maxPets !== undefined && user?.maxPets !== null 
                    ? String(user.maxPets) 
                    : (user?.max_pets !== undefined && user?.max_pets !== null 
                      ? String(user.max_pets) 
                      : '10')))}
            </Text>
            <Text style={styles.statLabel}>Max Pets</Text>
          </View>
        </View>

        {/* Edit/Save Buttons */}
        <View style={styles.actionButtons}>
          {isEditing ? (
            <View style={styles.editButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Profile Update Request Form */}
        {isEditing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Request Profile Changes</Text>
            <Text style={styles.sectionDescription}>
              Review and modify your current profile information below. Only changed fields will be submitted for admin approval.
            </Text>
            
            {cooldownInfo && cooldownInfo.in_cooldown && (
              <View style={styles.cooldownWarning}>
                <Text style={styles.cooldownText}>
                  You can submit another request in 14 days because you already submitted.
                </Text>
              </View>
            )}
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>First Name (Current: {user?.name?.split(' ')[0] || 'Not set'})</Text>
              <TextInput
                style={styles.input}
                value={requestData.firstName}
                onChangeText={(text) => setRequestData({...requestData, firstName: text})}
                placeholder="Enter your first name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Last Name (Current: {user?.name?.split(' ').slice(1).join(' ') || 'Not set'})</Text>
              <TextInput
                style={styles.input}
                value={requestData.lastName}
                onChangeText={(text) => setRequestData({...requestData, lastName: text})}
                placeholder="Enter your last name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number (Current: {user?.phone || 'Not set'})</Text>
              <TextInput
                style={styles.input}
                value={requestData.phone}
                onChangeText={(text) => setRequestData({...requestData, phone: text})}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Hourly Rate (Current: ₱{user?.hourlyRate || 'Not set'})</Text>
              <TextInput
                style={styles.input}
                value={requestData.hourlyRate}
                onChangeText={(text) => setRequestData({...requestData, hourlyRate: text})}
                placeholder="Enter your hourly rate"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Experience (Current: {user?.experience || 'Not set'} years)</Text>
              <TextInput
                style={styles.input}
                value={requestData.experience}
                onChangeText={(text) => setRequestData({...requestData, experience: text})}
                placeholder="Enter your experience in years"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Max Pets (Current: {
                  (profile.maxPets !== undefined && profile.maxPets !== null && profile.maxPets !== '') 
                    ? profile.maxPets 
                    : (profile.max_pets !== undefined && profile.max_pets !== null && profile.max_pets !== '') 
                      ? profile.max_pets 
                      : (user?.maxPets !== undefined && user?.maxPets !== null && user?.maxPets !== '') 
                        ? String(user.maxPets) 
                        : (user?.max_pets !== undefined && user?.max_pets !== null && user?.max_pets !== '') 
                          ? String(user.max_pets) 
                          : 'Not set'}
                )
              </Text>
              <TextInput
                style={styles.input}
                value={requestData.maxPets}
                onChangeText={(text) => {
                  // Only allow numbers 1-10
                  const num = parseInt(text);
                  if (text === '' || (num >= 1 && num <= 10)) {
                    setRequestData({...requestData, maxPets: text});
                  }
                }}
                placeholder="Enter max pets (1-10)"
                keyboardType="numeric"
                maxLength={2}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reason for Changes *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={requestData.reason}
                onChangeText={(text) => setRequestData({...requestData, reason: text})}
                placeholder="Please explain why you want to update your profile information..."
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity 
              style={[styles.saveButton, isSubmittingRequest && styles.disabledButton]} 
              onPress={handleSubmitProfileRequest}
              disabled={isSubmittingRequest || (cooldownInfo && cooldownInfo.in_cooldown)}
            >
              <Text style={styles.saveButtonText}>
                {isSubmittingRequest ? 'Submitting...' : 'Submit Request'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Profile Details - Hidden when editing */}
        {!isEditing && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>First Name</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.disabledInput]}
              value={profile.firstName}
              onChangeText={(text) => setProfile({...profile, firstName: text})}
              editable={isEditing}
              placeholder="Enter your first name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Last Name </Text>
            <TextInput
              style={[styles.input, !isEditing && styles.disabledInput]}
              value={profile.lastName}
              onChangeText={(text) => setProfile({...profile, lastName: text})}
              editable={isEditing}
              placeholder="Enter your last name (required)"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.disabledInput]}
              value={profile.email}
              onChangeText={(text) => setProfile({...profile, email: text})}
              editable={isEditing}
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.disabledInput]}
              value={profile.phone}
              onChangeText={(text) => setProfile({...profile, phone: text})}
              editable={isEditing}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.locationInputHeader}>
              <Text style={styles.inputLabel}>Location</Text>
              {userAddress && (
                <View style={styles.autoLocationIndicator}>
                  <Ionicons name="location" size={14} color="#4CAF50" />
                  <Text style={styles.autoLocationText}>Auto-detected</Text>
                </View>
              )}
            </View>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={profile.location}
              editable={false}
              selectTextOnFocus={false}
              pointerEvents="none"
              placeholder={userAddress ? "Location auto-detected" : "Getting your location..."}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Hourly Rate (₱)</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.disabledInput]}
              value={profile.hourlyRate}
              onChangeText={(text) => setProfile({...profile, hourlyRate: text})}
              editable={isEditing}
              keyboardType="numeric"
            />
          </View>

            </View>

        {/* Experience Section */}
        <View style={[styles.section, { marginBottom: 20, paddingBottom: 15 }]}>
          <Text style={styles.sectionTitle}>Years of Experience</Text>
          <TextInput
            style={[styles.experienceInput, !isEditing && styles.disabledInput]}
            value={profile.experience}
            onChangeText={(text) => setProfile({...profile, experience: text})}
            editable={isEditing}
            placeholder="e.g., 3, 1.5, 0.5"
            keyboardType="numeric"
          />
        </View>



        {/* Specialties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specialties</Text>
          <View style={styles.specialtiesContainer}>
            {profile.specialties.map((specialty, index) => (
              <View key={index} style={styles.specialtyChip}>
                <Text style={styles.specialtyText}>{specialty}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/pet-sitter-availability')}>
            <Ionicons name="calendar-outline" size={24} color="#F59E0B" />
            <Text style={styles.actionText}>Set Availability</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/pet-sitter-schedule')}>
            <Ionicons name="time-outline" size={24} color="#3B82F6" />
            <Text style={styles.actionText}>My Schedule</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/emergency')}>
            <Ionicons name="warning-outline" size={24} color="#EF4444" />
            <Text style={styles.actionText}>Emergency</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>
          </>
        )}
        {/* PetSit Footer - Only visible when scrolled to bottom */}
        <View style={styles.footer}>
          <Image 
            source={require('../../assets/images/logo.png')} 
            style={styles.footerLogo} 
          />
          <Text style={styles.footerEmail}>petsitconnectph@gmail.com</Text>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Certificate Album Modal */}
      <CertificateAlbum
        visible={certificateAlbumVisible}
        onClose={() => setCertificateAlbumVisible(false)}
        certificates={certificates}
        onAddCertificate={handleAddCertificate}
        onDeleteCertificate={handleDeleteCertificate}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutButton: {
    padding: 5,
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 15,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  reviewsText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 20,
    marginBottom: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  actionButtons: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  editButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  editButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#E0E0E0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  locationInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  autoLocationIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  autoLocationText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  experienceInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#fff',
    height: 45,
  },
  disabledInput: {
    backgroundColor: '#F8F9FA',
    color: '#666',
  },
  specialtiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  specialtyChip: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
  },
  specialtyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
  verificationButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 12,
    gap: 12,
    justifyContent: 'center',
  },
  verifyButton: {
    flex: 1,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  resubmitButton: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  verifyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  certificatesButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  certificatesButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  certificatesButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  profileImageContainer: {
    position: 'relative',
  },
  imageEditOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connectionText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  lastUpdateText: {
    fontSize: 10,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  cooldownWarning: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  cooldownText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
    fontWeight: '500',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  disabledButton: {
    opacity: 0.6,
  },
  footer: {
    backgroundColor: '#F8F9FA',
    paddingVertical: 15,
    paddingHorizontal: 20,
    paddingBottom: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 10,
  },
  footerLogo: {
    width: 40,
    height: 40,
    marginBottom: 5,
  },
  footerEmail: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
});

export default PetSitterProfileScreen; 