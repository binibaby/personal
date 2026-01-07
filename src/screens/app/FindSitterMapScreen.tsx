import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Image,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import PlatformMap, { PlatformMarker } from '../../components/PlatformMap';
import SitterProfilePopup from '../../components/SitterProfilePopup';
import { useAuth } from '../../contexts/AuthContext';
import authService from '../../services/authService';
import realtimeLocationService from '../../services/realtimeLocationService';

// Lazy import for react-native-maps to avoid duplicate registration
const getMapComponents = () => {
  if (Platform.OS === 'web') {
    return { MapView: null, Marker: null };
  }
  
  try {
    const Maps = require('react-native-maps');
    return {
      MapView: Maps.default || Maps.MapView,
      Marker: Maps.Marker
    };
  } catch (error) {
    console.warn('react-native-maps not available:', error);
    return { MapView: null, Marker: null };
  }
};

// Type definitions for react-native-maps
interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

// Web-only version - no react-native-maps imports
const FindSitterMapScreen = () => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [sitters, setSitters] = useState<any[]>([]);
  const [selectedSitter, setSelectedSitter] = useState<any>(null);
  const [showProfilePopup, setShowProfilePopup] = useState<boolean>(false);
  const [is3DMode, setIs3DMode] = useState(false);
  const router = useRouter();
  const { currentLocation, userAddress, isLocationTracking, startLocationTracking, profileUpdateTrigger } = useAuth();

  // Check authentication and initialize
  useEffect(() => {
    checkAuthentication();
  }, []);

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

      // User is authenticated, initialize
      setSitters([]);
      
      // Check if there's a selected sitter location from dashboard recommendations
      const selectedSitterLocation = await AsyncStorage.getItem('selected_sitter_location');
      if (selectedSitterLocation) {
        try {
          const locationData = JSON.parse(selectedSitterLocation);
          console.log('📍 Found selected sitter location:', locationData);
          
          // Set map region to the selected sitter's location
          if (locationData.latitude && locationData.longitude) {
            const region: Region = {
              latitude: locationData.latitude,
              longitude: locationData.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            };
            setUserRegion(region);
            
            // Clear the stored location after using it
            await AsyncStorage.removeItem('selected_sitter_location');
            
            // If there's a sitter ID, try to select that sitter when sitters are loaded
            if (locationData.sitterId) {
              // Store sitter ID to select after sitters load (must be string)
              await AsyncStorage.setItem('pending_sitter_selection', String(locationData.sitterId));
            }
          }
        } catch (error) {
          console.error('Error parsing selected sitter location:', error);
          await AsyncStorage.removeItem('selected_sitter_location');
        }
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
      router.replace('/onboarding');
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleSitterPress = async (sitterId: string) => {
    // Find and show sitter profile popup from real-time data
    const sitter = sitters.find(s => s.id === sitterId);
    if (sitter) {
      console.log('🔍 FindSitterMapScreen - Selected sitter for popup:', {
        id: sitter.id,
        name: sitter.name,
        profileImage: sitter.profileImage,
        imageSource: sitter.imageSource,
        images: sitter.images,
        allKeys: Object.keys(sitter)
      });
      setSelectedSitter(sitter);
      setShowProfilePopup(true);
    }
  };

  const handleClosePopup = () => {
    setShowProfilePopup(false);
    setSelectedSitter(null);
  };


    const handleMessage = async (sitterId: string) => {
      try {
        console.log('💬 Starting conversation with sitter:', sitterId);
        
        // Find the sitter to get their name and image
        const sitter = sitters.find(s => s.id === sitterId);
        if (!sitter) {
          console.error('❌ Sitter not found:', sitterId);
          Alert.alert('Error', 'Sitter not found. Please try again.');
          return;
        }
        
        console.log('💬 Sitter details:', {
          id: sitter.id,
          name: sitter.name,
          profileImage: sitter.profileImage
        });
        
        // Import the Reverb messaging service
        const { reverbMessagingService } = require('../../services/reverbMessagingService');
        
        let conversationResult;
        
        try {
          // Try to start conversation via API first
          console.log('💬 Calling startConversation via API...');
          conversationResult = await reverbMessagingService.startConversation(
            sitterId, 
            sitter.name, 
            sitter.profileImage
          );
          console.log('💬 Conversation started via API:', conversationResult);
        } catch (apiError) {
          console.log('⚠️ API conversation failed, creating local conversation for demo');
          
          // Create a local conversation for demo purposes
          const localConversationId = `local_${sitterId}_${Date.now()}`;
          conversationResult = {
            conversation_id: localConversationId,
            other_user: {
              id: sitterId,
              name: sitter.name,
              profile_image: sitter.profileImage
            }
          };
          
          // Add a welcome message to the local conversation
          try {
            await reverbMessagingService.sendMessage(
              sitterId,
              `Hello ${sitter.name}! I'm interested in your pet sitting services. Can you tell me more about your availability?`,
              'text'
            );
            console.log('💬 Welcome message added to local conversation');
          } catch (messageError) {
            console.log('⚠️ Could not add welcome message, but conversation created');
          }
        }
        
        // Navigate to messages screen with conversation details
        router.push({
          pathname: '/pet-owner-messages',
          params: {
            conversationId: conversationResult.conversation_id,
            otherUserId: sitterId,
            otherUserName: conversationResult.other_user.name,
            otherUserImage: conversationResult.other_user.profile_image,
          }
        });
        
        console.log('💬 Navigated to messages screen with conversation:', conversationResult.conversation_id);
      } catch (error) {
        console.error('❌ Error starting conversation:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        Alert.alert('Error', `Failed to start conversation: ${errorMessage}`);
      }
    };

  const handleViewBadges = (sitterId: string) => {
    // TODO: Navigate to badges view
  };

  const handleViewCertificates = (sitterId: string) => {
    // TODO: Navigate to certificates view
  };

  const handleRefreshSitters = async () => {
    console.log('🔄 Manual refresh: Force clearing everything and fetching fresh data');
    
    // Check if location is available
    if (!currentLocation) {
      console.log('⚠️ No current location available for force refresh');
      
      // Check if location tracking is active
      if (!isLocationTracking) {
        console.log('📍 Location tracking is not active, starting location tracking...');
        try {
          await startLocationTracking(1000);
          // Wait a moment for location to be acquired
          setTimeout(() => {
            const location: any = currentLocation;
            if (location && location.coords) {
              realtimeLocationService.forceClearAndRefresh(
                location.coords.latitude,
                location.coords.longitude,
                50
              );
            }
          }, 2000);
        } catch (error) {
          console.error('❌ Failed to start location tracking:', error);
          Alert.alert(
            'Location Required',
            'Please enable location services to find nearby pet sitters. You can enable location in your device settings.',
            [{ text: 'OK' }]
          );
        }
      } else {
        console.log('📍 Location tracking is active but no location yet, please wait...');
        Alert.alert(
          'Getting Your Location',
          'We\'re still getting your location. Please wait a moment and try again.',
          [{ text: 'OK' }]
        );
      }
      return;
    }
    
    // Location is available, proceed with refresh
    try {
      await realtimeLocationService.forceClearAndRefresh(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        50 // 50km radius
      );
      console.log('✅ Successfully refreshed sitters with current location');
    } catch (error) {
      console.error('❌ Error refreshing sitters:', error);
      Alert.alert(
        'Refresh Failed',
        'Unable to refresh sitters. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Helper function to get proper image source
  const getImageSource = (sitter: any) => {
    // Debug logging for sitter image data
    console.log('🖼️ FindSitterMapScreen - getImageSource for sitter:', {
      sitterId: sitter.id,
      sitterName: sitter.name,
      profileImage: sitter.profileImage,
      imageSource: sitter.imageSource,
      images: sitter.images,
      allKeys: Object.keys(sitter)
    });
    
    const imageSource = sitter.profileImage || sitter.imageSource || sitter.images?.[0];
    
    if (!imageSource) {
      console.log('🖼️ FindSitterMapScreen - No image source found, using default');
      return require('../../assets/images/default-avatar.png');
    }
    
    console.log('🖼️ FindSitterMapScreen - Using image source:', imageSource);
    
    // If it's a URL (starts with http), use it directly
    if (typeof imageSource === 'string' && (imageSource.startsWith('http') || imageSource.startsWith('https'))) {
      console.log('🖼️ FindSitterMapScreen - Using HTTP URL:', imageSource);
      return { uri: imageSource };
    }
    
    // If it's a relative URL (starts with /storage/), convert to full URL
    if (typeof imageSource === 'string' && imageSource.startsWith('/storage/')) {
      // Use the network service synchronously - it should already be initialized
      const { networkService } = require('../../services/networkService');
      const fullUrl = networkService.getImageUrl(imageSource);
      console.log('🖼️ FindSitterMapScreen - Converted storage path to full URL:', {
        originalPath: imageSource,
        fullUrl: fullUrl,
        baseUrl: networkService.getBaseUrl()
      });
      return { uri: fullUrl };
    }
    
    // If it's already a require() object, use it directly
    if (typeof imageSource === 'object' && imageSource.uri !== undefined) {
      console.log('🖼️ FindSitterMapScreen - Using object with URI:', imageSource.uri);
      return imageSource;
    }
    
    // For any other string (local paths), treat as URI
    if (typeof imageSource === 'string') {
      console.log('🖼️ FindSitterMapScreen - Using string as URI:', imageSource);
      return { uri: imageSource };
    }
    
    // Fallback to default avatar
    console.log('🖼️ FindSitterMapScreen - Fallback to default avatar');
    return require('../../assets/images/default-avatar.png');
  };

  const handleFilterPress = (filter: string) => {
    setSelectedFilter(filter);
  };

  // Load sitters from real-time location service
  const loadSittersFromAPI = async (forceRefresh: boolean = false) => {
    console.log('🔄 loadSittersFromAPI called with forceRefresh:', forceRefresh);
    console.log('📍 Current location:', currentLocation);
    
    if (!currentLocation) {
      console.log('📍 No location available, showing empty state');
      setSitters([]);
      return;
    }

    try {
      // Get nearby sitters from real-time service via API
      const nearbySitters = await realtimeLocationService.getSittersNearby(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        2, // 2km radius for testing
        forceRefresh
      );
      
      console.log('📍 API returned sitters:', nearbySitters?.length || 0);
      console.log('📍 Raw sitters data:', nearbySitters);
      
      if (nearbySitters && nearbySitters.length > 0) {
        setSitters(nearbySitters);
        console.log('📍 Found nearby sitters from API:', nearbySitters.length);
        
        // Check if there's a pending sitter selection from dashboard
        const pendingSitterId = await AsyncStorage.getItem('pending_sitter_selection');
        if (pendingSitterId) {
          // Convert to number for comparison (sitter.id might be number or string)
          const sitterIdNum = Number(pendingSitterId);
          const sitterToSelect = nearbySitters.find(s => {
            const sitterId = typeof s.id === 'string' ? Number(s.id) : s.id;
            return sitterId === sitterIdNum || String(s.id) === pendingSitterId;
          });
          if (sitterToSelect) {
            console.log('📍 Selecting sitter from dashboard recommendation:', sitterToSelect.name);
            setSelectedSitter(sitterToSelect);
            setShowProfilePopup(true);
            await AsyncStorage.removeItem('pending_sitter_selection');
          } else {
            console.warn('⚠️ Sitter not found for pending selection:', pendingSitterId);
            await AsyncStorage.removeItem('pending_sitter_selection');
          }
        }
        
        // Update selectedSitter if it exists and we have updated data
        if (selectedSitter && !pendingSitterId) {
          const updatedSitter = nearbySitters.find(s => s.id === selectedSitter.id);
          if (updatedSitter) {
            console.log('🔄 Updating selectedSitter with fresh data:', updatedSitter.name);
            setSelectedSitter(updatedSitter);
          }
        }
        
        nearbySitters.forEach((sitter, index) => {
          console.log(`🗺️ Sitter ${index + 1} (${sitter.name}):`, {
            hasImages: !!sitter.images,
            imageCount: sitter.images?.length || 0,
            firstImage: sitter.images?.[0],
            hasProfileImage: !!sitter.profileImage,
            profileImage: sitter.profileImage,
            imageSource: sitter.imageSource,
            allKeys: Object.keys(sitter)
          });
          
          // Additional debugging for image fields
          console.log(`🖼️ Sitter ${index + 1} image analysis:`, {
            'sitter.profileImage': sitter.profileImage,
            'sitter.imageSource': sitter.imageSource,
            'sitter.images': sitter.images,
            'sitter.images?.[0]': sitter.images?.[0],
            'typeof profileImage': typeof sitter.profileImage,
            'typeof imageSource': typeof sitter.imageSource,
            'profileImage starts with http': sitter.profileImage?.startsWith('http'),
            'imageSource starts with http': sitter.imageSource?.startsWith('http'),
          });
        });
      } else {
        console.log('📍 No sitters from API, showing empty state');
        setSitters([]);
      }
    } catch (error) {
      console.error('❌ Error loading nearby sitters, showing empty state:', error);
      setSitters([]);
    }
  };

  // Initial load
  useEffect(() => {
    loadSittersFromAPI();
  }, [currentLocation]);

  // Refresh sitter data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('🗺️ FindSitterMapScreen: Screen focused, refreshing sitter data');
      loadSittersFromAPI(true); // Force refresh to get latest data
    }, [currentLocation])
  );

  // Also refresh when app state changes (user might have updated profile)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        console.log('🗺️ FindSitterMapScreen: App became active, refreshing sitter data');
        loadSittersFromAPI(true); // Force refresh to get latest data
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [currentLocation]);

  // Refresh when profile is updated (triggered by profileUpdateTrigger)
  useEffect(() => {
    if (profileUpdateTrigger && profileUpdateTrigger > 0) {
      console.log('🗺️ FindSitterMapScreen: Profile updated, refreshing sitter data');
      loadSittersFromAPI(true); // Force refresh to get latest data
    }
  }, [profileUpdateTrigger]);

  // Periodic refresh to ensure we get the latest sitter status
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      console.log('🔄 Periodic refresh of sitters list');
      loadSittersFromAPI();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [currentLocation]);

  // Refresh when app comes back to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        console.log('🔄 App became active, refreshing sitters list');
        loadSittersFromAPI(true); // Force refresh when app becomes active
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [currentLocation]);

  // Subscribe to real-time updates (only once, not dependent on currentLocation)
  useEffect(() => {
    const unsubscribe: () => void = realtimeLocationService.subscribe((allSitters) => {
      // Always update if we have a current location, even if no sitters are available
      if (currentLocation) {
        // Filter sitters based on current location instead of making another API call
        const nearbySitters = allSitters.filter(sitter => {
          if (!sitter.location) return false;
          
          // Calculate distance (simple approximation)
          const latDiff = Math.abs(sitter.location.latitude - currentLocation.coords.latitude);
          const lonDiff = Math.abs(sitter.location.longitude - currentLocation.coords.longitude);
          const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111; // Rough km conversion
          
          return distance <= 50; // 50km radius
        });
        
        setSitters(nearbySitters);
        console.log('🔄 Real-time update - nearby sitters:', nearbySitters.length);
      }
    });

    return () => unsubscribe();
  }, []); // Remove currentLocation dependency to prevent infinite loop

  // Force refresh sitters when screen comes into focus (to ensure fresh data after logout)
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 FindSitterMapScreen: Screen focused, forcing sitter refresh');
      console.log('📍 Current location:', currentLocation);
      console.log('📍 Location tracking status:', isLocationTracking);
      
      // Force clear everything and refresh from backend
      if (currentLocation) {
        realtimeLocationService.forceClearAndRefresh(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
          50 // 50km radius
        );
      } else {
        console.log('📍 Screen focused: No current location available, will show empty state');
        // Show empty state when no location is available
        setSitters([]);
      }
    }, [currentLocation])
  );

  // Refresh sitters when profile updates occur (e.g., profile image changes)
  useEffect(() => {
    if (profileUpdateTrigger > 0) {
      console.log('🔄 Profile update detected - refreshing sitters');
      loadSittersFromAPI(true);
    }
  }, [profileUpdateTrigger]);

  // Add periodic refresh to ensure fresh data across devices
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      console.log('🔄 Periodic refresh: Checking for fresh sitter data');
      if (currentLocation) {
        // Force refresh from backend every 30 seconds
        realtimeLocationService.forceClearAndRefresh(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
          50 // 50km radius
        );
      } else {
        console.log('📍 Periodic refresh: No location available, skipping refresh');
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [currentLocation]);

  // Filter sitters based on selected filter
  const filteredSitters = useMemo(() => {
    if (selectedFilter === 'all') return sitters;
    return sitters.filter(sitter => sitter.petTypes.includes(selectedFilter as 'dogs' | 'cats'));
  }, [sitters, selectedFilter]);

  // Compute a sensible initial region around the first sitter or user location
  const initialRegion: Region = useMemo(() => {
    // Use userRegion if set (e.g., from dashboard recommendation)
    if (userRegion) {
      return userRegion;
    }
    if (currentLocation) {
      return {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    if (filteredSitters.length > 0) {
      const first = filteredSitters[0];
      return {
        latitude: first.location.latitude,
        longitude: first.location.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    // Default to San Francisco
    return {
      latitude: 37.7749,
      longitude: -122.4194,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }, [userRegion, currentLocation, filteredSitters]);

  const [userRegion, setUserRegion] = useState<Region | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    // Start location tracking with 2km radius for this screen
    startLocationTracking(2000);
  }, []);

  // Update user region when location changes
  useEffect(() => {
    if (currentLocation) {
      const region: Region = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setUserRegion(region);
      
      // Smoothly move map to user location
      if (mapRef.current) {
        requestAnimationFrame(() => {
          mapRef.current?.animateToRegion(region, 600);
        });
      }
    }
  }, [currentLocation]);

  // Location status indicator
  const renderLocationStatus = () => {
    if (!isLocationTracking) {
      return (
        <View style={styles.locationStatus}>
          <Ionicons name="location-outline" size={16} color="#FF6B6B" />
          <Text style={styles.locationStatusText}>Location tracking inactive</Text>
        </View>
      );
    }

    if (!currentLocation) {
      return (
        <View style={styles.locationStatus}>
          <Ionicons name="location-outline" size={16} color="#FFA500" />
          <Text style={styles.locationStatusText}>Getting your location...</Text>
        </View>
      );
    }

    return (
      <View style={styles.locationStatus}>
        <Ionicons name="location" size={16} color="#4CAF50" />
        <Text style={styles.locationStatusText}>
          {userAddress || 'Location detected'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Pet Sitters</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={[styles.toggle3DButton, is3DMode && styles.toggle3DButtonActive]} 
            onPress={() => setIs3DMode(!is3DMode)}
          >
            <Ionicons 
              name={is3DMode ? "cube" : "cube-outline"} 
              size={20} 
              color={is3DMode ? "#fff" : "#333"} 
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefreshSitters}>
            <Ionicons name="refresh" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>


      {/* Map View */}
      <View style={styles.mapContainer}>
        {!currentLocation ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
            <View style={styles.noLocationContainer}>
              <Ionicons name="location-outline" size={48} color="#D1D5DB" />
              <Text style={styles.noLocationTitle}>Location Required</Text>
              <Text style={styles.noLocationText}>
                Enable location services to find nearby pet sitters
              </Text>
            </View>
          </View>
        ) : (
          <PlatformMap
            style={StyleSheet.absoluteFill}
            initialRegion={initialRegion}
            showsUserLocation
            showsPointsOfInterest={false}
            mapType={is3DMode ? "hybrid" : "standard"}
            pitchEnabled={is3DMode}
            scrollEnabled={true}
            zoomEnabled={true}
            rotateEnabled={is3DMode}
            tiltEnabled={is3DMode}
            ref={mapRef}
          >
            {filteredSitters.map((sitter) => (
              <PlatformMarker
                key={sitter.id}
                coordinate={sitter.location}
                title={sitter.name}
                description={`₱${sitter.hourlyRate}/hr • ${sitter.isOnline ? 'Available' : 'Offline'}`}
                onPress={() => handleSitterPress(sitter.id)}
              >
                <View style={styles.markerContainer}>
                  <View style={[
                    styles.markerProfileImage,
                    { borderColor: sitter.isOnline ? '#10B981' : '#6B7280' }
                  ]}>
                    <Image 
                      source={getImageSource(sitter)} 
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                      }}
                      resizeMode="cover"
                      onError={(error) => {
                        console.log('❌ Map - Marker image failed to load:', error.nativeEvent.error);
                        console.log('❌ Map - Failed marker sitter:', sitter.name, getImageSource(sitter));
                      }}
                      onLoad={() => {
                        console.log('✅ Map - Marker image loaded successfully for:', sitter.name);
                      }}
                      defaultSource={require('../../assets/images/default-avatar.png')}
                      fadeDuration={0}
                    />
                  </View>
                  {sitter.isOnline && (
                    <View style={styles.onlinePulse} />
                  )}
                </View>
              </PlatformMarker>
            ))}
          </PlatformMap>
        )}
      </View>

      {/* Recenter button */}
      {Platform.OS !== 'web' && (
        <TouchableOpacity
          onPress={() => {
            const target = userRegion ?? initialRegion;
            // @ts-ignore - PlatformMap handles the ref internally
            mapRef.current?.animateToRegion?.(target, 600);
          }}
          style={{ position: 'absolute', right: 20, top: 160, backgroundColor: '#fff', borderRadius: 20, padding: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8 }}
        >
          <Ionicons name="locate" size={20} color="#333" />
        </TouchableOpacity>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, selectedFilter === 'all' && styles.activeFilterTab]}
          onPress={() => handleFilterPress('all')}
        >
          <Text style={[styles.filterTabText, selectedFilter === 'all' && styles.activeFilterTabText]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, selectedFilter === 'dogs' && styles.activeFilterTab]}
          onPress={() => handleFilterPress('dogs')}
        >
          <Text style={[styles.filterTabText, selectedFilter === 'dogs' && styles.activeFilterTabText]}>
            Dogs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, selectedFilter === 'cats' && styles.activeFilterTab]}
          onPress={() => handleFilterPress('cats')}
        >
          <Text style={[styles.filterTabText, selectedFilter === 'cats' && styles.activeFilterTabText]}>
            Cats
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sitters List */}
      <View style={styles.sittersContainer}>
        <Text style={styles.sittersTitle}>Nearby Pet Sitters</Text>
        {filteredSitters.length > 0 ? (
          filteredSitters.map((sitter) => (
            <TouchableOpacity key={sitter.id} style={styles.sitterCard} onPress={() => handleSitterPress(sitter.id)}>
              <View style={styles.avatarContainer}>
                <View style={[styles.onlineIndicator, { backgroundColor: sitter.isOnline ? '#10B981' : '#6B7280' }]} />
                <Image 
                  source={getImageSource(sitter)} 
                  style={styles.sitterAvatar}
                  onError={(error) => {
                    console.log('❌ Map - Sitter list image failed to load:', error.nativeEvent.error);
                    console.log('❌ Map - Failed sitter data:', {
                      sitterId: sitter.id,
                      sitterName: sitter.name,
                      profileImage: sitter.profileImage,
                      imageSource: sitter.imageSource,
                      images: sitter.images,
                      imageSourceResult: getImageSource(sitter)
                    });
                  }}
                  onLoad={() => {
                    console.log('✅ Map - Sitter list image loaded successfully for:', sitter.name);
                  }}
                  defaultSource={require('../../assets/images/default-avatar.png')}
                  resizeMode="cover"
                  fadeDuration={0}
                />
              </View>
              <View style={styles.sitterInfo}>
                <Text style={styles.sitterName}>{sitter.name}</Text>
                <Text style={styles.sitterLocation}>📍 {sitter.location.address}</Text>
                <View style={styles.sitterBadges}>
                  <View style={styles.badge}>
                    <Ionicons name="time" size={12} color="#F59E0B" />
                    <Text style={styles.badgeText}>{sitter.experience}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Ionicons name="paw" size={12} color="#10B981" />
                    <Text style={styles.badgeText}>{sitter.petTypes.join(', ')}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.sitterRate}>
                <Text style={styles.rateText}>₱{sitter.hourlyRate}</Text>
                <Text style={styles.rateUnit}>/hour</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="paw-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyStateTitle}>No Pet Sitters Available</Text>
            <Text style={styles.emptyStateText}>
              {currentLocation 
                ? "No pet sitters are currently available in your area. Try expanding your search radius or check back later."
                : "Enable location services to find nearby pet sitters."
              }
            </Text>
          </View>
        )}
      </View>

      {/* Sitter Profile Popup */}
      <SitterProfilePopup
        sitter={selectedSitter}
        visible={showProfilePopup}
        onClose={handleClosePopup}
        onMessage={handleMessage}
        onViewBadges={handleViewBadges}
        onViewCertificates={handleViewCertificates}
      />
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  filterButton: {
    padding: 5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggle3DButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  toggle3DButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  refreshButton: {
    padding: 5,
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 15,
    overflow: 'hidden',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ccc',
    marginTop: 20,
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 10,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  filterTab: {
    padding: 10,
  },
  activeFilterTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#F59E0B',
  },
  filterTabText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  activeFilterTabText: {
    color: '#F59E0B',
  },
  sittersContainer: {
    padding: 20,
  },
  sittersTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  sitterCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  sitterAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  sitterInfo: {
    flex: 1,
  },
  sitterName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  markerIcon: {
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 4,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  markerProfileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  onlinePulse: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  onlineIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 1,
  },
  sitterLocation: {
    fontSize: 14,
    color: '#666',
  },
  sitterBadges: {
    flexDirection: 'row',
    marginTop: 5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  badgeText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 5,
  },
  sitterRate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  rateUnit: {
    fontSize: 14,
    color: '#666',
  },
  locationStatus: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 10,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  locationStatusText: {
    marginLeft: 5,
    fontSize: 14,
    color: '#333',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  noLocationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noLocationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  noLocationText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default FindSitterMapScreen;