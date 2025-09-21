import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { ChevronLeft, Lock, Eye, EyeOff, Shield } from 'lucide-react-native';
import { router } from 'expo-router';
import { KeyboardAvoidingScrollView } from '../../src/components/ui';
import { authService } from '../../src/services/api/auth';

export default function ChangePasswordScreen() {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    captcha: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [captchaCode] = useState('A7B9C'); // Static captcha for demo

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const validateForm = () => {
    if (!formData.currentPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return false;
    }
    if (formData.newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return false;
    }
    // Firebase requires at least 6 characters, but let's encourage stronger passwords
    if (formData.newPassword.length < 8) {
      Alert.alert('Warning', 'For better security, consider using at least 8 characters');
    }
    // Check if new password is the same as current password
    if (formData.newPassword === formData.currentPassword) {
      Alert.alert('Error', 'New password must be different from current password');
      return false;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return false;
    }
    if (formData.captcha.toUpperCase() !== captchaCode) {
      Alert.alert('Error', 'Invalid captcha code');
      return false;
    }
    return true;
  };

  const handleChangePassword = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      const result = await authService.changePassword(formData.currentPassword, formData.newPassword);
      
      if (result.success) {
        Alert.alert('Success', result.message, [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        // Show error with more helpful guidance
        let errorMessage = result.message;
        if (result.message.includes('Current password is incorrect')) {
          errorMessage += '\n\nPlease double-check your current password. If you continue having issues, you may need to use the "Forgot Password" option.';
        }
        Alert.alert('Password Change Failed', errorMessage);
      }
    } catch (error: any) {
      console.error('Password change error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again or contact support if the problem persists.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        extraOffset={20}
      >
                 {/* Security Notice */}
         <View style={styles.securityNotice}>
           <Shield size={24} color="#1E40AF" />
           <View style={styles.noticeContent}>
             <Text style={styles.noticeTitle}>Security Notice</Text>
             <Text style={styles.noticeText}>
               Choose a strong password with at least 6 characters including letters, numbers, and symbols.
             </Text>
           </View>
         </View>

         {/* Password Change Info */}
         <View style={styles.infoBox}>
           <Text style={styles.infoTitle}>Important Notes:</Text>
           <Text style={styles.infoText}>
             • You must enter your current password correctly to proceed{'\n'}
             • The new password must be different from your current password{'\n'}
             • For security, you may need to sign in again if your session is old
           </Text>
         </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Current Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Current Password</Text>
            <View style={styles.inputContainer}>
              <Lock size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={formData.currentPassword}
                onChangeText={(value) => handleInputChange('currentPassword', value)}
                placeholder="Enter current password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPasswords.current}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => togglePasswordVisibility('current')}
              >
                {showPasswords.current ? (
                  <EyeOff size={20} color="#9CA3AF" />
                ) : (
                  <Eye size={20} color="#9CA3AF" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* New Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>New Password</Text>
            <View style={styles.inputContainer}>
              <Lock size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={formData.newPassword}
                onChangeText={(value) => handleInputChange('newPassword', value)}
                placeholder="Enter new password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPasswords.new}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => togglePasswordVisibility('new')}
              >
                {showPasswords.new ? (
                  <EyeOff size={20} color="#9CA3AF" />
                ) : (
                  <Eye size={20} color="#9CA3AF" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm New Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <View style={styles.inputContainer}>
              <Lock size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={formData.confirmPassword}
                onChangeText={(value) => handleInputChange('confirmPassword', value)}
                placeholder="Confirm new password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPasswords.confirm}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => togglePasswordVisibility('confirm')}
              >
                {showPasswords.confirm ? (
                  <EyeOff size={20} color="#9CA3AF" />
                ) : (
                  <Eye size={20} color="#9CA3AF" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Captcha */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Security Verification</Text>
            <View style={styles.captchaContainer}>
              <View style={styles.captchaDisplay}>
                <Text style={styles.captchaCode}>{captchaCode}</Text>
              </View>
              <View style={styles.captchaInputContainer}>
                <TextInput
                  style={styles.captchaInput}
                  value={formData.captcha}
                  onChangeText={(value) => handleInputChange('captcha', value)}
                  placeholder="Enter code"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  maxLength={5}
                />
              </View>
            </View>
            <Text style={styles.captchaHelp}>Enter the code shown above</Text>
          </View>
        </View>
      </KeyboardAvoidingScrollView>

      {/* Change Password Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.changeButton, isLoading && styles.changeButtonDisabled]}
          onPress={handleChangePassword}
          disabled={isLoading}
        >
          <Text style={styles.changeButtonText}>
            {isLoading ? 'Changing Password...' : 'Change Password'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
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
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  securityNotice: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    marginHorizontal: 24,
    marginTop: 16,
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
   infoBox: {
     backgroundColor: '#FEF3C7',
     marginHorizontal: 24,
     marginTop: 16,
     padding: 16,
     borderRadius: 12,
     borderWidth: 1,
     borderColor: '#F59E0B',
   },
   infoTitle: {
     fontSize: 14,
     fontFamily: 'Inter-SemiBold',
     color: '#92400E',
     marginBottom: 8,
   },
   infoText: {
     fontSize: 13,
     fontFamily: 'Inter-Regular',
     color: '#92400E',
     lineHeight: 18,
   },
  formSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  inputGroup: {
    marginBottom: 24,
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
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
  },
  captchaContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  captchaDisplay: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captchaCode: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    letterSpacing: 2,
  },
  captchaInputContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  captchaInput: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    textAlign: 'center',
    paddingVertical: 0,
  },
  captchaHelp: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 6,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  changeButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  changeButtonDisabled: {
    opacity: 0.6,
  },
  changeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
});