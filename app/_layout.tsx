import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '../src/hooks/useFrameworkReady';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '../src/hooks/auth/useAuth';


SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useFrameworkReady();

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

  // Initialize Google Speech-to-Text service
  useEffect(() => {
    // TODO: Replace with your actual Google Cloud API key
    // initializeGoogleSpeechToText('YOUR_GOOGLE_CLOUD_API_KEY');
    console.log('Google Speech-to-Text service ready to initialize');
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="splash" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="signin" />
        <Stack.Screen name="(auth)/forgot-password" />
        <Stack.Screen name="(auth)/reset-password" />
        <Stack.Screen name="(auth)/signup/step1" />
        <Stack.Screen name="(auth)/signup/step2" />
        <Stack.Screen name="(auth)/signup/step3" />
        <Stack.Screen name="(patient)/tabs" />
        <Stack.Screen name="(specialist)/tabs" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="dark" />
    </AuthProvider>
  );
}