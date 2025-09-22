import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Mail, CheckCircle, RefreshCw, ArrowRight, X } from 'lucide-react-native';
import { authService } from '../../src/services/api/auth';
import { auth } from '../../src/config/firebase';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function VerifyEmailScreen() {
  const { email, oobCode } = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [userEmail, setUserEmail] = useState(email as string || '');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [canResend, setCanResend] = useState(false);
  
  // Modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalData, setModalData] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    // If oobCode is provided, this is a verification link click
    if (oobCode) {
      handleEmailVerification(oobCode as string);
    } else {
      // If no oobCode, send verification email automatically
      sendVerificationEmail();
    }
  }, [oobCode]);

  // Timer effect for resend cooldown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    
    return () => clearInterval(interval);
  }, [timeLeft]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sendVerificationEmail = async () => {
    if (!auth.currentUser) {
      setModalData({
        title: 'Error',
        message: 'No user found. Please sign in again.',
        type: 'error'
      });
      setShowErrorModal(true);
      setTimeout(() => router.push('/'), 2000);
      return;
    }

    setIsResending(true);
    try {
      const result = await authService.sendEmailVerification(auth.currentUser);
      if (result.success) {
        setVerificationSent(true);
        setUserEmail(auth.currentUser.email || '');
        
        // Reset timer when email is sent
        setTimeLeft(300);
        setCanResend(false);
        
        // Show appropriate message based on whether email was actually sent or skipped
        if (result.message.includes('sent recently')) {
          setModalData({
            title: 'Email Already Sent',
            message: 'A verification email was sent recently. Please check your inbox and spam folder.',
            type: 'success'
          });
          setShowSuccessModal(true);
        }
      } else {
        setModalData({
          title: 'Error',
          message: result.message,
          type: 'error'
        });
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Send verification email error:', error);
      setModalData({
        title: 'Error',
        message: 'Failed to send verification email. Please try again.',
        type: 'error'
      });
      setShowErrorModal(true);
    } finally {
      setIsResending(false);
    }
  };

  const handleEmailVerification = async (code: string) => {
    setIsLoading(true);
    try {
      const result = await authService.verifyEmail(code);
      if (result.success) {
        setModalData({
          title: 'Email Verified!',
          message: 'Your email has been successfully verified. You can now access all features.',
          type: 'success'
        });
        setShowSuccessModal(true);
      } else {
        setModalData({
          title: 'Verification Failed',
          message: result.message,
          type: 'error'
        });
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Email verification error:', error);
      setModalData({
        title: 'Error',
        message: 'Failed to verify email. Please try again.',
        type: 'error'
      });
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = () => {
    sendVerificationEmail();
  };

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      // Reload the user's authentication state to get updated email verification status
      const currentUser = auth.currentUser;
      if (currentUser) {
        const isVerified = await authService.checkEmailVerificationStatus(currentUser);
        
        if (isVerified) {
          // Navigate to appropriate dashboard based on user role
          // This should only be reached by patients, but we'll handle both cases
          router.push('/(patient)/tabs');
        } else {
          setModalData({
            title: 'Email Not Verified',
            message: 'Please verify your email address before continuing. Check your inbox for the verification link.',
            type: 'error'
          });
          setShowErrorModal(true);
        }
      } else {
        setModalData({
          title: 'Authentication Error',
          message: 'Please sign in again to continue.',
          type: 'error'
        });
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Error checking email verification:', error);
      setModalData({
        title: 'Error',
        message: 'Failed to check email verification status. Please try again.',
        type: 'error'
      });
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToSignIn = () => {
    router.push('/');
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    if (modalData?.title === 'Email Verified!') {
      router.push('/(patient)/tabs');
    }
  };

  const handleErrorModalClose = () => {
    setShowErrorModal(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackToSignIn}>
          <ChevronLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Verify Email</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.centerContent}>
        <View style={styles.formContainer}>
          {/* Email Icon */}
          <View style={styles.iconContainer}>
            <Mail size={48} color="#1E40AF" />
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {verificationSent ? 'Check Your Email' : 'Verify Your Email Address'}
          </Text>

          {/* Description */}
          <Text style={styles.description}>
            {verificationSent 
              ? `We've sent a verification link to ${userEmail}. Please check your inbox and click the link to verify your email address.`
              : 'We need to verify your email address to complete your patient account setup. This helps us keep your account secure and ensures you receive important health updates.'
            }
          </Text>

         

          {/* Resend Section */}
          <View style={styles.resendSection}>
            {!canResend ? (
              <Text style={styles.timerText}>
                Resend verification link in {formatTime(timeLeft)}
              </Text>
            ) : (
              <TouchableOpacity
                style={styles.resendLink}
                onPress={handleResendEmail}
                disabled={isResending}
              >
                <Text style={styles.resendLinkText}>
                  {isResending ? 'Sending...' : 'Resend verification link'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Refresh Status Button */}
          {/* <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleContinue}
            disabled={isLoading}
          >
            <RefreshCw size={20} color="#1E40AF" style={styles.refreshIcon} />
            <Text style={styles.refreshButtonText}>
              {isLoading ? 'Checking...' : 'I\'ve clicked the email link - Check Status'}
            </Text>
          </TouchableOpacity> */}

          {/* Continue Button */}
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            disabled={isLoading}
          >
            <Text style={styles.continueButtonText}>Continue to App</Text>
            <ArrowRight size={20} color="#FFFFFF" style={styles.continueIcon} />
          </TouchableOpacity>

          {/* Help Text */}
          <Text style={styles.helpText}>
            Didn't receive the email? Check your spam folder or try resending the verification email.
          </Text>

          {/* Back to Sign In */}
          <TouchableOpacity style={styles.backToSignInLink} onPress={handleBackToSignIn}>
            <Text style={styles.backToSignInLinkText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleSuccessModalClose}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleSuccessModalClose}>
          <View style={styles.modalBackdropOverlay} />
        </Pressable>
        <View style={styles.modalContainer}>
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIconContainer}>
                  <CheckCircle size={32} color="#1E40AF" />
                </View>
                <Text style={styles.modalTitle}>{modalData?.title}</Text>
              </View>

              <View style={styles.modalContentBody}>
                <View style={styles.messageContainer}>
                  <Mail size={20} color="#1E40AF" style={styles.mailIcon} />
                  <Text style={styles.modalMessage}>
                    {modalData?.message.includes('verification email') 
                      ? `We've sent a verification link to `
                      : modalData?.message
                    }
                    {modalData?.message.includes('verification email') && (
                      <Text style={styles.emailText}>{userEmail}</Text>
                    )}
                  </Text>
                </View>
                
                {modalData?.title === 'Email Verified!' && (
                  <Text style={styles.instructionText}>
                    Your email has been successfully verified. You can now access all features.
                  </Text>
                )}
                
                {modalData?.title === 'Email Already Sent' && (
                  <Text style={styles.instructionText}>
                    Please check your inbox and spam folder for the verification link.
                  </Text>
                )}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={handleSuccessModalClose}
                >
                  <Text style={styles.modalButtonText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={showErrorModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleErrorModalClose}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleErrorModalClose}>
          <View style={styles.modalBackdropOverlay} />
        </Pressable>
        <View style={styles.modalContainer}>
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalContent}>
              <View style={styles.modalIconContainer}>
                <X size={48} color="#EF4444" />
              </View>
              <Text style={styles.modalTitle}>{modalData?.title}</Text>
              <Text style={styles.modalMessage}>{modalData?.message}</Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleErrorModalClose}
              >
                <Text style={styles.modalButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
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
  headerContent: { 
    flex: 1, 
    alignItems: 'center' 
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  headerSpacer: { 
    width: 40 
  },
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
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,

    marginLeft: 10,
    marginRight: 10,
    marginBottom: 24,
  },
  emailContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emailLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 4,
  },
  emailText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
  },
  resendSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  timerText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  resendLink: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  resendLinkText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
    textAlign: 'center',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 24,
    width: '100%',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginRight: 8,
  },
  continueIcon: {
    marginLeft: 4,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  refreshButtonText: {
    color: '#1E40AF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginLeft: 8,
  },
  refreshIcon: {
    marginRight: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  helpText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  backToSignInLink: {
    marginBottom: 16,
  },
  backToSignInLinkText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  
  // Modal styles
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  modalBackdropOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  modalSafeArea: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'center',
    minHeight: SCREEN_HEIGHT * 0.35,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    textAlign: 'center',
  },
  modalContentBody: {
    marginBottom: 24,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E40AF',
  },
  mailIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  modalMessage: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    lineHeight: 24,
  },
  instructionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: {
    width: '100%',
  },
  modalButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
});
