import React, { useState } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  View,
} from 'react-native';
import { AlertTriangle, Info } from 'lucide-react-native';
import { HintBubble } from './HintBubble';
import { getFieldValidationHint } from '../../utils/validationHints';

interface HintButtonProps {
  fieldName: string;
  hasError: boolean;
  value: string;
  minLength?: number;
  position?: 'left' | 'right';
}

export const HintButton: React.FC<HintButtonProps> = ({
  fieldName,
  hasError,
  value,
  minLength,
  position = 'right',
}) => {
  const [showHint, setShowHint] = useState(false);
  const hint = getFieldValidationHint(fieldName, hasError);
  
  // Show warning if field has error or doesn't meet minimum requirements
  const shouldShowWarning = hasError || (minLength && value.length > 0 && value.length < minLength);
  
  // Always show hint button for better user experience
  // Show warning icon only when there are actual issues

  return (
    <View style={styles.hintButtonContainer}>
      <TouchableOpacity
        style={styles.hintButton}
        onPress={() => setShowHint(!showHint)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {shouldShowWarning ? (
          <AlertTriangle size={16} color="#F59E0B" />
        ) : (
          <Info size={16} color="#3B82F6" />
        )}
      </TouchableOpacity>

      <HintBubble
        visible={showHint}
        title={hint.title}
        message={hint.message}
        suggestion={hint.suggestion}
        position={position}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  hintButtonContainer: {
    position: 'relative',
  },
  hintButton: {
    padding: 4,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
