import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  CircleCheck as CheckCircle,
  Hourglass,
  Circle as XCircle,
  Check,
  User,
  X,
  Star,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/src/hooks/auth/useAuth';
import { databaseService, Appointment } from '@/src/services/database/firebase';

export default function AppointmentsScreen() {
  const { filter } = useLocalSearchParams();
  const { user } = useAuth();
  const filters = ['All', 'Pending', 'Confirmed', 'Completed', 'Canceled'];
  const [activeFilter, setActiveFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [modalAppointment, setModalAppointment] = useState<Appointment | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Feedback modal state ---
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackAppointment, setFeedbackAppointment] = useState<Appointment | null>(null);
  const [feedbackStars, setFeedbackStars] = useState(0);
  const [feedbackReason, setFeedbackReason] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  useEffect(() => {
    if (filter && filters.includes(capitalize(filter as string))) {
      setActiveFilter(capitalize(filter as string));
    }
  }, [filter]);

  // Load appointments from database
  useEffect(() => {
    if (user && user.uid) {
      loadAppointments();
    }
  }, [user]);

  // Refresh appointments when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user && user.uid) {
        loadAppointments();
      }
    }, [user])
  );

  const loadAppointments = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const userAppointments = await databaseService.getAppointments(user.uid, user.role);
      console.log('Loaded appointments:', userAppointments.length);
      console.log('Appointments:', userAppointments);
      setAppointments(userAppointments);
    } catch (error) {
      console.error('Error loading appointments:', error);
      Alert.alert('Error', 'Failed to load appointments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  function capitalize(str: string) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  // Filter appointments based on active filter
  const getFilteredAppointments = () => {
    if (activeFilter === 'All') {
      return appointments;
    }
    
    const filterStatus = activeFilter.toLowerCase();
    return appointments.filter(appointment => 
      appointment.status.toLowerCase() === filterStatus
    );
  };


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle size={14} color="#6B7280" />;
      case 'pending':
        return <Hourglass size={14} color="#6B7280" />;
      case 'completed':
        return <Check size={14} color="#6B7280" />;
      case 'canceled':
        return <XCircle size={14} color="#6B7280" />;
      default:
        return null;
    }
  };

  // === Appointment Card ===
  const renderAppointmentCard = (appointment: Appointment) => {
    const isCompleted = appointment.status === 'completed';
    
    // Format date for display
    const formatDisplayDate = (dateString: string) => {
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      } catch (error) {
        return 'Invalid date';
      }
    };

    // Format time for display
    const formatDisplayTime = (timeString: string) => {
      try {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
      } catch (error) {
        return 'Invalid time';
      }
    };

    return (
      <View key={appointment.id} style={styles.appointmentCard}>
        <View style={styles.appointmentHeader}>
          <View style={styles.doctorInfo}>
            <View style={styles.doctorAvatar}>
              <Text style={styles.doctorInitial}>
                {(appointment.doctorFirstName || 'D').charAt(0) + (appointment.doctorLastName || 'octor').charAt(0)}
              </Text>
            </View>
            <View style={styles.doctorDetails}>
              <Text style={styles.doctorName}>
                {appointment.doctorFirstName && appointment.doctorLastName
                  ? `${appointment.doctorFirstName} ${appointment.doctorLastName}`
                  : 'Doctor not specified'
                }
              </Text>
              <Text style={styles.doctorSpecialty}>
                {appointment.specialty || 'General Practice'}
              </Text>
            </View>
          </View>
          <View style={styles.statusBadge}>
            {getStatusIcon(appointment.status)}
            <Text style={styles.statusText}>{capitalize(appointment.status)}</Text>
          </View>
        </View>

        <View style={styles.subtleDivider} />

        <View style={styles.appointmentDetails}>
          <View style={styles.keyValueRow}>
            <Text style={styles.label}>Clinic:</Text>
            <Text style={styles.value}>
              {appointment.clinicName || 'Clinic not specified'}
            </Text>
          </View>
          <View style={styles.keyValueRow}>
            <Text style={styles.label}>Date:</Text>
            <Text style={styles.value}>{formatDisplayDate(appointment.appointmentDate)}</Text>
          </View>
          <View style={styles.keyValueRow}>
            <Text style={styles.label}>Time:</Text>
            <Text style={styles.value}>{formatDisplayTime(appointment.appointmentTime)}</Text>
          </View>
          {appointment.notes && (
            <View style={styles.keyValueRow}>
              <Text style={styles.label}>Notes:</Text>
              <Text style={styles.value}>{appointment.notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.appointmentActions}>
          {isCompleted ? (
            <>
              <TouchableOpacity
                style={styles.outlinedButton}
                onPress={() => {
                  setFeedbackAppointment(appointment);
                  setFeedbackStars(0);
                  setFeedbackReason('');
                  setFeedbackSubmitted(false);
                  setShowFeedbackModal(true);
                }}
              >
                <Text style={styles.outlinedButtonText}>Give Feedback</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push({
                  pathname: '/visit-overview',
                  params: { id: appointment.id }
                })}
              >
                <Text style={styles.secondaryButtonText}>View Details</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setModalAppointment(appointment);
                setShowModal(true);
              }}
            >
              <Text style={styles.secondaryButtonText}>View Details</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const filteredAppointments = getFilteredAppointments();

  // === Appointment Details Modal (Improved UI) ===
  const renderAppointmentModal = () => {
    if (!modalAppointment) return null;
    const a = modalAppointment;

    // Utility to render label-value row
    const Row = ({ label, value, isLast }: { label: string; value: string; isLast: boolean }) => (
      <View style={[
        styles2.row,
        !isLast && styles2.rowDivider
      ]}>
        <Text style={styles2.rowLabel}>{label}</Text>
        <Text style={styles2.rowValue} numberOfLines={2}>{value}</Text>
      </View>
    );

    // Modal data using correct Appointment properties
    const fields = [
      { label: "Clinic Name", value: a.clinicName || 'Not specified' },
      { label: "Doctor", value: `${a.doctorFirstName || ''} ${a.doctorLastName || ''}`.trim() || 'Not specified' },
      { label: "Specialty", value: a.specialty || 'General Practice' },
      { label: "Date", value: a.appointmentDate || 'Not specified' },
      { label: "Time", value: a.appointmentTime || 'Not specified' },
      { label: "Purpose", value: a.patientComplaint?.join(', ') || 'Not specified' },
      ...(a.notes ? [{ label: "Additional Notes", value: a.notes }] : []),
      { label: "Status", value: capitalize(a.status) },
    ];

    return (
      <Modal
        visible={showModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles2.backdrop}>
          <View style={styles2.card}>
            {/* Modal Header */}
            <View style={styles2.header}>
              <Text style={styles2.title}>Appointment Details</Text>
              <TouchableOpacity
                style={styles2.closeBtn}
                onPress={() => setShowModal(false)}
                hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
              >
                <Text style={styles2.closeX}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles2.contentWrap}>
              {fields.map((f, i) => (
                <Row
                  key={i}
                  label={f.label}
                  value={f.value}
                  isLast={i === fields.length - 1}
                />
              ))}
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // === Feedback Modal ===
  const renderFeedbackModal = () => {
    if (!feedbackAppointment) return null;

    return (
      <Modal
        visible={showFeedbackModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Give Feedback</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowFeedbackModal(false)}
              >
                <X size={20} color="#1E40AF" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalDivider} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 14 }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalSection}>
                <Text style={[styles.modalSectionLabel, { marginBottom: 10 }]}>
                  How would you rate your visit?
                </Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity
                      key={n}
                      onPress={() => setFeedbackStars(n)}
                      activeOpacity={0.7}
                    >
                      <Star
                        size={40}
                        color={n <= feedbackStars ? '#F59E42' : '#E5E7EB'}
                        fill={n <= feedbackStars ? '#F59E42' : 'none'}
                        strokeWidth={2}
                        style={styles.starIcon}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>
                  Tell us a bit more (optional)
                </Text>
                <TextInput
                  style={styles.feedbackInput}
                  placeholder="Share your experience..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  value={feedbackReason}
                  onChangeText={setFeedbackReason}
                  maxLength={500}
                  textAlignVertical="top"
                  returnKeyType="done"
                />
              </View>
              {feedbackSubmitted ? (
                <View style={{ alignItems: 'center', marginTop: 16 }}>
                  <Text style={{ fontSize: 16, color: '#1E40AF', fontWeight: '600' }}>
                    Thank you for your feedback!
                  </Text>
                </View>
              ) : (
               <View style={styles.feedbackModalButtonContainer}>
  <TouchableOpacity
    style={[
      styles.feedbackModalButton,
      (!feedbackStars || feedbackSubmitted) && { opacity: 0.5 },
    ]}
    disabled={!feedbackStars || feedbackSubmitted}
    onPress={() => {
      setFeedbackSubmitted(true);
      setTimeout(() => {
        setShowFeedbackModal(false);
        setFeedbackSubmitted(false);
        setFeedbackStars(0);
        setFeedbackReason('');
        setFeedbackAppointment(null);
      }, 1200);
    }}
  >
    <Text style={styles.feedbackModalButtonText}>Submit Feedback</Text>
  </TouchableOpacity>
</View>

              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }; 

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Appointments</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.addButton}>
            <Plus size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/profile')}
          >
            <User size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterButton, activeFilter === filter && styles.activeFilterButton]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.filterText, activeFilter === filter && styles.activeFilterText]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadAppointments}
            colors={['#1E40AF']}
            tintColor="#1E40AF"
          />
        }
      >
        <View style={styles.appointmentsList}>
          {filteredAppointments.length > 0 ? (
            filteredAppointments.map(renderAppointmentCard)
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {loading ? 'Loading appointments...' : `No ${activeFilter.toLowerCase()} appointments found`}
              </Text>
              {!loading && activeFilter === 'All' && (
                <TouchableOpacity
                  style={styles.addAppointmentButton}
                  onPress={() => router.push('/book-visit')}
                >
                  <Text style={styles.addAppointmentButtonText}>Book Your First Appointment</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>
      {renderAppointmentModal()}
      {renderFeedbackModal()}
    </SafeAreaView>
  );
}

// -- Existing styles remain the same for non-modal UI --
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 24,
    color: '#1F2937',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filtersContent: {
    paddingHorizontal: 24,
    gap: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeFilterButton: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  filterText: {
    fontSize: 14,
    color: '#6B7280',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  appointmentsList: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16,
  },
  appointmentCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  doctorInfo: {
    flexDirection: 'row',
    flex: 1,
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
    fontSize: 14,
  },
  doctorDetails: {
    flex: 1,
  },
  doctorName: {
    fontSize: 16,
    color: '#1F2937',
  },
  doctorSpecialty: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  statusText: {
    fontSize: 12,
    color: '#374151',
  },
  subtleDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginTop: 12,
    marginBottom: 12,
  },
  appointmentDetails: {
    marginBottom: 12,
  },
  keyValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
  },
  value: {
    fontSize: 14,
    color: '#1F2937',
    flexShrink: 1,
    textAlign: 'right',
  },
  appointmentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  // Outlined feedback button
  outlinedButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 12,
    marginRight: 8,
  },
  outlinedButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  addAppointmentButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addAppointmentButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // --- Modal styles (for Feedback modal only, see styles2 below for Appointment modal) ---
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.17)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '89%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.09,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    position: 'relative',
    maxHeight: '84%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    position: 'relative',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    textAlign: 'center',
    flex: 1,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDivider: {
    height: 1.5,
    backgroundColor: '#DBEAFE',
    marginBottom: 8,
  },
  modalSection: {
    paddingHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 7,
  },
  modalSectionCol: {
    flex: 1,
    minWidth: 120,
  },
  modalSectionRowWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
  },
  modalSectionLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter-Medium',
    marginBottom: 4,
  },
  modalSectionValue: {
    fontSize: 15,
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
  },
  modalSectionContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalSectionSubValue: {
    fontSize: 13,
    color: '#2563EB',
    fontFamily: 'Inter-Regular',
    marginTop: 1,
    marginLeft: 23,
  },
  // Feedback stars row
  starsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
    marginTop: 3,
  },
  starIcon: {
    marginHorizontal: 2,
  },
  feedbackInput: {
    marginTop: 7,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    minHeight: 85,
    maxHeight: 120,
    fontFamily: 'Inter-Regular',
  },
  // -- Put this in your main styles StyleSheet! --
feedbackModalButtonContainer: {
  paddingHorizontal: 18, // match modalSection
  marginTop: 15,
  
},
feedbackModalButton: {
  backgroundColor: '#1E40AF',
  borderRadius: 8,
  paddingVertical: 14,
  alignItems: 'center',
  justifyContent: 'center',
},
feedbackModalButtonText: {
  color: '#fff',
  fontSize: 16,
  fontFamily: 'Inter-SemiBold',
  letterSpacing: 0.2,
},

});

// -- Modern, minimal modal for Appointment Details --
const styles2 = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '91%',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.11,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
    maxHeight: '87%',
  },
  header: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    flex: 1,
  },
  closeBtn: {
    position: 'absolute',
    right: 12,
    top: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  closeX: {
    fontSize: 23,
    color: '#1E40AF',
    fontWeight: '700',
    marginTop: -2,
    marginLeft: 1,
  },
  contentWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 11,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  rowLabel: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
    maxWidth: '49%',
    flex: 1,
  },
  rowValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
    maxWidth: '49%',
    flex: 1,
    textAlign: 'right',
  },

});
 