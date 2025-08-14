import React, { useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
        
        if (hasSeenOnboarding === 'true') {
          router.replace('/signin');
        } else {
          router.replace('/splash');
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // Default to splash if there's an error
        router.replace('/splash');
      }
    };

    checkOnboardingStatus();
  }, []);

  return null; // This component doesn't render anything
}
