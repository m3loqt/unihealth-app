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
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { BlurView } from 'expo-blur';
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
  X,
  AlertCircle as AlertCircleIcon,
  User,
  Phone,
  Mail,
  MapPin,
  Pill,
  Heart,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { getGreeting } from '../../../src/utils/greeting';
import { getFirstName } from '../../../src/utils/string';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { databaseService } from '../../../src/services/database/firebase';
import { safeDataAccess } from '../../../src/utils/safeDataAccess';
import LoadingState from '../../../src/components/ui/LoadingState';
import ErrorBoundary from '../../../src/components/ui/ErrorBoundary';
import { dataValidation } from '../../../src/utils/dataValidation';
import { useDeepMemo } from '../../../src/utils/performance';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SpecialistHomeScreen() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    totalPatients: 0,
    todayAppointments: 0,
    pendingRequests: 0,
    completedToday: 0,
    // Add trend data
    patientGrowth: 0,
    appointmentGrowth: 0,
    completedGrowth: 0,
    currentMonthPatients: 0,
    lastMonthPatients: 0,
    currentMonthAppointments: 0,
    lastMonthAppointments: 0,
    yesterdayCompleted: 0
  });
  const [nextAppointments, setNextAppointments] = useState<any[]>([]);
  const [newPatients, setNewPatients] = useState<any[]>([]);
  
  // Performance optimization: memoize filtered data
  const validNextAppointments = useDeepMemo(() => {
    return dataValidation.validateArray(nextAppointments, dataValidation.isValidAppointment);
  }, [nextAppointments]);
  
  const validNewPatients = useDeepMemo(() => {
    return dataValidation.validateArray(newPatients, dataValidation.isValidUser);
  }, [newPatients]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [scannedPatient, setScannedPatient] = useState<any>(null);

  // Load dashboard data from Firebase
  useEffect(() => {
    if (user && user.uid) {
      loadDashboardData();
    }
  }, [user]);

  // Request camera permission when QR modal is opened
  useEffect(() => {
    if (showQRModal) {
      const getCameraPermissions = async () => {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      };
      getCameraPermissions();
    }
  }, [showQRModal]);

  const handleRetry = () => {
    setError(null);
    loadDashboardData();
  };

  const loadDashboardData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Load all data in parallel
      const [
        patients,
        appointments,
        pendingAppointments,
        completedAppointments,
        allAppointments,
        referrals,
        pendingReferrals
      ] = await Promise.all([
        databaseService.getPatientsBySpecialist(user.uid),
        databaseService.getAppointmentsBySpecialist(user.uid),
        databaseService.getAppointmentsBySpecialistAndStatus(user.uid, 'pending'),
        databaseService.getAppointmentsBySpecialistAndStatus(user.uid, 'completed'),
        databaseService.getAppointmentsBySpecialist(user.uid),
        databaseService.getReferralsBySpecialist(user.uid),
        databaseService.getReferralsBySpecialistAndStatus(user.uid, 'pending_acceptance')
      ]);

      // Calculate today's appointments (including referrals)
      const today = new Date().toDateString();
      const todayAppointments = appointments.filter(apt => 
        new Date(apt.appointmentDate).toDateString() === today
      );
      
      // Add today's referrals to appointments count
      const todayReferrals = referrals.filter(ref => 
        new Date(ref.appointmentDate).toDateString() === today
      );
      const totalTodayAppointments = todayAppointments.length + todayReferrals.length;

      // Calculate completed today
      const completedToday = completedAppointments.filter(apt => 
        new Date(apt.appointmentDate).toDateString() === today
      );

      // Calculate yesterday's completed appointments for comparison
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayCompleted = completedAppointments.filter(apt => 
        new Date(apt.appointmentDate).toDateString() === yesterday.toDateString()
      );

      // Calculate month-over-month changes
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      // Get appointments from current month and last month
      const currentMonthAppointments = allAppointments.filter(apt => {
        const aptDate = new Date(apt.appointmentDate);
        return aptDate.getMonth() === currentMonth && aptDate.getFullYear() === currentYear;
      });

      const lastMonthAppointments = allAppointments.filter(apt => {
        const aptDate = new Date(apt.appointmentDate);
        return aptDate.getMonth() === lastMonth && aptDate.getFullYear() === lastMonthYear;
      });

      // Calculate patient growth (new patients this month vs last month)
      // Include patients from both appointments and referrals
      const allPatientIds = new Set();
      
      // Add patients from appointments
      appointments.forEach(apt => {
        if (apt.patientId) {
          allPatientIds.add(apt.patientId);
        }
      });
      
      // Add patients from referrals
      referrals.forEach(ref => {
        if (ref.patientId) {
          allPatientIds.add(ref.patientId);
        }
      });
      
      // Add patients from the patients list
      patients.forEach(patient => {
        if (patient.id) {
          allPatientIds.add(patient.id);
        }
      });

      const totalPatients = allPatientIds.size;

      const currentMonthPatients = patients.filter(patient => {
        if (!patient.createdAt) return false;
        const patientDate = new Date(patient.createdAt);
        return patientDate.getMonth() === currentMonth && patientDate.getFullYear() === currentYear;
      });

      const lastMonthPatients = patients.filter(patient => {
        if (!patient.createdAt) return false;
        const patientDate = new Date(patient.createdAt);
        return patientDate.getMonth() === lastMonth && patientDate.getFullYear() === lastMonthYear;
      });

      // Calculate trends
      const patientGrowth = currentMonthPatients.length - lastMonthPatients.length;
      const appointmentGrowth = currentMonthAppointments.length - lastMonthAppointments.length;
      const completedGrowth = completedToday.length - yesterdayCompleted.length;

      // Get next 3 appointments (including referrals)
      const upcomingAppointments = appointments
        .filter(apt => apt.status === 'confirmed')
        .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())
        .slice(0, 3);

      // Get upcoming referrals
      const upcomingReferrals = referrals
        .filter(ref => ref.status === 'confirmed' || ref.status === 'pending')
        .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())
        .slice(0, 3);

      // Combine appointments and referrals for display
      const allUpcoming = [...upcomingAppointments, ...upcomingReferrals]
        .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())
        .slice(0, 3);

      // Get recent patients
      const recentPatients = patients
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 3);

      setDashboardData({
        totalPatients: totalPatients,
        todayAppointments: totalTodayAppointments,
        pendingRequests: pendingAppointments.length + pendingReferrals.length,
        completedToday: completedToday.length,
        // Add trend data
        patientGrowth,
        appointmentGrowth,
        completedGrowth,
        currentMonthPatients: currentMonthPatients.length,
        lastMonthPatients: lastMonthPatients.length,
        currentMonthAppointments: currentMonthAppointments.length,
        lastMonthAppointments: lastMonthAppointments.length,
        yesterdayCompleted: yesterdayCompleted.length
      });

      setNextAppointments(allUpcoming);
      setNewPatients(recentPatients);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data. Please try again.');
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
      change: `${dashboardData.patientGrowth > 0 ? '+' : ''}${dashboardData.patientGrowth} this month`,
      trend: dashboardData.patientGrowth,
      icon: Users,
      onPress: () => router.push('/(specialist)/tabs/patients'),
    },
    {
      id: 2,
      title: "Today's Appointments",
      value: dashboardData.todayAppointments.toString(),
      change: `${dashboardData.appointmentGrowth > 0 ? '+' : ''}${dashboardData.appointmentGrowth} this month`,
      trend: dashboardData.appointmentGrowth,
      icon: Calendar,
      onPress: () => router.push('/(specialist)/tabs/appointments?filter=confirmed'),
    },
    {
      id: 3,
      title: 'Pending Requests',
      value: dashboardData.pendingRequests.toString(),
      change: dashboardData.pendingRequests > 0 ? 'Requires action' : 'All caught up',
      trend: dashboardData.pendingRequests > 0 ? 1 : 0, // Show up arrow if there are pending requests
      icon: AlertCircle,
      onPress: () => router.push('/(specialist)/tabs/appointments?filter=pending'),
    },
    {
      id: 4,
      title: 'Completed Today',
      value: dashboardData.completedToday.toString(),
      change: `${dashboardData.completedGrowth > 0 ? '+' : ''}${dashboardData.completedGrowth} from yesterday`,
      trend: dashboardData.completedGrowth,
      icon: CheckCircle,
      onPress: () => router.push('/(specialist)/tabs/appointments?filter=completed'),
    },
  ];

  // QR Scanner Functions
  const handleScanQR = () => {
    setShowQRModal(true);
    setScanned(false);
  };

  const handleCloseQRModal = () => {
    setShowQRModal(false);
    setScanned(false);
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return; // Prevent multiple scans
    
    setScanned(true);
    
    try {
      // Parse the QR code data
      const qrData = JSON.parse(data);
      
      // Validate that this is a patient QR code
      if (qrData.type === 'patient' && qrData.id) {
        console.log('Scanned patient QR code:', qrData);
        
        // Fetch additional patient information from database
        let patientDetails = null;
        try {
          patientDetails = await databaseService.getPatientById(qrData.id);
        } catch (error) {
          console.log('Could not fetch patient details from database:', error);
        }
        
        // Combine QR data with database data
        const enhancedPatientData = {
          ...qrData,
          ...patientDetails,
          // Ensure we have the most complete information
          name: patientDetails?.name || patientDetails?.patientFirstName + ' ' + patientDetails?.patientLastName || qrData.name || 'Unknown Patient',
          email: patientDetails?.email || qrData.email || '',
          phone: patientDetails?.phone || patientDetails?.contactNumber || qrData.phone || '',
          address: patientDetails?.address || qrData.address || '',
          dateOfBirth: patientDetails?.dateOfBirth || '',
          gender: patientDetails?.gender || '',
          bloodType: patientDetails?.bloodType || '',
          emergencyContact: patientDetails?.emergencyContact || null,
          createdAt: patientDetails?.createdAt || '',
          lastVisit: patientDetails?.lastVisit || '',
          specialty: patientDetails?.specialty || '',
          status: patientDetails?.status || ''
        };
        
        // Set the enhanced patient data and show the modal
        setScannedPatient(enhancedPatientData);
        setShowPatientModal(true);
        handleCloseQRModal();
      } else {
        Alert.alert(
          'Invalid QR Code',
          'This QR code is not a valid patient QR code. Please try scanning a different code.',
          [
            {
              text: 'Scan Again',
              onPress: () => {
                setScanned(false);
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error parsing QR code data:', error);
      Alert.alert(
        'Invalid QR Code',
        'The scanned QR code could not be read. Please try scanning a different code.',
        [
          {
            text: 'Scan Again',
            onPress: () => {
              setScanned(false);
            },
          },
        ]
      );
    }
  };

  const handleScanAgain = () => {
    setScanned(false);
  };

  const handleViewPatient = () => {
    if (scannedPatient) {
      setShowPatientModal(false);
      // Navigate to patient overview with the patient ID
      router.push(`/patient-overview?id=${scannedPatient.id}`);
    }
  };

  const handleClosePatientModal = () => {
    setShowPatientModal(false);
    setScannedPatient(null);
  };

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        {loading ? (
          <LoadingState
            message="Loading dashboard..."
            variant="fullscreen"
            size="large"
          />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
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
            <Text style={styles.userName}>Dr. {user?.name || 'Specialist'}</Text>
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
              {user?.name ? (
                <View style={styles.profileInitials}>
                  <Text style={styles.profileInitialsText}>
                    {getFirstName(user.name).charAt(0).toUpperCase()}
                  </Text>
                </View>
              ) : (
                <Image
                  source={{ uri: 'https://via.placeholder.com/36' }}
                  style={styles.profileImage}
                />
              )}
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
                  {metric.trend > 0 ? (
                    <TrendingUp size={20} color="#10B981" />
                  ) : metric.trend < 0 ? (
                    <TrendingUp size={20} color="#EF4444" style={{ transform: [{ rotate: '180deg' }] }} />
                  ) : (
                    <TrendingUp size={20} color="#9CA3AF" />
                  )}
                </View>
                <Text style={styles.metricValue}>{metric.value}</Text>
                <Text style={styles.metricTitle}>{metric.title}</Text>
                <Text style={styles.metricChange}>{metric.change}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={[styles.section, { marginTop: 4 }]}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.quickActionButton} 
              onPress={handleScanQR}
              activeOpacity={0.88}
            >
              <QrCode size={24} color="#1E40AF" />
              <Text style={styles.quickActionText}>Scan Patient{'\n'}QR Code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => router.push('/(specialist)/tabs/prescriptions')}
            >
              <Pill size={24} color="#1E40AF" />
              <Text style={styles.quickActionText}>View Issued{'\n'}Medicines</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => router.push('/(specialist)/tabs/certificates')}
            >
              <FileText size={24} color="#1E40AF" />
              <Text style={styles.quickActionText}>View Issued{'\n'}Certificates</Text>
            </TouchableOpacity>
          </View>
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
                const patientName = safeDataAccess.getAppointmentPatientName(appointment, 'Unknown Patient');
                const patientInitials = (() => {
                  const firstName = appointment.patientFirstName || '';
                  const lastName = appointment.patientLastName || '';
                  if (firstName && lastName) {
                    return `${firstName[0]}${lastName[0]}`.toUpperCase();
                  }
                  if (firstName) {
                    return firstName[0].toUpperCase();
                  }
                  return 'U';
                })();
                
                // Format appointment date
                const formatAppointmentDate = (dateString: string) => {
                  try {
                    if (!dateString) return 'Date not specified';
                    const date = new Date(dateString);
                    const today = new Date();
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    
                    if (date.toDateString() === today.toDateString()) {
                      return 'Today';
                    } else if (date.toDateString() === tomorrow.toDateString()) {
                      return 'Tomorrow';
                    } else {
                      return date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      });
                    }
                  } catch (error) {
                    return 'Invalid date';
                  }
                };

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
                        <Text style={styles.appointmentType}>
                          {appointment.specialty || appointment.type || 'General Consultation'}
                        </Text>
                        <Text style={styles.clinicName}>
                          {appointment.clinicName || 'Clinic not specified'}
                        </Text>
                      </View>
                      <View style={styles.appointmentTime}>
                        <Text style={styles.appointmentDate}>
                          {formatAppointmentDate(appointment.appointmentDate)}
                        </Text>
                        <View style={styles.timeContainer}>
                          <Clock size={14} color="#6B7280" />
                          <Text style={styles.timeText}>
                            {(() => {
                              const timeString = appointment.appointmentTime;
                              if (!timeString) return 'Time not specified';
                              // Handle time strings that already have AM/PM
                              if (timeString.includes('AM') || timeString.includes('PM')) {
                                // Remove any duplicate AM/PM and return clean format
                                const cleanTime = timeString.replace(/\s*(AM|PM)\s*(AM|PM)\s*/gi, ' $1');
                                return cleanTime.trim();
                              }
                              return timeString;
                            })()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyStateCard}>
                <View style={styles.emptyState}>
                  <Calendar size={48} color="#9CA3AF" />
                  <Text style={styles.emptyStateTitle}>No upcoming appointments</Text>
                  <Text style={styles.emptyStateText}>
                    You don't have any appointments scheduled for today.
                  </Text>
                </View>
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
                const patientName = safeDataAccess.getUserFullName(patient, 'Unknown Patient');
                const patientInitials = safeDataAccess.getUserInitials(patient, 'U');
                
                // Format when the patient was added
                const formatAddedDate = (dateString: string) => {
                  try {
                    if (!dateString) return 'Recently added';
                    const date = new Date(dateString);
                    const now = new Date();
                    const diffTime = Math.abs(now.getTime() - date.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays === 1) {
                      return 'Added today';
                    } else if (diffDays === 2) {
                      return 'Added yesterday';
                    } else if (diffDays <= 7) {
                      return `Added ${diffDays - 1} days ago`;
                    } else {
                      return date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      });
                    }
                  } catch (error) {
                    return 'Recently added';
                  }
                };

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
                        <Text style={styles.referredFrom}>
                          {patient.referredFrom ? `Referred from ${patient.referredFrom}` : 'Direct registration'}
                        </Text>
                      </View>
                      <View style={styles.patientStatus}>
                        <Text style={styles.addedDate}>
                          {patient.createdAt ? formatAddedDate(patient.createdAt) : 'Recently added'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyStateCard}>
                <View style={styles.emptyState}>
                  <Users size={48} color="#9CA3AF" />
                  <Text style={styles.emptyStateTitle}>No new patients</Text>
                  <Text style={styles.emptyStateText}>
                    You haven't added any new patients recently.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
        </ScrollView>
      )}

      {/* === QR SCANNER MODAL === */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseQRModal}
      >
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        {/* Backdrop/Blur */}
        <Pressable style={qrModalStyles.backdrop} onPress={handleCloseQRModal}>
          <BlurView intensity={22} style={qrModalStyles.blurView}>
            <View style={qrModalStyles.backdropOverlay} />
          </BlurView>
        </Pressable>
        {/* Modal Content */}
        <View style={qrModalStyles.modalContainer}>
          <SafeAreaView style={qrModalStyles.safeArea}>
            <View style={qrModalStyles.modalContent}>
              {/* Header */}
              <View style={qrModalStyles.header}>
                <View style={qrModalStyles.headerLeft}>
                  <Text style={qrModalStyles.headerTitle}>Scan Patient QR Code</Text>
                  <Text style={qrModalStyles.headerSubtitle}>Position the QR code within the frame</Text>
                </View>
                <TouchableOpacity style={qrModalStyles.closeButton} onPress={handleCloseQRModal}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              {/* Divider */}
              <View style={qrModalStyles.divider} />
              
              {/* Scanner Content */}
              {hasPermission === null ? (
                <View style={qrModalStyles.loadingContainer}>
                  <Text style={qrModalStyles.loadingText}>Requesting camera permission...</Text>
                </View>
              ) : hasPermission === false ? (
                <View style={qrModalStyles.permissionContainer}>
                  <AlertCircleIcon size={64} color="#EF4444" />
                  <Text style={qrModalStyles.permissionTitle}>Camera Permission Required</Text>
                  <Text style={qrModalStyles.permissionText}>
                    To scan patient QR codes, this app needs access to your camera.
                  </Text>
                  <TouchableOpacity style={qrModalStyles.permissionButton} onPress={handleCloseQRModal}>
                    <Text style={qrModalStyles.permissionButtonText}>Go Back</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={qrModalStyles.scannerContainer}>
                  <CameraView
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    barcodeScannerSettings={{
                      barcodeTypes: ['qr'], // Specify to only scan QR codes
                    }}
                    style={qrModalStyles.scanner}
                  />
                  
                  {/* Scanner Overlay */}
                  <View style={qrModalStyles.overlay}>
                    {/* Corner indicators - now white and larger */}
                    <View style={qrModalStyles.cornerTopLeft} />
                    <View style={qrModalStyles.cornerTopRight} />
                    <View style={qrModalStyles.cornerBottomLeft} />
                    <View style={qrModalStyles.cornerBottomRight} />
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              {scanned && (
                <View style={qrModalStyles.actions}>
                  <TouchableOpacity
                    style={qrModalStyles.secondaryButton}
                    onPress={handleScanAgain}
                  >
                    <Text style={qrModalStyles.secondaryButtonText}>Scan Again</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* === PATIENT VIEW MODAL === */}
      <Modal
        visible={showPatientModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleClosePatientModal}
      >
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        {/* Backdrop */}
        <Pressable style={patientModalStyles.backdrop} onPress={handleClosePatientModal}>
          <View style={patientModalStyles.backdropOverlay} />
        </Pressable>
        {/* Modal Content */}
        <View style={patientModalStyles.modalContainer}>
          <SafeAreaView style={patientModalStyles.safeArea}>
            <View style={patientModalStyles.modalContent}>
              {/* Header */}
              <View style={patientModalStyles.header}>
                <View style={patientModalStyles.headerLeft}>
                  <Text style={patientModalStyles.headerTitle}>Patient Found</Text>
                  <Text style={patientModalStyles.headerSubtitle}>QR code scanned successfully</Text>
                </View>
                <TouchableOpacity style={patientModalStyles.closeButton} onPress={handleClosePatientModal}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              {/* Divider */}
              <View style={patientModalStyles.divider} />
              
              {/* Patient Info */}
              {scannedPatient && (
                <View style={patientModalStyles.patientInfo}>
                  {/* Patient Avatar */}
                  {/* <View style={patientModalStyles.patientAvatar}>
                    <User size={32} color="#FFFFFF" />
                  </View> */}
                  
                  {/* Patient Name */}
                  <Text style={patientModalStyles.patientName}>
                    {scannedPatient.firstName + " " + scannedPatient.lastName}
                  </Text>
                  
                  {/* Patient ID */}
                  {/* <Text style={patientModalStyles.patientId}>
                    ID: {scannedPatient.id}
                  </Text> */}
                  
                  {/* Basic Info Grid */}
                  <View style={patientModalStyles.infoGrid}>
                    {scannedPatient.dateOfBirth && (
                      <View style={patientModalStyles.infoItem}>
                        <Calendar size={16} color="#6B7280" />
                        <Text style={patientModalStyles.infoText}>
                          {(() => {
                            try {
                              // Handle YYYY-MM-DD format specifically
                              const dateString = scannedPatient.dateOfBirth;
                              if (dateString && typeof dateString === 'string') {
                                // Check if it's in YYYY-MM-DD format
                                if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                                  const date = new Date(dateString + 'T00:00:00');
                                  if (!isNaN(date.getTime())) {
                                    return date.toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    });
                                  }
                                }
                                // Fallback for other date formats
                                const date = new Date(dateString);
                                if (!isNaN(date.getTime())) {
                                  return date.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  });
                                }
                              }
                              return scannedPatient.dateOfBirth;
                            } catch (error) {
                              console.log('Error formatting dateOfBirth:', error);
                              return scannedPatient.dateOfBirth;
                            }
                          })()}
                        </Text>
                      </View>
                    )}
                    {scannedPatient.gender && (
                      <View style={patientModalStyles.infoItem}>
                        <User size={16} color="#6B7280" />
                        <Text style={patientModalStyles.infoText}>{scannedPatient.gender}</Text>
                      </View>
                    )}
                    {scannedPatient.bloodType && (
                      <View style={patientModalStyles.infoItem}>
                        <Heart size={16} color="#6B7280" />
                        <Text style={patientModalStyles.infoText}>Blood Type: {scannedPatient.bloodType}</Text>
                      </View>
                    )}
                    {scannedPatient.email && (
                      <View style={patientModalStyles.infoItem}>
                        <Mail size={16} color="#6B7280" />
                        <Text style={patientModalStyles.infoText}>{scannedPatient.email}</Text>
                      </View>
                    )}
                    {scannedPatient.phone && (
                      <View style={patientModalStyles.infoItem}>
                        <Phone size={16} color="#6B7280" />
                        <Text style={patientModalStyles.infoText}>{scannedPatient.phone}</Text>
                      </View>
                    )}
                    {scannedPatient.address && (
                      <View style={patientModalStyles.infoItem}>
                        <MapPin size={16} color="#6B7280" />
                        <Text style={patientModalStyles.infoText}>{scannedPatient.address}</Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Emergency Contact */}
                  {scannedPatient.emergencyContact && (
                    <View style={patientModalStyles.emergencyContactSection}>
                      <Text style={patientModalStyles.sectionTitle}>Emergency Contact</Text>
                      <View style={patientModalStyles.emergencyContactCard}>
                        <Text style={patientModalStyles.emergencyContactName}>
                          {scannedPatient.emergencyContact.name}
                        </Text>
                        <Text style={patientModalStyles.emergencyContactPhone}>
                          {scannedPatient.emergencyContact.phone}
                        </Text>
                        <Text style={patientModalStyles.emergencyContactRelationship}>
                          {scannedPatient.emergencyContact.relationship}
                        </Text>
                      </View>
                    </View>
                  )}
                                    
                </View>
              )}
              
              {/* Action Buttons */}
              <View style={patientModalStyles.actions}>
                <TouchableOpacity
                  style={patientModalStyles.secondaryButton}
                  onPress={handleClosePatientModal}
                >
                  <Text style={patientModalStyles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={patientModalStyles.primaryButton}
                  onPress={handleViewPatient}
                >
                  <Text style={patientModalStyles.primaryButtonText}>View Patient</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
        </SafeAreaView>
      </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 16,
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
  profileInitials: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 12,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitialsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
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
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 15,
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
    marginBottom: 0,
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
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  metricTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 4,
  },
  metricChange: {
    fontSize: 12,
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
    marginBottom: 2,
  },
  appointmentType: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginTop: 2,
  },
  clinicName: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  appointmentTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  appointmentDate: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  timeContainer: {
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
  // Error state styles
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyStateCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
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
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  quickActionText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
    marginTop: 8,
  },
});

