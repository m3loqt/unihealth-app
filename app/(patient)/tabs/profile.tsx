import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar,
  Alert,
  Modal,
  Linking,
  StyleSheet,
  Dimensions,
} from 'react-native';
import {
  Bell,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  LogOut,
  Lock,
  BookOpen,
  CircleHelp as HelpCircle,
  Trash2,
  Fingerprint,
  Check,
  RefreshCw,
  DoorOpen,
  ChevronLeft,
  Edit,
} from 'lucide-react-native';
import {
  checkBiometricSupport,
  saveBiometricCredentials,
  getBiometricCredentials,
  deleteBiometricCredentials,
  isBiometricLoginAvailable,
  getBiometricUnavailableReason,
} from '@/hooks/auth/useBiometricAuth';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth/useAuth';
import { usePatientProfile } from '@/hooks/data/usePatientProfile';
import { useRealtimeNotificationContext } from '@/contexts/RealtimeNotificationContext';
import { getSafeNotifications, getSafeUnreadCount } from '@/utils/notificationUtils';
import { GlobalNotificationModal } from '@/components/shared';
import { safeDataAccess } from '@/utils/safeDataAccess';
import { capitalizeRelationship } from '@/utils/formatting';
import { RealTimeTest } from '@/components/RealTimeTest';
import { databaseService } from '@/services/database/firebase';

// Default profile data
const defaultProfileData = {
  fullName: 'User',
  dob: 'Not provided',
  address: 'Not provided',
  contact: 'Not provided',
  email: 'Not provided',
  memberSince: '2024',
  profileImg: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150',
  emergency: {
    name: 'Not provided',
    relationship: 'Not provided',
    phone: 'Not provided',
  },
};

