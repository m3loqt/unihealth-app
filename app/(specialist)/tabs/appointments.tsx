import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Filter,
  Plus,
  Eye,
  Bell,
  RefreshCw,
  Trash2,
} from 'lucide-react-native';

import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { useRealtimeNotificationContext } from '../../../src/contexts/RealtimeNotificationContext';
import { useSpecialistAppointments, useReferrals } from '../../../src/hooks/data';
import { getSafeNotifications, getSafeUnreadCount } from '../../../src/utils/notificationUtils';
import { databaseService, Appointment, MedicalHistory } from '../../../src/services/database/firebase';
import { safeDataAccess } from '../../../src/utils/safeDataAccess';
import LoadingState from '../../../src/components/ui/LoadingState';
import ErrorBoundary from '../../../src/components/ui/ErrorBoundary';
import { dataValidation } from '../../../src/utils/dataValidation';
import { useDeepMemo } from '../../../src/utils/performance';
import SpecialistHeader from '../../../src/components/navigation/SpecialistHeader';
import { AppointmentDetailsModal } from '../../../src/components';
import { GlobalNotificationModal } from '../../../src/components/shared';

export default function SpecialistAppointmentsScreen() {
  const { filter, search } = useLocalSearchParams();
  const { user } = useAuth();
  const { 
    notifications: realtimeNotificationData,
  } = useRealtimeNotificationContext();
  
  // Safely extract notifications and unread count
  const notifications = getSafeNotifications(realtimeNotificationData.notifications);
  const unreadCount = getSafeUnreadCount(realtimeNotificationData.unreadCount);
  const notificationsLoading = realtimeNotificationData.loading;
  const notificationsError = realtimeNotificationData.error;
  const markAsRead = realtimeNotificationData.markAsRead;
  const markAllAsRead = realtimeNotificationData.markAllAsRead;
  const deleteNotification = realtimeNotificationData.deleteNotification;
  const refreshNotifications = realtimeNotificationData.refresh;
  
  // Debug log to check notification count
  console.log('🔔 Appointments page - unreadCount:', unreadCount);
  const { 
    appointments: hookAppointments, 
    loading: hookLoading, 
    error: hookError, 
    refresh: hookRefresh 
  } = useSpecialistAppointments();
  const { 
    referrals: hookReferrals, 
    loading: referralsLoading, 
    error: referralsError, 
    refresh: referralsRefresh 
  } = useReferrals();
  const filters = ['All', 'Pending', 'Confirmed', 'Completed', 'Cancelled'];

  // Use hook data instead of manual state
  const [refreshing, setRefreshing] = useState(false);
  
  // Convert referrals to appointments format for display
  const referralAppointments = useDeepMemo(() => {
    return hookReferrals.map(referral => ({
      id: referral.id,
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
      appointmentPurpose: referral.initialReasonForReferral,
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
        } else if (status === 'confirmed') {
          return 'confirmed';
        } else if (status === 'completed') {
          return 'completed';
        } else if (status === 'cancelled') {
          return 'cancelled';
        } else {
          console.log('Unknown referral status, defaulting to cancelled:', status);
          return 'cancelled';
        }
      })(),
      type: 'Referral'
    } as Appointment));
  }, [hookReferrals]);
  
  // Combine appointments from hook with referral appointments, removing duplicates
  const appointments = useDeepMemo(() => {
    const combined = [...hookAppointments, ...referralAppointments];
    // Remove duplicates based on ID to prevent duplicate keys
    const uniqueAppointments = combined.filter((appointment, index, self) => 
      index === self.findIndex(a => a.id === appointment.id)
    );
    return uniqueAppointments;
  }, [hookAppointments, referralAppointments]);
  const loading = hookLoading || referralsLoading;
  const error = hookError || referralsError;
  
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
    filter ? String(filter).charAt(0).toUpperCase() + String(filter).slice(1) : 'Confirmed'
  );
  
  // Sort functionality
  const [sortBy, setSortBy] = useState('date-newest');
  const [showSort, setShowSort] = useState(false);
  
  // Memoized sort options
  const SORT_OPTIONS = useMemo(() => [
    { key: 'date-newest', label: 'Latest Appointment' },
    { key: 'date-oldest', label: 'Oldest Appointment' },
    { key: 'patient-az', label: 'Patient A-Z' },
    { key: 'patient-za', label: 'Patient Z-A' },
    // { key: 'status', label: 'By Status' },
  ], []);

  // Accept/Decline Modals for Referrals
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // Decline reason dropdown
  const [showReasonDropdown, setShowReasonDropdown] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  // Notification Modal State
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  
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





  // Unified Appointment Details Modal State
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [modalAppointment, setModalAppointment] = useState<Appointment | null>(null);
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory | null>(null);
  const [loadingMedicalHistory, setLoadingMedicalHistory] = useState(false);

  const handleRetry = () => {
    // The hook handles error state, just trigger a refresh
    hookRefresh();
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

  // Handle search parameter from URL
  useEffect(() => {
    if (search) {
      setSearchQuery(String(search));
    }
  }, [search]);

  // Real-time updates are handled by both useSpecialistAppointments and useReferrals hooks

  // Load referrals for appointments that have relatedReferralId
  useEffect(() => {
    appointments.forEach(appointment => {
            const referralId = appointment.relatedReferralId ||
        (appointment.type === 'Referral' ? appointment.id : null);
      if (referralId && !referrals[referralId]) {
        loadReferral(referralId);
      }
    });
  }, [appointments]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Refresh both appointments and referrals via their respective hooks
    await Promise.all([
      hookRefresh(),
      referralsRefresh()
    ]);
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
          const clinic = await databaseService.getClinicByIdForDisplay(referral.referringClinicId);
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
      // If this is a referral, only update the referral status
      if (isReferral(selectedAppointment) && selectedAppointment.relatedReferralId) {
        await databaseService.updateReferralStatus(selectedAppointment.relatedReferralId, 'confirmed');
      } else {
        // If it's a regular appointment, update the appointment status
        await databaseService.updateAppointmentStatus(selectedAppointment.id, 'confirmed');
      }
      
      Alert.alert('Success', 'Referral confirmed successfully!');
      setShowAcceptModal(false);
      setSelectedAppointment(null);
      // Real-time updates will handle the refresh automatically
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
      // If this is a referral, only update the referral status
      if (isReferral(selectedAppointment) && selectedAppointment.relatedReferralId) {
        await databaseService.updateReferralStatus(selectedAppointment.relatedReferralId, 'cancelled', finalReason);
      } else {
        // If it's a regular appointment, update the appointment status
        await databaseService.updateAppointmentStatus(selectedAppointment.id, 'cancelled', finalReason);
      }
      
      Alert.alert('Success', 'Referral declined successfully!');
      setShowDeclineModal(false);
      setSelectedAppointment(null);
      setDeclineReason('');
      setCustomReason('');
      // Real-time updates will handle the refresh automatically
    } catch (error) {
      console.error('Error declining referral:', error);
      Alert.alert('Error', 'Failed to decline referral. Please try again.');
    }
  };

  const handleDiagnosePatient = async (appointment: Appointment) => {
    let referralId = null;
    
    // Check if this is a referral appointment and fetch the referralId
    if (appointment.relatedReferralId || appointment.type === 'Referral') {
              referralId = appointment.relatedReferralId || appointment.id;
      
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
    console.log('🔍 NAVIGATING TO REFERRAL DETAILS!');
    console.log('Referral data:', referralData);
    console.log('Referral ID:', referralData.referral?.id || referralData.appointment?.relatedReferralId);
    
    // Navigate to the new referral details screen
    router.push({
      pathname: '/referral-details',
      params: {
        id: referralData.referral?.id || referralData.appointment?.relatedReferralId,
      }
    });
  };

  const handleViewFollowUpDetails = async (appointment: Appointment) => {
    console.log('🔍 NAVIGATING TO FOLLOW-UP DETAILS!');
    console.log('Follow-up appointment:', appointment);
    
    // Navigate to referral details screen with follow-up flag
    router.push({
      pathname: '/referral-details',
      params: {
        id: appointment.id,
        isFollowUp: 'true',
        appointmentId: appointment.id,
        patientId: appointment.patientId,
      }
    });
  };

  const handleReferPatient = (appointmentOrReferral: any) => {
    console.log('🔍 HANDLING REFER PATIENT:', appointmentOrReferral);
    
    // Navigate to clinic selection for specialists
    router.push({
      pathname: '/(specialist)/book-visit',
      params: {
        patientId: appointmentOrReferral.patientId,
        patientFirstName: appointmentOrReferral.patientFirstName,
        patientLastName: appointmentOrReferral.patientLastName,
        originalAppointmentId: appointmentOrReferral.id,
        isReferral: 'true',
        reasonForReferral: appointmentOrReferral.initialReasonForReferral || appointmentOrReferral.appointmentPurpose || 'Specialist referral',
      }
    });
  };

  // --- LOAD APPOINTMENT DETAILS AND MEDICAL HISTORY ---
  const loadAppointmentDetails = async (appointment: Appointment) => {
    if (!appointment.patientId) {
      Alert.alert('Error', 'No patient ID found.');
      return;
    }

    try {
      setModalAppointment(appointment);
      setShowAppointmentModal(true);
      setLoadingMedicalHistory(true);
      
      // Load clinic and patient data if not already loaded
      if (appointment.clinicId && !clinicData[appointment.clinicId]) {
        try {
          const clinic = await databaseService.getClinicByIdForDisplay(appointment.clinicId);
          setClinicData(prev => ({ ...prev, [appointment.clinicId]: clinic }));
        } catch (error) {
          console.error('Error loading clinic data:', error);
        }
      }

      if (appointment.patientId && !patientData[appointment.patientId]) {
        try {
          const patient = await databaseService.getPatientById(appointment.patientId);
          setPatientData(prev => ({ ...prev, [appointment.patientId]: patient }));
        } catch (error) {
          console.error('Error loading patient data:', error);
        }
      }

      // Load medical history if appointment has consultation data
      if (appointment.appointmentConsultationId) {
        try {
          const history = await databaseService.getMedicalHistoryByAppointment(
            appointment.id,
            appointment.patientId
          );
          setMedicalHistory(history);
        } catch (error) {
          console.error('Error loading medical history:', error);
          setMedicalHistory(null);
        }
      } else {
        setMedicalHistory(null);
      }
    } catch (error) {
      console.error('Error loading appointment details:', error);
      Alert.alert('Error', 'Failed to load appointment details. Please try again.');
    } finally {
      setLoadingMedicalHistory(false);
    }
  };

  // --- START CONSULTATION FROM MODAL ---
  const handleStartConsultation = (appointment: Appointment) => {
    // Close the modal first
    setShowAppointmentModal(false);
    setModalAppointment(null);
    setMedicalHistory(null);
    
    // Then navigate to consultation
    handleDiagnosePatient(appointment);
  };

  // ---- FILTER AND SORT ----
  const filteredAppointments = useDeepMemo(() => {
    const filtered = appointments.filter((appointment) => {
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
      } else if (activeFilter === 'Cancelled') {
        matchesFilter = appointment.status === 'cancelled';
      } else {
        matchesFilter = appointment.status === activeFilter.toLowerCase();
      }
      
      return matchesSearch && matchesFilter;
    });

    // Apply sorting
    const sortData = filtered.map(appointment => {
      const patientName = `${appointment.patientFirstName} ${appointment.patientLastName}`.toLowerCase();
      const appointmentDate = new Date(appointment.appointmentDate || '').getTime() || 0;
      
      switch (sortBy) {
        case 'date-newest':
        case 'date-oldest':
          return {
            appointment,
            sortValue: appointmentDate
          };
        case 'patient-az':
        case 'patient-za':
          return {
            appointment,
            sortValue: patientName
          };
        case 'status':
          return {
            appointment,
            sortValue: appointment.status
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
        case 'patient-az':
          return (a.sortValue as string).localeCompare(b.sortValue as string); // A-Z
        case 'patient-za':
          return (b.sortValue as string).localeCompare(a.sortValue as string); // Z-A
        case 'status':
          return (a.sortValue as string).localeCompare(b.sortValue as string); // Status A-Z
        default:
          return 0;
      }
    });

    return sortData.map(item => item.appointment);
  }, [appointments, searchQuery, activeFilter, sortBy]);

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
        } else if (activeFilter === 'Cancelled') {
          matchesFilter = appointment.status === 'cancelled';
        } else {
          matchesFilter = appointment.status === activeFilter.toLowerCase();
        }
        
        // Only include referral cards that match the current filter and search
        if (matchesSearch && matchesFilter) {
          const referralId = appointment.relatedReferralId || appointment.id;
          const referral = referralId ? referrals[referralId] : null;
          const isLoading = referralId ? loadingReferrals[referralId] : false;
        
        referralCards.push({
            id: `referral-${appointment.id || referralId}`, // Prefix with 'referral-' to ensure unique keys
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
    // Monotone neutral status icons (match patient UI)
    const s = (status || '').toLowerCase();
    if (s === 'confirmed') return <CheckCircle size={14} color="#6B7280" />;
    if (s === 'pending' || s === 'pending_acceptance') return <Hourglass size={14} color="#6B7280" />;
    if (s === 'completed') return <Check size={14} color="#6B7280" />;
    if (s === 'cancelled' || s === 'canceled') return <XCircle size={14} color="#6B7280" />;
    return <Hourglass size={14} color="#6B7280" />;
  };

  const getStatusBadgeStyle = (_status: string) => styles.statusBadge;

  const getReferralStatusBadgeStyle = (_status: string) => styles.statusBadge;

  const getReferralStatusTextStyle = (_status: string) => styles.statusText;

  const getStatusTextStyle = (_status: string) => styles.statusText;

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

    // Actions for referrals are moved to referral details screen
    const patientName = `${appointment.patientFirstName} ${appointment.patientLastName}`;
    const patientInitials = `${appointment.patientFirstName?.[0] || ''}${appointment.patientLastName?.[0] || ''}`;

    return (
      <TouchableOpacity 
        key={referralData.id} 
        style={styles.referralCard}
        onPress={() => handleViewReferralDetails(referralData)}
        activeOpacity={0.7}
      >
        <View style={styles.referralCardHeader}>
          <View style={styles.referralCardHeaderLeft}>
            {/* Patient Initials Avatar */}
            <View style={styles.patientAvatar}>
              <Text style={styles.patientInitial}>
                {patientInitials}
              </Text>
            </View>
          </View>
          <View style={styles.referralCardDetails}>
            <Text style={styles.referralCardTitle}>Referral Request</Text>
            <Text style={styles.referralCardSubtitle}>
              {patientName}
            </Text>
          </View>
          <View style={getReferralStatusBadgeStyle(appointment.status)}>
            {getStatusIcon(appointment.status)}
            <Text style={getReferralStatusTextStyle(appointment.status)}>
              {appointment.status === 'confirmed' ? 'Confirmed' :
               appointment.status === 'pending' || appointment.status === 'pending_acceptance' ? 'Pending' :
               appointment.status === 'completed' ? 'Completed' :
               appointment.status === 'cancelled' ? 'Cancelled' : 'Unknown'}
            </Text>
          </View>
        </View>

        <View style={styles.appointmentMeta}>
          <View style={styles.subtleDividerLight} />
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date:</Text>
            <Text style={styles.metaValue}>
              {formatDisplayDate(referral?.appointmentDate || '')}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Time:</Text>
            <Text style={styles.metaValue}>
              {formatDisplayTime(referral?.appointmentTime || '')}
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
              {(() => {
                // Handle both generalist and specialist referrals
                if (referral?.referringSpecialistId) {
                  const name = `${referral?.referringSpecialistFirstName || ''} ${referral?.referringSpecialistLastName || ''}`.trim();
                  return name ? `Dr. ${name}` : 'Unknown Specialist';
                } else if (referral?.referringGeneralistId) {
                  const name = `${referral?.referringGeneralistFirstName || ''} ${referral?.referringGeneralistLastName || ''}`.trim();
                  return name ? `Dr. ${name}` : 'Unknown Generalist';
                } else {
                  return 'Unknown Doctor';
                }
              })()}
            </Text>
          </View>
        </View>

        {referral?.initialReasonForReferral && (
          <View style={[styles.notesSection, { marginBottom: 10 }]}>
            <Text style={styles.notesLabel}>Reason:</Text>
            <Text style={styles.notesText}>{referral.initialReasonForReferral}</Text>
          </View>
        )}

        {/* Refer Button for Completed Referrals */}
        {appointment.status === 'completed' && (
          <View style={styles.appointmentActions}>
            <TouchableOpacity
              style={styles.referButton}
              onPress={(e) => {
                e.stopPropagation(); // Prevent card click
                handleReferPatient(referral);
              }}
            >
              <Stethoscope size={16} color="#FFFFFF" />
              <Text style={styles.referButtonText}>Refer</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // === Regular Appointment Card ===
  const renderAppointmentCard = (appointment: Appointment) => {
    const isPending = appointment.status === 'pending';
    const isReferralAppointment = isReferral(appointment);
    const isFollowUpAppointment = appointment.isReferralFollowUp === true || 
      appointment.appointmentPurpose?.toLowerCase().includes('follow-up') ||
      appointment.appointmentPurpose?.toLowerCase().includes('followup');
    
    // Debug logging for follow-up detection
    console.log('🔍 Appointment follow-up detection:', {
      appointmentId: appointment.id,
      isReferralFollowUp: appointment.isReferralFollowUp,
      isFollowUpAppointment,
      appointmentPurpose: appointment.appointmentPurpose,
      additionalNotes: appointment.additionalNotes,
      type: appointment.type
    });
    
    const patientName = safeDataAccess.getAppointmentPatientName(appointment, 'Unknown Patient');
    const patientInitials = (() => {
      const firstName = appointment.patientFirstName || '';
      const lastName = appointment.patientLastName || '';
      if (firstName && lastName) {
        return `${firstName[0]}${lastName[0]}`.toUpperCase();
      }
      if (firstName) {
        return firstName[0].toUpperCase();
      }
      return 'U';
    })();

    // Format date for display
    const formatDisplayDate = (dateString: string) => {
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
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

    return (
      <TouchableOpacity 
        key={appointment.id} 
        style={styles.appointmentCard}
        onPress={() => {
          // Handle card click for viewing appointment details
          if (appointment.status === 'completed') {
            loadAppointmentDetails(appointment);
          } else if (appointment.status === 'confirmed') {
            if (isFollowUpAppointment) {
              handleViewFollowUpDetails(appointment);
            } else {
            handleDiagnosePatient(appointment);
            }
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.appointmentHeader}>
          <View style={styles.patientInfo}>
            <View style={styles.patientAvatar}>
              <Text style={styles.patientInitial}>
                {patientInitials}
              </Text>
            </View>
            <View style={styles.appointmentDetails}>
              {isFollowUpAppointment ? (
                <Text style={styles.patientName}>Follow-up Request</Text>
              ) : (
              <Text style={styles.patientName}>{patientName}</Text>
              )}
              {isReferralAppointment ? (
                <View style={styles.referralBadge}>
                  <FileText size={12} color="#1E40AF" />
                  <Text style={styles.referralText}>Referral</Text>
                </View>
              ) : isFollowUpAppointment ? (
                <Text style={styles.referredBy}>{patientName}</Text>
              ) : (
                <Text style={styles.referredBy}>Referred by Dr. {(() => {
                  // For follow-up appointments, show the original referring generalist
                  if (appointment.isReferralFollowUp && appointment.originalReferringGeneralistFirstName && appointment.originalReferringGeneralistLastName) {
                    return `${appointment.originalReferringGeneralistFirstName} ${appointment.originalReferringGeneralistLastName}`.trim();
                  }
                  // For regular appointments, show the current doctor
                  return appointment.doctorFirstName || appointment.doctorLastName 
                    ? `${appointment.doctorFirstName || ''} ${appointment.doctorLastName || ''}`.trim()
                    : 'Unknown Doctor';
                })()}</Text>
              )}
            </View>
          </View>
          <View style={getStatusBadgeStyle(appointment.status)}>
            {getStatusIcon(appointment.status)}
            <Text style={getStatusTextStyle(appointment.status)}>
              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
            </Text>
          </View>
        </View>

        {isFollowUpAppointment ? (
          // Follow-up appointment layout (label on left, value on right) - match referral format
          <View style={[styles.appointmentMeta, { marginBottom: 8 }]}>
            <View style={styles.subtleDividerLight} />
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date:</Text>
              <Text style={styles.metaValue}>
                {formatDisplayDate(appointment.appointmentDate || '')}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Time:</Text>
              <Text style={styles.metaValue}>
                {formatDisplayTime(appointment.appointmentTime || '')}
              </Text>
            </View>
          </View>
        ) : (
          // Regular appointment layout (icon on left, text on right)
        <View style={styles.appointmentMeta}>
          <View style={styles.metaRow}>
            <Clock size={16} color="#6B7280" />
            <Text style={styles.metaText}>
                {formatDisplayDate(appointment.appointmentDate || '')} at {formatDisplayTime(appointment.appointmentTime || '')}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <MapPin size={16} color="#6B7280" />
            <Text style={styles.metaText}>
              {(() => {
                const clinic = appointment.clinicId ? clinicData[appointment.clinicId] : null;
                return clinic?.name || appointment.clinicName || 'Clinic not specified';
              })()}
            </Text>
          </View>
        </View>
        )}

        {isFollowUpAppointment ? (
          // For follow-up appointments, show additional notes exactly like Reason field
          <View style={[styles.notesSection, { marginBottom: 10 }]}>
            <Text style={styles.notesLabel}>Additional Notes:</Text>
            <Text style={styles.notesText}>
              {appointment.additionalNotes && appointment.additionalNotes.trim() !== '' 
                ? appointment.additionalNotes 
                : 'No additional notes'}
            </Text>
          </View>
        ) : (
          // For regular appointments, show purpose and notes as before
          <>
        {appointment.appointmentPurpose && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Purpose:</Text>
            <Text style={styles.notesText}>{appointment.appointmentPurpose}</Text>
          </View>
        )}

        {appointment.additionalNotes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes:</Text>
            <Text style={styles.notesText}>{appointment.additionalNotes}</Text>
          </View>
            )}
          </>
        )}

        {appointment.status === 'cancelled' && (
          <View style={styles.declineReasonSection}>
            <Text style={styles.declineReasonLabel}>Decline Reason:</Text>
            <Text style={styles.declineReasonText}>Appointment was declined</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={[styles.appointmentActions, { marginTop: 12 }]}>
          {isPending && !isReferralAppointment ? (
            // Regular pending appointment - show accept/deny buttons
            <>
              <TouchableOpacity
                style={styles.declineButton}
                onPress={(e) => {
                  e.stopPropagation(); // Prevent card click
                  handleDeclineAppointment(appointment);
                }}
              >
                <X size={16} color="#EF4444" />
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={(e) => {
                  e.stopPropagation(); // Prevent card click
                  handleAcceptAppointment(appointment);
                }}
              >
                <Check size={16} color="#FFFFFF" />
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            </>
          ) : appointment.status === 'completed' && !isReferralAppointment ? (
            // Completed regular appointment - show refer button
            <TouchableOpacity
              style={styles.referButton}
              onPress={(e) => {
                e.stopPropagation(); // Prevent card click
                handleReferPatient(appointment);
              }}
            >
              <Stethoscope size={16} color="#FFFFFF" />
              <Text style={styles.referButtonText}>Refer</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
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
      Alert.alert('Success', 'Appointment confirmed successfully!');
      setShowAcceptModal(false);
      setSelectedAppointment(null);
      // Real-time updates will handle the refresh automatically
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
              await databaseService.updateAppointmentStatus(selectedAppointment.id, 'cancelled', finalReason);
      Alert.alert('Success', 'Appointment declined successfully!');
      setShowDeclineModal(false);
      setSelectedAppointment(null);
      setDeclineReason('');
      setCustomReason('');
      // Real-time updates will handle the refresh automatically
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


  // Unified Appointment Details Modal
  // Sort dropdown render function
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

  const renderAppointmentDetailsModal = () => {
    if (!modalAppointment) return null;
    
    return (
      <AppointmentDetailsModal
        visible={showAppointmentModal}
        onClose={() => {
          setShowAppointmentModal(false);
          setModalAppointment(null);
          setMedicalHistory(null);
        }}
        appointment={modalAppointment}
        medicalHistory={medicalHistory}
        loadingMedicalHistory={loadingMedicalHistory}
        clinicData={clinicData[modalAppointment.clinicId]}
        doctorData={patientData[modalAppointment.patientId]}
        isSpecialist={true}
        onStartConsultation={handleStartConsultation}
      />
    );
  };





  // ---- RENDER ----
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* Header */}
      <SpecialistHeader 
        title="Appointments" 
        onNotificationPress={handleOpenNotifications}
        notificationCount={unreadCount}
      />

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
        <TouchableOpacity
          style={styles.sortButton}
          onPress={handleShowSort}
        >
          <Filter size={22} color="#6B7280" />
          <ChevronDown size={20} color="#6B7280" />
        </TouchableOpacity>
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
      {renderSortDropdown()}

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
      {renderAppointmentDetailsModal()}
      
      {/* === GLOBAL NOTIFICATION MODAL === */}
      <GlobalNotificationModal
        visible={showNotificationModal}
        onClose={handleCloseNotificationModal}
        userRole="specialist"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
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
  metaRowNoBorder: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 7,
  },
  metaText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
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
  notesSection: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginBottom: -12,
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
  referButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  referButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  diagnoseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
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
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  referralText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#2563EB',
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
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  medicalHistoryButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
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
  subtleDividerLight: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
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
  statusBadgeConfirmed: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
  },
  statusBadgePending: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
  },
  statusBadgeCompleted: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
  },
  statusBadgeCanceled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
  },
  referralStatusBadgeConfirmed: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
  },
  referralStatusBadgeCompleted: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
  },
  referralStatusBadgeCanceled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
  },
  referralStatusTextConfirmed: {
    color: '#374151',
  },
  referralStatusTextCompleted: {
    color: '#374151',
  },
  referralStatusTextCanceled: {
    color: '#374151',
  },
  statusTextConfirmed: {
    color: '#374151',
  },
  statusTextPending: {
    color: '#374151',
  },
  statusTextCompleted: {
    color: '#374151',
  },
  statusTextCanceled: {
    color: '#374151',
  },
  // Sort button and dropdown styles
  sortButton: {
    height: 48, // Match search bar height
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    gap: 4,
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
    borderRadius: 12,
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

