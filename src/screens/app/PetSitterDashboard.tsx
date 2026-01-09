import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import SitterLocationSharing from '../../components/SitterLocationSharing';
import { useAuth } from '../../contexts/AuthContext';
import authService from '../../services/authService';
import { Booking, bookingService } from '../../services/bookingService';
import { DashboardMetrics, dashboardService } from '../../services/dashboardService';
import { notificationService } from '../../services/notificationService';
import { realtimeService } from '../../services/realtimeService';
import { reverbMessagingService } from '../../services/reverbMessagingService';
import { handleSuspendedOrBannedStatus } from '../../utils/userStatusHelper';

const upcomingJobColors = ['#A7F3D0', '#DDD6FE', '#FDE68A', '#BAE6FD'];

interface EarningsData {
  thisWeek: string;
  thisMonth: string;
  totalEarnings: string;
  completedJobs: number;
}

const quickActions: { title: string; icon: any; color: string; route: string }[] = [
  { title: 'Set Availability', icon: require('../../assets/icons/availability.png'), color: '#A7F3D0', route: '/pet-sitter-availability' },
  { title: 'My Schedule', icon: require('../../assets/icons/sched.png'), color: '#FDE68A', route: '/pet-sitter-schedule' },
  { title: 'Messages', icon: require('../../assets/icons/message2.png'), color: '#BAE6FD', route: '/pet-sitter-messages' },
  { title: 'E-Wallet', icon: 'wallet-outline', color: '#FDE68A', route: '/e-wallet' },
];

const reflectionColors = {
  jobs: '#10B981',
  upcoming: '#8B5CF6',
  week: '#F97316',
};

