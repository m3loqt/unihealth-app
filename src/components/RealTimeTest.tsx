import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { usePatientProfile } from '../hooks/data/usePatientProfile';
import { useSpecialistProfile } from '../hooks/data/useSpecialistProfile';
import { useAuth } from '../hooks/auth/useAuth';

export const RealTimeTest: React.FC = () => {
  const { user } = useAuth();
  const { profile: patientProfile, updateProfile: updatePatientProfile } = usePatientProfile();
  const { profile: specialistProfile, updateProfile: updateSpecialistProfile } = useSpecialistProfile();
  const [testCount, setTestCount] = useState(0);

  const testPatientUpdate = async () => {
    if (!user) return;
    
    try {
      const testData = {
        contactNumber: `Test Phone ${testCount + 1}`,
        address: `Test Address ${testCount + 1}`,
        lastUpdated: new Date().toISOString(),
      };
      
      console.log('=== RealTimeTest: Testing patient update ===');
      console.log('Test data:', testData);
      
      await updatePatientProfile(testData);
      setTestCount(prev => prev + 1);
      Alert.alert('Success', 'Patient profile updated! Check if it reflects in real-time.');
    } catch (error) {
      console.error('Error updating patient profile:', error);
      Alert.alert('Error', 'Failed to update patient profile');
    }
  };

  const testSpecialistUpdate = async () => {
    if (!user) return;
    
    try {
      const testData = {
        specialty: `Test Specialty ${testCount + 1}`,
        yearsOfExperience: testCount + 1,
        lastUpdated: new Date().toISOString(),
      };
      
      await updateSpecialistProfile(testData);
      setTestCount(prev => prev + 1);
      Alert.alert('Success', 'Specialist profile updated! Check if it reflects in real-time.');
    } catch (error) {
      console.error('Error updating specialist profile:', error);
      Alert.alert('Error', 'Failed to update specialist profile');
    }
  };

  const testSimpleUpdate = async () => {
    if (!user) return;
    
    try {
      const testData = {
        contactNumber: `Simple ${Date.now()}`,
        lastUpdated: new Date().toISOString(),
      };
      
      console.log('=== RealTimeTest: Testing simple update ===');
      console.log('Test data:', testData);
      
      await updatePatientProfile(testData);
      Alert.alert('Success', 'Simple update completed! Check console for logs.');
    } catch (error) {
      console.error('Error in simple update:', error);
      Alert.alert('Error', 'Failed to update');
    }
  };

  const testDataFlow = async () => {
    if (!user) return;
    
    try {
      console.log('=== RealTimeTest: Testing data flow ===');
      console.log('Current profile state:', patientProfile);
      
      // Test with a very specific address
      const testAddress = `Flow Test ${Date.now()}`;
      const testData = {
        address: testAddress,
        lastUpdated: new Date().toISOString(),
      };
      
      console.log('Test data to send:', testData);
      console.log('Expected address after update:', testAddress);
      
      // Update the profile
      await updatePatientProfile(testData);
      
      console.log('Update call completed');
      console.log('Waiting for real-time update...');
      
      // Wait a moment and then check the state
      setTimeout(() => {
        console.log('=== Data Flow Check ===');
        console.log('Profile after timeout:', patientProfile);
        console.log('Address after timeout:', patientProfile?.address);
        console.log('Expected address was:', testAddress);
        console.log('Addresses match:', patientProfile?.address === testAddress);
      }, 1000);
      
      Alert.alert('Data Flow Test', 'Check console for detailed data flow information.');
    } catch (error) {
      console.error('Error in data flow test:', error);
      Alert.alert('Error', 'Failed to test data flow');
    }
  };

  const checkDatabaseState = async () => {
    if (!user) return;
    
    try {
      console.log('=== RealTimeTest: Checking database state ===');
      console.log('User ID:', user.uid);
      
      // This will trigger the real-time listener and show us the current state
      console.log('Current patient profile from hook:', patientProfile);
      console.log('Current specialist profile from hook:', specialistProfile);
      
      Alert.alert('Database State', 'Check console for current database state information.');
    } catch (error) {
      console.error('Error checking database state:', error);
      Alert.alert('Error', 'Failed to check database state');
    }
  };

  const testAddressOnlyUpdate = async () => {
    if (!user) return;
    
    try {
      const testData = {
        address: `Address Test ${Date.now()}`,
        lastUpdated: new Date().toISOString(),
      };
      
      console.log('=== RealTimeTest: Testing address-only update ===');
      console.log('Test data:', testData);
      console.log('Current profile before update:', patientProfile);
      console.log('Current address before update:', patientProfile?.address);
      
      await updatePatientProfile(testData);
      
      console.log('Address-only update call completed');
      console.log('Profile should update automatically via real-time listener');
      
      Alert.alert('Success', 'Address-only update completed! Check console for logs.');
    } catch (error) {
      console.error('Error in address-only update:', error);
      Alert.alert('Error', 'Failed to update address');
    }
  };

  const testAddressUpdate = async () => {
    if (!user) return;
    
    try {
      const testData = {
        address: `Test Address ${Date.now()}`,
        lastUpdated: new Date().toISOString(),
      };
      
      console.log('=== RealTimeTest: Testing address update ===');
      console.log('Test data:', testData);
      
      await updatePatientProfile(testData);
      Alert.alert('Success', 'Address update completed! Check console for logs.');
    } catch (error) {
      console.error('Error in address update:', error);
      Alert.alert('Error', 'Failed to update address');
    }
  };

  const testMinimalUpdate = async () => {
    if (!user) return;
    
    try {
      const testData = {
        contactNumber: `Minimal ${Date.now()}`,
      };
      
      console.log('=== RealTimeTest: Testing minimal update ===');
      console.log('Test data:', testData);
      console.log('Current profile before update:', patientProfile);
      
      await updatePatientProfile(testData);
      
      console.log('Update call completed');
      console.log('Profile should update automatically via real-time listener');
      
      Alert.alert('Success', 'Minimal update completed! Check console for logs.');
    } catch (error) {
      console.error('Error in minimal update:', error);
      Alert.alert('Error', 'Failed to update');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Real-Time Profile Test & Debug</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Patient Profile (Raw Data)</Text>
        <Text>ID: {patientProfile?.id || 'Not set'}</Text>
        <Text>First Name: {patientProfile?.firstName || 'Not set'}</Text>
        <Text>Last Name: {patientProfile?.lastName || 'Not set'}</Text>
        <Text>Contact Number: {patientProfile?.contactNumber || 'Not set'}</Text>
        <Text>Address: {patientProfile?.address || 'Not set'}</Text>
        <Text>Email: {patientProfile?.email || 'Not set'}</Text>
        <Text>Last Updated: {patientProfile?.lastUpdated || 'Never'}</Text>
        <Text>Emergency Contact: {JSON.stringify(patientProfile?.emergencyContact || 'Not set')}</Text>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={testPatientUpdate}>
            <Text style={styles.buttonText}>Test Full Update</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={testSimpleUpdate}>
            <Text style={styles.buttonText}>Test Simple Update</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={testAddressUpdate}>
            <Text style={styles.buttonText}>Test Address Update</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={testAddressOnlyUpdate}>
            <Text style={styles.buttonText}>Test Address Only</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={testMinimalUpdate}>
            <Text style={styles.buttonText}>Test Minimal Update</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={testDataFlow}>
            <Text style={styles.buttonText}>Test Data Flow</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Specialist Profile (Raw Data)</Text>
        <Text>ID: {specialistProfile?.id || 'Not set'}</Text>
        <Text>First Name: {specialistProfile?.firstName || 'Not set'}</Text>
        <Text>Last Name: {specialistProfile?.lastName || 'Not set'}</Text>
        <Text>Specialty: {specialistProfile?.specialty || 'Not set'}</Text>
        <Text>Experience: {specialistProfile?.yearsOfExperience || 0} years</Text>
        <Text>Contact Number: {specialistProfile?.contactNumber || 'Not set'}</Text>
        <Text>Address: {specialistProfile?.address || 'Not set'}</Text>
        <Text>Last Updated: {specialistProfile?.lastUpdated || 'Never'}</Text>
        
        <TouchableOpacity style={styles.button} onPress={testSpecialistUpdate}>
          <Text style={styles.buttonText}>Test Specialist Update</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Debug Information</Text>
        <Text>User ID: {user?.uid || 'Not authenticated'}</Text>
        <Text>Test Count: {testCount}</Text>
        <TouchableOpacity style={styles.button} onPress={checkDatabaseState}>
          <Text style={styles.buttonText}>Check Database State</Text>
        </TouchableOpacity>
        <Text style={styles.instructions}>
          Check the console logs for detailed debugging information.
        </Text>
      </View>

      <Text style={styles.instructions}>
        Tap the buttons to test real-time updates. The profile data should update automatically without refreshing.
        Check the console for detailed logs about the update process.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  button: {
    backgroundColor: '#1E40AF',
    padding: 12,
    borderRadius: 6,
    marginTop: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  instructions: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginTop: 20,
  },
});
