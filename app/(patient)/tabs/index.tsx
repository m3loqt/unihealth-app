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
  TextInput,
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
  Bot,
  Cpu,
  Brain,
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
import { consentService } from '@/services/consentService';
// import RealtimeNotificationTest from '@/components/shared/RealtimeNotificationTest';
import { getSafeNotifications, getSafeUnreadCount } from '@/utils/notificationUtils';
import { aiService, ChatMessage } from '@/services/aiService';

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
  // {
  //   image:
  //     'https://images.pexels.com/photos/7622862/pexels-photo-7622862.jpeg?auto=compress&cs=tinysrgb&w=400',
  //   title: 'Eat Mindfully',
  //   description:
  //     'Focus on your food while eating to improve digestion and prevent overeating.',
  // },
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
  
  // Debug logging for UI state
  console.log('🔔 Patient Home - UI State:', {
    notificationsCount: realtimeNotifications.length,
    unreadCount: realtimeUnreadCount,
    notifications: realtimeNotifications.map(n => ({ id: n.id, title: n.title, read: n.read }))
  });
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
  const [showDebugger, setShowDebugger] = useState(false);
  const [showChatbotModal, setShowChatbotModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatbotLoading, setIsChatbotLoading] = useState(false);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [activePrescriptions, setActivePrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrActionLoading, setQrActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);
  
  // Consent system state
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentRequest, setConsentRequest] = useState<any>(null);
  const [consentLoading, setConsentLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

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

  // Consent handling functions
  const handleConsentRequest = async (requestId: string) => {
    try {
      console.log('📋 Processing consent request:', requestId);
      setConsentLoading(true);
      
      // Get the consent request details
      const request = await consentService.getConsentRequest(requestId);
      if (!request) {
        console.error('❌ Consent request not found:', requestId);
        return;
      }
      
      // Check if request is still pending and not expired
      if (request.status !== 'pending') {
        console.log('⚠️ Consent request already processed:', request.status);
        return;
      }
      
      if (consentService.isConsentRequestExpired(request)) {
        console.log('⚠️ Consent request expired');
        Alert.alert(
          'Request Expired',
          'This consent request has expired. Please ask the specialist to scan your QR code again.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Get specialist details dynamically
      const specialistDetails = await consentService.getSpecialistDetailsFromConsentRequest(request);
      
      // Show consent modal with enhanced request data
      setConsentRequest({
        ...request,
        specialistDetails
      });
      setShowConsentModal(true);
      
    } catch (error) {
      console.error('❌ Error handling consent request:', error);
    } finally {
      setConsentLoading(false);
    }
  };

  const handleConsentResponse = async (response: 'approved' | 'denied') => {
    if (!consentRequest) return;
    
    try {
      console.log('📝 Patient consent response:', response);
      setConsentLoading(true);
      
      // Handle the consent response
      await consentService.handleConsentResponse(consentRequest.id, response);
      
      // Close the modal
      setShowConsentModal(false);
      setConsentRequest(null);
      
      // Show confirmation
      Alert.alert(
        response === 'approved' ? 'Access Granted' : 'Access Denied',
        response === 'approved' 
          ? 'You have granted access to your medical records.'
          : 'You have denied access to your medical records.',
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('❌ Error handling consent response:', error);
      Alert.alert(
        'Error',
        'Failed to process your response. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setConsentLoading(false);
    }
  };

  const handleCloseConsentModal = () => {
    setShowConsentModal(false);
    setConsentRequest(null);
    setTimeRemaining(0);
  };

  // Countdown timer for consent requests
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (showConsentModal && consentRequest) {
      const updateTimer = () => {
        const remaining = Math.max(0, consentRequest.expiresAt - Date.now());
        setTimeRemaining(Math.ceil(remaining / 1000));
        
        if (remaining <= 0) {
          setShowConsentModal(false);
          setConsentRequest(null);
          Alert.alert(
            'Request Expired',
            'This consent request has expired. Please ask the specialist to scan your QR code again.',
            [{ text: 'OK' }]
          );
        }
      };
      
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showConsentModal, consentRequest]);

  // Load user data
  useEffect(() => {
    if (user) {
      loadDashboardData();
      
      // Listen for consent requests in real-time
      const listenForConsentRequests = () => {
        console.log('🔍 Setting up consent request listener for patient:', user.uid);
        
        // Set up Firebase real-time listener for consent requests
        const unsubscribe = databaseService.listenToConsentRequests(user.uid, (requests) => {
          console.log('📋 Received consent requests:', requests.length);
          
          // Find pending requests for this patient
          const pendingRequests = requests.filter(req => 
            req.patientId === user.uid && 
            req.status === 'pending' &&
            !consentService.isConsentRequestExpired(req)
          );
          
          if (pendingRequests.length > 0) {
            console.log('🔔 New consent request found:', pendingRequests[0].id);
            // Handle the first pending request
            handleConsentRequest(pendingRequests[0].id);
          }
        });
        
        return unsubscribe;
      };
      
      const unsubscribe = listenForConsentRequests();
      
      return () => {
        if (unsubscribe) {
          console.log('🔇 Unsubscribing from consent request listener');
          unsubscribe();
        }
      };
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
  
  // Chatbot functions
  const handleOpenChatbot = () => {
    setShowChatbotModal(true);
    // Add welcome message if no messages exist
    if (chatMessages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        text: 'Hello! I\'m your health assistant. I can help answer general health questions and provide wellness tips. Remember to always consult with your healthcare provider for medical advice.',
        isUser: false,
        timestamp: new Date(),
      };
      setChatMessages([welcomeMessage]);
    }
  };

  const handleCloseChatbot = () => {
    setShowChatbotModal(false);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatbotLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: chatInput.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatbotLoading(true);

    try {
      const response = await aiService.sendMessage(userMessage.text);
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: response.text,
        isUser: false,
        timestamp: new Date(),
      };

      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: 'I apologize, but I\'m having trouble processing your request right now. Please try again later.',
        isUser: false,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatbotLoading(false);
    }
  };
  
  



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
             {/* AI Chat Button */}
             <View style={styles.chatbotButtonContainer}>
               <TouchableOpacity 
                 style={styles.iconButton}
                 onPress={handleOpenChatbot}
               >
                 <Bot size={24} color="#6B7280" />
               </TouchableOpacity>
               <View style={styles.newBadge}>
                 <Text style={styles.newBadgeText}>NEW</Text>
               </View>
             </View>
             
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
             
             {/* Debug Button */}
             {/* <TouchableOpacity 
               style={[styles.iconButton, { backgroundColor: '#FF6B6B', marginLeft: 8, minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' }]}
               onPress={() => {
                 console.log('🔔 Debug button pressed!');
                 setShowDebugger(true);
               }}
               activeOpacity={0.7}
             >
               <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>🐛</Text>
             </TouchableOpacity> */}
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
                  <Image 
                    source={{ uri: tip.image }} 
                    style={styles.tipCarouselImage}
                  />
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
                  onPress={() => {
                    if (appt.type === 'specialist_referral') {
                      // For specialist referrals, navigate to referral details
                      console.log('🔍 Navigating to referral details for specialist referral:', appt.id);
                      router.push(`/(patient)/referral-details?id=${appt.id}`);
                    } else {
                      // For regular appointments, navigate to visit overview
                      console.log('🔍 Navigating to visit overview for regular appointment:', appt.id);
                      router.push(`/visit-overview?id=${appt.id}`);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  {/* Decorative corner accent */}
                  <View style={styles.cornerAccent} />
                  
                  {/* Gradient overlay */}
                  <View style={styles.gradientOverlay} />
                  
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
                    <Text 
                      style={styles.appointmentPurpose}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {appt.appointmentPurpose || 'Consultation'}
                    </Text>
                  </View>
                  <View style={styles.appointmentFooter}>
                    <View style={styles.appointmentTimeInfo}>
                      <View style={styles.appointmentTimePill}>
                        <Calendar size={10} color="#FFFFFF" />
                        <Text style={styles.appointmentDate}>
                          {appt.appointmentDate ? (() => {
                            try {
                              // Parse the date string as local date to avoid timezone issues
                              const [year, month, day] = appt.appointmentDate.split('-').map(Number);
                              const date = new Date(year, month - 1, day); // month is 0-indexed
                              return date.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              });
                            } catch (error) {
                              return 'Invalid date';
                            }
                          })() : 'Date not specified'}
                        </Text>
                      </View>
                      <View style={styles.appointmentTimePill}>
                        <Clock size={10} color="#FFFFFF" />
                        <Text style={styles.appointmentDate}>
                          {(() => {
                            const timeString = appt.appointmentTime;
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

      {/* === CONSENT REQUEST MODAL === */}
      <Modal
        visible={showConsentModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseConsentModal}
      >
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <Pressable style={qrModalStyles.backdrop} onPress={handleCloseConsentModal}>
          <BlurView intensity={22} style={qrModalStyles.blurView}>
            <View style={qrModalStyles.overlay} />
          </BlurView>
        </Pressable>
        <View style={qrModalStyles.modalContainer}>
          <SafeAreaView style={qrModalStyles.safeArea}>
            <View style={qrModalStyles.modalContent}>
              <View style={qrModalStyles.header}>
                <View style={qrModalStyles.headerLeft}>
                  <Text style={qrModalStyles.headerTitle}>Medical Data Access Request</Text>
                  <Text style={qrModalStyles.headerSubtitle}>A healthcare provider is requesting access</Text>
                </View>
                <TouchableOpacity style={qrModalStyles.closeButton} onPress={handleCloseConsentModal}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <View style={qrModalStyles.divider} />
              
              {consentRequest && (
                <View style={qrModalStyles.permissionContainer}>
                  <View style={qrModalStyles.specialistInfo}>
                    <Text style={qrModalStyles.permissionTitle}>
                      Dr. {consentRequest.specialistDetails?.name || 'Unknown Specialist'}
                    </Text>
                    <Text style={qrModalStyles.permissionText}>
                      is requesting access to your medical records for consultation purposes.
                    </Text>
                  </View>
                  
                  <View style={qrModalStyles.accessDetails}>
                    <Text style={qrModalStyles.detailsTitle}>What they can access:</Text>
                    <Text style={qrModalStyles.detailsText}>
                      • Medical history and conditions{'\n'}
                      • Current medications and prescriptions{'\n'}
                      • Allergies and emergency contacts{'\n'}
                      • Previous consultation notes
                    </Text>
                  </View>
                  
                  <View style={qrModalStyles.actions}>
                    <TouchableOpacity
                      style={[qrModalStyles.secondaryButton, { backgroundColor: '#EF4444' }]}
                      onPress={() => handleConsentResponse('denied')}
                      disabled={consentLoading}
                    >
                      <Text style={[qrModalStyles.secondaryButtonText, { color: '#FFFFFF' }]}>
                        {consentLoading ? 'Processing...' : 'Deny Access'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[qrModalStyles.primaryButton, { backgroundColor: '#10B981' }]}
                      onPress={() => handleConsentResponse('approved')}
                      disabled={consentLoading}
                    >
                      <Text style={[qrModalStyles.primaryButtonText, { color: '#FFFFFF' }]}>
                        {consentLoading ? 'Processing...' : 'Allow Access'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={[qrModalStyles.permissionText, { marginTop: 16, fontSize: 12, color: '#6B7280' }]}>
                    This request will expire in {timeRemaining} seconds. You can revoke access at any time.
                  </Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
                  
      {/* === CHATBOT MODAL === */}
      <Modal
        visible={showChatbotModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseChatbot}
      >
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <Pressable style={chatbotModalStyles.backdrop} onPress={handleCloseChatbot}>
          <BlurView intensity={22} style={chatbotModalStyles.blurView}>
            <View style={chatbotModalStyles.overlay} />
          </BlurView>
        </Pressable>
        <View style={chatbotModalStyles.modalContainer}>
          <SafeAreaView style={chatbotModalStyles.safeArea}>
            <View style={chatbotModalStyles.modalContent}>
              {/* Header */}
              <View style={chatbotModalStyles.header}>
                <View style={chatbotModalStyles.headerLeft}>
                  <View style={chatbotModalStyles.botAvatar}>
                    <Bot size={20} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={chatbotModalStyles.headerTitle}>Health Assistant</Text>
                    <Text style={chatbotModalStyles.headerSubtitle}>Ask me anything about health</Text>
                  </View>
                </View>
                <TouchableOpacity style={chatbotModalStyles.closeButton} onPress={handleCloseChatbot}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              {/* Divider */}
              <View style={chatbotModalStyles.divider} />
              
              {/* Messages */}
              <ScrollView 
                style={chatbotModalStyles.messagesContainer}
                contentContainerStyle={chatbotModalStyles.messagesContent}
                showsVerticalScrollIndicator={false}
              >
                {chatMessages.map((message) => (
                  <View
                    key={message.id}
                    style={[
                      chatbotModalStyles.messageContainer,
                      message.isUser ? chatbotModalStyles.userMessage : chatbotModalStyles.botMessage
                    ]}
                  >
                    <View
                      style={[
                        chatbotModalStyles.messageBubble,
                        message.isUser ? chatbotModalStyles.userBubble : chatbotModalStyles.botBubble
                      ]}
                    >
                      <Text
                        style={[
                          chatbotModalStyles.messageText,
                          message.isUser ? chatbotModalStyles.userText : chatbotModalStyles.botText
                        ]}
                      >
                        {message.text}
                      </Text>
                    </View>
                    <Text style={chatbotModalStyles.messageTime}>
                      {message.timestamp.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>
                ))}
                {isChatbotLoading && (
                  <View style={[chatbotModalStyles.messageContainer, chatbotModalStyles.botMessage]}>
                    <View style={[chatbotModalStyles.messageBubble, chatbotModalStyles.botBubble]}>
                      <View style={chatbotModalStyles.typingIndicator}>
                        <View style={chatbotModalStyles.typingDot} />
                        <View style={chatbotModalStyles.typingDot} />
                        <View style={chatbotModalStyles.typingDot} />
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>
              
              {/* Input */}
              <View style={chatbotModalStyles.inputContainer}>
                <View style={chatbotModalStyles.inputWrapper}>
                  <TextInput
                    style={chatbotModalStyles.textInput}
                    placeholder="Ask a health question..."
                    placeholderTextColor="#9CA3AF"
                    value={chatInput}
                    onChangeText={setChatInput}
                    multiline
                    maxLength={500}
                    editable={!isChatbotLoading}
                  />
                  <TouchableOpacity
                    style={[
                      chatbotModalStyles.sendButton,
                      (!chatInput.trim() || isChatbotLoading) && chatbotModalStyles.sendButtonDisabled
                    ]}
                    onPress={handleSendMessage}
                    disabled={!chatInput.trim() || isChatbotLoading}
                  >
                    <Bot size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>


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
          console.log('🔔 Floating debug button pressed!');
          setShowDebugger(true);
        }}
        activeOpacity={0.8}
      >
        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>🐛</Text>
      </TouchableOpacity> */}

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
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { padding: 8 },
  chatbotButtonContainer: {
    position: 'relative',
  },
  newBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },
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
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E40AF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 20,
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 60,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 30,
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
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  doctorInitial: { 
    color: '#1E40AF', 
    fontSize: 14 
  },
  appointmentDetails: { flex: 1 },
  doctorName: { 
    fontSize: 16, 
    color: '#FFFFFF' 
  },
  doctorSpecialty: { 
    fontSize: 14, 
    color: '#E5E7EB', 
    marginTop: 2 
  },
  appointmentPurpose: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'right',
    maxWidth: 120,
    lineHeight: 16,
  },
   appointmentTimePill: {
     flexDirection: 'row',
     alignItems: 'center',
     paddingHorizontal: 8,
     paddingVertical: 4,
     borderRadius: 12,
     backgroundColor: 'rgba(255, 255, 255, 0.2)',
     borderWidth: 1,
     borderColor: 'rgba(255, 255, 255, 0.3)',
     gap: 4,
   },
   appointmentDate: { 
     fontSize: 12, 
     color: '#FFFFFF',
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
  joinButton: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  joinButtonText: { 
    color: '#1E40AF', 
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
    backgroundColor: '#F3F4F6',
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
  
  // Consent modal specific styles
  specialistInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  accessDetails: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 8,
  },
  detailsText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
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

// Chatbot Modal Styles
const chatbotModalStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
  },
  blurView: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.34)' },
  modalContainer: {
    flex: 1, justifyContent: 'flex-end', zIndex: 2,
  },
  safeArea: { width: '100%' },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    minHeight: SCREEN_HEIGHT * 0.7,
    maxHeight: SCREEN_HEIGHT * 0.9,
  },
  header: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  botAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18, 
    fontFamily: 'Inter-Bold', 
    color: '#1F2937', 
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13, 
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
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  messagesContainer: {
    flex: 1,
    marginBottom: 16,
  },
  messagesContent: {
    paddingVertical: 8,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  botMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#1E40AF',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  userText: {
    color: '#FFFFFF',
  },
  botText: {
    color: '#1F2937',
  },
  messageTime: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 4,
    marginHorizontal: 16,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
  inputContainer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
});
