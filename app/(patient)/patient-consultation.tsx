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
  Modal,
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
  Eye,
  User,
  Search,
  Edit,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useVoiceToText } from '../../src/hooks/useVoiceToText';
import { useAuth } from '../../src/hooks/auth/useAuth';
import { databaseService } from '../../src/services/database/firebase';
import { ref, update } from 'firebase/database';
import { database } from '@/config/firebase';
import { safeDataAccess } from '../../src/utils/safeDataAccess';

export default function PatientConsultationScreen() {
  const { patientId, consultationId, referralId } = useLocalSearchParams();
  const { user } = useAuth();
  
  // Convert consultationId to string if it's an array
  const consultationIdString = Array.isArray(consultationId) ? consultationId[0] : consultationId;
  // Convert referralId to string if it's an array
  const referralIdString = Array.isArray(referralId) ? referralId[0] : referralId;

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

  // Form state - Updated for 6-step flow
  const [formData, setFormData] = useState<{
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
  }>({
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
  });

  // Load consultation data from Firebase
  useEffect(() => {
    if (consultationIdString || referralIdString) {
      loadConsultationData();
    }
  }, [consultationIdString, referralIdString]);

  const loadConsultationData = async () => {
    if (!consultationIdString && !referralIdString) return;
    
    try {
      let consultation = null;
      let referral = null;
      
      // If we have a referralId, try to load referral data first
      if (referralIdString) {
        try {
          referral = await databaseService.getReferralById(referralIdString as string);
          console.log('Loaded referral data:', referral);
          setReferralData(referral);
        } catch (error) {
          console.log('Error loading referral data:', error);
        }
      }
      
      // Try to load consultation/appointment data
      if (consultationIdString) {
        try {
          consultation = await databaseService.getAppointmentById(consultationIdString as string);
          console.log('Loaded consultation data:', consultation);
          setAppointmentData(consultation);
        } catch (error) {
          console.log('Error loading consultation data:', error);
        }
      }
      
      // Check if appointment or referral is completed
      const checkCompletionStatus = () => {
        if (referral && referral.status === 'completed') {
          setIsCompleted(true);
          return;
        }
        if (consultation && consultation.status === 'completed') {
          setIsCompleted(true);
          return;
        }
        setIsCompleted(false);
      };
      
      checkCompletionStatus();
      
      // Also try to get medical history for this appointment
      let medicalHistory = null;
      if (patientId && consultationIdString) {
        try {
          medicalHistory = await databaseService.getMedicalHistoryByAppointment(consultationIdString as string, patientId as string);
        } catch (error) {
          console.log('No medical history found for this appointment:', error);
        }
      }

      setFormData({
        // Step 1: Patient History
        presentIllnessHistory: medicalHistory?.presentIllnessHistory || '',
        reviewOfSymptoms: medicalHistory?.reviewOfSymptoms || referral?.initialReasonForReferral || '',
        
        // Step 2: Findings
        labResults: medicalHistory?.labResults || '',
        medications: medicalHistory?.medications || '',
        
        // Step 3: Diagnoses
        diagnosis: medicalHistory?.diagnosis?.[0]?.description || '',
        differentialDiagnosis: medicalHistory?.differentialDiagnosis || '',
        
        // Step 4: SOAP Notes
        subjective: medicalHistory?.soapNotes?.subjective || '',
        objective: medicalHistory?.soapNotes?.objective || '',
        assessment: medicalHistory?.soapNotes?.assessment || '',
        plan: medicalHistory?.soapNotes?.plan || '',
        
        // Step 5: Treatment & Wrap-Up
        treatmentPlan: medicalHistory?.treatmentPlan || '',
        clinicalSummary: medicalHistory?.clinicalSummary || '',
        
        // Step 6: Supplementary Docs
        prescriptions: medicalHistory?.prescriptions || [],
        certificates: medicalHistory?.certificates || [],
        allergies: medicalHistory?.allergies || '',
        vitals: medicalHistory?.vitals || '',
      });
    } catch (error) {
      console.error('Error loading consultation data:', error);
      Alert.alert('Error', 'Failed to load consultation data. Please try again.');
    }
  };

  // UI state
  const [activeField, setActiveField] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddPrescription, setShowAddPrescription] = useState(false);
  const [showAddCertificate, setShowAddCertificate] = useState(false);
  
  // Step navigation state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;
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

  // Medical History Modal State
  const [showMedicalHistoryModal, setShowMedicalHistoryModal] = useState(false);
  const [medicalHistory, setMedicalHistory] = useState<any>(null);
  const [loadingMedicalHistory, setLoadingMedicalHistory] = useState(false);

  // Add state for appointment and referral data
  const [appointmentData, setAppointmentData] = useState<any>(null);
  const [referralData, setReferralData] = useState<any>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // Update completion status when appointment or referral data changes
  useEffect(() => {
    const checkCompletionStatus = () => {
      if (referralData && referralData.status === 'completed') {
        setIsCompleted(true);
        return;
      }
      if (appointmentData && appointmentData.status === 'completed') {
        setIsCompleted(true);
        return;
      }
      setIsCompleted(false);
    };
    
    checkCompletionStatus();
  }, [appointmentData, referralData]);

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

  // --- STEP NAVIGATION ---
  const goToNextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= totalSteps) {
      setCurrentStep(step);
    }
  };

  // --- LOAD MEDICAL HISTORY ---
  const loadMedicalHistory = async () => {
    if (!patientId) {
      Alert.alert('Error', 'No patient ID found.');
      return;
    }

    try {
      setLoadingMedicalHistory(true);
      setShowMedicalHistoryModal(true);
      
      // Get the actual patientId string value
      const patientIdString = Array.isArray(patientId) ? patientId[0] : patientId;
      
      // Determine the correct consultationId to use
      let consultationIdToUse = '';
      
      if (referralData && referralData.status === 'completed' && referralData.consultationId) {
        // Use consultationId from completed referral
        consultationIdToUse = referralData.consultationId;
      } else if (appointmentData && appointmentData.status === 'completed' && appointmentData.consultationId) {
        // Use consultationId from completed appointment
        consultationIdToUse = appointmentData.consultationId;
      } else {
        // Fallback to the original consultationIdString
        consultationIdToUse = (consultationIdString as string) || `consultation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      console.log('Loading medical history for patientId:', patientIdString);
      console.log('Looking for consultationId:', consultationIdToUse);
      
      // Try to get medical history from the specific consultation
      const medicalHistoryPath = `patientMedicalHistory/${patientIdString}/entries/${consultationIdToUse}`;
      const history = await databaseService.getDocument(medicalHistoryPath);
      
      if (history) {
        console.log('Found medical history:', history);
        setMedicalHistory(history);
      } else {
        console.log('No medical history found for this consultation');
        setMedicalHistory(null);
      }
    } catch (error) {
      console.error('Error loading medical history:', error);
      Alert.alert('Error', 'Failed to load medical history. Please try again.');
      setShowMedicalHistoryModal(false);
    } finally {
      setLoadingMedicalHistory(false);
    }
  };

  // --- SAVE & COMPLETE ---
  const handleSaveChanges = async () => {
    if (!patientId) {
      Alert.alert('Error', 'No patient ID found.');
      return;
    }

    try {
      // Use existing consultationId or generate a new one using Firebase push key
      let consultationIdToUse = consultationIdString as string;
      
      if (!consultationIdToUse) {
        // Generate a new consultationId using Firebase push key
        const medicalHistoryData = {
          // Step 1: Patient History
          presentIllnessHistory: formData.presentIllnessHistory,
          reviewOfSymptoms: formData.reviewOfSymptoms,
          
          // Step 2: Findings
          labResults: formData.labResults,
          medications: formData.medications,
          
          // Step 3: Diagnoses
          diagnosis: formData.diagnosis ? [{ code: 'DIAG001', description: formData.diagnosis }] : [],
          differentialDiagnosis: formData.differentialDiagnosis,
          
          // Step 4: SOAP Notes
          soapNotes: {
            subjective: formData.subjective,
            objective: formData.objective,
            assessment: formData.assessment,
            plan: formData.plan,
          },
          
          // Step 5: Treatment & Wrap-Up
          treatmentPlan: formData.treatmentPlan,
          clinicalSummary: formData.clinicalSummary,
          
          // Step 6: Supplementary Docs
          prescriptions: formData.prescriptions,
          certificates: formData.certificates,
          allergies: formData.allergies,
          vitals: formData.vitals,
          
          consultationDate: new Date().toISOString(),
          consultationTime: new Date().toLocaleTimeString(),
          patientId: patientId as string,
          provider: {
            id: user?.uid || '',
            firstName: user?.name?.split(' ')[0] || '',
            lastName: user?.name?.split(' ').slice(1).join(' ') || '',
            providerType: 'specialist',
            sourceSystem: 'unihealth',
          },
          type: 'consultation',
        };

        // Use Firebase push to generate the consultationId
        consultationIdToUse = await databaseService.pushDocument(`patientMedicalHistory/${patientId}/entries`, medicalHistoryData);
        console.log('Generated consultationId using Firebase push key:', consultationIdToUse);
      } else {
        // Save consultation data to medical history with existing consultationId
        const medicalHistoryData = {
          diagnosis: formData.diagnosis ? [{ code: 'DIAG001', description: formData.diagnosis }] : [],
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
          consultationDate: new Date().toISOString(),
          consultationTime: new Date().toLocaleTimeString(),
          patientId: patientId as string,
          provider: {
            id: user?.uid || '',
            firstName: user?.name?.split(' ')[0] || '',
            lastName: user?.name?.split(' ').slice(1).join(' ') || '',
            providerType: 'specialist',
            sourceSystem: 'unihealth',
          },
          relatedAppointment: {
            id: consultationIdToUse,
            type: 'consultation',
          },
          type: 'consultation',
          clinicalSummary: formData.diagnosis,
          treatmentPlan: formData.plan,
          lastUpdated: new Date().toISOString(),
        };

        // Save to medical history
        const medicalHistoryPath = `patientMedicalHistory/${patientId}/entries/${consultationIdToUse}`;
        await databaseService.setDocument(medicalHistoryPath, medicalHistoryData);
      }

      Alert.alert('Success', 'Changes saved successfully!');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving consultation:', error);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    }
  };

  const handleCompleteConsultation = async () => {
    if (!patientId) {
      Alert.alert('Error', 'No patient ID found.');
      return;
    }

    // Get the actual patientId string value
    const patientIdString = Array.isArray(patientId) ? patientId[0] : patientId;
    console.log('Using patientIdString:', patientIdString);

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
              setIsLoading(true);
              
              // Prepare consultation data
              const consultationData = {
                diagnosis: formData.diagnosis ? [{ code: 'DIAG001', description: formData.diagnosis }] : [],
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
                clinicalSummary: formData.clinicalSummary,
                treatmentPlan: formData.treatmentPlan,
                provider: {
                  id: user?.uid || '',
                  firstName: user?.name?.split(' ')[0] || '',
                  lastName: user?.name?.split(' ').slice(1).join(' ') || '',
                  providerType: 'specialist',
                  sourceSystem: 'UniHealth_Patient_App',
                },
                type: 'General Consultation',
              };

              // Handle original appointment consultation
              if (consultationIdString) {
                console.log('Saving consultation for appointment:', consultationIdString);
                const consultationId = await databaseService.saveConsultationData(
                  patientIdString,
                  consultationIdString as string,
                  consultationData
                );
                console.log('Consultation saved with ID:', consultationId);
              }

              // Handle referral consultation if applicable
              if (referralIdString) {
                console.log('Saving consultation for referral:', referralIdString);
                const referralConsultationId = await databaseService.saveConsultationData(
                  patientIdString,
                  referralIdString as string,
                  {
                    ...consultationData,
                    type: 'Referral Consultation'
                  }
                );
                console.log('Referral consultation saved with ID:', referralConsultationId);
              }

              Alert.alert('Success', 'Consultation completed successfully!');
              router.back();
            } catch (error) {
              console.error('Error saving consultation:', error);
              Alert.alert('Error', 'Failed to save consultation. Please try again.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };



  // --- STEP INDICATOR ---
  const renderStepIndicator = () => {
    const steps = [
      { id: 1, title: 'History', icon: 'User' },
      { id: 2, title: 'Findings', icon: 'Search' },
      { id: 3, title: 'SOAP', icon: 'FileText' },
      { id: 4, title: 'Treatment', icon: 'Edit' },
      { id: 5, title: 'Additional', icon: 'Plus' },
    ];

    return (
      <View style={styles.stepIndicatorContainer}>
        <View style={styles.stepProgressBar}>
          <View style={styles.stepProgressText}>
            <Text style={styles.stepProgressLabel}>Step {currentStep} of {totalSteps}</Text>
            <Text style={styles.stepProgressPercentage}>{Math.round((currentStep / totalSteps) * 100)}% Complete</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(currentStep / totalSteps) * 100}%` }]} />
          </View>
        </View>
        
        <View style={styles.stepTabs}>
          {steps.map((step) => (
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

  // --- STEP CONTENT RENDERING ---
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <View style={styles.stepHeaderIconContainer}>
                <User size={32} color="#1E40AF" />
              </View>
              <View>
                <Text style={styles.stepContentTitle}>Patient History</Text>
                <Text style={styles.stepSubtitle}>Context gathering and patient conversation</Text>
              </View>
            </View>
            
            {/* History of Present Illnesses */}
            {renderFieldWithSpeech('History of Present Illnesses', 'presentIllnessHistory', true)}
            
            {/* Review of Symptoms */}
            {renderFieldWithSpeech('Review of Symptoms', 'reviewOfSymptoms', true)}
          </View>
        );
        
      case 2:
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <View style={styles.stepHeaderIconContainer}>
                <Search size={32} color="#1E40AF" />
              </View>
              <View>
                <Text style={styles.stepContentTitle}>Findings</Text>
                <Text style={styles.stepSubtitle}>Evidence collection, diagnoses, and objective findings</Text>
              </View>
            </View>
            
            {/* Lab Results */}
            {renderFieldWithSpeech('Lab Results', 'labResults', true)}
            
            {/* Medications */}
            {renderFieldWithSpeech('Medications', 'medications', true)}
            
            {/* Diagnosis */}
            {renderFieldWithSpeech('Diagnosis', 'diagnosis')}
            
            {/* Differential Diagnosis */}
            {renderFieldWithSpeech('Differential Diagnosis', 'differentialDiagnosis', true)}
          </View>
        );
        
      case 3:
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <View style={styles.stepHeaderIconContainer}>
                <FileText size={32} color="#1E40AF" />
              </View>
              <View>
                <Text style={styles.stepContentTitle}>SOAP Notes</Text>
                <Text style={styles.stepSubtitle}>Detailed clinical documentation</Text>
              </View>
            </View>
            
            {/* SOAP Notes */}
            {renderFieldWithSpeech('Subjective', 'subjective', true)}
            {renderFieldWithSpeech('Objective', 'objective', true)}
            {renderFieldWithSpeech('Assessment', 'assessment', true)}
            {renderFieldWithSpeech('Plan', 'plan', true)}
          </View>
        );
        
      case 4:
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <View style={styles.stepHeaderIconContainer}>
                <Edit size={32} color="#1E40AF" />
              </View>
              <View>
                <Text style={styles.stepContentTitle}>Treatment</Text>
                <Text style={styles.stepSubtitle}>Action plan and clinical summary</Text>
              </View>
            </View>
            
            {/* Treatment Plan */}
            {renderFieldWithSpeech('Treatment Plan', 'treatmentPlan', true)}
            
            {/* Clinical Summary */}
            {renderFieldWithSpeech('Clinical Summary', 'clinicalSummary', true)}
          </View>
        );
        
      case 5:
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <View style={styles.stepHeaderIconContainer}>
                <Plus size={32} color="#1E40AF" />
              </View>
              <View>
                <Text style={styles.stepContentTitle}>Additional</Text>
                <Text style={styles.stepSubtitle}>Post-consultation attachments</Text>
              </View>
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
        );
        
      default:
        return null;
    }
  };

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
        <View style={styles.headerActions}>
          {/* View Medical History Button - Only show if appointment/referral is completed */}
          {isCompleted && (consultationIdString || referralIdString) && (
            <TouchableOpacity
              style={styles.viewHistoryButton}
              onPress={loadMedicalHistory}
            >
              <Eye size={20} color="#1E40AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Step Indicator */}
      {renderStepIndicator()}

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
                {/* Step Content */}
        {renderStepContent()}
      </ScrollView>

      {/* Bottom Action Buttons */}
      <View style={styles.bottomContainer}>
        {/* Step Navigation */}
        <View style={styles.stepNavigation}>
          {currentStep > 1 && (
            <TouchableOpacity
              style={styles.stepNavButton}
              onPress={goToPreviousStep}
            >
              <Text style={styles.stepNavButtonText}>Previous</Text>
            </TouchableOpacity>
          )}
          
          <Text style={styles.stepIndicator}>{currentStep}/{totalSteps}</Text>
          
          {currentStep < totalSteps ? (
            <TouchableOpacity
              style={styles.stepNavButton}
              onPress={goToNextStep}
            >
              <Text style={styles.stepNavButtonText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.stepNavButton}
              onPress={handleSaveChanges}
              disabled={!hasChanges}
            >
              <Text style={styles.stepNavButtonText}>Save</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Complete Consultation Button - Only show on last step */}
        {currentStep === totalSteps && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={handleCompleteConsultation}
          >
            <CheckCircle size={18} color="#FFFFFF" />
            <Text style={styles.completeButtonText}>Complete Consultation</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Medical History Modal */}
      <Modal
        visible={showMedicalHistoryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMedicalHistoryModal(false)}
      >
        <SafeAreaView style={styles.medicalHistoryModalContainer}>
          <StatusBar barStyle="dark-content" />
          
          {/* Header */}
          <View style={styles.medicalHistoryModalHeader}>
            <TouchableOpacity
              style={styles.medicalHistoryModalBackButton}
              onPress={() => setShowMedicalHistoryModal(false)}
            >
              <Text style={styles.medicalHistoryModalBackText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.medicalHistoryModalTitle}>Medical History</Text>
            <View style={styles.medicalHistoryModalSpacer} />
          </View>

          {/* Content */}
          <ScrollView 
            style={styles.medicalHistoryModalContent}
            showsVerticalScrollIndicator={false}
          >
            {loadingMedicalHistory ? (
              <View style={styles.medicalHistoryLoadingContainer}>
                <Text style={styles.medicalHistoryLoadingText}>Loading medical history...</Text>
              </View>
            ) : medicalHistory ? (
              <View style={styles.medicalHistoryContent}>
                {/* Clinical Summary */}
                <View style={styles.medicalHistorySection}>
                  <Text style={styles.medicalHistorySectionTitle}>Clinical Summary</Text>
                  <View style={styles.medicalHistoryCard}>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Diagnosis:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.diagnosis && medicalHistory.diagnosis.length > 0 
                          ? medicalHistory.diagnosis[0].description 
                          : 'Not specified'}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Differential Diagnosis:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.differentialDiagnosis || 'Not specified'}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Clinical Summary:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.clinicalSummary || 'Not specified'}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Treatment Plan:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.treatmentPlan || 'Not specified'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* SOAP Notes */}
                <View style={styles.medicalHistorySection}>
                  <Text style={styles.medicalHistorySectionTitle}>SOAP Notes</Text>
                  <View style={styles.medicalHistoryCard}>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Subjective:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.soapNotes?.subjective || 'Not specified'}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Objective:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.soapNotes?.objective || 'Not specified'}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Assessment:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.soapNotes?.assessment || 'Not specified'}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Plan:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.soapNotes?.plan || 'Not specified'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Additional Information */}
                <View style={styles.medicalHistorySection}>
                  <Text style={styles.medicalHistorySectionTitle}>Additional Information</Text>
                  <View style={styles.medicalHistoryCard}>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Lab Results:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.labResults || 'Not specified'}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Allergies:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.allergies || 'Not specified'}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Vitals:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.vitals || 'Not specified'}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Medications:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.medications || 'Not specified'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Prescriptions */}
                {medicalHistory.prescriptions && medicalHistory.prescriptions.length > 0 && (
                  <View style={styles.medicalHistorySection}>
                    <Text style={styles.medicalHistorySectionTitle}>Prescriptions</Text>
                    <View style={styles.medicalHistoryCard}>
                      {medicalHistory.prescriptions.map((prescription: any, index: number) => (
                        <View key={index} style={styles.prescriptionItem}>
                          <Text style={styles.prescriptionMedication}>{prescription.medication}</Text>
                          <Text style={styles.prescriptionDetailsText}>
                            {prescription.dosage} • {prescription.frequency}
                          </Text>
                          {prescription.description && (
                            <Text style={styles.prescriptionDescriptionText}>{prescription.description}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Certificates */}
                {medicalHistory.certificates && medicalHistory.certificates.length > 0 && (
                  <View style={styles.medicalHistorySection}>
                    <Text style={styles.medicalHistorySectionTitle}>Medical Certificates</Text>
                    <View style={styles.medicalHistoryCard}>
                      {medicalHistory.certificates.map((certificate: any, index: number) => (
                        <View key={index} style={styles.certificateItem}>
                          <Text style={styles.certificateTypeText}>{certificate.type}</Text>
                          <Text style={styles.certificateDescriptionText}>{certificate.description}</Text>
                          {certificate.validUntil && (
                            <Text style={styles.certificateValidUntil}>Valid until: {certificate.validUntil}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Consultation Details */}
                <View style={styles.medicalHistorySection}>
                  <Text style={styles.medicalHistorySectionTitle}>Consultation Details</Text>
                  <View style={styles.medicalHistoryCard}>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Consultation Date:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {new Date(medicalHistory.consultationDate).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Consultation Time:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {medicalHistory.consultationTime}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Provider:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        Dr. {medicalHistory.provider?.firstName} {medicalHistory.provider?.lastName}
                      </Text>
                    </View>
                    <View style={styles.medicalHistoryField}>
                      <Text style={styles.medicalHistoryFieldLabel}>Last Updated:</Text>
                      <Text style={styles.medicalHistoryFieldValue}>
                        {new Date(medicalHistory.lastUpdated).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.medicalHistoryEmptyContainer}>
                <Text style={styles.medicalHistoryEmptyTitle}>No Medical History Available</Text>
                <Text style={styles.medicalHistoryEmptyText}>
                  Medical history for this consultation has not been recorded yet.
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    position: 'relative',
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
    position: 'absolute',
    left: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'absolute',
    right: 24,
  },
  viewHistoryButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
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
  // Medical History Modal Styles
  medicalHistoryModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  medicalHistoryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  medicalHistoryModalBackButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  medicalHistoryModalBackText: {
    fontSize: 16,
    color: '#1E40AF',
    fontFamily: 'Inter-SemiBold',
  },
  medicalHistoryModalTitle: {
    fontSize: 18,
    color: '#1F2937',
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    flex: 1,
  },
  medicalHistoryModalSpacer: {
    width: 60,
  },
  medicalHistoryModalContent: {
    flex: 1,
  },
  medicalHistoryLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  medicalHistoryLoadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  medicalHistoryContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  medicalHistorySection: {
    marginBottom: 24,
  },
  medicalHistorySectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  medicalHistoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  medicalHistoryField: {
    marginBottom: 12,
  },
  medicalHistoryFieldLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 4,
  },
  medicalHistoryFieldValue: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    lineHeight: 20,
  },
  prescriptionItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  prescriptionMedication: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  prescriptionDetailsText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  prescriptionDescriptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    fontStyle: 'italic',
  },
  certificateItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  certificateTypeText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  certificateDescriptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  certificateValidUntil: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  medicalHistoryEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  medicalHistoryEmptyTitle: {
    fontSize: 18,
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 12,
    textAlign: 'center',
  },
  medicalHistoryEmptyText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Step Indicator Styles
  stepIndicatorContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  stepProgressBar: {
    marginBottom: 20,
  },
  stepProgressText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepProgressLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  stepProgressPercentage: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1E40AF',
    borderRadius: 3,
  },
  stepTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  stepIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIconActive: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  stepIconCompleted: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  stepIconText: {
    fontSize: 18,
  },
  stepCheckmark: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  stepTitle: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  stepTitleActive: {
    color: '#1E40AF',
    fontFamily: 'Inter-SemiBold',
  },
  stepTitleCompleted: {
    color: '#1E40AF',
    fontFamily: 'Inter-SemiBold',
  },
  
  // Step Content Styles
  stepContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
  },
  stepHeaderIcon: {
    fontSize: 32,
  },
  stepHeaderIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepContentTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  
  // Step Navigation Styles
  stepNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stepNavButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 80,
    alignItems: 'center',
  },
  stepNavButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  stepIndicator: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
});