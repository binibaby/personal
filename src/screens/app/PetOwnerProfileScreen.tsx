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
import { useAuth } from '../../contexts/AuthContext';

const PetOwnerProfileScreen = () => {
  const router = useRouter();
  const { user, logout, updateUserProfile, refresh } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cooldownInfo, setCooldownInfo] = useState<any>(null);
  
  const [profileImage, setProfileImage] = useState<string | null>(user?.profileImage || null);
  const [imageError, setImageError] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageRetryCount, setImageRetryCount] = useState(0);
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
  });
  const [requestData, setRequestData] = useState<{
    firstName: string;
    lastName: string;
    phone: string;
    reason: string;
  }>({
    firstName: '',
    lastName: '',
    phone: '',
    reason: '',
  });

  // Update profile data when user changes
  useEffect(() => {
    if (user) {
      console.log('📱 PetOwnerProfileScreen: Updating profile data from user:', user);
      // Split name into firstName and lastName
      const nameParts = (user.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      setProfile({
        firstName: firstName,
        lastName: lastName,
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
      });
    }
  }, [user]);

  // Initialize request data when editing starts
  useEffect(() => {
    if (isEditing && user) {
      const nameParts = (user.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      setRequestData({
        firstName,
        lastName,
        phone: user.phone || '',
        reason: '',
      });
    }
  }, [isEditing, user]);

  // Check cooldown status when component loads
  useEffect(() => {
    if (user?.token) {
      checkCooldownStatus();
    }
  }, [user]);


  const handleBack = () => {
    router.back();
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
      
      console.log('PetOwnerProfileScreen: Submitting profile update request:', requestData);
      console.log('PetOwnerProfileScreen: User token:', user?.token);
      console.log('PetOwnerProfileScreen: User object:', user);
      
      const { submitProfileUpdateRequest } = await import('../../services/networkService');
      const response = await submitProfileUpdateRequest({
        firstName: requestData.firstName.trim(),
        lastName: requestData.lastName.trim(),
        phone: requestData.phone.trim(),
        hourlyRate: '',
        experience: '',
        reason: requestData.reason.trim(),
      }, user?.token || '', user?.role || 'pet_owner');
      
      console.log('PetOwnerProfileScreen: Profile update request response:', response);
      
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
              reason: '',
            });
            // Refresh cooldown status
            await checkCooldownStatus();
          } else {
            // Check if it's a cooldown error
            if (response.cooldown_info && response.cooldown_info.in_cooldown) {
              Alert.alert(
                'Profile Update Cooldown',
                response.message,
                [{ text: 'OK' }]
              );
            } else {
              Alert.alert('Error', response.message || 'Failed to submit request. Please try again.');
            }
          }
    } catch (error) {
      console.error('PetOwnerProfileScreen: Error submitting profile update request:', error);
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };


  const checkCooldownStatus = async () => {
    try {
      const { makeApiCall } = await import('../../services/networkService');
      const response = await makeApiCall('/api/profile/update-request/check-pending', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.token || ''}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.cooldown_info) {
          setCooldownInfo(data.cooldown_info);
        }
      }
    } catch (error) {
      console.error('Error checking cooldown status:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
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
          address: user.address || '',
        });
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
      Alert.alert('Error', 'Failed to refresh profile. Please try again.');
    } finally {
      setIsRefreshing(false);
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
    console.log('🔄 PetOwnerProfileScreen: useEffect triggered for profile image sync');
    console.log('🔄 PetOwnerProfileScreen: user.profileImage:', user?.profileImage);
    console.log('🔄 PetOwnerProfileScreen: current profileImage state:', profileImage);
    
    // Don't sync during upload to prevent blinking
    if (isUploadingImage) {
      console.log('⏳ PetOwnerProfileScreen: Skipping sync during upload');
      return;
    }
    
    if (user && user.profileImage && user.profileImage !== profileImage) {
      console.log('✅ PetOwnerProfileScreen: Updating profile image from user data:', user.profileImage);
      // Convert storage path to full URL if needed
      const fullUrl = user.profileImage.startsWith('http') ? user.profileImage : getFullImageUrl(user.profileImage);
      console.log('✅ PetOwnerProfileScreen: Converted to full URL:', fullUrl);
      setProfileImage(fullUrl);
      setImageError(false);
    } else if (!user?.profileImage && profileImage && !profileImage.startsWith('file://') && !profileImage.startsWith('content://')) {
      // Only clear if the current image is not a local file (camera/gallery pick)
      console.log('❌ PetOwnerProfileScreen: User has no profile image, clearing local state');
      setProfileImage(null);
      setImageError(false);
    } else {
      console.log('🔄 PetOwnerProfileScreen: Profile image already in sync');
    }
  }, [user?.profileImage, isUploadingImage]);

  // Also sync when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('🎯 PetOwnerProfileScreen: useFocusEffect triggered');
      if (user && user.profileImage) {
        console.log('✅ PetOwnerProfileScreen: Focus sync - updating profile image:', user.profileImage);
        setProfileImage(user.profileImage);
        setImageError(false);
      } else if (user && !user.profileImage) {
        console.log('❌ PetOwnerProfileScreen: Focus sync - no profile image in user data');
        setProfileImage(null);
        setImageError(false);
      }
    }, [user?.profileImage])
  );


  const pickProfileImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload a profile image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setProfileImage(imageUri);
        setImageError(false);
        await uploadProfileImage(imageUri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takeProfilePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera permissions to take a profile photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setProfileImage(imageUri);
        setImageError(false);
        await uploadProfileImage(imageUri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Camera Error', 'Failed to open camera. Please try again.');
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
        console.log('PetOwnerProfileScreen: Upload successful:', result.profile_image);
        console.log('PetOwnerProfileScreen: Backend response fields:');
        console.log('  - result.profile_image:', result.profile_image);
        console.log('  - result.full_url:', result.full_url);
        console.log('  - result.profile_image_url:', result.profile_image_url);
        
        // Use the full URL from backend response if available, otherwise generate it
        const fullImageUrl = result.full_url || result.profile_image_url || getFullImageUrl(result.profile_image);
        console.log('PetOwnerProfileScreen: Using full URL from backend:', fullImageUrl);
        
        // Update local state immediately for instant display
        setProfileImage(fullImageUrl);
        setImageError(false);
        
        // Update the user context with storage path for persistence
        await updateUserProfile({ profileImage: result.profile_image });
        console.log('PetOwnerProfileScreen: User context updated with storage path');
        
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

  const pickImage = async () => {
    Alert.alert(
      'Select Profile Image',
      'Choose how you want to add a profile image',
      [
        { text: 'Camera', onPress: takeProfilePhoto },
        { text: 'Photo Library', onPress: pickProfileImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.content}
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#3B82F6']}
              tintColor="#3B82F6"
            />
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={pickImage} style={styles.profileImageContainer}>
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
            <View style={styles.profileImageOverlay}>
              <Ionicons name="camera" size={20} color="#FFF" />
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{`${profile.firstName} ${profile.lastName}`.trim()}</Text>
            <Text style={styles.profileSubtitle}>Pet Owner</Text>
            <Text style={styles.locationText}>📍 {profile.address || 'No address set'}</Text>
          </View>
        </View>
        {/* Edit/Save Buttons */}
        <View style={styles.actionButtons}>
          {isEditing ? (
            <View style={styles.editButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, isSubmittingRequest && styles.disabledButton]} 
                onPress={handleSubmitProfileRequest}
                disabled={isSubmittingRequest}
              >
                <Text style={styles.saveButtonText}>
                  {isSubmittingRequest ? 'Submitting...' : 'Submit Request'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          {/* Cooldown Notice - Hidden */}
          {false && cooldownInfo && cooldownInfo.in_cooldown && (
            <View style={styles.cooldownNotice}>
              <Ionicons name="time-outline" size={20} color="#F59E0B" />
              <View style={styles.cooldownTextContainer}>
                <Text style={styles.cooldownTitle}>Profile Update Cooldown</Text>
                <Text style={styles.cooldownMessage}>
                  You cannot request profile changes for {cooldownInfo.days_remaining} more days. 
                  You can request changes again after {cooldownInfo.cooldown_ends_at}.
                </Text>
              </View>
            </View>
          )}
          {!isEditing ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>First Name</Text>
                <Text style={[styles.input, styles.disabledInput]}>{profile.firstName}</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <Text style={[styles.input, styles.disabledInput]}>{profile.lastName}</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <Text style={[styles.input, styles.disabledInput]}>{profile.email}</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone</Text>
                <Text style={[styles.input, styles.disabledInput]}>{profile.phone}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>First Name *</Text>
                <TextInput
                  style={styles.input}
                  value={requestData.firstName}
                  onChangeText={(text) => setRequestData({...requestData, firstName: text})}
                  placeholder="Enter your first name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Last Name *</Text>
                <TextInput
                  style={styles.input}
                  value={requestData.lastName}
                  onChangeText={(text) => setRequestData({...requestData, lastName: text})}
                  placeholder="Enter your last name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={requestData.phone}
                  onChangeText={(text) => setRequestData({...requestData, phone: text})}
                  placeholder="Enter your phone number"
                  keyboardType="phone-pad"
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
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Address</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={profile.address}
              editable={false}
              selectTextOnFocus={false}
              pointerEvents="none"
              placeholder="Address auto-detected"
              multiline
            />
          </View>
        </View>
        {/* My Pets Navigation */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/my-pets')}>
            <Ionicons name="paw" size={24} color="#F59E0B" />
            <Text style={styles.actionText}>My Pets</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/pet-owner-jobs')}>
            <Ionicons name="briefcase-outline" size={24} color="#F59E0B" />
            <Text style={styles.actionText}>My Bookings</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/pet-owner-messages')}>
            <Ionicons name="chatbubbles-outline" size={24} color="#4CAF50" />
            <Text style={styles.actionText}>Messages</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/find-sitter-map')}>
            <Ionicons name="map-outline" size={24} color="#3B82F6" />
            <Text style={styles.actionText}>Find Pet Sitters</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/emergency')}>
            <Ionicons name="warning-outline" size={24} color="#EF4444" />
            <Text style={styles.actionText}>Emergency</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>
        
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
  profileImageContainer: {
    position: 'relative',
    marginRight: 15,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileImageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#F59E0B',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
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
  profileSubtitle: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
    marginBottom: 5,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
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
  disabledButton: {
    opacity: 0.6,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  cooldownNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  cooldownTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  cooldownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  cooldownMessage: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  addButton: {
    padding: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
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
  disabledInput: {
    backgroundColor: '#F8F9FA',
    color: '#666',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  // New styles for inline colors and margins
  colorFF4444: {
    color: '#FF4444',
  },
  marginRight15: {
    marginRight: 15,
  },
  colorF59E0B: {
    color: '#F59E0B',
  },
  color4CAF50: {
    color: '#4CAF50',
  },
  color3B82F6: {
    color: '#3B82F6',
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

export default PetOwnerProfileScreen; 