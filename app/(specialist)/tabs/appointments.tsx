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
  Calendar,
  FileText,
  Stethoscope,
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

  // Accept/Decline Modals for Referrals
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // Decline reason dropdown
  const [showReasonDropdown, setShowReasonDropdown] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  // Diagnosis Modal
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
  const [diagnosis, setDiagnosis] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [prescriptions, setPrescriptions] = useState<Array<{
    medication: string;
    dosage: string;
    frequency: string;
  }>>([]);

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

  // Check if appointment is a referral
  const isReferral = (appointment: Appointment) => {
    return appointment.relatedReferralId && appointment.relatedReferralId.length > 0;
  };

  // Check if referral is pending acceptance
  const isReferralPending = (appointment: Appointment) => {
    return isReferral(appointment) && appointment.status === 'pending';
  };

  const handleAcceptReferral = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowAcceptModal(true);
  };

  const confirmAcceptReferral = async () => {
    if (!selectedAppointment || !selectedAppointment.id) return;
    
    try {
      // Update the appointment status to confirmed
      await databaseService.updateAppointmentStatus(selectedAppointment.id, 'confirmed');
      
      // If this is a referral, also update the referral status
      if (isReferral(selectedAppointment) && selectedAppointment.relatedReferralId) {
        await databaseService.updateReferralStatus(selectedAppointment.relatedReferralId, 'accepted');
      }
      
      Alert.alert('Success', 'Referral accepted successfully!');
      setShowAcceptModal(false);
      setSelectedAppointment(null);
      loadAppointments(); // Refresh the list
    } catch (error) {
      console.error('Error accepting referral:', error);
      Alert.alert('Error', 'Failed to accept referral. Please try again.');
    }
  };

  const handleDeclineReferral = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowDeclineModal(true);
  };

  const submitDeclineReferral = async () => {
    if (!selectedAppointment || !selectedAppointment.id) return;
    
    const finalReason = declineReason === 'Other' ? customReason : declineReason;
    if (!finalReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for declining.');
      return;
    }

    try {
      // Update the appointment status to canceled
      await databaseService.updateAppointmentStatus(selectedAppointment.id, 'canceled', finalReason);
      
      // If this is a referral, also update the referral status
      if (isReferral(selectedAppointment) && selectedAppointment.relatedReferralId) {
        await databaseService.updateReferralStatus(selectedAppointment.relatedReferralId, 'declined', finalReason);
      }
      
      Alert.alert('Success', 'Referral declined successfully!');
      setShowDeclineModal(false);
      setSelectedAppointment(null);
      setDeclineReason('');
      setCustomReason('');
      loadAppointments(); // Refresh the list
    } catch (error) {
      console.error('Error declining referral:', error);
      Alert.alert('Error', 'Failed to decline referral. Please try again.');
    }
  };

  const handleDiagnosePatient = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowDiagnosisModal(true);
  };

  const submitDiagnosis = async () => {
    if (!selectedAppointment || !selectedAppointment.id) return;
    
    if (!diagnosis.trim()) {
      Alert.alert('Error', 'Please provide a diagnosis.');
      return;
    }

    try {
      // Create medical history entry
      const medicalHistoryEntry = {
        clinicalSummary: diagnosis,
        consultationDate: selectedAppointment.appointmentDate,
        consultationTime: selectedAppointment.appointmentTime,
        createdAt: new Date().toISOString(),
        diagnosis: [{
          code: 'DIAGNOSIS',
          description: diagnosis
        }],
        followUpInstructions: treatmentPlan,
        lastUpdated: new Date().toISOString(),
        patientId: selectedAppointment.patientId,
        practiceLocation: {
          clinicId: selectedAppointment.clinicId,
          roomOrUnit: 'Specialist Clinic'
        },
        prescriptions: prescriptions,
        provider: {
          firstName: selectedAppointment.doctorFirstName,
          id: selectedAppointment.doctorId,
          lastName: selectedAppointment.doctorLastName,
          providerType: 'specialist',
          sourceSystem: 'UniHealth_App'
        },
        relatedAppointment: {
          id: selectedAppointment.id!,
          type: selectedAppointment.type
        },
        treatmentPlan: treatmentPlan,
        type: 'Specialist Consultation'
      };

      // Save to medical history
      await databaseService.setDocument(`patientMedicalHistory/${selectedAppointment.patientId}/entries/${Date.now()}`, medicalHistoryEntry);
      
      // Update appointment status to completed
      await databaseService.updateAppointmentStatus(selectedAppointment.id, 'completed');
      
      Alert.alert('Success', 'Diagnosis and treatment plan saved successfully!');
      setShowDiagnosisModal(false);
      setSelectedAppointment(null);
      setDiagnosis('');
      setTreatmentPlan('');
      setPrescriptions([]);
      loadAppointments(); // Refresh the list
    } catch (error) {
      console.error('Error saving diagnosis:', error);
      Alert.alert('Error', 'Failed to save diagnosis. Please try again.');
    }
  };

  const addPrescription = () => {
    setPrescriptions([...prescriptions, { medication: '', dosage: '', frequency: '' }]);
  };

  const updatePrescription = (index: number, field: string, value: string) => {
    const updatedPrescriptions = [...prescriptions];
    updatedPrescriptions[index] = { ...updatedPrescriptions[index], [field]: value };
    setPrescriptions(updatedPrescriptions);
  };

  const removePrescription = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
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
    const isReferralAppointment = isReferral(appointment);
    const isReferralPendingAcceptance = isReferralPending(appointment);
    const isConfirmedReferral = isReferralAppointment && appointment.status === 'confirmed';
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
              {isReferralAppointment ? (
                <View style={styles.referralBadge}>
                  <FileText size={12} color="#1E40AF" />
                  <Text style={styles.referralText}>Referral</Text>
                </View>
              ) : (
                <Text style={styles.referredBy}>Referred by {appointment.specialty}</Text>
              )}
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

        {/* Action Buttons */}
        <View style={styles.appointmentActions}>
          {isReferralPendingAcceptance ? (
            // Referral pending acceptance - show accept/deny buttons
            <>
              <TouchableOpacity
                style={styles.declineButton}
                onPress={() => handleDeclineReferral(appointment)}
              >
                <X size={16} color="#EF4444" />
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => handleAcceptReferral(appointment)}
              >
                <Check size={16} color="#FFFFFF" />
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            </>
          ) : isConfirmedReferral ? (
            // Confirmed referral - show diagnose button
            <TouchableOpacity
              style={styles.diagnoseButton}
              onPress={() => handleDiagnosePatient(appointment)}
            >
              <Stethoscope size={16} color="#FFFFFF" />
              <Text style={styles.diagnoseButtonText}>Diagnose Patient</Text>
            </TouchableOpacity>
          ) : isPending && !isReferralAppointment ? (
            // Regular pending appointment - show accept/deny buttons
            <>
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
            </>
          ) : null}
        </View>
      </View>
    );
  };

  // Legacy functions for regular appointments
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

  // ---- MODALS ----

  // Accept modal
  const renderAcceptModal = () => {
    if (!selectedAppointment) return null;
    const isReferralAppointment = isReferral(selectedAppointment);
    
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
              <Text style={styles.modalTitle}>
                {isReferralAppointment ? 'Accept Referral' : 'Accept Appointment'}
              </Text>
              <Text style={styles.modalSubtitle}>
                Are you sure you want to accept this {isReferralAppointment ? 'referral' : 'appointment'} with{' '}
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
                  onPress={isReferralAppointment ? confirmAcceptReferral : confirmAccept}
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

  // Decline modal
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
            <Text style={styles.modalTitle}>
              {selectedAppointment && isReferral(selectedAppointment) ? 'Decline Referral' : 'Decline Appointment'}
            </Text>
            <Text style={styles.modalSubtitle}>
              Please select a reason for declining this {selectedAppointment && isReferral(selectedAppointment) ? 'referral' : 'appointment'} with{' '}
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
                onPress={selectedAppointment && isReferral(selectedAppointment) ? submitDeclineReferral : submitDecline}
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

  // Diagnosis modal
  const renderDiagnosisModal = () => (
    <Modal
      visible={showDiagnosisModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowDiagnosisModal(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalTitle}>Diagnose Patient</Text>
            <Text style={styles.modalSubtitle}>
              Provide diagnosis and treatment plan for{' '}
              <Text style={{ fontWeight: 'bold', color: '#1E40AF' }}>
                {selectedAppointment ? `${selectedAppointment.patientFirstName} ${selectedAppointment.patientLastName}` : ''}
              </Text>
            </Text>

            {/* Diagnosis */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Diagnosis *</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Enter diagnosis..."
                placeholderTextColor="#9CA3AF"
                value={diagnosis}
                onChangeText={setDiagnosis}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Treatment Plan */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Treatment Plan</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Enter treatment plan..."
                placeholderTextColor="#9CA3AF"
                value={treatmentPlan}
                onChangeText={setTreatmentPlan}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Prescriptions */}
            <View style={styles.inputContainer}>
              <View style={styles.prescriptionHeader}>
                <Text style={styles.inputLabel}>Prescriptions</Text>
                <TouchableOpacity style={styles.addButton} onPress={addPrescription}>
                  <Text style={styles.addButtonText}>+ Add</Text>
                </TouchableOpacity>
              </View>
              
              {prescriptions.map((prescription, index) => (
                <View key={index} style={styles.prescriptionItem}>
                  <View style={styles.prescriptionRow}>
                    <TextInput
                      style={styles.prescriptionInput}
                      placeholder="Medication"
                      placeholderTextColor="#9CA3AF"
                      value={prescription.medication}
                      onChangeText={(text) => updatePrescription(index, 'medication', text)}
                    />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removePrescription(index)}
                    >
                      <X size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.prescriptionRow}>
                    <TextInput
                      style={styles.prescriptionInput}
                      placeholder="Dosage"
                      placeholderTextColor="#9CA3AF"
                      value={prescription.dosage}
                      onChangeText={(text) => updatePrescription(index, 'dosage', text)}
                    />
                    <TextInput
                      style={styles.prescriptionInput}
                      placeholder="Frequency"
                      placeholderTextColor="#9CA3AF"
                      value={prescription.frequency}
                      onChangeText={(text) => updatePrescription(index, 'frequency', text)}
                    />
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowDiagnosisModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, { backgroundColor: '#10B981' }]}
                onPress={submitDiagnosis}
                disabled={!diagnosis.trim()}
              >
                <Text style={styles.modalSubmitText}>Save Diagnosis</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
              <Calendar size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>
                No {activeFilter.toLowerCase()} appointments found
              </Text>
              <Text style={styles.emptyStateText}>
                {activeFilter === 'All' 
                  ? "You don't have any appointments scheduled yet."
                  : `You don't have any ${activeFilter.toLowerCase()} appointments at the moment.`
                }
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* MODALS */}
      {renderAcceptModal()}
      {renderDeclineModal()}
      {renderDiagnosisModal()}
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
  diagnoseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  diagnoseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  referralBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  referralText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
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
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  textArea: {
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
  prescriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#1E40AF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  prescriptionItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  prescriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  prescriptionInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  removeButton: {
    padding: 8,
  },
});
