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
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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
  LineChart as LineChartIcon,
  LayoutGrid,
  RefreshCw,
  Check,
  Trash2,
  CalendarDays
} from 'lucide-react-native';
// @ts-ignore - library has no types bundled
import { LineChart } from 'react-native-gifted-charts';
import { Svg, Path, Circle } from 'react-native-svg';
import { router } from 'expo-router';
import { getGreeting } from '../../../src/utils/greeting';
import { getFirstName } from '../../../src/utils/string';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { useRealtimeNotificationContext } from '../../../src/contexts/RealtimeNotificationContext';
import { getSafeNotifications, getSafeUnreadCount } from '../../../src/utils/notificationUtils';
import { useReferrals } from '../../../src/hooks/data/useReferrals';
import { databaseService } from '../../../src/services/database/firebase';
import { safeDataAccess } from '../../../src/utils/safeDataAccess';
import { capitalizeRelationship } from '../../../src/utils/formatting';
import LoadingState from '../../../src/components/ui/LoadingState';
import ErrorBoundary from '../../../src/components/ui/ErrorBoundary';
import { dataValidation } from '../../../src/utils/dataValidation';
import { useDeepMemo } from '../../../src/utils/performance';
import SpecialistHeader from '../../../src/components/navigation/SpecialistHeader';
import { handleQRScan, handleManualConsent, parseQRData } from '../../../src/utils/qrScanning';
import { GlobalNotificationModal } from '../../../src/components/shared';
import NotificationDebugger from '../../../src/components/debug/NotificationDebugger';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SpecialistHomeScreen() {
  const { user } = useAuth();
  const { 
    notifications: realtimeNotificationData,
  } = useRealtimeNotificationContext();
  
  // Safely extract notifications and unread count
  const notifications = getSafeNotifications(realtimeNotificationData.notifications);
  const unreadCount = getSafeUnreadCount(realtimeNotificationData.unreadCount);
  const notificationsLoading = realtimeNotificationData.loading;
  const notificationsError = realtimeNotificationData.error;
  const markAsRead = realtimeNotificationData.markAsRead;
  const markAllAsRead = realtimeNotificationData.markAllAsRead;
  const deleteNotification = realtimeNotificationData.deleteNotification;
  const refreshNotifications = realtimeNotificationData.refresh;
 
  
  // Debug logging for UI state
  console.log(' Specialist Home - UI State:', {
    userId: user?.uid,
    userRole: user?.role,
    notificationsCount: notifications.length,
    unreadCount: unreadCount,
    notifications: notifications.map(n => ({ id: n.id, title: n.title, read: n.read }))
  });

  // Force refresh notifications when component mounts
  React.useEffect(() => {
    if (user?.uid && refreshNotifications) {
      console.log(' Force refreshing notifications for user:', user.uid);
      refreshNotifications();
    }
  }, [user?.uid, refreshNotifications]);

  
  const { 
    referrals, 
    loading: referralsLoading, 
    error: referralsError 
  } = useReferrals();
  
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
  const [clinicData, setClinicData] = useState<{[key: string]: any}>({});
  const [allAppointments, setAllAppointments] = useState<any[]>([]);
  
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
  const [showChart, setShowChart] = useState(true);
  const [chartRange, setChartRange] = useState<'weekly' | 'monthly'>('weekly');
  const [chartData, setChartData] = useState<{value: number; label: string}[]>([]);
  const [selectedBand, setSelectedBand] = useState<string | null>(null);
  const [chartTitle, setChartTitle] = useState('Appointments Overview');
  const [chartSubtitle, setChartSubtitle] = useState('');
  const [bandAnimations] = useState(() => 
    new Map<string, Animated.Value>()
  );
  const [showQRModal, setShowQRModal] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [scannedPatient, setScannedPatient] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Consent system state
  const [showConsentWaiting, setShowConsentWaiting] = useState(false);
  const [consentRequestId, setConsentRequestId] = useState<string | null>(null);
  const [showManualConsent, setShowManualConsent] = useState(false);
  const [manualConsentData, setManualConsentData] = useState<any>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [pendingQRData, setPendingQRData] = useState<any>(null); // Store QR data for consent approval
  
  // Notification Modal State
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showDebugger, setShowDebugger] = useState(false);
  
  // Ref to track if data has been loaded on focus to prevent infinite loops
  const hasLoadedOnFocus = React.useRef(false);
  
  // Notification Modal Actions
  const handleOpenNotifications = () => {
    console.log(' Specialist - Opening notification modal');
    setShowNotificationModal(true);
  };
  const handleCloseNotificationModal = () => {
    console.log(' Specialist - Closing notification modal');
    setShowNotificationModal(false);
  };
  
  // Handle marking notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead(notificationId);
  };
  
  // Handle deleting notification
  const handleDeleteNotification = async (notificationId: string) => {
    await deleteNotification(notificationId);
  };
  
  // Handle marking all notifications as read
  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  // Load dashboard data from Firebase
  useEffect(() => {
    if (user && user.uid) {
      loadDashboardData();
    }
  }, [user]);

  // Reload data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user && user.uid && !hasLoadedOnFocus.current) {
        hasLoadedOnFocus.current = true;
        loadDashboardData();
      }
      
      // Reset the flag when screen loses focus
      return () => {
        hasLoadedOnFocus.current = false;
      };
    }, [user])
  );

  // Consolidated chart data generation - prevents race conditions
  useEffect(() => {
    if (user && user.uid && !referralsLoading && allAppointments.length >= 0) {
      // Always generate chart data when both referrals and appointments are loaded
      generateChartData();
    }
  }, [chartRange, user, referrals, referralsLoading, allAppointments]);

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
        allAppointmentsData,
        referrals,
        pendingAcceptanceReferrals
      ] = await Promise.all([
        databaseService.getPatientsBySpecialist(user.uid),
        databaseService.getAppointmentsBySpecialist(user.uid),
        databaseService.getAppointmentsBySpecialistAndStatus(user.uid, 'pending'),
        databaseService.getAppointmentsBySpecialistAndStatus(user.uid, 'completed'),
        databaseService.getAppointmentsBySpecialist(user.uid),
        databaseService.getReferralsBySpecialist(user.uid),
        databaseService.getReferralsBySpecialistAndStatus(user.uid, 'pending_acceptance')
      ]);

      // Store all appointments for chart data
      setAllAppointments(allAppointmentsData);

      // Get all pending referrals (both 'pending' and 'pending_acceptance' statuses)
      const pendingReferrals = referrals.filter(ref => 
        (ref.status as any) === 'pending' || (ref.status as any) === 'pending_acceptance'
      );

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
      // Use the patients list from getPatientsBySpecialist which already includes
      // unique patients from both appointments and referrals
      const totalPatients = patients.length;

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

      // Combine appointments and referrals for display, removing duplicates based on referral ID
      const processedReferralIds = new Set();
      const uniqueUpcoming = [];
      
      // Add appointments first
      upcomingAppointments.forEach(appointment => {
        uniqueUpcoming.push(appointment);
      });
      
      // Add referrals, but skip if we already have an appointment with the same referral ID
      upcomingReferrals.forEach(referral => {
        const referralId = referral.id;
        const hasMatchingAppointment = upcomingAppointments.some(apt => 
          apt.relatedReferralId === referralId || apt.id === referralId
        );
        
        if (!hasMatchingAppointment && !processedReferralIds.has(referralId)) {
          processedReferralIds.add(referralId);
          uniqueUpcoming.push(referral);
        }
      });
      
      const allUpcoming = uniqueUpcoming
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
      
      // Generate initial chart data
      generateChartData();

      // Load clinic data for appointments
      const clinicIds = new Set<string>();
      allUpcoming.forEach(appointment => {
        // Check if it's an appointment (has clinicId) or referral (has referringClinicId)
        const clinicId = 'clinicId' in appointment ? appointment.clinicId : 
                        'referringClinicId' in appointment ? appointment.referringClinicId : null;
        if (clinicId) {
          clinicIds.add(clinicId);
        }
      });

      // Fetch clinic data for all unique clinic IDs
      const clinicDataPromises = Array.from(clinicIds).map(async (clinicId) => {
        try {
          const clinic = await databaseService.getClinicById(clinicId);
          return { [clinicId]: clinic };
        } catch (error) {
          console.error(`Error loading clinic ${clinicId}:`, error);
          return { [clinicId]: null };
        }
      });

      const clinicDataResults = await Promise.all(clinicDataPromises);
      const newClinicData = clinicDataResults.reduce((acc, result) => ({ ...acc, ...result }), {});
      setClinicData(prev => ({ ...prev, ...newClinicData }));

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

  // Function to aggregate ALL appointment data (referrals + regular appointments) by date for chart
  const aggregateAllAppointments = (range: 'weekly' | 'monthly') => {
    // console.log(' Aggregating ALL appointment data:', { 
    //   range, 
    //   referralsCount: referrals?.length || 0,
    //   appointmentsCount: allAppointments?.length || 0,
    //   referrals: referrals?.slice(0, 2), // Log first 2 referrals for debugging
    //   appointments: allAppointments?.slice(0, 2) // Log first 2 appointments for debugging
    // });
    
    // Combine referrals and regular appointments, removing duplicates
    const allAppointmentData = [
      ...(referrals || []).map(ref => ({ ...ref, appointmentDate: ref.appointmentDate, type: 'referral' })),
      ...(allAppointments || []).map(apt => ({ ...apt, appointmentDate: apt.appointmentDate, type: 'appointment' }))
    ];
    
    // Remove duplicates based on ID to prevent double counting
    const uniqueAppointments = allAppointmentData.filter((appointment, index, self) => 
      index === self.findIndex(a => a.id === appointment.id)
    );
    
    console.log(' Combined appointment data:', {
      totalCombined: allAppointmentData.length,
      uniqueCount: uniqueAppointments.length,
      duplicatesRemoved: allAppointmentData.length - uniqueAppointments.length,
      sampleData: uniqueAppointments.slice(0, 5).map(item => ({
        id: item.id,
        appointmentDate: item.appointmentDate,
        type: item.type,
        patientName: item.patientName || item.patient?.name || 'Unknown'
      }))
    });
    
    if (!uniqueAppointments || uniqueAppointments.length === 0) {
      console.log(' No unique appointment data (referrals + appointments), returning empty chart data');
      // Return empty data if no appointments
      if (range === 'weekly') {
        return { data: Array(7).fill(0).map((_, i) => {
          const days = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
          return { value: 0, label: days[i] };
        }), totalCount: 0 };
      } else {
        const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        const now = new Date();
        const year = now.getFullYear();
        return { data: Array(6).fill(0).map((_, i) => {
          const date = new Date(year, now.getMonth() - (5 - i), 1);
          const monthIdx = date.getMonth();
          return { value: 0, label: months[monthIdx] };
        }), totalCount: 0 };
      }
    }

    if (range === 'weekly') {
      const days = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
      const start = new Date();
      start.setDate(start.getDate() - 6);
      
      const data = days.map((day, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        return { value: 0, label: day, date: date.toISOString().split('T')[0] };
      });

      uniqueAppointments.forEach(appointment => {
        try {
          if (!appointment.appointmentDate) {
            console.warn(' Appointment missing appointmentDate:', appointment);
            return;
          }
          
          const appointmentDate = new Date(appointment.appointmentDate);
          if (isNaN(appointmentDate.getTime())) {
            console.warn(' Invalid appointmentDate:', appointment.appointmentDate);
            return;
          }
          
          const dateStr = appointmentDate.toISOString().split('T')[0];
          
          const dayIndex = data.findIndex(item => item.date === dateStr);
          if (dayIndex !== -1) {
            data[dayIndex].value += 1;
          }
        } catch (error) {
          console.error(' Error processing appointment:', error, appointment);
        }
      });

      const totalCount = data.reduce((sum, item) => sum + item.value, 0);
      const result = { 
        data: data.map(({ value, label }) => ({ value, label })), 
        totalCount 
      };
      
      console.log(' Weekly aggregation result:', { totalCount, dataPoints: result.data.length });
      return result;
    } else {
      // Monthly aggregation
      const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      const now = new Date();
      const year = now.getFullYear();
      
      // Initialize data array with 0 values for last 6 months
      const data = Array(6).fill(0).map((_, i) => {
        const date = new Date(year, now.getMonth() - (5 - i), 1);
        const monthIdx = date.getMonth();
        return { value: 0, label: months[monthIdx], month: monthIdx, year: date.getFullYear() };
      });

      // Count ALL appointments (referrals + regular appointments) for each month
      uniqueAppointments.forEach(appointment => {
        try {
          if (!appointment.appointmentDate) {
            console.warn(' Appointment missing appointmentDate:', appointment);
            return;
          }
          
          const appointmentDate = new Date(appointment.appointmentDate);
          if (isNaN(appointmentDate.getTime())) {
            console.warn(' Invalid appointmentDate:', appointment.appointmentDate);
            return;
          }
          
          const appointmentMonth = appointmentDate.getMonth();
          const appointmentYear = appointmentDate.getFullYear();
          
          // Find matching month in our data array
          const monthIndex = data.findIndex(item => 
            item.month === appointmentMonth && item.year === appointmentYear
          );
          if (monthIndex !== -1) {
            data[monthIndex].value += 1;
          }
        } catch (error) {
          console.error(' Error processing appointment:', error, appointment);
        }
      });

      // Remove month and year properties and return data with total count
      const totalCount = data.reduce((sum, item) => sum + item.value, 0);
      const result = { 
        data: data.map(({ value, label }) => ({ value, label })), 
        totalCount 
      };
      
      console.log(' Monthly aggregation result:', { totalCount, dataPoints: result.data.length });
      return result;
    }
  };

  const generateChartData = () => {
    if (!user) return;
    
    console.log(' Generating chart data:', { 
      chartRange, 
      referralsCount: referrals?.length || 0,
      appointmentsCount: allAppointments?.length || 0,
      referralsLoading 
    });
    
    // Use ALL appointment data (referrals + regular appointments) instead of just referrals
    const result = aggregateAllAppointments(chartRange);
    const newChartData = result.data;
    const totalCount = result.totalCount;
    
    console.log(' Chart data generated:', { 
      dataPoints: newChartData.length, 
      totalCount,
      sampleData: newChartData.slice(0, 3) // Log first 3 data points for debugging
    });
    
    setChartData(newChartData);
    
    // Don't reset selected band when data changes to keep selection persistent
    // setSelectedBand(null);
    
    // Initialize animations for new data
    newChartData.forEach(item => {
      if (!bandAnimations.has(item.label)) {
        bandAnimations.set(item.label, new Animated.Value(0));
      }
    });
    
    // Update chart title and subtitle
    const now = new Date();
    if (chartRange === 'weekly') {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      setChartTitle('Weekly Overview');
      setChartSubtitle(`${start.getDate()} ${start.toLocaleDateString('en-US', { month: 'long' })} - ${now.getDate()} ${now.toLocaleDateString('en-US', { month: 'long' })}`);
      // • Period Appointments: ${totalCount}
    } else {
      setChartTitle('Monthly Trends');
      // Format like "15 April - 21 April" for monthly view
      const startMonth = new Date(now.getFullYear(), now.getMonth() - 5, 15);
      const endMonth = new Date(now.getFullYear(), now.getMonth(), 21);
      setChartSubtitle(`${startMonth.getDate()} ${startMonth.toLocaleDateString('en-US', { month: 'long' })} - ${endMonth.getDate()} ${endMonth.toLocaleDateString('en-US', { month: 'long' })}`);
      // • Period Appointments: ${totalCount}
    }
  };

  const handleBandSelection = (label: string) => {
    const newSelection = selectedBand === label ? null : label;
    setSelectedBand(newSelection);
    
    // Quick pop effect - bright flash for 0.05 seconds
    chartData.forEach(item => {
      const animation = bandAnimations.get(item.label);
      if (animation) {
        if (item.label === newSelection) {
          // Super quick bright flash
          Animated.sequence([
            Animated.timing(animation, {
              toValue: 1,
              duration: 50, // 0.05 seconds = 50ms
              useNativeDriver: false,
            }),
            Animated.timing(animation, {
              toValue: 0,
              duration: 50, // Quick fade out
              useNativeDriver: false,
            })
          ]).start();
        } else {
          // Reset animation
          animation.setValue(0);
        }
      }
    });
  };

  const handleDropdownToggle = () => {
    setShowDropdown(!showDropdown);
  };

  const handleRangeSelect = (range: 'weekly' | 'monthly') => {
    setChartRange(range);
    setShowDropdown(false);
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
    // Don't reset scanned here - let the scan result handlers manage it
  };

  const handleManualCloseQRModal = () => {
    setShowQRModal(false);
    setScanned(false); // Reset scanned when user manually closes
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return; // Prevent multiple scans
    
    setScanned(true);
    setConsentError(null);
    
    try {
      console.log(' QR Code scanned:', { type, data });
      
      // Parse QR data safely
      const qrData = parseQRData(data);
      
      // Process QR scan with consent logic
      const result = await handleQRScan(qrData, user?.uid);
      
      console.log('📋 QR scan result:', result);
      
      if (result.action === 'direct_access') {
        // Trusted specialist - load patient data immediately
        console.log(' Direct access granted:', result.reason);
        await loadPatientData(qrData);
        
      } else if (result.action === 'request_consent') {
        // New specialist - show waiting screen for patient consent
        console.log('⏳ Requesting consent:', result.reason);
        setConsentRequestId(result.requestId!);
        setPendingQRData(qrData); // Store QR data for later use
        setShowConsentWaiting(true);
        handleCloseQRModal();
        
      } else if (result.action === 'manual_consent_required') {
        // System failed - show manual consent screen
        console.log('🔧 Manual consent required:', result.reason);
        setManualConsentData({ qrData, specialistId: user?.uid });
        setShowManualConsent(true);
        handleCloseQRModal();
        
      } else if (result.action === 'error') {
        // Error occurred - show error message
        console.error(' QR scan error:', result.error);
        setConsentError(result.error || 'Unknown error occurred');
        Alert.alert(
          'Error',
          result.error || 'Failed to process QR code. Please try again.',
          [{ text: 'OK', onPress: () => setScanned(false) }]
        );
      }
      
    } catch (error) {
      console.error(' QR scan processing failed:', error);
      setConsentError(error.message);
      Alert.alert(
        'Error',
        'Failed to process QR code. Please try again.',
        [{ text: 'OK', onPress: () => setScanned(false) }]
      );
    }
  };

  const handleScanAgain = () => {
    setScanned(false);
  };

  // Load patient data for trusted specialists
  const loadPatientData = async (qrData: any) => {
    try {
      console.log('📋 Loading patient data for:', qrData.id);
      
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
        bloodType: safeDataAccess.getBloodType(patientDetails) || '',
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
      
    } catch (error) {
      console.error(' Error loading patient data:', error);
      setConsentError('Failed to load patient data');
      Alert.alert(
        'Error',
        'Failed to load patient data. Please try again.',
        [{ text: 'OK', onPress: () => setScanned(false) }]
      );
    }
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

  // Consent handling functions
  const handleConsentApproved = async () => {
    if (consentRequestId) {
      try {
        console.log(' Consent approved for request:', consentRequestId);
        await loadPatientData(manualConsentData?.qrData);
        setShowConsentWaiting(false);
        setConsentRequestId(null);
      } catch (error) {
        console.error(' Error handling consent approval:', error);
        setConsentError('Failed to process consent approval');
      }
    }
  };

  const handleConsentDenied = async () => {
    if (consentRequestId) {
      try {
        console.log(' Consent denied for request:', consentRequestId);
        setShowConsentWaiting(false);
        setConsentRequestId(null);
        Alert.alert(
          'Access Denied',
          'Patient has denied access to their medical records.',
          [{ text: 'OK' }]
        );
      } catch (error) {
        console.error(' Error handling consent denial:', error);
        setConsentError('Failed to process consent denial');
      }
    }
  };

  // Listen for consent request status updates
  useEffect(() => {
    if (consentRequestId) {
      console.log('👂 Setting up consent status listener for request:', consentRequestId);
      
      const unsubscribe = databaseService.listenToConsentRequestStatus(consentRequestId, (request) => {
        if (request) {
          console.log('📋 Consent request status updated:', request.status);
          
          if (request.status === 'approved') {
            console.log(' Patient approved consent');
            setShowConsentWaiting(false);
            setConsentRequestId(null);
            // Load patient data using stored QR data
            if (pendingQRData) {
              loadPatientData(pendingQRData).then(() => {
                setPendingQRData(null); // Clear stored data
              });
            }
          } else if (request.status === 'denied') {
            console.log(' Patient denied consent');
            setShowConsentWaiting(false);
            setConsentRequestId(null);
            setPendingQRData(null); // Clear stored data
            Alert.alert(
              'Access Denied',
              'Patient has denied access to their medical records.',
              [{ text: 'OK' }]
            );
          } else if (request.status === 'expired') {
            console.log('⏰ Consent request expired');
            setShowConsentWaiting(false);
            setConsentRequestId(null);
            setPendingQRData(null); // Clear stored data
            Alert.alert(
              'Request Expired',
              'The consent request has expired. Please ask the patient to scan their QR code again.',
              [{ text: 'OK' }]
            );
          }
        }
      });
      
      return () => {
        console.log('🔇 Unsubscribing from consent status listener');
        unsubscribe();
      };
    }
  }, [consentRequestId]);

  const handleManualConsentResponse = async (response: 'approved' | 'denied') => {
    try {
      console.log('🔧 Manual consent response:', response);
      
      if (response === 'approved') {
        await loadPatientData(manualConsentData?.qrData);
      } else {
        Alert.alert(
          'Access Denied',
          'Patient has denied access to their medical records.',
          [{ text: 'OK' }]
        );
      }
      
      setShowManualConsent(false);
      setManualConsentData(null);
      
    } catch (error) {
      console.error(' Error handling manual consent:', error);
      setConsentError('Failed to process manual consent');
    }
  };

  const handleCloseConsentWaiting = () => {
    setShowConsentWaiting(false);
    setConsentRequestId(null);
    setPendingQRData(null); // Clear stored data
  };

  const handleCloseManualConsent = () => {
    setShowManualConsent(false);
    setManualConsentData(null);
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
        <SpecialistHeader 
          showGreeting={true} 
          onNotificationPress={handleOpenNotifications}
          notificationCount={notifications.filter(n => !n.read).length}
        />

        {/* Dashboard */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{showChart ? 'Appointment Overview' : 'Dashboard'}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setShowChart(false)} style={styles.toggleIconBtn}>
                <LayoutGrid size={18} color={showChart ? '#6B7280' : '#1E40AF'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowChart(true)} style={styles.toggleIconBtn}>
                <LineChartIcon size={18} color={showChart ? '#1E40AF' : '#6B7280'} />
              </TouchableOpacity>
              {/* Debug Button */}
              {/* <TouchableOpacity 
                onPress={() => {
                  console.log(' Specialist debug button pressed!');
                  setShowDebugger(true);
                }} 
                style={[styles.toggleIconBtn, { backgroundColor: '#FF6B6B', minWidth: 40, minHeight: 40, justifyContent: 'center', alignItems: 'center' }]}
                activeOpacity={0.7}
              >
                <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>🐛</Text>
              </TouchableOpacity> */}
            </View>
          </View>

          {!showChart ? (
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
          ) : (
            <View>
              {/* Chart Header with Left-Aligned Overview and Right-Aligned Filter */}
              <View style={[styles.chartHeaderNew, { zIndex: 30 }]}>
                <View style={styles.chartHeaderLeft}>
                  <Text style={styles.chartTitle}>{chartTitle}</Text>
                  <Text style={styles.chartSubtitle}>{chartSubtitle}</Text>
                </View>
                <View style={styles.chartHeaderRight}>
                  <TouchableOpacity 
                    style={styles.filterDropdown}
                    onPress={handleDropdownToggle}
                  >
                    <Text style={styles.filterDropdownText}>{chartRange === 'weekly' ? 'Weekly' : 'Monthly'}</Text>
                    <Text style={styles.filterDropdownIcon}>▼</Text>
                  </TouchableOpacity>
                  
                  {/* Dropdown Menu */}
                  {showDropdown && (
                    <View style={[styles.dropdownMenu, { zIndex: 35 }]}>
                      <TouchableOpacity 
                        style={[
                          styles.dropdownItem,
                          chartRange === 'weekly' && styles.dropdownItemActive
                        ]}
                        onPress={() => handleRangeSelect('weekly')}
                      >
                        <Text style={[
                          styles.dropdownItemText,
                          chartRange === 'weekly' && styles.dropdownItemTextActive
                        ]}>Weekly</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[
                          styles.dropdownItem,
                          chartRange === 'monthly' && styles.dropdownItemActive
                        ]}
                        onPress={() => handleRangeSelect('monthly')}
                      >
                        <Text style={[
                          styles.dropdownItemText,
                          chartRange === 'monthly' && styles.dropdownItemTextActive
                        ]}>Monthly</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
              
              {/* Chart Container */}
              <View style={styles.chartWrapper}>

                {/* Calculate y-axis scale once for the entire chart */}
                {(() => {
                  const maxValue = Math.max(...chartData.map(d => d.value));
                  
                  // Calculate dynamic y-axis maximum with smart padding
                  const calculateYAxisMax = (max: number) => {
                    if (max <= 2) return 5;        // 2 referrals → y-axis goes to 5
                    if (max <= 5) return max + 2;   // 3-5 referrals → add 2 padding
                    if (max <= 10) return max + 3;  // 6-10 referrals → add 3 padding
                    if (max <= 20) return max + 5;  // 11-20 referrals → add 5 padding
                    if (max <= 50) return max + 10; // 21-50 referrals → add 10 padding
                    return max + Math.ceil(max * 0.2); // For larger numbers, add 20% padding
                  };
                  
                  const yAxisMax = calculateYAxisMax(maxValue);
                  const yAxisMin = 0;
                  const yAxisRange = yAxisMax - yAxisMin;
                  
                  return (
                    <>
                      {/* Custom Y-axis Labels - Dynamic scale with smart padding */}
                      <View style={styles.yAxisLabelsContainer}>
                        <Text style={styles.yAxisLabel}>{yAxisMax}</Text>
                        <Text style={styles.yAxisLabel}>{Math.round(yAxisMin + (yAxisRange / 2))}</Text>
                        <Text style={styles.yAxisLabel}>{yAxisMin}</Text>
                      </View>
                      
                      {/* Custom Vertical Bars - Render as actual bars */}
                      <View style={styles.barsContainer}>
                        {chartData.map((item, index) => {
                          // Calculate bar height using the dynamic y-axis scale
                          const normalizedValue = yAxisMax === 0 ? 0 : (item.value - yAxisMin) / (yAxisMax - yAxisMin);
                          const barHeight = 180; // Always use full chart height for bars to span bottom to top
                          const isSelected = selectedBand === item.label;
                          const chartPadding = 30; // Chart padding from left edge
                          const barWidth = (SCREEN_WIDTH - (chartPadding * 2)) / chartData.length; // Use screen width minus padding
                          const barLeft = chartPadding + (index * barWidth); // Calculate left position
                          
                          return (
                            <TouchableOpacity
                              key={item.label}
                              style={[
                                styles.bar,
                                isSelected && styles.barSelected,
                                { 
                                  width: Math.max(barWidth - 4, 20), // Restore original width for clean look
                                  position: 'absolute',
                                  left: barLeft, // Use calculated position
                                  height: 180, // Full chart height for clickable area
                                  zIndex: 10, // Lower z-index so bars appear below the line chart
                                  paddingHorizontal: 2, // Restore original padding for clean look
                                  // Make bars touchable while maintaining clean look
                                  backgroundColor: 'transparent',
                                  borderWidth: 1,
                                  borderColor: 'rgba(0,0,0,0.01)', // Subtle border for touchability
                                }
                              ]}
                              onPress={() => handleBandSelection(item.label)}
                              activeOpacity={0.6} // Restore original opacity for clean look
                              hitSlop={{ top: 15, bottom: 15, left: 8, right: 8 }} // Expand touch area significantly
                            >
                              {/* Bar background - positioned at bottom */}
                              <View style={[
                                styles.barBackground,
                                isSelected && styles.barBackgroundSelected,
                                { 
                                  height: barHeight,
                                  position: 'absolute',
                                  bottom: 0,
                                  left: 0,
                                  right: 0
                                }
                              ]}>
                                {/* Bar gradient effect */}
                                <View style={[
                                  styles.barGradientTop,
                                  isSelected && { backgroundColor: '#E8F0FF' }
                                ]} />
                                <View style={[
                                  styles.barGradientMiddle,
                                  isSelected && { backgroundColor: '#D8E8FF' }
                                ]} />
                                <View style={[
                                  styles.barGradientBottom,
                                  isSelected && { backgroundColor: '#C8E0FF' }
                                ]} />
                              </View>
                              
                              {/* Simple click effect overlay */}
                              {isSelected && (
                                <Animated.View 
                                  style={[
                                    styles.barClickEffect,
                                    {
                                      opacity: bandAnimations.get(item.label)?.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, 0.3], // Restore original opacity for clean look
                                      }) || 0,
                                    }
                                  ]}
                                />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      
                      {/* Custom Line Chart - Render below bars */}
                      <View style={styles.lineChartContainer}>
                        {/* Draw smooth curved lines connecting the bar centers */}
                        <View style={[styles.customLineChart, { pointerEvents: 'none' }]}>
                          {/* SVG components for smooth curves */}
                          {(() => {
                            const chartHeight = 180;
                            const chartPadding = 30;
                            const barWidth = (SCREEN_WIDTH - (chartPadding * 2)) / chartData.length;
                            
                            // Generate smooth curve path that starts and ends at bar boundaries
                            const generateSmoothPath = () => {
                              if (chartData.length < 2) return '';
                              
                              // Create points at bar boundaries instead of centers
                              const points = chartData.map((item, index) => {
                                // For first bar, use left edge; for last bar, use right edge; for others, use center
                                let x;
                                if (index === 0) {
                                  // First bar: start at left edge
                                  x = chartPadding;
                                } else if (index === chartData.length - 1) {
                                  // Last bar: end at right edge
                                  x = chartPadding + (index * barWidth) + barWidth;
                                } else {
                                  // Middle bars: use center
                                  x = chartPadding + (index * barWidth) + (barWidth / 2);
                                }
                                
                                // Use the same normalization logic as bars
                                const normalizedValue = yAxisMax === 0 ? 0 : (item.value - yAxisMin) / (yAxisMax - yAxisMin);
                                const y = 10 + (chartHeight - normalizedValue * chartHeight);
                                return { x, y };
                              });
                              
                              let path = `M ${points[0].x} ${points[0].y}`;
                              
                              for (let i = 1; i < points.length; i++) {
                                const prev = points[i - 1];
                                const current = points[i];
                                
                                // Calculate control points for smooth curve
                                const controlPoint1X = prev.x + (current.x - prev.x) * 0.5;
                                const controlPoint1Y = prev.y;
                                const controlPoint2X = current.x - (current.x - prev.x) * 0.5;
                                const controlPoint2Y = current.y;
                                
                                path += ` C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${current.x} ${current.y}`;
                              }
                              
                              return path;
                            };

                            // Function to calculate y-position on the smooth curve at any x-coordinate
                            const getYOnCurve = (targetX) => {
                              if (chartData.length < 2) return 0;
                              
                              const points = chartData.map((item, index) => {
                                let x;
                                if (index === 0) {
                                  x = chartPadding;
                                } else if (index === chartData.length - 1) {
                                  x = chartPadding + (index * barWidth) + barWidth;
                                } else {
                                  x = chartPadding + (index * barWidth) + (barWidth / 2);
                                }
                                
                                const normalizedValue = yAxisMax === 0 ? 0 : (item.value - yAxisMin) / (yAxisMax - yAxisMin);
                                const y = 10 + (chartHeight - normalizedValue * chartHeight);
                                return { x, y };
                              });
                              
                              // Find the segment where targetX falls
                              for (let i = 0; i < points.length - 1; i++) {
                                const start = points[i];
                                const end = points[i + 1];
                                
                                if (targetX >= start.x && targetX <= end.x) {
                                  // Calculate control points for this segment
                                  const controlPoint1X = start.x + (end.x - start.x) * 0.5;
                                  const controlPoint1Y = start.y;
                                  const controlPoint2X = end.x - (end.x - start.x) * 0.5;
                                  const controlPoint2Y = end.y;
                                  
                                  // Use cubic Bezier formula to find y at targetX
                                  const t = (targetX - start.x) / (end.x - start.x);
                                  const y = Math.pow(1 - t, 3) * start.y + 
                                           3 * Math.pow(1 - t, 2) * t * controlPoint1Y + 
                                           3 * (1 - t) * Math.pow(t, 2) * controlPoint2Y + 
                                           Math.pow(t, 3) * end.y;
                                  
                                  return y;
                                }
                              }
                              
                              // Fallback to nearest point
                              return points[0].y;
                            };
                            
                            return (
                              <Svg
                                width={SCREEN_WIDTH}
                                height={chartHeight + 20}
                                style={styles.svgChart}
                              >
                                {/* Smooth curved line */}
                                <Path
                                  d={generateSmoothPath()}
                                  stroke="#8BA4FF"
                                  strokeWidth={4}
                                  fill="none"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  opacity={0.8}
                                />
                                
                                {/* Data points - only show when bar is selected */}
                                {selectedBand && chartData.map((item, index) => {
                                  if (item.label !== selectedBand) return null; // Only show the selected point
                                  
                                  // Position dot in the EXACT center of the actual bar (matching bar positioning exactly)
                                  const actualBarWidth = Math.max(barWidth - 4, 20); // Same as bar width calculation
                                  const barLeft = chartPadding + (index * barWidth); // Same as bar left calculation
                                  const x = barLeft + (actualBarWidth / 2); // Center of actual bar
                                  
                                  // Use getYOnCurve to position dot EXACTLY on the smooth line
                                  const y = getYOnCurve(x);
                                  
                                  return (
                                    <Circle
                                      key={`point-${index}`}
                                      cx={x}
                                      cy={y}
                                      r={6}
                                      fill="#8BA4FF"
                                      stroke="#FFFFFF"
                                      strokeWidth={3}
                                      opacity={1}
                                    />
                                  );
                                })}
                              </Svg>
                            );
                          })()}
                        </View>
                      </View>
                      
                      {/* Custom X-axis Labels below bars */}
                      <View style={styles.xAxisLabelsContainer}>
                        {chartData.map((item, index) => {
                          const chartPadding = 30;
                          const barWidth = (SCREEN_WIDTH - (chartPadding * 2)) / chartData.length;
                          const leftPosition = chartPadding + (index * barWidth) + (barWidth / 2) - 15; // Center label under bar
                          
                          return (
                            <View key={`${item.label}-${index}`} style={[
                              styles.xAxisLabel,
                              { 
                                position: 'absolute',
                                left: leftPosition,
                                width: 30
                              }
                            ]}>
                              <Text style={styles.xAxisLabelText}>{item.label}</Text>
                            </View>
                          );
                        })}
                      </View>
                      
                      {/* Custom Tooltip - Show when bar is selected */}
                      {selectedBand && (() => {
                        const selectedItem = chartData.find(item => item.label === selectedBand);
                        if (!selectedItem) return null;
                        
                        const barIndex = chartData.findIndex(item => item.label === selectedBand);
                        const chartWidth = SCREEN_WIDTH;
                        const chartPadding = 30;
                        const barWidth = (chartWidth - (chartPadding * 2)) / chartData.length;
                        const leftPosition = chartPadding + (barIndex * barWidth) + (barWidth / 2) - 70;
                        
                        // Calculate tooltip position using the same y-axis scale
                        const normalizedValue = yAxisMax === 0 ? 0 : (selectedItem.value - yAxisMin) / (yAxisMax - yAxisMin);
                        const topPosition = 10 + (180 - normalizedValue * 180) - 100;
                        
                        return (
                          <View style={[
                            styles.customTooltip,
                            {
                              left: leftPosition,
                              top: topPosition,
                              position: 'absolute',
                              zIndex: 40 // Above everything including chart header text (30) and filter (30)
                            }
                          ]}>
                            <Text style={styles.tooltipValue}>{selectedItem.value}</Text>
                            <Text style={styles.tooltipLabel}>total appointments</Text>
                          </View>
                        );
                      })()}
                    </>
                  );
                })()}
              </View>
            </View>
          )}
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
              <View style={styles.quickActionIconContainer}>
                <QrCode size={24} color="#1E40AF" />
              </View>
              <Text style={styles.quickActionText}>Scan{'\n'}QR Code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => router.push('/(specialist)/schedule')}
            >
              <View style={styles.quickActionIconContainer}>
                <CalendarDays size={24} color="#1E40AF" />
              </View>
              <Text style={styles.quickActionText}>Check Schedule</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => router.push('/(specialist)/tabs/prescriptions')}
            >
              <View style={styles.quickActionIconContainer}>
                <Pill size={24} color="#1E40AF" />
              </View>
              <Text style={styles.quickActionText}>Issued{'\n'}Medicines</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => router.push('/(specialist)/tabs/certificates')}
            >
              <View style={styles.quickActionIconContainer}>
                <FileText size={24} color="#1E40AF" />
              </View>
              <Text style={styles.quickActionText}>Issued{'\n'}Certificates</Text>
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
                
                // Format appointment type to camel case
                const formatAppointmentType = (type: string) => {
                  if (!type) return 'General Consultation';
                  return type
                    .split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
                };

                // Format appointment date (abbreviated format)
                const formatAppointmentDate = (dateString: string) => {
                  try {
                    if (!dateString) return 'Date not specified';
                    // Parse the date string as local date to avoid timezone issues
                    const [year, month, day] = dateString.split('-').map(Number);
                    const date = new Date(year, month - 1, day); // month is 0-indexed
                    return date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    });
                  } catch (error) {
                    return 'Invalid date';
                  }
                };

                return (
                  <TouchableOpacity 
                    key={appointment.id} 
                    style={styles.appointmentCard}
                    onPress={() => {
                      // Route to referral-details if it's a referral, otherwise to visit-overview
                      if ('referringClinicId' in appointment) {
                        router.push(`/(specialist)/referral-details?id=${appointment.id}`);
                      } else {
                        router.push(`/visit-overview?id=${appointment.id}`);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    {/* Decorative corner accent */}
                    <View style={styles.cornerAccent} />
                    
                    {/* Gradient overlay */}
                    <View style={styles.gradientOverlay} />
                    
                    <View style={styles.appointmentHeader}>
                      <View style={styles.patientAvatar}>
                        <Text style={styles.patientInitial}>
                          {patientInitials}
                        </Text>
                      </View>
                      <View style={styles.appointmentDetails}>
                        <Text style={styles.patientName}>{patientName}</Text>
                        <Text style={styles.appointmentType}>
                          {formatAppointmentType(appointment.specialty || appointment.type || 'general_consultation')}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.appointmentFooter}>
                      <View style={styles.appointmentTimeInfo}>
                        <View style={styles.appointmentTimePill}>
                          <Calendar size={10} color="#6B7280" />
                          <Text style={styles.appointmentDate}>
                            {formatAppointmentDate(appointment.appointmentDate)}
                          </Text>
                        </View>
                        <View style={styles.appointmentTimePill}>
                          <Clock size={10} color="#6B7280" />
                          <Text style={styles.appointmentDate}>
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
                      <View style={styles.joinButton}>
                        <Text style={styles.joinButtonText}>View details</Text>
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
                  <TouchableOpacity 
                    key={patient.id} 
                    style={styles.patientCard}
                    onPress={() => router.push(`/patient-overview?id=${patient.id}`)}
                  >
                    <View style={styles.patientHeader}>
                      <View style={styles.patientAvatarNew}>
                        <Text style={styles.patientInitialNew}>
                          {patientInitials}
                        </Text>
                      </View>
                      <View style={styles.patientDetails}>
                        <Text style={styles.patientNameNew}>{patientName}</Text>
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
      </SafeAreaView>

      {/* === QR SCANNER MODAL === */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleManualCloseQRModal}
      >
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        {/* Backdrop/Blur */}
        <Pressable style={qrModalStyles.backdrop} onPress={handleManualCloseQRModal}>
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
                <TouchableOpacity style={qrModalStyles.closeButton} onPress={handleManualCloseQRModal}>
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
                  <TouchableOpacity style={qrModalStyles.permissionButton} onPress={handleManualCloseQRModal}>
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

      {/* === CONSENT WAITING MODAL === */}
      <Modal
        visible={showConsentWaiting}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseConsentWaiting}
      >
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <Pressable style={qrModalStyles.backdrop} onPress={handleCloseConsentWaiting}>
          <BlurView intensity={22} style={qrModalStyles.blurView}>
            <View style={qrModalStyles.backdropOverlay} />
          </BlurView>
        </Pressable>
        <View style={qrModalStyles.modalContainer}>
          <SafeAreaView style={qrModalStyles.safeArea}>
            <View style={qrModalStyles.modalContent}>
              <View style={qrModalStyles.header}>
                <View style={qrModalStyles.headerLeft}>
                  <Text style={qrModalStyles.headerTitle}>Waiting for Patient Consent</Text>
                  <Text style={qrModalStyles.headerSubtitle}>Please ask the patient to approve access on their device</Text>
                </View>
                <TouchableOpacity style={qrModalStyles.closeButton} onPress={handleCloseConsentWaiting}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <View style={qrModalStyles.divider} />
              
              <View style={qrModalStyles.loadingContainer}>
                <ActivityIndicator size="large" color="#1E40AF" />
                <Text style={qrModalStyles.loadingText}>
                  Waiting for patient to approve access to their medical records...
                </Text>
                <Text style={[qrModalStyles.loadingText, { marginTop: 16, fontSize: 14, color: '#6B7280' }]}>
                  This request will expire in 5 minutes
                </Text>
              </View>
              
              <View style={qrModalStyles.actions}>
                <TouchableOpacity
                  style={qrModalStyles.secondaryButton}
                  onPress={handleCloseConsentWaiting}
                >
                  <Text style={qrModalStyles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* === MANUAL CONSENT MODAL === */}
      <Modal
        visible={showManualConsent}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseManualConsent}
      >
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <Pressable style={qrModalStyles.backdrop} onPress={handleCloseManualConsent}>
          <BlurView intensity={22} style={qrModalStyles.blurView}>
            <View style={qrModalStyles.backdropOverlay} />
          </BlurView>
        </Pressable>
        <View style={qrModalStyles.modalContainer}>
          <SafeAreaView style={qrModalStyles.safeArea}>
            <View style={qrModalStyles.modalContent}>
              <View style={qrModalStyles.header}>
                <View style={qrModalStyles.headerLeft}>
                  <Text style={qrModalStyles.headerTitle}>Manual Consent Required</Text>
                  <Text style={qrModalStyles.headerSubtitle}>Electronic consent system is unavailable</Text>
                </View>
                <TouchableOpacity style={qrModalStyles.closeButton} onPress={handleCloseManualConsent}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <View style={qrModalStyles.divider} />
              
              <View style={qrModalStyles.permissionContainer}>
                <AlertCircleIcon size={64} color="#F59E0B" />
                <Text style={qrModalStyles.permissionTitle}>Request Verbal Consent</Text>
                <Text style={qrModalStyles.permissionText}>
                  Please ask the patient: "I need to access your medical records for this consultation. 
                  Do you give me permission to view your medical information?"
                </Text>
                
                <View style={qrModalStyles.actions}>
                  <TouchableOpacity
                    style={[qrModalStyles.secondaryButton, { backgroundColor: '#EF4444' }]}
                    onPress={() => handleManualConsentResponse('denied')}
                  >
                    <Text style={[qrModalStyles.secondaryButtonText, { color: '#FFFFFF' }]}>Patient Said No</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[qrModalStyles.secondaryButton, { backgroundColor: '#10B981' }]}
                    onPress={() => handleManualConsentResponse('approved')}
                  >
                    <Text style={[qrModalStyles.secondaryButtonText, { color: '#FFFFFF' }]}>Patient Said Yes</Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={[qrModalStyles.permissionText, { marginTop: 16, fontSize: 12, color: '#6B7280' }]}>
                  This consent will be logged for compliance purposes.
                </Text>
              </View>
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
                          {capitalizeRelationship(scannedPatient.emergencyContact.relationship)}
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
      
      {/* === GLOBAL NOTIFICATION MODAL === */}
      <GlobalNotificationModal
        visible={showNotificationModal}
        onClose={handleCloseNotificationModal}
        userRole="specialist"
      />

      {/* Debug Modal */}
      {/* <NotificationDebugger
        visible={showDebugger}
        onClose={() => setShowDebugger(false)}
      /> */}

      {/* Floating Debug Button */}
      {/* <TouchableOpacity
        style={{
          position: 'absolute',
          top: 100,
          right: 20,
          backgroundColor: '#FF6B6B',
          width: 60,
          height: 60,
          borderRadius: 30,
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        }}
        onPress={() => {
          console.log(' Specialist floating debug button pressed!');
          setShowDebugger(true);
        }}
        activeOpacity={0.8}
      >
        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>🐛</Text>
      </TouchableOpacity> */}
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
    fontSize: 18,
    fontFamily: 'Inter-Regular',
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
    gap: 8,
  },
  appointmentCard: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  cornerAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(30, 64, 175, 0.08)',
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 20,
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 60,
    height: 60,
    backgroundColor: 'rgba(30, 64, 175, 0.05)',
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 30,
  },
  appointmentHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12 
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
    fontSize: 14 
  },
  patientAvatarNew: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  patientInitialNew: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter-Regular',
  },
  patientNameNew: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    marginBottom: 2,
  },
  appointmentDetails: { flex: 1 },
  patientName: { 
    fontSize: 16, 
    color: '#1F2937' 
  },
  appointmentType: { 
    fontSize: 14, 
    color: '#6B7280', 
    marginTop: 2 
  },

  appointmentTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  appointmentTimePill: {
     flexDirection: 'row',
     alignItems: 'center',
     paddingHorizontal: 8,
     paddingVertical: 4,
     borderRadius: 12,
     backgroundColor: '#FFFFFF',
     borderWidth: 1,
     borderColor: '#D1D5DB',
     gap: 4,
   },
   appointmentDate: { 
     fontSize: 12, 
     color: '#6B7280',
     textAlign: 'center',
     fontFamily: 'Inter-Regular',
   },
  appointmentFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginTop: 8,
  },
  appointmentTimeInfo: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    marginRight: 12,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  joinButton: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    backgroundColor: '#1E40AF', 
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  joinButtonText: { 
    color: '#FFFFFF', 
    fontSize: 14 
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
    marginBottom: 4,
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
    paddingHorizontal: 0,
  },
  quickActionButton: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  quickActionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: { 
    fontSize: 12, 
    color: '#374151', 
    textAlign: 'center',
    fontFamily: 'Inter-Medium',
    lineHeight: 16,
  },
  toggleIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB'
  },
  rangeChipActive: {
    borderColor: '#1E40AF',
    backgroundColor: '#EFF6FF'
  },
  rangeChipText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-SemiBold'
  },
  rangeChipTextActive: {
    color: '#1E40AF'
  },
  // Chart styles
  chartHeader: {
    marginBottom: 24,
    alignItems: 'center',
  },
  chartHeaderNew: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  chartHeaderLeft: {
    flex: 1,
  },
  chartHeaderRight: {
    marginLeft: 16,
  },
  filterDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    position: 'relative',
    zIndex: 30, // Ensure filter dropdown is above chart elements
  },
  filterDropdownText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  filterDropdownIcon: {
    fontSize: 12,
    color: '#6B7280',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginTop: -20, // Reduced gap between button and dropdown
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 35, // Higher z-index to appear above all chart elements
    minWidth: 120,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemActive: {
    backgroundColor: '#EFF6FF',
  },
  dropdownItemText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  dropdownItemTextActive: {
    color: '#1E40AF',
    fontFamily: 'Inter-Medium',
  },
  chartTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 6,
    textAlign: 'left',
  },
  chartSubtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 10,
    textAlign: 'left',
  },
  chartWrapper: {
    position: 'relative',
    height: 240,
    width: '100%', // Use full width
    marginHorizontal: 0,
  },
  barsContainer: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    bottom: 20,
    zIndex: 10, // Lower z-index so bars appear below the line chart
    paddingHorizontal: 0, // Remove padding to avoid positioning conflicts
    marginHorizontal: 0,
  },
  bar: {
    marginHorizontal: 1,
    borderRadius: 6,
    overflow: 'visible', // Allow full height clickable area
    justifyContent: 'flex-end', // Align bar content to bottom
    zIndex: 15, // Higher z-index for mobile touch priority
    // Remove background to allow line chart to be visible
  },
  barSelected: {
    borderWidth: 1,
    borderColor: '#D6E2FF',
  },
  barBackground: {
    backgroundColor: '#F0F4FF',
    opacity: 0.8,
    borderRadius: 6,
    minHeight: 20, // Ensure minimum height for visibility
    width: '100%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  barBackgroundSelected: {
    backgroundColor: '#D1DDFF', // Darker blue for selected state
    opacity: 1.0,
    // Remove static border, will use animated glow instead
  },
  barGradientTop: {
    flex: 3,
    backgroundColor: '#FFFFFF',
    opacity: 0.9,
  },
  barGradientMiddle: {
    flex: 2,
    backgroundColor: '#F7FAFF',
    opacity: 0.7,
  },
  barGradientBottom: {
    flex: 1,
    backgroundColor: '#EDF4FF',
    opacity: 0.5,
  },

  lineChartContainer: {
    position: 'absolute',
    top: -15,
    left: 0,
    right: 0,
    height: 200,
    width: 360,
    zIndex: 20, // Higher z-index to appear above bars for proper visual layering
    paddingHorizontal: 0,
    marginRight: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none', // Make line chart non-interactive so bars can receive touch events

  },
  selectedDot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8BA4FF',
    zIndex: 2,
    alignSelf: 'center',
  },
  dotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  pointerPill: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pointerValue: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  pointerLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  xAxisLabelsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    zIndex: 1, // Keep below bars
    paddingHorizontal: 0,
    marginHorizontal: 0,
  },
  xAxisLabel: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  xAxisLabelText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  yAxisLabelsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 30,
    height: 220,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 1, // Keep below bars
    paddingVertical: 10,
  },
  yAxisLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  customTooltip: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    zIndex: 4, // Ensure tooltip is above everything
  },
  tooltipValue: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    textAlign: 'center',
  },
  tooltipLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
  },
  customLineChart: {
    position: 'relative',
    width: '100%',
    height: '100%',
    marginHorizontal: 10,
  },
  svgChart: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 2,
  },
  // Note: lineSegment and dataPoint styles are no longer used since we switched to SVG
  // The chart now uses smooth curved lines with SVG Path and Circle components

  barClickEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF', // Bright white flash
    borderRadius: 6,
    opacity: 0.9, // Much more visible
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

 