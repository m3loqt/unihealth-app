import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '../../hooks/auth/useAuth';
import { useRealtimeNotificationContext } from '../../contexts/RealtimeNotificationContext';
import { databaseService } from '../../services/database/firebase';

const NotificationDebugger: React.FC = () => {
  const { user } = useAuth();
  const { notifications: realtimeNotificationData } = useRealtimeNotificationContext();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.uid && user?.role === 'specialist') {
      loadAppointments();
    }
  }, [user?.uid, user?.role]);

  const loadAppointments = async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    try {
      const userAppointments = await databaseService.getAppointments(user.uid, 'specialist');
      setAppointments(userAppointments);
      console.log('🔔 Debug - Specialist appointments:', userAppointments);
    } catch (error) {
      console.error('🔔 Debug - Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'specialist') {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notification Debugger (Specialist)</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Info:</Text>
        <Text style={styles.text}>UID: {user?.uid}</Text>
        <Text style={styles.text}>Role: {user?.role}</Text>
        <Text style={styles.text}>Email: {user?.email}</Text>
        <Text style={styles.text}>Name: {user?.firstName} {user?.lastName}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications:</Text>
        <Text style={styles.text}>Count: {realtimeNotificationData.notifications?.length || 0}</Text>
        <Text style={styles.text}>Unread: {realtimeNotificationData.unreadCount || 0}</Text>
        <Text style={styles.text}>Loading: {realtimeNotificationData.loading ? 'Yes' : 'No'}</Text>
        <Text style={styles.text}>Error: {realtimeNotificationData.error || 'None'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appointments ({appointments.length}):</Text>
        <ScrollView style={styles.scrollView}>
          {appointments.map((appointment, index) => (
            <View key={appointment.id || index} style={styles.appointmentItem}>
              <Text style={styles.text}>ID: {appointment.id}</Text>
              <Text style={styles.text}>Status: {appointment.status}</Text>
              <Text style={styles.text}>Doctor ID: {appointment.doctorId}</Text>
              <Text style={styles.text}>Patient: {appointment.patientFirstName} {appointment.patientLastName}</Text>
              <Text style={styles.text}>Date: {appointment.appointmentDate}</Text>
              <Text style={styles.text}>Time: {appointment.appointmentTime}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f0f0f0',
    margin: 16,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  text: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  scrollView: {
    maxHeight: 200,
  },
  appointmentItem: {
    backgroundColor: '#fff',
    padding: 8,
    marginBottom: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
});

export default NotificationDebugger;
