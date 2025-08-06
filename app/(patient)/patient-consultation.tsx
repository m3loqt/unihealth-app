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
import { useVoiceToText } from '../../src/hooks/useVoiceToText';
import { useAuth } from '../../src/hooks/auth/useAuth';
import { databaseService } from '../../src/services/database/firebase';

export default function PatientConsultationScreen() {
  const { patientId, consultationId } = useLocalSearchParams();
  const { user } = useAuth();

  // Voice-to-text hook
  const {
    isRecording,
    error: voiceError,
    startRecording,
    stopRecording,
    transcript,
    resetTranscript,
  } = useVoiceToText();

  // Voice availability - always true since we have fallbacks
  const isVoiceAvailable = true;

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

  // Load consultation data from Firebase
  useEffect(() => {
    if (consultationId) {
      loadConsultationData();
    }
  }, [consultationId]);

  const loadConsultationData = async () => {
    if (!consultationId) return;
    
    try {
      const consultation = await databaseService.getAppointmentById(consultationId as string);
      if (consultation) {
        setFormData({
          diagnosis: consultation.diagnosis || '',
          differentialDiagnosis: consultation.differentialDiagnosis || '',
          reviewOfSymptoms: consultation.reviewOfSymptoms || '',
          presentIllnessHistory: consultation.presentIllnessHistory || '',
          subjective: consultation.soapNotes?.subjective || '',
          objective: consultation.soapNotes?.objective || '',
          assessment: consultation.soapNotes?.assessment || '',
          plan: consultation.soapNotes?.plan || '',
          labResults: consultation.labResults || '',
          allergies: consultation.allergies || '',
          medications: consultation.medications || '',
          vitals: consultation.vitals || '',
          prescriptions: consultation.prescriptions || [],
          certificates: consultation.certificates || [],
        });
      }
    } catch (error) {
      console.error('Error loading consultation data:', error);
      Alert.alert('Error', 'Failed to load consultation data. Please try again.');
    }
  };

  // Debug: Log form data changes
  useEffect(() => {
    console.log('Patient Consultation - Form data updated:', formData);
  }, [formData]);

  // UI state
  const [activeField, setActiveField] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

  // Animation for loading dots
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  // Effect to handle transcript updates
  useEffect(() => {
    console.log('Transcript effect triggered - transcript:', transcript, 'activeField:', activeField);
    if (transcript && activeField) {
      console.log('Updating field:', activeField, 'with transcript:', transcript);
      setFormData((prev) => {
        const updated = {
          ...prev,
          [activeField]: transcript, // Replace the field content with current transcript
        };
        console.log('Form data updated:', updated[activeField as keyof typeof updated]);
        return updated;
      });
      setHasChanges(true);
      
      // Clear activeField after updating the form
      setTimeout(() => {
        setActiveField(null);
        setIsLoading(false);
        stopPulseAnimation();
        stopLoadingAnimation();
      }, 500);
    }
  }, [transcript, activeField]);

  // -- Microphone Press/Release --
  const handleStartRecording = async (fieldName: string) => {
    console.log('Starting recording for field:', fieldName);
    if (!isVoiceAvailable) {
      Alert.alert(
        'Voice Recognition Unavailable', 
        voiceError || 'Voice recognition is not available on this device.'
      );
      return;
    }

    if (isRecording) {
      await stopRecording();
      return;
    }

    try {
      setActiveField(fieldName);
      startPulseAnimation();
      await startRecording();
    } catch (error) {
      console.error('Start recording error:', error);
      stopPulseAnimation();
      setActiveField(null);
      Alert.alert('Error', 'Failed to start voice recording. Please try again.');
    }
  };

  const handleStopRecording = async () => {
    try {
      await stopRecording();
      // Start loading animation while waiting for transcript
      setIsLoading(true);
      startLoadingAnimation();
      // activeField will be cleared in the transcript effect
    } catch (error) {
      console.error('Stop recording error:', error);
      stopPulseAnimation();
      stopLoadingAnimation();
      setIsLoading(false);
      setActiveField(null);
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

  // -- Loading Dots Animation --
  const startLoadingAnimation = () => {
    try {
      // Reset all dots
      dot1Anim.setValue(0);
      dot2Anim.setValue(0);
      dot3Anim.setValue(0);

      // Animate dots in sequence
      Animated.loop(
        Animated.sequence([
          // Dot 1
          Animated.timing(dot1Anim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          // Dot 2
          Animated.timing(dot2Anim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          // Dot 3
          Animated.timing(dot3Anim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          // Reset all dots
          Animated.parallel([
            Animated.timing(dot1Anim, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(dot2Anim, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(dot3Anim, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]),
          // Pause before next cycle
          Animated.delay(200),
        ])
      ).start();
    } catch (animError) {
      console.error('Loading animation error:', animError);
    }
  };

  const stopLoadingAnimation = () => {
    try {
      dot1Anim.stopAnimation();
      dot2Anim.stopAnimation();
      dot3Anim.stopAnimation();
      
      // Reset dots
      dot1Anim.setValue(0);
      dot2Anim.setValue(0);
      dot3Anim.setValue(0);
    } catch (animError) {
      console.error('Stop loading animation error:', animError);
    }
  };

  // -- Input Change --
  const handleInputChange = (field: string, value: string) => {
    console.log('Manual input change:', field, value);
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

  const handleRemovePrescription = (id: number) => {
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

  const handleRemoveCertificate = (id: number) => {
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
  const handleSaveChanges = async () => {
    if (!consultationId) {
      Alert.alert('Error', 'No consultation ID found.');
      return;
    }

    try {
      // Save consultation data to Firebase
      await databaseService.updateAppointment(consultationId as string, {
        diagnosis: formData.diagnosis,
        differentialDiagnosis: formData.differentialDiagnosis,
        reviewOfSymptoms: formData.reviewOfSymptoms,
        presentIllnessHistory: formData.presentIllnessHistory,
        soapNotes: {
          subjective: formData.subjective,
          objective: formData.objective,
          assessment: formData.assessment,
          plan: formData.plan,
        },
        labResults: formData.labResults,
        allergies: formData.allergies,
        medications: formData.medications,
        vitals: formData.vitals,
        prescriptions: formData.prescriptions,
        certificates: formData.certificates,
        lastUpdated: new Date().toISOString(),
      });

      Alert.alert('Success', 'Changes saved successfully!');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving consultation:', error);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    }
  };

  const handleCompleteConsultation = async () => {
    if (!consultationId) {
      Alert.alert('Error', 'No consultation ID found.');
      return;
    }

    Alert.alert(
      'Complete Consultation',
      'Are you sure you want to complete this consultation? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'default',
          onPress: async () => {
            try {
              // Complete consultation and save to Firebase
              await databaseService.updateAppointment(consultationId as string, {
                status: 'completed',
                diagnosis: formData.diagnosis,
                differentialDiagnosis: formData.differentialDiagnosis,
                reviewOfSymptoms: formData.reviewOfSymptoms,
                presentIllnessHistory: formData.presentIllnessHistory,
                soapNotes: {
                  subjective: formData.subjective,
                  objective: formData.objective,
                  assessment: formData.assessment,
                  plan: formData.plan,
                },
                labResults: formData.labResults,
                allergies: formData.allergies,
                medications: formData.medications,
                vitals: formData.vitals,
                prescriptions: formData.prescriptions,
                certificates: formData.certificates,
                completedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
              });

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
            } catch (error) {
              console.error('Error completing consultation:', error);
              Alert.alert('Error', 'Failed to complete consultation. Please try again.');
            }
          }
        }
      ]
    );
  };

  // --- FIELD RENDERING WITH MIC ---
  const renderFieldWithSpeech = (label: string, field: string, multiline = false) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.textInput, multiline && styles.multilineInput]}
          value={(formData[field as keyof typeof formData] as string) || ''}
          onChangeText={(value) => handleInputChange(field, value)}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          textAlignVertical={multiline ? 'top' : 'center'}
          placeholder={`Enter ${label.toLowerCase()}...`}
          placeholderTextColor="#9CA3AF"
          key={`${field}-${formData[field as keyof typeof formData]}`} // Force re-render when value changes
        />
        <TouchableOpacity
          style={[
            styles.micButton,
            activeField === field && styles.micButtonActive,
            !isVoiceAvailable && styles.micButtonDisabled,
          ]}
          onPress={() => {
            console.log('Microphone pressed for field:', field);
            if (activeField === field && isRecording) {
              handleStopRecording();
            } else {
              handleStartRecording(field);
            }
          }}
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
      {activeField === field && isRecording && (
        <Text style={styles.recordingIndicator}>
          🎤 Recording... Speak now! Tap microphone to stop
        </Text>
      )}
      {activeField === field && isLoading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Processing speech</Text>
          <View style={styles.dotsContainer}>
            <Animated.View
              style={[
                styles.dot,
                {
                  opacity: dot1Anim,
                  transform: [{ scale: dot1Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1]
                  })}]
                }
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                {
                  opacity: dot2Anim,
                  transform: [{ scale: dot2Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1]
                  })}]
                }
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                {
                  opacity: dot3Anim,
                  transform: [{ scale: dot3Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1]
                  })}]
                }
              ]}
            />
          </View>
        </View>
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
    marginBottom: 18,
    marginTop: 8,
    letterSpacing: -0.1,
  },
  subsection: {
    marginBottom: 30,
  },
  subsectionTitle: {
    fontSize: 15.5,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
    marginBottom: 14,
    marginTop: 0,
    letterSpacing: -0.2,
  },
  fieldContainer: {
    marginBottom: 12,
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
  // Loading Animation
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1E40AF',
  },
});


