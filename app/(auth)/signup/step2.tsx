import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  Modal,
  StatusBar,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  User,
  Phone,
  ChevronDown,
  ChevronLeft,
} from 'lucide-react-native';
import { KeyboardAvoidingScrollView } from '../../../src/components/ui';
import { capitalizeRelationship } from '../../../src/utils/formatting';

const RELATIONSHIP_OPTIONS = [
  'Spouse',
  'Parent',
  'Child',
  'Sibling',
  'Friend',
  'Relative',
  'Guardian',
  'Other',
];

export default function SignUpStep2Screen() {
  const { step1Data } = useLocalSearchParams();
  const [formData, setFormData] = useState<Record<string, string>>({
    emergencyContactName: '',
    relationship: '',
    relationshipOther: '',
    emergencyContactNumber: '',
  });
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);

  const allFieldsFilled =
    formData.emergencyContactName.trim() &&
    formData.relationship &&
    (formData.relationship !== 'Other' || formData.relationshipOther.trim()) &&
    formData.emergencyContactNumber.trim();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleContinue = () => {
    const relationshipValue =
      formData.relationship === 'Other'
        ? capitalizeRelationship(formData.relationshipOther)
        : formData.relationship;

    router.push({
      pathname: '/signup/step3',
      params: {
        step1Data,
        step2Data: JSON.stringify({
          ...formData,
          relationship: relationshipValue,
          relationshipOther: undefined,
        }),
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
      <KeyboardAvoidingScrollView
        extraOffset={20}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#1E40AF" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Create your account</Text>
            <Text style={styles.headerSubtitle}>Step 2: Emergency Contact</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '66.66%' }]} />
          </View>
          <Text style={styles.progressText}>2 of 3</Text>
        </View>

        <View style={styles.formContainer}>
            {/* Emergency Contact Full Name */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Emergency Contact Full Name</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <View style={styles.inputContainer}>
                <User size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Juan Dela Cruz"
                  placeholderTextColor="#9CA3AF"
                  value={formData.emergencyContactName}
                  onChangeText={value => handleInputChange('emergencyContactName', value)}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Relationship */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Relationship</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setShowRelationshipModal(true)}
                activeOpacity={0.7}
              >
                <User size={20} color="#9CA3AF" style={styles.inputIcon} />
                <Text style={[styles.input, !formData.relationship && styles.placeholder]}>
                  {formData.relationship || 'Select relationship'}
                </Text>
                <ChevronDown size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Specify Relationship (if "Other" is chosen) */}
            {formData.relationship === 'Other' && (
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.inputLabel}>Specify Relationship</Text>
                  <Text style={styles.asterisk}>*</Text>
                </View>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Please specify"
                    placeholderTextColor="#9CA3AF"
                    value={formData.relationshipOther}
                    onChangeText={value => handleInputChange('relationshipOther', value)}
                  />
                </View>
              </View>
            )}

            {/* Emergency Contact Number */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Emergency Contact Number</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <View style={styles.inputContainer}>
                <Phone size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter emergency contact number"
                  placeholderTextColor="#9CA3AF"
                  value={formData.emergencyContactNumber}
                  onChangeText={value => handleInputChange('emergencyContactNumber', value)}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
        </View>

        {/* Continue Button at bottom */}
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

        {/* Relationship Modal */}
        <Modal
          visible={showRelationshipModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowRelationshipModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Relationship</Text>
                <View style={styles.relationshipOptions}>
                  {RELATIONSHIP_OPTIONS.map((relationship) => (
                    <TouchableOpacity
                      key={relationship}
                      style={[
                        styles.relationshipOption,
                        formData.relationship === relationship && styles.selectedRelationshipOption
                      ]}
                      onPress={() => {
                        handleInputChange('relationship', relationship);
                        setShowRelationshipModal(false);
                      }}
                    >
                      <Text style={[
                        styles.relationshipOptionText,
                        formData.relationship === relationship && styles.selectedRelationshipOptionText
                      ]}>
                        {relationship}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingScrollView>
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
  bottomContainer: {
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
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
  relationshipOptions: { gap: 8 },
  relationshipOption: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  selectedRelationshipOption: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  relationshipOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
  },
  selectedRelationshipOptionText: { color: '#FFFFFF' },
});
