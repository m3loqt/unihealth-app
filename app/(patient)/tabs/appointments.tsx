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
import { useAuth } from '@/hooks/auth/useAuth';
import { databaseService, Appointment, MedicalHistory } from '@/services/database/firebase';
import { AppointmentDetailsModal } from '../../../src/components';
import { safeDataAccess } from '@/utils/safeDataAccess';
import LoadingState from '@/components/ui/LoadingState';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { dataValidation } from '@/utils/dataValidation';
import { performanceUtils } from '@/utils/performance';

export default function AppointmentsScreen() {
  const { filter } = useLocalSearchParams();
  const { user } = useAuth();
  const filters = ['All', 'Pending', 'Confirmed', 'Completed', 'Cancelled'];
  const [activeFilter, setActiveFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [modalAppointment, setModalAppointment] = useState<Appointment | null>(null);
  
  // Function to open modal and load medical history if needed
  const openAppointmentModal = async (appointment: Appointment) => {
    setModalAppointment(appointment);
    setShowModal(true);
    
    // Clear any previous medical history
    setMedicalHistory(null);
    
    // Load clinic and specialist data for the appointment
    await loadAppointmentData(appointment);
    
    // Auto-load medical history for completed appointments only
    if (appointment.status === 'completed') {
      loadMedicalHistory(appointment, 'appointment');
    }
    
    // Also check if this is a referral and load medical history if completed
    if (appointment.relatedReferralId) {
      const referral = referrals[appointment.relatedReferralId];
      if (referral?.status === 'completed') {
        loadMedicalHistory(appointment, 'referral');
      }
    }
  };
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // --- Feedback modal state ---
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackAppointment, setFeedbackAppointment] = useState<Appointment | null>(null);
  const [feedbackStars, setFeedbackStars] = useState(0);
  const [feedbackReason, setFeedbackReason] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // --- Medical History state ---
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory | null>(null);
  const [loadingMedicalHistory, setLoadingMedicalHistory] = useState(false);

  // --- Referral state ---
  const [referrals, setReferrals] = useState<{[key: string]: any}>({});
  const [loadingReferrals, setLoadingReferrals] = useState<{[key: string]: boolean}>({});
  const [clinicData, setClinicData] = useState<{[key: string]: any}>({});
  const [specialistData, setSpecialistData] = useState<{[key: string]: any}>({});

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

  // Load referrals for appointments that have relatedReferralId
  useEffect(() => {
    appointments.forEach(appointment => {
      if (appointment.relatedReferralId && !referrals[appointment.relatedReferralId]) {
        loadReferral(appointment.relatedReferralId);
      }
    });
  }, [appointments]);

  const loadAppointments = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      const userAppointments = await databaseService.getAppointments(user.uid, user.role);
      
      // Validate appointments data
      const validAppointments = dataValidation.validateArray(userAppointments, dataValidation.isValidAppointment);
      console.log('Loaded appointments:', validAppointments.length);
      console.log('Appointments:', validAppointments);
      setAppointments(validAppointments);
    } catch (error) {
      console.error('Error loading appointments:', error);
      setError('Failed to load appointments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  };

  const handleRetry = () => {
    setError(null);
    loadAppointments();
  };

  // Load clinic and specialist data for an appointment
  const loadAppointmentData = async (appointment: Appointment) => {
    try {
      // Load clinic data if not already loaded
      if (appointment.clinicId && !clinicData[appointment.clinicId]) {
        const clinic = await databaseService.getClinicById(appointment.clinicId);
        setClinicData(prev => ({ ...prev, [appointment.clinicId]: clinic }));
      }
      
      // Load specialist data if not already loaded
      if (appointment.doctorId && !specialistData[appointment.doctorId]) {
        const specialist = await databaseService.getDoctorById(appointment.doctorId);
        setSpecialistData(prev => ({ ...prev, [appointment.doctorId]: specialist }));
      }
    } catch (error) {
      console.error('Error loading appointment data:', error);
    }
  };

  const loadMedicalHistory = async (appointment: Appointment, source: 'appointment' | 'referral' = 'appointment') => {
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
    } finally {
      setLoadingMedicalHistory(false);
      console.log('=== MEDICAL HISTORY DEBUG END ===');
    }
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
      
      // Load specialist data if assignedSpecialistId exists
      if (referral?.assignedSpecialistId && !specialistData[referral.assignedSpecialistId]) {
        try {
          console.log('Loading specialist data for ID:', referral.assignedSpecialistId);
          const specialist = await databaseService.getDoctorById(referral.assignedSpecialistId);
          console.log('Loaded specialist data:', specialist);
          setSpecialistData(prev => ({ ...prev, [referral.assignedSpecialistId]: specialist }));
        } catch (error) {
          console.error('Error loading specialist data:', error);
        }
      }
    } catch (error) {
      console.error('Error loading referral:', error);
      setReferrals(prev => ({ ...prev, [referralId]: null }));
    } finally {
      setLoadingReferrals(prev => ({ ...prev, [referralId]: false }));
    }
  };

  function capitalize(str: string) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  // Performance optimization: memoize filtered appointments
  const filteredAppointments = performanceUtils.useDeepMemo(() => {
    if (activeFilter === 'All') {
      return appointments;
    }
    
    const filterStatus = activeFilter.toLowerCase();
    return appointments.filter(appointment => 
      appointment.status.toLowerCase() === filterStatus
    );
  }, [appointments, activeFilter]);

  // Filter appointments based on active filter (legacy function for compatibility)
  const getFilteredAppointments = () => filteredAppointments;

  // Get referrals for appointments
  const getReferralCards = () => {
    const referralCards = [];
    
    appointments.forEach(appointment => {
      if (appointment.relatedReferralId) {
        const referral = referrals[appointment.relatedReferralId];
        const isLoading = loadingReferrals[appointment.relatedReferralId];
        
        referralCards.push({
          id: appointment.id || `referral-${appointment.relatedReferralId}`, // Use appointment.id as unique key, fallback to referral ID
          type: 'referral',
          appointment,
          referral,
          loading: isLoading
        });
      }
    });
    
    return referralCards;
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
          // Remove any duplicate AM/PM and return clean format
          const cleanTime = timeString.replace(/\s*(AM|PM)\s*(AM|PM)\s*/gi, ' $1');
          return cleanTime.trim();
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

    const specialistName = `${referral?.assignedSpecialistFirstName || ''} ${referral?.assignedSpecialistLastName || ''}`.trim();
    const specialistInitials = `${referral?.assignedSpecialistFirstName?.[0] || 'S'}${referral?.assignedSpecialistLastName?.[0] || 'p'}`;

    return (
      <View key={referralData.id} style={styles.referralCard}>
        <View style={styles.referralCardHeader}>
          <View style={styles.referralCardHeaderLeft}>
            <View style={styles.referralIconContainer}>
              <Text style={styles.referralCardIcon}>📋</Text>
            </View>
            {/* Medical History Button - Only show if referral is completed */}
            {/* {referral?.status === 'completed' && (
              <TouchableOpacity
                style={styles.medicalHistoryButton}
                onPress={() => {
                  console.log('🔍 MEDICAL HISTORY EYE ICON PRESSED!');
                  console.log('Appointment being passed:', appointment);
                  loadMedicalHistory(appointment, 'referral');
                }}
              >
                <Text style={styles.medicalHistoryButtonText}>View History</Text>
              </TouchableOpacity>
            )} */}
          </View>
          <View style={styles.referralCardDetails}>
            <Text style={styles.referralCardTitle}>Referral</Text>
            <Text style={styles.referralCardSubtitle}>
              {specialistName || 'Specialist'}
            </Text>
          </View>
          <View style={styles.referralStatusBadge}>
            <Text style={styles.referralStatusText}>
              {referral?.status === 'confirmed' ? 'Confirmed' :
               referral?.status === 'pending' ? 'Pending' :
               referral?.status === 'completed' ? 'Completed' :
               referral?.status === 'cancelled' ? 'Cancelled' :
               referral?.status === 'pending' ? 'Pending' :
               referral?.status === 'confirmed' ? 'Confirmed' :
               referral?.status === 'canceled' ? 'Canceled' : 'Unknown'}
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
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              // Always show modal - medical history will be loaded automatically for completed referrals
              openAppointmentModal(appointment);
            }}
          >
            <Text style={styles.secondaryButtonText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // === Appointment Card ===
  const renderAppointmentCard = (appointment: Appointment) => {
    const isCompleted = appointment.status === 'completed';
    
    // Format date for display
    const formatDisplayDate = (dateString: string) => {
      if (!dateString) return 'Date not specified';
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
      if (!timeString) return 'Time not specified';
      try {
        // Handle time strings that already have AM/PM
        if (timeString.includes('AM') || timeString.includes('PM')) {
          // Remove any duplicate AM/PM and return clean format
          const cleanTime = timeString.replace(/\s*(AM|PM)\s*(AM|PM)\s*/gi, ' $1');
          return cleanTime.trim();
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

    const doctorName = safeDataAccess.getAppointmentDoctorName(appointment, 'Doctor not specified');
    const doctorInitials = (() => {
      const firstName = appointment.doctorFirstName || '';
      const lastName = appointment.doctorLastName || '';
      if (firstName && lastName) {
        return `${firstName[0]}${lastName[0]}`.toUpperCase();
      }
      if (firstName) {
        return firstName[0].toUpperCase();
      }
      return 'DR';
    })();

    return (
      <View key={appointment.id} style={styles.appointmentCard}>
        <View style={styles.appointmentHeader}>
          <View style={styles.doctorInfo}>
            <View style={styles.doctorAvatar}>
              <Text style={styles.doctorInitial}>
                {doctorInitials}
              </Text>
            </View>
            <View style={styles.doctorDetails}>
              <Text style={styles.doctorName}>
                {doctorName || 'Doctor not specified'}
              </Text>
              <Text style={styles.doctorSpecialty}>
                {appointment.specialty || 'General Medicine'}
              </Text>
            </View>
          </View>
          <View style={styles.appointmentHeaderRight}>
            <View style={styles.statusBadge}>
              {getStatusIcon(appointment.status)}
              <Text style={styles.statusText}>{capitalize(appointment.status)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.appointmentMeta}>
          <View style={styles.metaRow}>
            <Clock size={16} color="#6B7280" />
            <Text style={styles.metaText}>
              {formatDisplayDate(appointment.appointmentDate)} at {formatDisplayTime(appointment.appointmentTime)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <MapPin size={16} color="#6B7280" />
            <Text style={styles.metaText}>
              {appointment.clinicName || 'Clinic not available'}
            </Text>
          </View>
        </View>

        {appointment.additionalNotes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes:</Text>
            <Text style={styles.notesText}>{appointment.additionalNotes}</Text>
          </View>
        )}

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
                onPress={() => {
                  console.log('🔍 VIEW DETAILS BUTTON PRESSED (COMPLETED APPOINTMENT)!');
                  console.log('Appointment being passed:', appointment);
                  // For completed appointments, route to visit overview
                  router.push(`/(patient)/visit-overview?id=${appointment.id}`);
                }}
              >
                <Text style={styles.secondaryButtonText}>View Details</Text>
              </TouchableOpacity>
            </>
          ) : appointment.status === 'confirmed' ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                console.log('🔍 VIEW DETAILS BUTTON PRESSED (CONFIRMED APPOINTMENT)!');
                console.log('Appointment being passed:', appointment);
                // For confirmed appointments, route to visit overview
                router.push(`/(patient)/visit-overview?id=${appointment.id}`);
              }}
            >
              <Text style={styles.secondaryButtonText}>View Details</Text>
              </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={ () => {
                // For other appointment statuses, route to visit overview
                router.push(`/(patient)/visit-overview?id=${appointment.id}`);
              }}
            >
              <Text style={styles.secondaryButtonText}>View Details</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };



  // Get filtered appointments from memoized value

  // === Appointment Details Modal (Unified with Tabs) ===
  const renderAppointmentModal = () => {
    if (!modalAppointment) return null;
    
    return (
      <AppointmentDetailsModal
        visible={showModal}
        onClose={() => {
          setShowModal(false);
          setMedicalHistory(null);
        }}
        appointment={modalAppointment}
        medicalHistory={medicalHistory}
        loadingMedicalHistory={loadingMedicalHistory}
        clinicData={clinicData[modalAppointment.clinicId]}
        doctorData={specialistData[modalAppointment.doctorId]}
      />
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
                onPress={() => {
                  setShowFeedbackModal(false);
                  // Clear medical history when feedback modal is closed
                  setMedicalHistory(null);
                }}
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
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Appointments</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/(patient)/book-visit')}
          >
            <Plus size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/(patient)/tabs/profile')}
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
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#1E40AF']}
            tintColor="#1E40AF"
          />
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
               
               {/* Render appointment cards */}
               {filteredAppointments.map(renderAppointmentCard)}
             </>
           ) : (
             <View style={styles.emptyState}>
               <Text style={styles.emptyStateText}>
                 {`No ${activeFilter.toLowerCase()} appointments found`}
               </Text>
               {activeFilter === 'All' && (
                 <TouchableOpacity
                   style={styles.addAppointmentButton}
                   onPress={() => router.push('/(patient)/book-visit')}
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
    </ErrorBoundary>
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
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    flex: 1,
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
  appointmentHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  medicalHistoryButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  medicalHistoryButtonText: {
    fontSize: 12,
    color: '#2563EB',
    fontFamily: 'Inter-SemiBold',
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
  // Appointment Meta Section
  appointmentMeta: {
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 8,
  },
  // Notes Section
  notesSection: {
    marginBottom: 12,
  },
  notesLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
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
  // Error state styles
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    margin: 20,
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

  medicalHistoryLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  medicalHistoryLoadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
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

  // Referral Section Styles
  referralSection: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  referralIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  referralTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
  },
  referralText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
    lineHeight: 16,
    marginBottom: 8,
  },
  referralStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  referralStatusLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
  },
  referralStatusValue: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  referralStatusConfirmed: {
    color: '#2563EB',
  },
  referralStatusPending: {
    color: '#D97706',
  },
  referralStatusCompleted: {
    color: '#2563EB',
  },
  referralStatusCanceled: {
    color: '#DC2626',
  },
  referralDoctor: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
    marginTop: 4,
  },
  referralDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
    marginTop: 2,
  },
  referralClinic: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
    marginTop: 2,
  },
  referralNotes: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
    marginTop: 4,
    fontStyle: 'italic',
  },

  // Referral Card Styles
  referralCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  referralCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  referralCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  referralIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  referralCardIcon: {
    fontSize: 18,
  },
  referralCardDetails: {
    flex: 1,
  },
  referralCardTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
  },
  referralCardSubtitle: {
    fontSize: 14,
    color: '#2563EB',
    marginTop: 2,
  },
  referralStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  referralStatusText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#2563EB',
  },
  referralCardText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1E40AF',
    lineHeight: 20,
  },
  referralCardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  // Modal styles
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
  medicalHistorySection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  medicalHistoryTitle: {
    fontSize: 16,
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 12,
  },
});