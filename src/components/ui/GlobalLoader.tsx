import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface GlobalLoaderProps {
  visible: boolean;
  message?: string;
  showProgress?: boolean;
  progress?: number; // 0 to 1
}

export default function GlobalLoader({ 
  visible, 
  message = 'Loading...', 
  showProgress = false,
  progress = 0 
}: GlobalLoaderProps) {
  const sandLevel = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const shimmerOffset = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Start sand filling animation
      sandLevel.value = withTiming(1, { 
        duration: 2000, 
        easing: Easing.bezier(0.25, 0.1, 0.25, 1) 
      });

      // Subtle pulse animation
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1000, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
          withTiming(1, { duration: 1000, easing: Easing.bezier(0.4, 0, 0.2, 1) })
        ),
        -1,
        true
      );

      // Shimmer effect
      shimmerOffset.value = withRepeat(
        withTiming(SCREEN_WIDTH, { duration: 1500, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      // Reset animations when hidden
      sandLevel.value = 0;
      pulseScale.value = 1;
      shimmerOffset.value = 0;
    }
  }, [visible]);

  const hourglassStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pulseScale.value }
    ],
  }));

  const sandStyle = useAnimatedStyle(() => ({
    height: interpolate(sandLevel.value, [0, 1], [0, 60]),
    opacity: interpolate(sandLevel.value, [0, 0.3, 1], [0, 0.7, 1]),
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerOffset.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress * 100}%`,
  }));

  if (!visible) return null;

  return (
    <Modal 
      visible={visible} 
      transparent 
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Main Hourglass Container */}
          <View style={styles.hourglassContainer}>
            <Animated.View style={[styles.hourglass, hourglassStyle]}>
              {/* Top Chamber */}
              <View style={styles.topChamber}>
                <View style={styles.chamberTop} />
                <View style={styles.chamberBody} />
              </View>
              
              {/* Middle Neck */}
              <View style={styles.neck} />
              
              {/* Bottom Chamber */}
              <View style={styles.bottomChamber}>
                <View style={styles.chamberBody} />
                <View style={styles.chamberBottom} />
                
                {/* Animated Sand */}
                <Animated.View style={[styles.sand, sandStyle]}>
                  <LinearGradient
                    colors={['#1E40AF', '#3B82F6', '#60A5FA']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.sandGradient}
                  />
                </Animated.View>
              </View>
            </Animated.View>

            {/* Shimmer Effect */}
            <Animated.View style={[styles.shimmer, shimmerStyle]}>
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.shimmerGradient}
              />
            </Animated.View>
          </View>

          {/* Loading Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Progress Bar (Optional) */}
          {showProgress && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View style={[styles.progressFill, progressStyle]}>
                  <LinearGradient
                    colors={['#1E40AF', '#3B82F6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.progressGradient}
                  />
                </Animated.View>
              </View>
              <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
            </View>
          )}

          {/* Branding */}
          
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    maxWidth: 320,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 20,
  },
  hourglassContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  hourglass: {
    width: 80,
    height: 120,
    alignItems: 'center',
  },
  topChamber: {
    width: 60,
    height: 50,
    alignItems: 'center',
  },
  chamberTop: {
    width: 60,
    height: 8,
    backgroundColor: '#1E40AF',
    borderRadius: 4,
  },
  chamberBody: {
    width: 60,
    height: 42,
    backgroundColor: '#F1F5F9',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#1E40AF',
  },
  neck: {
    width: 8,
    height: 20,
    backgroundColor: '#1E40AF',
    borderRadius: 4,
  },
  bottomChamber: {
    width: 60,
    height: 50,
    alignItems: 'center',
    position: 'relative',
  },
  chamberBottom: {
    width: 60,
    height: 8,
    backgroundColor: '#1E40AF',
    borderRadius: 4,
  },
  sand: {
    position: 'absolute',
    bottom: 8,
    left: 2,
    right: 2,
    borderRadius: 2,
    overflow: 'hidden',
  },
  sandGradient: {
    flex: 1,
    borderRadius: 2,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: -SCREEN_WIDTH,
    width: SCREEN_WIDTH,
    height: '100%',
  },
  shimmerGradient: {
    width: '100%',
    height: '100%',
  },
  message: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 16,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressGradient: {
    flex: 1,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  branding: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    width: '100%',
  },
  brandText: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1E40AF',
    marginBottom: 4,
  },
  brandSubtext: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
