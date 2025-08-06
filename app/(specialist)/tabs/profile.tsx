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
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';
import { databaseService } from '../../../src/services/database/firebase';

export default function SpecialistProfileScreen() {
  const { user, signOut } = useAuth();
  const [profileData, setProfileData] = useState({
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
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load profile data from Firebase
  useEffect(() => {
    if (user && user.uid) {
      loadProfileData();
    }
  }, [user]);

  const loadProfileData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const specialistProfile = await databaseService.getSpecialistProfile(user.uid);
      
      if (specialistProfile) {
        console.log('Specialist profile loaded:', specialistProfile);
        setProfileData({
          name: `${specialistProfile.firstName || ''} ${specialistProfile.lastName || ''}`.trim() || user.name || '',
          email: specialistProfile.email || user.email || '',
          phone: specialistProfile.contactNumber || '',
          address: specialistProfile.address || '',
          specialization: specialistProfile.specialty || '',
          experience: specialistProfile.yearsOfExperience && specialistProfile.yearsOfExperience > 0 ? `${specialistProfile.yearsOfExperience} years` : '',
          profileImage: specialistProfile.profileImageUrl || '',
          medicalLicenseNumber: specialistProfile.medicalLicenseNumber || '',
          prcId: specialistProfile.prcId || '',
          prcExpiryDate: specialistProfile.prcExpiryDate || '',
          professionalFee: specialistProfile.professionalFee ? `₱${specialistProfile.professionalFee}` : '',
          gender: specialistProfile.gender || '',
          dateOfBirth: specialistProfile.dateOfBirth || '',
          civilStatus: specialistProfile.civilStatus || '',
          status: specialistProfile.status || '',
        });
      } else {
        // Use basic user data if no specialist profile exists
        setProfileData({
          name: user.name || '',
          email: user.email || '',
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
        });
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
      Alert.alert('Error', 'Failed to load profile data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfileData();
    setRefreshing(false);
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
  } = profileData;

  return (
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

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Image source={{ uri: profileImage }} style={styles.profileImage} />
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{name}</Text>
                             <Text style={styles.userSpecialty}>{specialization}</Text>
               {/* License number directly under specialty */}
         
               {experience && <Text style={styles.experience}>{experience} experience</Text>}
            </View>
          </View>
          <View style={styles.contactInfo}>
            <View style={styles.contactItem}>
              <Phone size={16} color="#6B7280" />
              <Text style={styles.contactText}>{phone}</Text>
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
                <Text style={styles.infoLabel}>PRC Expiry:</Text>
                <Text style={styles.infoValue}>{new Date(prcExpiryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
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
        </View>

        {/* Personal Information */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.infoList}>
            {gender && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Gender:</Text>
                <Text style={styles.infoValue}>{gender.charAt(0).toUpperCase() + gender.slice(1)}</Text>
              </View>
            )}
            {dateOfBirth && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Date of Birth:</Text>
                <Text style={styles.infoValue}>{new Date(dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
              </View>
            )}
            {civilStatus && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Civil Status:</Text>
                <Text style={styles.infoValue}>{civilStatus.charAt(0).toUpperCase() + civilStatus.slice(1)}</Text>
              </View>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    marginBottom: 14,
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
});
