import React, { useState, useEffect, useRef } from 'react';
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
  Pressable,
  Dimensions,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Stethoscope, Eye, EyeOff, Mail, Lock, Fingerprint, User, AlertCircle, X, CheckCircle } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../src/hooks/auth/useAuth';
import { performBiometricLogin, isBiometricLoginAvailable, saveBiometricCredentials, checkBiometricSupport } from '../src/hooks/auth/useBiometricAuth';
import { safeDataAccess } from '../src/utils/safeDataAccess';
import { GlobalLoader } from '../src/components/ui';
import { useGlobalLoader } from '../src/hooks/ui';
import { ErrorModal } from '../src/components/shared/ErrorModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');



export default function SignInScreen() {
  const { signIn } = useAuth();
  const loader = useGlobalLoader();
  const [showRoleModal, setShowRoleModal] = useState(true);
  const [selectedRole, setSelectedRole] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [nextRoute, setNextRoute] = useState('/(tabs)');
  const [errorMessage, setErrorMessage] = useState('');
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [lastSuccessfulLogin, setLastSuccessfulLogin] = useState<{email: string, password: string, userProfile: any} | null>(null);
  
  // Error modal state
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalData, setErrorModalData] = useState<{
    title: string;
    message: string;
    suggestion?: string;
  } | null>(null);

  // --- New: Biometric Button Enable State ---
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);

  // Check on mount and after welcome modal (i.e. after setup)
  useEffect(() => {
    const checkAvailability = async () => {
      const available = await isBiometricLoginAvailable();
      setIsBiometricEnabled(available);
    };
    checkAvailability();
  }, [showWelcomeModal, showBiometricSetup]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setErrorMessage(''); // Clear error when typing
  };

  const showErrorModalWithData = (title: string, message: string, suggestion?: string) => {
    setErrorModalData({ title, message, suggestion });
    setShowErrorModal(true);
  };

  const handleErrorModalClose = () => {
    setShowErrorModal(false);
    setErrorModalData(null);
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
    loader.show('Signing in...');

    const { email, password } = formData;

    try {
      const result = await signIn(email, password);

      if (result.success && result.userProfile) {
        const targetRoute =
          result.userProfile.role === 'specialist' ? '/(specialist)/tabs' : '/(patient)/tabs';

        // Always offer biometric setup after successful login (unless already set up)
        const isBiometricAvailable = await isBiometricLoginAvailable();
        if (!isBiometricAvailable) {
          setLastSuccessfulLogin({ email, password, userProfile: result.userProfile });
          setShowBiometricSetup(true);
        } else {
          setNextRoute(targetRoute);
          setShowWelcomeModal(true);
        }
      } else if (result.error) {
        // Handle different error types
        if (result.error.type === 'specialist_pending') {
          showErrorModalWithData(
            'Account Pending Approval',
            result.error.message,
            result.error.suggestion
          );
        } else {
          // For other errors, show in the existing error message area
          setErrorMessage(result.error.message);
        }
      } else {
        setErrorMessage('Invalid email or password.');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setErrorMessage('An error occurred during sign in. Please try again.');
    } finally {
      loader.hide();
    }
  };

  const handleForgotPassword = () => {
    router.push('/(auth)/forgot-password');
  };

  const handleBiometricLogin = async () => {
    try {
      setErrorMessage('');
      const credentials = await performBiometricLogin();
      if (credentials) {
        // Sign in with the retrieved credentials
        loader.show('Signing in with biometric...');
        const result = await signIn(credentials.email, credentials.password);
        if (result.success && result.userProfile) {
          const targetRoute = result.userProfile.role === 'specialist' ? '/(specialist)/tabs' : '/(patient)/tabs';
          setNextRoute(targetRoute);
          setShowWelcomeModal(true);
        } else if (result.error) {
          // Handle different error types
          if (result.error.type === 'specialist_pending') {
            showErrorModalWithData(
              'Account Pending Approval',
              result.error.message,
              result.error.suggestion
            );
          } else {
            setErrorMessage('Biometric login failed. Please sign in with password.');
          }
        } else {
          setErrorMessage('Biometric login failed. Please sign in with password.');
        }
      } else {
        setErrorMessage('Biometric authentication failed. Please try again.');
      }
    } catch (error) {
      setErrorMessage('Biometric authentication failed. Please try again.');
    } finally {
      loader.hide();
    }
  };

  const handleProceedFromWelcome = () => {
    setShowWelcomeModal(false);
    router.push(nextRoute as any);
  };

  const handleCloseWelcomeModal = () => {
    setShowWelcomeModal(false);
    router.push(nextRoute as any);
  };

  const handleSetupBiometric = async () => {
    if (!lastSuccessfulLogin) return;
    try {
      const targetRoute = lastSuccessfulLogin.userProfile.role === 'specialist'
        ? '/(specialist)/tabs'
        : '/(patient)/tabs';

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
        setIsBiometricEnabled(true); // Enable biometric button
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

  const getUserDisplayName = () => {
    if (lastSuccessfulLogin?.userProfile) {
      return safeDataAccess.getUserFullName(lastSuccessfulLogin.userProfile, lastSuccessfulLogin.userProfile.email || 'User');
    }
    return 'User';
  };

  const getUserRole = () => {
    const role = lastSuccessfulLogin?.userProfile?.role || selectedRole;
    return role === 'specialist' ? 'Healthcare Specialist' : 'Patient';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Loading Overlay during Sign In */}
      <GlobalLoader
        visible={loader.visible}
        message={loader.message}
        showProgress={loader.showProgress}
        progress={loader.progress}
      />
      {/* Success Login Modal */}
      <Modal
        visible={showWelcomeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseWelcomeModal}
      >
        <Pressable style={welcomeModalStyles.backdrop} onPress={handleCloseWelcomeModal}>
          <View style={welcomeModalStyles.backdropOverlay} />
        </Pressable>
        <View style={welcomeModalStyles.modalContainer}>
          <SafeAreaView style={welcomeModalStyles.safeArea}>
            <View style={welcomeModalStyles.modalContent}>
              {/* Success Content */}
              <View style={welcomeModalStyles.successContent}>
                {/* Success Icon */}
                <View style={welcomeModalStyles.successIcon}>
                  <CheckCircle size={48} color="#1E40AF" />
                </View>
                
                {/* Success Message */}
                <Text style={welcomeModalStyles.successTitle}>
                  Signin success!
                </Text>
                
                <Text style={welcomeModalStyles.successSubtitle}>
                  Click continue to proceed
                </Text>
              </View>
              
              {/* Action Button */}
              <View style={welcomeModalStyles.actions}>
                <TouchableOpacity
                  style={welcomeModalStyles.primaryButton}
                  onPress={handleProceedFromWelcome}
                >
                  <Text style={welcomeModalStyles.primaryButtonText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
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
                    Manage patients, appointments and{"\n"}provide best medical care
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
              <Text style={styles.modalTitle}>Or use Biometric Login</Text>
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
                  placeholder="Email address"
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
                 style={[styles.signInButton, loader.visible && styles.buttonDisabled]}
                 onPress={handleSignIn}
                 disabled={loader.visible}
               >
                 <Text style={styles.signInButtonText}>
                   {loader.visible ? 'Signing In...' : 'Sign In'}
                 </Text>
               </TouchableOpacity>

              {/* Subtle Message Box */}
              {errorMessage ? (
                <View style={styles.subtleMessageBox}>
                  <AlertCircle size={18} color="#6B7280" style={{ marginRight: 7, marginTop: 1 }} />
                  <Text style={styles.subtleMessageText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Biometric Login */}
              <View style={styles.biometricContainer}>
                <Text style={[
                  styles.biometricHintText,
                  !isBiometricEnabled && { color: '#D1D5DB' }
                ]}>
                  {isBiometricEnabled ? "Or use biometric login" : "Enable biometric login after sign in"}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.biometricButton,
                    !isBiometricEnabled && styles.biometricButtonDisabled,
                  ]}
                  onPress={handleBiometricLogin}
                  disabled={!isBiometricEnabled}
                >
                  <Fingerprint size={32} color="#1E40AF" strokeWidth={2} />
                </TouchableOpacity>
              </View>

              {/* Sign Up Link */}
              {selectedRole !== 'specialist' && (
                <View style={styles.signUpContainer}>
                  <Text style={styles.signUpText}>Don't have an account? </Text>
                  <Link href="/signup/step1" asChild>
                    <TouchableOpacity>
                      <Text style={styles.signUpLink}>Sign Up</Text>
                    </TouchableOpacity>
                  </Link>
                </View>
              )}

              {/* Terms and Privacy */}
              <Text style={styles.termsText}>
                By signing in, you agree to our{' '}
                <TouchableOpacity onPress={() => router.push('/(shared)/terms-privacy')}>
                  <Text style={styles.linkText}>Terms and Privacy Policy</Text>
                </TouchableOpacity>{' '}
                {/* <Text style={styles.linkText}>Privacy Policy</Text> */}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Error Modal */}
      {errorModalData && (
        <ErrorModal
          visible={showErrorModal}
          onClose={handleErrorModalClose}
          title={errorModalData.title}
          message={errorModalData.message}
          suggestion={errorModalData.suggestion}
        />
      )}
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

  subtleMessageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F3F4F6',  // Soft gray
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 2,
    marginBottom: 18,
    minHeight: 40,
  },
  subtleMessageText: {
    color: '#4B5563',
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    flex: 1,
    textAlign: 'left',
    marginTop: 1,
  },

  biometricContainer: { alignItems: 'center', marginBottom: 32 },
  biometricText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginBottom: 16,
  },
  biometricHintText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 6,
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
  biometricButtonDisabled: {
    opacity: 0.35,
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
    alignItems: 'stretch',
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
    borderColor: '#E5E7EB',
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

const welcomeModalStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
  },
  backdropOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)' 
  },
  modalContainer: {
    flex: 1, justifyContent: 'flex-end', zIndex: 2,
  },
  safeArea: { 
    width: '100%',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'stretch',
    minHeight: SCREEN_HEIGHT * 0.35,
  },
  header: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 16,
  },
  headerLeft: { 
    flex: 1 
  },
  headerTitle: {
    fontSize: 18, 
    fontFamily: 'Inter-Bold', 
    color: '#1F2937', 
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13, 
    fontFamily: 'Inter-Regular', 
    color: '#6B7280',
  },
  closeButton: {
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    marginLeft: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 20,
  },
  successContent: {
    alignItems: 'center',
    paddingVertical: 16,
    flex: 1,
    justifyContent: 'center',
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  successTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: { 
    flexDirection: 'row', 
    gap: 12,
    marginTop: 32,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontFamily: 'Inter-SemiBold' 
  },
});
