import React from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router';
import TabBar from '@/src/components/navigation/TabBar';

export default function TabLayout() {
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' }, // Hide default tab bar
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="appointments" />
        <Tabs.Screen name="prescriptions" />
        <Tabs.Screen name="certificates" />
        <Tabs.Screen name="profile" />
      </Tabs>

      <TabBar />
    </>
  );
}
