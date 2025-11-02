import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Image,
  Alert,
  RefreshControl,
  Modal,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Settings,
  LogOut,
  Edit,
  Building,
  Bell,
  RefreshCw,
  Check,
  Trash2,
  DoorOpen,
  Lock,
  HelpCircle,
  BookOpen,
  CheckCircle,
  Clock,
  XCircle,
  Pill,
  DollarSign,
  TrendingUp,
  Users,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { useSpecialistProfile } from '../../../src/hooks/data/useSpecialistProfile';
import { useSpecialistEarnings } from '../../../src/hooks/data/useSpecialistEarnings';
import { useRealtimeNotificationContext } from '../../../src/contexts/RealtimeNotificationContext';
import { getSafeNotifications, getSafeUnreadCount } from '../../../src/utils/notificationUtils';
import { databaseService } from '../../../src/services/database/firebase';
import { Input, Dropdown, DatePicker } from '../../../src/components/ui/Input';
import { safeDataAccess } from '../../../src/utils/safeDataAccess';
import LoadingState from '../../../src/components/ui/LoadingState';
import ErrorBoundary from '../../../src/components/ui/ErrorBoundary';
import { dataValidation } from '../../../src/utils/dataValidation';
import { performanceUtils } from '../../../src/utils/performance';
import SpecialistHeader from '../../../src/components/navigation/SpecialistHeader';
import { GlobalNotificationModal } from '../../../src/components/shared';

