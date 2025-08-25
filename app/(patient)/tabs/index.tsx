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
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing'; // Added for more robust sharing

import { useAuth } from '@/hooks/auth/useAuth';
import { useNotifications } from '@/hooks/data/useNotifications';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_GAP = 16;
const HORIZONTAL_MARGIN = 24;
const CARD_WIDTH = SCREEN_WIDTH - 2 * HORIZONTAL_MARGIN - CARD_GAP;

const healthTips = [
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
];

export default function HomeScreen() {
  const { user } = useAuth();
  const { 
    notifications, 
    loading: notificationsLoading, 
    error: notificationsError,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: refreshNotifications
  } = useNotifications();
  const [activeTip, setActiveTip] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
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

  // Load user data
  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

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
        appt.status === 'confirmed' || appt.status === 'pending'
      ).slice(0, 3);
      setUpcomingAppointments(upcoming);
      setAppointmentsLoading(false);
      
      // Load prescriptions with validation
      setPrescriptionsLoading(true);
      const prescriptions = await databaseService.getPrescriptions(user.uid);
      const validPrescriptions = dataValidation.validateArray(prescriptions, dataValidation.isValidPrescription);
      const active = validPrescriptions.filter(prescription =>
        prescription.status === 'active'
      ).slice(0, 3);
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
      appt.status === 'confirmed' || appt.status === 'pending'
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
    setActiveTip(page);
  }, []);

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
  const handleOpenNotifications = () => setShowNotificationModal(true);
  const handleCloseNotificationModal = () => setShowNotificationModal(false);
  
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
              onPress={handleOpenNotifications}
            >
              <Bell size={24} color="#6B7280" />
              {notifications.filter(n => !n.read).length > 0 && (
                <View style={styles.notifDot}>
                  <Text style={styles.notifDotText}>
                    {notifications.filter(n => !n.read).length > 9 ? '9+' : notifications.filter(n => !n.read).length.toString()}
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
              scrollEventThrottle={16}
              snapToInterval={CARD_WIDTH + CARD_GAP}
              decelerationRate="fast"
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
                    <Text style={styles.tipCarouselTitle}>{tip.title}</Text>
                    <Text style={styles.tipCarouselDesc}>{tip.description}</Text>
                  </View>
                  <View style={styles.tipInfoCircle}>
                    <Info size={18} color="#FFFFFF" />
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

        {/* Upcoming Appointments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
            <TouchableOpacity onPress={() => router.push('/(patient)/tabs/appointments?filter=confirmed')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.appointmentsContainer}>
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
                <TouchableOpacity key={appt.id} style={styles.appointmentCard}>
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
                          const doctorName = safeDataAccess.getAppointmentDoctorName(appt, 'General');
                          return doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`;
                        })()}
                      </Text>
                      <Text style={styles.doctorSpecialty}>{appt.specialty || 'General Medicine'}</Text>
                    </View>
                    <View style={styles.appointmentTime}>
                      <Clock size={16} color="#6B7280" />
                      <Text style={styles.appointmentDate}>
                        {appt.appointmentDate ? new Date(appt.appointmentDate).toLocaleDateString() : 'Date not specified'}
                      </Text>
                    </View>
                  </View>
                                     <View style={styles.appointmentFooter}>
                     <Text style={styles.appointmentType}>{appt.appointmentPurpose || 'Consultation'}</Text>
                     <TouchableOpacity 
                       style={styles.joinButton}
                       onPress={() => router.push(`/visit-overview?id=${appt.id}`)}
                     >
                       <Text style={styles.joinButtonText}>View details</Text>
                     </TouchableOpacity>
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
                      <Text style={styles.medicationName}>{prescription.medication || 'Unknown Medication'}</Text>
                      <Text style={styles.medicationDosage}>
                        {prescription.dosage || 'N/A'} • {formatFrequency(prescription.frequency, 'patient')}
                        {prescription.route && ` • ${formatRoute(prescription.route, 'patient')}`}
                        {prescription.formula && ` • ${formatFormula(prescription.formula, 'patient')}`}
                        {prescription.take && ` • Take: ${prescription.take}`}
                        {prescription.totalQuantity && ` • Total: ${prescription.totalQuantity}`}
                      </Text>
                      <Text style={styles.prescriptionDescription}>
                        {prescription.instructions || 'No additional instructions'}
                      </Text>
                    </View>
                    <View style={styles.prescriptionStatus}>
                      <Text style={styles.remainingDays}>-</Text>
                      <Text style={styles.remainingLabel}>Ongoing</Text>
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
                  <Text style={qrModalStyles.patientId}>ID: {user?.uid || 'ID not available'}</Text>
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

      {/* === NOTIFICATION MODAL === */}
      <Modal
        visible={showNotificationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseNotificationModal}
      >
        <View style={notificationModalStyles.modalBackdrop}>
          <View style={notificationModalStyles.modalContainer}>
            <View style={notificationModalStyles.modalContent}>
              <View style={notificationModalStyles.modalHeader}>
                <Bell size={32} color="#1E40AF" />
                <Text style={notificationModalStyles.modalTitle}>Notifications</Text>
                <Text style={notificationModalStyles.modalSubtext}>
                  {notifications.filter(n => !n.read).length} unread notification{notifications.filter(n => !n.read).length !== 1 ? 's' : ''}
                </Text>
              </View>
              
              {/* Action Buttons */}
              <View style={[notificationModalStyles.modalActions, { marginBottom: 12 }]}>
                <TouchableOpacity
                  style={notificationModalStyles.modalActionButton}
                  onPress={refreshNotifications}
                >
                  <RefreshCw size={20} color="#1E40AF" />
                  <Text style={notificationModalStyles.modalActionButtonText}>Refresh</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={notificationModalStyles.modalActionButton}
                  onPress={handleMarkAllAsRead}
                >
                  <Check size={20} color="#1E40AF" />
                  <Text style={notificationModalStyles.modalActionButtonText}>Mark All Read</Text>
                </TouchableOpacity>
              </View>

                {notifications.length === 0 ? (
                <Text style={[notificationModalStyles.emptyNotificationText, { marginBottom: 12, marginTop: 12 }]}>No notifications yet</Text>
              ) : (
                <ScrollView
                  style={notificationModalStyles.notificationScroll}
                  contentContainerStyle={notificationModalStyles.notificationListContent}
                  showsVerticalScrollIndicator
                >
                  {notifications.map((notification) => (
                    <View key={notification.id} style={[notificationModalStyles.notificationItem, !notification.read && notificationModalStyles.unreadNotification]}>
                      <View style={notificationModalStyles.notificationContent}>
                        <Text style={[notificationModalStyles.notificationText, !notification.read && notificationModalStyles.unreadText]}>
                          {notification.message}
                        </Text>
                        <Text style={notificationModalStyles.notificationTime}>
                          {new Date(notification.timestamp).toLocaleString()}
                        </Text>
                      </View>
                      <View style={notificationModalStyles.notificationActions}>
                        {!notification.read && (
                          <TouchableOpacity
                            style={notificationModalStyles.notificationActionButton}
                            onPress={() => handleMarkAsRead(notification.id)}
                          >
                            <Check size={16} color="#1E40AF" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={notificationModalStyles.notificationActionButton}
                          onPress={() => handleDeleteNotification(notification.id)}
                        >
                          <Trash2 size={16} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
                )}

              <View style={notificationModalStyles.modalActions}>
                <TouchableOpacity
                  style={notificationModalStyles.modalSecondaryButton}
                  onPress={handleCloseNotificationModal}
                >
                  <Text style={notificationModalStyles.modalSecondaryButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
  tipCarouselTitle: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#FFF',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  tipCarouselDesc: {
    fontSize: 14,
    color: '#F1F5F9',
    lineHeight: 19,
    fontFamily: 'Inter-Regular',
    textShadowColor: 'rgba(0,0,0,0.17)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  tipInfoCircle: {
    position: 'absolute',
    left: 20,
    top: 20,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.44)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
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
  appointmentsContainer: { gap: 12 },
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
  appointmentTime: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4 
  },
  appointmentDate: { 
    fontSize: 12, 
    color: '#6B7280' 
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
    alignItems: 'center' 
  },
  medicationIcon: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12 
  },
  prescriptionDetails: { flex: 1 },
  medicationName: { 
    fontSize: 16, 
    color: '#1F2937' 
  },
  medicationDosage: { 
    fontSize: 14, 
    color: '#6B7280', 
    marginTop: 2 
  },
  prescriptionDescription: { 
    fontSize: 14, 
    color: '#6B7280', 
    marginTop: 4 
  },
  prescriptionStatus: { 
    alignItems: 'flex-end' 
  },
  remainingDays: { 
    fontSize: 14, 
    color: '#1F2937' 
  },
  remainingLabel: { 
    fontSize: 12, 
    color: '#6B7280' 
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

// Notification Modal Styles
const notificationModalStyles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContainer: {
    width: '100%',
    maxWidth: '100%',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    alignItems: 'center',
    paddingBottom: 24,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtext: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalActionButtonText: {
    color: '#1E40AF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    marginLeft: 8,
  },
  modalSecondaryButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalSecondaryButtonText: {
    color: '#374151',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  notificationScroll: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.55,
    marginBottom: 16,
  },
  notificationListContent: {
    paddingBottom: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#F3F4F6',
  },
  unreadNotification: {
    backgroundColor: '#E0F2FE',
    borderColor: '#1E40AF',
    borderWidth: 1,
  },
  notificationContent: {
    flex: 1,
    marginRight: 10,
    maxWidth: '85%',
  },
  notificationText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
  },
  unreadText: {
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  notificationTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 4,
  },
  notificationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  notificationActionButton: {
    padding: 4,
  },
  emptyNotificationText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
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
