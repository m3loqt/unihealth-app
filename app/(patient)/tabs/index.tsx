import React, { useRef, useState, useEffect } from 'react';
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
  Dimensions,
  Modal,
  Pressable,
  Alert,
  Share as RNShare,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import {
  QrCode,
  FileText,
  Calendar,
  Clock,
  Bell,
  Pill,
  CheckCircle,
  Info,
  Download,
  Share,
  X,
  User,
  RefreshCw,
  Check,
  Trash2,
  MessageCircle,
  Hourglass,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing'; // Added for more robust sharing

import { useAuth } from '@/hooks/auth/useAuth';
import { useRealtimeNotificationContext } from '@/contexts/RealtimeNotificationContext';
import { databaseService } from '@/services/database/firebase';
import { Appointment, Prescription } from '@/services/database/firebase';
import { getGreeting } from '@/utils/greeting';
import { getFirstName } from '@/utils/string';
import { safeDataAccess } from '@/utils/safeDataAccess';
import { formatFrequency, formatRoute, formatFormula } from '@/utils/formatting';
import LoadingState from '@/components/ui/LoadingState';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { dataValidation } from '@/utils/dataValidation';
import { performanceUtils } from '@/utils/performance';
// import RealtimeNotificationTest from '@/components/shared/RealtimeNotificationTest';
import { getSafeNotifications, getSafeUnreadCount } from '@/utils/notificationUtils';
import { GlobalNotificationModal } from '@/components/shared';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_GAP = 16;
const HORIZONTAL_MARGIN = 24;
const CARD_WIDTH = SCREEN_WIDTH - 2 * HORIZONTAL_MARGIN - CARD_GAP;

const allHealthTips = [
  {
    image:
      'https://images.pexels.com/photos/40751/running-runner-long-distance-fitness-40751.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Stay Active',
    description:
      'Regular exercise helps maintain cardiovascular health and boosts your immune system.',
  },
  {
    image:
      'https://images.pexels.com/photos/461382/pexels-photo-461382.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Eat a Balanced Diet',
    description:
      'A variety of fruits, vegetables, lean proteins, and whole grains support your wellbeing.',
  },
  {
    image:
      'https://images.pexels.com/photos/317157/pexels-photo-317157.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Get Enough Sleep',
    description:
      'Aim for 7-8 hours of quality sleep each night to help your body recover and stay healthy.',
  },
  {
    image:
      'https://images.pexels.com/photos/143133/pexels-photo-143133.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Stay Hydrated',
    description:
      'Drink at least 8 glasses of water daily to maintain proper body function and energy levels.',
  },
  {
    image:
      'https://images.pexels.com/photos/1181345/pexels-photo-1181345.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Practice Mindfulness',
    description:
      'Take time for meditation or deep breathing to reduce stress and improve mental clarity.',
  },
  {
    image:
      'https://images.pexels.com/photos/1552106/pexels-photo-1552106.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Limit Screen Time',
    description:
      'Reduce blue light exposure before bedtime to improve sleep quality and eye health.',
  },
  {
    image:
      'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Eat More Fiber',
    description:
      'Include whole grains, fruits, and vegetables to support digestive health and maintain energy.',
  },
  {
    image:
      'https://images.pexels.com/photos/1181346/pexels-photo-1181346.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Take Regular Breaks',
    description:
      'Step away from work every hour to stretch and rest your eyes for better productivity.',
  },
  {
    image:
      'https://images.pexels.com/photos/1552103/pexels-photo-1552103.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Practice Good Posture',
    description:
      'Maintain proper alignment while sitting and standing to prevent back pain and improve breathing.',
  },
  {
    image:
      'https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Limit Processed Foods',
    description:
      'Choose fresh, whole foods over processed options to reduce sodium and artificial additives.',
  },
  {
    image:
      'https://images.pexels.com/photos/1181343/pexels-photo-1181343.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Get Sunlight Daily',
    description:
      'Spend 15-30 minutes outdoors to boost vitamin D levels and improve mood naturally.',
  },
  {
    image:
      'https://images.pexels.com/photos/1552104/pexels-photo-1552104.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Practice Deep Breathing',
    description:
      'Take slow, deep breaths throughout the day to reduce stress and improve oxygen flow.',
  },
  {
    image:
      'https://images.pexels.com/photos/1640775/pexels-photo-1640775.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Eat Regular Meals',
    description:
      'Maintain consistent meal times to stabilize blood sugar and support metabolic health.',
  },
  {
    image:
      'https://images.pexels.com/photos/1181344/pexels-photo-1181344.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Stay Socially Connected',
    description:
      'Maintain relationships with friends and family to support mental health and wellbeing.',
  },
  {
    image:
      'https://images.pexels.com/photos/1552105/pexels-photo-1552105.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Limit Caffeine Intake',
    description:
      'Keep caffeine consumption moderate to avoid sleep disruption and anxiety symptoms.',
  },
  {
    image:
      'https://images.pexels.com/photos/1640776/pexels-photo-1640776.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Include Healthy Fats',
    description:
      'Add avocados, nuts, and olive oil to your diet for heart health and nutrient absorption.',
  },
  {
    image:
      'https://images.pexels.com/photos/1181347/pexels-photo-1181347.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Practice Gratitude',
    description:
      'Write down three things you\'re grateful for daily to improve mood and life satisfaction.',
  },
  {
    image:
      'https://images.pexels.com/photos/1552107/pexels-photo-1552107.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Wash Hands Frequently',
    description:
      'Clean hands regularly with soap and water to prevent illness and maintain hygiene.',
  },
  {
    image:
      'https://images.pexels.com/photos/1640778/pexels-photo-1640778.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Eat Mindfully',
    description:
      'Focus on your food while eating to improve digestion and prevent overeating.',
  },
  {
    image:
      'https://images.pexels.com/photos/1181348/pexels-photo-1181348.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Take Vitamin Supplements',
    description:
      'Consider daily vitamins to fill nutritional gaps and support overall health.',
  },
  {
    image:
      'https://images.pexels.com/photos/1552108/pexels-photo-1552108.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Practice Good Hygiene',
    description:
      'Maintain personal cleanliness to prevent infections and boost confidence.',
  },
  {
    image:
      'https://images.pexels.com/photos/1640779/pexels-photo-1640779.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Limit Sugar Intake',
    description:
      'Reduce added sugars to prevent energy crashes and support long-term health.',
  },
  {
    image:
      'https://images.pexels.com/photos/1181349/pexels-photo-1181349.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Stay Mentally Active',
    description:
      'Engage in puzzles, reading, or learning to keep your mind sharp and healthy.',
  },
  {
    image:
      'https://images.pexels.com/photos/1552109/pexels-photo-1552109.jpeg?auto=compress&cs=tinysrgb&w=400',
    title: 'Practice Stress Management',
    description:
      'Use techniques like yoga or journaling to manage daily stress effectively.',
  },
];

export default function HomeScreen() {
  const { user } = useAuth();
  
  const { 
    notifications: realtimeNotificationData,
  } = useRealtimeNotificationContext();
  
  // Safely extract notifications and unread count
  const realtimeNotifications = getSafeNotifications(realtimeNotificationData.notifications);
  const realtimeUnreadCount = getSafeUnreadCount(realtimeNotificationData.unreadCount);
  const markRealtimeAsRead = realtimeNotificationData.markAsRead;
  const markAllRealtimeAsRead = realtimeNotificationData.markAllAsRead;
  const deleteRealtimeNotification = realtimeNotificationData.deleteNotification;
  const refreshRealtimeNotifications = realtimeNotificationData.refresh;
  const [activeTip, setActiveTip] = useState(0);
  const [healthTips, setHealthTips] = useState(allHealthTips.slice(0, 5)); // Start with first 5
  const scrollRef = useRef<ScrollView>(null);
  const autoScrollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrCodeRef = useRef<any>(null);
  const qrCodeViewShotRef = useRef<any>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrValue, setQrValue] = useState<string>('');
  const [qrReady, setQrReady] = useState<boolean>(false);
  const [showQRSuccessModal, setShowQRSuccessModal] = useState<boolean>(false);
  const [hasMediaPermission, setHasMediaPermission] = useState<boolean>(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [activePrescriptions, setActivePrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrActionLoading, setQrActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);

  // Function to get 5 random tips for today
  const getDailyHealthTips = async () => {
    try {
      const today = new Date().toDateString();
      const storedDate = await AsyncStorage.getItem('healthTipsDate');
      const storedTips = await AsyncStorage.getItem('healthTips');
      
      // If it's a new day or no stored data, generate new random tips
      if (storedDate !== today || !storedTips) {
        const shuffled = [...allHealthTips].sort(() => 0.5 - Math.random());
        const selectedTips = shuffled.slice(0, 5);
        
        // Store for today
        await AsyncStorage.setItem('healthTipsDate', today);
        await AsyncStorage.setItem('healthTips', JSON.stringify(selectedTips));
        
        return selectedTips;
      }
      
      // Return stored tips for today
      return JSON.parse(storedTips);
    } catch (error) {
      console.error('Error getting daily health tips:', error);
      // Fallback if anything fails
      const shuffled = [...allHealthTips].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, 5);
    }
  };

  // Load user data
  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  // Initialize daily health tips
  useEffect(() => {
    const loadDailyTips = async () => {
      const dailyTips = await getDailyHealthTips();
      setHealthTips(dailyTips);
    };
    loadDailyTips();
  }, []);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (autoScrollInterval.current) {
        clearInterval(autoScrollInterval.current);
        autoScrollInterval.current = null;
      }
    };
  }, []);

  // Auto-scroll functionality
  useEffect(() => {
    // Clear any existing interval
    if (autoScrollInterval.current) {
      clearInterval(autoScrollInterval.current);
      autoScrollInterval.current = null;
    }

    // Only start auto-scroll if we have more than 1 tip and tips are loaded
    if (healthTips.length > 1) {
      autoScrollInterval.current = setInterval(() => {
        setActiveTip(prev => {
          const nextTip = (prev + 1) % healthTips.length;
          scrollRef.current?.scrollTo({
            x: nextTip * (CARD_WIDTH + CARD_GAP),
            animated: true,
          });
          return nextTip;
        });
      }, 4000); // Change tip every 4 seconds
    }

    return () => {
      if (autoScrollInterval.current) {
        clearInterval(autoScrollInterval.current);
        autoScrollInterval.current = null;
      }
    };
  }, [healthTips]);

  const loadDashboardData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Load appointments with validation
      setAppointmentsLoading(true);
      const appointments = await databaseService.getAppointments(user.uid, user.role);
      const validAppointments = dataValidation.validateArray(appointments, dataValidation.isValidAppointment);
      const upcoming = validAppointments.filter(appt =>
        appt.status === 'confirmed'
      ).slice(0, 3);
      
      // Debug logging for doctor names
      console.log('Upcoming appointments doctor data:', upcoming.map(appt => ({
        id: appt.id,
        doctorId: appt.doctorId,
        doctorFirstName: appt.doctorFirstName,
        doctorLastName: appt.doctorLastName,
        specialty: appt.specialty,
        type: appt.type
      })));
      
      setUpcomingAppointments(upcoming);
      setAppointmentsLoading(false);
      
      // Load prescriptions with validation
      setPrescriptionsLoading(true);
      const prescriptions = await databaseService.getPrescriptions(user.uid);
      const validPrescriptions = dataValidation.validateArray(prescriptions, dataValidation.isValidPrescription);
      
      // Debug logging
      console.log('All prescriptions:', prescriptions.map(p => ({ id: p.id, status: p.status, prescribedDate: p.prescribedDate, duration: p.duration })));
      console.log('Valid prescriptions:', validPrescriptions.map(p => ({ id: p.id, status: p.status, prescribedDate: p.prescribedDate, duration: p.duration })));
      
      // Filter for active prescriptions only
      const active = validPrescriptions.filter(prescription => {
        // Check if prescription is expired
        if (prescription.status === 'active' && prescription.prescribedDate && prescription.duration) {
          try {
            const prescribedDate = new Date(prescription.prescribedDate);
            const now = new Date();
            
            // Parse duration string (e.g., "7 days", "2 weeks", "1 month")
            const durationMatch = prescription.duration.match(/^(\d+)\s*(day|days|week|weeks|month|months|year|years)$/i);
            
            if (durationMatch) {
              const [, amount, unit] = durationMatch;
              const durationAmount = parseInt(amount, 10);
              const durationUnit = unit.toLowerCase();
              
              // Calculate end date
              const endDate = new Date(prescription.prescribedDate);
              
              switch (durationUnit) {
                case 'day':
                case 'days':
                  endDate.setDate(endDate.getDate() + durationAmount);
                  break;
                case 'week':
                case 'weeks':
                  endDate.setDate(endDate.getDate() + (durationUnit === 'week' ? durationAmount * 7 : durationAmount * 7));
                  break;
                case 'month':
                case 'months':
                  endDate.setMonth(endDate.getMonth() + durationAmount);
                  break;
                case 'year':
                case 'years':
                  endDate.setFullYear(endDate.getFullYear() + durationAmount);
                  break;
                default:
                  return true; // Keep as active if we can't parse the duration
              }
              
              // If current date is past the end date, filter out
              if (now > endDate) {
                return false;
              }
            }
          } catch (error) {
            console.error('Error checking prescription expiration:', error);
          }
        }
        
        return prescription.status === 'active';
      }).slice(0, 3);
      
      console.log('Filtered active prescriptions:', active.map(p => ({ id: p.id, status: p.status, prescribedDate: p.prescribedDate, duration: p.duration })));
      
      setActivePrescriptions(active);
      setPrescriptionsLoading(false);
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data. Please try again.');
      setAppointmentsLoading(false);
      setPrescriptionsLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    loadDashboardData();
  };

  // Performance optimization: memoize filtered data
  const filteredAppointments = performanceUtils.useDeepMemo(() => 
    upcomingAppointments.filter(appt => 
      appt.status === 'confirmed'
    ), [upcomingAppointments]
  );

  const filteredPrescriptions = performanceUtils.useDeepMemo(() => 
    activePrescriptions.filter(prescription => 
      prescription.status === 'active'
    ), [activePrescriptions]
  );

  // Performance optimization: stable callbacks
  const handleScroll = performanceUtils.useStableCallback((event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const page = Math.round(x / (CARD_WIDTH + CARD_GAP));
    setActiveTip(Math.min(page, healthTips.length - 1));
  }, [healthTips.length]);

  // Handle manual scroll (pause auto-scroll temporarily)
  const handleManualScroll = performanceUtils.useStableCallback(() => {
    // Clear existing interval
    if (autoScrollInterval.current) {
      clearInterval(autoScrollInterval.current);
      autoScrollInterval.current = null;
    }
    
    // Resume auto-scroll after 10 seconds of inactivity
    setTimeout(() => {
      if (healthTips.length > 1 && !autoScrollInterval.current) {
        autoScrollInterval.current = setInterval(() => {
          setActiveTip(prev => {
            const nextTip = (prev + 1) % healthTips.length;
            scrollRef.current?.scrollTo({
              x: nextTip * (CARD_WIDTH + CARD_GAP),
              animated: true,
            });
            return nextTip;
          });
        }, 4000);
      }
    }, 10000);
  }, [healthTips]);

  // Header initials for logged in user
  const userInitials = (() => {
    const fullName = safeDataAccess.getUserFullName(user, user?.email || 'User');
    return fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || 'U';
  })();

  // QR Modal Actions
  const handleOpenQRModal = async () => {
    const payload = JSON.stringify({
      type: 'patient',
      id: user?.uid || 'user-id',
      name: safeDataAccess.getUserFullName(user, 'Unknown User'),
      email: user?.email || 'Email not provided',
      timestamp: new Date().toISOString(),
    });
    setQrValue(payload);
    setQrReady(false);
    // Pre-flight media permission (Android) to avoid prompt on first download click
    try {
      if (Platform.OS === 'android') {
        const current = await MediaLibrary.getPermissionsAsync();
        if (current.status !== 'granted') {
          const req = await MediaLibrary.requestPermissionsAsync();
          setHasMediaPermission(req.status === 'granted');
        } else {
          setHasMediaPermission(true);
        }
      } else {
        setHasMediaPermission(true);
      }
    } catch (e) {
      // If permission preflight fails, we'll re-attempt during download
      setHasMediaPermission(false);
    }
    setShowQRModal(true);
  };
  const handleCloseQRModal = () => {
    setShowQRModal(false);
    setQrReady(false);
  };

  // Notification Modal Actions
  const handleOpenNotifications = () => {
    setShowNotificationModal(true);
  };
  
  const handleCloseNotificationModal = () => setShowNotificationModal(false);
  
  



  // --- Improved Download QR as Image ---
  const handleDownload = async () => {
    if (qrActionLoading) return;
    try {
      setQrActionLoading(true);

      if (!hasMediaPermission) {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Please grant media library permissions to download the QR code.');
          return;
        }
        setHasMediaPermission(true);
      }

      if (!qrReady) {
        await new Promise(resolve => setTimeout(resolve, 180));
      }

      // Capture QR code as PNG image
      const uri = await qrCodeViewShotRef.current.capture();

      // Save to gallery (MediaLibrary)
      const asset = await MediaLibrary.createAssetAsync(uri);
      try {
        await MediaLibrary.createAlbumAsync('UniHealth', asset, false);
      } catch (e) {
        await MediaLibrary.saveToLibraryAsync(uri);
      }

      setShowQRSuccessModal(true);
    } catch (error) {
      console.error('Error downloading QR code:', error);
      Alert.alert('Error', 'Failed to download QR code. Please try again.');
    } finally {
      setQrActionLoading(false);
    }
  };

  // --- Improved Share QR as Image ---
  const handleShare = async () => {
    if (qrActionLoading) return;
    try {
      setQrActionLoading(true);

      if (!qrReady) {
        await new Promise(resolve => setTimeout(resolve, 180));
      }

      // Capture QR code as PNG image
      const uri = await qrCodeViewShotRef.current.capture();

      // Save image to cache directory with .png extension
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `patient-qr-${timestamp}.png`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.copyAsync({ from: uri, to: fileUri });

      // Share using expo-sharing (preferred) if available
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'image/png',
          dialogTitle: 'Share Patient QR Code',
        });
      } else {
        // Fallback to RNShare
        await RNShare.share({
          url: Platform.OS === 'ios' ? fileUri : `file://${fileUri}`,
          title: 'Patient QR Code',
        });
      }
    } catch (error) {
      console.error('Error sharing QR code:', error);
      Alert.alert('Error', 'Failed to share QR code. Please try again.');
    } finally {
      setQrActionLoading(false);
    }
  };

  // Placeholder components
  const renderAppointmentPlaceholder = () => (
    <View style={styles.emptyStateCard}>
      <Calendar size={48} color="#9CA3AF" />
      <Text style={styles.emptyStateTitle}>No Upcoming Appointments</Text>
      <Text style={styles.emptyStateDescription}>
        You don't have any upcoming appointments scheduled.
      </Text>
      <TouchableOpacity
        style={styles.emptyStateButton}
        onPress={() => router.push('/book-visit')}
      >
        <Text style={styles.emptyStateButtonText}>Book an Appointment</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPrescriptionPlaceholder = () => (
    <View style={styles.emptyStateCard}>
      <Pill size={48} color="#9CA3AF" />
      <Text style={styles.emptyStateTitle}>No Active Prescriptions</Text>
      <Text style={styles.emptyStateDescription}>
        Yey! No any active prescriptions at the moment.
      </Text>
      <TouchableOpacity
        style={styles.emptyStateButton}
        onPress={() => router.push('/(patient)/tabs/prescriptions')}
      >
        <Text style={styles.emptyStateButtonText}>View All Prescriptions</Text>
      </TouchableOpacity>
    </View>
  );
  
  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
        >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.firstName || ''}</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => router.push('/(patient)/tabs/chats')}
            >
              <MessageCircle size={24} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={handleOpenNotifications}
            >
              <Bell size={24} color="#6B7280" />
              {realtimeUnreadCount > 0 && (
                <View style={styles.notifDot}>
                  <Text style={styles.notifDotText}>
                    {realtimeUnreadCount > 9 ? '9+' : realtimeUnreadCount.toString()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(patient)/tabs/profile')}>
              <View style={styles.profileInitialsCircle}>
                <Text style={styles.profileInitialsText}>{userInitials}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Health Tip Carousel */}
        <View style={[styles.section, { paddingHorizontal: 0 }]}>
          <Text style={[styles.sectionTitle, { marginLeft: HORIZONTAL_MARGIN }]}>Today's Health Tip</Text>
          <View style={{ marginLeft: HORIZONTAL_MARGIN }}>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled={false}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingRight: HORIZONTAL_MARGIN,
              }}
              onScroll={handleScroll}
              onScrollBeginDrag={handleManualScroll}
              scrollEventThrottle={16}
              snapToInterval={CARD_WIDTH + CARD_GAP}
              decelerationRate="fast"
              bounces={false}
            >
              {healthTips.map((tip, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.tipCarouselCard,
                    {
                      width: CARD_WIDTH,
                      marginRight: idx !== healthTips.length - 1 ? CARD_GAP : 0,
                    },
                  ]}
                >
                  <Image source={{ uri: tip.image }} style={styles.tipCarouselImage} />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.80)']}
                    style={styles.tipGradient}
                  />
                  <View style={styles.tipTextContent}>
                    <View style={styles.tipTitleContainer}>
                      <Info size={14} color="#FFFFFF" />
                      <Text style={styles.tipCarouselTitle}>{tip.title}</Text>
                    </View>
                    <Text style={styles.tipCarouselDesc} numberOfLines={2} ellipsizeMode="tail">{tip.description}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
          {/* Carousel indicators */}
          <View style={styles.carouselIndicators}>
            {healthTips.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.carouselDot,
                  activeTip === i && styles.carouselDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickActionButton} onPress={handleOpenQRModal}>
              <QrCode size={24} color="#1E40AF" />
              <Text style={styles.quickActionText}>Generate{'\n'}QR Code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => router.push('/(patient)/tabs/appointments?filter=completed')}
            >
              <FileText size={24} color="#1E40AF" />
              <Text style={styles.quickActionText}>View Med{'\n'} History</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => router.push('/book-visit')}
            >
              <Calendar size={24} color="#1E40AF" />
              <Text style={styles.quickActionText}>Book Clinic Consultation</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Real-time Notification Test */}
        {/* <RealtimeNotificationTest /> */}

        {/* Upcoming Appointments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
            <TouchableOpacity onPress={() => router.push('/(patient)/tabs/appointments?filter=confirmed')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <View>
            {appointmentsLoading ? (
              <LoadingState 
                message="Loading appointments..." 
                variant="inline" 
                size="small" 
              />
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : filteredAppointments.length === 0 ? (
              renderAppointmentPlaceholder()
            ) : (
              upcomingAppointments.map((appt) => (
                <TouchableOpacity 
                  key={appt.id} 
                  style={styles.appointmentCard}
                  onPress={() => router.push(`/visit-overview?id=${appt.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.appointmentHeader}>
                    <View style={styles.doctorAvatar}>
                      <Text style={styles.doctorInitial}>
                        {(() => {
                          const firstName = appt.doctorFirstName || '';
                          const lastName = appt.doctorLastName || '';
                          if (firstName && lastName) {
                            return `${firstName[0]}${lastName[0]}`.toUpperCase();
                          }
                          if (firstName) {
                            return firstName[0].toUpperCase();
                          }
                          return 'DR';
                        })()}
                      </Text>
                    </View>
                    <View style={styles.appointmentDetails}>
                      <Text style={styles.doctorName}>
                        {(() => {
                          // Try to get doctor name from appointment data
                          if (appt.doctorFirstName && appt.doctorLastName) {
                            return `Dr. ${appt.doctorFirstName} ${appt.doctorLastName}`;
                          }
                          if (appt.doctorFirstName) {
                            return `Dr. ${appt.doctorFirstName}`;
                          }
                          if (appt.doctorLastName) {
                            return `Dr. ${appt.doctorLastName}`;
                          }
                          
                          // Fallback to safeDataAccess
                          const doctorName = safeDataAccess.getAppointmentDoctorName(appt, 'Dr. Unknown');
                          return doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`;
                        })()}
                      </Text>
                      <Text style={styles.doctorSpecialty}>{appt.specialty || 'General Medicine'}</Text>
                    </View>
                     <View style={styles.appointmentTimePill}>
                       <Calendar size={10} color="#9CA3AF" />
                       <Text style={styles.appointmentDate}>
                         {appt.appointmentDate ? (() => {
                           try {
                             // Parse the date string as local date to avoid timezone issues
                             const [year, month, day] = appt.appointmentDate.split('-').map(Number);
                             const date = new Date(year, month - 1, day); // month is 0-indexed
                             return date.toLocaleDateString('en-US', {
                               month: 'long',
                               day: 'numeric',
                               year: 'numeric'
                             });
                           } catch (error) {
                             return 'Invalid date';
                           }
                         })() : 'Date not specified'}
                       </Text>
                     </View>
                  </View>
                  <View style={styles.appointmentFooter}>
                    <Text style={styles.appointmentType}>{appt.appointmentPurpose || 'Consultation'}</Text>
                    <View style={styles.joinButton}>
                      <Text style={styles.joinButtonText}>View details</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

        {/* Active Prescriptions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Prescriptions</Text>
            <TouchableOpacity onPress={() => router.push('/(patient)/tabs/prescriptions?filter=active')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.prescriptionsContainer}>
            {prescriptionsLoading ? (
              <LoadingState 
                message="Loading prescriptions..." 
                variant="inline" 
                size="small" 
              />
            ) : filteredPrescriptions.length === 0 ? (
              renderPrescriptionPlaceholder()
            ) : (
              filteredPrescriptions.map((prescription) => (
                <View key={prescription.id} style={styles.prescriptionCard}>
                  <View style={styles.prescriptionHeader}>
                    <View style={[styles.medicationIcon, { backgroundColor: '#1E3A8A15' }]}>
                      <Pill size={20} color="#1E3A8A" />
                    </View>
                    <View style={styles.prescriptionDetails}>
                      {/* Medication name with dosage */}
                      <View style={styles.medicationNameRow}>
                        <Text style={styles.medicationName}>
                          {prescription.medication || 'Unknown Medication'}
                        </Text>
                        {prescription.dosage && (
                          <Text style={styles.medicationDosage}>
                            {` (${prescription.dosage})`}
                          </Text>
                        )}
                      </View>
                      
                      {/* Structured description */}
                      <Text style={styles.prescriptionDescription}>
                        {(() => {
                          // Build structured description with available data
                          let description = '';
                          
                          // Start with "Take" if we have any dosage info
                          let hasStarted = false;
                          
                          // Handle take amount and formula
                          if (prescription.take && prescription.formula) {
                            const formulaText = prescription.formula.toLowerCase().includes('tab') ? 
                              (prescription.take === '1' ? 'tablet' : 'tablets') : 
                              prescription.formula.replace(/,.*/, '').trim();
                            description = `Take ${prescription.take} ${formulaText}`;
                            hasStarted = true;
                          } else if (prescription.take) {
                            // If we have take but no formula, assume tablets
                            const unit = prescription.take === '1' ? 'tablet' : 'tablets';
                            description = `Take ${prescription.take} ${unit}`;
                            hasStarted = true;
                          } else if (prescription.formula) {
                            // If we have formula but no take amount
                            description = `Take ${prescription.formula.replace(/,.*/, '').trim()}`;
                            hasStarted = true;
                          } else {
                            // No specific amount, just start with "Take"
                            description = 'Take';
                            hasStarted = true;
                          }
                          
                          // Add route (by mouth, etc.)
                          if (prescription.route) {
                            const route = prescription.route.toLowerCase().trim();
                            let routeText = '';
                            if (route === 'po' || route === 'p.o.' || route === 'po or po' || route.includes('po')) {
                              routeText = 'by mouth';
                            } else {
                              routeText = route;
                            }
                            
                            if (routeText) {
                              description = hasStarted ? `${description} ${routeText}` : routeText;
                              hasStarted = true;
                            }
                          }
                          
                          // Add frequency 
                          if (prescription.frequency) {
                            const freq = prescription.frequency.toLowerCase().trim();
                            let freqText = '';
                            if (freq === 'daily' || freq === 'once daily' || freq === 'every day') {
                              freqText = 'daily';
                            } else if (freq === 'bid' || freq === 'twice daily') {
                              freqText = 'twice daily';
                            } else if (freq === 'tid' || freq === 'three times daily') {
                              freqText = 'three times daily';
                            } else {
                              freqText = freq;
                            }
                            
                            if (freqText) {
                              description = hasStarted ? `${description} ${freqText}` : freqText;
                              hasStarted = true;
                            }
                          }
                          
                          // Add duration
                          if (prescription.duration) {
                            const durationText = `for ${prescription.duration}`;
                            description = hasStarted ? `${description} ${durationText}` : durationText;
                            hasStarted = true;
                          }
                          
                          // End main instruction with period
                          if (description && hasStarted) {
                            description += '.';
                          }
                          
                          // Add total quantity as separate sentence (only if we have it)
                          if (prescription.totalQuantity) {
                            const quantityText = prescription.formula && prescription.formula.toLowerCase().includes('tab') ? 
                              `Total: ${prescription.totalQuantity} tablets.` : 
                              `Total: ${prescription.totalQuantity}.`;
                            description = description ? `${description} ${quantityText}` : quantityText;
                          }
                          
                          // Add custom instructions if available and meaningful
                          if (prescription.instructions && prescription.instructions.trim() && 
                              prescription.instructions.toLowerCase() !== 'as prescribed') {
                            const instructions = prescription.instructions.trim();
                            if (!description.toLowerCase().includes(instructions.toLowerCase())) {
                              description = description ? `${description} ${instructions}` : instructions;
                            }
                          }
                          
                          return description || 'No dosage instructions available.';
                        })()}
                      </Text>
                    </View>
                    
                    {/* Days left section */}
                    <View style={styles.prescriptionStatus}>
                      {(() => {
                        // Calculate remaining days logic similar to prescriptions.tsx
                        if (!prescription.duration || 
                            prescription.duration.toLowerCase().includes('ongoing') || 
                            prescription.duration.toLowerCase().includes('continuous')) {
                          return (
                            <View style={styles.remainingDaysPill}>
                              <Hourglass size={10} color="#9CA3AF" />
                              <Text style={styles.remainingDays}>Ongoing</Text>
                            </View>
                          );
                        }
                        
                        try {
                          const prescribedDate = new Date(prescription.prescribedDate);
                          const now = new Date();
                          const durationMatch = prescription.duration.match(/^(\d+)\s*(day|days|week|weeks|month|months|year|years)$/i);
                          
                          if (durationMatch) {
                            const [, amount, unit] = durationMatch;
                            const durationAmount = parseInt(amount, 10);
                            const durationUnit = unit.toLowerCase();
                            
                            const endDate = new Date(prescribedDate);
                            switch (durationUnit) {
                              case 'day':
                              case 'days':
                                endDate.setDate(endDate.getDate() + durationAmount);
                                break;
                              case 'week':
                              case 'weeks':
                                endDate.setDate(endDate.getDate() + (durationAmount * 7));
                                break;
                              case 'month':
                              case 'months':
                                endDate.setMonth(endDate.getMonth() + durationAmount);
                                break;
                              case 'year':
                              case 'years':
                                endDate.setFullYear(endDate.getFullYear() + durationAmount);
                                break;
                            }
                            
                            const remainingTime = endDate.getTime() - now.getTime();
                            const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
                            
                            if (remainingDays > 0) {
                              return (
                                <View style={styles.remainingDaysPill}>
                                  <Hourglass size={10} color="#9CA3AF" />
                                  <Text style={styles.remainingDays}>
                                    {remainingDays} days left
                                  </Text>
                                </View>
                              );
                            } else {
                              return (
                                <View style={styles.remainingDaysPill}>
                                  <Hourglass size={10} color="#9CA3AF" />
                                  <Text style={styles.remainingDays}>Expired</Text>
                                </View>
                              );
                            }
                          }
                        } catch (error) {
                          console.error('Error calculating remaining days:', error);
                        }
                        
                        return (
                          <View style={styles.remainingDaysPill}>
                            <Hourglass size={10} color="#9CA3AF" />
                            <Text style={styles.remainingDays}>Ongoing</Text>
                          </View>
                        );
                      })()}
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* === QR CODE MODAL === */}
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
            <View style={qrModalStyles.overlay} />
          </BlurView>
        </Pressable>
        {/* Modal Content */}
        <View style={qrModalStyles.modalContainer}>
          <SafeAreaView style={qrModalStyles.safeArea}>
            <View style={qrModalStyles.modalContent}>
              {/* Header */}
              <View style={qrModalStyles.header}>
                <View style={qrModalStyles.headerLeft}>
                  <Text style={qrModalStyles.headerTitle}>Patient QR Code</Text>
                  <Text style={qrModalStyles.headerSubtitle}>Scan to access medical records</Text>
                </View>
                <TouchableOpacity style={qrModalStyles.closeButton} onPress={handleCloseQRModal}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              {/* Divider */}
              <View style={qrModalStyles.divider} />
              {/* QR Code */}
              <View style={qrModalStyles.qrContainer}>
                <ViewShot
                  ref={qrCodeViewShotRef}
                  options={{
                    format: 'png',
                    quality: 1,
                    width: 300,
                    height: 300,
                  }}
                >
                  <View style={qrModalStyles.qrCodeWrapper} onLayout={() => setQrReady(true)}>
                                      <QRCode
                    ref={qrCodeRef}
                    value={qrValue || ''}
                    key={qrValue}
                    size={180}
                    color="#1F2937"
                    backgroundColor="#FFFFFF"
                  />
                  </View>
                </ViewShot>
                <View style={qrModalStyles.patientInfo}>
                  <Text style={qrModalStyles.patientName}>
                    {safeDataAccess.getUserFullName(user, 'Unknown User')}
                  </Text>
                  {/* <Text style={qrModalStyles.patientId}>ID: {user?.uid || 'ID not available'}</Text> */}
                  <Text style={qrModalStyles.patientEmail}>{user?.email || 'Email not provided'}</Text>
                </View>
              </View>
              {/* Instructions */}
              <View style={qrModalStyles.instructions}>
                <Text style={qrModalStyles.instructionsTitle}>How to use:</Text>
                <Text style={qrModalStyles.instructionsText}>
                  • Show this QR code to your healthcare provider{'\n'}
                  • They can scan it to instantly access your medical records{'\n'}
                  • Keep this code private and secure
                </Text>
              </View>
              {/* Action Buttons */}
              <View style={qrModalStyles.actions}>
                <TouchableOpacity
                  style={[qrModalStyles.secondaryButton, (qrActionLoading || !qrReady) && qrModalStyles.disabledButton]}
                  onPress={handleDownload}
                  disabled={qrActionLoading || !qrReady}
                >
                  <Download size={20} color="#374151" />
                  <Text style={qrModalStyles.secondaryButtonText}>
                    {qrActionLoading ? 'Downloading...' : 'Download'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[qrModalStyles.primaryButton, (qrActionLoading || !qrReady) && qrModalStyles.disabledButton]}
                  onPress={handleShare}
                  disabled={qrActionLoading || !qrReady}
                >
                  <Share size={20} color="#FFFFFF" />
                  <Text style={qrModalStyles.primaryButtonText}>
                    {qrActionLoading ? 'Sharing...' : 'Share'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* === QR SUCCESS MODAL (Bottom Sheet, styled like SignIn success) === */}
      <Modal
        visible={showQRSuccessModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowQRSuccessModal(false)}
      >
        <Pressable style={qrSuccessStyles.backdrop} onPress={() => setShowQRSuccessModal(false)}>
          <View style={qrSuccessStyles.backdropOverlay} />
        </Pressable>
        <View style={qrSuccessStyles.modalContainer}>
          <SafeAreaView style={qrSuccessStyles.safeArea}>
            <Pressable style={qrSuccessStyles.modalContent} onPress={() => setShowQRSuccessModal(false)}>
              <View style={qrSuccessStyles.successContent}>
                <View style={qrSuccessStyles.successIcon}>
                  <CheckCircle size={48} color="#1E40AF" />
                </View>
                <Text style={qrSuccessStyles.successTitle}>Saved to Photos</Text>
                <Text style={qrSuccessStyles.successSubtitle}>Your QR Code has been saved to your gallery.{"\n"}Click anywhere to continue.</Text>
              </View>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
                  
      {/* === GLOBAL NOTIFICATION MODAL === */}
      <GlobalNotificationModal
        visible={showNotificationModal}
        onClose={handleCloseNotificationModal}
        userRole="patient"
      />

    </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollView: { flex: 1 },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Inter-Regular',
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  headerContent: {
    flex: 1,
    marginRight: 10,
  },
  greeting: { fontSize: 16, color: '#6B7280' },
  userName: { fontSize: 24, color: '#1F2937', marginTop: 4 },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { padding: 8 },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 12,
  },
  profileInitialsCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 12,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitialsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  section: { padding: 24, backgroundColor: '#FFFFFF', marginTop: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, color: '#1F2937', marginBottom: 16 },
  seeAllText: { fontSize: 14, color: '#1E40AF' },
  tipCarouselCard: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 175,
    position: 'relative',
    backgroundColor: '#000',
    marginBottom: 4,
  },
  tipCarouselImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    resizeMode: 'cover',
  },
  tipGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },
  tipTextContent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 16,
    zIndex: 10,
  },
  tipTitleContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    backdropFilter: 'blur(10px)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tipCarouselTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 1 },
  },
  tipCarouselDesc: {
    fontSize: 14,
    color: '#F1F5F9',
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    textShadowColor: 'rgba(0,0,0,0.17)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
    maxHeight: 36, // 2 lines * 18px line height
  },
  carouselIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  carouselDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 2,
  },
  carouselDotActive: {
    backgroundColor: '#1E40AF',
    width: 16,
  },
  quickActionsContainer: { 
    padding: 24, 
    backgroundColor: '#FFFFFF', 
    marginTop: 8 
  },
  quickActions: { 
    flexDirection: 'row', 
    justifyContent: 'space-between'
  },
  quickActionButton: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickActionText: { 
    fontSize: 12, 
    color: '#374151', 
    marginTop: 8, 
    textAlign: 'center' 
  },
  
  appointmentCard: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  appointmentHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  doctorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  doctorInitial: { 
    color: '#FFFFFF', 
    fontSize: 14 
  },
  appointmentDetails: { flex: 1 },
  doctorName: { 
    fontSize: 16, 
    color: '#1F2937' 
  },
  doctorSpecialty: { 
    fontSize: 14, 
    color: '#6B7280', 
    marginTop: 2 
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
     color: '#9CA3AF',
     textAlign: 'center',
     fontFamily: 'Inter-Regular',
   },
  appointmentFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  appointmentType: { 
    fontSize: 14, 
    color: '#374151' 
  },
  joinButton: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    backgroundColor: '#1E40AF', 
    borderRadius: 8 
  },
  joinButtonText: { 
    color: '#FFFFFF', 
    fontSize: 14 
  },
  prescriptionsContainer: { gap: 12 },
  prescriptionCard: { 
    padding: 16, 
    backgroundColor: '#F9FAFB', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#E5E7EB' 
  },
  prescriptionHeader: { 
    flexDirection: 'row', 
    alignItems: 'flex-start' 
  },
  medicationIcon: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12,
    marginTop: 2,
  },
  prescriptionDetails: { flex: 1 },
  medicationNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  medicationName: { 
    fontSize: 16, 
    color: '#1F2937',
  },
  medicationDosage: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
    fontFamily: 'Inter-Regular',
  },
  remainingDaysPill: {
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
  remainingDays: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  prescriptionDescription: { 
    fontSize: 13, 
    color: '#6B7280', 
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
    marginTop: 2,
  },
  prescriptionStatus: { 
    alignItems: 'flex-end',
    gap: 8,
  },

  // Empty state styles
  emptyStateCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  emptyStateButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  notifDot: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  notifDotText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
});