export default function SpecialistProfileScreen() {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, error: profileError, updateProfile } = useSpecialistProfile();
  const { earnings, refreshEarnings } = useSpecialistEarnings();
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
  // const refreshNotifications = realtimeNotificationData.refresh;
  // const handleNotificationPress = realtimeNotificationData.handleNotificationPress || (() => {});


  // Helper function to format date safely (avoiding timezone issues)
  const formatDateSafely = (dateString: string): string => {
    if (!dateString) return '';
    
    // Parse YYYY-MM-DD format without timezone conversion
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const day = parseInt(parts[2], 10);
      
      // Create date in local timezone and format it
      const date = new Date(year, month, day);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    
    return '';
  };

  // Helper function to get monotone status icon and styles
  const getStatusDisplay = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'pending') return { icon: <Clock size={14} color="#6B7280" />, text: 'Pending' };
    if (s === 'approved' || s === 'active') return { icon: <CheckCircle size={14} color="#6B7280" />, text: 'Active' };
    if (s === 'verified') return { icon: <CheckCircle size={14} color="#6B7280" />, text: 'Verified' };
    if (s === 'rejected' || s === 'inactive') return { icon: <XCircle size={14} color="#6B7280" />, text: 'Inactive' };
    return { icon: <Clock size={14} color="#6B7280" />, text: status || 'Unknown' };
  };

  // Transform profile data for display
  const profileData = profile ? {
    name: profile.firstName && profile.lastName ? `${profile.firstName} ${profile.lastName}` : 'Unknown User',
    email: profile.email || '',
    phone: profile.contactNumber || '',
    address: profile.address || '',
    specialization: profile.specialty || '',
    experience: profile.yearsOfExperience && profile.yearsOfExperience > 0 ? `${profile.yearsOfExperience} years` : '',
    profileImage: '', // profileImage not available in current interface
    medicalLicenseNumber: profile.medicalLicenseNumber || '',
    prcId: profile.prcId || '',
    prcExpiryDate: profile.prcExpiryDate || '',
    professionalFee: profile.professionalFee ? `₱${profile.professionalFee}` : '',
    professionalFeeStatus: profile.professionalFeeStatus || '',
    gender: profile.gender || '',
    dateOfBirth: profile.dateOfBirth || '',
    civilStatus: profile.civilStatus || '',
    status: profile.status || '',
    clinicAffiliations: profile.clinicAffiliations || [],
  } : {
    name: '',
    email: '',
    phone: '',
    address: '',
    specialization: '',
    experience: '',
    profileImage: '',
    medicalLicenseNumber: '',
    prcId: '',
    prcExpiryDate: '',
    professionalFee: '',
    professionalFeeStatus: '',
    gender: '',
    dateOfBirth: '',
    civilStatus: '',
    status: '',
    clinicAffiliations: [],
  };

  const [refreshing, setRefreshing] = useState(false);
  const [showFullProfileModal, setShowFullProfileModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editableData, setEditableData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    specialization: '',
    experience: '',
    medicalLicenseNumber: '',
    prcId: '',
    prcExpiryDate: '',
    professionalFee: '',
    gender: '',
    dateOfBirth: '',
    civilStatus: '',
  });
  const [clinicNames, setClinicNames] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showFeeChangeModal, setShowFeeChangeModal] = useState(false);
  const [showFeeChangeConfirmation, setShowFeeChangeConfirmation] = useState(false);
  const [showFeeChangeSuccess, setShowFeeChangeSuccess] = useState(false);
  const [requestedFee, setRequestedFee] = useState('');
  const [isSubmittingFeeChange, setIsSubmittingFeeChange] = useState(false);
  // const [notifications, setNotifications] = useState([
  //   { id: 1, text: 'New referral request from Dr. Smith for patient John Doe.', read: false },
  //   { id: 2, text: 'Appointment with Sarah Johnson confirmed for tomorrow.', read: true },
  //   { id: 3, text: 'Lab results for patient Mike Wilson are ready.', read: false },
  // ]);

  // Performance optimization: memoize clinic names
  const memoizedClinicNames = performanceUtils.useDeepMemo(() => clinicNames, [clinicNames]);

  // Dropdown options
  const genderOptions = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
    { label: 'Other', value: 'other' },
  ];

  const civilStatusOptions = [
    { label: 'Single', value: 'single' },
    { label: 'Married', value: 'married' },
    { label: 'Divorced', value: 'divorced' },
    { label: 'Widowed', value: 'widowed' },
  ];

  // Load profile data from Firebase
  useEffect(() => {
    if (user && user.uid) {
      // loadProfileData(); // This function is no longer needed
    }
  }, [user]);

  const fetchClinicNames = useCallback(async (clinicIds: any) => {
    try {
      // Handle both array and object formats
      let clinicIdArray: string[] = [];
      if (Array.isArray(clinicIds)) {
        clinicIdArray = clinicIds;
      } else if (typeof clinicIds === 'object' && clinicIds !== null) {
        clinicIdArray = Object.values(clinicIds);
      } else {
        setClinicNames([]);
        return;
      }
      
      const names: string[] = [];
      for (const clinicId of clinicIdArray) {
        try {
          // Always treat as clinic ID and fetch from clinics node
          const clinicData = await databaseService.getDocument(`clinics/${clinicId}`);
          
          if (clinicData && clinicData.name) {
            names.push(clinicData.name);
          } else {
            // Fallback: show the ID if no name is available
            names.push(`Clinic ${clinicId}`);
          }
        } catch (clinicError) {
          console.error(`Error fetching clinic ${clinicId}:`, clinicError);
          // Fallback: show the ID if fetch fails
          names.push(`Clinic ${clinicId}`);
        }
      }
      
      setClinicNames(names);
    } catch (error) {
      console.error('Error fetching clinic names:', error);
      setClinicNames([]);
    }
  }, []); // Empty dependency array since it doesn't depend on any props or state

  // Synchronize editableData when profile changes (for real-time updates)
  useEffect(() => {
    if (profile && isEditing) {
      setEditableData(prev => {
        const updated = {
          ...prev,
          name: profile.firstName && profile.lastName ? 
            `${profile.firstName} ${profile.lastName}` : prev.name,
          email: profile.email || prev.email,
          phone: profile.contactNumber || prev.phone,
          address: profile.address || prev.address,
          specialization: profile.specialty || prev.specialization,
          experience: profile.yearsOfExperience && profile.yearsOfExperience > 0 ? 
            profile.yearsOfExperience.toString() : prev.experience,
          medicalLicenseNumber: profile.medicalLicenseNumber || prev.medicalLicenseNumber,
          prcId: profile.prcId || prev.prcId,
          prcExpiryDate: profile.prcExpiryDate || prev.prcExpiryDate,
          professionalFee: profile.professionalFee ? profile.professionalFee.toString() : prev.professionalFee,
          gender: profile.gender || prev.gender,
          dateOfBirth: profile.dateOfBirth || prev.dateOfBirth,
          civilStatus: profile.civilStatus || prev.civilStatus,
        };
        
        return updated;
      });
    }
  }, [profile, isEditing]);

  // Consolidated effect for fetching clinic names - only run when profile changes
  useEffect(() => {
    if (profile && profile.clinicAffiliations) {
      if (Array.isArray(profile.clinicAffiliations) && profile.clinicAffiliations.length > 0) {
        fetchClinicNames(profile.clinicAffiliations);
      } else if (typeof profile.clinicAffiliations === 'object' && profile.clinicAffiliations !== null && Object.keys(profile.clinicAffiliations).length > 0) {
        fetchClinicNames(profile.clinicAffiliations);
      } else {
        setClinicNames([]);
      }
    } else if (profile) {
      setClinicNames([]);
    }
  }, [profile, fetchClinicNames]); // Depend on profile and fetchClinicNames

  // Helper function to check if clinic has a valid address
  const hasValidAddress = (clinicData: any): boolean => {
    // Check for new address format (address, city, province)
    const hasNewFormat = clinicData.address && 
                        typeof clinicData.address === 'string' && 
                        clinicData.address.trim().length > 0 &&
                        clinicData.city && 
                        typeof clinicData.city === 'string' && 
                        clinicData.city.trim().length > 0 &&
                        clinicData.province && 
                        typeof clinicData.province === 'string' && 
                        clinicData.province.trim().length > 0;
    
    // Check for old address format (addressLine)
    const hasOldFormat = clinicData.addressLine && 
                        typeof clinicData.addressLine === 'string' && 
                        clinicData.addressLine.trim().length > 0;
    
    // Return true if either format is valid
    return hasNewFormat || hasOldFormat;
  };

  // const loadProfileData = async () => { // This function is no longer needed
  //   if (!user) return;
    
  //   try {
  //     setLoading(true);
  //     setError(null);
  //     const specialistProfile = await databaseService.getSpecialistProfile(user.uid);
      
  //     if (specialistProfile) {
  //       // Use specialist profile data directly
  //       console.log('Specialist profile loaded:', specialistProfile);
        
  //       setProfileData({
  //         name: safeDataAccess.getUserFullName(specialistProfile, user.name || ''),
  //         email: specialistProfile.email || user.email || '',
  //         phone: safeDataAccess.getUserPhone(specialistProfile, ''),
  //         address: specialistProfile.address || '',
  //         specialization: specialistProfile.specialty || '',
  //         experience: specialistProfile.yearsOfExperience && specialistProfile.yearsOfExperience > 0 ? `${specialistProfile.yearsOfExperience} years` : '',
  //         profileImage: specialistProfile.profileImageUrl || '',
  //         medicalLicenseNumber: specialistProfile.medicalLicenseNumber || '',
  //         prcId: specialistProfile.prcId || '',
  //         prcExpiryDate: specialistProfile.prcExpiryDate || '',
  //         professionalFee: specialistProfile.professionalFee ? `₱${specialistProfile.professionalFee}` : '',
  //         gender: safeDataAccess.getUserGender(specialistProfile, ''),
  //         dateOfBirth: specialistProfile.dateOfBirth || '',
  //         civilStatus: specialistProfile.civilStatus || '',
  //         status: specialistProfile.status || '',
  //         clinicAffiliations: specialistProfile.clinicAffiliations || [],
  //       });
  //     } else {
  //       // Use basic user data if no specialist profile exists
  //       setProfileData({
  //         name: user.name || '',
  //         email: user.email || '',
  //         phone: '',
  //         address: '',
  //         specialization: '',
  //         experience: '',
  //         profileImage: '',
  //         medicalLicenseNumber: '',
  //         prcId: '',
  //         prcExpiryDate: '',
  //         professionalFee: '',
  //         gender: '',
  //         dateOfBirth: '',
  //         civilStatus: '',
  //         status: '',
  //         clinicAffiliations: [],
  //       });
  //     }
  //   } catch (error) {
  //     console.error('Error loading profile data:', error);
  //     setError('Failed to load profile data. Please try again.');
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const onRefresh = async () => {
    setRefreshing(true);
    // Refresh using the hook's refresh method
    if (profile) {
      // The real-time listener will automatically update the data
      // No need to manually refresh
    }
    setRefreshing(false);
  };

  const handleRetry = () => {
    // The real-time listener will automatically retry
    // No need to manually handle retry
  };

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleSignOut = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = async () => {
    try {
      await signOut();
      setShowLogoutModal(false);
      setTimeout(() => {
        router.replace('/');
      }, 100);
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const handleEditProfile = () => {
    setIsEditing(true);
    setShowFullProfileModal(true);
    // Ensure profile data is available before setting editable data
    if (profile) {
      const initialData = {
        name: profile.firstName && profile.lastName ? 
          `${profile.firstName} ${profile.lastName}` : '',
        email: profile.email || '',
        phone: profile.contactNumber || '',
        address: profile.address || '',
        specialization: profile.specialty || '',
        experience: profile.yearsOfExperience && profile.yearsOfExperience > 0 ? 
          profile.yearsOfExperience.toString() : '',
        medicalLicenseNumber: profile.medicalLicenseNumber || '',
        prcId: profile.prcId || '',
        prcExpiryDate: profile.prcExpiryDate || '',
        professionalFee: profile.professionalFee ? profile.professionalFee.toString() : '',
        gender: profile.gender || '',
        dateOfBirth: profile.dateOfBirth || '',
        civilStatus: profile.civilStatus || '',
      };
      
      setEditableData(initialData);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in to update your profile.');
      return;
    }

    // Validate required fields
    if (!editableData.name || !editableData.email) {
      Alert.alert('Error', 'Please fill in all required fields (Name and Email are required).');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editableData.email)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    // Validate experience field if provided
    if (editableData.experience && (isNaN(parseInt(editableData.experience)) || parseInt(editableData.experience) < 0)) {
      Alert.alert('Error', 'Please enter a valid number of years of experience.');
      return;
    }

    // Validate professional fee if provided
    if (editableData.professionalFee && (isNaN(parseInt(editableData.professionalFee)) || parseInt(editableData.professionalFee) < 0)) {
      Alert.alert('Error', 'Please enter a valid professional fee amount.');
      return;
    }

    setIsSaving(true);
    try {
      // Prepare the updates for the database
      const updates = {
        // Split the name into firstName and lastName
        firstName: editableData.name.split(' ')[0] || '',
        lastName: editableData.name.split(' ').slice(1).join(' ') || '',
        email: editableData.email,
        contactNumber: editableData.phone,
        address: editableData.address,
        specialty: editableData.specialization,
        yearsOfExperience: editableData.experience ? parseInt(editableData.experience) : 0,
        medicalLicenseNumber: editableData.medicalLicenseNumber,
        prcId: editableData.prcId,
        prcExpiryDate: editableData.prcExpiryDate,
        professionalFee: editableData.professionalFee ? parseInt(editableData.professionalFee) : 0,
        gender: editableData.gender,
        dateOfBirth: editableData.dateOfBirth,
        civilStatus: editableData.civilStatus,
        lastUpdated: new Date().toISOString(),
      };

      // Update the specialist profile in the database
      await updateProfile(updates);
      
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Check if any data has been modified
    const hasChanges = profile && (
      editableData.name !== (profile.firstName && profile.lastName ? `${profile.firstName} ${profile.lastName}` : '') ||
      editableData.email !== (profile.email || '') ||
      editableData.phone !== (profile.contactNumber || '') ||
      editableData.address !== (profile.address || '') ||
      editableData.specialization !== (profile.specialty || '') ||
      editableData.experience !== (profile.yearsOfExperience ? profile.yearsOfExperience.toString() : '') ||
      editableData.medicalLicenseNumber !== (profile.medicalLicenseNumber || '') ||
      editableData.prcId !== (profile.prcId || '') ||
      editableData.prcExpiryDate !== (profile.prcExpiryDate || '') ||
      editableData.professionalFee !== (profile.professionalFee ? profile.professionalFee.toString() : '') ||
      editableData.gender !== (profile.gender || '') ||
      editableData.dateOfBirth !== (profile.dateOfBirth || '') ||
      editableData.civilStatus !== (profile.civilStatus || '')
    );

    if (hasChanges) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => setIsEditing(false) }
        ]
      );
    } else {
      setIsEditing(false);
    }
  };

  const quickActions = [
    {
      icon: Pill,
      title: 'Prescriptions',
      color: '#1E40AF',
      onPress: () => router.push('/(specialist)/tabs/prescriptions'),
    },
    {
      icon: FileText,
      title: 'Medical Certificates',
      color: '#1E40AF',
      onPress: () => router.push('/(specialist)/tabs/certificates'),
    },
  ];

  const settingsItems = [
    {
      icon: Lock,
      title: 'Change Password',
      color: '#1E40AF',
      onPress: () => router.push('/(auth)/change-password'),
    },
    {
      icon: Bell,
      title: 'Notification Preferences',
      color: '#1E40AF',
      onPress: () => Alert.alert('Notifications', 'Notification preferences would be configured here'),
    },
    {
      icon: HelpCircle,
      title: 'Help & Support',
      color: '#1E40AF',
      onPress: () => router.push('/(shared)/help-support'),
    },
    {
      icon: BookOpen,
      title: 'Terms & Privacy Policy',
      color: '#1E40AF',
      onPress: () => router.push('/(shared)/terms-privacy'),
    },
  ];

     const {
     name,
     email,
     phone,
     address,
     specialization,
     experience,
     profileImage,
     medicalLicenseNumber,
     prcId,
     prcExpiryDate,
     professionalFee,
     gender,
     dateOfBirth,
     civilStatus,
     status,
          clinicAffiliations,
   } = profileData;

   // Fetch clinic names when clinic affiliations change
  // useEffect(() => {
  //   if (clinicAffiliations) {
  //     console.log('=== ClinicAffiliations Change Debug ===');
  //     console.log('ClinicAffiliations from profileData:', clinicAffiliations);
  //     console.log('Type:', typeof clinicAffiliations);
  //     console.log('Is Array:', Array.isArray(clinicAffiliations));
      
  //     if (Array.isArray(clinicAffiliations) && clinicAffiliations.length > 0) {
  //       console.log('Array format, fetching clinic names for:', clinicAffiliations);
  //       fetchClinicNames(clinicAffiliations);
  //     } else if (typeof clinicAffiliations === 'object' && clinicAffiliations !== null && Object.keys(clinicAffiliations).length > 0) {
  //       console.log('Object format, fetching clinic names for:', Object.values(clinicAffiliations));
  //       fetchClinicNames(clinicAffiliations);
  //     } else {
  //       console.log('No clinic affiliations, clearing clinic names');
  //       setClinicNames([]);
  //     }
  //   } else {
  //     console.log('No clinicAffiliations, clearing clinic names');
  //     setClinicNames([]);
  //   }
  // }, [clinicAffiliations]);

  // Also fetch clinic names when profile changes (for real-time updates)
  // useEffect(() => {
  //   if (profile && profile.clinicAffiliations) {
  //     console.log('=== Profile Clinic Affiliations Debug ===');
  //     console.log('Profile clinicAffiliations:', profile.clinicAffiliations);
  //     console.log('Type:', typeof profile.clinicAffiliations);
  //     console.log('Is Array:', Array.isArray(profile.clinicAffiliations));
      
  //     if (Array.isArray(profile.clinicAffiliations) && profile.clinicAffiliations.length > 0) {
  //       console.log('Array format, fetching clinic names for:', profile.clinicAffiliations);
  //       fetchClinicNames(profile.clinicAffiliations);
  //     } else if (typeof profile.clinicAffiliations === 'object' && profile.clinicAffiliations !== null && Object.keys(profile.clinicAffiliations).length > 0) {
  //       console.log('Object format, fetching clinic names for:', Object.values(profile.clinicAffiliations));
  //       fetchClinicNames(profile.clinicAffiliations);
  //     } else {
  //       console.log('No clinic affiliations in profile, clearing clinic names');
  //       setClinicNames([]);
  //     }
  //   } else if (profile) {
  //     console.log('Profile has no clinicAffiliations, clearing clinic names');
  //     setClinicNames([]);
  //   }
  // }, [profile]);

  // Handle opening notification modal
  const handleOpenNotifications = () => {
    setShowNotificationModal(true);
  };

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

  // Handle fee change request
  const handleFeeChangeRequest = () => {
    // Check if there's already a pending request
    const currentStatus = (profile as any)?.professionalFeeStatus;
    if (currentStatus === 'pending') {
      Alert.alert(
        'Request Pending',
        'You already have a fee change request pending admin approval. Please wait for the current request to be processed.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setRequestedFee('');
    setShowFeeChangeModal(true);
  };

  // Handle fee change submission
  const handleFeeChangeSubmit = () => {
    if (!requestedFee || isNaN(parseInt(requestedFee)) || parseInt(requestedFee) <= 0) {
      Alert.alert('Error', 'Please enter a valid fee amount.');
      return;
    }
    setShowFeeChangeModal(false);
    setShowFeeChangeConfirmation(true);
  };

  // Handle fee change confirmation
  const handleFeeChangeConfirm = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in to submit fee change request.');
      return;
    }

    setIsSubmittingFeeChange(true);
    try {
      const feeChangeData = {
        previousFee: profile?.professionalFee || 0,
        requestedFee: parseInt(requestedFee),
        requestDate: new Date().toISOString()
      };

      const updateData = {
        feeChangeRequest: feeChangeData,
        professionalFeeStatus: 'pending' as const,
        professionalFee: parseInt(requestedFee)
      };

      // Update the specialist profile with fee change request and status
      await updateProfile(updateData);

      setShowFeeChangeConfirmation(false);
      setShowFeeChangeSuccess(true);
    } catch (error) {
      console.error('Error submitting fee change request:', error);
      Alert.alert('Error', `Failed to submit fee change request: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmittingFeeChange(false);
    }
  };

  // Handle fee change success close
  const handleFeeChangeSuccessClose = () => {
    setShowFeeChangeSuccess(false);
    setRequestedFee('');
  };

  // Track if fee change result has been shown to prevent showing on every profile load
  const [feeChangeResultShown, setFeeChangeResultShown] = useState(false);
  
  // Ref to track if modal is currently being shown to prevent multiple executions
  const isShowingModalRef = useRef(false);

  // Get storage key for fee change result shown status
  const getFeeChangeResultKey = useCallback(() => {
    return user?.uid ? `feeChangeResultShown_${user.uid}` : null;
  }, [user?.uid]);

  // Load fee change result shown status from storage
  const loadFeeChangeResultShown = useCallback(async () => {
    const key = getFeeChangeResultKey();
    if (!key) return;
    
    try {
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const data = JSON.parse(stored);
        setFeeChangeResultShown(data.shown || false);
      }
    } catch (error) {
      console.error('Error loading fee change result shown status:', error);
    }
  }, [getFeeChangeResultKey]);

  // Save fee change result shown status to storage
  const saveFeeChangeResultShown = useCallback(async (shown: boolean) => {
    const key = getFeeChangeResultKey();
    if (!key) return;
    
    try {
      await AsyncStorage.setItem(key, JSON.stringify({ shown }));
    } catch (error) {
      console.error('Error saving fee change result shown status:', error);
    }
  }, [getFeeChangeResultKey]);

  // Load stored status on component mount
  useEffect(() => {
    loadFeeChangeResultShown();
  }, [loadFeeChangeResultShown]);

  // Handle fee change request result (approved/rejected)
  const handleFeeChangeResult = useCallback(async () => {
    const status = (profile as any)?.professionalFeeStatus;
    
    // Double-check to prevent multiple executions
    if (feeChangeResultShown || isShowingModalRef.current) {
      return;
    }
    
    // Set flag to prevent multiple executions
    isShowingModalRef.current = true;
    
    try {
      if (status === 'approved') {
        Alert.alert(
          'Request Approved',
          'Your fee change request has been approved by the admin. Your new professional fee is now active.',
          [{ text: 'OK' }]
        );
      } else if (status === 'rejected') {
        Alert.alert(
          'Request Rejected',
          'Your fee change request has been rejected by the admin. Please contact support for more information.',
          [{ text: 'OK' }]
        );
      }
      
      // Mark as shown to prevent showing again
      setFeeChangeResultShown(true);
      await saveFeeChangeResultShown(true);
    } finally {
      // Reset flag after modal is shown
      isShowingModalRef.current = false;
    }
  }, [profile, feeChangeResultShown, saveFeeChangeResultShown]);

  // Handle fee change status changes
  useEffect(() => {
    const status = (profile as any)?.professionalFeeStatus;
    // Only proceed if profile is loaded, status is approved/rejected, and not already shown
    if (profile && (status === 'approved' || status === 'rejected') && !feeChangeResultShown && !isShowingModalRef.current) {
      // Show result after a short delay to ensure UI is updated
      const timeoutId = setTimeout(() => {
        handleFeeChangeResult();
      }, 500);
      
      // Cleanup timeout to prevent multiple executions
      return () => clearTimeout(timeoutId);
    }
  }, [profile, (profile as any)?.professionalFeeStatus, feeChangeResultShown, handleFeeChangeResult]);

  // Reset fee change result shown flag when status changes to pending (new request)
  useEffect(() => {
    const status = (profile as any)?.professionalFeeStatus;
    if (status === 'pending') {
      setFeeChangeResultShown(false);
      saveFeeChangeResultShown(false);
    }
  }, [(profile as any)?.professionalFeeStatus, saveFeeChangeResultShown]);

  // Helper function to format date safely (avoiding timezone issues)

   return (
    <ErrorBoundary>
      <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Custom Profile Header */}
        <View style={styles.customHeader}>
          <View style={styles.customHeaderBackground} />
          {/* Flowing Circles Background */}
          <View style={styles.circle1} />
          <View style={styles.circle2} />
          <View style={styles.circle3} />
          <View style={styles.circle4} />
          <View style={styles.circle5} />
          <View style={styles.headerTop}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <ChevronLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Profile</Text>
            <TouchableOpacity 
              style={styles.editProfileHeaderButton}
              onPress={handleEditProfile}
            >
              <Edit size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          {/* Profile Header Section */}
          <View style={styles.profileHeaderSection}>
            <View style={styles.profileImageContainer}>
              {profileImage ? (
                <Image 
                  source={{ uri: profileImage }} 
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Text style={styles.profileImageText}>
                    {name ? safeDataAccess.getUserInitials({ name }, 'DR') : 'DR'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.profileName}>Dr. {name || 'Unknown Doctor'}</Text>
            <View style={styles.profileInfoRow}>
              <Text style={styles.profileSpecialty}>{specialization || 'General Medicine'}</Text>
              {memoizedClinicNames.length > 0 && (
                <Text style={styles.profileClinic}>
                  @ {memoizedClinicNames.slice(0, 2).join(', ')}
                  {memoizedClinicNames.length > 2 ? ` +${memoizedClinicNames.length - 2} more` : ''}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Earnings Section */}
        <View style={styles.earningsCard}>
          <Text style={styles.earningsTitle}>Earnings</Text>
          <Text style={styles.earningsSubtitle}>This month</Text>
          
          {/* Earnings Amount */}
          <View style={styles.earningsAmountContainer}>
            <Text style={styles.earningsAmount}>
              ₱{earnings.totalEarnings.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          
          {/* Earnings Breakdown */}
          <View style={styles.earningsBreakdownContainer}>
            <View style={styles.earningsBreakdownItem}>
              <View style={styles.earningsIcon}>
                <Users size={16} color="#1E40AF" />
              </View>
              <Text style={styles.earningsBreakdownText}>
                {earnings.totalAppointments} appointments
              </Text>
            </View>
            <View style={styles.earningsBreakdownItem}>
              <View style={styles.earningsIcon}>
                <TrendingUp size={16} color="#1E40AF" />
              </View>
              <Text style={styles.earningsBreakdownText}>
                {earnings.totalReferrals} referrals
              </Text>
            </View>
          </View>
        </View>

        {/* Loading and Error States */}
        {profileLoading ? (
          <LoadingState
            message="Loading profile..."
            variant="inline"
            size="large"
          />
        ) : profileError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{profileError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>



        {/* Professional Information */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Professional Information</Text>
          <View style={styles.infoList}>
            {medicalLicenseNumber && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>License Number:</Text>
                <Text style={styles.infoValue}>{medicalLicenseNumber}</Text>
              </View>
            )}
            {prcId && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>PRC ID:</Text>
                <Text style={styles.infoValue}>{prcId}</Text>
              </View>
            )}
            {prcExpiryDate && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>PRC Expiry Date:</Text>
                <Text style={styles.infoValue}>
                  {formatDateSafely(prcExpiryDate)}
                </Text>
              </View>
            )}
            {status && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status:</Text>
                <View style={styles.statusPill}>
                  {getStatusDisplay(status).icon}
                  <Text style={styles.statusPillText}>
                    {getStatusDisplay(status).text}
                  </Text>
                </View>
              </View>
            )}
          </View>

        </View>


        {/* Professional Fee Change */}
        <View style={styles.feeChangeSection}>
          <View style={styles.feeChangeContainer}>
            <View style={styles.feeChangeInfo}>
              <Text style={styles.feeChangeLabel}>Current Professional Fee</Text>
              <Text style={styles.feeChangeAmount}>
                {(profile as any)?.professionalFeeStatus === 'approved' && (profile as any)?.feeChangeRequest?.requestedFee 
                  ? (profile as any).feeChangeRequest.requestedFee 
                  : (profile as any)?.feeChangeRequest?.previousFee || professionalFee}
              </Text>
              {(profile as any)?.professionalFeeStatus === 'pending' && (profile as any)?.feeChangeRequest?.requestedFee && (
                <View style={styles.feeChangeRequestContainer}>
                  <Text style={styles.feeChangeRequestedText}>
                    Requested: ₱{(profile as any).feeChangeRequest.requestedFee}
                  </Text>
                  <View style={[styles.feeChangeStatusPill, styles.feeChangeStatusPending]}>
                    <Text style={styles.feeChangeStatusText}>
                      Pending
                    </Text>
                  </View>
                </View>
              )}
            </View>
            {(profile as any)?.professionalFeeStatus !== 'pending' && (
              <TouchableOpacity
                style={styles.feeChangeEditButton}
                onPress={handleFeeChangeRequest}
              >
                <Edit size={18} color="#1E40AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsContainer}>
            {quickActions.map((action) => (
              <TouchableOpacity key={action.title} style={styles.quickActionItem} onPress={action.onPress}>
                <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}17` }]}>
                  <action.icon size={20} color={action.color} />
                </View>
                <Text style={styles.quickActionTitle}>{action.title}</Text>
                <ChevronRight size={20} color="#1E40AF" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Settings */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.menuContainer}>
            {settingsItems.map((item) => (
              <TouchableOpacity key={item.title} style={styles.menuItem} onPress={item.onPress}>
                <View style={[styles.menuIcon, { backgroundColor: `${item.color}17` }]}>
                  <item.icon size={20} color={item.color} />
                </View>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <ChevronRight size={20} color="#1E40AF" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.logoutItem} onPress={handleSignOut}>
              <View style={[styles.menuIcon, { backgroundColor: '#1E40AF17' }]}>
                <LogOut size={20} color="#1E40AF" />
              </View>
              <Text style={styles.menuTitle}>Logout</Text>
              <ChevronRight size={20} color="#1E40AF" />
            </TouchableOpacity>
          </View>
        </View>


          </>
        )}
      </ScrollView>

             {/* Full Profile Modal */}
       <Modal
         visible={showFullProfileModal}
         transparent={true}
         animationType="slide"
         onRequestClose={() => {
           setShowFullProfileModal(false);
           setIsEditing(false);
         }}
       >
         <View style={styles.fullProfileModalBackdrop}>
           <View style={styles.fullProfileModalContainer}>
             {/* Modal Header */}
             <View style={styles.fullProfileModalHeader}>
               <Text style={styles.fullProfileModalTitle}>
                 {isEditing ? 'Edit Profile' : 'Full Profile'}
               </Text>
               <TouchableOpacity
                 style={styles.fullProfileCloseButton}
                 onPress={() => {
                   setShowFullProfileModal(false);
                   setIsEditing(false);
                 }}
               >
                 <Text style={styles.fullProfileCloseButtonText}>✕</Text>
               </TouchableOpacity>
             </View>

             {/* Modal Content */}
             <View style={styles.fullProfileModalContentWrapper}>
               <ScrollView 
                 style={styles.fullProfileModalScrollView}
                 showsVerticalScrollIndicator={false}
                 contentContainerStyle={styles.fullProfileModalContent}
               >
                 {isEditing ? (
                   // Edit Form - Inline Editing
                   <>
                                                                  {/* Profile Header */}
                       <View style={styles.modalProfileHeader}>
                         <View style={styles.modalProfileImageContainer}>
                           {profileImage ? (
                             <Image 
                               source={{ uri: profileImage }} 
                               style={styles.modalProfileImage}
                               // defaultSource={require('../../../assets/default-avatar.png')}
                             />
                           ) : (
                             <View style={styles.modalProfileImagePlaceholder}>
                               <Text style={styles.modalProfileImageText}>
                                 {name ? safeDataAccess.getUserInitials({ name }, 'DR') : 'DR'}
                               </Text>
                             </View>
                           )}
                         </View>
                       </View>

                       {/* Profile Information */}
                       <View style={styles.modalSection}>
                         <Text style={styles.modalSectionTitle}>Profile Information</Text>
                         <View style={styles.modalEditFields}>
                           <View style={styles.modalEditField}>
                             <Text style={styles.modalEditLabel}>Full Name</Text>
                             <Input
                               value={editableData.name}
                               onChangeText={(text) => setEditableData(prev => ({ ...prev, name: text }))}
                               placeholder="Enter your full name"
                               style={styles.editInput}
                               inputStyle={styles.editInputText}
                             />
                           </View>
                           <View style={styles.modalEditField}>
                             <Text style={styles.modalEditLabel}>Specialization</Text>
                             <Input
                               value={editableData.specialization}
                               onChangeText={(text) => setEditableData(prev => ({ ...prev, specialization: text }))}
                               placeholder="Enter specialization"
                               style={styles.editInput}
                               inputStyle={styles.editInputText}
                             />
                           </View>
                           <View style={styles.modalEditField}>
                             <Text style={styles.modalEditLabel}>Years of Experience</Text>
                             <Input
                               value={editableData.experience}
                               onChangeText={(text) => setEditableData(prev => ({ ...prev, experience: text }))}
                               placeholder="Enter years of experience"
                               keyboardType="numeric"
                               style={styles.editInput}
                               inputStyle={styles.editInputText}
                             />
                           </View>
                         </View>
                       </View>

                                                                  {/* Personal Information */}
                       <View style={styles.modalSection}>
                         <Text style={styles.modalSectionTitle}>Personal Information</Text>
                         <View style={styles.modalEditFields}>
                           <View style={styles.modalEditField}>
                             <Text style={styles.modalEditLabel}>Gender</Text>
                             <Dropdown
                               options={genderOptions}
                               value={editableData.gender}
                               onValueChange={(value) => setEditableData(prev => ({ ...prev, gender: value }))}
                               placeholder="Select gender"
                               style={styles.editInput}
                             />
                           </View>
                                                       <View style={styles.modalEditField}>
                              <Text style={styles.modalEditLabel}>Date of Birth</Text>
                              <DatePicker
                                value={editableData.dateOfBirth}
                                onValueChange={(value) => setEditableData(prev => ({ ...prev, dateOfBirth: value }))}
                                placeholder="Select date of birth"
                                style={styles.editInput}
                              />
                            </View>
                           <View style={styles.modalEditField}>
                             <Text style={styles.modalEditLabel}>Civil Status</Text>
                             <Dropdown
                               options={civilStatusOptions}
                               value={editableData.civilStatus}
                               onValueChange={(value) => setEditableData(prev => ({ ...prev, civilStatus: value }))}
                               placeholder="Select civil status"
                               style={styles.editInput}
                             />
                           </View>
                         </View>
                       </View>

                                                                  {/* Contact Information */}
                       <View style={styles.modalSection}>
                         <Text style={styles.modalSectionTitle}>Contact Information</Text>
                         <View style={styles.modalEditFields}>
                           <View style={styles.modalEditField}>
                             <Text style={styles.modalEditLabel}>Email</Text>
                             <Input
                               value={editableData.email}
                               onChangeText={(text) => setEditableData(prev => ({ ...prev, email: text }))}
                               placeholder="Enter email"
                               keyboardType="email-address"
                               style={styles.editInput}
                               inputStyle={styles.editInputText}
                             />
                           </View>
                           <View style={styles.modalEditField}>
                             <Text style={styles.modalEditLabel}>Phone</Text>
                             <Input
                               value={editableData.phone}
                               onChangeText={(text) => setEditableData(prev => ({ ...prev, phone: text }))}
                               placeholder="Enter phone number"
                               keyboardType="phone-pad"
                               style={styles.editInput}
                               inputStyle={styles.editInputText}
                             />
                           </View>
                           <View style={styles.modalEditField}>
                             <Text style={styles.modalEditLabel}>Address</Text>
                             <Input
                               value={editableData.address}
                               onChangeText={(text) => setEditableData(prev => ({ ...prev, address: text }))}
                               placeholder="Enter address"
                               multiline
                               numberOfLines={3}
                               style={styles.editInput}
                               inputStyle={styles.editInputText}
                             />
                           </View>
                         </View>
                       </View>

                                                                  {/* Professional Information */}
                       <View style={styles.modalSection}>
                         <Text style={styles.modalSectionTitle}>Professional Information</Text>
                         <View style={styles.modalEditFields}>
                           <View style={styles.modalEditField}>
                             <Text style={styles.modalEditLabel}>License Number</Text>
                             <Input
                               value={editableData.medicalLicenseNumber}
                               onChangeText={(text) => setEditableData(prev => ({ ...prev, medicalLicenseNumber: text }))}
                               placeholder="Enter license number"
                               style={styles.editInput}
                               inputStyle={styles.editInputText}
                             />
                           </View>
                           <View style={styles.modalEditField}>
                             <Text style={styles.modalEditLabel}>PRC ID</Text>
                             <Input
                               value={editableData.prcId}
                               onChangeText={(text) => setEditableData(prev => ({ ...prev, prcId: text }))}
                               placeholder="Enter PRC ID"
                               style={styles.editInput}
                               inputStyle={styles.editInputText}
                             />
                           </View>
                                                       <View style={styles.modalEditField}>
                              <Text style={styles.modalEditLabel}>PRC Expiry Date</Text>
                              <DatePicker
                                value={editableData.prcExpiryDate}
                                onValueChange={(value) => setEditableData(prev => ({ ...prev, prcExpiryDate: value }))}
                                placeholder="Select expiry date"
                                style={styles.editInput}
                              />
                            </View>
                         </View>
                       </View>
                   </>
                 ) : (
                   // View Mode
                   <>
                     {/* Profile Header */}
                     <View style={styles.modalProfileHeader}>
                       <View style={styles.modalProfileImageContainer}>
                         {profileImage ? (
                           <Image 
                             source={{ uri: profileImage }} 
                             style={styles.modalProfileImage}
                             // defaultSource={require('../../../assets/default-avatar.png')}
                           />
                         ) : (
                           <View style={styles.modalProfileImagePlaceholder}>
                             <Text style={styles.modalProfileImageText}>
                               {name ? safeDataAccess.getUserInitials({ name }, 'DR') : 'DR'}
                             </Text>
                           </View>
                         )}
                       </View>
                       <View style={styles.modalProfileInfo}>
                         <Text style={styles.modalUserName}>Dr. {name || 'Unknown Doctor'}</Text>
                         <Text style={styles.modalUserSpecialty}>{specialization || 'General Medicine'}</Text>
                         {experience && <Text style={styles.modalExperience}>{experience} experience</Text>}
                       </View>
                     </View>

                     {/* Personal Information */}
                     <View style={styles.modalSection}>
                       <Text style={styles.modalSectionTitle}>Personal Information</Text>
                       <View style={styles.modalInfoGrid}>
                         {gender && (
                           <View style={styles.modalInfoItem}>
                             <Text style={styles.modalInfoLabel}>Gender</Text>
                             <Text style={styles.modalInfoValue}>
                               {gender.charAt(0).toUpperCase() + gender.slice(1)}
                             </Text>
                           </View>
                         )}
                         {dateOfBirth && (
                           <View style={styles.modalInfoItem}>
                             <Text style={styles.modalInfoLabel}>Date of Birth</Text>
                             <Text style={styles.modalInfoValue}>
                               {formatDateSafely(dateOfBirth)}
                             </Text>
                           </View>
                         )}
                         {civilStatus && (
                           <View style={styles.modalInfoItem}>
                             <Text style={styles.modalInfoLabel}>Civil Status</Text>
                             <Text style={styles.modalInfoValue}>
                               {civilStatus.charAt(0).toUpperCase() + civilStatus.slice(1)}
                             </Text>
                           </View>
                         )}
                       </View>
                     </View>

                     {/* Contact Information */}
                     <View style={styles.modalSection}>
                       <Text style={styles.modalSectionTitle}>Contact Information</Text>
                       <View style={styles.modalContactList}>
                         <View style={styles.modalContactItem}>
                           <Mail size={18} color="#6B7280" />
                           <Text style={styles.modalContactText}>{email || 'Email not provided'}</Text>
                         </View>
                         {phone && (
                           <View style={styles.modalContactItem}>
                             <Phone size={18} color="#6B7280" />
                             <Text style={styles.modalContactText}>{phone}</Text>
                           </View>
                         )}
                         {address && (
                           <View style={styles.modalContactItem}>
                             <MapPin size={18} color="#6B7280" />
                             <Text style={styles.modalContactText}>{address}</Text>
                           </View>
                         )}
                       </View>
                     </View>

                     {/* Professional Information */}
                     <View style={styles.modalSection}>
                       <Text style={styles.modalSectionTitle}>Professional Information</Text>
                       <View style={styles.modalInfoList}>
                         {medicalLicenseNumber && (
                           <View style={styles.modalInfoRow}>
                             <Text style={styles.modalInfoLabel}>License Number</Text>
                             <Text style={styles.modalInfoValue}>{medicalLicenseNumber}</Text>
                           </View>
                         )}
                         {prcId && (
                           <View style={styles.modalInfoRow}>
                             <Text style={styles.modalInfoLabel}>PRC ID</Text>
                             <Text style={styles.modalInfoValue}>{prcId}</Text>
                           </View>
                         )}
                         {prcExpiryDate && (
                           <View style={styles.modalInfoRow}>
                             <Text style={styles.modalInfoLabel}>PRC Expiry Date</Text>
                             <Text style={styles.modalInfoValue}>
                               {formatDateSafely(prcExpiryDate)}
                             </Text>
                           </View>
                         )}
                         {status && (
                           <View style={styles.modalInfoRow}>
                             <Text style={styles.modalInfoLabel}>Status</Text>
                             <View style={styles.modalStatusPill}>
                               {getStatusDisplay(status).icon}
                               <Text style={styles.modalStatusPillText}>
                                 {getStatusDisplay(status).text}
                               </Text>
                             </View>
                           </View>
                         )}
                       </View>
                     </View>

                     {/* Clinic Affiliations */}
                     {memoizedClinicNames.length > 0 && (
                       <View style={styles.modalSection}>
                         <Text style={styles.modalSectionTitle}>Clinic Affiliations</Text>
                         <View style={styles.modalInfoList}>
                           {memoizedClinicNames.map((clinicName, index) => (
                             <View key={index} style={styles.modalInfoRow}>
                               <Text style={styles.modalInfoLabel}>Clinic {index + 1}</Text>
                               <Text style={styles.modalInfoValue}>{clinicName}</Text>
                             </View>
                           ))}
                         </View>
                       </View>
                     )}
                   </>
                 )}
               </ScrollView>
             </View>

                           {/* Floating Buttons */}
              {isEditing ? (
                <View style={styles.editButtonContainer}>
                  <View style={styles.editButtonsRow}>
                    <TouchableOpacity 
                      style={styles.cancelButton}
                      onPress={handleCancelEdit}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.saveButton}
                      onPress={handleSaveProfile}
                      disabled={isSaving}
                    >
                      <Text style={styles.saveButtonText}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.editButtonContainer}>
                  <TouchableOpacity 
                    style={styles.editProfileButton}
                    onPress={handleEditProfile}
                  >
                    <Edit size={18} color="#FFFFFF" />
                    <Text style={styles.editProfileButtonText}>Edit Profile</Text>
                  </TouchableOpacity>
                </View>
              )}
           </View>
         </View>
       </Modal>

      {/* Global Notification Modal */}
      <GlobalNotificationModal
        visible={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        userRole="specialist"
      />

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <DoorOpen size={36} color="#1E40AF" />
                <Text style={styles.modalTitle}>Confirm Logout</Text>
                <Text style={styles.modalSubtext}>
                  Are you sure you want to logout? You will need to sign in again to access your account.
                </Text>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalSecondaryButton}
                  onPress={() => setShowLogoutModal(false)}
                >
                  <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalPrimaryButton}
                  onPress={handleConfirmLogout}
                >
                  <Text style={styles.modalPrimaryButtonText}>Logout</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fee Change Request Modal */}
      <Modal
        visible={showFeeChangeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFeeChangeModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Edit size={32} color="#1E40AF" />
                <Text style={styles.modalTitle}>Professional Fee Change</Text>
                <Text style={styles.modalSubtext}>
                  Your request to change this fee will be pending for approval by the admin.
                </Text>
                {(profile as any)?.professionalFeeStatus && (
                  <View style={[styles.modalStatusPill, 
                    (profile as any)?.professionalFeeStatus === 'approved' ? styles.feeChangeStatusApproved :
                    (profile as any)?.professionalFeeStatus === 'rejected' ? styles.feeChangeStatusRejected :
                    styles.feeChangeStatusPending
                  ]}>
                    <Text style={styles.modalStatusPillText}>
                      Current Status: {(profile as any)?.professionalFeeStatus === 'approved' ? 'Approved' :
                       (profile as any)?.professionalFeeStatus === 'rejected' ? 'Rejected' :
                       'Pending'}
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={styles.feeChangeModalContent}>
                <View style={styles.feeChangeModalField}>
                  <Text style={styles.feeChangeModalLabel}>Current Fee</Text>
                  <Text style={styles.feeChangeModalCurrentFee}>
                    {(profile as any)?.professionalFeeStatus === 'approved' && (profile as any)?.feeChangeRequest?.requestedFee 
                      ? (profile as any).feeChangeRequest.requestedFee 
                      : (profile as any)?.feeChangeRequest?.previousFee || professionalFee}
                  </Text>
                </View>
                
                <View style={styles.feeChangeModalField}>
                  <Text style={styles.feeChangeModalLabel}>Requested Fee</Text>
                  <Input
                    value={requestedFee}
                    onChangeText={setRequestedFee}
                    placeholder="Enter new fee amount"
                    keyboardType="numeric"
                    style={styles.feeChangeModalInputSimple}
                    inputStyle={styles.feeChangeModalInputText}
                  />
                </View>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalSecondaryButton}
                  onPress={() => setShowFeeChangeModal(false)}
                >
                  <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalPrimaryButton}
                  onPress={handleFeeChangeSubmit}
                >
                  <Text style={styles.modalPrimaryButtonText}>Submit Request</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fee Change Confirmation Modal */}
      <Modal
        visible={showFeeChangeConfirmation}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFeeChangeConfirmation(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <CheckCircle size={32} color="#1E40AF" />
                <Text style={styles.modalTitle}>Confirm Fee Change</Text>
                <Text style={styles.modalSubtext}>
                  Are you sure you want to request a change from ₱{(profile as any)?.professionalFeeStatus === 'approved' && (profile as any)?.feeChangeRequest?.requestedFee 
                    ? (profile as any).feeChangeRequest.requestedFee 
                    : (profile as any)?.feeChangeRequest?.previousFee || professionalFee} to ₱{requestedFee}?
                </Text>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalSecondaryButton}
                  onPress={() => setShowFeeChangeConfirmation(false)}
                >
                  <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalPrimaryButton}
                  onPress={handleFeeChangeConfirm}
                  disabled={isSubmittingFeeChange}
                >
                  <Text style={styles.modalPrimaryButtonText}>
                    {isSubmittingFeeChange ? 'Submitting...' : 'Confirm Request'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fee Change Success Modal */}
      <Modal
        visible={showFeeChangeSuccess}
        transparent={true}
        animationType="fade"
        onRequestClose={handleFeeChangeSuccessClose}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <CheckCircle size={32} color="#10B981" />
                <Text style={styles.modalTitle}>Request Submitted</Text>
                <Text style={styles.modalSubtext}>
                  Your fee change request has been submitted successfully and is pending admin approval.
                </Text>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalPrimaryButton}
                  onPress={handleFeeChangeSuccessClose}
                >
                  <Text style={styles.modalPrimaryButtonText}>OK</Text>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: { flex: 1 },
  // Custom Header Styles
  customHeader: {
    backgroundColor: '#1E40AF',
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: 30,
    paddingHorizontal: 24,
    position: 'relative',
  },
  customHeaderBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -20,
    backgroundColor: '#1E40AF',
    zIndex: -1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  editProfileHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeaderSection: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  profileImageContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#1E40AF',
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#1E40AF',
  },
  profileImageText: {
    color: '#1E40AF',
    fontSize: 32,
    fontFamily: 'Inter-Bold',
  },
  profileName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  profileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  profileSpecialty: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  profileClinic: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.9,
  },
  // Earnings Card Styles
  earningsCard: {
    backgroundColor: '#F9FAFB',
    marginHorizontal: 24,
    marginTop: -30,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    zIndex: 10,
  },
  earningsTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  earningsSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  earningsAmountContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  earningsAmount: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#1E40AF',
    textAlign: 'center',
  },
  earningsBreakdownContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  earningsBreakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  earningsIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  earningsBreakdownText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
  },
  editProfileButton: {
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    flexDirection: 'row',
    gap: 8,
  },
  editProfileButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  feeChangeSection: {
    marginHorizontal: 24,
    marginBottom: 16,
  },
  infoSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#F9FAFB',
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 16,
  },
  infoList: { gap: 10 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  viewFullProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginHorizontal: -20,
    marginBottom: -20,
  },
  viewFullProfileText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
  },
  quickActionsContainer: { gap: 2, marginTop: 8 },
  quickActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickActionTitle: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    fontFamily: 'Inter-Regular',
  },
  menuContainer: { gap: 2, marginTop: 8 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuTitle: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    fontFamily: 'Inter-Regular',
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginTop: 2,
  },
     // Modal Styles
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
   // Full Profile Modal Styles
   fullProfileModalBackdrop: {
     flex: 1,
     backgroundColor: 'rgba(0, 0, 0, 0.5)',
     justifyContent: 'center',
     alignItems: 'center',
   },
   fullProfileModalContainer: {
     width: Dimensions.get('window').width * 0.9,
     maxWidth: 400,
     height: Dimensions.get('window').height * 0.85,
     backgroundColor: '#FFFFFF',
     borderRadius: 20,
     overflow: 'hidden',
     shadowColor: '#000',
     shadowOffset: {
       width: 0,
       height: 10,
     },
     shadowOpacity: 0.25,
     shadowRadius: 20,
     elevation: 10,
   },
   fullProfileModalHeader: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
     paddingHorizontal: 24,
     paddingVertical: 20,
     borderBottomWidth: 1,
     borderBottomColor: '#E5E7EB',
     backgroundColor: '#FFFFFF',
   },
   fullProfileModalTitle: {
     fontSize: 20,
     fontFamily: 'Inter-Bold',
     color: '#1F2937',
   },
   fullProfileCloseButton: {
     width: 32,
     height: 32,
     borderRadius: 16,
     backgroundColor: '#F3F4F6',
     justifyContent: 'center',
     alignItems: 'center',
   },
   fullProfileCloseButtonText: {
     fontSize: 16,
     fontFamily: 'Inter-SemiBold',
     color: '#6B7280',
   },
   fullProfileModalContentWrapper: {
     flex: 1,
     justifyContent: 'space-between',
   },
   fullProfileModalScrollView: {
     flex: 1,
   },
   fullProfileModalContent: {
     padding: 24,
     paddingBottom: 32,
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
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    marginHorizontal: 24,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  modalScrollView: {
    flex: 1,
  },
  modalContentWrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    alignItems: 'center',
    paddingBottom: 24,
  },
     modalProfileHeader: {
     flexDirection: 'row',
     alignItems: 'center',
     marginBottom: 24,
     paddingBottom: 0,
   },
  modalProfileImageContainer: {
    marginRight: 16,
  },
  modalProfileImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  modalProfileImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalProfileImageText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Inter-Bold',
  },
  modalProfileInfo: {
    flex: 1,
  },
  modalUserName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  modalUserSpecialty: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
    marginBottom: 2,
  },
  modalExperience: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  modalEditModeIndicator: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
    marginBottom: 8,
    textAlign: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  modalSection: {
    marginBottom: 32,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 16,
  },
  modalInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  modalInfoItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalInfoLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 4,
  },
  modalInfoValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  modalStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  modalStatusPillText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  modalContactList: {
    gap: 12,
  },
  modalContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  modalContactText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    flex: 1,
  },
     modalInfoList: {
     gap: 12,
   },
   modalEditFields: {
     gap: 20,
   },
   modalEditField: {
     width: '100%',
   },
   modalEditLabel: {
     fontSize: 14,
     fontFamily: 'Inter-Medium',
     color: '#6B7280',
     marginBottom: 8,
   },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

   editButtonContainer: {
     paddingVertical: 20,
     paddingHorizontal: 24,
     backgroundColor: 'transparent',
     borderTopWidth: 1,
     borderTopColor: '#E5E7EB',
   },
   editButtonsRow: {
     flexDirection: 'row',
     gap: 12,
     width: '100%',
     justifyContent: 'center',
   },

  editButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
     cancelButton: {
     backgroundColor: '#F9FAFB',
     paddingVertical: 12,
     borderRadius: 8,
     flex: 1,
     alignItems: 'center',
     borderWidth: 1,
     borderColor: '#E5E7EB',
   },
     cancelButtonText: {
     color: '#374151',
     fontSize: 14,
     fontFamily: 'Inter-SemiBold',
   },
     saveButton: {
     backgroundColor: '#1E40AF',
     paddingVertical: 12,
     borderRadius: 8,
     flex: 1,
     alignItems: 'center',
   },
     saveButtonText: {
     color: '#FFFFFF',
     fontSize: 14,
     fontFamily: 'Inter-SemiBold',
   },
     inlineInput: {
     backgroundColor: 'transparent',
     borderWidth: 0,
     paddingHorizontal: 0,
     paddingVertical: 0,
     marginBottom: 0,
   },
   inlineInputText: {
     fontSize: 14,
     fontFamily: 'Inter-Regular',
     color: '#1F2937',
     paddingVertical: 0,
   },
       editInput: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      paddingHorizontal: 0,
      paddingVertical: 0,
      marginBottom: 0,
      width: '100%',
      fontSize: 14,
      fontFamily: 'Inter-Regular',
      color: '#1F2937',
    },
       editInputText: {
      fontSize: 14,
      fontFamily: 'Inter-Regular',
      color: '#1F2937',
      paddingVertical: 0,
    },
  floatingButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    borderRadius: 16,
    marginHorizontal: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#1E40AF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  editButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
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
  // New styles for notification modal
  notificationList: {
    maxHeight: Dimensions.get('window').height * 0.4, // Limit height for scrollability
    marginTop: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#F3F4F6',
  },
  unreadNotification: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#1E40AF',
  },
  notificationText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
  },
  unreadText: {
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1E40AF',
    marginLeft: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
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
  modalPrimaryButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  bellButton: {
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  // New styles for notification modal action buttons
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
    marginHorizontal: 5,
  },
  modalActionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
  },
  // Fee status styles
  feeContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 0,
    flex: 1,
    justifyContent: 'flex-end',
  },
  previousFeeText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 2,
  },
  requestedFeeText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'right',
    marginLeft: 8,
  },
  feeStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 70,
    alignItems: 'center',
  },
  feeStatusText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  modalFeeContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 0,
  },
  modalPreviousFeeText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 2,
  },
  modalRequestedFeeText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'right',
    marginLeft: 8,
  },
  modalFeeStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 70,
    alignItems: 'center',
  },
  modalFeeStatusText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },

  emptyNotificationText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
  notificationContent: {
    flex: 1,
    marginRight: 10,
    maxWidth: '85%',
  },
  notificationTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
  },
  notificationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  notificationActionButton: {
    padding: 8,
  },
  // Fee Change Section Styles
  feeChangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  feeChangeInfo: {
    flex: 1,
  },
  feeChangeLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 4,
  },
  feeChangeAmount: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  feeChangeRequestedText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  feeChangeRequestContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  feeChangeStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 70,
    alignItems: 'center',
  },
  feeChangeStatusApproved: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  feeChangeStatusRejected: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  feeChangeStatusPending: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  feeChangeStatusText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  feeChangeEditButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E40AF',
  },
  // Fee Change Modal Styles
  feeChangeModalContent: {
    width: '100%',
    marginBottom: 20,
  },
  feeChangeModalField: {
    marginBottom: 16,
  },
  feeChangeModalLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 8,
  },
  feeChangeModalCurrentFee: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  feeChangeModalInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  feeChangeModalInputSimple: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 8,
  },
  feeChangeModalInputText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  // Earnings Styles
  earningsLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  earningsLoadingText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
  },
  earningsErrorContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  earningsErrorText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#DC2626',
    textAlign: 'center',
  },
  earningsRetryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  earningsRetryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  earningsContainer: {
    gap: 12,
  },
  totalEarningsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  totalEarningsAmount: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    flex: 1,
  },
  totalEarningsSubtext: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  earningsBreakdown: {
    flexDirection: 'row',
    gap: 12,
  },
  currentFeeInfo: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    padding: 8,
  },
  currentFeeLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  // New fee display styles
  feeInfoContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  feeComparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feeItem: {
    flex: 1,
    alignItems: 'center',
  },
  feeLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginBottom: 4,
  },
  feeAmount: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#6B7280',
  },
  feeAmountCurrent: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#059669',
  },
  feeSeparator: {
    marginHorizontal: 8,
    alignItems: 'center',
  },
  feeSeparatorText: {
    fontSize: 18,
    color: '#94A3B8',
    fontFamily: 'Inter-Bold',
  },
  singleFeeContainer: {
    alignItems: 'center',
  },
  singleFeeLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginBottom: 4,
  },
  singleFeeAmount: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#059669',
  },
  // Enhanced fee period styles
  feePeriodItem: {
    flex: 1,
    alignItems: 'center',
  },
  feePeriodLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginBottom: 4,
  },
  feePeriodAmount: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#6B7280',
    marginBottom: 8,
  },
  feePeriodAmountCurrent: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#059669',
    marginBottom: 8,
  },
  consultationCounts: {
    flexDirection: 'row',
    gap: 8,
  },
  singleConsultationCounts: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  consultationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  consultationText: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  consultationTextCurrent: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#059669',
  },
  singleFeePeriodContainer: {
    alignItems: 'center',
  },
  
  // Flowing Circles Background
  circle1: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 0,
  },
  circle2: {
    position: 'absolute',
    top: 40,
    left: -40,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    zIndex: 0,
  },
  circle3: {
    position: 'absolute',
    bottom: -20,
    right: 60,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    zIndex: 0,
  },
  circle4: {
    position: 'absolute',
    top: 80,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    zIndex: 0,
  },
  circle5: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    zIndex: 0,
  },
});
