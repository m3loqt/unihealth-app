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
  FileText,
  Pill,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '../../../src/hooks/auth/useAuth';

// Static data for the specialist
const specialistData = {
  fullName: 'Dr. Sarah Johnson',
  specialty: 'Cardiologist',
  licenseNumber: 'MD-12345-CA',
  yearsOfExperience: '15 years',
  address: '456 Medical Plaza, Suite 200, San Francisco, CA',
  contact: '+1 (555) 987-6543',
  email: 'dr.sarah.johnson@hospital.com',
  hospital: 'San Francisco General Hospital',
  education: 'MD from Stanford University',
  profileImg: 'https://randomuser.me/api/portraits/women/68.jpg',
};

export default function SpecialistProfileScreen() {
  const [notifications] = useState(2);
  const { signOut } = useAuth();

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            // First sign out
            await signOut();
            
            // Small delay to ensure logout completes
            setTimeout(() => {
              // Show success message
              Alert.alert('Success', 'You have been logged out successfully.', [
                {
                  text: 'OK',
                  onPress: () => {
                    // Navigate to login screen and clear navigation stack
                    router.replace('/');
                  },
                },
              ]);
            }, 100);
          } catch (error) {
            Alert.alert('Error', 'Failed to logout. Please try again.');
          }
        },
      },
    ]);
  };

  const quickActions = [
    {
      icon: Pill,
      title: 'Prescriptions',
      color: '#1E40AF',
      onPress: () => router.push('/(specialist)/tabs/appointments'),
    },
    {
      icon: FileText,
      title: 'Medical Certificates',
      color: '#1E40AF',
      onPress: () => router.push('/(specialist)/tabs/patients'),
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
    fullName,
    specialty,
    licenseNumber,
    yearsOfExperience,
    address,
    contact,
    email,
    hospital,
    education,
    profileImg,
  } = specialistData;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity style={styles.bellButton}>
            <Bell size={28} color="#1E40AF" />
            {notifications > 0 && <View style={styles.notifDot} />}
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Image source={{ uri: profileImg }} style={styles.profileImage} />
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{fullName}</Text>
              <Text style={styles.userSpecialty}>{specialty}</Text>
              {/* License number directly under specialty */}
              <Text style={styles.licenseNumber}>License No.: {licenseNumber}</Text>
              <Text style={styles.experience}>{yearsOfExperience} experience</Text>
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

        {/* Professional Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Professional Information</Text>
          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>License No.:</Text>
              <Text style={styles.infoValue}>{licenseNumber}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Hospital:</Text>
              <Text style={styles.infoValue}>{hospital}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Education:</Text>
              <Text style={styles.infoValue}>{education}</Text>
            </View>
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
            <TouchableOpacity style={styles.logoutItem} onPress={handleLogout}>
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
    marginBottom: 0,
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
