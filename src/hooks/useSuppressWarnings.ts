import { useEffect } from 'react';
import { LogBox } from 'react-native';

export const useSuppressWarnings = () => {
  useEffect(() => {
    // Suppress TouchableMixin deprecation warning from third-party libraries
    LogBox.ignoreLogs([
      'TouchableMixin is deprecated. Please use Pressable.',
      'Unknown event handler property `onResponderMove`. It will be ignored.',
      'Unknown event handler property `onResponderRelease`. It will be ignored.',
      'Unknown event handler property `onResponderTerminate`. It will be ignored.',
      'Unknown event handler property `onPressOut`. It will be ignored.',
    ]);
  }, []);
};