const PetSitterDashboard = () => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [earningsData, setEarningsData] = useState<EarningsData>({
    thisWeek: '₱0',
    thisMonth: '₱0',
    totalEarnings: '₱0',
    completedJobs: 0,
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState<number>(0);
  const [messageCount, setMessageCount] = useState<number>(0);
  const [hasNewBookings, setHasNewBookings] = useState<boolean>(false);
  const [newBookingsCount, setNewBookingsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);
  const [imageError, setImageError] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics>({});
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // Check if user is suspended or banned
  const isSuspendedOrBanned = user?.status === 'suspended' || user?.status === 'banned';

  // Check if user is logged out and redirect to onboarding
  useEffect(() => {
    const checkLogoutStatus = async () => {
      try {
        const loggedOut = await AsyncStorage.getItem('user_logged_out');
        if (loggedOut === 'true') {
          console.log('PetSitterDashboard: User was logged out, redirecting to onboarding');
          router.replace('/onboarding');
        }
      } catch (error) {
        console.error('Error checking logout status:', error);
      }
    };
    
    checkLogoutStatus();
  }, [router]);

  useEffect(() => {
    checkAuthentication();
  }, []);

  // Initialize real-time service and load dashboard metrics
  useEffect(() => {
    if (currentUserId) {
      initializeRealtimeService();
      loadDashboardMetrics();
    }
  }, [currentUserId]);

  // Auto-refresh dashboard data when screen is focused
  useFocusEffect(
    useCallback(() => {
      console.log('📱 PetSitterDashboard: Screen focused, refreshing data...');
      if (currentUserId) {
        loadDashboardMetrics();
        loadDashboardData();
      }
    }, [currentUserId])
  );

  // Subscribe to dashboard updates
  useEffect(() => {
    const unsubscribe = dashboardService.subscribe((metrics) => {
      console.log('📊 Dashboard metrics updated:', metrics);
      setDashboardMetrics(metrics);
      if (metrics.walletBalance !== undefined) {
        setWalletBalance(metrics.walletBalance);
      }
      // Sync upcoming bookings count with dashboard metrics
      if (typeof metrics.upcomingBookings === 'number') {
        setNewBookingsCount(metrics.upcomingBookings);
        setHasNewBookings(metrics.upcomingBookings > 0);
      }
    });

    return unsubscribe;
  }, []);

  // Subscribe to real-time events for immediate updates
  useEffect(() => {
    if (!currentUserId) return;

    const unsubscribeWallet = realtimeService.subscribe('wallet.updated', (data) => {
      console.log('💳 Real-time wallet update received:', data);
      // Trigger immediate refresh of dashboard data
      loadDashboardMetrics();
      loadDashboardData();
    });

    const unsubscribeDashboard = realtimeService.subscribe('dashboard.updated', (data) => {
      console.log('📊 Real-time dashboard update received:', data);
      // Update metrics immediately
      setDashboardMetrics(prev => {
        const updated = { ...prev, ...data };
        // Sync upcoming bookings count with real-time updates
        if (typeof data.upcoming_bookings === 'number' || typeof data.upcomingBookings === 'number') {
          const upcomingCount = data.upcoming_bookings ?? data.upcomingBookings ?? 0;
          setNewBookingsCount(upcomingCount);
          setHasNewBookings(upcomingCount > 0);
        }
        return updated;
      });
      if (data.wallet_balance !== undefined) {
        setWalletBalance(data.wallet_balance);
      }
    });

    const unsubscribePayment = realtimeService.subscribe('payment.received', (data) => {
      console.log('💰 Real-time payment received:', data);
      // Trigger immediate refresh
      loadDashboardMetrics();
      loadDashboardData();
    });

    // Listen for user suspension/ban events
    const unsubscribeSuspended = realtimeService.subscribe('user.suspended', async (data) => {
      console.log('🚫 Real-time suspension notification received:', data);
      // Show popup and logout
      await handleSuspendedOrBannedStatus(data, async () => {
        await logout();
      });
    });

    return () => {
      unsubscribeWallet();
      unsubscribeDashboard();
      unsubscribePayment();
      unsubscribeSuspended();
    };
  }, [currentUserId, logout]);

  // Initialize real-time service
  const initializeRealtimeService = async () => {
    try {
      await realtimeService.initialize(currentUserId!);
      console.log('🔌 PetSitterDashboard: Real-time service initialized');
    } catch (error) {
      console.error('Error initializing real-time service:', error);
    }
  };

  // Load dashboard metrics
  const loadDashboardMetrics = async () => {
    try {
      // Clear dashboard service cache to ensure fresh data
      dashboardService.clearCache();
      console.log('🧹 Dashboard service cache cleared');
      
      const metrics = await dashboardService.getSitterMetrics(currentUserId!);
      setDashboardMetrics(metrics);
      if (metrics.walletBalance !== undefined) {
        setWalletBalance(metrics.walletBalance);
      }
      
      // Load notification count
      const count = await notificationService.getUnreadCount();
      setNotificationCount(count);
      
      // Load message count from conversations
      try {
        const conversations = await reverbMessagingService.getConversations();
        let totalUnreadCount = 0;
        conversations.forEach(conv => {
          totalUnreadCount += conv.unread_count || 0;
        });
        setMessageCount(totalUnreadCount);
      } catch (error) {
        console.error('Error getting message count:', error);
        // Fallback to the original method
        const messageCount = await reverbMessagingService.getUnreadCount();
        setMessageCount(messageCount);
      }
    } catch (error) {
      console.error('Error loading dashboard metrics:', error);
    }
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

      // Check if user is a pet sitter
      if (user.role !== 'pet_sitter') {
        console.log('🚪 User is not a pet sitter, redirecting to onboarding');
        router.replace('/onboarding');
        return;
      }

      // User is authenticated and is a pet sitter
      loadUserData();
    } catch (error) {
      console.error('Error checking authentication:', error);
      router.replace('/onboarding');
    }
  };

  // Refresh user data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 PetSitterDashboard: Screen focused, checking authentication and refreshing data');
      checkAuthentication();
      if (currentUserId) {
        loadDashboardData();
        loadDashboardMetrics();
      }
    }, [currentUserId])
  );

  useEffect(() => {
    if (currentUserId) {
      loadDashboardData();
      // Removed notification count loading
      
      // Subscribe to booking updates with aggressive debouncing
      const unsubscribe = bookingService.subscribe(() => {
        const now = Date.now();
        if (now - lastLoadTime > 10000) { // Only reload if more than 10 seconds have passed
          console.log('🔄 Booking update received, reloading dashboard data');
          loadDashboardData();
          // Removed notification count loading
          setLastLoadTime(now);
        } else {
          console.log('🚫 Skipping dashboard reload due to recent update');
        }
      });

      // Subscribe to notification updates to refresh count
      const notificationUnsubscribe = notificationService.subscribe(async () => {
        console.log('🔄 Notification update received, refreshing count');
        const count = await notificationService.getUnreadCount();
        setNotificationCount(count);
      });

      return () => {
        unsubscribe();
        notificationUnsubscribe();
      };
    }
  }, [currentUserId]); // Removed lastLoadTime from dependencies to prevent infinite loop

  const loadUserData = async () => {
    try {
      const user = await authService.getCurrentUser();
      console.log('🔍 PetSitterDashboard: Loaded user data:', user);
      console.log('🔍 PetSitterDashboard: User profileImage:', user?.profileImage);
      setCurrentUserId(user?.id || null);
      setCurrentUser(user);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  // Helper function to validate image URI
  const isValidImageUri = (uri: string | null): boolean => {
    if (!uri || uri.trim() === '') return false;
    // Check if it's a valid URL or local file path
    const isValid = uri.startsWith('http') || uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('data:') || uri.startsWith('/storage/') || uri.includes('profile_images/');
    console.log('🔍 PetSitterDashboard: isValidImageUri check:', { uri, isValid });
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
      console.log('🔗 PetSitterDashboard: Generated URL for /storage/ path:', fullUrl);
      return fullUrl;
    }
    if (uri.startsWith('profile_images/')) {
      const fullUrl = `${baseUrl}/storage/${uri}`;
      console.log('🔗 PetSitterDashboard: Generated URL for profile_images/ path:', fullUrl);
      return fullUrl;
    }
    const fullUrl = `${baseUrl}/storage/${uri}`;
    console.log('🔗 PetSitterDashboard: Generated URL for fallback path:', fullUrl);
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

  const loadDashboardData = async () => {
    if (!currentUserId || isLoading) return;

    setIsLoading(true);
    try {
      console.log('🔄 Loading dashboard data for user:', currentUserId);
      console.log('📡 Fetching fresh data from API...');
      
      // Restore availability data when dashboard loads
      try {
        const response = await fetch('/api/sitters/restore-availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (response.ok) {
          console.log('✅ Availability data restored on login');
        }
      } catch (error) {
        console.log('⚠️ Could not restore availability:', error);
      }
      
      // Clear booking service cache to ensure fresh data
      await bookingService.clearCache();
      console.log('🧹 Booking service cache cleared');
      
      // Load all bookings first to debug
      const allBookings = await bookingService.getBookings();
      console.log('📊 All bookings in storage:', allBookings.length);
      
      const sitterBookings = await bookingService.getSitterBookings(currentUserId);
      console.log('👤 Sitter bookings for user', currentUserId, ':', sitterBookings.length);
      sitterBookings.forEach(booking => {
        console.log(`  - ${booking.date} (${booking.status}): ${booking.startTime}-${booking.endTime}`);
      });
      
      // Load upcoming bookings
      const upcoming = await bookingService.getUpcomingSitterBookings(currentUserId);
      console.log('📅 Upcoming bookings found:', upcoming.length);
      upcoming.forEach(booking => {
        console.log(`  - ${booking.date} (${booking.status}): ${booking.startTime}-${booking.endTime}`);
      });
      setUpcomingBookings(upcoming);
      
      // Set count of upcoming jobs - all upcoming bookings are already confirmed and non-completed
      const upcomingCount = upcoming.length;
      console.log('📊 Upcoming jobs count:', upcomingCount);
      setHasNewBookings(upcomingCount > 0);
      setNewBookingsCount(upcomingCount);

      // Load active bookings
      const active = await bookingService.getActiveSitterBookings(currentUserId);
      console.log('🔄 Active bookings found:', active.length);
      active.forEach(booking => {
        console.log(`  - ${booking.date} (${booking.status}): ${booking.startTime}-${booking.endTime}`);
      });

      // Load dashboard metrics
      const { dashboardService } = require('../../services/dashboardService');
      const metrics = await dashboardService.getSitterMetrics(currentUserId);
      setDashboardMetrics(metrics);
      console.log('📊 Dashboard metrics loaded:', metrics);

      // Load earnings data
      const earnings = await bookingService.getSitterEarnings(currentUserId);
      console.log('💰 Earnings data:', earnings);
      console.log('💰 Earnings breakdown:', {
        thisWeek: earnings.thisWeek,
        thisMonth: earnings.thisMonth,
        total: earnings.total,
        completedJobs: earnings.completedJobs
      });
      // Ensure earnings values are numbers and provide fallbacks
      const safeThisWeek = typeof earnings.thisWeek === 'number' ? earnings.thisWeek : 0;
      const safeThisMonth = typeof earnings.thisMonth === 'number' ? earnings.thisMonth : 0;
      const safeTotal = typeof earnings.total === 'number' ? earnings.total : 0;
      const safeCompletedJobs = typeof earnings.completedJobs === 'number' ? earnings.completedJobs : 0;
      
      const newEarningsData = {
        thisWeek: `₱${safeThisWeek.toFixed(0)}`,
        thisMonth: `₱${safeThisMonth.toFixed(0)}`,
        totalEarnings: `₱${safeTotal.toFixed(0)}`,
        completedJobs: safeCompletedJobs,
      };
      console.log('💰 Setting earnings data state:', newEarningsData);
      setEarningsData(newEarningsData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log('🔄 Refreshing sitter dashboard data...');
    
    try {
      // Force refresh all data
      await Promise.all([
        loadDashboardData(),
        loadDashboardMetrics()
      ]);
      
      // Force refresh real-time connection
      try {
        await realtimeService.forceRefresh();
        console.log('🔌 Real-time connection refreshed');
      } catch (error) {
        console.log('🔌 Real-time refresh failed, continuing with API data:', error);
      }
      
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
    } catch (error) {
      console.error('❌ Error refreshing dashboard data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [currentUserId]);

  // Removed loadNotificationCount function for fresh start


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
            <Text style={styles.headerTitle}>Pet Sitter Dashboard</Text>
            {refreshing && (
              <ActivityIndicator 
                size="small" 
                color="#10B981" 
                style={{ marginLeft: 8 }} 
              />
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.push('/pet-sitter-notifications')} style={{ marginRight: 16, position: 'relative' }}>
              <Ionicons name="notifications-outline" size={24} color="#222" />
              {notificationCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/pet-sitter-profile')} style={styles.profileButton}>
              <Image
                source={(() => {
                  console.log('🖼️ PetSitterDashboard: Image source decision:');
                  console.log('  - currentUser?.profileImage:', currentUser?.profileImage);
                  console.log('  - isValidImageUri:', currentUser?.profileImage ? isValidImageUri(currentUser.profileImage) : false);
                  console.log('  - imageError:', imageError);
                  
                  if (currentUser?.profileImage && isValidImageUri(currentUser.profileImage) && !imageError) {
                    const fullUrl = getFullImageUrl(currentUser.profileImage);
                    console.log('  - Using profile image with URL:', fullUrl);
                    return { uri: fullUrl };
                  } else {
                    console.log('  - Using default avatar');
                    return require('../../assets/images/default-avatar.png');
                  }
                })()}
                style={styles.profileImage}
                onError={(error) => {
                  console.log('❌ PetSitterDashboard: Profile image failed to load:', error.nativeEvent.error);
                  console.log('❌ PetSitterDashboard: Failed image URI:', currentUser?.profileImage);
                  console.log('❌ PetSitterDashboard: Full URL:', getFullImageUrl(currentUser?.profileImage || ''));
                  handleImageError();
                }}
                onLoad={() => {
                  console.log('✅ PetSitterDashboard: Profile image loaded successfully:', currentUser?.profileImage);
                  console.log('✅ PetSitterDashboard: Full URL:', getFullImageUrl(currentUser?.profileImage || ''));
                  handleImageLoad();
                }}
                defaultSource={require('../../assets/images/default-avatar.png')}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Total Income Section */}
        <TouchableOpacity onPress={() => router.push('/e-wallet' as any)}>
          <LinearGradient
            colors={['#10B981', '#8B5CF6', '#F97316']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.totalIncomeSection}
          >
            <View style={styles.totalIncomeContent}>
              <View style={styles.totalIncomeHeader}>
                <Ionicons name="wallet" size={24} color="#fff" />
                <Text style={styles.totalIncomeLabel}>Total Income</Text>
              </View>
              <Text style={styles.totalIncomeAmount}>
                {(() => {
                  console.log('💰 Rendering total income from dashboardService:', dashboardMetrics.totalIncome);
                  console.log('💰 Rendering total income from earningsData:', earningsData.totalEarnings);
                  // Use dashboardService metrics if available, fallback to earningsData
                  const totalIncome = typeof dashboardMetrics.totalIncome === 'number' ? dashboardMetrics.totalIncome : 0;
                  return totalIncome > 0 ? `₱${totalIncome.toFixed(0)}` : (earningsData.totalEarnings || '₱0.00');
                })()}
              </Text>
              <View style={styles.totalIncomeHint}>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
                <Text style={styles.totalIncomeHintText}>Tap to view E-Wallet</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <TouchableOpacity 
            style={[styles.statsCard, {
              backgroundColor: '#10B981',
              shadowColor: '#10B981',
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.5,
              shadowRadius: 24,
              elevation: 16,
            }]}
            onPress={() => router.push('/completed-jobs' as any)}
          >
            <View style={styles.statsIcon}>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
            </View>
            <Text style={styles.statsValueWhite}>
              {(() => {
                console.log('💰 Rendering completed jobs from dashboardService:', dashboardMetrics.completedJobs);
                console.log('💰 Rendering completed jobs from earningsData:', earningsData.completedJobs);
                // Use dashboardService metrics if available, fallback to earningsData
                return typeof dashboardMetrics.completedJobs === 'number' ? dashboardMetrics.completedJobs : (earningsData.completedJobs || 0);
              })()}
            </Text>
            <Text style={styles.statsLabelWhite}>Jobs Completed</Text>
            <View style={[styles.reflection, { backgroundColor: reflectionColors.jobs }]} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statsCard, {
              backgroundColor: '#8B5CF6',
              shadowColor: '#8B5CF6',
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.5,
              shadowRadius: 24,
              elevation: 16,
            }]}
            onPress={() => router.push('/upcoming-jobs' as any)}
          >
            <View style={styles.statsIcon}>
              <Ionicons name="calendar" size={24} color="#fff" />
            </View>
            <Text style={styles.statsValueWhite}>
              {(() => {
                // Use dashboard metrics if available, otherwise use newBookingsCount
                const count = typeof dashboardMetrics.upcomingBookings === 'number' 
                  ? dashboardMetrics.upcomingBookings 
                  : newBookingsCount;
                console.log('📊 Upcoming Jobs count:', { 
                  dashboardMetrics: dashboardMetrics.upcomingBookings, 
                  newBookingsCount, 
                  final: count 
                });
                return count;
              })()}
            </Text>
            <Text style={styles.statsLabelWhite}>Upcoming Jobs</Text>
            <View style={[styles.reflection, { backgroundColor: reflectionColors.upcoming }]} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statsCard, {
              backgroundColor: '#F97316',
              shadowColor: '#F97316',
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.5,
              shadowRadius: 24,
              elevation: 16,
            }]}
            onPress={() => router.push('/earnings' as any)}
          >
            <View style={styles.statsIcon}>
              <Ionicons name="trending-up" size={24} color="#fff" />
            </View>
            <Text style={styles.statsValueWhite}>
              {(() => {
                console.log('💰 Rendering this week from dashboardService:', dashboardMetrics.thisWeekIncome);
                console.log('💰 Rendering this week from earningsData:', earningsData.thisWeek);
                // Use dashboardService metrics if available, fallback to earningsData
                const thisWeekIncome = typeof dashboardMetrics.thisWeekIncome === 'number' ? dashboardMetrics.thisWeekIncome : 0;
                return thisWeekIncome > 0 ? `₱${thisWeekIncome.toFixed(0)}` : (earningsData.thisWeek || '₱0.00');
              })()}
            </Text>
            <Text style={styles.statsLabelWhite}>This Week</Text>
            <View style={[styles.reflection, { backgroundColor: reflectionColors.week }]} />
          </TouchableOpacity>
        </View>

        {/* Location Sharing Component */}
        <SitterLocationSharing />

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsRow}>
          {quickActions.map((action) => {
            // Disable buttons for suspended/banned users
            const isDisabled = isSuspendedOrBanned;
            
            return (
            <TouchableOpacity 
              key={action.title} 
              style={[styles.quickAction, isDisabled && styles.quickActionDisabled]} 
              onPress={() => {
                if (isDisabled) {
                  return; // Don't navigate if suspended/banned
                }
                // Clear NEW indicator and reset count when My Schedule is clicked
                if (action.title === 'My Schedule') {
                  setHasNewBookings(false);
                  setNewBookingsCount(0);
                }
                router.push(action.route as any);
              }}
              disabled={isDisabled}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: isDisabled ? '#D1D5DB' : action.color }]}> 
                {typeof action.icon === 'string' ? (
                  <Ionicons name={action.icon as any} size={24} color="#fff" />
                ) : (
                  <Image 
                    source={action.icon} 
                    style={[styles.quickActionImage, isDisabled && { opacity: 0.5 }]}
                    resizeMode="contain"
                  />
                )}
                {/* Show message count badge for Messages action */}
                {action.title === 'Messages' && messageCount > 0 && !isDisabled && (
                  <View style={styles.messageBadge}>
                    <Text style={styles.messageBadgeText}>
                      {messageCount > 99 ? '99+' : messageCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.quickActionLabel, isDisabled && styles.quickActionLabelDisabled]}>{action.title}</Text>
              {/* Show booking count badge for My Schedule action */}
              {action.title === 'My Schedule' && newBookingsCount > 0 && !isDisabled && (
                <View style={styles.bookingCountBadge}>
                  <Text style={styles.bookingCountBadgeText}>
                    {newBookingsCount > 99 ? '99+' : newBookingsCount}
                  </Text>
                </View>
              )}
              {isDisabled && (
                <View style={styles.disabledOverlay}>
                  <Ionicons name="lock-closed" size={16} color="#6B7280" />
                </View>
              )}
            </TouchableOpacity>
            );
          })}
        </View>


        {/* Upcoming Jobs */}
        <View style={styles.sectionRowAligned}>
          <Text style={styles.sectionTitle}>Upcoming Jobs</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.upcomingJobsRow}>
          {upcomingBookings.map((booking, idx) => {
            return (
              <View 
                key={booking.id} 
                style={[styles.upcomingJobCard, { backgroundColor: upcomingJobColors[idx % upcomingJobColors.length] }]}
              >
                <Text style={styles.jobOwnerName}>{booking.petOwnerName}</Text>
                <View style={styles.jobMetaRow}>
                  <Ionicons name="calendar-outline" size={16} color="#666" style={{ marginRight: 4 }} />
                  <Text style={styles.jobMetaText}>
                    {(() => {
                      try {
                        const { formatDate } = require('../../utils/timeUtils');
                        return formatDate(booking.date);
                      } catch (error) {
                        console.error('Error formatting date:', error);
                        return booking.date;
                      }
                    })()}
                  </Text>
                </View>
                <View style={styles.jobMetaRow}>
                  <Ionicons name="time-outline" size={16} color="#666" style={{ marginRight: 4 }} />
                  <Text style={styles.jobMetaText}>
                    {(() => {
                      try {
                        const { formatTimeRange } = require('../../utils/timeUtils');
                        return formatTimeRange(booking.startTime, booking.endTime);
                      } catch (error) {
                        console.error('Error formatting time:', error);
                        return 'Time not set';
                      }
                    })()}
                  </Text>
                </View>
                <View style={styles.jobStatusBadge}>
                  <Text style={styles.jobStatusText}>{booking.status}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </ScrollView>

      {/* Floating Action Button - AI Chatbot */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/ai-chat')}
        activeOpacity={0.8}
      >
        <Image 
          source={require('../../assets/icons/chatbot.png')} 
          style={styles.fabIcon}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
    marginLeft: 8,
  },
  totalIncomeAmount: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  totalIncomeContent: {
    alignItems: 'center',
  },
  totalIncomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalIncomeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    opacity: 0.9,
  },
  totalIncomeHintText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
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
  quickActionDisabled: {
    opacity: 0.5,
  },
  quickActionLabelDisabled: {
    color: '#9CA3AF',
  },
  disabledOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 8,
    padding: 4,
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
  statsValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  statsLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
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
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionAction: {
    color: '#F59E0B',
    fontWeight: '600',
    fontSize: 15,
  },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
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
  jobMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  jobMetaText: {
    color: '#888',
    fontSize: 10,
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
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionRowAligned: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 0,
    marginBottom: 16,
  },
  notificationBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
  messageBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  messageBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  newIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newIndicatorText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  bookingCountBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  bookingCountBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 1000,
  },
  fabIcon: {
    width: 32,
    height: 32,
  },
});

export default PetSitterDashboard; 