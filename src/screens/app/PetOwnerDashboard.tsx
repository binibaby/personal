import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import authService from '../../services/authService';
import { DashboardMetrics } from '../../services/dashboardService';
import { notificationService } from '../../services/notificationService';
import { reverbMessagingService } from '../../services/reverbMessagingService';
import realtimeLocationService from '../../services/realtimeLocationService';
// @ts-ignore
import FindIcon from '../../assets/icons/find.png';
// @ts-ignore
import BookIcon from '../../assets/icons/book.png';
// @ts-ignore
import PetsHeartIcon from '../../assets/icons/petsheart.png';
// @ts-ignore
import MessageIcon from '../../assets/icons/message.png';

interface Booking {
  id: string;
  petImage?: any;
  petName?: string;
  sitterName: string;
  status: string;
  cost?: string;
  date: string;
  startTime: string;
  endTime: string;
}

// These will be replaced with dynamic state

const quickActions = [
  { title: 'Find Sitter', icon: FindIcon, color: '#A7F3D0', route: '/find-sitter-map' },
  { title: 'Book Service', icon: BookIcon, color: '#DDD6FE', route: '/pet-owner-jobs' },
  { title: 'My Pets', icon: PetsHeartIcon, color: '#FDE68A', route: '/my-pets' },
  { title: 'Messages', icon: MessageIcon, color: '#BAE6FD', route: '/pet-owner-messages' },
];

const reflectionColors = {
  bookings: '#10B981',
  upcoming: '#8B5CF6',
  week: '#F97316',
};

