import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

interface HintBubbleProps {
  visible: boolean;
  title: string;
  message: string;
  suggestion?: string;
  position?: 'left' | 'right';
}

export const HintBubble: React.FC<HintBubbleProps> = ({
  visible,
  title,
  message,
  suggestion,
  position = 'right',
}) => {
  if (!visible) return null;

  const tooltipStyle = position === 'left' ? styles.tooltipLeft : styles.tooltip;
  const arrowStyle = position === 'left' ? styles.tooltipArrowLeft : styles.tooltipArrow;

  return (
    <View style={tooltipStyle}>
      <View style={styles.tooltipBubble}>
        <Text style={styles.tooltipText}>
          {title}: {message}
          {suggestion && `\n💡 ${suggestion}`}
        </Text>
      </View>
      <View style={arrowStyle} />
    </View>
  );
};

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    top: -10,
    left: 30,
    zIndex: 1000,
  },
  tooltipLeft: {
    position: 'absolute',
    top: -10,
    right: 30,
    zIndex: 1000,
  },
  tooltipBubble: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 140,
    maxWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
    lineHeight: 16,
  },
  tooltipArrow: {
    position: 'absolute',
    top: 12,
    left: -6,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#1F2937',
  },
  tooltipArrowLeft: {
    position: 'absolute',
    top: 12,
    right: -6,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#1F2937',
  },
});
