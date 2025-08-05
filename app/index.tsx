import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Stethoscope, Eye, EyeOff, Mail, Lock, Fingerprint, User } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../src/hooks/auth/useAuth';
import { performBiometricLogin, isBiometricLoginAvailable, saveBiometricCredentials, checkBiometricSupport } from '../src/hooks/auth/useBiometricAuth';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [showRoleModal, setShowRoleModal] = useState(true);
  const [selectedRole, setSelectedRole] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [nextRoute, setNextRoute] = useState('/(tabs)');
  const [errorMessage, setErrorMessage] = useState('');
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [lastSuccessfulLogin, setLastSuccessfulLogin] = useState<{email: string, password: string, userProfile: any} | null>(null);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setErrorMessage(''); // Clear error when typing
  };

  const validateForm = () => {
    if (!formData.email.trim()) {
      setErrorMessage('Please enter your email or username.');
      return false;
    }
    if (!formData.password.trim()) {
      setErrorMessage('Please enter your password.');
      return false;
    }
    return true;
  };

  const handleRoleSelection = (role: string) => {
    setSelectedRole(role);
    setShowRoleModal(false);
    setErrorMessage('');
  };

  const handleSignIn = async () => {
    setErrorMessage('');
    if (!validateForm()) return;
    setIsLoading(true);

    const { email, password } = formData;

    try {
      const userProfile = await signIn(email, password);

      if (userProfile) {
        console.log('Login successful:', userProfile);
        const targetRoute =
          userProfile.role === 'specialist' ? '/(specialist)/tabs' : '/(patient)/tabs';
        
        // Always offer biometric setup after successful login (unless already set up)
        const isBiometricAvailable = await isBiometricLoginAvailable();
        if (!isBiometricAvailable) {
          // Offer to set up biometric login after successful login
          setLastSuccessfulLogin({ email, password, userProfile });
          setShowBiometricSetup(true);
        } else {
          // Biometric already set up, proceed to app
          setNextRoute(targetRoute);
          setShowWelcomeModal(true);
        }
      } else {
        console.log('Login failed: No user profile returned');
        setErrorMessage('Invalid email or password.');
      }
    } catch (error) {
      let errorMessage = 'Invalid email or password.';

      if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
        if (error.message.includes('user-not-found')) {
          errorMessage = 'No account found with this email. Please sign up.';
        } else if (error.message.includes('wrong-password')) {
          errorMessage = 'Incorrect password. Please try again.';
        } else if (error.message.includes('too-many-requests')) {
          errorMessage = 'Too many failed attempts. Please try again later.';
        }
      }
      setErrorMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push('/(auth)/forgot-password');
  };

  const handleBiometricLogin = async () => {
    try {
      // Check if biometric login is available
      const isAvailable = await isBiometricLoginAvailable();
      if (!isAvailable) {
        setErrorMessage('Biometric login not available. Please sign in with email and password first.');
        return;
      }

      // Perform biometric authentication
      const credentials = await performBiometricLogin();
      if (!credentials) {
        setErrorMessage('Biometric authentication failed. Please try again or sign in with password.');
        return;
      }

      // Sign in with retrieved credentials
      const userProfile = await signIn(credentials.email, credentials.password);
      
      if (userProfile) {
        console.log('Biometric login successful:', userProfile);
        const targetRoute = userProfile.role === 'specialist' ? '/(specialist)/tabs' : '/(patient)/tabs';
        setNextRoute(targetRoute);
        setShowWelcomeModal(true);
      } else {
        setErrorMessage('Biometric login failed. Please sign in with password.');
      }
    } catch (error) {
      console.error('Biometric login error:', error);
      setErrorMessage('Biometric authentication failed. Please try again.');
    }
  };

  const handleProceedFromWelcome = () => {
    setShowWelcomeModal(false);
    router.push(nextRoute as any);
  };

  const handleSetupBiometric = async () => {
    if (!lastSuccessfulLogin) return;
    
    try {
      const targetRoute = lastSuccessfulLogin.userProfile.role === 'specialist' ? '/(specialist)/tabs' : '/(patient)/tabs';
      
      // Check biometric support first
      const biometricSupport = await checkBiometricSupport();
      if (!biometricSupport.hasHardware) {
        Alert.alert(
          'Biometric Not Supported',
          'Your device does not support biometric authentication (fingerprint or Face ID).',
          [
            { text: 'OK', onPress: () => {
              setShowBiometricSetup(false);
              setNextRoute(targetRoute);
              setShowWelcomeModal(true);
            }}
          ]
        );
        return;
      }
      
      if (!biometricSupport.isEnrolled) {
        Alert.alert(
          'Set Up Biometric Authentication',
          'Please set up fingerprint or Face ID in your device settings first, then try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue Without Biometric',
              onPress: () => {
                setShowBiometricSetup(false);
                setNextRoute(targetRoute);
                setShowWelcomeModal(true);
              },
            },
          ]
        );
        return;
      }
      
      const success = await saveBiometricCredentials(
        lastSuccessfulLogin.email,
        lastSuccessfulLogin.password,
        targetRoute,
        lastSuccessfulLogin.userProfile.role
      );
      
      if (success) {
        setShowBiometricSetup(false);
        setNextRoute(targetRoute);
        setShowWelcomeModal(true);
      } else {
        Alert.alert(
          'Setup Failed',
          'Failed to set up biometric login. You can continue without biometric authentication.',
          [
            { text: 'Continue', onPress: () => {
              setShowBiometricSetup(false);
              setNextRoute(targetRoute);
              setShowWelcomeModal(true);
            }}
          ]
        );
      }
    } catch (error) {
      console.error('Error setting up biometric login:', error);
      Alert.alert(
        'Setup Failed',
        'Failed to set up biometric login. You can continue without biometric authentication.',
        [
          { text: 'Continue', onPress: () => {
            if (lastSuccessfulLogin) {
              const targetRoute = lastSuccessfulLogin.userProfile.role === 'specialist' ? '/(specialist)/tabs' : '/(patient)/tabs';
              setShowBiometricSetup(false);
              setNextRoute(targetRoute);
              setShowWelcomeModal(true);
            }
          }}
        ]
      );
    }
  };

  const handleSkipBiometric = () => {
    if (!lastSuccessfulLogin) return;
    
    const targetRoute = lastSuccessfulLogin.userProfile.role === 'specialist' ? '/(specialist)/tabs' : '/(patient)/tabs';
    setShowBiometricSetup(false);
    setNextRoute(targetRoute);
    setShowWelcomeModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Welcome Modal */}
      <Modal
        visible={showWelcomeModal}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <TouchableOpacity
          style={styles.welcomeModalOverlay}
          activeOpacity={1}
          onPress={handleProceedFromWelcome}
        >
          <View style={styles.welcomeModalCard}>
            <View style={styles.welcomeIconWrap}>
              <MaterialCommunityIcons name="hand-wave" size={54} color="#1E40AF" />
            </View>
            <Text style={styles.welcomeBigText}>Welcome Back!</Text>
            <Text style={styles.welcomeSubtleText}>Click anywhere to proceed</Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Role Selection Modal */}
      <Modal
        visible={showRoleModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Your Role</Text>
              <Text style={styles.modalSubtitle}>Choose how you want to access Odyssey Solutions Inc. Systems</Text>
              <View style={styles.roleOptions}>
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    selectedRole === 'patient' && styles.roleOptionSelected
                  ]}
                  onPress={() => handleRoleSelection('patient')}
                >
                  <View style={[
                    styles.roleIconContainer,
                    selectedRole === 'patient' && styles.roleIconContainerSelected
                  ]}>
                    <User size={32} color="#1E40AF" />
                  </View>
                  <Text style={[
                    styles.roleTitle,
                    selectedRole === 'patient' && styles.roleTitleSelected
                  ]}>Patient</Text>
                  <Text style={[
                    styles.roleDescription,
                    selectedRole === 'patient' && styles.roleDescriptionSelected
                  ]}>
                    Access your medical records, book appointments, and manage your health
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    selectedRole === 'specialist' && styles.roleOptionSelected
                  ]}
                  onPress={() => handleRoleSelection('specialist')}
                >
                  <View style={[
                    styles.roleIconContainer,
                    selectedRole === 'specialist' && styles.roleIconContainerSelected
                  ]}>
                    <Stethoscope size={32} color="#1E40AF" />
                  </View>
                  <Text style={[
                    styles.roleTitle,
                    selectedRole === 'specialist' && styles.roleTitleSelected
                  ]}>Healthcare Specialist</Text>
                  <Text style={[
                    styles.roleDescription,
                    selectedRole === 'specialist' && styles.roleDescriptionSelected
                  ]}>
                    Manage patients, appointments, and provide medical care
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Biometric Setup Modal */}
      <Modal
        visible={showBiometricSetup}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Enable Biometric Login</Text>
              <Text style={styles.modalSubtitle}>
                Sign in faster with fingerprint or Face ID
              </Text>
              
              <View style={styles.biometricSetupContainer}>
                <View style={styles.biometricIconContainer}>
                  <Fingerprint size={48} color="#1E40AF" />
                </View>
                <Text style={styles.biometricSetupText}>
                  Sign in faster next time with your fingerprint or Face ID. Your credentials will be stored securely on your device.
                </Text>
              </View>

              <View style={styles.biometricSetupButtons}>
                <TouchableOpacity
                  style={styles.setupBiometricButton}
                  onPress={handleSetupBiometric}
                >
                  <Text style={styles.setupBiometricButtonText}>Enable Biometric</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.skipBiometricButton}
                  onPress={handleSkipBiometric}
                >
                  <Text style={styles.skipBiometricButtonText}>Skip</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Subtle "Change Role" Button */}
      <View style={{ alignItems: 'center', marginTop: 12, marginBottom: -12 }}>
        {!showRoleModal && (
          <TouchableOpacity onPress={() => setShowRoleModal(true)}>
            <Text style={{
              color: '#2563EB',
              fontSize: 13,
              textDecorationLine: 'underline',
              fontFamily: 'Inter-Medium',
              opacity: 0.7
            }}>
              Not your role? Choose a different one
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.centerContent}>
            {/* Header */}
            <View style={styles.headerContainer}>
              <View style={styles.logoContainer}>
                <Stethoscope size={32} color="#1E40AF" strokeWidth={2} />
                <Text style={styles.logoText}>
                  Uni<Text style={styles.logoBlue}>HEALTH</Text>
                </Text>
              </View>
              <Text style={styles.tagline}>Your Health, Unified as One</Text>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Mail size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email or username"
                  placeholderTextColor="#9CA3AF"
                  value={formData.email}
                  onChangeText={value => handleInputChange('email', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Lock size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#9CA3AF"
                  value={formData.password}
                  onChangeText={value => handleInputChange('password', value)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(prev => !prev)}
                >
                  {showPassword ? <EyeOff size={20} color="#9CA3AF" /> : <Eye size={20} color="#9CA3AF" />}
                </TouchableOpacity>
              </View>

              {/* Forgot Password */}
              <TouchableOpacity style={styles.forgotPasswordContainer} onPress={handleForgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              {/* Sign In Button */}
              <TouchableOpacity
                style={[styles.signInButton, isLoading && styles.buttonDisabled]}
                onPress={handleSignIn}
                disabled={isLoading}
              >
                <Text style={styles.signInButtonText}>
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </Text>
              </TouchableOpacity>

              {/* Error Message */}
              {errorMessage ? (
                <Text style={styles.errorMessage}>{errorMessage}</Text>
              ) : null}

              {/* Biometric Login */}
              <View style={styles.biometricContainer}>
                <Text style={styles.biometricText}>Or use biometric login</Text>
                <TouchableOpacity style={styles.biometricButton} onPress={handleBiometricLogin}>
                  <Fingerprint size={32} color="#1E40AF" strokeWidth={2} />
                </TouchableOpacity>
              </View>

              {/* Sign Up Link */}
              <View style={styles.signUpContainer}>
                <Text style={styles.signUpText}>Don't have an account? </Text>
                <Link href="/signup/step1" asChild>
                  <TouchableOpacity>
                    <Text style={styles.signUpLink}>Sign Up</Text>
                  </TouchableOpacity>
                </Link>
              </View>

              {/* Terms and Privacy */}
              <Text style={styles.termsText}>
                By signing in, you agree to our{' '}
                <Text style={styles.linkText}>Terms</Text> and{' '}
                <Text style={styles.linkText}>Privacy Policy</Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardAvoid: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  centerContent: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  logoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  logoText: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginLeft: 8,
  },
  logoBlue: { color: '#1E40AF' },
  tagline: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  formContainer: { width: '100%', maxWidth: 380 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  eyeIcon: { padding: 4 },
  forgotPasswordContainer: { alignItems: 'flex-end', marginBottom: 24 },
  forgotPasswordText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
  },
  signInButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
  },
  errorMessage: {
    color: '#EF4444',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginTop: 2,
    marginBottom: 18,
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  biometricContainer: { alignItems: 'center', marginBottom: 32 },
  biometricText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginBottom: 16,
  },
  biometricButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  signUpText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  signUpLink: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
  },
  termsText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
  linkText: { color: '#1E40AF', fontFamily: 'Inter-Medium' },
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  roleOptions: {
    width: '100%',
    gap: 16,
    marginBottom: 24,
  },
  roleOption: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  roleOptionSelected: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  roleIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  roleIconContainerSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  roleTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 6,
    textAlign: 'center',
  },
  roleTitleSelected: {
    color: '#FFFFFF',
  },
  roleDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  roleDescriptionSelected: {
    color: '#E5E7EB',
  },
  // Welcome Modal Styles (UI-matched)
  welcomeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeModalCard: {
     width: 320,
     backgroundColor: '#F9FAFB',
     borderRadius: 20,
     borderWidth: 1.5,
     borderColor: '#E5E7EB',   // <- subtle gray
     paddingVertical: 36,
     paddingHorizontal: 28,
     alignItems: 'center',
  },
  welcomeIconWrap: {
    marginBottom: 12,
    backgroundColor: '#E0E7FF',
    borderRadius: 32,
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeBigText: {
    fontSize: 25,
    fontFamily: 'Inter-Bold',
    color: '#1E40AF',
    textAlign: 'center',
    marginBottom: 6,
    marginTop: 6,
  },
  welcomeSubtleText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  // Biometric Setup Modal Styles
  biometricSetupContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  biometricIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  biometricSetupText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  biometricSetupButtons: {
    width: '100%',
    gap: 12,
  },
  setupBiometricButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  setupBiometricButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  skipBiometricButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipBiometricButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
});
