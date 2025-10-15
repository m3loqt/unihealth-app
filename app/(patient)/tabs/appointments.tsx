import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  X,
  Star,
  Search,
  MessageCircle,
  Filter,
  ChevronDown,
  Repeat,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { useAppointments, usePatientReferrals } from '../../../src/hooks/data';
import { databaseService, Appointment, MedicalHistory } from '../../../src/services/database/firebase';
import { AppointmentDetailsModal } from '../../../src/components';
import { safeDataAccess } from '../../../src/utils/safeDataAccess';
import LoadingState from '../../../src/components/ui/LoadingState';
import ErrorBoundary from '../../../src/components/ui/ErrorBoundary';
import { dataValidation } from '../../../src/utils/dataValidation';
import { performanceUtils, useDeepMemo } from '../../../src/utils/performance';
import { getChiefComplaint } from '../../../src/utils/chiefComplaintHelper';

export default function AppointmentsScreen() {
  const { filter } = useLocalSearchParams();
  const { user } = useAuth();
  const { 
    appointments: hookAppointments, 
    loading: hookLoading, 
    error: hookError, 
    refresh: hookRefresh 
  } = useAppointments();
  const { 
    referrals: hookReferrals, 
    loading: referralsLoading, 
    error: referralsError, 
    refresh: referralsRefresh 
  } = usePatientReferrals();
  const filters = ['All', 'Pending', 'Confirmed', 'Completed', 'Cancelled'];
  const [activeFilter, setActiveFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [modalAppointment, setModalAppointment] = useState<Appointment | null>(null);
  
  // Search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // Sort functionality
  const [sortBy, setSortBy] = useState('date-newest');
  const [showSort, setShowSort] = useState(false);
  
  // Memoize sort options to prevent recreation on every render
  const SORT_OPTIONS = useMemo(() => [
    { key: 'date-newest', label: 'Latest Added' },
    { key: 'date-oldest', label: 'Oldest Added' },
    { key: 'doctor-az', label: 'Doctor A-Z' },
    { key: 'doctor-za', label: 'Doctor Z-A' },
  ], []);
  
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
  // Use hook data instead of manual state, with deduplication
  const appointments = useMemo(() => {
    // Remove duplicates based on ID to prevent duplicate keys
    return hookAppointments.filter((appointment, index, self) => 
      index === self.findIndex(a => a.id === appointment.id)
    );
  }, [hookAppointments]);
  const loading = hookLoading;
  const error = hookError;
  const [refreshing, setRefreshing] = useState(false);

  // Debug function to test specialist referrals
  const testSpecialistReferrals = async () => {
    if (user) {
      console.log('🧪 Testing specialist referrals from patient appointments screen...');
      await databaseService.testSpecialistReferralsForPatient(user.uid);
    }
  };

  // Call test function when component mounts (temporary for debugging)
  useEffect(() => {
    if (user && !loading) {
      testSpecialistReferrals();
    }
  }, [user, loading]);

  // Debug appointments data
  useEffect(() => {
    if (appointments.length > 0) {
      console.log('🔍 Patient appointments data:', appointments.map(apt => ({
        id: apt.id,
        type: apt.type,
        doctorFirstName: apt.doctorFirstName,
        doctorLastName: apt.doctorLastName,
        doctorSpecialty: apt.doctorSpecialty,
        // referringSpecialistId: apt.referringSpecialistId,
        // referringSpecialistFirstName: apt.referringSpecialistFirstName,
        // referringSpecialistLastName: apt.referringSpecialistLastName
      })));
      
      // Check if specialist referrals are being included
      const specialistReferrals = appointments.filter(apt => apt.type === 'specialist_referral');
      console.log('🔍 Specialist referrals in appointments:', specialistReferrals.length);
      specialistReferrals.forEach(ref => {
        console.log('🔍 Specialist referral details:', {
          id: ref.id,
          doctorName: `${ref.doctorFirstName} ${ref.doctorLastName}`,
          // referringDoctor: `${ref.referringSpecialistFirstName} ${ref.referringSpecialistLastName}`
        });
      });
    }
  }, [appointments]);

  // --- Feedback modal state ---
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackAppointment, setFeedbackAppointment] = useState<Appointment | null>(null);
  const [feedbackReferral, setFeedbackReferral] = useState<any>(null);
  const [feedbackStars, setFeedbackStars] = useState(0);
  const [feedbackReason, setFeedbackReason] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [existingFeedback, setExistingFeedback] = useState<{[appointmentId: string]: boolean}>({});
  const [existingReferralFeedback, setExistingReferralFeedback] = useState<{[referralId: string]: boolean}>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Available tags for feedback
  const availableTags = [
    'excellent', 'good', 'satisfied', 'professional', 'knowledgeable', 
    'friendly', 'helpful', 'caring', 'efficient', 'thorough', 
    'needs_improvement', 'long_wait', 'communication_issues'
  ];

  // --- Medical History state ---
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory | null>(null);
  const [loadingMedicalHistory, setLoadingMedicalHistory] = useState(false);

  // --- Referral state ---
  // Convert hook referrals to the format expected by the UI
  const referrals = useDeepMemo(() => {
    const referralsMap: {[key: string]: any} = {};
    hookReferrals.forEach(referral => {
      if (referral.id) {
        referralsMap[referral.id] = referral;
      }
    });
    return referralsMap;
  }, [hookReferrals]);
  
  const [loadingReferrals, setLoadingReferrals] = useState<{[key: string]: boolean}>({});
  const [clinicData, setClinicData] = useState<{[key: string]: any}>({});
  const [specialistData, setSpecialistData] = useState<{[key: string]: any}>({});

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

  useEffect(() => {
    if (filter && filters.includes(capitalize(filter as string))) {
      setActiveFilter(capitalize(filter as string));
    }
  }, [filter]);

  // Real-time updates are handled by the useAppointments hook
  // No need for manual loading or useFocusEffect refresh

  // Real-time referrals are handled by the usePatientReferrals hook

  // Check for existing feedback for completed appointments when appointments change
  useEffect(() => {
    const checkFeedbackForAppointments = async () => {
      if (appointments.length === 0) return;

      const feedbackChecks: {[appointmentId: string]: boolean} = {};
      for (const appointment of appointments) {
        if (appointment.status === 'completed') {
          try {
            const feedbackExists = await databaseService.checkFeedbackExists(appointment.id!);
            feedbackChecks[appointment.id!] = feedbackExists;

          } catch (error) {
            console.error('Error checking feedback for appointment:', appointment.id, error);
            feedbackChecks[appointment.id!] = false;
          }
        }
      }

      setExistingFeedback(feedbackChecks);
    };

    checkFeedbackForAppointments();
  }, [appointments]);

  // Check for existing feedback for completed referrals when referrals change
  useEffect(() => {
    const checkFeedbackForReferrals = async () => {
      if (hookReferrals.length === 0) return;

      const feedbackChecks: {[referralId: string]: boolean} = {};
      for (const referral of hookReferrals) {
        if (referral.status === 'completed') {
          try {
            const feedbackExists = await databaseService.checkReferralFeedbackExists(referral.id!);
            feedbackChecks[referral.id!] = feedbackExists;

          } catch (error) {
            console.error('Error checking feedback for referral:', referral.id, error);
            feedbackChecks[referral.id!] = false;
          }
        }
      }

      setExistingReferralFeedback(feedbackChecks);
    };

    checkFeedbackForReferrals();
  }, [hookReferrals]);

  // Load appointment data when appointments change
  useEffect(() => {
    if (appointments && appointments.length > 0) {
      loadAllAppointmentsData();
    }
  }, [appointments]);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Refresh both appointments and referrals via their respective hooks
    await Promise.all([
      hookRefresh(),
      referralsRefresh()
    ]);
    setRefreshing(false);
  };

  const handleRetry = () => {
    // The hook handles error state, just trigger a refresh
    hookRefresh();
  };

  const handleFollowUp = async (appointment: Appointment) => {
    try {
      // Fetch doctor name from users node using doctorId as single source of truth
      const doctorData = await databaseService.getDocument(`users/${appointment.doctorId}`);
      const doctorName = doctorData ? 
        `${doctorData.firstName || doctorData.first_name || ''} ${doctorData.middleName || doctorData.middle_name || ''} ${doctorData.lastName || doctorData.last_name || ''}`.trim() :
        'Unknown Doctor';
      
      // Navigate to select-datetime screen with appointment data for follow-up
      router.push({
        pathname: '/(patient)/book-visit/select-datetime',
        params: {
          doctorId: appointment.doctorId,
          clinicId: appointment.clinicId,
          clinicName: appointment.clinicName || '',
          doctorName: doctorName,
          doctorSpecialty: appointment.specialty || 'General Consultation',
          isFollowUp: 'true',
          originalAppointmentId: appointment.id || '',
        }
      });
    } catch (error) {
      console.error('Error fetching doctor data for follow-up:', error);
      Alert.alert('Error', 'Unable to fetch doctor information. Please try again.');
    }
  };

  // Handle tag selection
  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  // Submit feedback function
  const handleSubmitFeedback = async () => {
    if ((!feedbackAppointment && !feedbackReferral) || !feedbackStars) return;
    
    // Ensure at least one tag is selected
    if (selectedTags.length === 0) {
      Alert.alert('Please select at least one tag to describe your experience.');
      return;
    }

    try {
      setSubmittingFeedback(true);
      
      // Get patient data
      const patientData = await databaseService.getDocument(`users/${user?.uid}`);
      const patientName = patientData ? `${patientData.firstName || patientData.first_name || ''} ${patientData.lastName || patientData.last_name || ''}`.trim() : 'Unknown Patient';
      const patientEmail = user?.email || '';

      let doctorData, doctorName, clinicData, clinicName, serviceType, treatmentType, appointmentId, referralId, appointmentDate;

      if (feedbackAppointment) {
        // Handle appointment feedback
        doctorData = await databaseService.getDoctorById(feedbackAppointment.doctorId);
        doctorName = doctorData ? `${doctorData.firstName || ''} ${doctorData.lastName || ''}`.trim() : 'Unknown Doctor';
        clinicData = await databaseService.getClinicByIdForDisplay(feedbackAppointment.clinicId);
        clinicName = clinicData?.name || 'Unknown Clinic';
        serviceType = feedbackAppointment.relatedReferralId ? 'referral' : 'appointment';
        treatmentType = feedbackAppointment.appointmentPurpose || 'General Consultation';
        appointmentId = feedbackAppointment.id!;
        referralId = feedbackAppointment.relatedReferralId;
        appointmentDate = feedbackAppointment.appointmentDate;
      } else if (feedbackReferral) {
        // Handle referral feedback
        doctorData = await databaseService.getDoctorById(feedbackReferral.assignedSpecialistId, false);
        doctorName = doctorData ? `${doctorData.firstName || ''} ${doctorData.lastName || ''}`.trim() : 'Unknown Doctor';
        clinicData = await databaseService.getClinicByIdForDisplay(feedbackReferral.referringClinicId);
        clinicName = clinicData?.name || feedbackReferral.referringClinicName || 'Unknown Clinic';
        serviceType = 'referral';
        treatmentType = feedbackReferral.initialReasonForReferral || 'General Consultation';
        appointmentId = undefined;
        referralId = feedbackReferral.id!;
        appointmentDate = feedbackReferral.appointmentDate;
      }

      // Use selected tags from user
      const tags = selectedTags;

      const feedbackData = {
        ...(appointmentId && { appointmentId }),
        ...(referralId && { referralId }),
        patientId: feedbackAppointment?.patientId || feedbackReferral?.patientId,
        patientName,
        patientEmail,
        doctorId: feedbackAppointment?.doctorId || feedbackReferral?.assignedSpecialistId,
        doctorName,
        clinicId: feedbackAppointment?.clinicId || feedbackReferral?.referringClinicId,
        clinicName,
        appointmentDate,
        serviceType,
        treatmentType,
        rating: feedbackStars,
        comment: feedbackReason,
        tags,
        isAnonymous: false, // Default to false, can be made configurable
      };

      await databaseService.submitFeedback(feedbackData);
      
      // Update existing feedback state
      if (feedbackAppointment) {
        setExistingFeedback(prev => ({
          ...prev,
          [feedbackAppointment.id!]: true
        }));
      } else if (feedbackReferral) {
        setExistingReferralFeedback(prev => ({
          ...prev,
          [feedbackReferral.id!]: true
        }));
      }
      
      setFeedbackSubmitted(true);
      setTimeout(() => {
        setShowFeedbackModal(false);
        setFeedbackSubmitted(false);
        setFeedbackStars(0);
        setFeedbackReason('');
        setSelectedTags([]);
        setFeedbackAppointment(null);
        setFeedbackReferral(null);
        setSubmittingFeedback(false);
      }, 1200);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert(
        'Error',
        error.message === 'Rating already submitted for this appointment' 
          ? 'You have already submitted a rating for this appointment.'
          : error.message === 'Rating a rating already submitted for this referral'
          ? 'You have already submitted a rating for this referral.'
          : 'Failed to submit a rating. Please try again.'
      );
      setSubmittingFeedback(false);
    }
  };

  // Load clinic and specialist data for an appointment
  const loadAppointmentData = async (appointment: Appointment) => {
    try {
      // Load clinic data if not already loaded
      if (appointment.clinicId && !clinicData[appointment.clinicId]) {
        const clinic = await databaseService.getClinicByIdForDisplay(appointment.clinicId);
        setClinicData(prev => ({ ...prev, [appointment.clinicId]: clinic }));
      }
      
      // Load specialist data if not already loaded
      if (appointment.doctorId && !specialistData[appointment.doctorId]) {
        // Fetch both doctor name (from users) and specialty (from doctors) data
        const [doctorNameData, doctorSpecialtyData] = await Promise.all([
          databaseService.getDocument(`users/${appointment.doctorId}`), // Get name from users node
          databaseService.getDocument(`doctors/${appointment.doctorId}`) // Get specialty from doctors node
        ]);
        
        // Combine the data
        const specialistData = {
          ...doctorNameData,
          specialty: doctorSpecialtyData?.specialty || 'General Medicine'
        };
        
        setSpecialistData(prev => ({ ...prev, [appointment.doctorId]: specialistData }));
      }
    } catch (error) {
      console.error('Error loading appointment data:', error);
    }
  };

  // Load data for all appointments to improve display
  const loadAllAppointmentsData = async () => {
    if (!appointments || appointments.length === 0) return;
    
    const promises = appointments.map(appointment => loadAppointmentData(appointment));
    await Promise.all(promises);
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

  // Load clinic and specialist data for referrals when referrals change
  useEffect(() => {
    const loadReferralData = async () => {
      if (hookReferrals.length === 0) return;

      const clinicPromises = hookReferrals.map(async (referral) => {
        if (referral.referringClinicId && !clinicData[referral.referringClinicId]) {
          try {
            const clinic = await databaseService.getClinicByIdForDisplay(referral.referringClinicId);
            setClinicData(prev => ({ ...prev, [referral.referringClinicId]: clinic }));
          } catch (error) {
            console.error('Error loading referring clinic data:', error);
          }
        }
      });

      const specialistPromises = hookReferrals.map(async (referral) => {
        if (referral.assignedSpecialistId && !specialistData[referral.assignedSpecialistId]) {
          try {
            const specialist = await databaseService.getDoctorById(referral.assignedSpecialistId, false);
            setSpecialistData(prev => ({ ...prev, [referral.assignedSpecialistId]: specialist }));
          } catch (error) {
            console.error('Error loading specialist data:', error);
          }
        }
      });

      await Promise.all([...clinicPromises, ...specialistPromises]);
    };

    loadReferralData();
  }, [hookReferrals]);

  function capitalize(str: string) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  // Performance optimization: memoize filtered appointments
  const filteredAppointments = performanceUtils.useDeepMemo(() => {
    let filtered = appointments;
    
    // Apply status filter
    if (activeFilter !== 'All') {
      const filterStatus = activeFilter.toLowerCase();
      filtered = filtered.filter(appointment => 
        appointment.status.toLowerCase() === filterStatus
      );
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const searchWords = query.split(' ').filter(word => word.length > 0);
      
      filtered = filtered.filter(appointment => {
        // Get all searchable text fields
        const doctorName = safeDataAccess.getAppointmentDoctorName(appointment, '').toLowerCase();
        const doctorFirstName = (appointment.doctorFirstName || '').toLowerCase();
        const doctorLastName = (appointment.doctorLastName || '').toLowerCase();
        const combinedName = `${doctorFirstName} ${doctorLastName}`.trim().toLowerCase();
        const clinicName = (appointment.clinicName || '').toLowerCase();
        const specialty = (appointment.specialty || appointment.doctorSpecialty || '').toLowerCase();
        const purpose = (appointment.appointmentPurpose || '').toLowerCase();
        const notes = (getChiefComplaint(appointment) || '').toLowerCase();
        
        // Check if ALL search words are found in the same field
        const searchableFields = [
          doctorName,
          doctorFirstName,
          doctorLastName,
          combinedName,
          clinicName,
          specialty,
          purpose,
          notes
        ];
        
        // For each field, check if ALL search words are present
        for (const field of searchableFields) {
          if (field && searchWords.every(word => field.includes(word))) {
            return true;
          }
        }
        
        // Debug logging for "Rene Catan" search
        if (query === 'rene catan' || query === 'rene' || query === 'catan') {
          console.log('🔍 DEBUG SEARCH for "Rene Catan":', {
            query,
            searchWords,
            doctorName,
            doctorFirstName,
            doctorLastName,
            combinedName,
            clinicName,
            specialty,
            appointmentId: appointment.id,
            doctorId: appointment.doctorId,
            matches: searchableFields.map(field => field && searchWords.every(word => field.includes(word)))
          });
        }
        
        return false;
      });
    }
    
    // Apply sorting with optimized comparisons
    const sortedFiltered = [...filtered]; // Create a new array to avoid mutating original
    
    // Pre-compute sort values for better performance on large lists
    const sortData = sortedFiltered.map(appointment => {
      // Combine appointmentDate and appointmentTime for more accurate sorting
      const appointmentDateTime = appointment.appointmentDate && appointment.appointmentTime 
        ? new Date(`${appointment.appointmentDate} ${appointment.appointmentTime}`).getTime() || 0
        : new Date(appointment.appointmentDate || '').getTime() || 0;
      const doctorName = safeDataAccess.getAppointmentDoctorName(appointment, '').toLowerCase();
      
      switch (sortBy) {
        case 'date-newest':
        case 'date-oldest':
          return {
            appointment,
            sortValue: appointmentDateTime
          };
        case 'doctor-az':
        case 'doctor-za':
          return {
            appointment,
            sortValue: doctorName
          };
        default:
          return { appointment, sortValue: 0 };
      }
    });

    // Sort based on pre-computed values with direction awareness
    sortData.sort((a, b) => {
      switch (sortBy) {
        case 'date-newest':
          return (b.sortValue as number) - (a.sortValue as number); // Newest first
        case 'date-oldest':
          return (a.sortValue as number) - (b.sortValue as number); // Oldest first
        case 'doctor-az':
          return (a.sortValue as string).localeCompare(b.sortValue as string); // A-Z
        case 'doctor-za':
          return (b.sortValue as string).localeCompare(a.sortValue as string); // Z-A
        default:
          return 0;
      }
    });

    return sortData.map(item => item.appointment);
  }, [appointments, activeFilter, searchQuery, sortBy]);

  // Filter appointments based on active filter (legacy function for compatibility)
  const getFilteredAppointments = () => filteredAppointments;

  // Get referrals for appointments
  const getReferralCards = () => {
    const referralCards = [] as Array<{ id: string; type: string; appointment: Appointment; referral: any; loading: boolean }>;
    const processedReferralIds = new Set(); // Track processed referral IDs to prevent duplicates
    const filterStatus = (activeFilter as string).toLowerCase();
    const matchesFilter = (status: string) => {
      const s = (status || '').toLowerCase();
      if (filterStatus === 'all') return true;
      if (filterStatus === 'cancelled') return s === 'cancelled' || s === 'canceled';
      return s === filterStatus;
    };

    let referralItems = appointments
      .filter(appointment => appointment.relatedReferralId && appointment.type !== 'specialist_referral') // Exclude specialist referrals
      .filter(appointment => {
        const referralId = appointment.relatedReferralId;
        // Skip if we've already processed this referral ID
        if (processedReferralIds.has(referralId)) {
          return false;
        }
        // Mark this referral ID as processed
        processedReferralIds.add(referralId);
        return true;
      })
      .map(appointment => ({
        id: `referral-${appointment.relatedReferralId}`, // Use referral ID as the key to ensure uniqueness
        type: 'referral',
        appointment,
        referral: referrals[appointment.relatedReferralId],
        loading: loadingReferrals[appointment.relatedReferralId],
      }))
      .filter(item => item.referral && matchesFilter(item.referral.status));

    console.log('🔍 Referral cards being displayed:', referralItems.length);
    console.log('🔍 Specialist referrals excluded from referral cards:', appointments.filter(apt => apt.type === 'specialist_referral').length);

    // Apply search filter to referrals
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const searchWords = query.split(' ').filter(word => word.length > 0);
      
      referralItems = referralItems.filter(item => {
        const referral = item.referral;
        if (!referral) return false;
        
        // Get all searchable text fields for referrals
        const specialistName = `${referral.assignedSpecialistFirstName || ''} ${referral.assignedSpecialistLastName || ''}`.toLowerCase();
        const referringDoctorName = (() => {
          // Handle both generalist and specialist referrals
          if (referral.referringSpecialistId) {
            return `${referral.referringSpecialistFirstName || ''} ${referral.referringSpecialistLastName || ''}`.toLowerCase();
          } else {
            return `${referral.referringGeneralistFirstName || ''} ${referral.referringGeneralistLastName || ''}`.toLowerCase();
          }
        })();
        const clinicName = (referral.referringClinicName || '').toLowerCase();
        const specialty = (referral.specialty || '').toLowerCase();
        const reason = (referral.initialReasonForReferral || '').toLowerCase();
        
        // Check if ALL search words are found in the same field
        const searchableFields = [
          specialistName,
          referringDoctorName,
          clinicName,
          specialty,
          reason
        ];
        
        // For each field, check if ALL search words are present
        for (const field of searchableFields) {
          if (field && searchWords.every(word => field.includes(word))) {
            return true;
          }
        }
        
        return false;
      });
    }

    // Sort referral items by status priority (same as appointments)
    if (activeFilter === 'All') {
      referralItems.sort((a, b) => {
        const statusOrder = {
          'pending': 1,
          'confirmed': 2,
          'completed': 3,
          'cancelled': 4,
        };
        
        const aOrder = statusOrder[a.referral?.status?.toLowerCase()] || 5;
        const bOrder = statusOrder[b.referral?.status?.toLowerCase()] || 5;
        
        return aOrder - bOrder;
      });
    }

    return referralItems;
  };


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle size={14} color="#6B7280" />;
      case 'pending':
        return <Hourglass size={14} color="#6B7280" />;
      case 'completed':
        return <Check size={14} color="#6B7280" />;
      case 'cancelled':
        return <XCircle size={14} color="#6B7280" />;
      default:
        return null;
    }
  };

  // Sort dropdown handlers - memoized for performance
  const handleShowSort = useCallback(() => {
    setShowSort(prev => !prev);
  }, []);

  const handleSortOptionSelect = useCallback((optionKey: string) => {
    setSortBy(optionKey);
    setShowSort(false);
  }, []);

  const handleCloseSortDropdown = useCallback(() => {
    setShowSort(false);
  }, []);

  const renderSortDropdown = useCallback(() => {
    if (!showSort) return null;
    
    return (
      <View style={styles.sortDropdownContainer}>
        <TouchableOpacity
          style={styles.sortDropdownBackdrop}
          activeOpacity={1}
          onPress={handleCloseSortDropdown}
        />
        <View style={styles.sortDropdown}>
          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.sortDropdownItem,
                sortBy === option.key && styles.sortDropdownActiveItem,
              ]}
              onPress={() => handleSortOptionSelect(option.key)}
            >
              <Text
                style={[
                  styles.sortDropdownText,
                  sortBy === option.key && styles.sortDropdownActiveText,
                ]}
              >
                {option.label}
              </Text>
              {sortBy === option.key && (
                <Check size={16} color="#1E40AF" style={{ marginLeft: 6 }} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }, [showSort, sortBy, SORT_OPTIONS, handleCloseSortDropdown, handleSortOptionSelect]);

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
    const specialistInitials = `${referral?.assignedSpecialistFirstName?.[0] || 'S'}${referral?.assignedSpecialistLastName?.[0] || 'P'}`;
    const referringDoctorName = (() => {
      // Handle both generalist and specialist referrals
      if (referral?.referringSpecialistId) {
        const name = `${referral?.referringSpecialistFirstName || ''} ${referral?.referringSpecialistLastName || ''}`.trim();
        return name || 'Unknown Specialist';
      } else if (referral?.referringGeneralistId) {
        const name = `${referral?.referringGeneralistFirstName || ''} ${referral?.referringGeneralistLastName || ''}`.trim();
        return name || 'Unknown Generalist';
      } else {
        return 'Unknown Doctor';
      }
    })();
    const resolvedSpecialty = (() => {
      if (referral?.assignedSpecialistId && specialistData[referral.assignedSpecialistId]) {
        const doc = specialistData[referral.assignedSpecialistId];
        return doc?.specialty || doc?.specialisation || doc?.specialization || referral?.specialty || 'General Medicine';
      }
      return referral?.specialty || 'General Medicine';
    })();

    return (
      <TouchableOpacity
        key={referralData.id}
        style={styles.referralCard}
        activeOpacity={0.8}
        onPress={() => router.push(`/referral-details?id=${appointment.relatedReferralId}`)}
      >
        <View style={styles.appointmentHeader}>
          <View style={styles.doctorInfo}>
            <View style={styles.doctorAvatar}>
              <Text style={styles.doctorInitial}>{specialistInitials}</Text>
            </View>
            <View style={styles.doctorDetails}>
              <Text style={styles.doctorName}>
                {specialistName ? `Dr. ${specialistName}` : 'Dr. Unknown'}
              </Text>
              <Text style={styles.doctorSpecialty}>{resolvedSpecialty}</Text>
            </View>
          </View>
          <View style={styles.appointmentHeaderRight}>
                         <View style={styles.statusBadge}>
               {getStatusIcon(referral?.status)}
               <Text style={styles.statusText}>
                 {capitalize(referral?.status || 'unknown')}
               </Text>
             </View>
          </View>
        </View>

        <View style={styles.appointmentMeta}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date & Time:</Text>
            <Text style={styles.metaValue}>
              {formatDisplayDate(referral?.appointmentDate || '')} at {formatDisplayTime(referral?.appointmentTime || '')}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Clinic:</Text>
            <Text style={styles.metaValue}>
              {(() => {
                const clinic = referral?.referringClinicId ? clinicData[referral.referringClinicId] : null;
                return clinic?.name || referral?.referringClinicName || 'Clinic not specified';
              })()}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Referred by:</Text>
            <Text style={styles.metaValue}>
              {referringDoctorName.includes('Unknown') ? referringDoctorName : `Dr. ${referringDoctorName}`}
            </Text>
          </View>
        </View>

        {referral?.initialReasonForReferral && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Reason:</Text>
            <Text style={styles.notesText}>{referral.initialReasonForReferral}</Text>
          </View>
        )}

        {/* Decline Reason for Cancelled Referrals */}
        {appointment.status === 'cancelled' && (
          <View style={styles.declineReasonSection}>
            <Text style={styles.declineReasonLabel}>Decline Reason:</Text>
            <Text style={styles.declineReasonText}>{appointment.declineReason}</Text>
          </View>
        )}

        {/* Feedback buttons for completed referrals */}
        {referral?.status === 'completed' && (
          <View style={styles.appointmentActions}>
            {(() => {
              const hasFeedback = existingReferralFeedback[referral.id!];

              return !hasFeedback ? (
                <View style={styles.completedActionsContainer}>
                  <TouchableOpacity
                    style={styles.followUpButton}
                    onPress={async () => {
                      // For referrals, we need to pass the specialist and clinic information
                      // Navigate directly to select-datetime with referral data for follow-up
                      const specialistId = referral.assignedSpecialistId;
                      const clinicId = referral.practiceLocation?.clinicId;
                      
                      if (!specialistId || !clinicId) {
                        Alert.alert('Error', 'Unable to book follow-up. Missing specialist or clinic information.');
                        return;
                      }
                      
                      try {
                        // Fetch specialist name from users node using assignedSpecialistId as single source of truth
                        const specialistData = await databaseService.getDocument(`users/${specialistId}`);
                        const specialistName = specialistData ? 
                          `${specialistData.firstName || specialistData.first_name || ''} ${specialistData.middleName || specialistData.middle_name || ''} ${specialistData.lastName || specialistData.last_name || ''}`.trim() :
                          'Unknown Specialist';
                        
                        router.push({
                          pathname: '/(patient)/book-visit/select-datetime',
                          params: {
                            doctorId: specialistId,
                            clinicId: clinicId,
                            clinicName: '', // Will be fetched from clinic data in select-datetime screen
                            doctorName: specialistName,
                            doctorSpecialty: 'Specialist Consultation', // Will be fetched from doctor data in select-datetime screen
                            isFollowUp: 'true',
                            originalAppointmentId: referral.id!,
                            isReferralFollowUp: 'true', // Flag to indicate this is a referral follow-up
                          }
                        });
                      } catch (error) {
                        console.error('Error fetching specialist data for follow-up:', error);
                        Alert.alert('Error', 'Unable to fetch specialist information. Please try again.');
                      }
                    }}
                  >
                    <Repeat size={16} color="#FFFFFF" />
                    <Text style={styles.followUpButtonText}>Follow-up</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      setFeedbackReferral(referral);
                      setFeedbackAppointment(null);
                      setFeedbackStars(0);
                      setFeedbackReason('');
                      setFeedbackSubmitted(false);
                      setShowFeedbackModal(true);
                    }}
                  >
                    <MessageCircle size={16} color="#1E40AF" />
                    <Text style={styles.secondaryButtonText}>Give Feedback</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.completedActionsContainer}>
                  <TouchableOpacity
                    style={styles.followUpButton}
                    onPress={async () => {
                      // For referrals, we need to pass the specialist and clinic information
                      // Navigate directly to select-datetime with referral data for follow-up
                      const specialistId = referral.assignedSpecialistId;
                      const clinicId = referral.practiceLocation?.clinicId;
                      
                      if (!specialistId || !clinicId) {
                        Alert.alert('Error', 'Unable to book follow-up. Missing specialist or clinic information.');
                        return;
                      }
                      
                      try {
                        // Fetch specialist name from users node using assignedSpecialistId as single source of truth
                        const specialistData = await databaseService.getDocument(`users/${specialistId}`);
                        const specialistName = specialistData ? 
                          `${specialistData.firstName || specialistData.first_name || ''} ${specialistData.middleName || specialistData.middle_name || ''} ${specialistData.lastName || specialistData.last_name || ''}`.trim() :
                          'Unknown Specialist';
                        
                        router.push({
                          pathname: '/(patient)/book-visit/select-datetime',
                          params: {
                            doctorId: specialistId,
                            clinicId: clinicId,
                            clinicName: '', // Will be fetched from clinic data in select-datetime screen
                            doctorName: specialistName,
                            doctorSpecialty: 'Specialist Consultation', // Will be fetched from doctor data in select-datetime screen
                            isFollowUp: 'true',
                            originalAppointmentId: referral.id!,
                            isReferralFollowUp: 'true', // Flag to indicate this is a referral follow-up
                          }
                        });
                      } catch (error) {
                        console.error('Error fetching specialist data for follow-up:', error);
                        Alert.alert('Error', 'Unable to fetch specialist information. Please try again.');
                      }
                    }}
                  >
                    <Repeat size={16} color="#FFFFFF" />
                    <Text style={styles.followUpButtonText}>Follow-up</Text>
                  </TouchableOpacity>
                  <View style={styles.feedbackSubmittedContainer}>
                    <MessageCircle size={16} color="#6B7280" />
                    <Text style={styles.feedbackSubmittedText}>Give Feedback</Text>
                  </View>
                </View>
              );
            })()}
          </View>
        )}

      </TouchableOpacity>
    );
  };

  // === Appointment Card ===
  const renderAppointmentCard = (appointment: Appointment) => {
    const isCompleted = appointment.status === 'completed';
    
    // Format date for display
    const formatDisplayDate = (dateString: string) => {
      if (!dateString) return 'Date not specified';
      try {
        // Parse the date string as local date to avoid timezone issues
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day); // month is 0-indexed
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

    // Get doctor data from fetched specialist data or fallback to appointment data
    const fetchedSpecialist = specialistData[appointment.doctorId];
    
    const doctorName = (() => {
      // First try appointment data
      if (appointment.doctorFirstName && appointment.doctorLastName) {
        return `${appointment.doctorFirstName} ${appointment.doctorLastName}`;
      }
      // Then try fetched specialist data
      if (fetchedSpecialist) {
        const firstName = fetchedSpecialist.firstName || fetchedSpecialist.first_name || '';
        const middleName = fetchedSpecialist.middleName || fetchedSpecialist.middle_name || '';
        const lastName = fetchedSpecialist.lastName || fetchedSpecialist.last_name || '';
        const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
        return fullName || 'Doctor not specified';
      }
      return 'Doctor not specified';
    })();
    
    const doctorSpecialty = (() => {
      // First try appointment data
      if (appointment.specialty) {
        return appointment.specialty;
      }
      // Then try fetched specialist data
      if (fetchedSpecialist?.specialty) {
        return fetchedSpecialist.specialty;
      }
      return 'General Medicine';
    })();
    
    const doctorInitials = (() => {
      // First try appointment data
      const firstName = appointment.doctorFirstName || '';
      const lastName = appointment.doctorLastName || '';
      if (firstName && lastName) {
        return `${firstName[0]}${lastName[0]}`.toUpperCase();
      }
      // Then try fetched specialist data
      if (fetchedSpecialist) {
        const firstName = fetchedSpecialist.firstName || fetchedSpecialist.first_name || '';
        const lastName = fetchedSpecialist.lastName || fetchedSpecialist.last_name || '';
        if (firstName && lastName) {
          return `${firstName[0]}${lastName[0]}`.toUpperCase();
        }
        if (firstName) {
          return firstName[0].toUpperCase();
        }
      }
      return 'DR';
    })();

    return (
      <TouchableOpacity
        key={appointment.id}
        style={styles.appointmentCard}
        activeOpacity={0.8}
        onPress={() => {
          if (appointment.type === 'specialist_referral') {
            // For specialist referrals, navigate to referral details
            console.log('🔍 Navigating to referral details for specialist referral:', appointment.id);
            router.push(`/(patient)/referral-details?id=${appointment.id}`);
          } else {
            // For regular appointments, navigate to visit overview
            console.log('🔍 Navigating to visit overview for regular appointment:', appointment.id);
            router.push(`/(patient)/visit-overview?id=${appointment.id}`);
          }
        }}
      >
        <View style={styles.appointmentHeader}>
          <View style={styles.doctorInfo}>
            <View style={styles.doctorAvatar}>
              <Text style={styles.doctorInitial}>
                {doctorInitials}
              </Text>
            </View>
            <View style={styles.doctorDetails}>
              <Text style={styles.doctorName}>
                {doctorName ? `Dr. ${doctorName}` : 'Dr. Unknown'}
              </Text>
              <Text style={styles.doctorSpecialty}>
                {doctorSpecialty}
              </Text>
            </View>
          </View>
          <View style={styles.appointmentHeaderRight}>
                         <View style={styles.statusBadge}>
               {getStatusIcon(appointment.status)}
               <Text style={styles.statusText}>
                 {capitalize(appointment.status)}
               </Text>
             </View>
          </View>
        </View>

        <View style={styles.appointmentMeta}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date & Time:</Text>
            <Text style={styles.metaValue}>
              {formatDisplayDate(appointment.appointmentDate)} at {formatDisplayTime(appointment.appointmentTime)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Clinic:</Text>
            <Text style={styles.metaValue}>
              {(() => {
                const clinic = appointment.clinicId ? clinicData[appointment.clinicId] : null;
                return clinic?.name || appointment.clinicName || 'Clinic not available';
              })()}
            </Text>
          </View>
        </View>

        {/* Purpose (same style as referral reason) */}
        {(appointment.appointmentPurpose || appointment.type === 'walk-in') && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Purpose:</Text>
            <Text style={styles.notesText}>
              {appointment.appointmentPurpose || (appointment.type === 'walk-in' ? 'Walk In' : '')}
            </Text>
          </View>
        )}
        {getChiefComplaint(appointment) && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Additional Notes:</Text>
            <Text style={styles.notesText}>{getChiefComplaint(appointment)}</Text>
          </View>
        )}

        <View style={styles.appointmentActions}>
          {(() => {
            if (!isCompleted) return null;
            const hasFeedback = existingFeedback[appointment.id!];

            return !hasFeedback ? (
              <View style={styles.completedActionsContainer}>
                <TouchableOpacity
                  style={styles.followUpButton}
                  onPress={() => {
                    handleFollowUp(appointment);
                  }}
                >
                    <Repeat size={16} color="#FFFFFF" />
                    <Text style={styles.followUpButtonText}>Follow-up</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setFeedbackAppointment(appointment);
                    setFeedbackStars(0);
                    setFeedbackReason('');
                    setFeedbackSubmitted(false);
                    setShowFeedbackModal(true);
                  }}
                >
                  <MessageCircle size={16} color="#1E40AF" />
                  <Text style={styles.secondaryButtonText}>Give Feedback</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.completedActionsContainer}>
                <TouchableOpacity
                  style={styles.followUpButton}
                  onPress={() => {
                    handleFollowUp(appointment);
                  }}
                >
                    <Repeat size={16} color="#FFFFFF" />
                    <Text style={styles.followUpButtonText}>Follow-up</Text>
                </TouchableOpacity>
                <View style={styles.feedbackSubmittedContainer}>
                  <MessageCircle size={16} color="#6B7280" />
                  <Text style={styles.feedbackSubmittedText}>Give Feedback</Text>
                </View>
              </View>
            );
          })()}
        </View>
      </TouchableOpacity>
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
    if (!feedbackAppointment && !feedbackReferral) return null;

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
              <Text style={styles.modalTitle}>Give Rating</Text>
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
              
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>
                  Select tags that describe your experience
                </Text>
                <View style={styles.tagsContainer}>
                  {availableTags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        styles.tagButton,
                        selectedTags.includes(tag) && styles.tagButtonSelected
                      ]}
                      onPress={() => handleTagToggle(tag)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.tagText,
                        selectedTags.includes(tag) && styles.tagTextSelected
                      ]}>
                        {tag.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
      (!feedbackStars || selectedTags.length === 0 || feedbackSubmitted || submittingFeedback) && { opacity: 0.5 },
    ]}
    disabled={!feedbackStars || selectedTags.length === 0 || feedbackSubmitted || submittingFeedback}
    onPress={handleSubmitFeedback}
  >
    <Text style={styles.feedbackModalButtonText}>
      {submittingFeedback ? 'Submitting...' : 'Submit Rating'}
    </Text>
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
        <Text style={styles.headerTitle}>Visits</Text>
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
            <Text style={styles.profileInitialsText}>{userInitials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filtersContainer}>
        <View style={styles.searchRow}>
          <View style={[
            styles.searchInputContainer,
            isSearchFocused && styles.searchInputContainerFocused
          ]}>
            <Search size={18} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search appointments"
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              returnKeyType="search"
              blurOnSubmit={true}
              onSubmitEditing={() => {
                // Dismiss keyboard when search is submitted
                setIsSearchFocused(false);
              }}
            />
            {searchQuery.trim() && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearSearchIcon}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={handleShowSort}
          >
            <View style={styles.sortButtonContainer}>
              <Filter size={18} color="#6B7280" />
              <ChevronDown size={16} color="#6B7280" />
            </View>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {filters.map((filter) => {
            const getFilterIcon = (filterName: string) => {
              switch (filterName.toLowerCase()) {
                case 'all':
                  return <Search size={14} color={activeFilter === filter ? "#FFFFFF" : "#6B7280"} />;
                case 'pending':
                  return <Hourglass size={14} color={activeFilter === filter ? "#FFFFFF" : "#6B7280"} />;
                case 'confirmed':
                  return <CheckCircle size={14} color={activeFilter === filter ? "#FFFFFF" : "#6B7280"} />;
                case 'completed':
                  return <Check size={14} color={activeFilter === filter ? "#FFFFFF" : "#6B7280"} />;
                case 'cancelled':
                  return <X size={14} color={activeFilter === filter ? "#FFFFFF" : "#6B7280"} />;
                default:
                  return null;
              }
            };

            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterButton, activeFilter === filter && styles.activeFilterButton]}
                onPress={() => setActiveFilter(filter)}
              >
                {getFilterIcon(filter)}
                <Text style={[styles.filterText, activeFilter === filter && styles.activeFilterText]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {renderSortDropdown()}
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
                 {searchQuery.trim() 
                   ? `No appointments found for "${searchQuery}"`
                   : `No ${activeFilter.toLowerCase()} appointments found`
                 }
               </Text>
               {activeFilter === 'All' && !searchQuery.trim() && (
                 <TouchableOpacity
                   style={styles.addAppointmentButton}
                   onPress={() => router.push('/(patient)/book-visit')}
                 >
                   <Text style={styles.addAppointmentButtonText}>Book Your First Appointment</Text>
                 </TouchableOpacity>
               )}
               {searchQuery.trim() && (
                 <TouchableOpacity
                   style={styles.clearSearchButton}
                   onPress={() => setSearchQuery('')}
                 >
                   <Text style={styles.clearSearchButtonText}>Clear Search</Text>
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
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  profileInitialsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
    paddingTop: 0,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 0,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 64,
  },
  searchInputContainerFocused: {
    borderColor: '#1E40AF',
    backgroundColor: '#FFFFFF',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    paddingVertical: 0,
  },
  clearSearchIcon: {
    padding: 4,
    marginLeft: 8,
  },
  filtersContent: {
    paddingHorizontal: 24,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
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
    gap: 4,
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
    fontFamily: 'Inter-Medium',
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
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  outlinedButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  // Follow-up button (Primary)
  followUpButton: {
    backgroundColor: '#1E40AF',
    borderWidth: 1.5,
    borderColor: '#1E40AF',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  followUpButtonText: {
    color: '#FFFFFF',
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
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#1E40AF',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryButtonText: {
    color: '#1E40AF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  // Appointment Meta Section
  appointmentMeta: {
    marginBottom: 8,
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
  metaLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    flex: 1,
  },
  metaValue: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'right',
    flex: 1,
  },
  // Notes Section
  notesSection: {
    marginBottom: 16,

  },
  notesLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'left',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 40,
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
  clearSearchButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  clearSearchButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
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
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  completedActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    gap: 12,
  },
  feedbackSubmittedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 6,
  },
  feedbackSubmittedText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter-SemiBold',
  },
  // Tag selection styles
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tagButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tagButtonSelected: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  tagText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Medium',
  },
  tagTextSelected: {
    color: '#FFFFFF',
  },
  // Sort button and dropdown styles
  sortButton: {
    height: 64, // Match search bar height
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -4 }], // Move up 2 pixels - more responsive than margin
  },
  sortButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
    minHeight: 64, // Increased from 36 to 48
  },
  sortDropdownContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  sortDropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  sortDropdown: {
    position: 'absolute',
    top: 90, // Adjust based on header height
    right: 24,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  sortDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sortDropdownActiveItem: {
    backgroundColor: '#F3F4F6',
  },
  sortDropdownText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter-Regular',
  },
  sortDropdownActiveText: {
    color: '#1E40AF',
    fontFamily: 'Inter-Medium',
  },
});