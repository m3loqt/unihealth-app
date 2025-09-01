import { useEffect, useRef, useState } from 'react';
import { 
  Keyboard, 
  KeyboardEvent, 
  Platform, 
  Dimensions,
  Animated,
  EmitterSubscription
} from 'react-native';

interface KeyboardAvoidanceOptions {
  /**
   * Additional offset to add to the keyboard height
   * Useful for custom bottom bars or safe areas
   */
  extraOffset?: number;
  
  /**
   * Whether to enable keyboard avoidance
   * Default: true
   */
  enabled?: boolean;
  
  /**
   * Animation duration for keyboard transitions
   * Default: 250ms
   */
  animationDuration?: number;
  
  /**
   * Whether to use native driver for animations
   * Default: true for better performance
   */
  useNativeDriver?: boolean;
}

interface KeyboardAvoidanceReturn {
  /**
   * Animated value for keyboard height
   * Use this to animate your content
   */
  keyboardHeight: Animated.Value;
  
  /**
   * Current keyboard height in pixels
   */
  keyboardHeightValue: number;
  
  /**
   * Whether keyboard is currently visible
   */
  isKeyboardVisible: boolean;
  
  /**
   * Function to manually dismiss keyboard
   */
  dismissKeyboard: () => void;
  
  /**
   * Function to scroll to a specific input field
   * @param inputRef - Reference to the input field
   * @param offset - Additional offset from the input field
   */
  scrollToInput: (inputRef: any, offset?: number) => void;
}

/**
 * Custom hook for handling keyboard avoidance in React Native
 * Provides animated values and utilities for smooth keyboard interactions
 */
export const useKeyboardAvoidance = (
  options: KeyboardAvoidanceOptions = {}
): KeyboardAvoidanceReturn => {
  const {
    extraOffset = 0,
    enabled = true,
    animationDuration = 250,
    useNativeDriver = true,
  } = options;

  const [keyboardHeightValue, setKeyboardHeightValue] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  const keyboardHeight = useRef(new Animated.Value(0)).current;
  const keyboardShowListener = useRef<EmitterSubscription | null>(null);
  const keyboardHideListener = useRef<EmitterSubscription | null>(null);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const scrollToInput = (inputRef: any, offset: number = 20) => {
    if (!inputRef?.current) return;
    
    // Use setTimeout to ensure the keyboard animation has started
    setTimeout(() => {
      inputRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
        const screenHeight = Dimensions.get('window').height;
        const keyboardHeight = keyboardHeightValue;
        const availableHeight = screenHeight - keyboardHeight;
        
        // Calculate if input is covered by keyboard
        const inputBottom = y + height;
        const isCovered = inputBottom > availableHeight;
        
        if (isCovered) {
          // Calculate scroll offset needed
          const scrollOffset = inputBottom - availableHeight + offset;
          
          // For ScrollView, you would typically use scrollTo
          // This is a placeholder - actual implementation depends on your scroll component
          console.log('Input is covered, scroll offset needed:', scrollOffset);
        }
      });
    }, 100);
  };

  useEffect(() => {
    if (!enabled) return;

    const handleKeyboardShow = (event: KeyboardEvent) => {
      const { height } = event.endCoordinates;
      const finalHeight = height + extraOffset;
      
      setKeyboardHeightValue(finalHeight);
      setIsKeyboardVisible(true);
      
      Animated.timing(keyboardHeight, {
        toValue: finalHeight,
        duration: animationDuration,
        useNativeDriver,
      }).start();
    };

    const handleKeyboardHide = () => {
      setKeyboardHeightValue(0);
      setIsKeyboardVisible(false);
      
      Animated.timing(keyboardHeight, {
        toValue: 0,
        duration: animationDuration,
        useNativeDriver,
      }).start();
    };

    // Use different event names for iOS and Android
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    keyboardShowListener.current = Keyboard.addListener(showEvent, handleKeyboardShow);
    keyboardHideListener.current = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      keyboardShowListener.current?.remove();
      keyboardHideListener.current?.remove();
    };
  }, [enabled, extraOffset, animationDuration, useNativeDriver, keyboardHeight]);

  return {
    keyboardHeight,
    keyboardHeightValue,
    isKeyboardVisible,
    dismissKeyboard,
    scrollToInput,
  };
};

export default useKeyboardAvoidance;
