import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, View } from 'react-native';
import { databaseService } from '../../services/database/firebase';
import { useAuth } from '../../hooks/auth/useAuth';

export default function TestNotificationButton() {
  const { user } = useAuth();

  const createTestNotifications = async () => {
    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      Alert.alert(
        'Create Test Notifications',
        'This will create 3 sample notifications. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create',
            onPress: async () => {
              console.log('🧪 User clicked create test notifications');
              await databaseService.createTestNotifications(user.uid);
              Alert.alert('Success', 'Test notifications created! Check your notifications tab.');
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create test notifications');
      console.error('Error creating test notifications:', error);
    }
  };

  const createSimpleNotification = async () => {
    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      const message = `Test notification created at ${new Date().toLocaleTimeString()}`;
      console.log('🧪 Creating simple test notification');
      const notificationId = await databaseService.createSimpleTestNotification(user.uid, message);
      Alert.alert('Success', `Simple notification created with ID: ${notificationId}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to create simple notification');
      console.error('Error creating simple notification:', error);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={createTestNotifications}>
        <Text style={styles.buttonText}>Create Test Notifications</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.simpleButton} onPress={createSimpleNotification}>
        <Text style={styles.buttonText}>Create Simple Notification</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 8,
    alignSelf: 'center',
  },
  simpleButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 8,
    alignSelf: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});
