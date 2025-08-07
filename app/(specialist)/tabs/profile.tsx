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
    clinicAffiliations: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFullProfileModal, setShowFullProfileModal] = useState(false);
  const [clinicNames, setClinicNames] = useState<string[]>([]);

  // Load profile data from Firebase
  useEffect(() => {
    if (user && user.uid) {
      loadProfileData();
    }
  }, [user]);

  const fetchClinicNames = async (clinicIds: string[]) => {
    try {
      const names: string[] = [];
      for (const clinicId of clinicIds) {
        // Check if it's already a clinic name (string) or a clinic ID
        if (typeof clinicId === 'string' && !clinicId.startsWith('-')) {
          // It's already a clinic name
          names.push(clinicId);
        } else {
          // It's a clinic ID, fetch the clinic data
          const clinicData = await databaseService.getDocument(`clinics/${clinicId}`);
          if (clinicData && clinicData.name) {
            names.push(clinicData.name);
          }
        }
      }
      setClinicNames(names);
    } catch (error) {
      console.error('Error fetching clinic names:', error);
      setClinicNames([]);
    }
  };

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
           clinicAffiliations: specialistProfile.clinicAffiliations || [],
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
           clinicAffiliations: [],
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
          clinicAffiliations,
   } = profileData;

   // Fetch clinic names when clinic affiliations change
   useEffect(() => {
     if (clinicAffiliations && Object.keys(clinicAffiliations).length > 0) {
       fetchClinicNames(Object.values(clinicAffiliations));
     } else {
       setClinicNames([]);
     }
   }, [clinicAffiliations]);

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
            <View style={styles.profileImageContainer}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.profileImage} />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Text style={styles.profileImageText}>
                    {name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : 'DR'}
                  </Text>
                </View>
              )}
            </View>
                         <View style={styles.profileInfo}>
               <Text style={styles.userName}>Dr. {name}</Text>
               <Text style={styles.userSpecialty}>{specialization}</Text>
               {experience && <Text style={styles.experience}>{experience} experience</Text>}
             </View>
          </View>
          
                     {/* Essential Contact Info */}
           <View style={styles.contactInfo}>
             <View style={styles.contactItems}>
               {clinicNames.length > 0 && (
                 <View style={styles.contactItem}>
                   <Building size={16} color="#6B7280" />
                   <Text style={styles.contactText}>
                     {clinicNames.slice(0, 2).join(', ')}
                     {clinicNames.length > 2 && ` +${clinicNames.length - 2} more`}
                   </Text>
                 </View>
               )}
               <View style={styles.contactItem}>
                 <Mail size={16} color="#6B7280" />
                 <Text style={styles.contactText}>{email}</Text>
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
      </ScrollView>

      {/* Full Profile Modal */}
      <Modal
        visible={showFullProfileModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFullProfileModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Full Profile</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowFullProfileModal(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <ScrollView 
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalContent}
            >

              {/* Profile Header */}
              <View style={styles.modalProfileHeader}>
                <View style={styles.modalProfileImageContainer}>
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} style={styles.modalProfileImage} />
                  ) : (
                    <View style={styles.modalProfileImagePlaceholder}>
                      <Text style={styles.modalProfileImageText}>
                        {name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : 'DR'}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.modalProfileInfo}>
                  <Text style={styles.modalUserName}>Dr. {name}</Text>
                  <Text style={styles.modalUserSpecialty}>{specialization || 'Specialist'}</Text>
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
                        {new Date(dateOfBirth).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
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
                    <Text style={styles.modalContactText}>{email}</Text>
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
                         {new Date(prcExpiryDate).toLocaleDateString('en-US', { 
                           year: 'numeric', 
                           month: 'long', 
                           day: 'numeric' 
                         })}
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
                {clinicNames.length > 0 && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Clinic Affiliations</Text>
                    <View style={styles.modalInfoList}>
                      {clinicNames.map((clinicName, index) => (
                        <View key={index} style={styles.modalInfoRow}>
                          <Text style={styles.modalInfoLabel}>Clinic {index + 1}</Text>
                          <Text style={styles.modalInfoValue}>{clinicName}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                

               {/* Edit Profile Button */}
              <TouchableOpacity 
                style={styles.editProfileButton}
                onPress={() => {
                  setShowFullProfileModal(false);
                  Alert.alert('Edit Profile', 'Edit profile functionality will be implemented here.');
                }}
              >
                <Edit size={18} color="#FFFFFF" />
                <Text style={styles.editProfileButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            </ScrollView>
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
});