// QR Modal Styles
const qrModalStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
  },
  blurView: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.34)' },
  modalContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 2,
  },
  safeArea: { width: SCREEN_WIDTH * 0.92, maxWidth: 410 },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 26,
    alignItems: 'stretch',
    // NO SHADOW, clean card!
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
  qrContainer: { alignItems: 'center', marginBottom: 18 },
  qrCodeWrapper: {
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 14,
    // Removed shadow, as requested!
  },
  patientInfo: { alignItems: 'center', marginBottom: 2 },
  patientName: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  patientId: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
    marginBottom: 0,
    letterSpacing: 0.2,
  },
  patientEmail: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  instructions: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  instructionsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 6,
  },
  instructionsText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  actions: { flexDirection: 'row', gap: 12 },
  primaryButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter-SemiBold' },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
  },
  secondaryButtonText: { color: '#374151', fontSize: 15, fontFamily: 'Inter-SemiBold' },
  disabledButton: {
    opacity: 0.6,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Inter-Regular',
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
});

 
// QR Download Success Modal Styles (bottom sheet, aligned with SignIn success modal)
const qrSuccessStyles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },
  backdropOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContainer: { flex: 1, justifyContent: 'flex-end', zIndex: 2 },
  safeArea: { width: '100%' },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'stretch',
    minHeight: SCREEN_HEIGHT * 0.35,
  },
  successContent: { alignItems: 'center', paddingVertical: 16, flex: 1, justifyContent: 'center' },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  successTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 4, textAlign: 'center' },
  successSubtitle: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  primaryButton: { flex: 1, backgroundColor: '#1E40AF', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-SemiBold' },
});
