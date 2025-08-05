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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  QrCode,
  FileText,
  Calendar,
  Clock,
  Bell,
  Pill,
  Info,
  Download,
  Share,
  X,
  User,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useAuth } from '@/src/hooks/auth/useAuth';
import { databaseService } from '@/src/services/database/firebase';
import { Appointment, Prescription } from '@/src/services/database/firebase';
import { getGreeting } from '@/src/utils/greeting';
import { getFirstName } from '@/src/utils/string';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_GAP = 16;
const HORIZONTAL_MARGIN = 24;
const CARD_WIDTH = SCREEN_WIDTH - 2 * HORIZONTAL_MARGIN - CARD_GAP;

// Health Tips data (unchanged)
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
  const [activeTip, setActiveTip] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [activePrescriptions, setActivePrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

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
      
      // Load appointments
      const appointments = await databaseService.getAppointments(user.uid, user.role);
      const upcoming = appointments.filter(appt => 
        appt.status === 'confirmed' || appt.status === 'pending'
      ).slice(0, 3); // Show only first 3
      setUpcomingAppointments(upcoming);
      
      // Load prescriptions
      const prescriptions = await databaseService.getPrescriptions(user.uid);
      const active = prescriptions.filter(prescription => 
        prescription.status === 'active'
      ).slice(0, 3); // Show only first 3
      setActivePrescriptions(active);
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const page = Math.round(x / (CARD_WIDTH + CARD_GAP));
    setActiveTip(page);
  };

  // QR Modal Actions
  const handleCloseQRModal = () => setShowQRModal(false);
  const handleDownload = () => {};
  const handleShare = () => {};

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
        You don't have any active prescriptions at the moment.
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
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 90 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.name ? getFirstName(user.name) : ''}</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton}>
              <Bell size={24} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(patient)/tabs/profile')}>
              <Image
                source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }}
                style={styles.profileImage}
              />
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
            <TouchableOpacity style={styles.quickActionButton} onPress={() => setShowQRModal(true)}>
              <QrCode size={24} color="#1E40AF" />
              <Text style={styles.quickActionText}>Generate {'\n'} QR Code</Text>
            </TouchableOpacity>
            <TouchableOpacity
  style={styles.quickActionButton}
  onPress={() => router.push('/(patient)/tabs/appointments?filter=completed')}
>
  <FileText size={24} color="#1E40AF" />
  <Text style={styles.quickActionText}>View Medical {'\n'} History</Text>
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
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading appointments...</Text>
              </View>
            ) : upcomingAppointments.length === 0 ? (
              renderAppointmentPlaceholder()
            ) : (
              upcomingAppointments.map((appt) => (
                <TouchableOpacity key={appt.id} style={styles.appointmentCard}>
                  <View style={styles.appointmentHeader}>
                    <View style={styles.doctorAvatar}>
                      <Text style={styles.doctorInitial}>
                        {appt.doctorFirstName && appt.doctorLastName 
                          ? `${appt.doctorFirstName[0]}${appt.doctorLastName[0]}`
                          : 'DR'
                        }
                      </Text>
                    </View>
                    <View style={styles.appointmentDetails}>
                      <Text style={styles.doctorName}>
                        {appt.doctorFirstName && appt.doctorLastName 
                          ? `Dr. ${appt.doctorFirstName} ${appt.doctorLastName}`
                          : appt.doctorId || 'Doctor'
                        }
                      </Text>
                      <Text style={styles.doctorSpecialty}>{appt.specialty || 'General'}</Text>
                    </View>
                    <View style={styles.appointmentTime}>
                      <Clock size={16} color="#6B7280" />
                      <Text style={styles.appointmentDate}>
                        {appt.appointmentDate ? new Date(appt.appointmentDate).toLocaleDateString() : 'Date TBD'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.appointmentFooter}>
                    <Text style={styles.appointmentType}>{appt.type || 'Consultation'}</Text>
                    <TouchableOpacity style={styles.joinButton}>
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
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading prescriptions...</Text>
              </View>
            ) : activePrescriptions.length === 0 ? (
              renderPrescriptionPlaceholder()
            ) : (
              activePrescriptions.map((prescription) => (
                <View key={prescription.id} style={styles.prescriptionCard}>
                  <View style={styles.prescriptionHeader}>
                    <View style={[styles.medicationIcon, { backgroundColor: '#1E3A8A15' }]}>
                      <Pill size={20} color="#1E3A8A" />
                    </View>
                    <View style={styles.prescriptionDetails}>
                      <Text style={styles.medicationName}>{prescription.medication}</Text>
                      <Text style={styles.medicationDosage}>
                        {prescription.dosage} • {prescription.frequency}
                      </Text>
                      <Text style={styles.prescriptionDescription}>
                        {prescription.instructions || 'No additional instructions'}
                      </Text>
                    </View>
                    <View style={styles.prescriptionStatus}>
                      <Text style={styles.remainingDays}>{prescription.remainingRefills || 0}</Text>
                      <Text style={styles.remainingLabel}>refills left</Text>
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
                <View style={qrModalStyles.qrCodeWrapper}>
                  <QRCode
                    value={user?.uid || 'user-id'}
                    size={180}
                    color="#1F2937"
                    backgroundColor="#FFFFFF"
                  />
                </View>
                <View style={qrModalStyles.patientInfo}>
                  <Text style={qrModalStyles.patientName}>
                    {user?.name || 'User'}
                  </Text>
                  <Text style={qrModalStyles.patientId}>ID: {user?.uid || 'N/A'}</Text>
                  <Text style={qrModalStyles.patientEmail}>{user?.email || 'N/A'}</Text>
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
                <TouchableOpacity style={qrModalStyles.secondaryButton} onPress={handleDownload}>
                  <Download size={20} color="#374151" />
                  <Text style={qrModalStyles.secondaryButtonText}>Download</Text>
                </TouchableOpacity>
                <TouchableOpacity style={qrModalStyles.primaryButton} onPress={handleShare}>
                  <Share size={20} color="#FFFFFF" />
                  <Text style={qrModalStyles.primaryButtonText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollView: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
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
  quickActionsContainer: { padding: 24, backgroundColor: '#FFFFFF', marginTop: 8 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between' },
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
  quickActionText: { fontSize: 12, color: '#374151', marginTop: 8, textAlign: 'center' },
  appointmentsContainer: { gap: 12 },
  appointmentCard: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  appointmentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  doctorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  doctorInitial: { color: '#FFFFFF', fontSize: 14 },
  appointmentDetails: { flex: 1 },
  doctorName: { fontSize: 16, color: '#1F2937' },
  doctorSpecialty: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  appointmentTime: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  appointmentDate: { fontSize: 12, color: '#6B7280' },
  appointmentFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appointmentType: { fontSize: 14, color: '#374151' },
  joinButton: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#1E40AF', borderRadius: 8 },
  joinButtonText: { color: '#FFFFFF', fontSize: 14 },
  prescriptionsContainer: { gap: 12 },
  prescriptionCard: { padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  prescriptionHeader: { flexDirection: 'row', alignItems: 'center' },
  medicationIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  prescriptionDetails: { flex: 1 },
  medicationName: { fontSize: 16, color: '#1F2937' },
  medicationDosage: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  prescriptionDescription: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  prescriptionStatus: { alignItems: 'flex-end' },
  remainingDays: { fontSize: 14, color: '#1F2937' },
  remainingLabel: { fontSize: 12, color: '#6B7280' },
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
});
 