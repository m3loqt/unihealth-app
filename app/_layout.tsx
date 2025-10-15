import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '../src/hooks/useFrameworkReady';
import { useSuppressWarnings } from '../src/hooks/useSuppressWarnings';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '../src/hooks/auth/useAuth';
import { RealtimeNotificationProvider } from '../src/contexts/RealtimeNotificationContext';
import { SignatureProvider } from '../src/contexts/SignatureContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppStateManager } from '../src/components/AppStateManager';

// Keep the splash screen visible while we fetch the initial state
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useFrameworkReady();
  useSuppressWarnings(); // Suppress TouchableMixin deprecation warnings

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AuthProvider>
      <AppStateManager />
      <RealtimeNotificationProvider>
        <SignatureProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="splash" />
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="signin" />
            <Stack.Screen name="(auth)/forgot-password" />
            <Stack.Screen name="(auth)/reset-password" />
            <Stack.Screen name="(auth)/signup/step1" />
            <Stack.Screen name="(auth)/signup/step2" />
            <Stack.Screen name="(auth)/signup/step3" />
            <Stack.Screen name="(patient)/tabs" />
            <Stack.Screen name="(specialist)/tabs" />
            <Stack.Screen name="(specialist)/schedule" />
            <Stack.Screen name="(specialist)/referral-details" />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="dark" />
        </SignatureProvider>
      </RealtimeNotificationProvider>
    </AuthProvider>
  );
}