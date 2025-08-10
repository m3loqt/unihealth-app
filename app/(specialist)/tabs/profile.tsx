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
  Image,
  Alert,
  RefreshControl,
  Modal,
  Dimensions,
} from 'react-native';
import {
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
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { useSpecialistProfile } from '../../../src/hooks/data/useSpecialistProfile';
import { databaseService } from '../../../src/services/database/firebase';
import { Input, Dropdown, DatePicker } from '../../../src/components/ui/Input';
import { safeDataAccess } from '../../../src/utils/safeDataAccess';
import LoadingState from '../../../src/components/ui/LoadingState';
import ErrorBoundary from '../../../src/components/ui/ErrorBoundary';
import { dataValidation } from '../../../src/utils/dataValidation';
import { performanceUtils } from '../../../src/utils/performance';

export default function SpecialistProfileScreen() {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, error: profileError, updateProfile } = useSpecialistProfile();
  
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

  // Synchronize editableData when profile changes (for real-time updates)
  useEffect(() => {
    if (profile && isEditing) {
      console.log('=== Specialist Profile Sync ===');
      console.log('Profile data received:', profile);
      console.log('Current editableData:', editableData);
      
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
        
        console.log('Updated editableData:', updated);
        return updated;
      });
    }
  }, [profile, isEditing]);

  const fetchClinicNames = async (clinicIds: any) => {
    try {
      console.log('=== Fetching Clinic Names ===');
      console.log('Clinic IDs received:', clinicIds);
      console.log('Type:', typeof clinicIds);
      console.log('Is Array:', Array.isArray(clinicIds));
      
      // Handle both array and object formats
      let clinicIdArray: string[] = [];
      if (Array.isArray(clinicIds)) {
        clinicIdArray = clinicIds;
      } else if (typeof clinicIds === 'object' && clinicIds !== null) {
        clinicIdArray = Object.values(clinicIds);
      } else {
        console.log('Invalid clinicIds format, clearing clinic names');
        setClinicNames([]);
        return;
      }
      
      console.log('Processed clinic ID array:', clinicIdArray);
      
      const names: string[] = [];
      for (const clinicId of clinicIdArray) {
        try {
          // Always treat as clinic ID and fetch from clinics node
          console.log('Fetching clinic data for ID:', clinicId);
          const clinicData = await databaseService.getDocument(`clinics/${clinicId}`);
          
          if (clinicData && clinicData.name) {
            console.log('Clinic data found:', clinicData.name);
            names.push(clinicData.name);
          } else {
            console.log('No clinic data found for ID:', clinicId);
            // Fallback: show the ID if no name is available
            names.push(`Clinic ${clinicId}`);
          }
        } catch (clinicError) {
          console.error(`Error fetching clinic ${clinicId}:`, clinicError);
          // Fallback: show the ID if fetch fails
          names.push(`Clinic ${clinicId}`);
        }
      }
      
      console.log('Final clinic names:', names);
      setClinicNames(names);
    } catch (error) {
      console.error('Error fetching clinic names:', error);
      setClinicNames([]);
    }
  };

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

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleEditProfile = () => {
    console.log('=== Starting Specialist Profile Edit ===');
    console.log('Current profile:', profile);
    console.log('Current profileData:', profileData);
    
    setIsEditing(true);
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
        prcExpiryDate: profile.prcExpiryDate || '2025-12-31',
        professionalFee: profile.professionalFee ? profile.professionalFee.toString() : '',
        gender: profile.gender || '',
        dateOfBirth: profile.dateOfBirth || '2020-01-01',
        civilStatus: profile.civilStatus || '',
      };
      
      console.log('Initializing editableData with:', initialData);
      setEditableData(initialData);
    } else {
      console.log('No profile data available for editing');
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
      icon: FileText,
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
      icon: Settings,
      title: 'Change Password',
      color: '#1E40AF',
      onPress: () => router.push('/(auth)/change-password'),
    },
    {
      icon: Settings,
      title: 'Notification Preferences',
      color: '#1E40AF',
      onPress: () => Alert.alert('Notifications', 'Notification preferences would be configured here'),
    },
    {
      icon: Settings,
      title: 'Help & Support',
      color: '#1E40AF',
      onPress: () => router.push('/(shared)/help-support'),
    },
    {
      icon: Settings,
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
  useEffect(() => {
    if (clinicAffiliations) {
      console.log('=== ClinicAffiliations Change Debug ===');
      console.log('ClinicAffiliations from profileData:', clinicAffiliations);
      console.log('Type:', typeof clinicAffiliations);
      console.log('Is Array:', Array.isArray(clinicAffiliations));
      
      if (Array.isArray(clinicAffiliations) && clinicAffiliations.length > 0) {
        console.log('Array format, fetching clinic names for:', clinicAffiliations);
        fetchClinicNames(clinicAffiliations);
      } else if (typeof clinicAffiliations === 'object' && clinicAffiliations !== null && Object.keys(clinicAffiliations).length > 0) {
        console.log('Object format, fetching clinic names for:', Object.values(clinicAffiliations));
        fetchClinicNames(clinicAffiliations);
      } else {
        console.log('No clinic affiliations, clearing clinic names');
        setClinicNames([]);
      }
    } else {
      console.log('No clinicAffiliations, clearing clinic names');
      setClinicNames([]);
    }
  }, [clinicAffiliations]);

  // Also fetch clinic names when profile changes (for real-time updates)
  useEffect(() => {
    if (profile && profile.clinicAffiliations) {
      console.log('=== Profile Clinic Affiliations Debug ===');
      console.log('Profile clinicAffiliations:', profile.clinicAffiliations);
      console.log('Type:', typeof profile.clinicAffiliations);
      console.log('Is Array:', Array.isArray(profile.clinicAffiliations));
      
      if (Array.isArray(profile.clinicAffiliations) && profile.clinicAffiliations.length > 0) {
        console.log('Array format, fetching clinic names for:', profile.clinicAffiliations);
        fetchClinicNames(profile.clinicAffiliations);
      } else if (typeof profile.clinicAffiliations === 'object' && profile.clinicAffiliations !== null && Object.keys(profile.clinicAffiliations).length > 0) {
        console.log('Object format, fetching clinic names for:', Object.values(profile.clinicAffiliations));
        fetchClinicNames(profile.clinicAffiliations);
      } else {
        console.log('No clinic affiliations in profile, clearing clinic names');
        setClinicNames([]);
      }
    } else if (profile) {
      console.log('Profile has no clinicAffiliations, clearing clinic names');
      setClinicNames([]);
    }
  }, [profile]);

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
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity style={styles.bellButton}>
            <User size={28} color="#1E40AF" />
            {/* {notifications > 0 && <View style={styles.notifDot} />} */}
          </TouchableOpacity>
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
            {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileImageContainer}>
              {profileImage ? (
                <Image 
                  source={{ uri: profileImage }} 
                  style={styles.profileImage}
                  // defaultSource={require('../../../assets/default-avatar.png')}
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Text style={styles.profileImageText}>
                    {name ? safeDataAccess.getUserInitials({ name }, 'DR') : 'DR'}
                  </Text>
                </View>
              )}
            </View>
                         <View style={styles.profileInfo}>
               <Text style={styles.userName}>Dr. {name || 'Unknown Doctor'}</Text>
               <Text style={styles.userSpecialty}>{specialization || 'General Medicine'}</Text>
               {experience && <Text style={styles.experience}>{experience} experience</Text>}
             </View>
          </View>
          
                     {/* Essential Contact Info */}
           <View style={styles.contactInfo}>
             <View style={styles.contactItems}>
               {memoizedClinicNames.length > 0 && (
                 <View style={styles.contactItem}>
                   <Building size={16} color="#6B7280" />
                   <Text style={styles.contactText}>
                     {memoizedClinicNames.slice(0, 2).join(', ')}
                     {memoizedClinicNames.length > 2 ? ` +${memoizedClinicNames.length - 2} more` : ''}
                   </Text>
                 </View>
               )}
               <View style={styles.contactItem}>
                 <Mail size={16} color="#6B7280" />
                 <Text style={styles.contactText}>{email || 'Email not provided'}</Text>
               </View>
               {phone && (
                 <View style={styles.contactItem}>
                   <Phone size={16} color="#6B7280" />
                   <Text style={styles.contactText}>{phone}</Text>
                 </View>
               )}
             </View>
           </View>
        </View>



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
            {professionalFee && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Professional Fee:</Text>
                <Text style={styles.infoValue}>{professionalFee}</Text>
              </View>
            )}
            {status && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status:</Text>
                <Text style={[styles.infoValue, { color: status === 'pending' ? '#F59E0B' : '#10B981' }]}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity 
            style={styles.viewFullProfileButton}
            onPress={() => setShowFullProfileModal(true)}
          >
            <Text style={styles.viewFullProfileText}>View Full Profile</Text>
            <ChevronRight size={16} color="#1E40AF" />
          </TouchableOpacity>
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
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditing ? 'Edit Profile' : 'Full Profile'}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowFullProfileModal(false);
                  setIsEditing(false);
                }}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <View style={styles.modalContentWrapper}>
              <ScrollView 
                style={styles.modalScrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalContent}
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
                      <View style={styles.modalProfileInfo}>
                        <Text style={styles.modalEditModeIndicator}>✏️ Edit Mode</Text>
                        <Input
                          value={editableData.name}
                          onChangeText={(text) => setEditableData(prev => ({ ...prev, name: text }))}
                          placeholder="Enter your full name"
                          style={styles.inlineInput}
                          inputStyle={styles.inlineInputText}
                        />
                        <Input
                          value={editableData.specialization}
                          onChangeText={(text) => setEditableData(prev => ({ ...prev, specialization: text }))}
                          placeholder="Enter specialization"
                          style={styles.inlineInput}
                          inputStyle={styles.inlineInputText}
                        />
                        <Input
                          value={editableData.experience}
                          onChangeText={(text) => setEditableData(prev => ({ ...prev, experience: text }))}
                          placeholder="Enter years of experience"
                          keyboardType="numeric"
                          style={styles.inlineInput}
                          inputStyle={styles.inlineInputText}
                        />
                      </View>
                    </View>

                    {/* Personal Information */}
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Personal Information</Text>
                      <View style={styles.modalInfoGrid}>
                        <View style={styles.modalInfoItem}>
                          <Text style={styles.modalInfoLabel}>Gender</Text>
                          <Dropdown
                            options={genderOptions}
                            value={editableData.gender}
                            onValueChange={(value) => setEditableData(prev => ({ ...prev, gender: value }))}
                            placeholder="Select gender"
                            style={styles.inlineInput}
                          />
                        </View>
                        <View style={styles.modalInfoItem}>
                          <Text style={styles.modalInfoLabel}>Date of Birth</Text>
                          <DatePicker
                            value={editableData.dateOfBirth}
                            onValueChange={(value) => setEditableData(prev => ({ ...prev, dateOfBirth: value }))}
                            placeholder="Select date of birth"
                            style={styles.inlineInput}
                          />
                        </View>
                        <View style={styles.modalInfoItem}>
                          <Text style={styles.modalInfoLabel}>Civil Status</Text>
                          <Dropdown
                            options={civilStatusOptions}
                            value={editableData.civilStatus}
                            onValueChange={(value) => setEditableData(prev => ({ ...prev, civilStatus: value }))}
                            placeholder="Select civil status"
                            style={styles.inlineInput}
                          />
                        </View>
                      </View>
                    </View>

                    {/* Contact Information */}
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Contact Information</Text>
                      <View style={styles.modalContactList}>
                        <View style={styles.modalContactItem}>
                          <Mail size={18} color="#6B7280" />
                          <Input
                            value={editableData.email}
                            onChangeText={(text) => setEditableData(prev => ({ ...prev, email: text }))}
                            placeholder="Enter email"
                            keyboardType="email-address"
                            style={styles.inlineInput}
                            inputStyle={styles.inlineInputText}
                          />
                        </View>
                        <View style={styles.modalContactItem}>
                          <Phone size={18} color="#6B7280" />
                          <Input
                            value={editableData.phone}
                            onChangeText={(text) => setEditableData(prev => ({ ...prev, phone: text }))}
                            placeholder="Enter phone number"
                            keyboardType="phone-pad"
                            style={styles.inlineInput}
                            inputStyle={styles.inlineInputText}
                          />
                        </View>
                        <View style={styles.modalContactItem}>
                          <MapPin size={18} color="#6B7280" />
                          <Input
                            value={editableData.address}
                            onChangeText={(text) => setEditableData(prev => ({ ...prev, address: text }))}
                            placeholder="Enter address"
                            multiline
                            numberOfLines={3}
                            style={styles.inlineInput}
                            inputStyle={styles.inlineInputText}
                          />
                        </View>
                      </View>
                    </View>

                    {/* Professional Information */}
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Professional Information</Text>
                      <View style={styles.modalInfoList}>
                        <View style={styles.modalInfoRow}>
                          <Text style={styles.modalInfoLabel}>License Number</Text>
                          <Input
                            value={editableData.medicalLicenseNumber}
                            onChangeText={(text) => setEditableData(prev => ({ ...prev, medicalLicenseNumber: text }))}
                            placeholder="Enter license number"
                            style={styles.inlineInput}
                            inputStyle={styles.inlineInputText}
                          />
                        </View>
                        <View style={styles.modalInfoRow}>
                          <Text style={styles.modalInfoLabel}>PRC ID</Text>
                          <Input
                            value={editableData.prcId}
                            onChangeText={(text) => setEditableData(prev => ({ ...prev, prcId: text }))}
                            placeholder="Enter PRC ID"
                            style={styles.inlineInput}
                            inputStyle={styles.inlineInputText}
                          />
                        </View>
                        <View style={styles.modalInfoRow}>
                          <Text style={styles.modalInfoLabel}>PRC Expiry Date</Text>
                          <DatePicker
                            value={editableData.prcExpiryDate}
                            onValueChange={(value) => setEditableData(prev => ({ ...prev, prcExpiryDate: value }))}
                            placeholder="Select expiry date"
                            style={styles.inlineInput}
                          />
                        </View>
                        <View style={styles.modalInfoRow}>
                          <Text style={styles.modalInfoLabel}>Professional Fee</Text>
                          <Input
                            value={editableData.professionalFee}
                            onChangeText={(text) => setEditableData(prev => ({ ...prev, professionalFee: text }))}
                            placeholder="Enter professional fee"
                            keyboardType="numeric"
                            style={styles.inlineInput}
                            inputStyle={styles.inlineInputText}
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
                        {professionalFee && (
                          <View style={styles.modalInfoRow}>
                            <Text style={styles.modalInfoLabel}>Professional Fee</Text>
                            <Text style={styles.modalInfoValue}>{professionalFee}</Text>
                          </View>
                        )}
                        {status && (
                          <View style={styles.modalInfoRow}>
                            <Text style={styles.modalInfoLabel}>Status</Text>
                            <Text style={[
                              styles.modalInfoValue, 
                              { color: status === 'pending' ? '#F59E0B' : '#10B981' }
                            ]}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </Text>
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
              <View style={styles.floatingButtonsContainer}>
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
            ) : (
              <View style={styles.floatingButtonsContainer}>
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
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollView: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#FFF',
  },
  headerTitle: {
    fontSize: 24,
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
  },
  bellButton: {
    padding: 7,
    borderRadius: 18,
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    right: 2,
    top: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    zIndex: 20,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  profileCard: {
    backgroundColor: '#F9FAFB',
    margin: 24,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 15,
  },
  profileHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  profileImageContainer: {
    marginRight: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: 'Inter-Bold',
  },
  profileInfo: { flex: 1, justifyContent: 'center' },
  userName: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 3,
  },
  userSpecialty: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
    marginBottom: 2,
  },
  licenseNumber: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
    marginBottom: 2,
  },
     experience: {
     fontSize: 14,
     fontFamily: 'Inter-Regular',
     color: '#6B7280',
   },
   clinicAffiliationsContainer: {
     marginTop: 8,
   },
   clinicAffiliationsLabel: {
     fontSize: 12,
     fontFamily: 'Inter-Medium',
     color: '#6B7280',
     marginBottom: 2,
   },
   clinicAffiliationsText: {
     fontSize: 13,
     fontFamily: 'Inter-Regular',
     color: '#374151',
     lineHeight: 16,
   },
  personalInfoSection: {
    marginBottom: 20,
  },
  personalInfoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  personalInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  personalInfoItem: {
    flex: 1,
    minWidth: '45%',
  },
  personalInfoLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 4,
  },
  personalInfoValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  contactInfo: { 
    marginTop: 16,
  },
  contactInfoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  contactItems: {
    gap: 12,
  },
  contactItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  contactText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
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
    padding: 24,
    paddingBottom: 32,
  },
  modalProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
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
  editProfileButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  editButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    textAlign: 'center',
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
});
