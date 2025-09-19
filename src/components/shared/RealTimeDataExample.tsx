import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppointments, useReferrals, usePrescriptions, useMedicalHistory, useCertificates } from '../../hooks/data';
import { useRealtimeNotifications } from '../../hooks/data/useRealtimeNotifications';

export const RealTimeDataExample: React.FC = () => {
  const { appointments, loading: appointmentsLoading, error: appointmentsError } = useAppointments();
  const { referrals, loading: referralsLoading, error: referralsError } = useReferrals();
  const { prescriptions, loading: prescriptionsLoading, error: prescriptionsError } = usePrescriptions();
  const { medicalHistory, loading: medicalHistoryLoading, error: medicalHistoryError } = useMedicalHistory();
  const { certificates, loading: certificatesLoading, error: certificatesError } = useCertificates();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useRealtimeNotifications();

  const renderSection = (title: string, data: any[], loading: boolean, error: string | null) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {loading && <Text style={styles.loadingText}>Loading...</Text>}
      {error && <Text style={styles.errorText}>Error: {error}</Text>}
      {!loading && !error && (
        <Text style={styles.dataText}>
          {data.length} items loaded
        </Text>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Real-Time Data Example</Text>
      
      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications ({unreadCount} unread)</Text>
        {notifications.map((notification) => (
          <View key={notification.id} style={styles.notificationItem}>
            <Text style={styles.notificationTitle}>{notification.title}</Text>
            <Text style={styles.notificationMessage}>{notification.message}</Text>
            <Text style={styles.notificationTime}>
              {new Date(notification.timestamp).toLocaleString()}
            </Text>
            {!notification.read && (
              <TouchableOpacity
                style={styles.markReadButton}
                onPress={() => markAsRead(notification.id)}
              >
                <Text style={styles.buttonText}>Mark as Read</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllReadButton} onPress={markAllAsRead}>
            <Text style={styles.buttonText}>Mark All as Read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Appointments Section */}
      {renderSection('Appointments', appointments, appointmentsLoading, appointmentsError)}

      {/* Referrals Section */}
      {renderSection('Referrals', referrals, referralsLoading, referralsError)}

      {/* Prescriptions Section */}
      {renderSection('Prescriptions', prescriptions, prescriptionsLoading, prescriptionsError)}

      {/* Medical History Section */}
      {renderSection('Medical History', medicalHistory, medicalHistoryLoading, medicalHistoryError)}

      {/* Certificates Section */}
      {renderSection('Certificates', certificates, certificatesLoading, certificatesError)}

      <Text style={styles.infoText}>
        This component demonstrates real-time Firebase updates. 
        All data automatically updates when changes occur in the database.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
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
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  loadingText: {
    color: '#666',
    fontStyle: 'italic',
  },
  errorText: {
    color: '#d32f2f',
    fontWeight: '500',
  },
  dataText: {
    color: '#4caf50',
    fontWeight: '500',
  },
  notificationItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    marginBottom: 8,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  markReadButton: {
    backgroundColor: '#2196f3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  markAllReadButton: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  infoText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginTop: 20,
    paddingHorizontal: 20,
  },
});
