import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    Modal,
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
import verificationService from '../../services/verificationService';

type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'not_submitted' | 'open' | 'in_progress' | 'resolved' | 'closed';

interface VerificationData {
  id?: string;
  status: VerificationStatus;
  document_type: string;
  is_philippine_id: boolean;
  submitted_at?: string;
  verified_at?: string;
  rejection_reason?: string;
  notes?: string;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earned_at?: string;
}

interface VerificationScreenNavigationProp {
  goBack: () => void;
}

const VerificationScreen = () => {
  const navigation = useNavigation<VerificationScreenNavigationProp>();
  const router = useRouter();
  const { user } = useAuth();
  const [verification, setVerification] = useState<VerificationData | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Email verification
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  
  // Phone verification
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  
  // ID verification
  const [showIdVerification, setShowIdVerification] = useState(false);
  const [selectedIdType, setSelectedIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idImage, setIdImage] = useState<string | null>(null);
  
  const [philippineIdTypes, setPhilippineIdTypes] = useState([
    { type: 'ph_national_id', name: 'Philippine National ID', pattern: /^\d{4}-\d{7}-\d{1}$/, placeholder: '1234-5678901-2' },
    { type: 'ph_drivers_license', name: "Philippine Driver's License", pattern: /^[A-Z]\d{2}-\d{2}-\d{6}$/, placeholder: 'A12-34-567890' },
    { type: 'sss_id', name: 'SSS ID', pattern: /^\d{2}-\d{7}-\d{1}$/, placeholder: '12-3456789-0' },
    { type: 'philhealth_id', name: 'PhilHealth ID', pattern: /^\d{2}-\d{9}-\d{1}$/, placeholder: '12-345678901-2' },
    { type: 'tin_id', name: 'TIN ID', pattern: /^\d{3}-\d{3}-\d{3}-\d{3}$/, placeholder: '123-456-789-000' },
    { type: 'postal_id', name: 'Postal ID', pattern: /^[A-Z]{3}\d{7}$/, placeholder: 'ABC1234567' },
    { type: 'voters_id', name: "Voter's ID", pattern: /^\d{4}-\d{4}-\d{4}-\d{4}$/, placeholder: '1234-5678-9012-3456' },
    { type: 'prc_id', name: 'PRC ID', pattern: /^\d{7}$/, placeholder: '1234567' },
    { type: 'umid', name: 'UMID', pattern: /^\d{4}-\d{7}-\d{1}$/, placeholder: '1234-5678901-2' },
    { type: 'owwa_id', name: 'OWWA ID', pattern: /^[A-Z]{2}\d{8}$/, placeholder: 'AB12345678' },
  ]);

  useEffect(() => {
    loadVerificationData();
    loadPhilippineIdTypes();
  }, []);

  const loadPhilippineIdTypes = async () => {
    try {
      const response = await verificationService.getPhilippineIdTypes();
      if (response.success) {
        // Convert the response to match our local format
        const formattedTypes = response.philippine_ids.map(id => ({
          type: id.type,
          name: id.name,
          pattern: new RegExp(id.pattern),
          placeholder: id.placeholder
        }));
        setPhilippineIdTypes(formattedTypes);
      }
    } catch (error) {
      console.log('Failed to load Philippine ID types, using defaults:', error);
      // Keep the default types if API fails
    }
  };

  const loadVerificationData = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const response = await verificationService.getVerificationStatusFromAPI();
      
      if (response.success) {
        // Set email and phone verification status from user data
        setEmailVerified(user.email_verified || false);
        setPhoneVerified(user.phone_verified || false);
        
        if (response.verification) {
          // Restore existing verification data including ID image
          setVerification({
            status: response.verification.status as VerificationStatus,
            document_type: response.verification.document_type,
            is_philippine_id: response.verification.is_philippine_id,
            submitted_at: response.verification.submitted_at,
            verified_at: response.verification.verified_at,
            rejection_reason: response.verification.rejection_reason,
            notes: response.verification.notes,
          });
          
          // Restore ID data if exists
          if (response.verification.document_type) {
            setSelectedIdType(response.verification.document_type);
          }
          if (response.verification.document_number) {
            setIdNumber(response.verification.document_number);
          }
          if (response.verification.document_image) {
            setIdImage(response.verification.document_image);
          }

          // Check if this is a Veriff verification and get session status
          if (response.verification.status === 'pending') {
            try {
              const sessionResponse = await verificationService.getVerificationSessionStatus();
              if (sessionResponse.success && sessionResponse.session_status) {
                // Update verification status based on Veriff session
                const veriffStatus = sessionResponse.session_status.verification?.status;
                if (veriffStatus === 'approved') {
                  setVerification(prev => ({
                    ...prev!,
                    status: 'approved',
                    verified_at: new Date().toISOString(),
                  }));
                } else if (veriffStatus === 'declined') {
                  setVerification(prev => ({
                    ...prev!,
                    status: 'rejected',
                    rejection_reason: 'Verification was declined by Veriff',
                  }));
                }
              }
            } catch (sessionError) {
              console.log('Session status check failed:', sessionError);
              // Continue with existing verification status
            }
          }
        } else {
          // No verification submitted yet
          setVerification({
            status: 'not_submitted',
            document_type: '',
            is_philippine_id: false,
          });
        }
        
        setBadges(response.badges || []);
      }
    } catch (error) {
      console.error('Error loading verification data:', error);
      Alert.alert('Error', 'Failed to load verification data');
      
      // Fallback to mock data
      setEmailVerified(user.email_verified || false);
      setPhoneVerified(user.phone_verified || false);
      setVerification({
        status: 'not_submitted',
        document_type: '',
        is_philippine_id: false,
      });
      setBadges([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadVerificationData();
    setRefreshing(false);
  };

  const verifyEmail = async () => {
    if (!emailCode || emailCode.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit code');
      return;
    }

    try {
      // In a real app, call the API
      // await fetch('/api/auth/verify-email', {
      //   method: 'POST',
      //   headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ verification_code: emailCode })
      // });
      
      setEmailVerified(true);
      setShowEmailVerification(false);
      setEmailCode('');
      Alert.alert('Success', 'Email verified successfully!');
    } catch (error) {
      Alert.alert('Error', 'Invalid verification code');
    }
  };

  const verifyPhone = async () => {
    if (!phoneCode) {
      Alert.alert('Error', 'Please enter a verification code');
      return;
    }

    // Normalize the code: trim whitespace and remove any non-digit characters
    const normalizedCode = phoneCode.trim().replace(/[^0-9]/g, '');
    
    if (normalizedCode.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit code');
      return;
    }

    try {
      // Show loading notification
      Alert.alert('Verifying Phone', 'Please wait while we verify your phone number...');
      
      // Call the real API
      const { makeApiCall } = await import('../../services/networkService');
      const response = await makeApiCall('/api/verify-phone-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: user?.phone,
          code: normalizedCode,
        }),
      });

      if (response && response.ok) {
        const data = await response.json();
        
        if (data.success) {
          // Show success notification
          Alert.alert(
            'Phone Verified Successfully! 🎉', 
            'Your phone number has been verified. You can now use all features of the app.',
            [
              {
                text: 'OK',
                onPress: () => {
                  // Update local state
                  setPhoneVerified(true);
                  setShowPhoneVerification(false);
                  setPhoneCode('');
                  
                  // Navigate to dashboard
                  router.push('/pet-owner-dashboard');
                }
              }
            ]
          );
        } else {
          Alert.alert('Error', data.message || 'Invalid verification code');
        }
      } else {
        const errorData = await response?.json();
        Alert.alert('Error', errorData?.message || 'Failed to verify phone number');
      }
    } catch (error) {
      console.error('Phone verification error:', error);
      Alert.alert('Error', 'Failed to verify phone number. Please try again.');
    }
  };

  const resendCode = async (type: 'email' | 'phone') => {
    try {
      // Call the resend verification code API
      const { makeApiCall } = await import('../../services/networkService');
      const response = await makeApiCall('/api/resend-verification-code', {
        method: 'POST',
        headers: {},
        body: JSON.stringify({
          type: type
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to resend verification code');
      }

      const data = await response.json();
      
      // Show the verification code in the alert for easy access
      const code = data.debug_code || 'Check logs for code';
      Alert.alert(
        'Verification Code Sent', 
        `Code: ${code}\n\nUse this code to verify your ${type}`,
        [
          {
            text: 'Copy Code',
            onPress: () => {
              // In a real app, you would copy to clipboard
              Alert.alert('Code Copied', `Code ${code} copied to clipboard`);
            }
          },
          {
            text: 'OK',
            style: 'cancel'
          }
        ]
      );
      
      // Reload verification data to get updated status
      await loadVerificationData();
    } catch (error) {
      console.error('Resend code error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send verification code');
    }
  };

  const validateIdNumber = (type: string, number: string) => {
    const idType = philippineIdTypes.find(id => id.type === type);
    if (!idType) return false;
    return idType.pattern.test(number);
  };

  const pickIdImage = async () => {
    // Request camera permissions first
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    
    if (cameraPermission.granted === false) {
      Alert.alert("Camera Permission Required", "Please allow camera access to take ID photos.");
      return;
    }

    try {
      // Force camera mode with explicit settings
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 2],
        quality: 0.8,
        cameraType: ImagePicker.CameraType.back,
        allowsMultipleSelection: false,
        selectionLimit: 1,
        presentationStyle: Platform.OS === 'ios' ? ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN : undefined,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIdImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Camera Error', 'Failed to open camera. Please try again.');
    }
  };

  const submitIdVerification = async () => {
    if (!selectedIdType || !idImage) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      // Show loading state
      Alert.alert('Submitting Verification', 'Please wait while we process your ID verification...');
      
      // Call the API to submit verification
      const response = await verificationService.submitVerification({
        document_type: selectedIdType,
        document_image: idImage,
      });
      
      if (response.veriff_enabled && response.verification_url) {
        // Veriff is enabled - show verification URL
        Alert.alert(
          'Verification Session Created',
          'Please complete your verification by clicking the link below.',
          [
            {
              text: 'Open Verification',
              onPress: () => {
                // In a real app, you would open the verification URL
                // For now, we'll just show a success message
                Alert.alert('Verification Link', `Verification URL: ${response.verification_url}`);
              }
            },
            {
              text: 'OK',
              style: 'cancel'
            }
          ]
        );
      } else {
        // Fallback to manual verification
        Alert.alert('Verification Submitted!', 'Your ID verification has been submitted for admin review. You will be notified within 24 hours of the admin\'s decision. You cannot start jobs until your verification is approved.');
      }
      
      // Update local state
      setVerification({
        status: 'pending',
        document_type: selectedIdType,
        is_philippine_id: true,
        submitted_at: new Date().toISOString(),
      });
      
      setShowIdVerification(false);
      
      // Reload verification data to get updated status
      await loadVerificationData();
    } catch (error) {
      console.error('Verification submission error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to submit verification');
    }
  };

  const getStatusColor = (status: VerificationStatus) => {
    switch (status) {
      case 'approved': return '#10B981';
      case 'rejected': return '#EF4444';
      case 'pending': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status: VerificationStatus) => {
    switch (status) {
      case 'approved': return 'checkmark-circle';
      case 'rejected': return 'close-circle';
      case 'pending': return 'time';
      default: return 'help-circle';
    }
  };

  const canAcceptBookings = emailVerified && phoneVerified && verification?.status === 'approved';

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading verification data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification Center</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Overall Status */}
          <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Account Status</Text>
          <View style={styles.statusBadge}>
            <Ionicons 
              name={canAcceptBookings ? "checkmark-circle" : "time"} 
              size={20} 
              color={canAcceptBookings ? "#10B981" : "#F59E0B"} 
            />
            <Text style={[styles.statusText, { color: canAcceptBookings ? "#10B981" : "#F59E0B" }]}>
              {canAcceptBookings ? "Verified & Active" : "Verification Required"}
            </Text>
          </View>
          {!canAcceptBookings && (
            <Text style={styles.statusDescription}>
              Complete all verification steps to start accepting bookings
            </Text>
          )}
        </View>

        {/* Email Verification */}
        <View style={styles.verificationCard}>
          <View style={styles.verificationHeader}>
            <Ionicons 
              name={emailVerified ? "checkmark-circle" : "mail-outline"} 
              size={24} 
              color={emailVerified ? "#10B981" : "#F59E0B"} 
            />
            <View style={styles.verificationInfo}>
              <Text style={styles.verificationTitle}>Email Verification</Text>
              <Text style={styles.verificationSubtitle}>
                {emailVerified ? "Verified" : "Required"}
              </Text>
            </View>
            {!emailVerified && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => setShowEmailVerification(true)}
              >
                <Text style={styles.actionButtonText}>Verify</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Phone Verification */}
        {user?.phone && (
          <View style={styles.verificationCard}>
            <View style={styles.verificationHeader}>
              <Ionicons
                name={phoneVerified ? "checkmark-circle" : "call-outline"} 
                size={24} 
                color={phoneVerified ? "#10B981" : "#F59E0B"} 
              />
              <View style={styles.verificationInfo}>
                <Text style={styles.verificationTitle}>Phone Verification</Text>
                <Text style={styles.verificationSubtitle}>
                  {phoneVerified ? "Verified" : "Required"}
                </Text>
              </View>
              {!phoneVerified && (
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => setShowPhoneVerification(true)}
                >
                  <Text style={styles.actionButtonText}>Verify</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ID Verification (Pet Sitters Only) */}
        {user?.role === 'pet_sitter' && (
          <View style={styles.verificationCard}>
            <View style={styles.verificationHeader}>
              <Ionicons 
                name={getStatusIcon(verification?.status || 'not_submitted')} 
                size={24} 
                color={getStatusColor(verification?.status || 'not_submitted')} 
              />
              <View style={styles.verificationInfo}>
                <Text style={styles.verificationTitle}>ID Verification</Text>
                <Text style={styles.verificationSubtitle}>
                  {verification?.status === 'approved' ? 'Approved' :
                   verification?.status === 'pending' ? 'Under Review' :
                   verification?.status === 'rejected' ? 'Rejected' : 'Required'}
                </Text>
              </View>
              {verification?.status !== 'approved' && verification?.status !== 'pending' && (
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => setShowIdVerification(true)}
                >
                  <Text style={styles.actionButtonText}>
                    {verification?.status === 'rejected' ? 'Retry' : 'Submit'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            
            {/* Display submitted ID details if verification exists */}
            {verification && verification.status !== 'not_submitted' && (
              <View style={styles.submittedVerificationDetails}>
                {verification.document_type && (
                  <Text style={styles.verificationDetail}>
                    Document Type: {philippineIdTypes.find(id => id.type === verification.document_type)?.name || verification.document_type}
                  </Text>
                )}
                
                {verification.submitted_at && (
                  <Text style={styles.verificationDetail}>
                    Submitted: {new Date(verification.submitted_at).toLocaleDateString()}
                  </Text>
                )}
                
                {verification.verified_at && (
                  <Text style={styles.verificationDetail}>
                    Reviewed: {new Date(verification.verified_at).toLocaleDateString()}
                  </Text>
                )}

                {/* Veriff Status Indicator */}
                {verification.status === 'pending' && (
                  <View style={styles.veriffStatusContainer}>
                    <Ionicons name="sync" size={16} color="#F59E0B" />
                    <Text style={styles.veriffStatusText}>
                      Veriff verification in progress...
                    </Text>
                  </View>
                )}

                {/* Display ID image if it exists */}
                {idImage && (
                  <View style={styles.submittedIdContainer}>
                    <Text style={styles.submittedIdLabel}>Submitted ID Document:</Text>
                    <Image source={{ uri: idImage }} style={styles.submittedIdImage} />
                    <Text style={styles.submittedIdNote}>
                      {verification.status === 'approved' && '✓ Document verified successfully'}
                      {verification.status === 'pending' && '⏳ Document under review'}
                      {verification.status === 'rejected' && '✗ Document requires resubmission'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {verification?.rejection_reason && (
              <View style={styles.rejectionBox}>
                <Text style={styles.rejectionTitle}>Rejection Reason:</Text>
                <Text style={styles.rejectionText}>{verification.rejection_reason}</Text>
              </View>
            )}
          </View>
        )}

        {/* Badges Section */}
        {badges.length > 0 && (
          <View style={styles.badgesSection}>
            <Text style={styles.sectionTitle}>Your Badges</Text>
            <FlatList
              data={badges}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={[styles.badgeCard, { borderColor: item.color }]}>
                  <View style={[styles.badgeIcon, { backgroundColor: item.color }]}>
                    <Ionicons name={item.icon as any} size={24} color="#fff" />
                  </View>
                  <Text style={styles.badgeName}>{item.name}</Text>
                  <Text style={styles.badgeDescription}>{item.description}</Text>
                </View>
              )}
            />
          </View>
        )}
      </ScrollView>

      {/* Email Verification Modal */}
      <Modal visible={showEmailVerification} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verify Email</Text>
            <Text style={styles.modalDescription}>
              Enter the 6-digit code sent to your email
            </Text>
            
            <TextInput
              style={styles.codeInput}
              placeholder="000000"
              value={emailCode}
              onChangeText={setEmailCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.resendButton}
                onPress={() => resendCode('email')}
              >
                <Text style={styles.resendButtonText}>Resend Code</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.verifyButton}
                onPress={verifyEmail}
              >
                <Text style={styles.verifyButtonText}>Verify</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowEmailVerification(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Phone Verification Modal */}
      <Modal visible={showPhoneVerification} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verify Phone</Text>
            <Text style={styles.modalDescription}>
              Enter the 6-digit code sent to your phone
            </Text>
            
            <TextInput
              style={styles.codeInput}
              placeholder="000000"
              value={phoneCode}
              onChangeText={setPhoneCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.resendButton}
                onPress={() => resendCode('phone')}
              >
                <Text style={styles.resendButtonText}>Resend Code</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.verifyButton}
                onPress={verifyPhone}
              >
                <Text style={styles.verifyButtonText}>Verify</Text>
              </TouchableOpacity>
                </View>
            
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowPhoneVerification(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ID Verification Modal */}
      <Modal visible={showIdVerification} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Philippine ID Verification</Text>
              <Text style={styles.modalDescription}>
                Select your ID type and provide the required information
              </Text>

              <Text style={styles.fieldLabel}>Select ID Type:</Text>
              {philippineIdTypes.map((id) => (
                <TouchableOpacity 
                  key={id.type} 
                  style={[styles.idTypeButton, selectedIdType === id.type && styles.selectedIdType]}
                  onPress={() => setSelectedIdType(id.type)}
                >
                  <Text style={[styles.idTypeName, selectedIdType === id.type && styles.selectedIdTypeName]}>
                    {id.name}
                  </Text>
                  {selectedIdType === id.type && (
                    <Ionicons name="checkmark" size={20} color="#10B981" />
                  )}
                </TouchableOpacity>
              ))}

              {selectedIdType && (
                <>
                  <Text style={styles.fieldLabel}>Capture ID Photo:</Text>
                  <TouchableOpacity style={styles.uploadButton} onPress={pickIdImage}>
                    <Ionicons name="camera" size={24} color="#F59E0B" />
                    <Text style={styles.uploadButtonText}>
                      {idImage ? 'Capture Again' : 'Open Camera to Capture'}
                    </Text>
                  </TouchableOpacity>

                  {idImage && (
                    <Image source={{ uri: idImage }} style={styles.idPreview} />
                  )}
                </>
        )}
      </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setShowIdVerification(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.verifyButton, (!selectedIdType || !idImage) && styles.disabledButton]}
                onPress={submitIdVerification}
                disabled={!selectedIdType || !idImage}
              >
                <Text style={styles.verifyButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    backgroundColor: '#fff',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  statusDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  verificationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  verificationInfo: {
    flex: 1,
    marginLeft: 10,
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  verificationSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  actionButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectionBox: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  rejectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  rejectionText: {
    fontSize: 13,
    color: '#666',
  },
  badgesSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  badgeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#f0f0f0',
    width: 150,
    alignItems: 'center',
  },
  badgeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  badgeDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 25,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  codeInput: {
    width: '100%',
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
  resendButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  resendButtonText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '600',
  },
  verifyButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 15,
    marginBottom: 5,
  },
  idTypeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedIdType: {
    borderColor: '#F59E0B',
    borderWidth: 2,
  },
  idTypeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  selectedIdTypeName: {
    color: '#F59E0B',
  },
  idInput: {
    width: '100%',
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
    marginBottom: 15,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 5,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginTop: 10,
    marginBottom: 15,
  },
  uploadButtonText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
  },
  idPreview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginTop: 10,
  },
  submittedVerificationDetails: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  verificationDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  submittedIdContainer: {
    marginTop: 15,
    alignItems: 'center',
  },
  submittedIdLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  submittedIdImage: {
    width: 280,
    height: 180,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    resizeMode: 'cover',
    marginBottom: 10,
  },
  submittedIdNote: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  veriffStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FFEAA7',
  },
  veriffStatusText: {
    fontSize: 12,
    color: '#856404',
    marginLeft: 8,
    fontWeight: '500',
  },
});

export default VerificationScreen; 