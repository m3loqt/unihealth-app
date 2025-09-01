import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import {
  TextInput,
  TextInputProps,
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import { useKeyboardAvoidance } from '../../hooks/ui/useKeyboardAvoidance';

interface KeyboardAwareInputProps extends TextInputProps {
  /**
   * Whether to enable automatic keyboard avoidance
   * Default: true
   */
  enableKeyboardAvoidance?: boolean;
  
  /**
   * Additional offset when scrolling to this input
   * Default: 20
   */
  scrollOffset?: number;
  
  /**
   * Container style for the input wrapper
   */
  containerStyle?: any;
}

export interface KeyboardAwareInputRef {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  isFocused: () => boolean;
}

/**
 * A TextInput component that automatically handles keyboard avoidance
 * When focused, it will scroll to ensure the input is visible above the keyboard
 */
export const KeyboardAwareInput = forwardRef<
  KeyboardAwareInputRef,
  KeyboardAwareInputProps
>(({
  enableKeyboardAvoidance = true,
  scrollOffset = 20,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...textInputProps
}, ref) => {
  const inputRef = useRef<TextInput>(null);
  const { scrollToInput } = useKeyboardAvoidance({
    enabled: enableKeyboardAvoidance,
  });

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
    blur: () => {
      inputRef.current?.blur();
    },
    clear: () => {
      inputRef.current?.clear();
    },
    isFocused: () => {
      return inputRef.current?.isFocused() || false;
    },
  }));

  const handleFocus = (event: any) => {
    if (enableKeyboardAvoidance) {
      // Small delay to ensure the keyboard animation starts
      setTimeout(() => {
        scrollToInput(inputRef, scrollOffset);
      }, 100);
    }
    
    onFocus?.(event);
  };

  const handleBlur = (event: any) => {
    onBlur?.(event);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        ref={inputRef}
        style={[styles.input, style]}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...textInputProps}
      />
    </View>
  );
});

KeyboardAwareInput.displayName = 'KeyboardAwareInput';

const styles = StyleSheet.create({
  container: {
    // Container styles if needed
  },
  input: {
    // Default input styles
    fontSize: 16,
    color: '#1F2937',
    ...Platform.select({
      ios: {
        paddingVertical: 12,
      },
      android: {
        paddingVertical: 8,
      },
    }),
  },
});

export default KeyboardAwareInput;
