import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Mail, Clock, ArrowRight } from 'lucide-react-native';
import { authService } from '../../src/services/api/auth';

export default function VerifyCodeScreen() {
  const { email } = useLocalSearchParams();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (!email) {
      Alert.alert('Error', 'Email is required', [
        { text: 'OK', onPress: () => router.push('/forgot-password') }
      ]);
      return;
    }

    // Start countdown timer
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [email]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCodeChange = useCallback((index: number, value: string) => {
    // Only allow single digit
    if (value.length > 1) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Simple auto-focus next input without complex timing
    if (value && index < 5) {
      const nextInput = inputRefs.current[index + 1];
      if (nextInput) {
        nextInput.focus();
      }
    }
    
    // If clearing an input, ensure current input stays focused
    if (!value) {
      const currentInput = inputRefs.current[index];
      if (currentInput) {
        currentInput.focus();
      }
    }
  }, [code]);

  const handleKeyPress = useCallback((index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      const prevInput = inputRefs.current[index - 1];
      if (prevInput) {
        prevInput.focus();
      }
    }
  }, [code]);

  const setInputRef = useCallback((index: number) => (ref: TextInput | null) => {
    inputRefs.current[index] = ref;
  }, []);

  const focusInput = useCallback((index: number) => {
    const input = inputRefs.current[index];
    if (input) {
      input.focus();
    }
  }, []);

  const handleVerifyCode = async () => {
    const codeString = code.join('');
    
    if (codeString.length !== 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit code');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.verifyPasswordResetCode(email as string, codeString);
      
      if (result.success) {
        // Navigate to reset password screen with email and code
        router.push({
          pathname: '/reset-password',
          params: { email: email as string, code: codeString }
        });
      } else {
        Alert.alert('Error', result.message || 'Invalid or expired code. Please try again.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to verify code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);

    try {
      const result = await authService.requestPasswordResetCode(email as string);
      
      if (result.success) {
        setTimeLeft(300); // Reset timer to 5 minutes
        setCanResend(false);
        setCode(['', '', '', '', '', '']); // Clear code inputs
        Alert.alert('Success', 'A new verification code has been sent to your email.');
      } else {
        Alert.alert('Error', result.message || 'Failed to send verification code. Please try again.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToForgotPassword = () => {
    router.push('/forgot-password');
  };

  const isCodeComplete = code.every(digit => digit !== '');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackToForgotPassword}>
            <ChevronLeft size={24} color="#1E40AF" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Verify Code</Text>
            <Text style={styles.headerSubtitle}>Enter the 6-digit code sent to your email</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.centerContent}>
          <View style={styles.formContainer}>
            {/* Email Display */}
            <View style={styles.emailContainer}>
              <Mail size={20} color="#6B7280" />
              <Text style={styles.emailText}>{email}</Text>
            </View>

            {/* Timer */}
            <View style={styles.timerContainer}>
              <Clock size={16} color="#6B7280" />
              <Text style={styles.timerText}>
                Code expires in {formatTime(timeLeft)}
              </Text>
            </View>

            {/* Code Input */}
            <View style={styles.codeContainer}>
              <Text style={styles.codeLabel}>Enter 6-digit code</Text>
              <View style={styles.codeInputs}>
                {code.map((digit, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.codeInputWrapper}
                    onPress={() => focusInput(index)}
                    activeOpacity={0.7}
                  >
                    <TextInput
                      ref={setInputRef(index)}
                      style={styles.codeInput}
                      value={digit}
                      onChangeText={(value) => handleCodeChange(index, value)}
                      onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                      keyboardType="numeric"
                      maxLength={1}
                      selectTextOnFocus
                      autoFocus={index === 0}
                      blurOnSubmit={false}
                      returnKeyType="next"
                      editable={!isLoading}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Verify Button */}
            <TouchableOpacity
              style={[styles.verifyButton, (!isCodeComplete || isLoading) && styles.buttonDisabled]}
              onPress={handleVerifyCode}
              disabled={!isCodeComplete || isLoading}
            >
              <Text style={styles.verifyButtonText}>
                {isLoading ? 'Verifying...' : 'Verify Code'}
              </Text>
              <ArrowRight size={20} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Resend Code */}
            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>Didn't receive the code?</Text>
              <TouchableOpacity
                style={[styles.resendButton, (!canResend || isLoading) && styles.resendButtonDisabled]}
                onPress={handleResendCode}
                disabled={!canResend || isLoading}
              >
                <Text style={[styles.resendButtonText, !canResend && styles.resendButtonTextDisabled]}>
                  {canResend ? 'Resend Code' : `Resend in ${formatTime(timeLeft)}`}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Help Text */}
            <Text style={styles.helpText}>
              Check your email for the verification code. If you don't see it, check your spam folder.
            </Text>
          </View>
        </View>
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  formContainer: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emailText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginLeft: 8,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  timerText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginLeft: 6,
  },
  codeContainer: {
    width: '100%',
    marginBottom: 32,
  },
  codeLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
  },
  codeInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  codeInputWrapper: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeInput: {
    width: '100%',
    height: '100%',
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    color: '#1F2937',
    backgroundColor: 'transparent',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    marginBottom: 24,
    gap: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  resendText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 8,
  },
  resendButton: {
    paddingVertical: 8,
  },
  resendButtonDisabled: { opacity: 0.5 },
  resendButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
  },
  resendButtonTextDisabled: {
    color: '#9CA3AF',
  },
  helpText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
}); 