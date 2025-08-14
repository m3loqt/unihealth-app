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
  Alert,
  StatusBar,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Lock,
  Eye,
  EyeOff,
  ChevronLeft,
  Check,
  FileText,
  Shield,
  X
} from 'lucide-react-native';
import { authService, SignUpData } from '../../../src/services/api/auth';
import { useAuth } from '../../../src/hooks/auth/useAuth';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ---- MAIN COMPONENT ----
export default function SignUpStep3Screen() {
  const { signUp } = useAuth();
  const { step1Data, step2Data } = useLocalSearchParams();
  const [formData, setFormData] = useState<Record<string, string>>({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Terms/Privacy modal
  const [policyModalVisible, setPolicyModalVisible] = useState(false);
  const [activePolicyTab, setActivePolicyTab] = useState('terms');
  const [checked, setChecked] = useState(false);

  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Enable button only when all required
  const isFormReady =
    checked &&
    !!formData.password.trim() &&
    !!formData.confirmPassword.trim();

  // Handle input change for all fields
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // EHR-compliant terms/privacy content
  const renderTermsContent = () => (
    <View style={styles.contentSection}>
      <View style={styles.sectionHeader}>
        <FileText size={24} color="#1E40AF" />
        <Text style={styles.sectionTitle}>Terms of Service</Text>
      </View>
      <Text style={styles.lastUpdated}>Last updated: December 15, 2024</Text>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.blockText}>
          By accessing and using UniHEALTH ("the App"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>2. Description of Service</Text>
        <Text style={styles.blockText}>
          UniHEALTH is a healthcare management platform that allows users to:
          {'\n'}• Book appointments with healthcare providers
          {'\n'}• Access medical records and history
          {'\n'}• Manage prescriptions and medications
          {'\n'}• View and download medical certificates
          {'\n'}• Communicate with healthcare professionals
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>3. User Responsibilities</Text>
        <Text style={styles.blockText}>
          Users are responsible for:
          {'\n'}• Providing accurate and up-to-date personal information
          {'\n'}• Maintaining the confidentiality of their account credentials
          {'\n'}• Using the service in compliance with applicable laws
          {'\n'}• Respecting the privacy and rights of other users
          {'\n'}• Reporting any security vulnerabilities or misuse
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>4. Medical Disclaimer</Text>
        <Text style={styles.blockText}>
          UniHEALTH is a platform for healthcare management and communication. It does not provide medical advice, diagnosis, or treatment. Always consult with qualified healthcare professionals for medical decisions.
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>5. Limitation of Liability</Text>
        <Text style={styles.blockText}>
          UniHEALTH shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>6. Modifications to Terms</Text>
        <Text style={styles.blockText}>
          We reserve the right to modify these terms at any time. Users will be notified of significant changes via the app or email. Continued use of the service constitutes acceptance of modified terms.
        </Text>
      </View>
    </View>
  );

  const renderPrivacyContent = () => (
    <View style={styles.contentSection}>
      <View style={styles.sectionHeader}>
        <Shield size={24} color="#1E40AF" />
        <Text style={styles.sectionTitle}>Privacy Policy</Text>
      </View>
      <Text style={styles.lastUpdated}>Last updated: December 15, 2024</Text>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>1. Information We Collect</Text>
        <Text style={styles.blockText}>
          We collect information you provide directly to us:
          {'\n'}• Personal information (name, email, phone number, address)
          {'\n'}• Health information (medical history, prescriptions, appointments)
          {'\n'}• Account information (username, password, preferences)
          {'\n'}• Communication data (messages with healthcare providers)
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>2. How We Use Your Information</Text>
        <Text style={styles.blockText}>
          Your information is used to:
          {'\n'}• Provide and improve our healthcare services
          {'\n'}• Facilitate communication with healthcare providers
          {'\n'}• Send appointment reminders and health notifications
          {'\n'}• Ensure security and prevent fraud
          {'\n'}• Comply with legal and regulatory requirements
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>3. Information Sharing</Text>
        <Text style={styles.blockText}>
          We do not sell, trade, or rent your personal information. We may share your information only:
          {'\n'}• With healthcare providers for treatment purposes
          {'\n'}• With your explicit consent
          {'\n'}• As required by law or legal process
          {'\n'}• To protect rights, property, or safety
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>4. Data Security</Text>
        <Text style={styles.blockText}>
          We implement industry-standard security measures:
          {'\n'}• End-to-end encryption for sensitive data
          {'\n'}• Secure data storage and transmission
          {'\n'}• Regular security audits and updates
          {'\n'}• Access controls and authentication
          {'\n'}• HIPAA compliance for health information
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>5. Your Rights</Text>
        <Text style={styles.blockText}>
          You have the right to:
          {'\n'}• Access your personal information
          {'\n'}• Correct inaccurate information
          {'\n'}• Request deletion of your data
          {'\n'}• Opt-out of certain communications
          {'\n'}• Export your health data
        </Text>
      </View>
      <View style={styles.contentBlock}>
        <Text style={styles.blockTitle}>6. Contact Information</Text>
        <Text style={styles.blockText}>
          For questions about this Privacy Policy, contact us at:
          {'\n'}Email: privacy@unihealth.com
          {'\n'}Phone: +1 (555) 123-HELP
          {'\n'}Address: 123 Healthcare Ave, Medical District, CA 90210
        </Text>
      </View>
    </View>
  );

  // Password validation helpers
  const getPasswordHints = () => {
    const password = formData.password;
    return [
      {
        text: 'At least 8 characters',
        isValid: password.length >= 8,
      },
      {
        text: 'At least 1 uppercase letter (A-Z)',
        isValid: /[A-Z]/.test(password),
      },
      {
        text: 'At least 1 lowercase letter (a-z)',
        isValid: /[a-z]/.test(password),
      },
      {
        text: 'At least 1 number (0-9)',
        isValid: /\d/.test(password),
      },
      {
        text: 'At least 1 special character (!@#$...)',
        isValid: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      },
    ];
  };

  const validateForm = () => {
    const hints = getPasswordHints();
    const invalidHints = hints.filter(hint => !hint.isValid);
    if (invalidHints.length > 0) {
      Alert.alert('Error', 'Please ensure your password meets all requirements.');
      return false;
    }
    if (!formData.confirmPassword.trim()) {
      Alert.alert('Error', 'Please confirm your password');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }
    if (!checked) {
      Alert.alert('Notice', 'Please agree to our Terms and Privacy Policy to continue.');
      return false;
    }
    return true;
  };

  // ---- MERGE DATA & SIGN UP ----
  const handleSignUp = async () => {
    if (!validateForm()) return;

    let data1 = {};
    let data2 = {};
    try {
      data1 = step1Data ? JSON.parse(step1Data as string) : {};
      data2 = step2Data ? JSON.parse(step2Data as string) : {};
    } catch (e) {
      Alert.alert('Error', 'There was a problem processing your signup. Please start again.');
      return;
    }

    const signUpData = {
      ...data1,
      ...data2,
      password: formData.password,
    } as SignUpData;

    setIsLoading(true);

    try {
      // Create account with Firebase
      const { user, userProfile: newUserProfile } = await signUp(signUpData);
      
      setIsLoading(false);
      setUserProfile(newUserProfile);
      setShowSuccessModal(true);
    } catch (error: any) {
      setIsLoading(false);
      let errorMessage = 'Failed to create account. Please try again.';
      
      if (error.message.includes('email-already-in-use')) {
        errorMessage = 'An account with this email already exists. Please use a different email or sign in.';
      } else if (error.message.includes('weak-password')) {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.message.includes('invalid-email')) {
        errorMessage = 'Please enter a valid email address.';
      }
      
      Alert.alert('Sign Up Error', errorMessage);
    }
  };

  const handleGoToLogin = () => {
    setShowSuccessModal(false);
    router.replace('/');
  };

  const passwordHints = getPasswordHints();

  return (
    <SafeAreaView
      style={[
        styles.container,
        Platform.OS === 'android' ? { paddingTop: StatusBar.currentHeight } : null,
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#1E40AF" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Create your account</Text>
            <Text style={styles.headerSubtitle}>Step 3: Account Details</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '100%' }]} />
          </View>
          <Text style={styles.progressText}>3 of 3</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formContainer}>

            {/* Password Requirements (on top, no card) */}
            <View style={styles.hintsPlainContainer}>
              <Text style={styles.hintsTitle}>
                Choose a password that meets all of the following:
              </Text>
              {passwordHints.map((hint, index) => (
                <View key={index} style={styles.hintRow}>
                  <View style={[
                    styles.hintIcon,
                    hint.isValid && styles.hintIconValid
                  ]}>
                    {hint.isValid && <Check size={12} color="#FFFFFF" />}
                  </View>
                  <Text style={[
                    styles.hintText,
                    hint.isValid && styles.hintTextValid
                  ]}>
                    {hint.text}
                  </Text>
                </View>
              ))}
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.inputLabel, styles.passwordLabel]}>Password</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <View style={styles.inputContainer}>
                <Lock size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Create password"
                  placeholderTextColor="#9CA3AF"
                  value={formData.password}
                  onChangeText={value => handleInputChange('password', value)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#9CA3AF" />
                  ) : (
                    <Eye size={20} color="#9CA3AF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <View style={styles.inputContainer}>
                <Lock size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm password"
                  placeholderTextColor="#9CA3AF"
                  value={formData.confirmPassword}
                  onChangeText={value => handleInputChange('confirmPassword', value)}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color="#9CA3AF" />
                  ) : (
                    <Eye size={20} color="#9CA3AF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Checkbox and agreement text */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setChecked(v => !v)}
              activeOpacity={0.85}
            >
              <View style={[styles.checkboxBox, checked && styles.checkboxChecked]}>
                {checked && <Check size={16} color="#FFF" />}
              </View>
              <Text style={styles.checkboxText}>
                I agree to the{' '}
                <Text
                  style={styles.policyLink}
                  onPress={() => {
                    setActivePolicyTab('terms');
                    setPolicyModalVisible(true);
                  }}
                >
                  Terms of Service
                </Text>
                {' '}and{' '}
                <Text
                  style={styles.policyLink}
                  onPress={() => {
                    setActivePolicyTab('privacy');
                    setPolicyModalVisible(true);
                  }}
                >
                  Privacy Policy
                </Text>
                .
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Sign Up Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[styles.signUpButton, (!isFormReady || isLoading) && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={!isFormReady || isLoading}
          >
            <Text style={styles.signUpButtonText}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Modal for terms and privacy */}
        <Modal
          visible={policyModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setPolicyModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.termsModalContent}>
              {/* Tab Navigation */}
              <View style={styles.policyTabRow}>
                <TouchableOpacity
                  style={[
                    styles.policyTab,
                    activePolicyTab === 'terms' && styles.activePolicyTab
                  ]}
                  onPress={() => setActivePolicyTab('terms')}
                >
                  <FileText size={17} color={activePolicyTab === 'terms' ? '#1E40AF' : '#6B7280'} />
                  <Text style={[
                    styles.policyTabText,
                    activePolicyTab === 'terms' && styles.activePolicyTabText
                  ]}>Terms</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.policyTab,
                    activePolicyTab === 'privacy' && styles.activePolicyTab
                  ]}
                  onPress={() => setActivePolicyTab('privacy')}
                >
                  <Shield size={17} color={activePolicyTab === 'privacy' ? '#1E40AF' : '#6B7280'} />
                  <Text style={[
                    styles.policyTabText,
                    activePolicyTab === 'privacy' && styles.activePolicyTabText
                  ]}>Privacy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setPolicyModalVisible(false)}>
                  <X size={22} color="#1E40AF" />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
                {activePolicyTab === 'terms' ? renderTermsContent() : renderPrivacyContent()}
              </ScrollView>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setPolicyModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Success Modal */}
        <Modal
          visible={showSuccessModal}
          transparent={true}
          animationType="slide"
          onRequestClose={handleGoToLogin}
        >
          <Pressable style={styles.successModalBackdrop} onPress={handleGoToLogin}>
            <View style={styles.successModalBackdropOverlay} />
          </Pressable>
          <View style={styles.successModalContainer}>
            <SafeAreaView style={styles.successModalSafeArea}>
              <View style={styles.successModalContent}>
                {/* Success Content */}
                <View style={styles.successModalSuccessContent}>
                  {/* Success Icon */}
                  <View style={styles.successModalSuccessIcon}>
                    <Check size={48} color="#1E40AF" />
                  </View>
                  
                  {/* Success Message */}
                  <Text style={styles.successModalSuccessTitle}>
                    Account Created Successfully!
                  </Text>
                  
                  <Text style={styles.successModalSuccessSubtitle}>
                    Welcome to UniHEALTH, {userProfile?.name}! Your account has been created and you can now sign in.
                  </Text>
                </View>
                
                {/* Action Button */}
                <View style={styles.successModalActions}>
                  <TouchableOpacity
                    style={styles.successModalPrimaryButton}
                    onPress={handleGoToLogin}
                  >
                    <Text style={styles.successModalPrimaryButtonText}>Continue to Sign In</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---- STYLES ----
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardAvoid: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerContent: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  headerSpacer: { width: 40 },
  progressContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1E40AF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
  formContainer: { flex: 1 },

  // Password Hints
  hintsPlainContainer: { marginBottom: 10 },
  hintsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  hintRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  hintIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  hintIconValid: { backgroundColor: '#1E40AF' },
  hintText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  hintTextValid: {
    color: '#1E40AF',
    fontFamily: 'Inter-Medium',
  },

  inputGroup: { marginBottom: 20 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  passwordLabel: { marginTop: 12 },
  asterisk: {
    fontSize: 14,
    color: '#EF4444',
    marginLeft: 2,
    fontFamily: 'Inter-Medium',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 56,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  eyeIcon: { padding: 4 },

  // Checkbox styles
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
    gap: 8,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#1E40AF',
    borderRadius: 6,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },
  checkboxChecked: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  checkboxText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter-Medium',
    flex: 1,
    flexWrap: 'wrap',
  },
  policyLink: {
    color: '#1E40AF',
    fontFamily: 'Inter-Medium',
    // textDecorationLine: 'underline',   // <-- removed underline as requested
  },

  termsText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
  },
  linkText: { color: '#1E40AF', fontFamily: 'Inter-Medium' },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  signUpButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  signUpButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },

  // Terms/Policy Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.23)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsModalContent: {
    width: 340,
    maxHeight: 620,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 0,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  policyTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 6,
  },
  policyTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 8,
    marginRight: 6,
  },
  activePolicyTab: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#1E40AF',
  },
  policyTabText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginLeft: 6,
  },
  activePolicyTabText: {
    color: '#1E40AF',
    fontFamily: 'Inter-SemiBold',
  },
  modalCloseBtn: {
    marginLeft: 'auto',
    padding: 6,
  },
  contentSection: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  lastUpdated: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  contentBlock: {
    marginBottom: 24,
  },
  blockTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 8,
  },
  blockText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 38,
    marginTop: 12,
    marginBottom: 18,
    alignSelf: 'center',
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
  },
  // Success Modal Styles - Matching Signin Screen
  successModalBackdrop: {
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    zIndex: 1,
  },
  successModalBackdropOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)' 
  },
  successModalContainer: {
    flex: 1, 
    justifyContent: 'flex-end', 
    zIndex: 2,
  },
  successModalSafeArea: { 
    width: '100%',
  },
  successModalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'stretch',
    minHeight: SCREEN_HEIGHT * 0.35,
  },
  successModalSuccessContent: {
    alignItems: 'center',
    paddingVertical: 16,
    flex: 1,
    justifyContent: 'center',
  },
  successModalSuccessIcon: {
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
  successModalSuccessTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  successModalSuccessSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  successModalActions: { 
    flexDirection: 'row', 
    gap: 12,
    marginTop: 32,
  },
  successModalPrimaryButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  successModalPrimaryButtonText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontFamily: 'Inter-SemiBold' 
  },
});
