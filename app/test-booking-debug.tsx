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

export default function TestBookingDebugPage() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testBookingFunctionality = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setTestResults([]);
    
    try {
      addResult('🚀 Starting simplified booking functionality test...');

             // Test 1: Get booked time slots for August 21, 2025
       addResult('📋 Test 1: Getting booked time slots for August 21, 2025...');
       const testDoctorId = 'test-doctor-1';
       const testDate = '2025-08-21';

       const bookedSlots = await databaseService.getBookedTimeSlots(testDoctorId, testDate);
       addResult(`✅ Found ${bookedSlots.length} booked slots for ${testDate}: ${bookedSlots.join(', ')}`);

       // Test 2: Check if specific time slot is booked
       addResult('⏰ Test 2: Checking if time slot is booked...');
       const isBooked = await databaseService.isTimeSlotBooked(testDoctorId, testDate, '9:20 AM');
       addResult(`✅ Is 9:20 AM booked? ${isBooked}`);
       
       // Test 2b: Check if 9:00 AM is booked (should not be)
       const isBooked9AM = await databaseService.isTimeSlotBooked(testDoctorId, testDate, '9:00 AM');
       addResult(`✅ Is 9:00 AM booked? ${isBooked9AM} (should be false)`);

      // Test 3: Test time format conversion
      addResult('🔄 Test 3: Testing time format conversion...');
      const testTimes = ['09:00', '14:30', '16:00'];
      testTimes.forEach(time => {
        const converted = time.split(':').map(Number);
        const ampm = converted[0] >= 12 ? 'PM' : 'AM';
        const displayHour = converted[0] % 12 || 12;
        const formatted = `${displayHour}:${converted[1].toString().padStart(2, '0')} ${ampm}`;
        addResult(`✅ ${time} → ${formatted}`);
      });

      // Test 4: Test with real doctor data
      addResult('👨‍⚕️ Test 4: Testing with real doctor data...');
      const doctors = await databaseService.getAllDoctors();
      if (doctors.length > 0) {
        const realDoctor = doctors[0];
        const realBookedSlots = await databaseService.getBookedTimeSlots(realDoctor.id, today);
        addResult(`✅ Real doctor ${realDoctor.firstName} ${realDoctor.lastName}: ${realBookedSlots.length} booked slots`);
      } else {
        addResult('⚠️ No real doctors found in database');
      }

      addResult('🎉 All tests completed successfully!');

    } catch (error) {
      addResult(`❌ Error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const testRealDoctor = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setTestResults([]);
    
    try {
      addResult('🔍 Testing with real doctor data...');
      
      // Get a real doctor ID from the database
      const doctors = await databaseService.getAllDoctors();
      if (doctors.length === 0) {
        addResult('❌ No doctors found in database');
        return;
      }
      
      const testDoctor = doctors[0];
      const today = new Date().toISOString().split('T')[0];
      
      addResult(`👨‍⚕️ Testing with doctor: ${testDoctor.firstName} ${testDoctor.lastName} (${testDoctor.id})`);
      addResult(`📅 Testing date: ${today}`);
      
      const bookedSlots = await databaseService.getBookedTimeSlots(testDoctor.id, today);
      addResult(`📋 Booked slots for today: ${bookedSlots.length} - ${bookedSlots.join(', ')}`);
      
      const scheduleData = await databaseService.getDoctorScheduleWithBookings(testDoctor.id, today);
      addResult(`📅 Schedule data - Available: ${scheduleData.availableSlots.length}, Booked: ${scheduleData.bookedSlots.length}`);
      
      addResult('✅ Real doctor test completed!');
      
    } catch (error) {
      addResult(`❌ Error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const navigateToBooking = () => {
    // Navigate to the booking page with test parameters
    router.push({
      pathname: '/(patient)/book-visit/select-datetime',
      params: {
        doctorId: 'test-doctor-1',
        clinicId: 'test-clinic-1',
        clinicName: 'Test Clinic',
        doctorName: 'Dr. Test Doctor',
        doctorSpecialty: 'General Medicine'
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Booking Debug Test</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.testButton, isRunning && styles.disabledButton]} 
            onPress={testBookingFunctionality}
            disabled={isRunning}
          >
            <Text style={styles.testButtonText}>
              {isRunning ? 'Running Tests...' : 'Run Booking Tests'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.testButton, styles.secondaryButton, isRunning && styles.disabledButton]} 
            onPress={testRealDoctor}
            disabled={isRunning}
          >
            <Text style={styles.testButtonText}>Test Real Doctor</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.testButton, styles.navigationButton]} 
            onPress={navigateToBooking}
          >
            <Text style={styles.testButtonText}>Go to Booking Page</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.testButton, styles.clearButton]} 
            onPress={clearResults}
          >
            <Text style={styles.testButtonText}>Clear Results</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Test Results:</Text>
          {testResults.length === 0 ? (
            <Text style={styles.noResultsText}>No test results yet. Run a test to see results.</Text>
          ) : (
            testResults.map((result, index) => (
              <Text key={index} style={styles.resultText}>{result}</Text>
            ))
          )}
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
  buttonContainer: {
    marginBottom: 16,
  },
  testButton: {
    backgroundColor: '#1E40AF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#059669',
  },
  navigationButton: {
    backgroundColor: '#7C3AED',
  },
  clearButton: {
    backgroundColor: '#6B7280',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
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
  noResultsText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  resultText: {
    fontSize: 14,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
});
