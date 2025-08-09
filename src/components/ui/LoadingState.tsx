import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/colors';

interface LoadingStateProps {
  message?: string;
  variant?: 'fullscreen' | 'inline' | 'compact';
  size?: 'small' | 'large';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  variant = 'inline',
  size = 'large'
}) => {
  const renderContent = () => (
    <>
      <ActivityIndicator size={size} color={COLORS.primary} />
      {message && (
        <Text style={[
          styles.message,
          variant === 'compact' && styles.compactMessage
        ]}>
          {message}
        </Text>
      )}
    </>
  );

  if (variant === 'fullscreen') {
    return (
      <View style={styles.fullscreenContainer}>
        {renderContent()}
      </View>
    );
  }

  if (variant === 'compact') {
    return (
      <View style={styles.compactContainer}>
        {renderContent()}
      </View>
    );
  }

  return (
    <View style={styles.inlineContainer}>
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  fullscreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 20,
  },
  inlineContainer: {
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  compactContainer: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  message: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontFamily: 'System',
  },
  compactMessage: {
    marginTop: 0,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});

export default LoadingState;
