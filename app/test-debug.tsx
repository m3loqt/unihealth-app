import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { databaseService } from '../src/services/database/firebase';

export default function TestDebugPage() {
  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testBookingFunctionality = async () => {
    try {
      addResult('Starting booking functionality test...');
      
      // Test 1: Get booked time slots
      addResult('Test 1: Getting booked time slots...');
      const testDoctorId = 'test-doctor-1';
      const testDate = '2024-01-15';
      
      const bookedSlots = await databaseService.getBookedTimeSlots(testDoctorId, testDate);
      addResult(`Found ${bookedSlots.length} booked slots: ${bookedSlots.join(', ')}`);
      
      // Test 2: Get doctor schedule with bookings
      addResult('Test 2: Getting doctor schedule with bookings...');
      const scheduleData = await databaseService.getDoctorScheduleWithBookings(testDoctorId, testDate);
      addResult(`Schedule data - Available: ${scheduleData.availableSlots.length}, Booked: ${scheduleData.bookedSlots.length}, All: ${scheduleData.allSlots.length}`);
      
      // Test 3: Check if specific time slot is booked
      addResult('Test 3: Checking if time slot is booked...');
      const isBooked = await databaseService.isTimeSlotBooked(testDoctorId, testDate, '09:00');
      addResult(`Is 09:00 booked? ${isBooked}`);
      
      addResult('All tests completed!');
      
    } catch (error) {
      addResult(`Error: ${error}`);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Debug Test Page</Text>
      </View>

      <ScrollView style={styles.content}>
        <TouchableOpacity style={styles.testButton} onPress={testBookingFunctionality}>
          <Text style={styles.testButtonText}>Run Booking Tests</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.testButton, styles.clearButton]} onPress={clearResults}>
          <Text style={styles.testButtonText}>Clear Results</Text>
        </TouchableOpacity>

        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Test Results:</Text>
          {testResults.map((result, index) => (
            <Text key={index} style={styles.resultText}>{result}</Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#1E40AF',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  testButton: {
    backgroundColor: '#1E40AF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#6B7280',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
});
