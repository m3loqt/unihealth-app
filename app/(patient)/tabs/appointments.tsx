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
import MedicalHistoryView from '../components/MedicalHistoryView';

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

  // --- Medical History modal state ---
  const [showMedicalHistoryModal, setShowMedicalHistoryModal] = useState(false);
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

  const loadMedicalHistory = async (appointment: Appointment) => {
    if (!appointment.id || !appointment.patientId) return;
    
    try {
      setLoadingMedicalHistory(true);
      setShowMedicalHistoryModal(true);
      
      const history = await databaseService.getMedicalHistoryByAppointment(
        appointment.id,
        appointment.patientId
      );
      
      setMedicalHistory(history);
    } catch (error) {
      console.error('Error loading medical history:', error);
      Alert.alert('Error', 'Failed to load medical history. Please try again.');
      setShowMedicalHistoryModal(false);
    } finally {
      setLoadingMedicalHistory(false);
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

  // Get referrals for appointments
  const getReferralCards = () => {
    const referralCards = [];
    
    appointments.forEach(appointment => {
      if (appointment.relatedReferralId) {
        const referral = referrals[appointment.relatedReferralId];
        const isLoading = loadingReferrals[appointment.relatedReferralId];
        
        referralCards.push({
          id: `referral-${appointment.relatedReferralId}`,
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

    return (
      <View key={referralData.id} style={styles.referralCard}>
        <View style={styles.referralCardHeader}>
          <View style={styles.referralIconContainer}>
            <Text style={styles.referralCardIcon}>📋</Text>
          </View>
                     <View style={styles.referralCardDetails}>
             <Text style={styles.referralCardTitle}>Referral</Text>
             <Text style={styles.referralCardSubtitle}>
               {referral?.assignedSpecialistFirstName && referral?.assignedSpecialistLastName
                 ? `${referral.assignedSpecialistFirstName} ${referral.assignedSpecialistLastName}`
                 : 'Specialist'}
             </Text>
           </View>
                     <View style={styles.referralStatusBadge}>
             <Text style={styles.referralStatusText}>
               {referral?.status === 'confirmed' ? 'Ready' :
                referral?.status === 'pending' ? 'Pending' :
                referral?.status === 'completed' ? 'Completed' :
                referral?.status === 'canceled' ? 'Canceled' : 'Unknown'}
             </Text>
           </View>
        </View>

        <View style={styles.subtleDivider} />

                 <View style={styles.referralCardDetails}>
           {loading ? (
             <Text style={styles.referralCardText}>Loading referral details...</Text>
           ) : referral ? (
             <>
                               <View style={styles.keyValueRow}>
                  <Text style={styles.label}>Reason:</Text>
                  <Text style={styles.value}>
                    {referral.initialReasonForReferral || 'Not specified'}
                  </Text>
                </View>
                                 <View style={styles.keyValueRow}>
                   <Text style={styles.label}>Clinic:</Text>
                   <Text style={styles.value}>
                     {referral.referringClinicName || 'Clinic not specified'}
                   </Text>
                 </View>
                <View style={styles.keyValueRow}>
                  <Text style={styles.label}>Date:</Text>
                  <Text style={styles.value}>{formatDisplayDate(referral.appointmentDate)}</Text>
                </View>
                <View style={styles.keyValueRow}>
                  <Text style={styles.label}>Time:</Text>
                  <Text style={styles.value}>{formatDisplayTime(referral.appointmentTime)}</Text>
                </View>
             </>
           ) : (
             <Text style={styles.referralCardText}>Referral details not available</Text>
           )}
         </View>

        <View style={styles.referralCardActions}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setModalAppointment(appointment);
              setShowModal(true);
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
                onPress={() => loadMedicalHistory(appointment)}
              >
                <Text style={styles.secondaryButtonText}>View Medical History</Text>
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

  // === Medical History Modal ===
  const renderMedicalHistoryModal = () => {
    return (
      <Modal
        visible={showMedicalHistoryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMedicalHistoryModal(false)}
      >
        <SafeAreaView style={styles.medicalHistoryModalContainer}>
          <StatusBar barStyle="dark-content" />
          
          {/* Header */}
          <View style={styles.medicalHistoryModalHeader}>
            <TouchableOpacity
              style={styles.medicalHistoryModalBackButton}
              onPress={() => setShowMedicalHistoryModal(false)}
            >
              <Text style={styles.medicalHistoryModalBackText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.medicalHistoryModalTitle}>Medical History</Text>
            <View style={styles.medicalHistoryModalSpacer} />
          </View>

          {/* Content */}
          <ScrollView 
            style={styles.medicalHistoryModalContent}
            showsVerticalScrollIndicator={false}
          >
            {loadingMedicalHistory ? (
              <View style={styles.medicalHistoryLoadingContainer}>
                <Text style={styles.medicalHistoryLoadingText}>Loading medical history...</Text>
              </View>
            ) : medicalHistory ? (
              <MedicalHistoryView medicalHistory={medicalHistory} />
            ) : (
              <View style={styles.medicalHistoryEmptyContainer}>
                <Text style={styles.medicalHistoryEmptyTitle}>No Medical History Available</Text>
                <Text style={styles.medicalHistoryEmptyText}>
                  Medical history for this appointment has not been recorded yet.
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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

    // Check if this is a referral appointment
    const isReferral = a.relatedReferralId && referrals[a.relatedReferralId];
    const referral = isReferral ? referrals[a.relatedReferralId] : null;

    // Modal data using correct Appointment properties
    const fields = isReferral ? [
      // Referral-specific fields
      { label: "Referring Clinic", value: referral?.referringClinicName || 'Not specified' },
      { 
        label: "Practice Location", 
        value: (() => {
          const clinicId = referral?.referringClinicId;
          const clinic = clinicId ? clinicData[clinicId] : null;
          return clinic?.address || 'Address not specified';
        })()
      },
      { 
        label: "Specialist", 
        value: (referral?.assignedSpecialistFirstName && referral?.assignedSpecialistLastName
          ? `${referral.assignedSpecialistFirstName} ${referral.assignedSpecialistLastName}`
          : 'Specialist not specified')
      },
      { 
        label: "Specialty", 
        value: (() => {
                       const specialistId = referral?.assignedSpecialistId;
             const specialist = specialistId ? specialistData[specialistId] : null;
             console.log('Specialist ID:', specialistId);
             console.log('Specialist Data:', specialist?.specialty);
             return specialist?.specialty || specialist?.specialization || 'Not specified';
        })()
      },
      { 
        label: "Date", 
        value: (() => {
          try {
            const date = new Date(a.appointmentDate);
            return date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
          } catch (error) {
            return a.appointmentDate || 'Not specified';
          }
        })()
      },
      { label: "Time", value: formatDisplayTime(a.appointmentTime) || 'Not specified' },
      { label: "Purpose", value: referral?.initialReasonForReferral || 'Not specified' },
      { 
        label: "Status", 
        value: a.status === 'confirmed' ? 'Ready' :
               a.status === 'pending' ? 'Pending' :
               a.status === 'completed' ? 'Completed' :
               a.status === 'canceled' ? 'Canceled' : 
               capitalize(a.status || 'Unknown')
      },
    ] : [
      // Regular appointment fields
      { label: "Clinic Name", value: a.clinicName || 'Not specified' },
      { 
        label: "Doctor", 
        value: `${a.doctorFirstName || ''} ${a.doctorLastName || ''}`.trim() || 'Not specified' 
      },
      { label: "Specialty", value: a.specialty || 'General Practice' },
      { 
        label: "Date", 
        value: (() => {
          try {
            const date = new Date(a.appointmentDate);
            return date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
          } catch (error) {
            return a.appointmentDate || 'Not specified';
          }
        })()
      },
      { label: "Time", value: formatDisplayTime(a.appointmentTime) || 'Not specified' },
      { label: "Purpose", value: a.patientComplaint?.join(', ') || 'Not specified' },
      ...(a.notes ? [{ label: "Additional Notes", value: a.notes }] : []),
      { 
        label: "Status", 
        value: capitalize(a.status) 
      },
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
            refreshing={loading}
            onRefresh={loadAppointments}
            colors={['#1E40AF']}
            tintColor="#1E40AF"
          />
        }
      >
                 <View style={styles.appointmentsList}>
           {filteredAppointments.length > 0 || getReferralCards().length > 0 ? (
             <>
               {/* Render referral cards first */}
               {getReferralCards().map(renderReferralCard)}
               
               {/* Render appointment cards */}
               {filteredAppointments.map(renderAppointmentCard)}
             </>
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
      {renderMedicalHistoryModal()}
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
  // Medical History Modal Styles
  medicalHistoryModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  medicalHistoryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  medicalHistoryModalBackButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  medicalHistoryModalBackText: {
    fontSize: 16,
    color: '#1E40AF',
    fontFamily: 'Inter-SemiBold',
  },
  medicalHistoryModalTitle: {
    fontSize: 18,
    color: '#1F2937',
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    flex: 1,
  },
  medicalHistoryModalSpacer: {
    width: 60,
  },
  medicalHistoryModalContent: {
    flex: 1,
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
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
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
    color: '#166534',
  },
  referralText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#166534',
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
    color: '#166534',
  },
  referralStatusValue: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  referralStatusConfirmed: {
    color: '#059669',
  },
  referralStatusPending: {
    color: '#D97706',
  },
  referralStatusCompleted: {
    color: '#059669',
  },
  referralStatusCanceled: {
    color: '#DC2626',
  },
  referralDoctor: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#166534',
    marginTop: 4,
  },
  referralDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#166534',
    marginTop: 2,
  },
  referralClinic: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#166534',
    marginTop: 2,
  },
  referralNotes: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#166534',
    marginTop: 4,
    fontStyle: 'italic',
  },

  // Referral Card Styles
  referralCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 16,
  },
  referralCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  referralIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#BBF7D0',
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
    color: '#166534',
  },
  referralCardSubtitle: {
    fontSize: 14,
    color: '#059669',
    marginTop: 2,
  },
  referralStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#059669',
    backgroundColor: '#D1FAE5',
  },
  referralStatusText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#059669',
  },
  referralCardText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#166534',
    lineHeight: 20,
  },
  referralCardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
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
 