import React, { useState, useRef, useEffect } from 'react';
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
  Animated,
} from 'react-native';
import {
  ChevronLeft,
  Mic,
  Save,
  CircleCheck as CheckCircle,
  Plus,
  Trash2,
  Pill,
  FileText,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';

export default function PatientConsultationScreen() {
  const { patientId, consultationId } = useLocalSearchParams();

  // Form state
  const [formData, setFormData] = useState<{
    diagnosis: string;
    differentialDiagnosis: string;
    reviewOfSymptoms: string;
    presentIllnessHistory: string;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    labResults: string;
    allergies: string;
    medications: string;
    vitals: string;
    prescriptions: any[];
    certificates: any[];
  }>({
    diagnosis: '',
    differentialDiagnosis: '',
    reviewOfSymptoms: '',
    presentIllnessHistory: '',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    labResults: '',
    allergies: '',
    medications: '',
    vitals: '',
    prescriptions: [],
    certificates: [],
  });

  // Voice-to-text state
  const [recording, setRecording] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isVoiceAvailable, setIsVoiceAvailable] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<any>(null);
  const [showAddPrescription, setShowAddPrescription] = useState(false);
  const [showAddCertificate, setShowAddCertificate] = useState(false);
  const [newPrescription, setNewPrescription] = useState({
    medication: '',
    dosage: '',
    frequency: '',
    duration: '',
    description: '',
  });
  const [newCertificate, setNewCertificate] = useState({
    type: '',
    description: '',
    validUntil: '',
    restrictions: '',
  });

  // Animation for pulsing mic
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isComponentMounted = useRef(true);

  useEffect(() => {
    isComponentMounted.current = true;
    initializeVoice();
    
    return () => {
      isComponentMounted.current = false;
      cleanupVoice();
    };
  }, []);

  const initializeVoice = async () => {
    try {
      if (Platform.OS === 'web') {
        // Web Speech API implementation
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          const recognitionInstance = new SpeechRecognition();
          
          recognitionInstance.continuous = false;
          recognitionInstance.interimResults = false;
          recognitionInstance.lang = 'en-US';
          
          recognitionInstance.onstart = () => {
            console.log('Speech recognition started');
            if (isComponentMounted.current) {
              setRecording(true);
            }
          };
          
          recognitionInstance.onresult = (event) => {
            console.log('Speech recognition result:', event.results);
            if (!isComponentMounted.current) return;
            
            if (event.results.length > 0) {
              const transcript = event.results[0][0].transcript;
              if (activeField && transcript) {
                setFormData((prev) => ({
                  ...prev,
                  [activeField]: prev[activeField] 
                    ? `${prev[activeField]} ${transcript}` 
                    : transcript,
                }));
                setHasChanges(true);
              }
            }
            
            setActiveField(null);
            setRecording(false);
            stopPulseAnimation();
          };
          
          recognitionInstance.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (!isComponentMounted.current) return;
            
            setRecording(false);
            stopPulseAnimation();
            setActiveField(null);
            
            let errorMessage = 'Speech recognition error occurred.';
            switch (event.error) {
              case 'no-speech':
                errorMessage = 'No speech detected. Please try again.';
                break;
              case 'network':
                errorMessage = 'Network error occurred during speech recognition.';
                break;
              case 'not-allowed':
                errorMessage = 'Microphone access denied. Please allow microphone access.';
                break;
              case 'service-not-allowed':
                errorMessage = 'Speech recognition service not allowed.';
                break;
              default:
                errorMessage = `Speech recognition error: ${event.error}`;
            }
            
            setTimeout(() => {
              if (isComponentMounted.current) {
                Alert.alert('Voice Recognition Error', errorMessage);
              }
            }, 100);
          };
          
          recognitionInstance.onend = () => {
            console.log('Speech recognition ended');
            if (isComponentMounted.current) {
              setRecording(false);
              stopPulseAnimation();
            }
          };
          
          setRecognition(recognitionInstance);
          setIsVoiceAvailable(true);
          setVoiceError(null);
        } else {
          setIsVoiceAvailable(false);
          setVoiceError('Speech recognition not supported in this browser');
        }
      } else {
        // For native platforms, we'll disable voice recognition for now
        // since react-native-voice requires native modules
        setIsVoiceAvailable(false);
        setVoiceError('Voice recognition not available on this platform');
      }
    } catch (error) {
      console.error('Voice initialization error:', error);
      if (isComponentMounted.current) {
        setVoiceError('Failed to initialize voice recognition');
        setIsVoiceAvailable(false);
      }
    }
  };

  const cleanupVoice = async () => {
    try {
      if (recording) {
        if (Platform.OS === 'web' && recognition) {
          recognition.stop();
        }
      }
      setRecognition(null);
    } catch (error) {
      console.error('Voice cleanup error:', error);
    }
  };

  // -- Microphone Press/Release --
  const startRecording = async (fieldName: string) => {
    if (!isVoiceAvailable) {
      Alert.alert(
        'Voice Recognition Unavailable', 
        voiceError || 'Voice recognition is not available on this device.'
      );
      return;
    }

    if (recording) {
      await stopRecording();
      return;
    }

    try {
      if (!isComponentMounted.current) return;
      
      setActiveField(fieldName);
      setRecording(true);
      startPulseAnimation();
      
      if (Platform.OS === 'web' && recognition) {
        recognition.start();
      }
      
    } catch (error) {
      console.error('Start recording error:', error);
      
      if (isComponentMounted.current) {
        setRecording(false);
        stopPulseAnimation();
        setActiveField(null);
        
        Alert.alert('Error', 'Failed to start voice recording. Please try again.');
      }
    }
  };

  const stopRecording = async () => {
    try {
      if (Platform.OS === 'web' && recognition) {
        recognition.stop();
      }
    } catch (error) {
      console.error('Stop recording error:', error);
    } finally {
      if (isComponentMounted.current) {
        setRecording(false);
        stopPulseAnimation();
        setActiveField(null);
      }
    }
  };

  // -- Pulse Animation --
  const startPulseAnimation = () => {
    try {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { 
            toValue: 1.3, 
            duration: 600, 
            useNativeDriver: true 
          }),
          Animated.timing(pulseAnim, { 
            toValue: 1, 
            duration: 600, 
            useNativeDriver: true 
          }),
        ])
      ).start();
    } catch (animError) {
      console.error('Animation error:', animError);
    }
  };

  const stopPulseAnimation = () => {
    try {
      pulseAnim.stopAnimation();
      Animated.timing(pulseAnim, { 
        toValue: 1, 
        duration: 200, 
        useNativeDriver: true 
      }).start();
    } catch (animError) {
      console.error('Stop animation error:', animError);
    }
  };

  // -- Input Change --
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setHasChanges(true);
  };

  // --- PRESCRIPTION HANDLERS ---
  const handleAddPrescription = () => {
    if (!newPrescription.medication?.trim() || !newPrescription.dosage?.trim() || !newPrescription.frequency?.trim()) {
      Alert.alert('Error', 'Please fill in medication, dosage, and frequency fields.');
      return;
    }
    
    const prescription = {
      id: Date.now(),
      ...newPrescription,
      prescribedBy: 'Dr. Sarah Johnson',
      prescribedDate: new Date().toLocaleDateString(),
    };
    
    setFormData((prev) => ({
      ...prev,
      prescriptions: [...prev.prescriptions, prescription],
    }));
    
    setNewPrescription({
      medication: '',
      dosage: '',
      frequency: '',
      duration: '',
      description: '',
    });
    
    setShowAddPrescription(false);
    setHasChanges(true);
  };

  const handleRemovePrescription = (id) => {
    Alert.alert(
      'Remove Prescription',
      'Are you sure you want to remove this prescription?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setFormData((prev) => ({
              ...prev,
              prescriptions: prev.prescriptions.filter((p) => p.id !== id),
            }));
            setHasChanges(true);
          },
        },
      ]
    );
  };

  // --- CERTIFICATE HANDLERS ---
  const handleAddCertificate = () => {
    if (!newCertificate.type?.trim() || !newCertificate.description?.trim()) {
      Alert.alert('Error', 'Please fill in certificate type and description fields.');
      return;
    }
    
    const certificate = {
      id: Date.now(),
      ...newCertificate,
      doctor: 'Dr. Sarah Johnson',
      clinic: 'San Francisco General Hospital',
      issuedDate: new Date().toLocaleDateString(),
      issuedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Valid',
    };
    
    setFormData((prev) => ({
      ...prev,
      certificates: [...prev.certificates, certificate],
    }));
    
    setNewCertificate({
      type: '',
      description: '',
      validUntil: '',
      restrictions: '',
    });
    
    setShowAddCertificate(false);
    setHasChanges(true);
  };

  const handleRemoveCertificate = (id) => {
    Alert.alert(
      'Remove Certificate',
      'Are you sure you want to remove this certificate?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setFormData((prev) => ({
              ...prev,
              certificates: prev.certificates.filter((c) => c.id !== id),
            }));
            setHasChanges(true);
          },
        },
      ]
    );
  };

  // --- SAVE & COMPLETE ---
  const handleSaveChanges = () => {
    Alert.alert('Success', 'Changes saved successfully!');
    setHasChanges(false);
  };

  const handleCompleteConsultation = () => {
    Alert.alert(
      'Complete Consultation',
      'Are you sure you want to complete this consultation? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'default',
          onPress: () => {
            Alert.alert('Success', 'Consultation completed successfully!', [
              {
                text: 'OK',
                onPress: () => {
                  try {
                    router.push('/(specialist)/tabs/patients?filter=completed');
                  } catch (navError) {
                    console.error('Navigation error:', navError);
                    router.back();
                  }
                }
              }
            ]);
          }
        }
      ]
    );
  };

  // --- FIELD RENDERING WITH MIC ---
  const renderFieldWithSpeech = (label, field, multiline = false) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.textInput, multiline && styles.multilineInput]}
          value={formData[field] || ''}
          onChangeText={(value) => handleInputChange(field, value)}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          textAlignVertical={multiline ? 'top' : 'center'}
          placeholder={`Enter ${label.toLowerCase()}...`}
          placeholderTextColor="#9CA3AF"
        />
        <TouchableOpacity
          style={[
            styles.micButton,
            activeField === field && styles.micButtonActive,
            !isVoiceAvailable && styles.micButtonDisabled,
          ]}
          onPress={() => startRecording(field)}
          disabled={!isVoiceAvailable}
        >
          <Animated.View
            style={[
              styles.micIconContainer,
              activeField === field && {
                transform: [{ scale: pulseAnim }],
                backgroundColor: "#1E40AF",
                borderColor: "#1E40AF"
              },
              !isVoiceAvailable && styles.micIconDisabled,
            ]}
          >
            <Mic
              size={16}
              color={
                !isVoiceAvailable 
                  ? "#9CA3AF" 
                  : activeField === field 
                    ? "#FFFFFF" 
                    : "#1E40AF"
              }
            />
          </Animated.View>
        </TouchableOpacity>
      </View>
      {activeField === field && recording && (
        <Text style={styles.recordingIndicator}>
          🎤 Listening... Tap microphone again to stop
        </Text>
      )}
    </View>
  );

  // --- UI ---
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Patient Consultation</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Clinical Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clinical Summary</Text>

          {/* Diagnosis Section */}
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Diagnosis</Text>
            {renderFieldWithSpeech('Diagnosis', 'diagnosis', true)}
            {renderFieldWithSpeech('Differential Diagnosis', 'differentialDiagnosis', true)}
          </View>

          {/* History Section */}
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>History</Text>
            {renderFieldWithSpeech('History of Present Illness', 'presentIllnessHistory', true)}
            {renderFieldWithSpeech('Review of Symptoms', 'reviewOfSymptoms', true)}
          </View>

          {/* SOAP Notes Section */}
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>SOAP Notes</Text>
            {renderFieldWithSpeech('Subjective', 'subjective', true)}
            {renderFieldWithSpeech('Objective', 'objective', true)}
            {renderFieldWithSpeech('Assessment', 'assessment', true)}
            {renderFieldWithSpeech('Plan', 'plan', true)}
          </View>

          {/* Lab Results Section */}
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Lab Results & Additional Info</Text>
            {renderFieldWithSpeech('Lab Results', 'labResults', true)}
            {renderFieldWithSpeech('Allergies', 'allergies')}
            {renderFieldWithSpeech('Vitals', 'vitals')}
          </View>

          {/* Medications Section */}
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Medications</Text>
            {renderFieldWithSpeech('Medications', 'medications', true)}
          </View>

          {/* Prescriptions Section */}
          <View style={styles.subsection}>
            <View style={styles.sectionHeaderWithButton}>
              <Text style={styles.subsectionTitle}>Prescriptions</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddPrescription(true)}
              >
                <Plus size={16} color="#1E40AF" />
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
            {formData.prescriptions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No prescriptions added yet</Text>
              </View>
            ) : (
              formData.prescriptions.map((prescription) => (
                <View key={prescription.id} style={styles.prescriptionCard}>
                  <View style={styles.prescriptionHeader}>
                    <View style={styles.medicationIcon}>
                      <Pill size={20} color="#1E40AF" />
                    </View>
                    <View style={styles.prescriptionDetails}>
                      <Text style={styles.medicationName}>{prescription.medication}</Text>
                      <Text style={styles.medicationDosage}>
                        {prescription.dosage} • {prescription.frequency}
                      </Text>
                      <Text style={styles.prescriptionDescription}>{prescription.description}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemovePrescription(prescription.id)}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.prescriptionMeta}>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Duration:</Text>
                      <Text style={styles.metaValue}>{prescription.duration || 'Not specified'}</Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Prescribed by:</Text>
                      <Text style={styles.metaValue}>{prescription.prescribedBy}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}

            {/* Add Prescription Form */}
            {showAddPrescription && (
              <View style={styles.addForm}>
                <Text style={styles.addFormTitle}>Add New Prescription</Text>
                <TextInput
                  style={styles.addFormInput}
                  placeholder="Medication name"
                  value={newPrescription.medication}
                  onChangeText={(value) => setNewPrescription((prev) => ({ ...prev, medication: value }))}
                />
                <View style={styles.addFormRow}>
                  <TextInput
                    style={[styles.addFormInput, styles.addFormInputHalf]}
                    placeholder="Dosage (e.g., 10mg)"
                    value={newPrescription.dosage}
                    onChangeText={(value) => setNewPrescription((prev) => ({ ...prev, dosage: value }))}
                  />
                  <TextInput
                    style={[styles.addFormInput, styles.addFormInputHalf]}
                    placeholder="Frequency"
                    value={newPrescription.frequency}
                    onChangeText={(value) => setNewPrescription((prev) => ({ ...prev, frequency: value }))}
                  />
                </View>
                <TextInput
                  style={styles.addFormInput}
                  placeholder="Duration (e.g., 7 days)"
                  value={newPrescription.duration}
                  onChangeText={(value) => setNewPrescription((prev) => ({ ...prev, duration: value }))}
                />
                <TextInput
                  style={[styles.addFormInput, styles.addFormTextArea]}
                  placeholder="Description/Instructions"
                  value={newPrescription.description}
                  onChangeText={(value) => setNewPrescription((prev) => ({ ...prev, description: value }))}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <View style={styles.addFormActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setShowAddPrescription(false);
                      setNewPrescription({
                        medication: '',
                        dosage: '',
                        frequency: '',
                        duration: '',
                        description: '',
                      });
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addFormSubmitButton}
                    onPress={handleAddPrescription}
                  >
                    <Text style={styles.addFormSubmitButtonText}>Add Prescription</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Medical Certificates Section */}
          <View style={styles.subsection}>
            <View style={styles.sectionHeaderWithButton}>
              <Text style={styles.subsectionTitle}>Medical Certificates</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddCertificate(true)}
              >
                <Plus size={16} color="#1E40AF" />
                <Text style={styles.addButtonText}>Issue</Text>
              </TouchableOpacity>
            </View>
            {formData.certificates.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No certificates issued yet</Text>
              </View>
            ) : (
              formData.certificates.map((certificate) => (
                <View key={certificate.id} style={styles.certificateCard}>
                  <View style={styles.certificateHeader}>
                    <View style={styles.certificateIcon}>
                      <FileText size={20} color="#1E40AF" />
                    </View>
                    <View style={styles.certificateDetails}>
                      <Text style={styles.certificateType}>{certificate.type}</Text>
                      <Text style={styles.certificateDescription}>{certificate.description}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveCertificate(certificate.id)}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.certificateMeta}>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Issued:</Text>
                      <Text style={styles.metaValue}>{certificate.issuedDate}</Text>
                    </View>
                    {certificate.validUntil && (
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Valid until:</Text>
                        <Text style={styles.metaValue}>{certificate.validUntil}</Text>
                      </View>
                    )}
                    {certificate.restrictions && (
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Restrictions:</Text>
                        <Text style={styles.metaValue}>{certificate.restrictions}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}

            {/* Add Certificate Form */}
            {showAddCertificate && (
              <View style={styles.addForm}>
                <Text style={styles.addFormTitle}>Issue New Certificate</Text>
                <TextInput
                  style={styles.addFormInput}
                  placeholder="Certificate type (e.g., Fit to Work)"
                  value={newCertificate.type}
                  onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, type: value }))}
                />
                <TextInput
                  style={[styles.addFormInput, styles.addFormTextArea]}
                  placeholder="Description/Medical findings"
                  value={newCertificate.description}
                  onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, description: value }))}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <TextInput
                  style={styles.addFormInput}
                  placeholder="Valid until (optional)"
                  value={newCertificate.validUntil}
                  onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, validUntil: value }))}
                />
                <TextInput
                  style={[styles.addFormInput, styles.addFormTextArea]}
                  placeholder="Restrictions (optional)"
                  value={newCertificate.restrictions}
                  onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, restrictions: value }))}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />
                <View style={styles.addFormActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setShowAddCertificate(false);
                      setNewCertificate({
                        type: '',
                        description: '',
                        validUntil: '',
                        restrictions: '',
                      });
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addFormSubmitButton}
                    onPress={handleAddCertificate}
                  >
                    <Text style={styles.addFormSubmitButtonText}>Issue Certificate</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Buttons */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSaveChanges}
          disabled={!hasChanges}
        >
          <Save size={18} color={hasChanges ? "#1E40AF" : "#9CA3AF"} />
          <Text style={[styles.saveButtonText, !hasChanges && styles.saveButtonTextDisabled]}>
            Save Changes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.completeButton}
          onPress={handleCompleteConsultation}
        >
          <CheckCircle size={18} color="#FFFFFF" />
          <Text style={styles.completeButtonText}>Complete Consultation</Text>
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
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 20,
  },
  subsection: {
    marginBottom: 24,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  subsectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  micButton: {
    padding: 8,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  micButtonActive: {
    backgroundColor: 'rgba(30, 64, 175, 0.1)',
  },
  micButtonDisabled: {
    opacity: 0.5,
  },
  micIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  micIconDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  recordingIndicator: {
    fontSize: 12,
    color: '#1E40AF',
    fontFamily: 'Inter-Medium',
    marginTop: 4,
    textAlign: 'center',
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
    flexDirection: 'column',
    gap: 12,
  },
  saveButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
    marginBottom: 8,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: {
    color: '#1E40AF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  saveButtonTextDisabled: { color: '#9CA3AF' },
  completeButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  // Section Header with Button
  sectionHeaderWithButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    gap: 4,
  },
  addButtonText: {
    color: '#1E40AF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyStateText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  // Prescription Card
  prescriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  prescriptionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  medicationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  prescriptionDetails: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  medicationDosage: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  prescriptionDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  removeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  prescriptionMeta: {
    gap: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  metaValue: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  // Certificate Card
  certificateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  certificateHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  certificateIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  certificateDetails: {
    flex: 1,
  },
  certificateType: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  certificateDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  certificateMeta: {
    gap: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  // Add Form
  addForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 12,
  },
  addFormTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 16,
  },
  addFormInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    marginBottom: 12,
  },
  addFormRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addFormInputHalf: {
    flex: 1,
  },
  addFormTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  addFormActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  addFormSubmitButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addFormSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
});


