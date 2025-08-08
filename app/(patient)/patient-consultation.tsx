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
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useVoiceToText } from '../../src/hooks/useVoiceToText';
import { useAuth } from '../../src/hooks/auth/useAuth';
import { databaseService } from '../../src/services/database/firebase';
import { ref, update } from 'firebase/database';
import { database } from '@/config/firebase';

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
        diagnosis: medicalHistory?.diagnosis?.[0]?.description || '',
        differentialDiagnosis: medicalHistory?.differentialDiagnosis || '',
        reviewOfSymptoms: medicalHistory?.reviewOfSymptoms || referral?.initialReasonForReferral || '',
        presentIllnessHistory: medicalHistory?.presentIllnessHistory || '',
        subjective: medicalHistory?.soapNotes?.subjective || '',
        objective: medicalHistory?.soapNotes?.objective || '',
        assessment: medicalHistory?.soapNotes?.assessment || '',
        plan: medicalHistory?.soapNotes?.plan || '',
        labResults: medicalHistory?.labResults || '',
        allergies: medicalHistory?.allergies || '',
        medications: medicalHistory?.medications || '',
        vitals: medicalHistory?.vitals || '',
        prescriptions: medicalHistory?.prescriptions || [],
        certificates: medicalHistory?.certificates || [],
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
          type: 'consultation',
          clinicalSummary: formData.diagnosis,
          treatmentPlan: formData.plan,
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
    // Debug: Log patientId being fetched
    console.log('=== DEBUG: Patient ID Check ===');
    console.log('patientId from useLocalSearchParams:', patientId);
    console.log('patientId type:', typeof patientId);
    console.log('patientId is array:', Array.isArray(patientId));
    console.log('patientId string value:', Array.isArray(patientId) ? patientId[0] : patientId);
    console.log('================================');

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
              // Generate a unique consultationId for this specific consultation
              let consultationIdToUse = consultationIdString as string;
              
              if (!consultationIdToUse) {
                // Generate a new consultationId using Firebase push key
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
                  patientId: patientIdString,
                  provider: {
                    id: user?.uid || '',
                    firstName: user?.name?.split(' ')[0] || '',
                    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
                    providerType: 'specialist',
                    sourceSystem: 'unihealth',
                  },
                  type: 'consultation',
                  clinicalSummary: formData.diagnosis,
                  treatmentPlan: formData.plan,
                };

                // Use Firebase push to generate the consultationId
                consultationIdToUse = await databaseService.pushDocument(`patientMedicalHistory/${patientIdString}/entries`, medicalHistoryData);
                console.log('Generated consultationId using Firebase push key:', consultationIdToUse);
              } else {
                console.log('Using existing consultationId:', consultationIdToUse);
              }
              
              // Step 1: ALWAYS handle the original appointment first (generalist always makes a diagnosis)
              // If consultationIdString exists, it's the original appointment that needs appointmentConsultationId
              if (consultationIdString) {
                // Check if this is a referral by looking it up
                try {
                  const referral = await databaseService.getReferralById(consultationIdString as string);
                  if (referral) {
                    // This is a referral, but we still need to handle the original appointment
                    // The original appointment should have appointmentConsultationId set
                    console.log('Found referral, but original appointment still needs appointmentConsultationId');
                  }
                } catch (error) {
                  console.log('Error checking referral/appointment:', error);
                }
                
                // ALWAYS generate appointmentConsultationId for the original appointment
                let appointmentConsultationId = consultationIdToUse;
                if (!appointmentConsultationId) {
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
                    patientId: patientIdString,
                    provider: {
                      id: user?.uid || '',
                      firstName: user?.name?.split(' ')[0] || '',
                      lastName: user?.name?.split(' ').slice(1).join(' ') || '',
                      providerType: 'specialist',
                      sourceSystem: 'unihealth',
                    },
                    type: 'consultation',
                    clinicalSummary: formData.diagnosis,
                    treatmentPlan: formData.plan,
                  };
                  appointmentConsultationId = await databaseService.pushDocument(`patientMedicalHistory/${patientIdString}/entries`, medicalHistoryData);
                  console.log('Generated appointmentConsultationId using Firebase push key:', appointmentConsultationId);
                }
                
                console.log('Updating appointment status to completed with appointmentConsultationId:', appointmentConsultationId);
                await databaseService.updateAppointment(consultationIdString as string, {
                  status: 'completed',
                  appointmentConsultationId: appointmentConsultationId,
                });
                console.log('Appointment status updated successfully');
              }

              // Step 2: If there's also a referral being created, handle it separately
              if (referralIdString) {
                // Generate a separate referralConsultationId for the referral
                let referralConsultationId = null;
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
                  patientId: patientIdString,
                  provider: {
                    id: user?.uid || '',
                    firstName: user?.name?.split(' ')[0] || '',
                    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
                    providerType: 'specialist',
                    sourceSystem: 'unihealth',
                  },
                  type: 'consultation',
                  clinicalSummary: formData.diagnosis,
                  treatmentPlan: formData.plan,
                };
                referralConsultationId = await databaseService.pushDocument(`patientMedicalHistory/${patientIdString}/entries`, medicalHistoryData);
                console.log('Generated referralConsultationId using Firebase push key:', referralConsultationId);
                
                console.log('Updating referral status to completed with referralConsultationId:', referralConsultationId);
                const referralRef = ref(database, `referrals/${referralIdString}`);
                await update(referralRef, {
                  status: 'completed',
                  referralConsultationId: referralConsultationId,
                  lastUpdated: new Date().toISOString(),
                });
                console.log('Referral status updated successfully');
              }

              // Step 2: If we didn't already save the medical history data (when consultationIdToUse was generated),
              // save it now with the existing consultationId
              if (consultationIdString) {
                console.log('=== DEBUG: Medical History Data ===');
                console.log('Using patientIdString for medical history:', patientIdString);
                console.log('consultationIdToUse:', consultationIdToUse);
                
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
                  patientId: patientIdString,
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
                  createdAt: new Date().toISOString(),
                };

                // Save to patientMedicalHistory node with the existing consultationId
                const medicalHistoryPath = `patientMedicalHistory/${patientIdString}/entries/${consultationIdToUse}`;
                console.log('Saving consultation data to path:', medicalHistoryPath);
                console.log('Medical history data keys:', Object.keys(medicalHistoryData));
                await databaseService.setDocument(medicalHistoryPath, medicalHistoryData);
                console.log('Consultation data saved to medical history successfully');
                console.log('================================');
              }

              Alert.alert('Success', 'Consultation completed successfully!', [
                {
                  text: 'OK',
                  onPress: () => {
                    try {
                      router.push('/(specialist)/tabs/appointments?filter=completed');
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
});