const PetOwnerDashboard = () => {
  const router = useRouter();
  const { user, profileUpdateTrigger, currentLocation } = useAuth();
  const [imageError, setImageError] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [ownerStats, setOwnerStats] = useState({
    totalSpent: '₱0',
    activeBookings: 0,
    thisWeek: '₱0',
  });
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics>({});
  const [notificationCount, setNotificationCount] = useState<number>(0);
  const [messageCount, setMessageCount] = useState<number>(0);
  const [recommendedSitters, setRecommendedSitters] = useState<any[]>([]);
  const [loadingSitters, setLoadingSitters] = useState<boolean>(false);
  
  console.log('💳 Current ownerStats state:', ownerStats);
  
  // Test: Force update the state to see if UI updates
  useEffect(() => {
    console.log('💳 ownerStats changed:', ownerStats);
  }, [ownerStats]);

  useEffect(() => {
    checkAuthentication();
    loadDashboardData();
    loadRecommendedSitters();
    
    // Load notification and message counts
    const loadCounts = async () => {
      try {
        // Force refresh notifications from API
        await notificationService.forceRefreshFromAPI();
        
        const notificationCount = await notificationService.getUnreadCount();
        setNotificationCount(notificationCount);
        
        // Add a small delay to ensure messaging service is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Calculate unread count from conversations
        try {
          console.log('📱 PetOwnerDashboard: Loading message count...');
          const conversations = await reverbMessagingService.getConversations();
          console.log('📱 PetOwnerDashboard: Conversations loaded:', conversations.length);
          
          let totalUnreadCount = 0;
          conversations.forEach(conv => {
            console.log('📱 PetOwnerDashboard: Conversation', conv.conversation_id, 'unread_count:', conv.unread_count);
            totalUnreadCount += conv.unread_count || 0;
          });
          
          console.log('📱 PetOwnerDashboard: Total unread count:', totalUnreadCount);
          setMessageCount(totalUnreadCount);
        } catch (error) {
          console.error('Error getting message count:', error);
          // Fallback to the original method
          const messageCount = await reverbMessagingService.getUnreadCount();
          console.log('📱 PetOwnerDashboard: Fallback message count:', messageCount);
          setMessageCount(messageCount);
        }
      } catch (error) {
        console.error('Error loading counts:', error);
      }
    };

    loadCounts();
    
    // Subscribe to notification updates to refresh dashboard data
    const unsubscribeNotifications = notificationService.subscribe(async () => {
      loadDashboardData();
      
      // Also refresh notification count
      const count = await notificationService.getUnreadCount();
      setNotificationCount(count);
    });

    
    // Subscribe to booking updates to refresh dashboard data
    const { bookingService } = require('../../services/bookingService');
    const unsubscribeBookings = bookingService.subscribe(() => {
      console.log('📅 Booking updated, refreshing dashboard data...');
      loadDashboardData();
    });
    
    return () => {
      unsubscribeNotifications();
      unsubscribeBookings();
    };
  }, []);

  // Refresh message count when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const refreshMessageCount = async () => {
        try {
          console.log('📱 PetOwnerDashboard: Screen focused, refreshing message count...');
          const conversations = await reverbMessagingService.getConversations();
          let totalUnreadCount = 0;
          conversations.forEach(conv => {
            totalUnreadCount += conv.unread_count || 0;
          });
          setMessageCount(totalUnreadCount);
          console.log('📱 PetOwnerDashboard: Focus refresh message count:', totalUnreadCount);
        } catch (error) {
          console.error('Error refreshing message count on focus:', error);
        }
      };

      refreshMessageCount();
    }, [])
  );

  // Load recommended sitters
  const loadRecommendedSitters = async () => {
    if (!currentLocation) {
      console.log('📍 No location available for sitter recommendations');
      setRecommendedSitters([]);
      return;
    }

    setLoadingSitters(true);
    try {
      const nearbySitters = await realtimeLocationService.getSittersNearby(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        5, // 5km radius for recommendations
        false
      );

      // Get top 3-5 recommendations (closest sitters)
      const recommendations = nearbySitters.slice(0, 5);
      setRecommendedSitters(recommendations);
      console.log('✅ Loaded recommended sitters:', recommendations.length);
      // Log ratings for debugging
      recommendations.forEach((sitter, idx) => {
        console.log(`⭐ Sitter ${idx + 1} (${sitter.name}): rating = ${sitter.rating}`);
      });
    } catch (error) {
      console.error('❌ Error loading recommended sitters:', error);
      setRecommendedSitters([]);
    } finally {
      setLoadingSitters(false);
    }
  };

  // Handle sitter card press - navigate to map with sitter location
  const handleSitterCardPress = async (sitter: any) => {
    try {
      console.log('🔍 Sitter card pressed:', {
        id: sitter?.id,
        name: sitter?.name,
        hasLocation: !!sitter?.location,
        location: sitter?.location,
      });

      // Validate sitter data
      if (!sitter || !sitter.id) {
        console.error('❌ Invalid sitter data:', sitter);
        Alert.alert('Error', 'Invalid sitter information. Please try again.');
        return;
      }

      // Ensure sitter ID is converted to string for consistent storage
      const sitterId = typeof sitter.id === 'string' ? sitter.id : String(sitter.id);

      // Check if location data exists
      if (sitter.location && sitter.location.latitude && sitter.location.longitude) {
        // Store sitter location in AsyncStorage for map screen to use
        const locationData = {
          latitude: Number(sitter.location.latitude),
          longitude: Number(sitter.location.longitude),
          sitterId: sitterId, // Store as string
          address: sitter.location.address || 'Location not available',
        };
        
        console.log('📍 Storing sitter location:', locationData);
        await AsyncStorage.setItem('selected_sitter_location', JSON.stringify(locationData));
      } else {
        console.warn('⚠️ Sitter location data missing, storing sitter ID only');
        // Store just the sitter ID if location is not available
        await AsyncStorage.setItem('selected_sitter_location', JSON.stringify({
          sitterId: sitterId, // Store as string
          address: sitter.location?.address || 'Location not available',
        }));
      }
      
      // Navigate to map screen
      console.log('🧭 Navigating to map screen...');
      router.push('/find-sitter-map');
    } catch (error) {
      console.error('❌ Error navigating to sitter location:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        sitter: sitter,
      });
      
      // Show user-friendly error message
      Alert.alert(
        'Navigation Error',
        'Unable to navigate to sitter location. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Fallback: just navigate to map without location
              router.push('/find-sitter-map');
            },
          },
        ]
      );
    }
  };

  // Handle pull to refresh
  const onRefresh = useCallback(async () => {
    console.log('🔄 Pull to refresh triggered');
    setRefreshing(true);
    try {
      // Refresh dashboard data
      await loadDashboardData();
      await loadRecommendedSitters();
      
      // Force refresh notifications from API
      await notificationService.forceRefreshFromAPI();
      
      // Refresh notification count
      const notificationCount = await notificationService.getUnreadCount();
      setNotificationCount(notificationCount);
      
      // Refresh message count
      try {
        const conversations = await reverbMessagingService.getConversations();
        let totalUnreadCount = 0;
        conversations.forEach(conv => {
          totalUnreadCount += conv.unread_count || 0;
        });
        setMessageCount(totalUnreadCount);
      } catch (error) {
        console.error('Error refreshing message count:', error);
        // Fallback to the original method
        const messageCount = await reverbMessagingService.getUnreadCount();
        setMessageCount(messageCount);
      }
      
      console.log('✅ Dashboard data, notifications, and messages refreshed successfully');
    } catch (error) {
      console.error('❌ Error refreshing dashboard data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [currentLocation]);

  // Load dashboard data
  const loadDashboardData = async () => {
    console.log('🚀 loadDashboardData function called!');
    try {
      console.log('📊 Loading dashboard data...');
      console.log('🔍 Current user from context:', user);
      console.log('🔍 User ID:', user?.id);
      console.log('🔍 User role:', user?.role);
      console.log('🔍 User token available:', !!user?.token);
      console.log('🔍 User token (first 20 chars):', user?.token?.substring(0, 20));
      
      if (!user?.id) {
        console.log('❌ No user ID available, skipping dashboard data load');
        return;
      }
      
      // Clear booking service cache to ensure fresh data
      const { bookingService } = require('../../services/bookingService');
      await bookingService.clearCache();
      console.log('🧹 Booking service cache cleared');
      
      // Declare variables for use throughout the function
      let activeBookings: any[] = [];
      let upcomingBookings: any[] = [];
      
      // Load dashboard metrics using the same data source as My Bookings screen
      if (user?.id) {
        console.log('🔍 Loading dashboard metrics for user:', user.id);
        
        // Use the same data source as My Bookings screen
        const { bookingService } = require('../../services/bookingService');
        const ownerBookings = await bookingService.getPetOwnerBookings(user.id);
        
        console.log('📊 Owner bookings from bookingService:', ownerBookings.length);
        console.log('📊 Owner bookings details:', ownerBookings.map((b: any) => ({
          id: b.id,
          status: b.status,
          date: b.date,
          sitterName: b.sitterName
        })));
        
        // Use the exact same filtering logic as My Bookings screen
        activeBookings = ownerBookings.filter((booking: any) => booking.status === 'active');
        upcomingBookings = ownerBookings.filter((booking: any) => 
          booking.status === 'confirmed'
        );
        
        console.log('📊 Active bookings count (My Bookings logic):', activeBookings.length);
        console.log('📊 Upcoming bookings count (My Bookings logic):', upcomingBookings.length);
        
        // Set dashboard metrics with the same counts as My Bookings screen
        const metrics = {
          activeBookings: activeBookings.length,
          upcomingBookings: upcomingBookings.length,
          totalSpent: 0, // Will be calculated from payments
          thisWeekSpent: 0 // Will be calculated from payments
        };
        
        setDashboardMetrics(metrics);
        console.log('📊 Dashboard metrics set:', metrics);
        
        // Set the upcoming bookings state for display
        setUpcomingBookings(upcomingBookings);
        console.log('📅 Upcoming bookings set for display:', upcomingBookings.length);
      } else {
        console.log('⚠️ No user ID available for dashboard metrics');
      }
      
      // Load payments data for total spent calculation
      const { makeApiCall } = await import('../../services/networkService');
      console.log('💳 About to fetch payments data...');
      
      try {
        console.log('💳 Making API call to /payments/history...');
        const paymentsResponse = await makeApiCall('/payments/history', {
          method: 'GET',
        });
        console.log('💳 Payments response received:', paymentsResponse);
        console.log('💳 Payments response status:', paymentsResponse.status);
        console.log('💳 Payments response ok:', paymentsResponse.ok);
        
        if (paymentsResponse && paymentsResponse.ok) {
          const paymentsData = await paymentsResponse.json();
          console.log('💳 Payments data:', paymentsData);
          
          // Handle paginated response - Laravel pagination returns data in 'data' property
          const payments = paymentsData.data || paymentsData.payments || paymentsData || [];
          console.log('💳 Found payments:', payments.length);
          console.log('💳 Payments array:', payments);
          console.log('💳 Full payments response structure:', paymentsData);
          
          // Ensure payments is an array
          if (!Array.isArray(payments)) {
            console.log('💳 Payments is not an array, setting to empty array');
            const totalSpent = 0;
            const thisWeekSpent = 0;
            
            const newOwnerStats = {
              totalSpent: `₱${totalSpent.toLocaleString()}`,
              activeBookings: activeBookings.length,
              thisWeek: `₱${thisWeekSpent.toLocaleString()}`,
            };
            console.log('💳 Setting owner stats (no payments):', newOwnerStats);
            setOwnerStats(newOwnerStats);
            return;
          }
          
          // Calculate total spent
          const totalSpent = payments.reduce((total: number, payment: any) => {
            try {
              console.log(`💳 Processing payment ${payment?.id}:`, {
                status: payment?.status,
                amount: payment?.amount,
                amountType: typeof payment?.amount,
                rawAmount: payment?.amount
              });
              
              if (payment && payment.status === 'completed') {
                // Convert amount to number - handle string format like "300000.00"
                const amount = parseFloat(payment.amount || 0);
                if (!isNaN(amount)) {
                  console.log(`💳 Payment ${payment.id}: Status=${payment.status}, RawAmount="${payment.amount}", ParsedAmount=${amount}, Running total: ${total + amount}`);
                  return total + amount;
                } else {
                  console.log(`💳 Payment ${payment.id}: Invalid amount, skipping`);
                }
              }
              console.log(`💳 Payment ${payment?.id}: Status=${payment?.status}, Skipping (not completed)`);
              return total;
            } catch (error) {
              console.error(`💳 Error processing payment ${payment?.id}:`, error);
              return total;
            }
          }, 0);
          
          // Calculate this week's spending
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          console.log('💳 One week ago date:', oneWeekAgo);
          console.log('💳 Current date:', new Date());
          
          const thisWeekSpent = payments.reduce((total: number, payment: any) => {
            try {
              console.log(`💳 Checking payment ${payment?.id}:`, {
                status: payment?.status,
                processed_at: payment?.processed_at,
                amount: payment?.amount
              });
              
              if (payment && payment.status === 'completed' && payment.processed_at) {
                const paymentDate = new Date(payment.processed_at);
                console.log(`💳 Payment ${payment.id} date:`, paymentDate);
                console.log(`💳 Is payment date >= one week ago?`, paymentDate >= oneWeekAgo);
                
                if (!isNaN(paymentDate.getTime()) && paymentDate >= oneWeekAgo) {
                  const amount = parseFloat(payment.amount || 0);
                  if (!isNaN(amount)) {
                    console.log(`💳 This week payment ${payment.id}: Amount=${amount}`);
                    return total + amount;
                  }
                }
              }
              return total;
            } catch (error) {
              console.error(`💳 Error processing this week payment ${payment?.id}:`, error);
              return total;
            }
          }, 0);
          
          console.log('💳 Calculated totals:', { totalSpent, thisWeekSpent });
          
          const newOwnerStats = {
            totalSpent: `₱${totalSpent.toLocaleString()}`,
            activeBookings: activeBookings.length,
            thisWeek: `₱${totalSpent.toLocaleString()}`, // Use totalSpent for this week for now
          };
          console.log('💳 Setting owner stats:', newOwnerStats);
          setOwnerStats(newOwnerStats);
        } else {
          console.log('💳 Payments API response not ok:', paymentsResponse?.status);
          console.log('💳 Payments API response text:', await paymentsResponse?.text());
          // Set default values if payments API fails
          setOwnerStats({
            totalSpent: '₱0',
            activeBookings: activeBookings.length,
            thisWeek: '₱0', // Will match totalSpent when API works
          });
        }
      } catch (paymentsError) {
        console.error('❌ Error fetching payments:', paymentsError);
        const error = paymentsError instanceof Error ? paymentsError : new Error(String(paymentsError));
        console.error('❌ Payments error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        // Set default values if payments API fails
        setOwnerStats({
          totalSpent: '₱0',
          activeBookings: activeBookings.length,
          thisWeek: '₱0', // Will match totalSpent when API works
        });
      }
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
    }
    console.log('💳 loadDashboardData function completed');
  };


  // Check authentication status
  const checkAuthentication = async () => {
    try {
      // Check if user is logged out
      const loggedOut = await AsyncStorage.getItem('user_logged_out');
      if (loggedOut === 'true') {
        console.log('🚪 User is logged out, redirecting to onboarding');
        router.replace('/onboarding');
        return;
      }

      // Check if user is authenticated
      const user = await authService.getCurrentUser();
      if (!user) {
        console.log('🚪 No user found, redirecting to onboarding');
        router.replace('/onboarding');
        return;
      }

      // Check if user is a pet owner
      if (user.role !== 'pet_owner') {
        console.log('🚪 User is not a pet owner, redirecting to onboarding');
        router.replace('/onboarding');
        return;
      }

      // User is authenticated and is a pet owner
      // User data is now available from AuthContext
    } catch (error) {
      console.error('Error checking authentication:', error);
      router.replace('/onboarding');
    }
  };

  // Refresh user data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 PetOwnerDashboard: Screen focused, checking authentication and refreshing data');
      checkAuthentication();
      loadDashboardData();
    }, [user?.token])
  );


  // Helper function to validate image URI
  const isValidImageUri = (uri: string | null): boolean => {
    if (!uri || uri.trim() === '') return false;
    // Check if it's a valid URL or local file path
    const isValid = uri.startsWith('http') || uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('data:') || uri.startsWith('/storage/') || uri.includes('profile_images/');
    console.log('🔍 PetOwnerDashboard: isValidImageUri check:', { uri, isValid });
    return isValid;
  };

  // Helper function to get full image URL using network service
  const getFullImageUrl = (uri: string | null): string | null => {
    if (!uri) return null;
    if (uri.startsWith('http')) return uri;
    
    // Import network service dynamically to avoid circular dependencies
    const { networkService } = require('../../services/networkService');
    const baseUrl = networkService.getBaseUrl();
    
    if (uri.startsWith('/storage/')) {
      const fullUrl = `${baseUrl}${uri}`;
      console.log('🔗 PetOwnerDashboard: Generated URL for /storage/ path:', fullUrl);
      return fullUrl;
    }
    if (uri.startsWith('profile_images/')) {
      const fullUrl = `${baseUrl}/storage/${uri}`;
      console.log('🔗 PetOwnerDashboard: Generated URL for profile_images/ path:', fullUrl);
      return fullUrl;
    }
    const fullUrl = `${baseUrl}/storage/${uri}`;
    console.log('🔗 PetOwnerDashboard: Generated URL for fallback path:', fullUrl);
    return fullUrl;
  };

  // Handle image load error
  const handleImageError = () => {
    setImageError(true);
  };

  // Handle image load success
  const handleImageLoad = () => {
    setImageError(false);
  };

  // Format date as YYYY/MM/DD
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}/${month}/${day}`;
    } catch (error) {
      return dateString;
    }
  };

  // Format time in 12-hour format with AM/PM (same as booking summary)
  const formatTime = (timeString: string) => {
    if (!timeString) return 'Invalid Time';
    
    try {
      // Handle different time formats
      let cleanTime = timeString;
      
      // If it contains 'T' (ISO format), extract just the time part
      if (timeString.includes('T')) {
        const timeMatch = timeString.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          cleanTime = `${timeMatch[1]}:${timeMatch[2]}`;
        }
      }
      
      // Handle 12-hour format with AM/PM
      const time12HourRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
      const time24HourRegex = /^(\d{1,2}):(\d{2})$/;
      
      let hour, minute, ampm;
      
      if (time12HourRegex.test(cleanTime)) {
        const match = cleanTime.match(time12HourRegex);
        if (match) {
          hour = parseInt(match[1], 10);
          minute = parseInt(match[2], 10);
          ampm = match[3].toUpperCase();
        } else {
          return 'Invalid Time';
        }
        
        // Convert to 24-hour format for validation
        if (ampm === 'PM' && hour !== 12) {
          hour += 12;
        } else if (ampm === 'AM' && hour === 12) {
          hour = 0;
        }
      } else if (time24HourRegex.test(cleanTime)) {
        const match = cleanTime.match(time24HourRegex);
        if (match) {
          hour = parseInt(match[1], 10);
          minute = parseInt(match[2], 10);
          ampm = hour >= 12 ? 'PM' : 'AM';
        } else {
          return 'Invalid Time';
        }
      } else {
        console.error('Invalid time format:', timeString);
        return 'Invalid Time';
      }
      
      // Validate hour and minute
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        console.error('Invalid time values:', { hour, minute });
        return 'Invalid Time';
      }
      
      // Convert to 12-hour format
      const hour12 = hour % 12 || 12;
      const formattedMinute = minute.toString().padStart(2, '0');
      
      return `${hour12}:${formattedMinute} ${ampm}`;
    } catch (error) {
      console.error('Error formatting time:', error, 'Input:', timeString);
      return 'Invalid Time';
    }
  };

  // Reset image error when profile updates
  useEffect(() => {
    console.log('🔄 PetOwnerDashboard: Profile update detected, refreshing profile image');
    setImageError(false);
  }, [profileUpdateTrigger, user?.profileImage]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#10B981', '#8B5CF6', '#F97316']} // Android
            tintColor="#10B981" // iOS
            title="Refreshing dashboard..." // iOS
            titleColor="#666" // iOS
          />
        }
      >
        
        {/* Header */}
        <View style={styles.headerCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image source={require('../../assets/images/logo.png')} style={{ width: 28, height: 28, marginRight: 8 }} />
            <Text style={styles.headerTitle}>Pet Owner Dashboard</Text>
            {refreshing && (
              <ActivityIndicator 
                size="small" 
                color="#10B981" 
                style={{ marginLeft: 8 }} 
              />
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.push('/pet-owner-notifications')} style={{ marginRight: 16, position: 'relative' }}>
              <Ionicons name="notifications-outline" size={24} color="#222" />
              {notificationCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/pet-owner-profile')} style={styles.profileButton}>
              <Image
                key={`profile-${user?.id}-${user?.profileImage || 'default'}-${profileUpdateTrigger}-${Date.now()}`}
                source={(() => {
                  console.log('🖼️ PetOwnerDashboard: Image source decision:');
                  console.log('  - user?.profileImage:', user?.profileImage);
                  console.log('  - isValidImageUri:', user?.profileImage ? isValidImageUri(user.profileImage) : false);
                  console.log('  - imageError:', imageError);
                  
                  if (user?.profileImage && isValidImageUri(user.profileImage) && !imageError) {
                    const fullUrl = getFullImageUrl(user.profileImage);
                    console.log('  - Using profile image with URL:', fullUrl);
                    return { 
                      uri: fullUrl,
                      cache: 'reload' // Force reload to prevent white image
                    };
                  } else {
                    console.log('  - Using default avatar');
                    return require('../../assets/images/default-avatar.png');
                  }
                })()}
                style={styles.profileImage}
                onError={(error) => {
                  console.log('❌ PetOwnerDashboard: Profile image failed to load:', error.nativeEvent.error);
                  console.log('❌ PetOwnerDashboard: Failed image URI:', user?.profileImage);
                  console.log('❌ PetOwnerDashboard: Full URL:', getFullImageUrl(user?.profileImage || ''));
                  handleImageError();
                }}
                onLoad={() => {
                  console.log('✅ PetOwnerDashboard: Profile image loaded successfully:', user?.profileImage);
                  console.log('✅ PetOwnerDashboard: Full URL:', getFullImageUrl(user?.profileImage || ''));
                  handleImageLoad();
                }}
                defaultSource={require('../../assets/images/default-avatar.png')}
                resizeMode="cover"
                fadeDuration={0}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Spending Summary (mirrors Total Income card) */}
        <LinearGradient colors={['#10B981', '#8B5CF6', '#F97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.totalIncomeSection}>
          <Text style={styles.totalIncomeLabel}>Total Spent</Text>
          <Text style={styles.totalIncomeAmount}>
            {(() => {
              console.log('💳 Rendering total spent:', ownerStats.totalSpent);
              console.log('💳 Owner stats object:', ownerStats);
              return ownerStats.totalSpent || '₱0.00';
            })()}
          </Text>
        </LinearGradient>

        {/* Stats Cards (mirrors sitter) */}
        <View style={styles.statsRow}>
          <View style={[styles.statsCard, { backgroundColor: '#10B981', shadowColor: '#10B981', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 16 }]}> 
            <View style={styles.statsIcon}>
              <Ionicons name="briefcase" size={24} color="#fff" />
            </View>
            <Text style={styles.statsValueWhite}>
              {(() => {
                console.log('💳 Rendering active bookings from dashboardMetrics:', dashboardMetrics.activeBookings);
                return dashboardMetrics.activeBookings || 0;
              })()}
            </Text>
            <Text style={styles.statsLabelWhite}>Active Bookings</Text>
            <View style={[styles.reflection, { backgroundColor: reflectionColors.bookings }]} />
          </View>

          <View style={[styles.statsCard, { backgroundColor: '#8B5CF6', shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 16 }]}> 
            <View style={styles.statsIcon}>
              <Ionicons name="calendar" size={24} color="#fff" />
            </View>
            <Text style={styles.statsValueWhite}>
              {(() => {
                console.log('💳 Rendering upcoming bookings from dashboardMetrics:', dashboardMetrics.upcomingBookings);
                return dashboardMetrics.upcomingBookings || 0;
              })()}
            </Text>
            <Text style={styles.statsLabelWhite}>Upcoming</Text>
            <View style={[styles.reflection, { backgroundColor: reflectionColors.upcoming }]} />
          </View>

          <View style={[styles.statsCard, { backgroundColor: '#F97316', shadowColor: '#F97316', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 16 }]}> 
            <View style={styles.statsIcon}>
              <Ionicons name="trending-up" size={24} color="#fff" />
            </View>
            <Text style={styles.statsValueWhite}>
              {(() => {
                console.log('💳 Rendering this week:', ownerStats.thisWeek);
                return ownerStats.thisWeek || '₱0.00';
              })()}
            </Text>
            <Text style={styles.statsLabelWhite}>This Week</Text>
            <View style={[styles.reflection, { backgroundColor: reflectionColors.week }]} />
          </View>
        </View>

        {/* Quick Actions (owner routes) */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsRow}>
          {quickActions.map((action) => (
            <TouchableOpacity key={action.title} style={styles.quickAction} onPress={() => router.push(action.route as any)}>
              <View style={[styles.quickActionIcon, { backgroundColor: action.color }]}> 
                <Image source={action.icon} style={styles.quickActionImage} resizeMode="contain" />
                {/* Message badge for Messages action */}
                {action.title === 'Messages' && messageCount > 0 && (
                  <View style={styles.messageBadge}>
                    <Text style={styles.messageBadgeText}>
                      {messageCount > 99 ? '99+' : messageCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.quickActionLabel}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upcoming Bookings */}
        <View style={styles.sectionRowAligned}>
          <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.upcomingJobsRow}>
          {upcomingBookings.length > 0 ? (
            upcomingBookings.map((b, idx) => (
              <View key={b.id} style={[styles.upcomingJobCard, { backgroundColor: ['#A7F3D0', '#DDD6FE', '#FDE68A', '#BAE6FD'][idx % 4] }]}> 
                <Text style={styles.jobPetName}>{b.sitterName}</Text>
                <View style={styles.jobMetaRow}>
                  <Ionicons name="calendar-outline" size={16} color="#666" style={{ marginRight: 4 }} />
                  <Text style={styles.jobMetaText}>{formatDate(b.date)}</Text>
                </View>
                <View style={styles.jobMetaRow}>
                  <Ionicons name="time-outline" size={16} color="#666" style={{ marginRight: 4 }} />
                  <Text style={styles.jobMetaText}>{formatTime(b.startTime)} - {formatTime(b.endTime)}</Text>
                </View>
                <View style={styles.jobStatusBadge}>
                  <Text style={styles.jobStatusText}>{b.status}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={[styles.upcomingJobCard, { backgroundColor: '#F3F4F6' }]}>
              <Text style={[styles.jobPetName, { color: '#6B7280', textAlign: 'center' }]}>No upcoming bookings</Text>
              <Text style={[styles.jobMetaText, { textAlign: 'center', marginTop: 8 }]}>Book a sitter to see upcoming appointments here</Text>
            </View>
          )}
        </ScrollView>

        {/* Pet Sitter Recommendations */}
        <View style={[styles.sectionRowAligned, styles.recommendationsSectionSpacing]}>
          <Text style={styles.sectionTitle}>Pet Sitter Recommendations</Text>
        </View>
        {loadingSitters ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#10B981" />
            <Text style={styles.loadingText}>Loading recommendations...</Text>
          </View>
        ) : recommendedSitters.length > 0 ? (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.recommendationsRow}
          >
            {recommendedSitters.map((sitter, idx) => {
              // Safety check - skip invalid sitters
              if (!sitter || !sitter.id) {
                console.warn('⚠️ Skipping invalid sitter:', sitter);
                return null;
              }

              const cardColors = [
                { gradient: ['#A7F3D0', '#D1FAE5'], accent: '#10B981' },
                { gradient: ['#DDD6FE', '#EDE9FE'], accent: '#8B5CF6' },
                { gradient: ['#FDE68A', '#FEF3C7'], accent: '#F59E0B' },
                { gradient: ['#BAE6FD', '#DBEAFE'], accent: '#3B82F6' },
                { gradient: ['#FBCFE8', '#FCE7F3'], accent: '#EC4899' },
              ];
              const cardColor = cardColors[idx % cardColors.length];
              
              return (
                <TouchableOpacity
                  key={sitter.id || `sitter-${idx}`}
                  style={[styles.sitterCard, { borderLeftColor: cardColor.accent }]}
                  onPress={() => {
                    try {
                      handleSitterCardPress(sitter);
                    } catch (error) {
                      console.error('❌ Error in card press handler:', error);
                      Alert.alert('Error', 'Unable to open sitter profile. Please try again.');
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={cardColor.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.sitterCardGradient}
                  >
                    <View style={styles.sitterCardContent}>
                      <View style={styles.sitterCardHeader}>
                        <View style={styles.sitterAvatarContainer}>
                          {sitter?.profileImage || sitter?.imageSource ? (
                            <Image
                              source={{ uri: sitter.profileImage || sitter.imageSource }}
                              style={styles.sitterAvatar}
                              onError={(error) => {
                                console.log('❌ Image load error for sitter:', sitter?.name);
                              }}
                            />
                          ) : (
                            <View style={styles.sitterAvatarPlaceholder}>
                              <Ionicons name="person" size={28} color="#9CA3AF" />
                            </View>
                          )}
                          {sitter?.isOnline && (
                            <View style={[styles.onlineIndicator, { backgroundColor: cardColor.accent }]} />
                          )}
                        </View>
                        <View style={styles.sitterCardInfo}>
                          <Text style={styles.sitterCardName} numberOfLines={1}>
                            {sitter?.name || 'Pet Sitter'}
                          </Text>
                          <View style={styles.sitterCardBadgeRow}>
                            <View style={[styles.sitterCardBadge, { backgroundColor: '#FFF' }]}>
                              <Ionicons name="star" size={14} color="#F59E0B" />
                              <Text style={styles.sitterCardRating}>
                                {sitter?.rating !== undefined && sitter?.rating !== null 
                                  ? Number(sitter.rating).toFixed(1) 
                                  : 'N/A'}
                              </Text>
                            </View>
                            {sitter?.petTypes && Array.isArray(sitter.petTypes) && sitter.petTypes.length > 0 && (
                              <View style={styles.petTypesContainer}>
                                {sitter.petTypes.slice(0, 2).map((type: string, i: number) => (
                                  <View key={i} style={styles.petTypeBadge}>
                                    <Ionicons 
                                      name={type === 'dogs' ? 'paw' : type === 'cats' ? 'paw-outline' : 'paw'} 
                                      size={10} 
                                      color={cardColor.accent} 
                                    />
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                      
                      <View style={styles.sitterCardDetails}>
                        <View style={styles.sitterCardDetailRow}>
                          <View style={[styles.iconContainer, { backgroundColor: '#FFF' }]}>
                            <Ionicons name="location" size={14} color={cardColor.accent} />
                          </View>
                          <Text style={styles.sitterCardLocation} numberOfLines={1}>
                            {sitter?.location?.address || sitter?.address || 'Location not available'}
                          </Text>
                        </View>
                        <View style={styles.sitterCardDetailRow}>
                          {sitter?.distance && (
                            <>
                              <View style={[styles.iconContainer, { backgroundColor: '#FFF' }]}>
                                <Ionicons name="walk" size={14} color={cardColor.accent} />
                              </View>
                              <Text style={styles.sitterCardDistance}>
                                {sitter.distance} away
                              </Text>
                            </>
                          )}
                          <View style={[styles.iconContainer, { backgroundColor: '#FFF', marginLeft: sitter?.distance ? 8 : 0 }]}>
                            <Ionicons name="time" size={14} color={cardColor.accent} />
                          </View>
                          <Text style={styles.sitterCardExperience}>
                            {sitter?.experience || '1+ years'} exp
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.sitterCardFooter}>
                        <View>
                          <Text style={styles.sitterCardRateLabel}>Starting at</Text>
                          <Text style={[styles.sitterCardRate, { color: cardColor.accent }]}>
                            ₱{sitter?.hourlyRate || '25'}/hr
                          </Text>
                        </View>
                        <View style={[styles.viewButton, { backgroundColor: cardColor.accent }]}>
                          <Text style={styles.viewButtonText}>View</Text>
                          <Ionicons name="arrow-forward" size={14} color="#FFF" />
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.noRecommendationsContainer}>
            <Ionicons name="paw-outline" size={32} color="#D1D5DB" />
            <Text style={styles.noRecommendationsText}>
              {currentLocation 
                ? 'No pet sitters available nearby'
                : 'Enable location to see recommendations'
              }
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // Reuse sitter layout styles for a consistent look-and-feel
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
  },
  totalIncomeSection: {
    backgroundColor: '#F59E0B',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 24,
    padding: 20,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  totalIncomeLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  totalIncomeAmount: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 24,
  },
  quickAction: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  quickActionImage: {
    width: 28,
    height: 28,
  },
  quickActionLabel: {
    fontSize: 12,
    color: '#222',
    fontWeight: '600',
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 24,
  },
  statsCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  statsValueWhite: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statsLabelWhite: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.9,
  },
  sectionAction: {
    color: '#F59E0B',
    fontWeight: '600',
    fontSize: 15,
  },
  jobPetImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F8F8F8',
  },
  jobPetName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
  },
  jobOwnerName: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  jobStatusBadge: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginBottom: 4,
  },
  jobStatusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  jobEarnings: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 15,
  },
  jobMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  jobMetaText: {
    color: '#888',
    fontSize: 13,
    marginRight: 8,
  },
  reflection: {
    position: 'absolute',
    bottom: 8,
    left: '10%',
    right: '10%',
    height: 24,
    borderRadius: 16,
    opacity: 0.5,
    zIndex: 1,
  },
  upcomingJobsRow: {
    flexDirection: 'row',
    paddingLeft: 16,
    paddingRight: 8,
    gap: 12,
  },
  upcomingJobCard: {
    width: 180,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 120,
  },
  recommendationsRow: {
    flexDirection: 'row',
    paddingLeft: 16,
    paddingRight: 8,
    gap: 12,
    paddingBottom: 8,
  },
  sitterCard: {
    width: 280,
    borderRadius: 20,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  sitterCardGradient: {
    borderRadius: 20,
    padding: 2,
  },
  sitterCardContent: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
  },
  sitterCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sitterAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  sitterAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  sitterAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  sitterCardInfo: {
    flex: 1,
    paddingTop: 4,
  },
  sitterCardName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  sitterCardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sitterCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sitterCardRating: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginLeft: 4,
  },
  petTypesContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  petTypeBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sitterCardDetails: {
    marginBottom: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  sitterCardDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sitterCardLocation: {
    fontSize: 13,
    color: '#4B5563',
    flex: 1,
    fontWeight: '500',
  },
  sitterCardDistance: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600',
    marginRight: 4,
  },
  sitterCardExperience: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600',
  },
  sitterCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  sitterCardRateLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
    marginBottom: 2,
  },
  sitterCardRate: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  viewButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  noRecommendationsContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noRecommendationsText: {
    marginTop: 12,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    elevation: 4,
    minHeight: 120,
  },
  sectionRowAligned: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 0,
    marginBottom: 16,
  },
  recommendationsSectionSpacing: {
    marginTop: 24,
  },
  profileButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  profileImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  notificationBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  messageBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  messageBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default PetOwnerDashboard;