// QR Modal Styles
const qrModalStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
  },
  blurView: { flex: 1 },
  backdropOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.34)' },
  modalContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 2,
  },
  safeArea: { width: SCREEN_WIDTH * 0.92, maxWidth: 410 },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 26,
    alignItems: 'stretch',
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22,
  },
  headerLeft: { flex: 1 },
  headerTitle: {
    fontSize: 20, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280',
  },
  closeButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', marginLeft: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 18,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  permissionContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  permissionTitle: {
    color: '#1F2937',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionText: {
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  scannerContainer: {
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 18,
  },
  scanner: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Removed scanArea style - no more solid border
  cornerTopLeft: {
    position: 'absolute',
    top: 40,
    left: 40,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 40,
    right: 40,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 40,
    right: 40,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomRightRadius: 12,
  },
  actions: { 
    flexDirection: 'row', 
    gap: 12 
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: { 
    color: '#374151', 
    fontSize: 15, 
    fontFamily: 'Inter-SemiBold' 
  },
});

// Patient Modal Styles
const patientModalStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
  },
  backdropOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)' 
  },
  modalContainer: {
    flex: 1, justifyContent: 'flex-end', zIndex: 2,
  },
  safeArea: { 
    width: '100%',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'stretch',
    minHeight: SCREEN_HEIGHT * 0.4,
  },
  header: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 20,
  },
  headerLeft: { 
    flex: 1 
  },
  headerTitle: {
    fontSize: 20, 
    fontFamily: 'Inter-Bold', 
    color: '#1F2937', 
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14, 
    fontFamily: 'Inter-Regular', 
    color: '#6B7280',
  },
  closeButton: {
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    marginLeft: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 24,
  },
  patientInfo: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  patientAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  patientName: {
    marginTop: -20,
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  patientId: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  infoGrid: {
    width: '100%',
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    flex: 1,
  },
  emergencyContactSection: {
    width: '100%',
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  emergencyContactCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emergencyContactName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  emergencyContactPhone: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 4,
  },
  emergencyContactRelationship: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  additionalInfoSection: {
    width: '100%',
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  additionalInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  additionalInfoLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  additionalInfoValue: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'right',
  },
  actions: { 
    flexDirection: 'row', 
    gap: 12,
    marginTop: 32,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: { 
    color: '#374151', 
    fontSize: 16, 
    fontFamily: 'Inter-SemiBold' 
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontFamily: 'Inter-SemiBold' 
  },
});
 