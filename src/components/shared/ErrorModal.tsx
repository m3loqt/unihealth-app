import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { COLORS } from '../../constants/colors';
import { AlertTriangle, X } from 'lucide-react-native';

export interface ErrorModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  fieldName?: string;
  suggestion?: string;
  showRetry?: boolean;
  onRetry?: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
  visible,
  onClose,
  title = 'Validation Error',
  message,
  fieldName,
  suggestion,
  showRetry = false,
  onRetry,
}) => {
  const isPendingApproval = title === 'Account Pending Approval';
  const iconSize = isPendingApproval ? 40 : 24;
  const closeButtonStyle = StyleSheet.flatten([
    styles.closeButton,
    isPendingApproval ? styles.closeButtonCompact : null,
  ]);
  // Check if this is an email error for a cleaner display
  const isEmailError = fieldName === 'Email' && message.includes('already registered');
  
  if (isEmailError) {
    return (
      <Modal
        visible={visible}
        onClose={onClose}
        animationType="fade"
        style={styles.modalContainer}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <AlertTriangle size={24} color={COLORS.error} />
          </View>
          <Text style={styles.title}>Email Already Exists</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.emailSuggestionText}>Please use a different email address or try logging in to your existing account.</Text>
        </View>

        <View style={styles.actions}>
          <Button
            title="Got it"
            onPress={onClose}
            variant="primary"
            style={styles.closeButton}
            fullWidth={true}
          />
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      animationType="fade"
      style={styles.modalContainer}
    >
      <View style={[styles.header, isPendingApproval && styles.headerCompact]}>
        <View style={isPendingApproval ? styles.iconContainerLarge : styles.iconContainer}>
          <AlertTriangle size={iconSize} color={COLORS.error} />
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={[styles.content, isPendingApproval && styles.contentCompact]}>
        {fieldName && (
          <Text style={styles.fieldName}>
            Field: <Text style={styles.fieldNameBold}>{fieldName}</Text>
          </Text>
        )}
        
        <Text style={[styles.message, isPendingApproval && styles.messageCompact]}>{message}</Text>
        
        {suggestion && (
          <View style={styles.suggestionContainer}>
            <Text style={styles.suggestionLabel}>💡 Suggestion:</Text>
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {showRetry && onRetry && (
          <Button
            title="Try Again"
            onPress={onRetry}
            variant="outline"
            style={styles.retryButton}
          />
        )}
        <Button
          title="Got it"
          onPress={onClose}
          variant="primary"
          style={closeButtonStyle}
          fullWidth={!showRetry}
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
    marginBottom: 20,
  },
  headerCompact: {
    marginBottom: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainerLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
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
  contentCompact: {
    marginBottom: 16,
  },
  fieldName: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: COLORS.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  fieldNameBold: {
    fontFamily: 'Inter-Bold',
    color: COLORS.textPrimary,
  },
  message: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: COLORS.textPrimary,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 16,
  },
  messageCompact: {
    marginBottom: 6,
  },
  suggestionContainer: {
    backgroundColor: COLORS.infoLight,
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.info,
  },
  suggestionLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: COLORS.infoDark,
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: COLORS.infoDark,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  emailSuggestionText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: COLORS.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    flex: 1,
  },
  closeButton: {
    flex: 1,
  },
  closeButtonCompact: {
    marginTop: 8,
  },
});

export default ErrorModal;
