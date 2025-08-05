import React from 'react';
import { Tabs } from 'expo-router';
import SpecialistTabBar from '../../../src/components/navigation/SpecialistTabBar';

export default function SpecialistTabLayout() {
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' }, // Hide default tab bar
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="patients" />
        <Tabs.Screen name="appointments" />
        <Tabs.Screen name="profile" />
      </Tabs>

      <SpecialistTabBar />
    </>
  );
}