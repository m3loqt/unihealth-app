import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Dimensions,
} from 'react-native';
import {
  User,
  Search,
  FileText,
  Edit,
  Plus,
  Mic,
  ChevronRight,
  ChevronLeft,
  Save,
  Check,
} from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

interface ConsultationFormData {
  // Step 1: Patient History
  presentIllnessHistory: string;
  reviewOfSymptoms: string;
  
  // Step 2: Findings
  labResults: string;
  medications: string;
  
  // Step 3: Diagnoses
  diagnosis: string;
  differentialDiagnosis: string;
  
  // Step 4: SOAP Notes
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  
  // Step 5: Treatment & Wrap-Up
  treatmentPlan: string;
  clinicalSummary: string;
  
  // Step 6: Supplementary Docs
  prescriptions: any[];
  certificates: any[];
  allergies: string;
  vitals: string;
}

interface ConsultationFormProps {
  initialData?: Partial<ConsultationFormData>;
  isReadOnly?: boolean;
  onSave?: (data: ConsultationFormData) => void;
  onComplete?: (data: ConsultationFormData) => void;
  isLoading?: boolean;
}

export default function ConsultationForm({
  initialData = {},
  isReadOnly = false,
  onSave,
  onComplete,
  isLoading = false,
}: ConsultationFormProps) {
  const [formData, setFormData] = useState<ConsultationFormData>({
    presentIllnessHistory: '',
    reviewOfSymptoms: '',
    labResults: '',
    medications: '',
    diagnosis: '',
    differentialDiagnosis: '',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    treatmentPlan: '',
    clinicalSummary: '',
    prescriptions: [],
    certificates: [],
    allergies: '',
    vitals: '',
    ...initialData,
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const totalSteps = 6;

  // Animation for microphone
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    if (activeField) {
      pulseAnim.value = withRepeat(
        withTiming(1.2, { duration: 1000 }),
        -1,
        true
      );
    } else {
      pulseAnim.value = withTiming(1, { duration: 200 });
    }
  }, [activeField]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const updateField = (field: keyof ConsultationFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= totalSteps) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave(formData);
      setHasChanges(false);
    }
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete(formData);
    }
  };

  const renderField = (
    label: string,
    field: keyof ConsultationFormData,
    placeholder: string,
    multiline: boolean = false,
    numberOfLines: number = 1
  ) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.textInput,
            multiline && styles.multilineInput,
            isReadOnly && styles.readOnlyInput,
          ]}
          value={formData[field] as string}
          onChangeText={(text) => updateField(field, text)}
          placeholder={placeholder}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={!isReadOnly}
        />
        {!isReadOnly && (
          <TouchableOpacity
            style={styles.micButton}
            onPress={() => {
              // Voice-to-text functionality would go here
              Alert.alert('Voice Input', 'Voice-to-text feature coming soon!');
            }}
          >
            <Animated.View style={[styles.micIcon, animatedStyle]}>
              <Mic size={16} color="#1E40AF" />
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderStepIndicator = () => (
    <View style={styles.stepIndicatorContainer}>
      <View style={styles.stepProgressBar}>
        <View style={styles.stepProgressText}>
          <Text style={styles.stepProgressLabel}>Step {currentStep} of {totalSteps}</Text>
          <Text style={styles.stepProgressPercentage}>
            {Math.round((currentStep / totalSteps) * 100)}% Complete
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(currentStep / totalSteps) * 100}%` }]} />
        </View>
      </View>
      
      <View style={styles.stepTabs}>
        {[
          { id: 1, title: 'History', icon: 'User' },
          { id: 2, title: 'Findings', icon: 'Search' },
          { id: 3, title: 'Diagnosis', icon: 'FileText' },
          { id: 4, title: 'SOAP', icon: 'Edit' },
          { id: 5, title: 'Treatment', icon: 'Plus' },
          { id: 6, title: 'Additional', icon: 'Plus' },
        ].map((step) => (
          <TouchableOpacity
            key={step.id}
            style={[
              styles.stepTab,
              currentStep === step.id && styles.stepTabActive,
              currentStep > step.id && styles.stepTabCompleted,
            ]}
            onPress={() => goToStep(step.id)}
          >
            <View style={[
              styles.stepIcon,
              currentStep === step.id && styles.stepIconActive,
              currentStep > step.id && styles.stepIconCompleted,
            ]}>
              {currentStep > step.id ? (
                <Text style={styles.stepCheckmark}>✓</Text>
              ) : (
                <View style={styles.stepIconContainer}>
                  {step.icon === 'User' && <User size={20} color={currentStep === step.id ? "#FFFFFF" : "#1E40AF"} />}
                  {step.icon === 'Search' && <Search size={20} color={currentStep === step.id ? "#FFFFFF" : "#1E40AF"} />}
                  {step.icon === 'FileText' && <FileText size={20} color={currentStep === step.id ? "#FFFFFF" : "#1E40AF"} />}
                  {step.icon === 'Edit' && <Edit size={20} color={currentStep === step.id ? "#FFFFFF" : "#1E40AF"} />}
                  {step.icon === 'Plus' && <Plus size={20} color={currentStep === step.id ? "#FFFFFF" : "#1E40AF"} />}
                </View>
              )}
            </View>
            <Text style={[
              styles.stepTitle,
              currentStep === step.id && styles.stepTitleActive,
              currentStep > step.id && styles.stepTitleCompleted,
            ]}>
              {step.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Patient History</Text>
            {renderField('Present Illness History', 'presentIllnessHistory', 'Describe the patient\'s current illness...', true, 4)}
            {renderField('Review of Symptoms', 'reviewOfSymptoms', 'List all relevant symptoms...', true, 4)}
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Findings</Text>
            {renderField('Lab Results', 'labResults', 'Enter lab test results...', true, 4)}
            {renderField('Current Medications', 'medications', 'List current medications...', true, 3)}
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Diagnosis</Text>
            {renderField('Primary Diagnosis', 'diagnosis', 'Enter primary diagnosis...', true, 3)}
            {renderField('Differential Diagnosis', 'differentialDiagnosis', 'List differential diagnoses...', true, 3)}
          </View>
        );
      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>SOAP Notes</Text>
            {renderField('Subjective', 'subjective', 'Patient\'s subjective complaints...', true, 3)}
            {renderField('Objective', 'objective', 'Objective findings...', true, 3)}
            {renderField('Assessment', 'assessment', 'Clinical assessment...', true, 3)}
            {renderField('Plan', 'plan', 'Treatment plan...', true, 3)}
          </View>
        );
      case 5:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Treatment & Summary</Text>
            {renderField('Treatment Plan', 'treatmentPlan', 'Detailed treatment plan...', true, 4)}
            {renderField('Clinical Summary', 'clinicalSummary', 'Clinical summary...', true, 4)}
          </View>
        );
      case 6:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Additional Information</Text>
            {renderField('Allergies', 'allergies', 'List any allergies...', true, 2)}
            {renderField('Vitals', 'vitals', 'Vital signs...', true, 2)}
            {/* Prescriptions and certificates would be handled separately */}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {renderStepIndicator()}
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderStepContent()}
      </ScrollView>

      {!isReadOnly && (
        <View style={styles.footer}>
          <View style={styles.navigationButtons}>
            <TouchableOpacity
              style={[styles.navButton, currentStep === 1 && styles.navButtonDisabled]}
              onPress={prevStep}
              disabled={currentStep === 1}
            >
              <ChevronLeft size={20} color={currentStep === 1 ? "#9CA3AF" : "#1E40AF"} />
              <Text style={[styles.navButtonText, currentStep === 1 && styles.navButtonTextDisabled]}>
                Previous
              </Text>
            </TouchableOpacity>

            {currentStep < totalSteps ? (
              <TouchableOpacity style={styles.navButton} onPress={nextStep}>
                <Text style={styles.navButtonText}>Next</Text>
                <ChevronRight size={20} color="#1E40AF" />
              </TouchableOpacity>
            ) : (
              <View style={styles.actionButtons}>
                {hasChanges && onSave && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.saveButton]}
                    onPress={handleSave}
                    disabled={isLoading}
                  >
                    <Save size={20} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Save</Text>
                  </TouchableOpacity>
                )}
                {onComplete && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.completeButton]}
                    onPress={handleComplete}
                    disabled={isLoading}
                  >
                    <Check size={20} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Complete</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  stepIndicatorContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  stepProgressBar: {
    marginBottom: 16,
  },
  stepProgressText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepProgressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  stepProgressPercentage: {
    fontSize: 14,
    color: '#6B7280',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1E40AF',
    borderRadius: 2,
  },
  stepTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepTab: {
    alignItems: 'center',
    flex: 1,
  },
  stepTabActive: {
    // Active state styling
  },
  stepTabCompleted: {
    // Completed state styling
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepIconActive: {
    backgroundColor: '#1E40AF',
  },
  stepIconCompleted: {
    backgroundColor: '#10B981',
  },
  stepIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCheckmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepTitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  stepTitleActive: {
    color: '#1E40AF',
    fontWeight: '600',
  },
  stepTitleCompleted: {
    color: '#10B981',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  stepContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  readOnlyInput: {
    backgroundColor: '#F9FAFB',
    color: '#6B7280',
  },
  micButton: {
    marginLeft: 8,
    padding: 8,
  },
  micIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  navButtonDisabled: {
    backgroundColor: '#F9FAFB',
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginHorizontal: 8,
  },
  navButtonTextDisabled: {
    color: '#9CA3AF',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveButton: {
    backgroundColor: '#6B7280',
  },
  completeButton: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});
