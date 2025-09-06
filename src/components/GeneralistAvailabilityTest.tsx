import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { databaseService } from '../services/database/firebase';

interface GeneralistAvailabilityTestProps {
  doctorId: string;
}

export const GeneralistAvailabilityTest: React.FC<GeneralistAvailabilityTestProps> = ({ doctorId }) => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testGeneralistAvailability = async () => {
    setLoading(true);
    setTestResults([]);
    
    try {
      addResult('Starting generalist availability test...');
      
      // Get doctor data
      const doctor = await databaseService.getDoctorById(doctorId);
      if (!doctor) {
        addResult('❌ Doctor not found');
        return;
      }
      
      addResult(`✅ Doctor found: ${doctor.fullName}`);
      addResult(`Is Specialist: ${doctor.isSpecialist}`);
      
      if (doctor.isSpecialist) {
        addResult('⚠️ This is a specialist, not a generalist');
        return;
      }
      
      // Check availability structure
      if (!doctor.availability?.weeklySchedule) {
        addResult('❌ No availability data found');
        return;
      }
      
      addResult('✅ Availability data found');
      
      // Test each day
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const availableDays: number[] = [];
      
      dayNames.forEach((dayName, index) => {
        const daySchedule = doctor.availability.weeklySchedule[dayName as keyof typeof doctor.availability.weeklySchedule];
        
        if (daySchedule?.enabled && daySchedule.timeSlots && daySchedule.timeSlots.length > 0) {
          const hasValidTimeSlots = daySchedule.timeSlots.some(slot => 
            slot.startTime && slot.endTime && 
            slot.startTime.trim() !== '' && slot.endTime.trim() !== ''
          );
          
          if (hasValidTimeSlots) {
            availableDays.push(index);
            addResult(`✅ ${dayName}: Available (${daySchedule.timeSlots.length} slots)`);
          } else {
            addResult(`⚠️ ${dayName}: Enabled but no valid time slots`);
          }
        } else {
          addResult(`❌ ${dayName}: Not available`);
        }
      });
      
      addResult(`\n📊 Summary: ${availableDays.length} days available out of 7`);
      addResult(`Available days: ${availableDays.map(i => dayNames[i]).join(', ')}`);
      
    } catch (error) {
      addResult(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Generalist Availability Test</Text>
      <Text style={styles.subtitle}>Doctor ID: {doctorId}</Text>
      
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={testGeneralistAvailability}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Testing...' : 'Test Availability'}
        </Text>
      </TouchableOpacity>
      
      <View style={styles.results}>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.resultText}>{result}</Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    margin: 8,
    borderRadius: 8,
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
    maxHeight: 300,
  },
  resultText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
});
