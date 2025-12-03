import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { databaseService } from '../services/database/firebase';

interface GeneralistDateFilteringTestProps {
  doctorId: string;
}

export const GeneralistDateFilteringTest: React.FC<GeneralistDateFilteringTestProps> = ({ doctorId }) => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testDateFiltering = async () => {
    setLoading(true);
    setTestResults([]);
    
    try {
      addResult('Starting generalist date filtering test...');
      
      // Get doctor data
      const doctor = await databaseService.getDoctorById(doctorId);
      if (!doctor) {
        addResult(' Doctor not found');
        return;
      }
      
      addResult(` Doctor found: ${doctor.fullName}`);
      addResult(`Is Specialist: ${doctor.isSpecialist}`);
      
      if (doctor.isSpecialist) {
        addResult(' This is a specialist, not a generalist');
        return;
      }
      
      // Check availability structure
      if (!doctor.availability?.weeklySchedule) {
        addResult(' No availability data found');
        return;
      }
      
      addResult(' Availability data found');
      
      // Simulate the loadGeneralistAvailableDays logic
      const allAvailableDays = new Set<number>();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      dayNames.forEach((dayName, index) => {
        const daySchedule = doctor.availability.weeklySchedule[dayName as keyof typeof doctor.availability.weeklySchedule];
        
        if (daySchedule?.enabled && daySchedule.timeSlots && daySchedule.timeSlots.length > 0) {
          const hasValidTimeSlots = daySchedule.timeSlots.some(slot => 
            slot.startTime && slot.endTime && 
            slot.startTime.trim() !== '' && slot.endTime.trim() !== ''
          );
          
          if (hasValidTimeSlots) {
            allAvailableDays.add(index);
            addResult(` ${dayName} (${index}): Available`);
          } else {
            addResult(` ${dayName} (${index}): Enabled but no valid time slots`);
          }
        } else {
          addResult(` ${dayName} (${index}): Not available`);
        }
      });
      
      const availableDaysArray = Array.from(allAvailableDays).sort();
      addResult(`\n Available days: [${availableDaysArray.join(', ')}]`);
      
      // Test date filtering simulation
      addResult('\n🧪 Testing date filtering simulation:');
      const testDates = [
        { date: '2024-01-01', dayOfWeek: 1 }, // Monday
        { date: '2024-01-02', dayOfWeek: 2 }, // Tuesday
        { date: '2024-01-03', dayOfWeek: 3 }, // Wednesday
        { date: '2024-01-04', dayOfWeek: 4 }, // Thursday
        { date: '2024-01-05', dayOfWeek: 5 }, // Friday
        { date: '2024-01-06', dayOfWeek: 6 }, // Saturday
        { date: '2024-01-07', dayOfWeek: 0 }, // Sunday
      ];
      
      const filteredDates = testDates.filter(date => 
        availableDaysArray.includes(date.dayOfWeek)
      );
      
      addResult(`📅 Test dates: ${testDates.map(d => `${d.date}(${d.dayOfWeek})`).join(', ')}`);
      addResult(` Filtered dates: ${filteredDates.map(d => `${d.date}(${d.dayOfWeek})`).join(', ')}`);
      addResult(` Result: ${filteredDates.length} out of ${testDates.length} dates shown`);
      
    } catch (error) {
      addResult(` Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Generalist Date Filtering Test</Text>
      <Text style={styles.subtitle}>Doctor ID: {doctorId}</Text>
      
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={testDateFiltering}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Testing...' : 'Test Date Filtering'}
        </Text>
      </TouchableOpacity>
      
      <ScrollView style={styles.results}>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.resultText}>{result}</Text>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    margin: 8,
    borderRadius: 8,
    maxHeight: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  results: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 6,
    maxHeight: 250,
  },
  resultText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
});
