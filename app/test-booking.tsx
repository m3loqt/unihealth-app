import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import TestBookingFunctionality from '../src/components/TestBookingFunctionality';

export default function TestBookingPage() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      <TestBookingFunctionality />
    </SafeAreaView>
  );
}
