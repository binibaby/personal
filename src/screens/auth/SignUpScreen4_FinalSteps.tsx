import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface SignUpScreen4_FinalStepsProps {
  userRole: 'Pet Owner' | 'Pet Sitter';
  selectedPetTypes: ('dogs' | 'cats')[];
  selectedBreeds: string[];
  onComplete: (user: any) => void;
  onBack?: () => void;
}

const SignUpScreen4_FinalSteps: React.FC<SignUpScreen4_FinalStepsProps> = ({ 
  userRole, 
  selectedPetTypes, 
  selectedBreeds, 
  onComplete, 
  onBack 
}) => {
  // Debug logging
  console.log('SignUpScreen4_FinalSteps - userRole:', userRole);
  console.log('SignUpScreen4_FinalSteps - isPetSitter:', userRole === 'Pet Sitter');
  console.log('SignUpScreen4_FinalSteps - selectedPetTypes:', selectedPetTypes);
  console.log('SignUpScreen4_FinalSteps - selectedPetTypes length:', selectedPetTypes?.length);
  console.log('SignUpScreen4_FinalSteps - selectedPetTypes type:', typeof selectedPetTypes);
  console.log('SignUpScreen4_FinalSteps - selectedBreeds:', selectedBreeds);
  console.log('SignUpScreen4_FinalSteps - selectedBreeds length:', selectedBreeds?.length);
  console.log('SignUpScreen4_FinalSteps - selectedBreeds type:', typeof selectedBreeds);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('other');
  const [address, setAddress] = useState('');
  const [experience, setExperience] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [maxPets, setMaxPets] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');
  const [showPassword, setShowPassword] = useState(true);
  const [showConfirmPassword, setShowConfirmPassword] = useState(true);

  const checkPasswordStrength = (password: string) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    if (score <= 2) return 'weak';
    if (score <= 3) return 'medium';
    return 'strong';
  };

  const getPasswordStrengthColor = (strength: string) => {
    switch (strength) {
      case 'weak': return '#FF6B6B';
      case 'medium': return '#FFA726';
      case 'strong': return '#4CAF50';
      default: return '#FF6B6B';
    }
  };

  const getPasswordStrengthText = (strength: string) => {
    switch (strength) {
      case 'weak': return 'Weak';
      case 'medium': return 'Medium';
      case 'strong': return 'Strong';
      default: return 'Weak';
    }
  };

  const isFormValid = () => {
    const baseValidation = firstName.trim() && 
           lastName.trim() && 
           email.trim() && 
           password.trim() && 
           confirmPassword.trim() && 
           phone.trim() && 
           age.trim() && 
           address.trim() &&
           password === confirmPassword &&
           password.length >= 8;
    
    // For pet sitters, also require experience, hourlyRate, and maxPets
    if (userRole === 'Pet Sitter') {
      const maxPetsNum = parseInt(maxPets);
      return baseValidation && 
             experience.trim() && 
             hourlyRate.trim() && 
             maxPets.trim() && 
             maxPetsNum >= 1 && 
             maxPetsNum <= 10;
    }
    
    return baseValidation;
  };

  const handleComplete = async () => {
    console.log('Step 4 - Final registration data:', { firstName, lastName, email, phone, age, gender, address });
    
    if (!isFormValid()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (parseInt(age) < 1 || parseInt(age) > 120) {
      Alert.alert('Error', 'Please enter a valid age (1-120)');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const user = {
        firstName,
        lastName,
        email,
        password,
        phone,
        age: parseInt(age),
        address,
        gender,
        userRole,
        selectedPetTypes,
        selectedBreeds,
        experience: userRole === 'Pet Sitter' ? experience : '',
        hourlyRate: userRole === 'Pet Sitter' ? hourlyRate : '',
        maxPets: userRole === 'Pet Sitter' ? parseInt(maxPets) || 10 : null,
        specialties: userRole === 'Pet Sitter' ? specialties : [],
        aboutMe: '',
        isVerified: false,
        verificationPending: userRole === 'Pet Sitter',
        createdAt: new Date().toISOString(),
      };

      console.log('🚀 SignUpScreen4_FinalSteps: User object created:', user);
      console.log('🚀 SignUpScreen4_FinalSteps: userRole:', userRole);
      console.log('🚀 SignUpScreen4_FinalSteps: isPetSitter:', userRole === 'Pet Sitter');
      console.log('🚀 SignUpScreen4_FinalSteps: user.selectedPetTypes:', user.selectedPetTypes);
      console.log('🚀 SignUpScreen4_FinalSteps: user.selectedBreeds:', user.selectedBreeds);
      console.log('🚀 SignUpScreen4_FinalSteps: selectedPetTypes prop:', selectedPetTypes);
      console.log('🚀 SignUpScreen4_FinalSteps: selectedBreeds prop:', selectedBreeds);

      onComplete(user);
    } catch (error) {
      Alert.alert('Registration Failed', 'Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
      )}
      <Text style={styles.progressText}>4/4</Text>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 10}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
        <View style={styles.headerSection}>
          <View style={styles.iconContainer}>
            <Image source={require('../../assets/images/logo.png')} style={styles.logoImage} />
          </View>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.description}>
            Please provide your personal information and create your login credentials to complete your registration.
          </Text>
        </View>

        {/* Selection Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Your Selections</Text>
          
          {/* Pet Types Summary */}
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Pet Types:</Text>
            <View style={styles.summaryChips}>
              {selectedPetTypes && selectedPetTypes.length > 0 ? (
                selectedPetTypes.map((petType, index) => (
                  <View key={index} style={styles.summaryChip}>
                    <Text style={styles.summaryChipText}>
                      {petType === 'dogs' ? 'Dogs' : 'Cats'}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.summaryEmpty}>No pet types selected</Text>
              )}
            </View>
          </View>

          {/* Pet Breeds Summary */}
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Pet Breeds:</Text>
            <View style={styles.summaryChips}>
              {selectedBreeds && selectedBreeds.length > 0 ? (
                selectedBreeds.map((breed, index) => (
                  <View key={index} style={styles.summaryChip}>
                    <Text style={styles.summaryChipText}>{breed}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.summaryEmpty}>No breeds selected</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.formSection}>
          <View style={styles.formGroup}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>First Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your first name"
                placeholderTextColor="#999"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Last Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your last name"
                placeholderTextColor="#999"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your phone number (e.g., 09123456789)"
                placeholderTextColor="#999"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Age *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your age"
                placeholderTextColor="#999"
                value={age}
                onChangeText={setAge}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Gender *</Text>
              <View style={styles.genderContainer}>
                <TouchableOpacity
                  style={[styles.genderButton, gender === 'male' && styles.genderButtonActive]}
                  onPress={() => setGender('male')}
                >
                  <Ionicons 
                    name="male" 
                    size={20} 
                    color={gender === 'male' ? '#fff' : '#666'} 
                  />
                  <Text style={[styles.genderButtonText, gender === 'male' && styles.genderButtonTextActive]}>
                    Male
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.genderButton, gender === 'female' && styles.genderButtonActive]}
                  onPress={() => setGender('female')}
                >
                  <Ionicons 
                    name="female" 
                    size={20} 
                    color={gender === 'female' ? '#fff' : '#666'} 
                  />
                  <Text style={[styles.genderButtonText, gender === 'female' && styles.genderButtonTextActive]}>
                    Female
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.genderButton, gender === 'other' && styles.genderButtonActive]}
                  onPress={() => setGender('other')}
                >
                  <Ionicons 
                    name="person" 
                    size={20} 
                    color={gender === 'other' ? '#fff' : '#666'} 
                  />
                  <Text style={[styles.genderButtonText, gender === 'other' && styles.genderButtonTextActive]}>
                    Other
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Address *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter your address"
                placeholderTextColor="#999"
                value={address}
                onChangeText={setAddress}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Pet Sitter Specific Fields */}
            {userRole === 'Pet Sitter' && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={[styles.label, { color: '#F59E0B', fontSize: 18, fontWeight: 'bold' }]}>🐾 Pet Sitter Information</Text>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Years of Experience *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 3, 1.5, 0.5"
                    placeholderTextColor="#999"
                    value={experience}
                    onChangeText={setExperience}
                    keyboardType="numeric"
                  />
                  {userRole === 'Pet Sitter' && experience.length === 0 && (
                    <Text style={styles.errorText}>Experience is required for pet sitters</Text>
                  )}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Hourly Rate (₱) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 150, 200, 300"
                    placeholderTextColor="#999"
                    value={hourlyRate}
                    onChangeText={setHourlyRate}
                    keyboardType="numeric"
                  />
                  {userRole === 'Pet Sitter' && hourlyRate.length === 0 && (
                    <Text style={styles.errorText}>Hourly rate is required for pet sitters</Text>
                  )}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Maximum Pets *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 1, 5, 10"
                    placeholderTextColor="#999"
                    value={maxPets}
                    onChangeText={(text) => {
                      // Only allow numbers 1-10
                      const num = parseInt(text);
                      if (text === '' || (num >= 1 && num <= 10)) {
                        setMaxPets(text);
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                  <Text style={styles.helperText}>Maximum number of pets you can care for at once (1-10)</Text>
                  {userRole === 'Pet Sitter' && (!maxPets || parseInt(maxPets) < 1 || parseInt(maxPets) > 10) && (
                    <Text style={styles.errorText}>Please enter a number between 1 and 10</Text>
                  )}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Specialties</Text>
                  <View style={styles.specialtiesContainer}>
                    {specialties.map((specialty, index) => (
                      <View key={index} style={styles.specialtyTag}>
                        <Text style={styles.specialtyText}>{specialty}</Text>
                        <TouchableOpacity
                          style={styles.removeSpecialtyButton}
                          onPress={() => setSpecialties(specialties.filter((_, i) => i !== index))}
                        >
                          <Ionicons name="close" size={16} color="#666" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                  <View style={styles.addSpecialtyContainer}>
                    <TextInput
                      style={styles.specialtyInput}
                      placeholder="Add a specialty (e.g., Dog training, Cat care, Overnight sitting)"
                      placeholderTextColor="#999"
                      value={newSpecialty}
                      onChangeText={setNewSpecialty}
                      onSubmitEditing={() => {
                        if (newSpecialty.trim()) {
                          setSpecialties([...specialties, newSpecialty.trim()]);
                          setNewSpecialty('');
                        }
                      }}
                    />
                    <TouchableOpacity
                      style={[styles.addSpecialtyButton, !newSpecialty.trim() && styles.disabledAddButton]}
                      onPress={() => {
                        if (newSpecialty.trim()) {
                          setSpecialties([...specialties, newSpecialty.trim()]);
                          setNewSpecialty('');
                        }
                      }}
                      disabled={!newSpecialty.trim()}
                    >
                      <Ionicons name="add" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

          </View>

          <View style={styles.formGroup}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email address"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Create a password (min. 8 characters)"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setPasswordStrength(checkPasswordStrength(text));
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="none"
                  spellCheck={false}
                  editable={true}
                  contextMenuHidden={true}
                  dataDetectorTypes="none"
                  caretHidden={false}
                  returnKeyType="done"
                  blurOnSubmit={true}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons 
                    name={showPassword ? "eye-off" : "eye"} 
                    size={20} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>
              
              {password.length > 0 && (
                <View style={styles.passwordStrengthContainer}>
                  <View style={styles.strengthBar}>
                    <View 
                      style={[
                        styles.strengthFill, 
                        { 
                          width: `${passwordStrength === 'weak' ? 33 : passwordStrength === 'medium' ? 66 : 100}%`,
                          backgroundColor: getPasswordStrengthColor(passwordStrength)
                        }
                      ]} 
                    />
                  </View>
                  <Text style={[
                    styles.strengthText, 
                    { color: getPasswordStrengthColor(passwordStrength) }
                  ]}>
                    {getPasswordStrengthText(passwordStrength)}
                  </Text>
                  
                  <View style={styles.requirementsContainer}>
                    <Text style={styles.requirementsTitle}>Password Requirements:</Text>
                    {password.length < 8 && (
                      <Text style={styles.requirementText}>
                        • At least 8 characters
                      </Text>
                    )}
                    {!/[a-z]/.test(password) && (
                      <Text style={styles.requirementText}>
                        • Lowercase letter
                      </Text>
                    )}
                    {!/[A-Z]/.test(password) && (
                      <Text style={styles.requirementText}>
                        • Uppercase letter
                      </Text>
                    )}
                    {!/[0-9]/.test(password) && (
                      <Text style={styles.requirementText}>
                        • Number
                      </Text>
                    )}
                    {!/[^A-Za-z0-9]/.test(password) && (
                      <Text style={styles.requirementText}>
                        • Special character
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  ref={confirmPasswordRef}
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Confirm your password"
                  placeholderTextColor="#999"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="none"
                  spellCheck={false}
                  editable={true}
                  contextMenuHidden={true}
                  dataDetectorTypes="none"
                  caretHidden={false}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onFocus={() => {
                    // Scroll to ensure confirm password field is visible
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                  }}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons 
                    name={showConfirmPassword ? "eye-off" : "eye"} 
                    size={20} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>
              
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <Text style={styles.errorText}>Passwords do not match</Text>
              )}
              
              {confirmPassword.length > 0 && password === confirmPassword && password.length >= 8 && (
                <Text style={styles.successText}>✓ Passwords match</Text>
              )}
            </View>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.continueButton, (!isFormValid() || isLoading) && styles.disabledButton]}
          onPress={handleComplete}
          disabled={!isFormValid() || isLoading}
        >
          <Text style={styles.continueButtonText}>
            {isLoading 
              ? 'Creating Account...' 
              : 'Complete Registration'
            }
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1,
    padding: 8,
  },
  progressText: {
    alignSelf: 'flex-end',
    fontSize: 16,
    color: '#666',
    marginTop: 20,
    marginRight: 10,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20, // Minimal padding just above keyboard tip
  },
  headerSection: {
    alignItems: 'center',
    paddingVertical: 15,
    marginBottom: 15,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFBEB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  formSection: {
    paddingHorizontal: 10,
    marginBottom: 15,
    backgroundColor: '#FAFAFA',
    borderRadius: 20,
    paddingVertical: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  formGroup: {
    marginBottom: 20,
    paddingVertical: 5,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    marginLeft: 4,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#F0F0F0',
  },
  inputContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#F8F9FA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 48,
    color: '#333',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  passwordInput: {
    flex: 1,
    paddingRight: 10,
    fontSize: 15,
    color: '#333',
  },
  eyeButton: {
    padding: 8,
  },
  passwordStrengthContainer: {
    marginTop: 10,
    alignItems: 'flex-start',
  },
  strengthBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 5,
  },
  strengthFill: {
    height: '100%',
    borderRadius: 4,
  },
  strengthText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginTop: 5,
    fontWeight: '500',
  },
  helperText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  successText: {
    color: '#4CAF50',
    fontSize: 14,
    marginTop: 5,
    fontWeight: '500',
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 56,
  },
  genderButtonActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.3,
  },
  genderButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
  },
  genderButtonTextActive: {
    color: '#FFFFFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  buttonContainer: {
    width: '85%',
    marginBottom: 25,
    alignSelf: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  continueButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E67E22',
  },
  disabledButton: {
    backgroundColor: '#FFD7A0',
    shadowOpacity: 0.1,
    borderColor: '#FFE4B3',
    opacity: 0.7,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  requirementsContainer: {
    marginTop: 10,
    paddingHorizontal: 10,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  requirementMet: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  specialtiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 10,
  },
  specialtyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    borderRadius: 15,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#C0C0C0',
  },
  specialtyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  removeSpecialtyButton: {
    padding: 4,
  },
  addSpecialtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 10,
  },
  specialtyInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 56,
    color: '#333',
  },
  addSpecialtyButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 15,
    marginLeft: 10,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledAddButton: {
    backgroundColor: '#E0E0E0',
    opacity: 0.7,
  },
  summarySection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  summaryItem: {
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  summaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryChip: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E67E22',
  },
  summaryChipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryEmpty: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default SignUpScreen4_FinalSteps;