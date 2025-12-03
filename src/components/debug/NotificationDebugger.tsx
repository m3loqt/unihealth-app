import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../hooks/auth/useAuth';
import { realtimeNotificationService } from '../../services/realtimeNotificationService';
import { databaseService } from '../../services/database/firebase';

interface NotificationDebuggerProps {
  visible: boolean;
  onClose: () => void;
}

const NotificationDebugger: React.FC<NotificationDebuggerProps> = ({ visible, onClose }) => {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-9), `[${timestamp}] ${message}`]);
  };

  const testAsyncStorage = async () => {
    try {
      addLog('Testing AsyncStorage...');
      const testKey = 'test_notification_debug';
      const testData = { test: true, timestamp: Date.now() };
      
      await AsyncStorage.setItem(testKey, JSON.stringify(testData));
      addLog(' AsyncStorage.setItem successful');
      
      const retrieved = await AsyncStorage.getItem(testKey);
      if (retrieved) {
        const parsed = JSON.parse(retrieved);
        addLog(` AsyncStorage.getItem successful: ${JSON.stringify(parsed)}`);
      } else {
        addLog(' AsyncStorage.getItem returned null');
      }
      
      await AsyncStorage.removeItem(testKey);
      addLog(' AsyncStorage.removeItem successful');
    } catch (error) {
      addLog(` AsyncStorage error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testFirebaseConnection = async () => {
    try {
      addLog('Testing Firebase connection...');
      if (!user?.uid) {
        addLog(' No user UID available');
        return;
      }
      
      // Test getting user's appointments
      const appointments = await databaseService.getAppointments(user.uid, user.role || 'patient');
      addLog(` Firebase connection successful - found ${appointments.length} appointments`);
      
      // Test getting user's referrals based on role
      let referrals = [];
      if (user.role === 'specialist') {
        referrals = await databaseService.getReferralsBySpecialist(user.uid);
        addLog(` Firebase referrals successful - found ${referrals.length} referrals for specialist`);
      } else {
        referrals = await databaseService.getReferralsByPatient(user.uid);
        addLog(` Firebase referrals successful - found ${referrals.length} referrals for patient`);
      }
      
      // Debug referral details
      if (referrals.length > 0) {
        addLog(` Referral details for ${user.role} ${user.uid}:`);
        referrals.forEach((referral, index) => {
          addLog(`  ${index + 1}. ID: ${referral.id}`);
          addLog(`     Status: ${referral.status}`);
          addLog(`     Patient: ${referral.patientId}`);
          addLog(`     Assigned: ${referral.assignedSpecialistId}`);
          addLog(`     Referring: ${referral.referringSpecialistId || 'N/A'}`);
          addLog(`     Date: ${referral.appointmentDate} ${referral.appointmentTime}`);
        });
      } else {
        addLog(`ℹ️ No referrals found for ${user.role} ${user.uid}`);
      }
      
    } catch (error) {
      addLog(` Firebase error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testNotificationService = async () => {
    try {
      addLog('Testing notification service...');
      if (!user?.uid) {
        addLog(' No user UID available');
        return;
      }
      
      // Test getting notifications
      const notifications = await realtimeNotificationService.getNotifications(user.uid);
      addLog(` Notification service - found ${notifications.length} notifications`);
      
      // Test unread count
      const unreadCount = await realtimeNotificationService.getUnreadCount(user.uid);
      addLog(` Unread count: ${unreadCount}`);
      
    } catch (error) {
      addLog(` Notification service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const runAllTests = async () => {
    console.log(' runAllTests function called');
    setLogs([]);
    addLog('Starting comprehensive notification debugging...');
    addLog(`Platform: ${typeof window !== 'undefined' ? 'web' : 'mobile'}`);
    addLog(`User: ${user?.uid || 'Not logged in'}`);
    addLog(`User Role: ${user?.role || 'Unknown'}`);
    
    await testAsyncStorage();
    await testFirebaseConnection();
    await testNotificationService();
    
    addLog('Debugging complete!');
  };

  const clearNotificationCache = async () => {
    try {
      if (!user?.uid) return;
      
      await realtimeNotificationService.clearNotifications(user.uid);
      addLog(' Cleared notification cache');
    } catch (error) {
      addLog(` Error clearing cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const forceCheckMissedNotifications = async () => {
    try {
      if (!user?.uid) return;
      
      await realtimeNotificationService.forceCheckMissedNotifications(user.uid, user.role || 'patient');
      addLog(' Forced missed notification check');
    } catch (error) {
      addLog(` Error checking missed notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const createTestNotification = async () => {
    try {
      if (!user?.uid) return;
      
      addLog('Creating test notification...');
      
      // Create a fake test notification
      const testNotification = {
        id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'appointment' as const,
        title: 'Test Notification',
        message: `Test notification for ${user.role} user ${user.uid}`,
        timestamp: Date.now(),
        read: false,
        priority: 'high' as const,
        relatedId: 'test-appointment',
        status: 'pending'
      };
      
      // Get existing notifications
      const existing = await realtimeNotificationService.getNotifications(user.uid);
      const updated = [...existing, testNotification];
      
      // Save directly to AsyncStorage
      await AsyncStorage.setItem(`notifications_${user.uid}`, JSON.stringify(updated));
      
      // Force refresh
      await realtimeNotificationService.forceRefresh(user.uid);
      
      addLog(' Test notification created and saved');
    } catch (error) {
      addLog(` Error creating test notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notification Debugger</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.logsContainer}>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
      </ScrollView>
      
      <View style={styles.buttonContainer}>
        {/* Check Missed Button - Most Important */}
        <TouchableOpacity 
          onPress={() => {
            console.log(' Check Missed button pressed');
            forceCheckMissedNotifications();
          }} 
          style={[styles.button, { backgroundColor: '#DC3545' }]}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>Check Missed</Text>
        </TouchableOpacity>

        {/* Create Test Button */}
        <TouchableOpacity 
          onPress={() => {
            console.log(' Create Test Notification button pressed');
            createTestNotification();
          }} 
          style={[styles.button, { backgroundColor: '#FF6B35' }]}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>Create Test</Text>
        </TouchableOpacity>

        {/* Simple Test Button */}
        <TouchableOpacity 
          onPress={() => {
            console.log(' SIMPLE TEST BUTTON PRESSED!');
            addLog(' Simple test button works!');
          }} 
          style={[styles.button, { backgroundColor: '#28A745' }]}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>Simple Test</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => {
            console.log(' Run All Tests button pressed');
            runAllTests();
          }} 
          style={styles.button}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>Run All Tests</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => {
            console.log(' Test AsyncStorage button pressed');
            testAsyncStorage();
          }} 
          style={styles.button}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>Test AsyncStorage</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => {
            console.log(' Test Firebase button pressed');
            testFirebaseConnection();
          }} 
          style={styles.button}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>Test Firebase</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => {
            console.log(' Test Notifications button pressed');
            testNotificationService();
          }} 
          style={styles.button}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>Test Notifications</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => {
            console.log(' Clear Cache button pressed');
            clearNotificationCache();
          }} 
          style={styles.button}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>Clear Cache</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    zIndex: 1000,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  logsContainer: {
    flex: 1,
    padding: 16,
  },
  logText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    paddingBottom: 116, // 16 + 100 = 116px total bottom padding
    gap: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default NotificationDebugger;
