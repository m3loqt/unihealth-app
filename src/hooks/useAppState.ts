import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { onlineStatusService } from '../services/onlineStatusService';
import { useAuth } from './auth/useAuth';

/**
 * Hook to handle app state changes and manage online status accordingly
 */
export const useAppState = () => {
  const { user } = useAuth();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      console.log(' App state changed from', appState.current, 'to', nextAppState);
      
      if (!user?.uid) {
        appState.current = nextAppState;
        return;
      }

      try {
        if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
          // App came to foreground
          console.log('🟢 App came to foreground - setting user online');
          await onlineStatusService.setUserOnline(user.uid);
        } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
          // App went to background
          console.log(' App went to background - setting user away');
          await onlineStatusService.setUserStatus(user.uid, 'away');
        }
      } catch (error) {
        console.error(' Error handling app state change:', error);
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [user?.uid]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (user?.uid) {
        onlineStatusService.cleanupUserStatus(user.uid).catch(console.error);
      }
    };
  }, [user?.uid]);
};
