import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { COLORS } from '../../constants/colors';
import { CheckCircle, Mail } from 'lucide-react-native';

export interface PasswordResetSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  email: string;
}

export const PasswordResetSuccessModal: React.FC<PasswordResetSuccessModalProps> = ({
  visible,
  onClose,
  email,
}) => {
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      animationType="fade"
      style={styles.modalContainer}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <CheckCircle size={32} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>Email Sent Successfully</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.messageContainer}>
          <Mail size={20} color={COLORS.primary} style={styles.mailIcon} />
          <Text style={styles.message}>
            We've sent a password reset link to{' '}
            <Text style={styles.emailText}>{email}</Text>
          </Text>
        </View>
        
        <Text style={styles.instructionText}>
          Please check your inbox and follow the instructions to reset your password.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          title="Continue"
          onPress={onClose}
          variant="primary"
          style={styles.continueButton}
          fullWidth={true}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    maxWidth: 400,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  content: {
    marginBottom: 24,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  mailIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  message: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: COLORS.textPrimary,
    lineHeight: 24,
  },
  emailText: {
    fontFamily: 'Inter-SemiBold',
    color: COLORS.primary,
  },
  instructionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    width: '100%',
  },
  continueButton: {
    backgroundColor: COLORS.primary,
  },
});

export default PasswordResetSuccessModal;
