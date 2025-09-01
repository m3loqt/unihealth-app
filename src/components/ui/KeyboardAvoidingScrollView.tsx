import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  ScrollView,
  ScrollViewProps,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useKeyboardAvoidance } from '../../hooks/ui/useKeyboardAvoidance';

interface KeyboardAvoidingScrollViewProps extends ScrollViewProps {
  /**
   * Additional offset to add to the keyboard height
   */
  extraOffset?: number;
  
  /**
   * Whether to enable keyboard avoidance
   */
  enabled?: boolean;
  
  /**
   * Custom keyboard behavior
   * Default: 'padding' for iOS, 'height' for Android
   */
  keyboardBehavior?: 'height' | 'position' | 'padding';
  
  /**
   * Whether to enable keyboard avoidance view
   * Default: true
   */
  enableKeyboardAvoidingView?: boolean;
}

export interface KeyboardAvoidingScrollViewRef {
  scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => void;
  scrollToEnd: (options?: { animated?: boolean }) => void;
  scrollToInput: (inputRef: any, offset?: number) => void;
}

/**
 * A ScrollView component that automatically handles keyboard avoidance
 * Combines KeyboardAvoidingView with ScrollView for optimal keyboard handling
 */
export const KeyboardAvoidingScrollView = forwardRef<
  KeyboardAvoidingScrollViewRef,
  KeyboardAvoidingScrollViewProps
>(({
  children,
  extraOffset = 0,
  enabled = true,
  keyboardBehavior,
  enableKeyboardAvoidingView = true,
  style,
  contentContainerStyle,
  ...scrollViewProps
}, ref) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const { keyboardHeightValue, scrollToInput } = useKeyboardAvoidance({
    extraOffset,
    enabled,
  });

  useImperativeHandle(ref, () => ({
    scrollTo: (options) => {
      scrollViewRef.current?.scrollTo(options);
    },
    scrollToEnd: (options) => {
      scrollViewRef.current?.scrollToEnd(options);
    },
    scrollToInput: (inputRef, offset) => {
      scrollToInput(inputRef, offset);
    },
  }));

  const defaultKeyboardBehavior = Platform.OS === 'ios' ? 'padding' : 'height';
  const behavior = keyboardBehavior || defaultKeyboardBehavior;

  const scrollView = (
    <ScrollView
      ref={scrollViewRef}
      style={[styles.scrollView, style]}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: enabled ? keyboardHeightValue + extraOffset : 0 },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...scrollViewProps}
    >
      {children}
    </ScrollView>
  );

  if (!enableKeyboardAvoidingView || !enabled) {
    return scrollView;
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={behavior}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {scrollView}
    </KeyboardAvoidingView>
  );
});

KeyboardAvoidingScrollView.displayName = 'KeyboardAvoidingScrollView';

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
});

export default KeyboardAvoidingScrollView;
