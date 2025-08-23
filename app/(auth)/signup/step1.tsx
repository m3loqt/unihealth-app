import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import {
  User,
  Calendar,
  MapPin,
  Phone,
  ChevronDown,
  ChevronLeft,
  Mail,
} from 'lucide-react-native';

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const BLOOD_TYPE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Not known yet'];
const EDUCATIONAL_ATTAINMENT_OPTIONS = [
  'Elementary',
  'High School',
  'Vocational/Technical',
  'Associate Degree',
  'Bachelor\'s Degree',
  'Master\'s Degree',
  'Doctorate',
  'Other'
];
const REQUIRED_FIELDS = [
  { key: 'email', label: 'Email' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'dateOfBirth', label: 'Date of Birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'address', label: 'Address' },
  { key: 'contactNumber', label: 'Contact Number' },
];

// Helper for MM/DD/YYYY input masking
function formatDateOfBirth(value: string) {
  let cleaned = value.replace(/[^\d]/g, '');
  let formatted = '';
  if (cleaned.length >= 3 && cleaned.length <= 4) {
    formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
  } else if (cleaned.length > 4) {
    formatted =
      cleaned.slice(0, 2) +
      '/' +
      cleaned.slice(2, 4) +
      '/' +
      cleaned.slice(4, 8);
  } else {
    formatted = cleaned;
  }
  return formatted;
}

export default function SignUpStep1Screen() {
  const [formData, setFormData] = useState<Record<string, string>>({
    email: '',
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    contactNumber: '',
    highestEducationalAttainment: '',
    bloodType: '',
    allergies: '',
  });
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showEducationalAttainmentModal, setShowEducationalAttainmentModal] = useState(false);
  const [showBloodTypeModal, setShowBloodTypeModal] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const allFieldsFilled = REQUIRED_FIELDS.every(
    f => formData[f.key] && formData[f.key].trim()
  ) && isEmailValid;

  const handleContinue = () => {
    router.push({
      pathname: '/signup/step2',
      params: {
        step1Data: JSON.stringify(formData),
      },
    });
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        Platform.OS === 'android' ? { paddingTop: StatusBar.currentHeight } : null,
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#1E40AF" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Create your account</Text>
            <Text style={styles.headerSubtitle}>Step 1: Personal Details</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '33.33%' }]} />
          </View>
          <Text style={styles.progressText}>1 of 3</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formContainer}>
            {/* First Name */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>First Name</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <View style={styles.inputContainer}>
                <User size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your first name"
                  placeholderTextColor="#9CA3AF"
                  value={formData.firstName}
                  onChangeText={value => handleInputChange('firstName', value)}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Middle Name */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Middle Name</Text>
              </View>
              <View style={styles.inputContainer}>
                <User size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your middle name (optional)"
                  placeholderTextColor="#9CA3AF"
                  value={formData.middleName}
                  onChangeText={value => handleInputChange('middleName', value)}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Last Name */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <View style={styles.inputContainer}>
                <User size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your last name"
                  placeholderTextColor="#9CA3AF"
                  value={formData.lastName}
                  onChangeText={value => handleInputChange('lastName', value)}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Date of Birth */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Date of Birth</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <View style={styles.inputContainer}>
                <Calendar size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor="#9CA3AF"
                  value={formData.dateOfBirth}
                  onChangeText={value =>
                    handleInputChange('dateOfBirth', formatDateOfBirth(value))
                  }
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
            </View>

            {/* Gender */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Gender</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setShowGenderModal(true)}
                activeOpacity={0.7}
              >
                <User size={20} color="#9CA3AF" style={styles.inputIcon} />
                <Text style={[styles.input, !formData.gender && styles.placeholder]}>
                  {formData.gender || 'Select your gender'}
                </Text>
                <ChevronDown size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Address */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Address</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <View style={[styles.inputContainer, styles.addressInputContainer]}>
                <View style={styles.iconTopAlign}>
                  <MapPin size={20} color="#9CA3AF" />
                </View>
                <TextInput
                  style={[styles.input, styles.addressInput]}
                  placeholder="Enter your complete address"
                  placeholderTextColor="#9CA3AF"
                  value={formData.address}
                  onChangeText={value => handleInputChange('address', value)}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* Contact Number */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Contact Number</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <View style={styles.inputContainer}>
                <Phone size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your contact number"
                  placeholderTextColor="#9CA3AF"
                  value={formData.contactNumber}
                  onChangeText={value => handleInputChange('contactNumber', value)}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Highest Educational Attainment */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Highest Educational Attainment</Text>
              </View>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setShowEducationalAttainmentModal(true)}
                activeOpacity={0.7}
              >
                <User size={20} color="#9CA3AF" style={styles.inputIcon} />
                <Text style={[styles.input, !formData.highestEducationalAttainment && styles.placeholder]}>
                  {formData.highestEducationalAttainment || 'Select your highest educational attainment'}
                </Text>
                <ChevronDown size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Blood Type */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Blood Type</Text>
              </View>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setShowBloodTypeModal(true)}
                activeOpacity={0.7}
              >
                <User size={20} color="#9CA3AF" style={styles.inputIcon} />
                <Text style={[styles.input, !formData.bloodType && styles.placeholder]}>
                  {formData.bloodType || 'Select your blood type'}
                </Text>
                <ChevronDown size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Allergies */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Allergies</Text>
              </View>
              <View style={styles.inputContainer}>
                <User size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter allergies (comma-separated)"
                  placeholderTextColor="#9CA3AF"
                  value={formData.allergies}
                  onChangeText={value => handleInputChange('allergies', value)}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Email</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <View style={styles.inputContainer}>
                <Mail size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#9CA3AF"
                  value={formData.email}
                  onChangeText={value => handleInputChange('email', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Continue Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              !allFieldsFilled && styles.buttonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!allFieldsFilled}
            activeOpacity={allFieldsFilled ? 0.85 : 1}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>

        {/* Gender Selection Modal */}
        <Modal
          visible={showGenderModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowGenderModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Gender</Text>
                <View style={styles.genderOptions}>
                  {GENDER_OPTIONS.map((gender) => (
                    <TouchableOpacity
                      key={gender}
                      style={[
                        styles.genderOption,
                        formData.gender === gender && styles.selectedGenderOption
                      ]}
                      onPress={() => {
                        handleInputChange('gender', gender);
                        setShowGenderModal(false);
                      }}
                    >
                      <Text style={[
                        styles.genderOptionText,
                        formData.gender === gender && styles.selectedGenderOptionText
                      ]}>
                        {gender}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* Educational Attainment Selection Modal */}
        <Modal
          visible={showEducationalAttainmentModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowEducationalAttainmentModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Highest Educational Attainment</Text>
                <View style={styles.genderOptions}>
                  {EDUCATIONAL_ATTAINMENT_OPTIONS.map((attainment) => (
                    <TouchableOpacity
                      key={attainment}
                      style={[
                        styles.genderOption,
                        formData.highestEducationalAttainment === attainment && styles.selectedGenderOption
                      ]}
                      onPress={() => {
                        handleInputChange('highestEducationalAttainment', attainment);
                        setShowEducationalAttainmentModal(false);
                      }}
                    >
                      <Text style={[
                        styles.genderOptionText,
                        formData.highestEducationalAttainment === attainment && styles.selectedGenderOptionText
                      ]}>
                        {attainment}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* Blood Type Selection Modal */}
        <Modal
          visible={showBloodTypeModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowBloodTypeModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Blood Type</Text>
                <View style={styles.genderOptions}>
                  {BLOOD_TYPE_OPTIONS.map((bloodType) => (
                    <TouchableOpacity
                      key={bloodType}
                      style={[
                        styles.genderOption,
                        formData.bloodType === bloodType && styles.selectedGenderOption
                      ]}
                      onPress={() => {
                        handleInputChange('bloodType', bloodType);
                        setShowBloodTypeModal(false);
                      }}
                    >
                      <Text style={[
                        styles.genderOptionText,
                        formData.bloodType === bloodType && styles.selectedGenderOptionText
                      ]}>
                        {bloodType}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardAvoid: { flex: 1 },
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
  headerContent: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  headerSpacer: { width: 40 },
  progressContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1E40AF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
  formContainer: { flex: 1 },
  inputGroup: { marginBottom: 20 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  asterisk: {
    fontSize: 14,
    color: '#EF4444',
    marginLeft: 2,
    fontFamily: 'Inter-Medium',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 56,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  placeholder: { color: '#9CA3AF' },
  addressInputContainer: {
    alignItems: 'flex-start',
    minHeight: 80,
    paddingVertical: 12,
  },
  iconTopAlign: { marginRight: 12, marginTop: 4 },
  addressInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 0,
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  continueButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: { width: '90%', maxWidth: 350 },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  genderOptions: { gap: 8 },
  genderOption: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  selectedGenderOption: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  genderOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
  },
  selectedGenderOptionText: { color: '#FFFFFF' },
});
