import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, StyleSheet } from 'react-native';
import { databaseService } from '../services/database/firebase';

interface TestResult {
  testName: string;
  status: 'pending' | 'pass' | 'fail';
  message: string;
}

const TestBookingFunctionality: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const testDoctorId = 'test-doctor-123';
  const testDate = '2024-01-15';
  const testTime = '10:00';

  const addTestResult = (testName: string, status: 'pending' | 'pass' | 'fail', message: string) => {
    setTestResults(prev => [...prev, { testName, status, message }]);
  };

  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    try {
      console.log('🧪 Starting Booking Functionality Tests...');

      // Test 1: Check if time slot is initially available
      addTestResult('Initial Availability Check', 'pending', 'Checking if time slot is initially available...');
      const initiallyBooked = await databaseService.isTimeSlotBooked(testDoctorId, testDate, testTime);
      
      if (initiallyBooked) {
        addTestResult('Initial Availability Check', 'fail', `Time slot ${testTime} on ${testDate} is already booked initially`);
      } else {
        addTestResult('Initial Availability Check', 'pass', `Time slot ${testTime} on ${testDate} is available initially`);
      }

      // Test 2: Create first appointment
      addTestResult('First Appointment Creation', 'pending', 'Creating first appointment...');
      const appointment1 = {
        doctorId: testDoctorId,
        appointmentDate: testDate,
        appointmentTime: testTime,
        patientId: 'patient-1',
        clinicId: 'clinic-1',
        appointmentPurpose: 'Checkup',
        status: 'pending' as const,
        type: 'general_consultation' as const
      };
      
      const appointmentId1 = await databaseService.createAppointment(appointment1);
      addTestResult('First Appointment Creation', 'pass', `First appointment created with ID: ${appointmentId1}`);

      // Test 3: Check if time slot is now booked
      addTestResult('Post-Booking Availability Check', 'pending', 'Checking if time slot is now booked...');
      const nowBooked = await databaseService.isTimeSlotBooked(testDoctorId, testDate, testTime);
      
      if (nowBooked) {
        addTestResult('Post-Booking Availability Check', 'pass', `Time slot ${testTime} on ${testDate} is correctly marked as booked`);
      } else {
        addTestResult('Post-Booking Availability Check', 'fail', `Time slot ${testTime} on ${testDate} is not marked as booked after creation`);
      }

      // Test 4: Try to create second appointment for same time slot
      addTestResult('Double Booking Prevention', 'pending', 'Attempting to create second appointment for same time slot...');
      const appointment2 = {
        doctorId: testDoctorId,
        appointmentDate: testDate,
        appointmentTime: testTime,
        patientId: 'patient-2',
        clinicId: 'clinic-1',
        appointmentPurpose: 'Follow-up',
        status: 'pending' as const,
        type: 'general_consultation' as const
      };
      
      try {
        await databaseService.createAppointment(appointment2);
        addTestResult('Double Booking Prevention', 'fail', 'Second appointment was created when it should have been blocked!');
      } catch (error) {
        if (error instanceof Error && error.message.includes('already booked')) {
          addTestResult('Double Booking Prevention', 'pass', `Second appointment correctly blocked: "${error.message}"`);
        } else {
          addTestResult('Double Booking Prevention', 'fail', `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Test 5: Check booked time slots for the date
      addTestResult('Booked Slots Retrieval', 'pending', 'Checking all booked time slots for the date...');
      const bookedSlots = await databaseService.getBookedTimeSlots(testDoctorId, testDate);
      
      if (bookedSlots.includes(testTime)) {
        addTestResult('Booked Slots Retrieval', 'pass', `Booked slots for ${testDate}: [${bookedSlots.join(', ')}]`);
      } else {
        addTestResult('Booked Slots Retrieval', 'fail', `Booked slot ${testTime} not found in retrieved slots: [${bookedSlots.join(', ')}]`);
      }

      // Test 6: Try to book a different time slot (should succeed)
      addTestResult('Different Time Slot Booking', 'pending', 'Attempting to book a different time slot...');
      const appointment3 = {
        doctorId: testDoctorId,
        appointmentDate: testDate,
        appointmentTime: '11:00',
        patientId: 'patient-3',
        clinicId: 'clinic-1',
        appointmentPurpose: 'Consultation',
        status: 'pending' as const,
        type: 'general_consultation' as const
      };
      
      const appointmentId3 = await databaseService.createAppointment(appointment3);
      addTestResult('Different Time Slot Booking', 'pass', `Third appointment created with ID: ${appointmentId3}`);

      // Test 7: Check booked time slots again
      addTestResult('Multiple Booked Slots Check', 'pending', 'Checking all booked time slots again...');
      const bookedSlotsAfter = await databaseService.getBookedTimeSlots(testDoctorId, testDate);
      
      if (bookedSlotsAfter.includes('10:00') && bookedSlotsAfter.includes('11:00')) {
        addTestResult('Multiple Booked Slots Check', 'pass', `All booked slots correctly retrieved: [${bookedSlotsAfter.join(', ')}]`);
      } else {
        addTestResult('Multiple Booked Slots Check', 'fail', `Missing booked slots. Expected [10:00, 11:00], got [${bookedSlotsAfter.join(', ')}]`);
      }

      // Test 8: Test getDoctorScheduleWithBookings
      addTestResult('Schedule with Bookings', 'pending', 'Testing getDoctorScheduleWithBookings function...');
      const scheduleData = await databaseService.getDoctorScheduleWithBookings(testDoctorId, testDate);
      
      if (scheduleData.bookedSlots.includes('10:00') && scheduleData.bookedSlots.includes('11:00')) {
        addTestResult('Schedule with Bookings', 'pass', `Schedule data correctly shows booked slots: [${scheduleData.bookedSlots.join(', ')}]`);
      } else {
        addTestResult('Schedule with Bookings', 'fail', `Schedule data missing booked slots. Expected [10:00, 11:00], got [${scheduleData.bookedSlots.join(', ')}]`);
      }

      console.log('🎉 All tests completed!');

    } catch (error) {
      console.error(' Test failed:', error);
      addTestResult('Test Suite', 'fail', `Test suite failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  // New test: Create a test appointment and immediately check if it's detected
  const runQuickTest = async () => {
    setIsRunning(true);
    setTestResults([]);

    try {
      console.log('🧪 Running Quick Test...');

      // Create a test appointment
      const testAppointment = {
        doctorId: 'test-doctor-456',
        appointmentDate: '2024-01-20',
        appointmentTime: '14:00',
        patientId: 'test-patient-1',
        clinicId: 'test-clinic-1',
        appointmentPurpose: 'Test Appointment',
        status: 'pending' as const,
        type: 'general_consultation' as const
      };

      addTestResult('Create Test Appointment', 'pending', 'Creating test appointment...');
      const appointmentId = await databaseService.createAppointment(testAppointment);
      addTestResult('Create Test Appointment', 'pass', `Test appointment created with ID: ${appointmentId}`);

      // Immediately check if it's detected as booked
      addTestResult('Check Booked Detection', 'pending', 'Checking if appointment is detected as booked...');
      const isBooked = await databaseService.isTimeSlotBooked('test-doctor-456', '2024-01-20', '14:00');
      
      if (isBooked) {
        addTestResult('Check Booked Detection', 'pass', 'Appointment correctly detected as booked');
      } else {
        addTestResult('Check Booked Detection', 'fail', 'Appointment not detected as booked');
      }

      // Check booked slots
      addTestResult('Check Booked Slots', 'pending', 'Checking booked slots retrieval...');
      const bookedSlots = await databaseService.getBookedTimeSlots('test-doctor-456', '2024-01-20');
      
      if (bookedSlots.includes('14:00')) {
        addTestResult('Check Booked Slots', 'pass', `Booked slots correctly retrieved: [${bookedSlots.join(', ')}]`);
      } else {
        addTestResult('Check Booked Slots', 'fail', `Booked slot not found. Got: [${bookedSlots.join(', ')}]`);
      }

      // Test schedule with bookings
      addTestResult('Schedule with Bookings', 'pending', 'Testing schedule with bookings...');
      const scheduleData = await databaseService.getDoctorScheduleWithBookings('test-doctor-456', '2024-01-20');
      
      if (scheduleData.bookedSlots.includes('14:00')) {
        addTestResult('Schedule with Bookings', 'pass', `Schedule correctly shows booked slot: [${scheduleData.bookedSlots.join(', ')}]`);
      } else {
        addTestResult('Schedule with Bookings', 'fail', `Schedule missing booked slot. Got: [${scheduleData.bookedSlots.join(', ')}]`);
      }

    } catch (error) {
      console.error(' Quick test failed:', error);
      addTestResult('Quick Test', 'fail', `Quick test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const cleanupTestData = async () => {
    try {
      Alert.alert(
        'Cleanup Test Data',
        'This will delete all test appointments. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              // Note: In a real implementation, you would add a cleanup method to databaseService
              Alert.alert('Cleanup', 'Test data cleanup would be implemented here. For now, test data remains in the database.');
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to cleanup test data');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return '#10B981';
      case 'fail': return '#EF4444';
      case 'pending': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pass': return ' PASS';
      case 'fail': return ' FAIL';
      case 'pending': return '⏳ PENDING';
      default: return '❓ UNKNOWN';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Booking Functionality Test Suite</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.runButton, isRunning && styles.disabledButton]} 
          onPress={runTests}
          disabled={isRunning}
        >
          <Text style={styles.buttonText}>
            {isRunning ? 'Running Tests...' : 'Run Full Tests'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.quickButton, isRunning && styles.disabledButton]} 
          onPress={runQuickTest}
          disabled={isRunning}
        >
          <Text style={styles.buttonText}>
            {isRunning ? 'Running...' : 'Quick Test'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.cleanupButton]} 
          onPress={cleanupTestData}
        >
          <Text style={styles.buttonText}>Cleanup</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.resultsContainer}>
        {testResults.length === 0 ? (
          <Text style={styles.noResults}>No test results yet. Click "Run Tests" to start.</Text>
        ) : (
          testResults.map((result, index) => (
            <View key={index} style={styles.resultItem}>
              <View style={styles.resultHeader}>
                <Text style={[styles.statusText, { color: getStatusColor(result.status) }]}>
                  {getStatusText(result.status)}
                </Text>
                <Text style={styles.testName}>{result.testName}</Text>
              </View>
              <Text style={styles.resultMessage}>{result.message}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {testResults.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            Passed: {testResults.filter(r => r.status === 'pass').length} | 
            Failed: {testResults.filter(r => r.status === 'fail').length} | 
            Pending: {testResults.filter(r => r.status === 'pending').length}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#1F2937',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
  },
  runButton: {
    backgroundColor: '#3B82F6',
  },
  quickButton: {
    backgroundColor: '#10B981',
  },
  cleanupButton: {
    backgroundColor: '#EF4444',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 12,
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
  },
  noResults: {
    textAlign: 'center',
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 40,
  },
  resultItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#E5E7EB',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 8,
  },
  testName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  resultMessage: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  summary: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
  },
  summaryText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});

export default TestBookingFunctionality;
