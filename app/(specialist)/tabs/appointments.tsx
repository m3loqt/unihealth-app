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
  Plus,
  Eye,
} from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { databaseService, Appointment } from '../../../src/services/database/firebase';
import { safeDataAccess } from '../../../src/utils/safeDataAccess';
import LoadingState from '../../../src/components/ui/LoadingState';
import ErrorBoundary from '../../../src/components/ui/ErrorBoundary';
import { dataValidation } from '../../../src/utils/dataValidation';
import { useDeepMemo } from '../../../src/utils/performance';

export default function SpecialistAppointmentsScreen() {
  const { filter } = useLocalSearchParams();
  const { user } = useAuth();
  const filters = ['All', 'Pending', 'Confirmed', 'Completed', 'Declined'];

  // ---- DATA STATE ----
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Performance optimization: memoize filtered data
  const validAppointments = useDeepMemo(() => {
    return dataValidation.validateArray(appointments, dataValidation.isValidAppointment);
  }, [appointments]);

  // ---- REFERRAL STATE ----
  const [referrals, setReferrals] = useState<{[key: string]: any}>({});
  const [loadingReferrals, setLoadingReferrals] = useState<{[key: string]: boolean}>({});
  const [clinicData, setClinicData] = useState<{[key: string]: any}>({});
  const [patientData, setPatientData] = useState<{[key: string]: any}>({});

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



  // Referral details modal
  const [showReferralDetailsModal, setShowReferralDetailsModal] = useState(false);
  const [selectedReferralForDetails, setSelectedReferralForDetails] = useState<any>(null);
  const [clinicDetails, setClinicDetails] = useState<any>(null);

  // Medical History Modal State
  const [showMedicalHistoryModal, setShowMedicalHistoryModal] = useState(false);
  const [medicalHistory, setMedicalHistory] = useState<any>(null);
  const [loadingMedicalHistory, setLoadingMedicalHistory] = useState(false);

  const handleRetry = () => {
    setError(null);
    loadAppointments();
  };

  // Load appointments and referrals from Firebase
  useEffect(() => {
    if (user && user.uid) {
      loadAppointments();
    }
  }, [user]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user && user.uid) {
        loadAppointments();
      }
    }, [user])
  );

  // Load referrals for appointments that have relatedReferralId
  useEffect(() => {
    appointments.forEach(appointment => {
      const referralId = appointment.relatedReferralId || 
                        (appointment.type === 'Referral' ? appointment.id?.replace('referral-', '') : null);
      if (referralId && !referrals[referralId]) {
        loadReferral(referralId);
      }
    });
  }, [appointments]);

  const loadAppointments = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Load both appointments and referrals
      const [specialistAppointments, specialistReferrals] = await Promise.all([
        databaseService.getAppointmentsBySpecialist(user.uid),
        databaseService.getReferralsBySpecialist(user.uid)
      ]);
      
      console.log('Loaded appointments:', specialistAppointments.length);
      console.log('Loaded referrals:', specialistReferrals.length);
      console.log('Total items:', specialistAppointments.length + specialistReferrals.length);
      
      setAppointments(specialistAppointments);
      
      // Convert referrals to appointments format for display
      const referralAppointments = specialistReferrals.map(referral => ({
        id: `referral-${referral.id}`,
        appointmentDate: referral.appointmentDate,
        appointmentTime: referral.appointmentTime,
        bookedByUserFirstName: referral.referringGeneralistFirstName,
        bookedByUserId: referral.referringGeneralistId,
        bookedByUserLastName: referral.referringGeneralistLastName,
        clinicId: referral.practiceLocation.clinicId,
        clinicName: referral.referringClinicName,
        createdAt: referral.referralTimestamp,
        doctorFirstName: referral.assignedSpecialistFirstName,
        doctorId: referral.assignedSpecialistId,
        doctorLastName: referral.assignedSpecialistLastName,
        lastUpdated: referral.lastUpdated,
        notes: referral.generalistNotes,
        patientComplaint: [referral.initialReasonForReferral],
        patientFirstName: referral.patientFirstName,
        patientId: referral.patientId,
        patientLastName: referral.patientLastName,
        relatedReferralId: referral.id,
        sourceSystem: referral.sourceSystem,
        specialty: 'Referral',
        status: (() => {
          const status = referral.status as string;
          if (status === 'pending_acceptance' || status === 'pending') {
            return 'pending';
          } else if (status === 'accepted') {
            return 'confirmed';
          } else if (status === 'completed') {
            return 'completed';
          } else if (status === 'declined') {
            return 'canceled';
          } else {
            console.log('Unknown referral status, defaulting to canceled:', status);
            return 'canceled';
          }
        })(),
        type: 'Referral'
      } as Appointment));
      
      // Combine regular appointments with referral appointments
      setAppointments([...specialistAppointments, ...referralAppointments]);
      
    } catch (error) {
      console.error('Error loading appointments and referrals:', error);
      setError('Failed to load appointments and referrals. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  };

  const loadReferral = async (referralId: string) => {
    if (!referralId || referrals[referralId]) return;
    
    try {
      setLoadingReferrals(prev => ({ ...prev, [referralId]: true }));
      
      const referral = await databaseService.getReferralById(referralId);
      setReferrals(prev => ({ ...prev, [referralId]: referral }));
      
      // Load referring clinic data if referringClinicId exists
      if (referral?.referringClinicId && !clinicData[referral.referringClinicId]) {
        try {
          const clinic = await databaseService.getClinicById(referral.referringClinicId);
          setClinicData(prev => ({ ...prev, [referral.referringClinicId]: clinic }));
        } catch (error) {
          console.error('Error loading referring clinic data:', error);
        }
      }
      
      // Load patient data if patientId exists
      if (referral?.patientId && !patientData[referral.patientId]) {
        try {
          const patient = await databaseService.getPatientById(referral.patientId);
          setPatientData(prev => ({ ...prev, [referral.patientId]: patient }));
        } catch (error) {
          console.error('Error loading patient data:', error);
        }
      }
    } catch (error) {
      console.error('Error loading referral:', error);
      setReferrals(prev => ({ ...prev, [referralId]: null }));
    } finally {
      setLoadingReferrals(prev => ({ ...prev, [referralId]: false }));
    }
  };

  // Check if appointment is a referral
  const isReferral = (appointment: Appointment) => {
    return (appointment.relatedReferralId && appointment.relatedReferralId.length > 0) || 
           appointment.type === 'Referral';
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

  const handleDiagnosePatient = async (appointment: Appointment) => {
    let referralId = null;
    
    // Check if this is a referral appointment and fetch the referralId
    if (appointment.relatedReferralId || appointment.type === 'Referral') {
      referralId = appointment.relatedReferralId || appointment.id?.replace('referral-', '');
      
      // If we don't have the referral data loaded yet, fetch it
      if (referralId && !referrals[referralId]) {
        try {
          await loadReferral(referralId);
        } catch (error) {
          console.error('Error loading referral data:', error);
        }
      }
    }
    
    // Navigate to patient consultation screen with appointment data and referralId if applicable
    router.push({
      pathname: '/patient-consultation',
      params: {
        patientId: appointment.patientId,
        consultationId: appointment.id,
        referralId: referralId || undefined, // Pass referralId if it exists
      }
    });
  };



  const handleViewReferralDetails = async (referralData: any) => {
    setSelectedReferralForDetails(referralData);
    setShowReferralDetailsModal(true);
    
    // Fetch clinic details if referral has practiceLocation
    if (referralData.referral?.practiceLocation?.clinicId) {
      try {
        const clinic = await databaseService.getClinicById(referralData.referral.practiceLocation.clinicId);
        setClinicDetails(clinic);
    } catch (error) {
        console.error('Error fetching clinic details:', error);
        setClinicDetails(null);
      }
    } else {
      setClinicDetails(null);
    }
  };

  // --- LOAD MEDICAL HISTORY ---
  const loadMedicalHistory = async (appointment: Appointment, source: 'appointment' | 'referral' = 'appointment') => {
    Alert.alert('Debug', 'Medical History function called!');
    console.log('🚀 LOAD MEDICAL HISTORY FUNCTION CALLED!');
    console.log('=== MEDICAL HISTORY DEBUG START ===');
    console.log('Appointment object:', appointment);
    console.log('Appointment ID:', appointment.id);
    console.log('Appointment patientId:', appointment.patientId);
    console.log('Appointment type:', appointment.type);
    console.log('Appointment relatedReferralId:', appointment.relatedReferralId);
    console.log('Appointment status:', appointment.status);
    
    if (!appointment.patientId) {
      console.log('ERROR: No patient ID found in appointment');
      Alert.alert('Error', 'No patient ID found.');
      return;
    }

    try {
      setLoadingMedicalHistory(true);
      setShowMedicalHistoryModal(true);
      
      // Get the actual patientId string value
      const patientIdString = appointment.patientId;
      
      // Determine the correct consultationId to use based on source
      let consultationIdToUse = '';
      
      if (source === 'referral') {
        // This is a referral card click - use referralConsultationId
        console.log('This is a referral card click');
        console.log('Fetching referral data for referralId:', appointment.relatedReferralId);
        
        // Fetch the referral object to get the consultationId directly
        const referral = await databaseService.getReferralById(appointment.relatedReferralId || '');
        console.log('Fetched referral object:', referral);
        
        if (referral?.referralConsultationId) {
          // For referrals, use the referralConsultationId from the referral object
          consultationIdToUse = referral.referralConsultationId;
          console.log('Using referralConsultationId from referral object:', consultationIdToUse);
        } else if (referral?.consultationId) {
          // Fallback to old consultationId field
          consultationIdToUse = referral.consultationId;
          console.log('Using fallback consultationId from referral object:', consultationIdToUse);
        } else {
          console.log('No consultationId found in referral object - consultation may not be completed');
          Alert.alert('No Medical History', 'Medical history is only available for completed consultations.');
          setShowMedicalHistoryModal(false);
          return;
        }
      } else {
        // This is a regular appointment card click - use appointmentConsultationId
        console.log('This is a regular appointment card click');
        if (appointment.appointmentConsultationId) {
          consultationIdToUse = appointment.appointmentConsultationId;
          console.log('Using appointment.appointmentConsultationId:', appointment.appointmentConsultationId);
        } else if (appointment.consultationId) {
          // Fallback for old appointments that might have the old consultationId field
          consultationIdToUse = appointment.consultationId;
          console.log('Using fallback appointment.consultationId:', appointment.consultationId);
        } else {
          console.log('No consultationId found in appointment - consultation may not be completed');
          Alert.alert('No Medical History', 'Medical history is only available for completed consultations.');
          setShowMedicalHistoryModal(false);
          return;
        }
      }
      
      console.log('Final patientIdString:', patientIdString);
      console.log('Final consultationIdToUse:', consultationIdToUse);
      
      // Try to get medical history from the specific consultation
      const medicalHistoryPath = `patientMedicalHistory/${patientIdString}/entries/${consultationIdToUse}`;
      console.log('Full Firebase path being queried:', medicalHistoryPath);
      
      const history = await databaseService.getDocument(medicalHistoryPath);
      console.log('Raw response from databaseService.getDocument:', history);
      
      if (history) {
        console.log('Found medical history - Object keys:', Object.keys(history));
        console.log('Found medical history - Full object:', history);
        setMedicalHistory(history);
      } else {
        console.log('No medical history found for this consultation');
        console.log('The databaseService.getDocument returned null/undefined');
        setMedicalHistory(null);
      }
    } catch (error) {
      console.error('Error loading medical history:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      Alert.alert('Error', 'Failed to load medical history. Please try again.');
      setShowMedicalHistoryModal(false);
    } finally {
      setLoadingMedicalHistory(false);
      console.log('=== MEDICAL HISTORY DEBUG END ===');
    }
  };

  // ---- FILTER ----
  const filteredAppointments = appointments.filter((appointment) => {
    // Exclude referral appointments from regular appointment list
    if (appointment.relatedReferralId || appointment.type === 'Referral') {
      return false;
    }
    
    const patientName = `${appointment.patientFirstName} ${appointment.patientLastName}`;
    const matchesSearch =
      patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      appointment.type.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Handle status mapping between filter options and actual status values
    let matchesFilter = false;
    if (activeFilter === 'All') {
      matchesFilter = true;
    } else if (activeFilter === 'Declined') {
      matchesFilter = appointment.status === 'canceled';
    } else {
      matchesFilter = appointment.status === activeFilter.toLowerCase();
    }
    
    return matchesSearch && matchesFilter;
  });

  // Get referrals for appointments
  const getReferralCards = () => {
    const referralCards = [];
    
    appointments.forEach(appointment => {
      // Check if this is a referral appointment (has relatedReferralId or is type 'Referral')
      if (appointment.relatedReferralId || appointment.type === 'Referral') {
        // Apply the same filtering logic as regular appointments
        const patientName = `${appointment.patientFirstName} ${appointment.patientLastName}`;
        const matchesSearch =
          patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          appointment.type.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Handle status mapping between filter options and actual status values
        let matchesFilter = false;
        if (activeFilter === 'All') {
          matchesFilter = true;
        } else if (activeFilter === 'Declined') {
          matchesFilter = appointment.status === 'canceled';
        } else {
          matchesFilter = appointment.status === activeFilter.toLowerCase();
        }
        
        // Only include referral cards that match the current filter and search
        if (matchesSearch && matchesFilter) {
          const referralId = appointment.relatedReferralId || appointment.id?.replace('referral-', '');
          const referral = referralId ? referrals[referralId] : null;
          const isLoading = referralId ? loadingReferrals[referralId] : false;
        
        referralCards.push({
            id: appointment.id || `referral-${referralId}`, // Use appointment.id as unique key, fallback to referral ID
          type: 'referral',
          appointment,
          referral,
          loading: isLoading
        });
        }
      }
    });
    
    return referralCards;
  };

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
      case 'canceled':
        return <XCircle size={14} color="#6B7280" />;
      default:
        return null;
    }
  };

  // === Referral Card ===
  const renderReferralCard = (referralData: any) => {
    const { appointment, referral, loading } = referralData;
    
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
        // Handle time strings that already have AM/PM
        if (timeString.includes('AM') || timeString.includes('PM')) {
          return timeString;
        }
        
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
      } catch (error) {
        return 'Invalid time';
      }
    };

    const isPending = appointment.status === 'pending';
    const patientName = `${appointment.patientFirstName} ${appointment.patientLastName}`;
    const patientInitials = `${appointment.patientFirstName?.[0] || ''}${appointment.patientLastName?.[0] || ''}`;

    return (
      <View key={referralData.id} style={styles.referralCard}>
        <View style={styles.referralCardHeader}>
          <View style={styles.referralCardHeaderLeft}>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => handleViewReferralDetails(referralData)}
            >
              <Eye size={16} color="#1E40AF" />
            </TouchableOpacity>
            {/* Medical History Button - Only show if referral is completed */}
            {appointment.status === 'completed' && (
              <TouchableOpacity
                style={styles.medicalHistoryButton}
                onPress={() => {
                  console.log('🔍 MEDICAL HISTORY EYE ICON PRESSED!');
                  console.log('Appointment being passed:', appointment);
                  loadMedicalHistory(appointment, 'referral');
                }}
              >
                <Eye size={16} color="#059669" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.referralCardDetails}>
            <Text style={styles.referralCardTitle}>Referral Request</Text>
            <Text style={styles.referralCardSubtitle}>
              {patientName}
            </Text>
          </View>
          <View style={styles.referralStatusBadge}>
            <Text style={styles.referralStatusText}>
              {appointment.status === 'confirmed' ? 'Accepted' :
               appointment.status === 'pending' || appointment.status === 'pending_acceptance' ? 'Pending' :
               appointment.status === 'completed' ? 'Completed' :
               appointment.status === 'canceled' ? 'Declined' : 'Unknown'}
            </Text>
          </View>
        </View>

        <View style={styles.appointmentMeta}>
          <View style={styles.metaRow}>
            <Clock size={16} color="#6B7280" />
            <Text style={styles.metaText}>
              {formatDisplayDate(referral?.appointmentDate || '')} at {formatDisplayTime(referral?.appointmentTime || '')}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <MapPin size={16} color="#6B7280" />
            <Text style={styles.metaText}>
              {referral?.referringClinicName || 'Clinic not specified'}
            </Text>
          </View>
        </View>

        {referral?.initialReasonForReferral && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Reason:</Text>
            <Text style={styles.notesText}>{referral.initialReasonForReferral}</Text>
          </View>
        )}

        <View style={styles.referralCardActions}>
          {isPending ? (
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
          ) : appointment.status === 'confirmed' ? (
            <TouchableOpacity
              style={styles.diagnoseButton}
              onPress={() => handleDiagnosePatient(appointment)}
            >
              <Stethoscope size={16} color="#FFFFFF" />
              <Text style={styles.diagnoseButtonText}>Diagnose Patient</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  // === Regular Appointment Card ===
  const renderAppointmentCard = (appointment: Appointment) => {
    const isPending = appointment.status === 'pending';
    const isReferralAppointment = isReferral(appointment);
    const patientName = safeDataAccess.getUserFullName(appointment, 'Unknown Patient');
    const patientInitials = safeDataAccess.getUserInitials(appointment, 'U');

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
              <Text style={styles.appointmentType}>{appointment.type || 'General Consultation'}</Text>
              {isReferralAppointment ? (
                <View style={styles.referralBadge}>
                  <FileText size={12} color="#1E40AF" />
                  <Text style={styles.referralText}>Referral</Text>
                </View>
              ) : (
                <Text style={styles.referredBy}>Referred by {appointment.specialty || 'General Medicine'}</Text>
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
            <Text style={styles.metaText}>
              {appointment.appointmentDate || 'Date not specified'} at {appointment.appointmentTime || 'Time not specified'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <MapPin size={16} color="#6B7280" />
            <Text style={styles.metaText}>{appointment.clinicName || 'Clinic not specified'}</Text>
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
          {isPending && !isReferralAppointment ? (
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
          ) : appointment.status === 'confirmed' && !isReferralAppointment ? (
            // Confirmed regular appointment - show diagnose button
            <TouchableOpacity
              style={styles.diagnoseButton}
              onPress={() => handleDiagnosePatient(appointment)}
            >
              <Stethoscope size={16} color="#FFFFFF" />
              <Text style={styles.diagnoseButtonText}>Diagnose Patient</Text>
            </TouchableOpacity>
          ) : appointment.status === 'completed' ? (
            // Completed appointment - show medical history button
            <TouchableOpacity
              style={styles.medicalHistoryButton}
              onPress={() => {
                console.log('🔍 MEDICAL HISTORY BUTTON PRESSED (REGULAR APPOINTMENT)!');
                console.log('Appointment being passed:', appointment);
                loadMedicalHistory(appointment, 'appointment');
              }}
            >
              <Eye size={16} color="#059669" />
              <Text style={styles.medicalHistoryButtonText}>View History</Text>
            </TouchableOpacity>
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


  // Remove Prescription Confirmation Modal


  // Medical History Modal
  const renderMedicalHistoryModal = () => (
    <Modal
      visible={showMedicalHistoryModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        setShowMedicalHistoryModal(false);
        setMedicalHistory(null);
      }}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Medical History</Text>
            {loadingMedicalHistory ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading medical history...</Text>
              </View>
            ) : medicalHistory ? (
              <ScrollView style={styles.medicalHistoryScroll}>
                {/* Clinical Summary */}
                <View style={styles.medicalHistorySection}>
                  <Text style={styles.medicalHistorySectionTitle}>Clinical Summary</Text>
                  <View style={styles.medicalHistoryCard}>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Diagnosis:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.diagnosis && medicalHistory.diagnosis.length > 0 
                          ? medicalHistory.diagnosis[0].description 
                          : 'Not specified'}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Differential Diagnosis:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.differentialDiagnosis || 'Not specified'}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Clinical Summary:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.clinicalSummary || 'Not specified'}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Treatment Plan:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.treatmentPlan || 'Not specified'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* SOAP Notes */}
                <View style={styles.medicalHistorySection}>
                  <Text style={styles.medicalHistorySectionTitle}>SOAP Notes</Text>
                  <View style={styles.medicalHistoryCard}>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Subjective:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.soapNotes?.subjective || 'Not specified'}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Objective:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.soapNotes?.objective || 'Not specified'}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Assessment:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.soapNotes?.assessment || 'Not specified'}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Plan:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.soapNotes?.plan || 'Not specified'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Additional Information */}
                <View style={styles.medicalHistorySection}>
                  <Text style={styles.medicalHistorySectionTitle}>Additional Information</Text>
                  <View style={styles.medicalHistoryCard}>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Lab Results:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.labResults || 'Not specified'}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Allergies:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.allergies || 'Not specified'}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Vitals:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.vitals || 'Not specified'}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Medications:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.medications || 'Not specified'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Prescriptions */}
                {medicalHistory.prescriptions && medicalHistory.prescriptions.length > 0 && (
                  <View style={styles.medicalHistorySection}>
                    <Text style={styles.medicalHistorySectionTitle}>Prescriptions</Text>
                    <View style={styles.medicalHistoryCard}>
                      {medicalHistory.prescriptions.map((prescription: any, index: number) => (
                        <View key={index} style={styles.prescriptionItemHistory}>
                          <Text style={styles.prescriptionMedication}>{prescription.medication}</Text>
                          <Text style={styles.prescriptionDetailsText}>
                            {prescription.dosage} • {prescription.frequency}
                          </Text>
                          {prescription.description && (
                            <Text style={styles.prescriptionDescriptionText}>{prescription.description}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Certificates */}
                {medicalHistory.certificates && medicalHistory.certificates.length > 0 && (
                  <View style={styles.medicalHistorySection}>
                    <Text style={styles.medicalHistorySectionTitle}>Medical Certificates</Text>
                    <View style={styles.medicalHistoryCard}>
                      {medicalHistory.certificates.map((certificate: any, index: number) => (
                        <View key={index} style={styles.certificateItem}>
                          <Text style={styles.certificateTypeText}>{certificate.type}</Text>
                          <Text style={styles.certificateDescriptionText}>{certificate.description}</Text>
                          {certificate.validUntil && (
                            <Text style={styles.certificateValidUntil}>Valid until: {certificate.validUntil}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Consultation Details */}
                <View style={styles.medicalHistorySection}>
                  <Text style={styles.medicalHistorySectionTitle}>Consultation Details</Text>
                  <View style={styles.medicalHistoryCard}>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Consultation Date:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {new Date(medicalHistory.consultationDate).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Consultation Time:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.consultationTime}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Provider:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        Dr. {medicalHistory.provider?.firstName} {medicalHistory.provider?.lastName}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Last Updated:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {new Date(medicalHistory.lastUpdated).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            ) : (
              <View style={styles.medicalHistoryEmptyContainer}>
                <Text style={styles.medicalHistoryEmptyTitle}>No Medical History Available</Text>
                <Text style={styles.medicalHistoryEmptyText}>
                  Medical history for this consultation has not been recorded yet.
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  // Cancel Diagnosis Confirmation Modal
  const renderReferralDetailsModal = () => (
    <Modal
      visible={showReferralDetailsModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
      setShowReferralDetailsModal(false);
      setClinicDetails(null);
    }}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Referral Details</Text>
            {selectedReferralForDetails ? (
              <ScrollView style={styles.referralDetailsScroll}>
                <View style={styles.referralDetailsSection}>
                  <Text style={styles.referralDetailsSectionTitle}>Patient Information</Text>
                  <View style={styles.keyValueRow}>
                    <Text style={styles.label}>Name:</Text>
                    <Text style={styles.value}>
                      {selectedReferralForDetails.appointment.patientFirstName} {selectedReferralForDetails.appointment.patientLastName}
              </Text>
                  </View>
                  <View style={styles.keyValueRow}>
                    <Text style={styles.label}>Status:</Text>
                    <Text style={styles.value}>
                      {selectedReferralForDetails.appointment.status === 'confirmed' ? 'Accepted' :
                       selectedReferralForDetails.appointment.status === 'pending' ? 'Pending' :
                       selectedReferralForDetails.appointment.status === 'completed' ? 'Completed' :
                       selectedReferralForDetails.appointment.status === 'canceled' ? 'Declined' : 'Unknown'}
            </Text>
            </View>
            </View>

                {selectedReferralForDetails.referral && (
                  <>
                    <View style={styles.referralDetailsSection}>
                      <Text style={styles.referralDetailsSectionTitle}>Referral Information</Text>
                      <View style={styles.keyValueRow}>
                        <Text style={styles.label}>Reason:</Text>
                        <Text style={styles.value}>
                          {selectedReferralForDetails.referral.initialReasonForReferral || 'Not specified'}
                        </Text>
              </View>
                      <View style={styles.keyValueRow}>
                        <Text style={styles.label}>From Clinic:</Text>
                        <Text style={styles.value}>
                          {selectedReferralForDetails.referral.referringClinicName || 'Clinic not specified'}
                        </Text>
                  </View>
                      {clinicDetails && (
                        <View style={styles.keyValueRow}>
                          <Text style={styles.label}>Clinic Address:</Text>
                          <Text style={styles.value}>
                            {clinicDetails.address || 'Address not available'}
                          </Text>
                  </View>
                      )}
                      {selectedReferralForDetails.referral.practiceLocation?.roomOrUnit && (
                        <View style={styles.keyValueRow}>
                          <Text style={styles.label}>Room/Unit:</Text>
                          <Text style={styles.value}>
                            {selectedReferralForDetails.referral.practiceLocation.roomOrUnit}
                          </Text>
                </View>
                      )}
                      <View style={styles.keyValueRow}>
                        <Text style={styles.label}>Date:</Text>
                        <Text style={styles.value}>
                          {(() => {
                            try {
                              const date = new Date(selectedReferralForDetails.referral.appointmentDate);
                              return date.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              });
                            } catch (error) {
                              return 'Invalid date';
                            }
                          })()}
                        </Text>
            </View>
                      <View style={styles.keyValueRow}>
                        <Text style={styles.label}>Time:</Text>
                        <Text style={styles.value}>
                          {(() => {
                            try {
                              const timeString = selectedReferralForDetails.referral.appointmentTime;
                              if (timeString.includes('AM') || timeString.includes('PM')) {
                                return timeString;
                              }
                              const [hours, minutes] = timeString.split(':');
                              const hour = parseInt(hours);
                              const ampm = hour >= 12 ? 'PM' : 'AM';
                              const displayHour = hour % 12 || 12;
                              return `${displayHour}:${minutes} ${ampm}`;
                            } catch (error) {
                              return 'Invalid time';
                            }
                          })()}
                        </Text>
                      </View>
                    </View>
                  </>
                )}

                {!selectedReferralForDetails.referral && (
                  <View style={styles.referralDetailsSection}>
                    <Text style={styles.referralDetailsSectionTitle}>Referral Information</Text>
                    <Text style={styles.referralCardText}>Referral details not available</Text>
                  </View>
                )}
              </ScrollView>
            ) : (
              <Text style={styles.referralCardText}>Loading referral details...</Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowReferralDetailsModal(false);
                  setClinicDetails(null);
                }}
              >
                <Text style={styles.modalCancelText}>Close</Text>
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
            <LoadingState
              message="Loading appointments..."
              variant="inline"
              size="large"
            />
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredAppointments.length > 0 || getReferralCards().length > 0 ? (
            <>
              {/* Render referral cards first */}
              {getReferralCards().map(renderReferralCard)}
              
              {/* Render regular appointment cards */}
              {filteredAppointments.map(renderAppointmentCard)}
            </>
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
      {renderReferralDetailsModal()}
      {renderMedicalHistoryModal()}
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
  referralCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  referralCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  referralCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  medicalHistoryButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  medicalHistoryButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#059669',
    marginLeft: 8,
  },
  referralIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  viewButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  referralCardIcon: {
    fontSize: 24,
  },
  referralCardDetails: {
    flex: 1,
  },
  referralCardTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  referralCardSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  referralStatusBadge: {
    backgroundColor: '#FEF2F2',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  referralStatusText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#EF4444',
  },
  subtleDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  keyValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  value: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'right',
  },
  referralCardText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
  referralCardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  referralDetailsScroll: {
    maxHeight: 400,
  },
  referralDetailsSection: {
    marginBottom: 20,
  },
  referralDetailsSectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  // Medical History Modal Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  medicalHistoryScroll: {
    maxHeight: 400,
  },
  medicalHistorySection: {
    marginBottom: 24,
  },
  medicalHistorySectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  medicalHistoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  medicalHistoryField: {
    marginBottom: 12,
  },
  medicalHistoryFieldLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 4,
  },
  medicalHistoryFieldValue: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    lineHeight: 20,
  },
  prescriptionItemHistory: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  prescriptionMedication: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  prescriptionDetailsText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  prescriptionDescriptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    fontStyle: 'italic',
  },
  certificateItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  certificateTypeText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  certificateDescriptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  certificateValidUntil: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  medicalHistoryEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  medicalHistoryEmptyTitle: {
    fontSize: 18,
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 12,
    textAlign: 'center',
  },
  medicalHistoryEmptyText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
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
    fontFamily: 'Inter-SemiBold',
  },
});
