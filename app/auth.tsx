import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../src/contexts/AuthContext';
import BackIDScreen from '../src/screens/auth/BackIDScreen';
import DocumentTypeScreen from '../src/screens/auth/DocumentTypeScreen';
import FrontIDScreen from '../src/screens/auth/FrontIDScreen';
import LoginScreen from '../src/screens/auth/LoginScreen';
import PhoneVerificationScreen from '../src/screens/auth/PhoneVerificationScreen';
import RegisterScreen from '../src/screens/auth/RegisterScreen';
import SelfieScreen from '../src/screens/auth/SelfieScreen';
import SignUpScreen1_UserRole from '../src/screens/auth/SignUpScreen1_UserRole';
import SignUpScreen2_PetType from '../src/screens/auth/SignUpScreen2_PetType';
import SignUpScreen3_BreedPreferences from '../src/screens/auth/SignUpScreen3_BreedPreferences';
import SignUpScreen4_FinalSteps from '../src/screens/auth/SignUpScreen4_FinalSteps';
import UserRoleSelectionScreen from '../src/screens/auth/UserRoleSelectionScreen';
import { PrivacyPolicyScreen, TermsAndConditionsScreen } from '../src/screens/pre-auth';

export default function Auth() {
  const [authStep, setAuthStep] = useState<'privacy-policy' | 'terms-and-conditions' | 'role-selection' | 'login' | 'register' | 'signup1' | 'signup2' | 'signup3' | 'signup4' | 'phone-verification' | 'document-type' | 'front-id' | 'back-id' | 'selfie'>('role-selection');
  const [selectedUserRole, setSelectedUserRole] = useState<'Pet Owner' | 'Pet Sitter' | null>(null);
  const [signupData, setSignupData] = useState<any>({});
  const router = useRouter();
  const { updateUserProfile, storeUserFromBackend } = useAuth();

  const goToPrivacyPolicy = () => setAuthStep('privacy-policy');
  const goToTermsAndConditions = () => setAuthStep('terms-and-conditions');
  const goToRoleSelection = () => setAuthStep('role-selection');
  const goToLogin = (role?: 'Pet Owner' | 'Pet Sitter') => {
    if (role) {
      setSelectedUserRole(role);
    }
    setAuthStep('login');
  };
  const goToRegister = (role?: 'Pet Owner' | 'Pet Sitter') => {
    if (role) {
      setSelectedUserRole(role);
      setSignupData({ ...signupData, userRole: role });
      setAuthStep('signup2');
    } else {
      setAuthStep('role-selection');
    }
  };
  const goToSignup1 = () => setAuthStep('signup1');
  const goToSignup2 = (userRole: 'Pet Owner' | 'Pet Sitter') => {
    setSignupData({ ...signupData, userRole });
    setAuthStep('signup2');
  };
  const goToSignup3 = (selectedPetTypes: ('dogs' | 'cats')[]) => {
    const newSignupData = { ...signupData, selectedPetTypes };
    console.log('🔄 goToSignup3 - Previous signupData:', signupData);
    console.log('🔄 goToSignup3 - New selectedPetTypes:', selectedPetTypes);
    console.log('🔄 goToSignup3 - New signupData:', newSignupData);
    setSignupData(newSignupData);
    setAuthStep('signup3');
  };
  const goToSignup4 = (selectedBreeds: string[]) => {
    const newSignupData = { ...signupData, selectedBreeds };
    console.log('🔄 goToSignup4 - Previous signupData:', signupData);
    console.log('🔄 goToSignup4 - New selectedBreeds:', selectedBreeds);
    console.log('🔄 goToSignup4 - New signupData:', newSignupData);
    setSignupData(newSignupData);
    setAuthStep('signup4');
  };

  // New multi-step registration flow (for pet sitters after breed selection)
  const goToPhoneVerification = (userData: any) => {
    setSignupData({ ...signupData, userData });
    setAuthStep('phone-verification');
  };
  const goToFrontID = (phoneVerified: boolean) => {
    setSignupData({ ...signupData, phoneVerified });
    setAuthStep('front-id');
  };
  
  const goToDocumentType = (phoneVerified: boolean, userData: any) => {
    console.log('goToDocumentType called with:', { phoneVerified, userData });
    setSignupData({ ...signupData, phoneVerified, userData: userData || signupData.userData });
    setAuthStep('document-type');
  };

  const goToFrontIDWithUserData = (phoneVerified: boolean, userData: any) => {
    console.log('goToFrontIDWithUserData called with:', { phoneVerified, userData });
    setSignupData({ ...signupData, phoneVerified, userData: userData || signupData.userData });
    setAuthStep('front-id');
  };
  const goToBackID = (phoneVerified: boolean, frontImage: string, userData?: any) => {
    setSignupData({ ...signupData, phoneVerified, frontImage, userData: userData || signupData.userData });
    setAuthStep('back-id');
  };
  const goToSelfie = (phoneVerified: boolean, frontImage: string, backImage: string, userData?: any) => {
    setSignupData({ ...signupData, phoneVerified, frontImage, backImage, userData: userData || signupData.userData });
    setAuthStep('selfie');
  };

  const goToFrontIDFromDocumentType = (phoneVerified: boolean, documentType: string, userData: any) => {
    console.log('goToFrontIDFromDocumentType called with:', { phoneVerified, documentType, userData });
    setSignupData({ ...signupData, phoneVerified, documentType, userData: userData || signupData.userData });
    setAuthStep('front-id');
  };

  const onRoleSelected = (role: 'Pet Owner' | 'Pet Sitter') => {
    setSelectedUserRole(role);
    setSignupData({ ...signupData, userRole: role });
  };

  const onAuthSuccess = async (user: any) => {
    try {
      console.log('onAuthSuccess called with user:', user);
      
      // Validate user object
      if (!user) {
        console.error('onAuthSuccess: user is null or undefined');
        throw new Error('User data is missing');
      }
      
      // If the user object is already complete from backend, just update the profile
      if (user && user.id && user.email && user.id !== Date.now().toString()) {
        console.log('User data already saved to backend, updating profile');
        console.log('User object being passed to updateUserProfile:', user);
        console.log('User profileImage field:', user.profileImage);
        console.log('User profile_image field:', user.profile_image);
        console.log('User hourlyRate field:', user.hourlyRate);
        console.log('User hourly_rate field:', user.hourly_rate);
        
        // Map backend user object to frontend user structure
        const userForUpdate = {
          id: user.id,
          email: user.email,
          name: user.name,
          // CRITICAL: Properly handle name fields with fallback logic
          firstName: user.first_name || user.firstName || (user.name ? user.name.split(' ')[0] : ''),
          lastName: user.last_name || user.lastName || (user.name ? user.name.split(' ').slice(1).join(' ') : ''),
          userRole: (user.role === 'pet_owner' ? 'Pet Owner' : 'Pet Sitter') as 'Pet Owner' | 'Pet Sitter',
          role: user.role,
          phone: user.phone || '',
          age: user.age,
          gender: user.gender || '',
          address: user.address || '',
          experience: user.experience || '',
          hourlyRate: user.hourlyRate || user.hourly_rate || '',  // Check both field names
          aboutMe: user.bio || '',             // Backend uses bio
          specialties: user.specialties || [],
          email_verified: user.email_verified || false,
          phone_verified: user.phone_verified || false,
          selectedPetTypes: user.selected_pet_types || [],
          selectedBreeds: user.pet_breeds || [],  // Backend uses pet_breeds
          profileImage: user.profileImage || user.profile_image || undefined,
          token: user.token, // Add the authentication token
        };
        
        // Enhanced debugging for name fields
        console.log('🔍 onAuthSuccess - Name mapping debug:');
        console.log('  - user.first_name:', JSON.stringify(user.first_name));
        console.log('  - user.last_name:', JSON.stringify(user.last_name));
        console.log('  - user.firstName:', JSON.stringify(user.firstName));
        console.log('  - user.lastName:', JSON.stringify(user.lastName));
        console.log('  - user.name:', JSON.stringify(user.name));
        console.log('  - userForUpdate.firstName:', JSON.stringify(userForUpdate.firstName));
        console.log('  - userForUpdate.lastName:', JSON.stringify(userForUpdate.lastName));
        
        console.log('User object structured for updateUserProfile:', userForUpdate);
        console.log('UserForUpdate hourlyRate:', userForUpdate.hourlyRate);
        await updateUserProfile(userForUpdate);
      } else {
        console.log('Saving user data to backend in onAuthSuccess');
        // Save the user data to the backend using network service
        const { networkService } = await import('../src/services/networkService');
        const baseUrl = networkService.getBaseUrl();
        const registerUrl = `${baseUrl}/api/register`;
        
        console.log('🚀 Using network service URL in onAuthSuccess:', registerUrl);
        
        const response = await fetch(registerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            first_name: user.firstName || '',
            last_name: user.lastName || '',
            email: user.email,
            password: user.password,
            password_confirmation: user.password, // Required by backend validation
            role: user.userRole === 'Pet Owner' ? 'pet_owner' : 'pet_sitter',
            phone: user.phone,
            address: user.address,
            gender: user.gender,
            age: user.age,
            experience: user.experience || '',
            hourly_rate: user.hourlyRate || '',
            specialties: user.specialties || [],
            selected_pet_types: user.selectedPetTypes || [],
            pet_breeds: user.selectedBreeds || [],
            bio: user.aboutMe || '',
          }),
        });

        // Check if response is ok before parsing JSON
        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = 'Failed to save user data';
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || errorMessage;
          } catch (e) {
            errorMessage = errorText || `Server error: ${response.status}`;
          }
          console.error('❌ Registration failed:', response.status, errorMessage);
          throw new Error(errorMessage);
        }

        const result = await response.json();
        
        if (result.success) {
          console.log('User data saved to backend successfully in onAuthSuccess:', result);
          
          // Create a complete user object from backend response
          const completeUser = {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            firstName: result.user.first_name || '',
            lastName: result.user.last_name || '',
            userRole: result.user.role === 'pet_owner' ? 'Pet Owner' : 'Pet Sitter',
            role: result.user.role,
            phone: result.user.phone || '',
            age: result.user.age,
            gender: result.user.gender || '',
            address: result.user.address || '',
            experience: result.user.experience || '',
            hourlyRate: result.user.hourly_rate || '',
            aboutMe: result.user.bio || '',
            specialties: result.user.specialties || [],
            email_verified: result.user.email_verified || false,
            phone_verified: result.user.phone_verified || false,
            selectedPetTypes: result.user.selected_pet_types || [],
            selectedBreeds: result.user.pet_breeds || [],
            profileImage: result.user.profile_image || undefined,
          };
          
          await storeUserFromBackend(result.user);
        } else {
          console.error('Failed to save user data to backend in onAuthSuccess:', result);
          throw new Error(result.message || 'Failed to save user data');
        }
      }
    } catch (error) {
      console.error('Error saving user data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save user data';
      Alert.alert('Registration Error', errorMessage);
      throw error; // Re-throw to prevent navigation on error
    }

    // Navigate based on user role
    try {
      const userRole = user.role === 'pet_owner' ? 'Pet Owner' : 'Pet Sitter';
      console.log('Navigating user to dashboard. Role:', userRole);
      
      if (user.role === 'pet_owner') {
        router.replace('/pet-owner-dashboard');
      } else if (user.role === 'pet_sitter') {
        router.replace('/pet-sitter-dashboard');
      } else {
        console.log('Unknown user role, redirecting to onboarding');
        router.replace('/onboarding');
      }
    } catch (error) {
      console.error('Navigation error in onAuthSuccess:', error);
      // Fallback to onboarding on error
      router.replace('/onboarding');
    }
  };

  // Modified completion handler for both pet sitters and pet owners
  const onRegistrationComplete = async (userData: any) => {
    console.log('Saving complete user data to backend:', userData);
    console.log('UserData hourlyRate:', userData.hourlyRate);
    console.log('UserData role:', userData.userRole);
    console.log('SignupData state:', signupData);
    console.log('SignupData selectedPetTypes:', signupData.selectedPetTypes);
    console.log('SignupData selectedBreeds:', signupData.selectedBreeds);
    console.log('UserData selectedPetTypes:', userData.selectedPetTypes);
    console.log('UserData selectedBreeds:', userData.selectedBreeds);
    
    // Merge userData from screen 4 with data from previous screens (1-3)
    const completeUserData = {
      ...userData,
      userRole: userData.userRole || signupData.userRole,
      selectedPetTypes: userData.selectedPetTypes || signupData.selectedPetTypes || [],
      selectedBreeds: userData.selectedBreeds || signupData.selectedBreeds || []
    };
    
    console.log('Complete merged user data:', completeUserData);
    console.log('Complete selectedPetTypes:', completeUserData.selectedPetTypes);
    console.log('Complete selectedBreeds:', completeUserData.selectedBreeds);
    console.log('Complete selectedPetTypes length:', completeUserData.selectedPetTypes?.length);
    console.log('Complete selectedBreeds length:', completeUserData.selectedBreeds?.length);
    
    try {
      
      // Prepare the request body
      const requestBody = {
        name: `${completeUserData.firstName || ''} ${completeUserData.lastName || ''}`.trim(),
        first_name: completeUserData.firstName || '',
        last_name: completeUserData.lastName || '',
        email: completeUserData.email,
        password: completeUserData.password,
        password_confirmation: completeUserData.password, // Add password confirmation
        role: completeUserData.userRole === 'Pet Owner' ? 'pet_owner' : 'pet_sitter',
        phone: completeUserData.phone || '',
        address: completeUserData.address || '',
        gender: completeUserData.gender || '',
        age: completeUserData.age || null,
        experience: completeUserData.experience || '',
        hourly_rate: completeUserData.hourlyRate || '',
        max_pets: completeUserData.maxPets || 10,
        pet_breeds: completeUserData.selectedBreeds || [],
        specialties: completeUserData.specialties || [],
        selected_pet_types: completeUserData.selectedPetTypes || [],
        bio: completeUserData.aboutMe || '',
      };

      console.log('🚀 Request body being sent to backend:', requestBody);
      console.log('🚀 hourly_rate in request body:', requestBody.hourly_rate);
      console.log('🚀 hourly_rate type:', typeof requestBody.hourly_rate);
      console.log('🚀 selected_pet_types in request body:', requestBody.selected_pet_types);
      console.log('🚀 pet_breeds in request body:', requestBody.pet_breeds);
      console.log('🚀 specialties in request body:', requestBody.specialties);

      // Save the complete user data to the backend using network service
      const { networkService } = await import('../src/services/networkService');
      const baseUrl = networkService.getBaseUrl();
      const registerUrl = `${baseUrl}/api/register`;
      
      console.log('🚀 Using network service URL:', registerUrl);
      
      const response = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend response error:', response.status, errorText);
        throw new Error(`Backend error: ${response.status} - ${errorText}`);
      }

      // Try to parse JSON response
      let result;
      try {
        const responseText = await response.text();
        console.log('Raw backend response:', responseText);
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Invalid response from backend - not valid JSON');
      }
      
      if (result.success) {
        console.log('User data saved to backend successfully:', result);
        console.log('Backend user object:', result.user);
        console.log('Backend hourly_rate:', result.user.hourly_rate);
        console.log('Backend hourly_rate type:', typeof result.user.hourly_rate);
        console.log('Backend hourly_rate value:', JSON.stringify(result.user.hourly_rate));
        console.log('Backend selected_pet_types:', result.user.selected_pet_types);
        console.log('Backend pet_breeds:', result.user.pet_breeds);
        console.log('Backend specialties:', result.user.specialties);
        console.log('Frontend userData.hourlyRate:', userData.hourlyRate);
        console.log('Frontend completeUserData.selectedPetTypes:', completeUserData.selectedPetTypes);
        console.log('Frontend completeUserData.selectedBreeds:', completeUserData.selectedBreeds);
        
        // Create a complete user object for the auth context
        const completeUser = {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          // CRITICAL: Ensure name fields are properly mapped with fallbacks
          firstName: result.user.first_name || userData.firstName || (result.user.name ? result.user.name.split(' ')[0] : ''),
          lastName: result.user.last_name || userData.lastName || (result.user.name ? result.user.name.split(' ').slice(1).join(' ') : ''),
          userRole: result.user.role === 'pet_owner' ? 'Pet Owner' : 'Pet Sitter',
          role: result.user.role,
          phone: result.user.phone,
          age: result.user.age,
          gender: result.user.gender,
          address: result.user.address,
          experience: result.user.experience || userData.experience || '',
          hourlyRate: result.user.hourly_rate !== null && result.user.hourly_rate !== undefined ? String(result.user.hourly_rate) : (userData.hourlyRate || ''),
          maxPets: result.user.max_pets !== null && result.user.max_pets !== undefined ? result.user.max_pets : (completeUserData.maxPets || userData.maxPets || undefined),
          max_pets: result.user.max_pets !== null && result.user.max_pets !== undefined ? result.user.max_pets : (completeUserData.maxPets || userData.maxPets || undefined),
          aboutMe: result.user.bio || '',
          specialties: result.user.specialties || userData.specialties || [],
          email_verified: result.user.email_verified,
          phone_verified: result.user.phone_verified,
          selectedPetTypes: result.user.selected_pet_types || completeUserData.selectedPetTypes,
          selectedBreeds: result.user.pet_breeds || completeUserData.selectedBreeds,
          profileImage: undefined,
          token: result.token, // Add the authentication token
        };

        console.log('Complete user object before storing:', completeUser);
        console.log('Complete user hourlyRate:', completeUser.hourlyRate);
        console.log('Complete user selectedPetTypes:', completeUser.selectedPetTypes);
        console.log('Complete user selectedBreeds:', completeUser.selectedBreeds);
        console.log('Complete user hourlyRate type:', typeof completeUser.hourlyRate);
        console.log('Complete user hourlyRate value:', JSON.stringify(completeUser.hourlyRate));
        
        // Enhanced debugging for name fields in registration complete
        console.log('🔍 onRegistrationComplete - Name mapping debug:');
        console.log('  - result.user.first_name:', JSON.stringify(result.user.first_name));
        console.log('  - result.user.last_name:', JSON.stringify(result.user.last_name));
        console.log('  - result.user.name:', JSON.stringify(result.user.name));
        console.log('  - completeUser.firstName:', JSON.stringify(completeUser.firstName));
        console.log('  - completeUser.lastName:', JSON.stringify(completeUser.lastName));
        console.log('  - completeUser.name:', JSON.stringify(completeUser.name));

        // Store the complete user data in the auth context
        // Convert completeUser to backend format for storeUserFromBackend
        const backendUser = {
          ...result.user,
          hourly_rate: completeUser.hourlyRate !== null && completeUser.hourlyRate !== undefined ? completeUser.hourlyRate : (result.user.hourly_rate || userData.hourlyRate || ''),
          max_pets: completeUser.maxPets !== null && completeUser.maxPets !== undefined ? completeUser.maxPets : (result.user.max_pets || completeUserData.maxPets || userData.maxPets || undefined),
        };
        console.log('Backend user object for storage:', backendUser);
        console.log('Backend user hourly_rate:', backendUser.hourly_rate);
        console.log('Backend user hourly_rate type:', typeof backendUser.hourly_rate);
        console.log('Backend user hourly_rate value:', JSON.stringify(backendUser.hourly_rate));
        await storeUserFromBackend(backendUser);

        // IMPORTANT: Include token in completeUser so verification screens can use it
        const completeUserWithToken = {
          ...completeUser,
          token: result.token || null, // Include token from registration response
        };
        console.log('🔑 onRegistrationComplete - Token included in userData:', !!completeUserWithToken.token);

        // After breed selection, go to phone verification for both pet sitters and pet owners
        setSignupData({ ...signupData, userData: completeUserWithToken });
        setAuthStep('phone-verification');
      } else {
        // Silently handle backend save failure
        // console.error('Failed to save user data to backend:', result);
        throw new Error(result.message || 'Failed to save user data');
      }
    } catch (error) {
      // Silently handle error
      // console.error('Error saving user data to backend:', error);
      Alert.alert('Error', `Failed to save user data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Continue with the flow even if backend save fails
      // Both pet sitters and pet owners need phone verification
      setSignupData({ ...signupData, userData: completeUserData });
      setAuthStep('phone-verification');
    }
  };

  switch (authStep) {
    case 'privacy-policy':
      return (
        <PrivacyPolicyScreen 
          onAccept={goToTermsAndConditions}
        />
      );
    case 'terms-and-conditions':
      return (
        <TermsAndConditionsScreen 
          onAccept={goToRoleSelection}
          onBack={goToPrivacyPolicy}
        />
      );
    case 'role-selection':
      return (
        <UserRoleSelectionScreen 
          onRoleSelected={onRoleSelected}
          onLogin={goToLogin}
          onRegister={goToRegister}
          onBack={goToTermsAndConditions}
          onPrivacyPolicy={goToPrivacyPolicy}
          onTermsAndConditions={goToTermsAndConditions}
        />
      );
    case 'login':
      return <LoginScreen 
        onLoginSuccess={onAuthSuccess} 
        onRegister={goToRegister} 
        onBack={goToRoleSelection}
        selectedUserRole={selectedUserRole}
      />;
    case 'register':
      return <RegisterScreen 
        onRegisterSuccess={onAuthSuccess} 
        onLogin={goToLogin} 
        onSignup={goToSignup1} 
        onBack={goToRoleSelection}
        selectedUserRole={selectedUserRole}
      />;
    case 'signup1':
      return <SignUpScreen1_UserRole onNext={goToSignup2} />;
    case 'signup2':
      return <SignUpScreen2_PetType userRole={signupData.userRole} onNext={goToSignup3} onBack={goToRoleSelection} />;
    case 'signup3':
      return <SignUpScreen3_BreedPreferences userRole={signupData.userRole} selectedPetTypes={signupData.selectedPetTypes} onNext={goToSignup4} onBack={() => setAuthStep('signup2')} />;
    case 'signup4':
      return <SignUpScreen4_FinalSteps userRole={signupData.userRole} selectedPetTypes={signupData.selectedPetTypes} selectedBreeds={signupData.selectedBreeds} onComplete={onRegistrationComplete} onBack={() => setAuthStep('signup3')} />;
    // Multi-step registration flow (phone verification for both, ID verification for pet sitters only)
    case 'phone-verification':
      return <PhoneVerificationScreen 
        userData={signupData.userData} 
        onPhoneVerified={signupData.userRole === 'Pet Sitter' ? (phoneVerified) => goToDocumentType(phoneVerified, signupData.userData) : () => onAuthSuccess(signupData.userData)} 
      />;
    case 'document-type':
      return <DocumentTypeScreen 
        userData={signupData.userData} 
        phoneVerified={signupData.phoneVerified} 
        onDocumentTypeSelected={goToFrontIDFromDocumentType} 
      />;
    case 'front-id':
      return <FrontIDScreen userData={signupData.userData} phoneVerified={signupData.phoneVerified} onFrontIDComplete={(phoneVerified, frontImage, userData) => goToBackID(phoneVerified, frontImage, userData)} />;
    case 'back-id':
      return <BackIDScreen userData={signupData.userData} phoneVerified={signupData.phoneVerified} frontImage={signupData.frontImage} onBackIDComplete={(phoneVerified, frontImage, backImage, userData) => goToSelfie(phoneVerified, frontImage, backImage, userData)} />;
    case 'selfie':
      return <SelfieScreen userData={signupData.userData} phoneVerified={signupData.phoneVerified} frontImage={signupData.frontImage} backImage={signupData.backImage} documentType={signupData.documentType} onSelfieComplete={onAuthSuccess} />;
    default:
      return (
        <UserRoleSelectionScreen 
          onRoleSelected={onRoleSelected}
          onLogin={goToLogin}
          onRegister={goToRegister}
        />
      );
  }
} 