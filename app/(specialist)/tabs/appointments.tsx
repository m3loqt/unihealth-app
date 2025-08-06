import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Search,
  User,
  Clock,
  MapPin,
  Check,
  X,
  ChevronDown,
  CircleCheck as CheckCircle,
  Hourglass,
  Circle as XCircle,
  Check as CheckMark,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { databaseService, Appointment } from '../../../src/services/database/firebase';

export default function SpecialistAppointmentsScreen() {
  const { filter } = useLocalSearchParams();
  const { user } = useAuth();
  const filters = ['All', 'Pending', 'Confirmed', 'Completed', 'Declined'];

  // ---- DATA STATE ----
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ---- UI/STATE ----
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(
    filter ? String(filter).charAt(0).toUpperCase() + String(filter).slice(1) : 'All'
  );

  // Accept/Decline Modals
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // Decline reason dropdown
  const [showReasonDropdown, setShowReasonDropdown] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  // Load appointments from Firebase
  useEffect(() => {
    if (user && user.uid) {
      loadAppointments();
    }
  }, [user]);

  const loadAppointments = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const specialistAppointments = await databaseService.getAppointmentsBySpecialist(user.uid);
      console.log('Loaded appointments:', specialistAppointments.length);
      setAppointments(specialistAppointments);
    } catch (error) {
      console.error('Error loading appointments:', error);
      Alert.alert('Error', 'Failed to load appointments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  };

  const handleAcceptAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowAcceptModal(true);
  };

  const confirmAccept = async () => {
    if (!selectedAppointment || !selectedAppointment.id) return;
    
    try {
      await databaseService.updateAppointmentStatus(selectedAppointment.id, 'confirmed');
      Alert.alert('Success', 'Appointment accepted successfully!');
      setShowAcceptModal(false);
      setSelectedAppointment(null);
      loadAppointments(); // Refresh the list
    } catch (error) {
      console.error('Error accepting appointment:', error);
      Alert.alert('Error', 'Failed to accept appointment. Please try again.');
    }
  };

  const handleDeclineAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowDeclineModal(true);
  };

  const submitDecline = async () => {
    if (!selectedAppointment || !selectedAppointment.id) return;
    
    const finalReason = declineReason === 'Other' ? customReason : declineReason;
    if (!finalReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for declining.');
      return;
    }

    try {
      await databaseService.updateAppointmentStatus(selectedAppointment.id, 'canceled', finalReason);
      Alert.alert('Success', 'Appointment declined successfully!');
      setShowDeclineModal(false);
      setSelectedAppointment(null);
      setDeclineReason('');
      setCustomReason('');
      loadAppointments(); // Refresh the list
    } catch (error) {
      console.error('Error declining appointment:', error);
      Alert.alert('Error', 'Failed to decline appointment. Please try again.');
    }
  };

  // ---- FILTER ----
  const filteredAppointments = appointments.filter((appointment) => {
    const patientName = `${appointment.patientFirstName} ${appointment.patientLastName}`;
    const matchesSearch =
      patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      appointment.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      activeFilter === 'All' || appointment.status === activeFilter.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  // ---- MODAL LOGIC ----
  const declineReasons = [
    'Schedule conflict',
    'Patient needs different specialist',
    'Insufficient information provided',
    'Outside my area of expertise',
    'Clinic capacity full',
    'Other (specify)',
  ];

  // ---- CARD RENDER ----
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle size={14} color="#6B7280" />;
      case 'pending':
        return <Hourglass size={14} color="#6B7280" />;
      case 'completed':
        return <CheckMark size={14} color="#6B7280" />;
      case 'declined':
        return <XCircle size={14} color="#6B7280" />;
      default:
        return null;
    }
  };

  const renderAppointmentCard = (appointment: Appointment) => {
    const isPending = appointment.status === 'pending';
    const patientName = `${appointment.patientFirstName} ${appointment.patientLastName}`;
    const patientInitials = `${appointment.patientFirstName?.[0] || ''}${appointment.patientLastName?.[0] || ''}`;

    return (
      <View key={appointment.id} style={styles.appointmentCard}>
        <View style={styles.appointmentHeader}>
          <View style={styles.patientInfo}>
            <View style={styles.patientAvatar}>
              <Text style={styles.patientInitial}>
                {patientInitials}
              </Text>
            </View>
            <View style={styles.appointmentDetails}>
              <Text style={styles.patientName}>{patientName}</Text>
              <Text style={styles.appointmentType}>{appointment.type}</Text>
              <Text style={styles.referredBy}>Referred by {appointment.specialty}</Text>
            </View>
          </View>
          <View style={styles.statusBadge}>
            {getStatusIcon(appointment.status)}
            <Text style={styles.statusText}>
              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.appointmentMeta}>
          <View style={styles.metaRow}>
            <Clock size={16} color="#6B7280" />
            <Text style={styles.metaText}>{appointment.appointmentDate} at {appointment.appointmentTime}</Text>
          </View>
          <View style={styles.metaRow}>
            <MapPin size={16} color="#6B7280" />
            <Text style={styles.metaText}>{appointment.clinicName}</Text>
          </View>
        </View>

        {appointment.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes:</Text>
            <Text style={styles.notesText}>{appointment.notes}</Text>
          </View>
        )}

        {appointment.status === 'canceled' && (
          <View style={styles.declineReasonSection}>
            <Text style={styles.declineReasonLabel}>Decline Reason:</Text>
            <Text style={styles.declineReasonText}>Appointment was declined</Text>
          </View>
        )}

        {isPending && (
          <View style={styles.appointmentActions}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={() => handleDeclineAppointment(appointment)}
            >
              <X size={16} color="#EF4444" />
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleAcceptAppointment(appointment)}
            >
              <Check size={16} color="#FFFFFF" />
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ---- MODALS ----

  // Accept modal
  const renderAcceptModal = () => {
    if (!selectedAppointment) return null;
    return (
      <Modal
        visible={showAcceptModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAcceptModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Accept Appointment</Text>
              <Text style={styles.modalSubtitle}>
                Are you sure you want to accept this appointment with{' '}
                <Text style={{ fontWeight: 'bold', color: '#1E40AF' }}>
                  {selectedAppointment ? `${selectedAppointment.patientFirstName} ${selectedAppointment.patientLastName}` : ''}
                </Text>
                ?
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowAcceptModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitButton, { backgroundColor: '#1E40AF' }]}
                  onPress={confirmAccept}
                >
                  <Text style={styles.modalSubmitText}>Accept</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Decline modal (already present, improved below)
  const renderDeclineModal = () => (
    <Modal
      visible={showDeclineModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowDeclineModal(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Decline Appointment</Text>
            <Text style={styles.modalSubtitle}>
              Please select a reason for declining this appointment with{' '}
              <Text style={{ fontWeight: 'bold', color: '#EF4444' }}>
                {selectedAppointment ? `${selectedAppointment.patientFirstName} ${selectedAppointment.patientLastName}` : ''}
              </Text>
            </Text>
            {/* Dropdown */}
            <View style={styles.reasonContainer}>
              <TouchableOpacity
                style={styles.reasonDropdown}
                onPress={() => setShowReasonDropdown((v) => !v)}
              >
                <Text
                  style={[
                    styles.reasonText,
                    !declineReason && styles.reasonPlaceholder,
                  ]}
                >
                  {declineReason || 'Select reason for declining'}
                </Text>
                <ChevronDown size={20} color="#6B7280" />
              </TouchableOpacity>
              {showReasonDropdown && (
                <View style={styles.reasonDropdownMenu}>
                  {declineReasons.map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      style={styles.reasonDropdownItem}
                      onPress={() => {
                        setDeclineReason(reason);
                        setShowReasonDropdown(false);
                      }}
                    >
                      <Text style={styles.reasonDropdownText}>{reason}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            {/* If Other */}
            {declineReason === 'Other (specify)' && (
              <View style={styles.customReasonContainer}>
                <Text style={styles.customReasonLabel}>Please specify:</Text>
                <TextInput
                  style={styles.customReasonInput}
                  placeholder="Enter your reason..."
                  placeholderTextColor="#9CA3AF"
                  value={customReason}
                  onChangeText={setCustomReason}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowDeclineModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, { backgroundColor: '#EF4444' }]}
                onPress={submitDecline}
                disabled={!declineReason || (declineReason === 'Other (specify)' && !customReason.trim())}
              >
                <Text style={styles.modalSubmitText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ---- RENDER ----
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Appointments</Text>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push('/(specialist)/tabs/profile')}
        >
          <User size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={18} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search appointments by patient or type"
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                activeFilter === filter && styles.activeFilterButton,
              ]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === filter && styles.activeFilterText,
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Appointment List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.appointmentsList}>
          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Loading appointments...</Text>
            </View>
          ) : filteredAppointments.length > 0 ? (
            filteredAppointments.map(renderAppointmentCard)
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No {activeFilter.toLowerCase()} appointments found
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* MODALS */}
      {renderAcceptModal()}
      {renderDeclineModal()}
    </SafeAreaView>
  );
}

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
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
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
  searchContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
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
    fontFamily: 'Inter-Medium',
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
  patientInfo: {
    flexDirection: 'row',
    flex: 1,
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
  referredBy: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
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
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  appointmentMeta: {
    gap: 6,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  notesSection: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  notesLabel: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
  declineReasonSection: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  declineReasonLabel: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#EF4444',
    marginBottom: 4,
  },
  declineReasonText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    lineHeight: 18,
  },
  appointmentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    gap: 6,
  },
  declineButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  acceptButtonText: {
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
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  // Modal Styles (shared)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  reasonContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  reasonDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reasonText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  reasonPlaceholder: {
    color: '#9CA3AF',
  },
  reasonDropdownMenu: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    zIndex: 10,
    maxHeight: 200,
  },
  reasonDropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  reasonDropdownText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  customReasonContainer: {
    marginBottom: 16,
  },
  customReasonLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  customReasonInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    minHeight: 80,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});
