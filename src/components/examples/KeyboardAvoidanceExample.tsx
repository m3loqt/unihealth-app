import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { KeyboardAvoidingScrollView, KeyboardAwareInput } from '../ui';
import { useKeyboardAvoidance } from '../../hooks/ui/useKeyboardAvoidance';

/**
 * Example component demonstrating keyboard avoidance implementation
 * This shows how to use the keyboard avoidance system in your forms
 */
export const KeyboardAvoidanceExample: React.FC = () => {
  const [formData, setFormData] = useState({
    diagnosis: '',
    notes: '',
    treatment: '',
    summary: '',
  });

  const { isKeyboardVisible, dismissKeyboard } = useKeyboardAvoidance();
  const scrollViewRef = useRef<any>(null);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    dismissKeyboard();
    Alert.alert('Form Submitted', 'All data has been saved!');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Diagnosis Form</Text>
        {isKeyboardVisible && (
          <TouchableOpacity onPress={dismissKeyboard} style={styles.dismissButton}>
            <Text style={styles.dismissText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        extraOffset={20}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.form}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Primary Diagnosis</Text>
            <KeyboardAwareInput
              style={styles.input}
              placeholder="Enter primary diagnosis..."
              value={formData.diagnosis}
              onChangeText={(text) => handleInputChange('diagnosis', text)}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Clinical Notes</Text>
            <KeyboardAwareInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Enter clinical notes and observations..."
              value={formData.notes}
              onChangeText={(text) => handleInputChange('notes', text)}
              multiline
              numberOfLines={5}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Treatment Plan</Text>
            <KeyboardAwareInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Describe the treatment plan..."
              value={formData.treatment}
              onChangeText={(text) => handleInputChange('treatment', text)}
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Clinical Summary</Text>
            <KeyboardAwareInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Provide a clinical summary..."
              value={formData.summary}
              onChangeText={(text) => handleInputChange('summary', text)}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Spacer to ensure content is scrollable above keyboard */}
          <View style={styles.bottomSpacer} />
        </View>
      </KeyboardAvoidingScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitText}>Save Diagnosis</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  dismissButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1E40AF',
    borderRadius: 8,
  },
  dismissText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  form: {
    gap: 24,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#1F2937',
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  bottomSpacer: {
    height: 100,
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitButton: {
    backgroundColor: '#1E40AF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default KeyboardAvoidanceExample;
