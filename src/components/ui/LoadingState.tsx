import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS } from '@/constants/colors';

interface LoadingStateProps {
  message?: string;
  variant?: 'fullscreen' | 'inline' | 'compact';
  size?: 'small' | 'large';
}

// Animated Equalizer Loading Component
const AnimatedEqualizer: React.FC<{ size?: 'small' | 'large' }> = ({ size = 'large' }) => {
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.6)).current;
  const bar3 = useRef(new Animated.Value(1)).current;
  const bar4 = useRef(new Animated.Value(0.7)).current;
  const bar5 = useRef(new Animated.Value(0.4)).current;

  const animateBar = (animatedValue: Animated.Value, delay: number) => {
    return Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 600,
          delay,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0.3,
          duration: 600,
          delay,
          useNativeDriver: false,
        }),
      ])
    );
  };

  useEffect(() => {
    const animations = [
      animateBar(bar1, 0),
      animateBar(bar2, 100),
      animateBar(bar3, 200),
      animateBar(bar4, 300),
      animateBar(bar5, 400),
    ];

    animations.forEach(animation => animation.start());

    return () => {
      animations.forEach(animation => animation.stop());
    };
  }, []);

  const barWidth = size === 'small' ? 4 : 6;
  const barSpacing = size === 'small' ? 3 : 4;
  const maxHeight = size === 'small' ? 20 : 30;

  return (
    <View style={[styles.equalizerContainer, { gap: barSpacing }]}>
      {[bar1, bar2, bar3, bar4, bar5].map((animatedValue, index) => (
        <Animated.View
          key={index}
          style={[
            styles.equalizerBar,
            {
              width: barWidth,
              height: maxHeight,
              backgroundColor: COLORS.primary,
              transform: [
                {
                  scaleY: animatedValue,
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  variant = 'inline',
  size = 'large'
}) => {
  const renderContent = () => (
    <AnimatedEqualizer size={size} />
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
  equalizerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  equalizerBar: {
    borderRadius: 2,
  },
  fullscreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactContainer: {
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
