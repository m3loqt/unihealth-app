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
} from 'lucide-react-native';
import {
  checkBiometricSupport,
  saveBiometricCredentials,
  getBiometricCredentials,
  deleteBiometricCredentials,
  isBiometricLoginAvailable,
  getBiometricUnavailableReason,
} from '@/src/hooks/auth/useBiometricAuth';
import { router } from 'expo-router';
import { useAuth } from '@/src/hooks/auth/useAuth';

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

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationCenterVisible, setNotificationCenterVisible] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'Your appointment with Dr. Lee is confirmed for Aug 4, 2:30 PM.' },
    { id: 2, text: 'Lab results are now available.' },
    { id: 3, text: 'Prescription refill reminder: Lisinopril.' },
  ]);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricCredentialsSaved, setBiometricCredentialsSaved] = useState(false);
  const [biometricUnavailableReason, setBiometricUnavailableReason] = useState('');
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  // Use user data from database or fallback to default
  const profileData = user ? {
    fullName: user.name || 'User',
    dob: user.dateOfBirth || 'Not provided',
    address: user.address || 'Not provided',
    contact: user.phone || 'Not provided',
    email: user.email || 'Not provided',
    memberSince: '2024',
    emergency: user.emergencyContact ? {
      name: user.emergencyContact.name || 'Not provided',
      relationship: user.emergencyContact.relationship || 'Not provided',
      phone: user.emergencyContact.phone || 'Not provided',
    } : {
      name: 'Not provided',
      relationship: 'Not provided',
      phone: 'Not provided',
    },
    profileImg: defaultProfileData.profileImg,
  } : defaultProfileData;

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
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            setTimeout(() => {
              Alert.alert('Success', 'You have been logged out successfully.', [
                { text: 'OK', onPress: () => router.replace('/') },
              ]);
            }, 100);
          } catch {
            Alert.alert('Error', 'Failed to logout. Please try again.');
          }
        },
      },
    ]);
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
      onPress: () => setShowNotificationModal(true),
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

  const handleDeleteNotification = (id: number) => setNotifications(notifications.filter((n) => n.id !== id));

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Notification Center Dropdown */}
      {notificationCenterVisible && (
        <View style={styles.notificationsDropdownBackdrop}>
          <TouchableOpacity
            style={styles.notificationsDropdownBackdropTouchable}
            activeOpacity={1}
            onPress={() => setNotificationCenterVisible(false)}
          />
          <View style={styles.notificationsDropdown}>
            <Text style={styles.dropdownHeader}>Notifications</Text>
            {notifications.length === 0 ? (
              <Text style={styles.emptyNotifText}>No notifications</Text>
            ) : (
              notifications.map((notif) => (
                <View key={notif.id} style={styles.dropdownNotifItem}>
                  <Text style={styles.notifText}>{notif.text}</Text>
                  <TouchableOpacity onPress={() => handleDeleteNotification(notif.id)}>
                    <Trash2 size={18} color={BLUE} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      )}

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
                <Text style={styles.modalTitle}>Biometric Login Unavailable</Text>
                <Text style={styles.modalText}>
                  {biometricUnavailableReason}
                </Text>
                <Text style={styles.modalSubtext}>
                  {biometricUnavailableReason.includes('not supported')
                    ? 'Your device does not have fingerprint or Face ID capabilities.'
                    : biometricUnavailableReason.includes('set up')
                    ? 'Please set up biometric authentication in your device settings first.'
                    : 'Please check your device settings and try again.'
                  }
                </Text>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalPrimaryButton}
                  onPress={() => setShowBiometricModal(false)}
                >
                  <Text style={styles.modalPrimaryButtonText}>OK</Text>
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
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => setNotificationCenterVisible((v) => !v)}
          >
            <Bell size={28} color={BLUE} />
            {notifications.length > 0 && <View style={styles.notifDot} />}
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Image source={{ uri: profileImg }} style={styles.profileImage} />
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{fullName}</Text>
              {calcAge(dob) && <Text style={styles.userAge}>{calcAge(dob)}</Text>}
              <Text style={styles.memberSince}>Member since {memberSince}</Text>
            </View>
          </View>
          <View style={styles.contactInfo}>
            <View style={styles.contactItem}>
              <Phone size={16} color="#6B7280" />
              <Text style={styles.contactText}>{contact}</Text>
            </View>
            <View style={styles.contactItem}>
              <Mail size={16} color="#6B7280" />
              <Text style={styles.contactText}>{email}</Text>
            </View>
            <View style={styles.contactItem}>
              <MapPin size={16} color="#6B7280" />
              <Text style={styles.contactText}>{address}</Text>
            </View>
          </View>
        </View>

        {/* Emergency Contact */}
        <View style={styles.card}>
          <View style={styles.emergencyHeaderRow}>
            <Text style={styles.sectionTitle}>Emergency Contact</Text>
            <View style={styles.relationshipTagFixed}>
              <Text style={styles.relationshipTagText}>{emergency.relationship}</Text>
            </View>
          </View>
          <View style={styles.emergencyCard}>
            <View style={styles.emergencyHeader}>
              <View style={styles.emergencyAvatar}>
                <Text style={styles.emergencyInitial}>
                  {emergency.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()}
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

        {/* Settings */}
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
      </ScrollView>

      {/* Notification Preferences Modal */}
      <Modal
        visible={showNotificationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNotificationModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Bell size={32} color={BLUE} />
                <Text style={styles.modalTitle}>Enable Notifications</Text>
                <Text style={styles.modalText}>
                  Stay updated with appointment reminders, prescription refills, and important health updates.
                </Text>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalSecondaryButton}
                  onPress={() => setShowNotificationModal(false)}
                >
                  <Text style={styles.modalSecondaryButtonText}>Not Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalPrimaryButton}
                  onPress={() => {
                    setShowNotificationModal(false);
                    Alert.alert('Success', 'Notifications have been enabled!');
                  }}
                >
                  <Text style={styles.modalPrimaryButtonText}>Enable</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  },
  profileHeader: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  profileInfo: { flex: 1, justifyContent: 'center' },
  userName: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  userAge: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  memberSince: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  contactInfo: { gap: 12 },
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  // Emergency Header Row: for header + right-aligned relationship
  emergencyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
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
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 0,
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
  // --- Notifications Dropdown ---
  notificationsDropdownBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 99,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  notificationsDropdownBackdropTouchable: {
    flex: 1,
  },
  notificationsDropdown: {
    position: 'absolute',
    top: 70,
    right: 24,
    width: 320,
    backgroundColor: '#fff',
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#1e2937',
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 12,
    elevation: 12,
    padding: 18,
    paddingBottom: 8,
    zIndex: 100,
  },
  dropdownHeader: {
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    fontSize: 16,
    marginBottom: 8,
  },
  dropdownNotifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    minHeight: 32,
  },
  notifText: {
    flex: 1,
    color: '#374151',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  emptyNotifText: {
    textAlign: 'center',
    color: '#9CA3AF',
    paddingVertical: 18,
    fontSize: 14,
  },
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 8,
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
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
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
});
 