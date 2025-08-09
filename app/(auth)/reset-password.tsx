import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Lock, Eye, EyeOff, Check, Shield } from 'lucide-react-native';
import { authService } from '../../src/services/api/auth';

export default function ResetPasswordScreen() {
  const { email, code } = useLocalSearchParams();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  useEffect(() => {
    if (!email || !code) {
      Alert.alert(
        'Invalid Reset Link',
        'This password reset link is invalid or has expired. Please request a new one.',
        [
          {
            text: 'OK',
            onPress: () => router.push('/forgot-password'),
          },
        ]
      );
    }
  }, [email, code]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

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
    
    return true;
  };

  const handleResetPassword = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const result = await authService.resetPasswordWithCode(email as string, code as string, formData.password);
      
      if (result.success) {
        // Mark the code as used after successful password reset
        await authService.markResetCodeAsUsed(email as string, code as string);
        setResetComplete(true);
      } else {
        let errorMessage = result.message || 'Failed to reset password. Please try again.';
        
        if (result.message.includes('Invalid or expired code')) {
          errorMessage = 'This verification code has expired or is invalid. Please request a new one.';
        } else if (result.message.includes('weak-password')) {
          errorMessage = 'Password is too weak. Please choose a stronger password.';
        } else if (result.message.includes('Password reset with code is not supported')) {
          errorMessage = 'Password reset with code is not supported for this account type. Please contact support.';
        }
        
        Alert.alert('Reset Failed', errorMessage);
      }
    } catch (error: any) {
      let errorMessage = 'Failed to reset password. Please try again.';
      
      if (error.message.includes('Invalid or expired reset code')) {
        errorMessage = 'This verification code has expired or is invalid. Please request a new one.';
      } else if (error.message.includes('weak-password')) {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.message.includes('Password reset with code is not supported')) {
        errorMessage = 'Password reset with code is not supported for this account type. Please contact support.';
      }
      
      Alert.alert('Reset Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToSignIn = () => {
    router.push('/');
  };

  const passwordHints = getPasswordHints();
  const isFormValid = passwordHints.every(hint => hint.isValid) && 
                     formData.password === formData.confirmPassword &&
                     formData.confirmPassword.trim();

  if (resetComplete) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.centerContent}>
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Check size={32} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>Password Reset Successful!</Text>
            <Text style={styles.successMessage}>
              Your password has been successfully reset. You can now sign in with your new password.
            </Text>
            <TouchableOpacity
              style={styles.signInButton}
              onPress={handleGoToSignIn}
            >
              <Text style={styles.signInButtonText}>Continue to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Create New Password</Text>
            <Text style={styles.headerSubtitle}>Enter your new password below</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formContainer}>
            {/* Security Notice */}
            <View style={styles.securityNotice}>
              <Shield size={24} color="#1E40AF" />
              <View style={styles.noticeContent}>
                <Text style={styles.noticeTitle}>Security Notice</Text>
                <Text style={styles.noticeText}>
                  Choose a strong password to keep your account secure.
                </Text>
              </View>
            </View>

            {/* Password Requirements */}
            <View style={styles.hintsContainer}>
              <Text style={styles.hintsTitle}>
                Your password must meet all of the following:
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
              <Text style={styles.inputLabel}>New Password</Text>
              <View style={styles.inputContainer}>
                <Lock size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter new password"
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
              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <View style={styles.inputContainer}>
                <Lock size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm new password"
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

            {/* Reset Password Button */}
            <TouchableOpacity
              style={[styles.resetButton, (!isFormValid || isLoading) && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={!isFormValid || isLoading}
            >
              <Text style={styles.resetButtonText}>
                {isLoading ? 'Resetting Password...' : 'Reset Password'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  keyboardAvoid: { flex: 1 },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  headerContent: { alignItems: 'center' },
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  formContainer: {
    flex: 1,
    maxWidth: 380,
    alignSelf: 'center',
    width: '100%',
  },
  securityNotice: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  noticeContent: {
    flex: 1,
    marginLeft: 12,
  },
  noticeTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
    lineHeight: 18,
  },
  hintsContainer: {
    marginBottom: 24,
  },
  hintsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 12,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  hintIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  hintIconValid: {
    backgroundColor: '#1E40AF',
  },
  hintText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  hintTextValid: {
    color: '#1E40AF',
    fontFamily: 'Inter-Medium',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
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
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  eyeIcon: { padding: 4 },
  resetButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successContainer: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  successTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  signInButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
});