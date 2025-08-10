import React, { useState, useEffect } from 'react';
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
  Alert,
  Image,
} from 'react-native';
import { ChevronLeft, User, Mail, Phone, MapPin, Camera, Heart } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/hooks/auth/useAuth';
import { usePatientProfile } from '../../src/hooks/data/usePatientProfile';
import { safeDataAccess } from '../../src/utils/safeDataAccess';

export default function EditProfileScreen() {
  const { user } = useAuth();
  const { profile, loading: profileLoading, error: profileError, updateProfile } = usePatientProfile();
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    profileImage: '',
    emergencyContact: {
      name: '',
      relationship: '',
      phone: '',
    },
  });
  const [isLoading, setIsLoading] = useState(false);

  // Load profile data from real-time hook
  useEffect(() => {
    if (profile) {
      console.log('=== EDIT PROFILE: Profile data received ===');
      console.log('Raw profile from hook:', profile);
      console.log('Profile contactNumber:', profile.contactNumber);
      console.log('Profile address:', profile.address);
      console.log('Profile address type:', typeof profile.address);
      console.log('Profile address length:', profile.address?.length);
      
      setProfileData({
        fullName: profile.firstName && profile.lastName ? `${profile.firstName} ${profile.lastName}` : profile.firstName || profile.lastName || '',
        email: profile.email || '',
        phone: profile.contactNumber || '',
        address: profile.address || '',
        profileImage: profile.profileImage || '',
        emergencyContact: {
          name: profile.emergencyContact?.name || '',
          relationship: profile.emergencyContact?.relationship || '',
          phone: profile.emergencyContact?.phone || '',
        },
      });
      
      console.log('Profile data set to state:', {
        phone: profile.contactNumber || '',
        address: profile.address || '',
      });
      console.log('Address field set to state:', profile.address || '');
      console.log('==========================================');
    }
  }, [profile]);

  const handleInputChange = (field: string, value: string) => {
    // Prevent changes to read-only fields
    if (field === 'fullName' || field === 'email') {
      return;
    }
    
    setProfileData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEmergencyContactChange = (field: string, value: string) => {
    setProfileData(prev => ({
      ...prev,
      emergencyContact: {
        ...prev.emergencyContact,
        [field]: value,
      },
    }));
  };

  const handleSaveProfile = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in to update your profile.');
      return;
    }

    // Validate required fields
    if (!profileData.fullName.trim()) {
      Alert.alert('Error', 'Full name is required.');
      return;
    }

    if (!profileData.emergencyContact.name.trim()) {
      Alert.alert('Error', 'Emergency contact name is required.');
      return;
    }

    if (!profileData.emergencyContact.phone.trim()) {
      Alert.alert('Error', 'Emergency contact phone number is required.');
      return;
    }

    setIsLoading(true);
    
    try {
      // Prepare the update data
      const updateData = {
        // Update name in both nodes for consistency
        name: profileData.fullName,
        // Update contact number in users node (this is where it's stored)
        contactNumber: profileData.phone,
        // Update address in users node (this is where it's stored)
        address: profileData.address,
        // Update emergency contact in patients node (this is where it's stored)
        emergencyContact: {
          name: profileData.emergencyContact.name.trim(),
          relationship: profileData.emergencyContact.relationship.trim(),
          phone: profileData.emergencyContact.phone.trim(),
        },
        lastUpdated: new Date().toISOString(),
      };

      console.log('=== SAVING PROFILE DATA ===');
      console.log('Current profileData state:', profileData);
      console.log('Sending update data:', updateData);
      console.log('User ID:', user.uid);
      console.log('Address being sent:', updateData.address);
      console.log('Address type being sent:', typeof updateData.address);
      console.log('Address length being sent:', updateData.address?.length);
      console.log('==========================');

      // Update profile using the real-time hook
      await updateProfile(updateData);

      console.log('Profile update completed successfully');
      console.log('After update - profileData state:', profileData);

      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePhoto = () => {
    Alert.alert(
      'Change Profile Photo',
      'Choose an option',
      [
        { text: 'Camera', onPress: () => console.log('Open Camera') },
        { text: 'Photo Library', onPress: () => console.log('Open Gallery') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Profile Photo Section */}
        <View style={styles.photoSection}>
          <View style={styles.photoContainer}>
            {/* <Image 
              source={{ uri: profileData.profileImage || undefined }} 
              style={styles.profilePhoto}
              defaultSource={require('../../assets/default-avatar.png')}
            /> */}
            <TouchableOpacity style={styles.cameraButton} onPress={handleChangePhoto}>
              <Camera size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.photoLabel}>Profile Photo</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name *</Text>
            <View style={styles.inputContainer}>
              <User size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.readOnlyInput]}
                value={profileData.fullName}
                placeholder="Enter your full name"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
                editable={false}
              />
            </View>
            <Text style={styles.readOnlyNote}>This field cannot be edited</Text>
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputContainer}>
              <Mail size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.readOnlyInput]}
                value={profileData.email}
                placeholder="Enter your email"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={false}
              />
            </View>
            <Text style={styles.readOnlyNote}>This field cannot be edited</Text>
          </View>

          {/* Phone */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Contact Number</Text>
            <View style={styles.inputContainer}>
              <Phone size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={profileData.phone}
                onChangeText={(value) => handleInputChange('phone', value)}
                placeholder="Enter your phone number"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Address */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Address</Text>
            <View style={styles.inputContainer}>
              <MapPin size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.addressInput]}
                value={profileData.address}
                onChangeText={(value) => handleInputChange('address', value)}
                placeholder="Enter your address"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Emergency Contact Section */}
          <View style={styles.sectionHeader}>
            <Heart size={20} color="#EF4444" />
            <Text style={styles.sectionTitle}>Emergency Contact</Text>
          </View>

          {/* Emergency Contact Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Emergency Contact Name *</Text>
            <View style={styles.inputContainer}>
              <User size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={profileData.emergencyContact.name}
                onChangeText={(value) => handleEmergencyContactChange('name', value)}
                placeholder="Enter emergency contact name"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Emergency Contact Relationship */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Relationship</Text>
            <View style={styles.inputContainer}>
              <Heart size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={profileData.emergencyContact.relationship}
                onChangeText={(value) => handleEmergencyContactChange('relationship', value)}
                placeholder="e.g., Spouse, Parent, Sibling"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Emergency Contact Phone */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Emergency Contact Phone *</Text>
            <View style={styles.inputContainer}>
              <Phone size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={profileData.emergencyContact.phone}
                onChangeText={(value) => handleEmergencyContactChange('phone', value)}
                placeholder="Enter emergency contact phone"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSaveProfile}
          disabled={isLoading}
        >
          <Text style={styles.saveButtonText}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#F9FAFB',
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E5E7EB',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  photoLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  formSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 20,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    paddingVertical: 0,
  },
  readOnlyInput: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  readOnlyNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 4,
    fontStyle: 'italic',
  },
  addressInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  saveButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
});