import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  Bell,
  Calendar,
  Users,
  FileText,
  TrendingUp,
  Clock,
  CircleCheck as CheckCircle,
  CircleAlert as AlertCircle,
  QrCode,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { getGreeting } from '../../../src/utils/greeting';
import { getFirstName } from '../../../src/utils/string';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { databaseService } from '../../../src/services/database/firebase';

export default function SpecialistHomeScreen() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    totalPatients: 0,
    todayAppointments: 0,
    pendingRequests: 0,
    completedToday: 0,
  });
  const [nextAppointments, setNextAppointments] = useState<any[]>([]);
  const [newPatients, setNewPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load dashboard data from Firebase
  useEffect(() => {
    if (user && user.uid) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Load all data in parallel
      const [
        patients,
        appointments,
        pendingAppointments,
        completedAppointments
      ] = await Promise.all([
        databaseService.getPatientsBySpecialist(user.uid),
        databaseService.getAppointmentsBySpecialist(user.uid),
        databaseService.getAppointmentsBySpecialistAndStatus(user.uid, 'pending'),
        databaseService.getAppointmentsBySpecialistAndStatus(user.uid, 'completed')
      ]);

      // Calculate today's appointments
      const today = new Date().toDateString();
      const todayAppointments = appointments.filter(apt => 
        new Date(apt.appointmentDate).toDateString() === today
      );

      // Calculate completed today
      const completedToday = completedAppointments.filter(apt => 
        new Date(apt.appointmentDate).toDateString() === today
      );

      // Get next 3 appointments
      const upcomingAppointments = appointments
        .filter(apt => apt.status === 'confirmed')
        .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())
        .slice(0, 3);

      // Get recent patients
      const recentPatients = patients
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 3);

      setDashboardData({
        totalPatients: patients.length,
        todayAppointments: todayAppointments.length,
        pendingRequests: pendingAppointments.length,
        completedToday: completedToday.length,
      });

      setNextAppointments(upcomingAppointments);
      setNewPatients(recentPatients);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const dashboardMetrics = [
    {
      id: 1,
      title: 'Total Patients',
      value: dashboardData.totalPatients.toString(),
      change: '+12 this month',
      icon: Users,
      onPress: () => router.push('/(specialist)/tabs/patients'),
    },
    {
      id: 2,
      title: "Today's Appointments",
      value: dashboardData.todayAppointments.toString(),
      change: `${dashboardData.pendingRequests} pending`,
      icon: Calendar,
      onPress: () => router.push('/(specialist)/tabs/appointments?filter=confirmed'),
    },
    {
      id: 3,
      title: 'Pending Requests',
      value: dashboardData.pendingRequests.toString(),
      change: 'Requires action',
      icon: AlertCircle,
      onPress: () => router.push('/(specialist)/tabs/appointments?filter=pending'),
    },
    {
      id: 4,
      title: 'Completed Today',
      value: dashboardData.completedToday.toString(),
      change: '+3 from yesterday',
      icon: CheckCircle,
      onPress: () => router.push('/(specialist)/tabs/appointments?filter=completed'),
    },
  ];

  // Simulate navigation to QR scanner
  const handleScanQR = () => {
    router.push('/(specialist)/tabs/patients');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E40AF" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
                         <Text style={styles.userName}>{getFirstName(user?.name || 'Specialist')}</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton}>
              <Bell size={24} color="#6B7280" />
              {/* {notifications > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationText}>{notifications}</Text>
                </View>
              )} */}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(specialist)/tabs/profile')}>
                             <Image
                 source={{ uri: 'https://via.placeholder.com/36' }}
                 style={styles.profileImage}
               />
            </TouchableOpacity>
          </View>
        </View>

        {/* Dashboard Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dashboard</Text>
          <View style={styles.metricsGrid}>
            {dashboardMetrics.map((metric) => (
              <TouchableOpacity
                key={metric.id}
                style={styles.metricCard}
                onPress={metric.onPress}
                activeOpacity={0.8}
              >
                <View style={styles.metricHeader}>
                  <View style={styles.metricIcon}>
                    <metric.icon size={20} color="#1E40AF" />
                  </View>
                  <TrendingUp size={16} color="#9CA3AF" />
                </View>
                <Text style={styles.metricValue}>{metric.value}</Text>
                <Text style={styles.metricTitle}>{metric.title}</Text>
                <Text style={styles.metricChange}>{metric.change}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Scan Patient QR Code */}
        <View style={[styles.section, { marginTop: 4 }]}>
          <Text style={styles.sectionTitle}>Quick Action</Text>
          <TouchableOpacity
            style={styles.qrScanButton}
            onPress={handleScanQR}
            activeOpacity={0.88}
          >
            <QrCode size={28} color="#1E40AF" />
            <Text style={styles.qrScanText}>Scan Patient QR Code</Text>
          </TouchableOpacity>
        </View>

        {/* Next Appointments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Next Appointments</Text>
            <TouchableOpacity onPress={() => router.push('/(specialist)/tabs/appointments')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.appointmentsContainer}>
            {nextAppointments.length > 0 ? (
              nextAppointments.map((appointment) => {
                const patientName = `${appointment.patientFirstName} ${appointment.patientLastName}`;
                const patientInitials = `${appointment.patientFirstName?.[0] || ''}${appointment.patientLastName?.[0] || ''}`;
                return (
                  <TouchableOpacity key={appointment.id} style={styles.appointmentCard}>
                    <View style={styles.appointmentHeader}>
                      <View style={styles.patientAvatar}>
                        <Text style={styles.patientInitial}>
                          {patientInitials}
                        </Text>
                      </View>
                      <View style={styles.appointmentDetails}>
                        <Text style={styles.patientName}>{patientName}</Text>
                        <Text style={styles.appointmentType}>{appointment.type}</Text>
                      </View>
                      <View style={styles.appointmentTime}>
                        <Clock size={16} color="#6B7280" />
                        <Text style={styles.timeText}>{appointment.appointmentTime}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Calendar size={48} color="#9CA3AF" />
                <Text style={styles.emptyStateTitle}>No upcoming appointments</Text>
                <Text style={styles.emptyStateText}>
                  You don't have any appointments scheduled for today.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Newly Added Patients */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Newly Added Patients</Text>
            <TouchableOpacity onPress={() => router.push('/(specialist)/tabs/patients')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.patientsContainer}>
            {newPatients.length > 0 ? (
              newPatients.map((patient) => {
                const patientName = `${patient.patientFirstName} ${patient.patientLastName}`;
                const patientInitials = `${patient.patientFirstName?.[0] || ''}${patient.patientLastName?.[0] || ''}`;
                return (
                  <TouchableOpacity key={patient.id} style={styles.patientCard}>
                    <View style={styles.patientHeader}>
                      <View style={styles.patientAvatar}>
                        <Text style={styles.patientInitial}>
                          {patientInitials}
                        </Text>
                      </View>
                      <View style={styles.patientDetails}>
                        <Text style={styles.patientName}>{patientName}</Text>
                        <Text style={styles.referredFrom}>Referred from {patient.referredFrom}</Text>
                      </View>
                      <View style={styles.patientStatus}>
                        <Text style={styles.addedDate}>{patient.createdAt ? new Date(patient.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Recent'}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Users size={48} color="#9CA3AF" />
                <Text style={styles.emptyStateTitle}>No new patients</Text>
                <Text style={styles.emptyStateText}>
                  You haven't added any new patients recently.
                </Text>
              </View>
            )}
          </View>
        </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  greeting: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  userName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginTop: 4,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 12,
  },
  section: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    borderRadius: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '48%',
    marginBottom: 12,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  metricTitle: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 4,
  },
  metricChange: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },

  // QR Scan Button Styles
  qrScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingVertical: 22,
    paddingHorizontal: 18,
    marginTop: 6,
    marginBottom: 8,
    shadowColor: 'transparent',
    justifyContent: 'center',
  },
  qrScanText: {
    fontSize: 16,
    color: '#1E40AF',
    fontFamily: 'Inter-SemiBold',
    marginLeft: 2,
    letterSpacing: 0.1,
  },

  appointmentsContainer: {
    gap: 12,
  },
  appointmentCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  patientInitial: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  appointmentDetails: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  appointmentType: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  appointmentTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  patientsContainer: {
    gap: 12,
  },
  patientCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientDetails: {
    flex: 1,
  },
  referredFrom: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  patientStatus: {
    alignItems: 'flex-end',
  },
  addedDate: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
 