const BLUE = '#1E40AF';
const LIGHT_BLUE = '#DBEAFE';
const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, error: profileError } = usePatientProfile();
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

  // Initials for profile avatar header
  const userInitials = (() => {
    const fullName = safeDataAccess.getUserFullName(user, user?.email || 'User');
    return fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || 'U';
  })();

  // Debug logging
  React.useEffect(() => {
    console.log('🔔 Patient Profile - Notifications state:', {
      count: notifications.length,
      loading: notificationsLoading,
      error: notificationsError,
      unreadCount: notifications.filter(n => !n.read).length
    });
  }, [notifications, notificationsLoading, notificationsError]);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricCredentialsSaved, setBiometricCredentialsSaved] = useState(false);
  const [biometricUnavailableReason, setBiometricUnavailableReason] = useState('');
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

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

  // const [notifications, setNotifications] = useState([
  //   { id: 1, text: 'Your appointment with Dr. Lee is confirmed for Aug 4, 2:30 PM.', read: false },
  //   { id: 2, text: 'Lab results are now available.', read: true },
  //   { id: 3, text: 'Prescription refill reminder: Lisinopril.', read: false },
  // ]);

  // Use real-time profile data from hook or fallback to default
  const profileData = profile ? {
    fullName: profile.firstName && profile.lastName ? `${profile.firstName} ${profile.lastName}` : 'Unknown User',
    dob: profile.dateOfBirth || 'Not provided',
    address: profile.address || 'Not provided',
    contact: profile.contactNumber || 'Not provided',
    email: profile.email || 'Not provided',
    memberSince: '2024',
    emergency: profile.emergencyContact ? {
      name: profile.emergencyContact.name || 'Not provided',
      relationship: capitalizeRelationship(profile.emergencyContact.relationship) || 'Not provided',
      phone: profile.emergencyContact.phone || 'Not provided',
    } : {
      name: 'Not provided',
      relationship: 'Not provided',
      phone: 'Not provided',
    },
    profileImg: defaultProfileData.profileImg,
  } : defaultProfileData;

  // Debug logging
  React.useEffect(() => {
    if (profile) {
      console.log('=== PROFILE SCREEN: Profile data received ===');
      console.log('Raw profile:', profile);
      console.log('Profile address:', profile.address);
      console.log('Profile contactNumber:', profile.contactNumber);
      console.log('Profile address type:', typeof profile.address);
      console.log('Profile address length:', profile.address?.length);
      console.log('Processed profileData:', profileData);
      console.log('Display address:', profileData.address);
      console.log('Display contact:', profileData.contact);
      console.log('Address field in profileData:', profileData.address);
      console.log('==========================================');
    }
  }, [profile, profileData]);

  const {
    fullName,
    dob,
    address,
    contact,
    email,
    memberSince,
    emergency,
    profileImg,
  } = profileData;

  const calcAge = (dobStr: string) => {
    if (!dobStr || dobStr === 'Not provided') return null;
    try {
      let dobDate;
      if (dobStr.includes('/')) {
        const parts = dobStr.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1;
          const year = parseInt(parts[2]);
          if (day && month >= 0 && month <= 11 && year) {
            dobDate = new Date(year, month, day);
          } else return null;
        } else return null;
      } else {
        dobDate = new Date(dobStr);
      }
      if (isNaN(dobDate.getTime())) return null;
      const today = new Date();
      const diffMs = today.getTime() - dobDate.getTime();
      const ageDt = new Date(diffMs);
      const age = Math.abs(ageDt.getUTCFullYear() - 1970);
      return `${age} years old`;
    } catch {
      return null;
    }
  };

  const handleEmergencyCall = () => Linking.openURL(`tel:${emergency.phone}`);

  React.useEffect(() => { checkBiometricStatus(); }, []);
  React.useEffect(() => {
    const updateBiometricStatus = async () => {
      const isAvailable = await isBiometricLoginAvailable();
      setBiometricCredentialsSaved(isAvailable);
    };
    updateBiometricStatus();
  }, [user]);

  const checkBiometricStatus = async () => {
    try {
      const biometricSupport = await checkBiometricSupport();
      const savedCredentials = await getBiometricCredentials();
      const unavailableReason = await getBiometricUnavailableReason();
      setBiometricAvailable(biometricSupport.hasHardware);
      setBiometricEnrolled(biometricSupport.isEnrolled);
      setBiometricCredentialsSaved(savedCredentials !== null);
      setBiometricUnavailableReason(unavailableReason);
    } catch {
      setBiometricAvailable(false);
      setBiometricEnrolled(false);
      setBiometricCredentialsSaved(false);
    }
  };

  const handleBiometricToggle = async () => {
    if (biometricCredentialsSaved) {
      Alert.alert(
        'Disable Biometric Login',
        'Are you sure you want to disable biometric login? You will need to sign in with your password next time.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disable', style: 'destructive', onPress: handleBiometricDisable },
        ]
      );
    } else {
      if (!biometricAvailable || !biometricEnrolled) {
        setShowBiometricModal(true);
        return;
      }
      const isAvailable = await isBiometricLoginAvailable();
      if (isAvailable) {
        setBiometricCredentialsSaved(true);
        Alert.alert('Success', 'Biometric login is already enabled!');
        return;
      }
      const biometricSupport = await checkBiometricSupport();
      if (!biometricSupport.hasHardware) {
        Alert.alert('Biometric Not Supported', 'Your device does not support biometric authentication (fingerprint or Face ID).', [{ text: 'OK', style: 'default' }]);
        return;
      }
      if (!biometricSupport.isEnrolled) {
        Alert.alert('Set Up Biometric Authentication', 'Please set up fingerprint or Face ID in your device settings first, then try again.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              Alert.alert('Device Settings', 'Go to Settings > Face ID & Passcode (or Touch ID & Passcode) and set up biometric authentication.', [{ text: 'OK', style: 'default' }]);
            },
          },
        ]);
        return;
      }
      Alert.alert(
        'Enable Biometric Login',
        'To enable biometric login, please sign out and sign in again. You will be prompted to set up biometric authentication during the login process.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: handleLogout },
        ]
      );
    }
  };

  const handleBiometricDisable = async () => {
    const success = await deleteBiometricCredentials();
    if (success) {
      setBiometricCredentialsSaved(false);
      router.replace('../');
    } else {
      Alert.alert('Error', 'Failed to disable biometric login.');
      router.replace('../');
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = async () => {
    try {
      await signOut();
      setShowLogoutModal(false);
      setTimeout(() => {
        router.replace('/');
      }, 100);
    } catch {
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  const settingsItems = [
    {
      icon: Fingerprint,
      title: biometricCredentialsSaved ? 'Disable Biometric Login' : 'Enable Biometric Login',
      color: BLUE,
      onPress: handleBiometricToggle,
      disabled: !biometricAvailable || !biometricEnrolled,
    },
    {
      icon: Lock,
      title: 'Change Password',
      color: BLUE,
      onPress: () => router.push('/(auth)/change-password'),
    },
    {
      icon: Bell,
      title: 'Notification Preferences',
      color: BLUE,
      onPress: () => Alert.alert('Notification Preferences', 'This feature is not yet implemented.', [{ text: 'OK' }]),
    },
    {
      icon: HelpCircle,
      title: 'Help & Support',
      color: BLUE,
      onPress: () => router.push('/(shared)/help-support'),
    },
    {
      icon: BookOpen,
      title: 'Terms & Privacy Policy',
      color: BLUE,
      onPress: () => router.push('/(shared)/terms-privacy'),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Biometric Setup Information Modal */}
      <Modal
        visible={showBiometricModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowBiometricModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Fingerprint size={32} color={BLUE} />
                <Text style={styles.modalTitle}>Biometric Setup</Text>
                <Text style={styles.modalText}>
                  {biometricUnavailableReason || 'Biometric authentication is not available on this device.'}
                </Text>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalSecondaryButton}
                  onPress={() => setShowBiometricModal(false)}
                >
                  <Text style={styles.modalSecondaryButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Global Notification Modal */}
      <GlobalNotificationModal
        visible={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        userRole="patient"
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
                 <DoorOpen size={36} color={BLUE} />
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

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Custom Profile Header */}
        <View style={styles.customHeader}>
          <View style={styles.customHeaderBackground} />
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
              onPress={() => router.push('/(patient)/edit-profile')}
            >
              <Edit size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          {/* Profile Header Section */}
          <View style={styles.profileHeaderSection}>
            <View style={styles.profileImageContainer}>
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileImageText}>
                  {userInitials}
                </Text>
              </View>
            </View>
            <Text style={styles.profileName}>{fullName}</Text>
            <Text style={styles.profileEmail}>{email}</Text>
          </View>
        </View>



        {/* Emergency Contact */}
        {!profileLoading && !profileError && (
          <View style={[styles.card, styles.emergencyContactCard]}>
            <View style={styles.emergencyHeaderRow}>
              <Text style={styles.sectionTitle}>Emergency Contact</Text>
              <View style={styles.relationshipTagFixed}>
                <Text style={styles.relationshipTagText}>{capitalizeRelationship(emergency.relationship)}</Text>
              </View>
            </View>
            <View style={styles.emergencyCard}>
              <View style={styles.emergencyHeader}>
                <View style={styles.emergencyAvatar}>
                  <Text style={styles.emergencyInitial}>
                    {safeDataAccess.getUserInitials({ name: emergency.name }, 'E')}
                  </Text>
                </View>
                <View style={styles.emergencyInfo}>
                  <Text style={styles.emergencyName}>{emergency.name}</Text>
                  <Text style={styles.emergencyPhone}>{emergency.phone}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.emergencyCallButton}
                onPress={handleEmergencyCall}
              >
                <Phone size={16} color="#FFFFFF" />
                <Text style={styles.emergencyCallText}>Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Personal Information */}
        {/* {!profileLoading && !profileError && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Date of Birth:</Text>
                <Text style={styles.infoValue}>{dob}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Age:</Text>
                <Text style={styles.infoValue}>{calcAge(dob) || 'Not provided'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone:</Text>
                <Text style={styles.infoValue}>{contact}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address:</Text>
                <Text style={styles.infoValue}>{address}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Member Since:</Text>
                <Text style={styles.infoValue}>{memberSince}</Text>
              </View>
            </View>
          </View>
        )} */}

        {/* Settings */}
        {!profileLoading && !profileError && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Settings</Text>
            <View style={styles.menuContainer}>
              {settingsItems.map((item) => (
                <TouchableOpacity key={item.title} style={styles.menuItem} onPress={item.onPress}>
                  <View style={[styles.menuIcon, { backgroundColor: `${item.color}20` }]}>
                    <item.icon size={20} color={item.color} />
                  </View>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <ChevronRight size={20} color={BLUE} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.logoutItem, { zIndex: 10 }]}
                onPress={handleLogout}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#1E40AF20' }]}>
                  <LogOut size={20} color={BLUE} />
                </View>
                <Text style={styles.menuTitle}>Logout</Text>
                <ChevronRight size={20} color={BLUE} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollView: { 
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  // Custom Header Styles
  customHeader: {
    backgroundColor: '#1E40AF',
    paddingTop: Platform.OS === 'ios' ? 20 : 20,
    paddingBottom: 20,
    paddingHorizontal: 24,
    marginBottom: 10,
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
    marginBottom: 20,
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
    marginBottom: 8,
    textAlign: 'center',
  },
  profileEmail: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  // Personal Information Styles
  // infoGrid: {
  //   marginTop: 8,
  // },
  // infoRow: {
  //   flexDirection: 'row',
  //   justifyContent: 'space-between',
  //   alignItems: 'center',
  //   paddingVertical: 12,
  //   borderBottomWidth: 1,
  //   borderBottomColor: '#F3F4F6',
  // },
  // infoLabel: {
  //   fontSize: 14,
  //   fontFamily: 'Inter-Medium',
  //   color: '#374151',
  //   flex: 1,
  // },
  // infoValue: {
  //   fontSize: 14,
  //   fontFamily: 'Inter-Regular',
  //   color: '#1F2937',
  //   flex: 1,
  //   textAlign: 'right',
  // },
  card: {
    backgroundColor: '#F9FAFB',
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emergencyContactCard: {
    marginTop: -30,
    zIndex: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 0,
  },
  // Emergency Header Row: for header + right-aligned relationship
  emergencyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    position: 'relative',
  },
  relationshipTagFixed: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: '#EFF6FF',
    borderColor: LIGHT_BLUE,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-end',
    minWidth: 68,
    alignItems: 'flex-end',
  },
  relationshipTagText: {
    color: BLUE,
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  emergencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
    gap: 0,
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  emergencyAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginRight: 7, // Less margin-right for more compact
  },
  emergencyInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  emergencyInfo: { flex: 1 },
  emergencyName: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginTop: 20,
  },
  emergencyPhone: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 5,
  },
  emergencyCallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BLUE,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 20,
    gap: 6,
  },
  emergencyCallText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
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
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    alignItems: 'center',
    paddingBottom: 24,
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
  modalText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  modalSubtext: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  modalPrimaryButton: {
    flex: 1,
    backgroundColor: BLUE,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
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
  // Loading and Error States
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: BLUE,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalActionButtonText: {
    color: BLUE,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    marginLeft: 8,
  },
  notifDot: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  notifDotText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
});
 