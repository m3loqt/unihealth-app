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
  Pressable,
  Dimensions,
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
  Wallet,
  ChevronDown,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
import { useVoiceToText } from '../../src/hooks/useVoiceToText';
import { useAuth } from '../../src/hooks/auth/useAuth';
import { databaseService } from '../../src/services/database/firebase';
import { ref, update } from 'firebase/database';
import { database } from '@/config/firebase';
import { safeDataAccess } from '../../src/utils/safeDataAccess';
import { FrequencySelectionModal, RouteSelectionModal, DurationUnitSelectionModal } from '../../src/components';
import { formatFrequency, formatRoute } from '../../src/utils/formatting';

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
    diagnoses: Array<{ code: string; description: string }>;
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
  }>({
    presentIllnessHistory: '',
    reviewOfSymptoms: '',
    labResults: '',
    medications: '',
    diagnoses: [],
    differentialDiagnosis: '',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    treatmentPlan: '',
    clinicalSummary: '',
    prescriptions: [],
    certificates: [],
    
  });

  // Derived validation for required fields (prescriptions and certificates are optional)
  const isCompleteEnabled = (() => {
    const requiredStrings = [
      formData.presentIllnessHistory,
      formData.reviewOfSymptoms,
      formData.labResults,
      formData.medications,
      formData.differentialDiagnosis,
      formData.subjective,
      formData.objective,
      formData.assessment,
      formData.plan,
      formData.treatmentPlan,
      formData.clinicalSummary,
    ];
    const allTextFilled = requiredStrings.every((v) => typeof v === 'string' && v.trim().length > 0);
    const hasDiagnoses = formData.diagnoses.length > 0 && formData.diagnoses.every((d) =>
      (d.code || '').toString().trim().length > 0 && (d.description || '').toString().trim().length > 0
    );
    return allTextFilled && hasDiagnoses;
  })();

  // Calculate progress based on required fields completion (not on current step)
  const progressPercent = (() => {
    const requiredFields = [
      formData.presentIllnessHistory,
      formData.reviewOfSymptoms,
      formData.labResults,
      formData.medications,
      formData.differentialDiagnosis,
      formData.subjective,
      formData.objective,
      formData.assessment,
      formData.plan,
      formData.treatmentPlan,
      formData.clinicalSummary,
    ];
    const totalRequired = requiredFields.length + 1; // +1 for Diagnoses block
    const completedText = requiredFields.filter((v) => typeof v === 'string' && v.trim().length > 0).length;
    const diagnosesComplete = formData.diagnoses.length > 0 && formData.diagnoses.every((d) =>
      (d.code || '').toString().trim().length > 0 && (d.description || '').toString().trim().length > 0
    );
    const completed = completedText + (diagnosesComplete ? 1 : 0);
    const pct = Math.max(0, Math.min(100, Math.round((completed / totalRequired) * 100)));
    return pct;
  })();

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

      console.log('🔍 Loading medical history:', medicalHistory);
      console.log('🔍 Medical history diagnosis field:', medicalHistory?.diagnosis);
      console.log('🔍 Number of diagnoses in medical history:', medicalHistory?.diagnosis?.length || 0);
      
      setFormData({
        // Step 1: Patient History
        presentIllnessHistory: medicalHistory?.presentIllnessHistory || '',
        reviewOfSymptoms: medicalHistory?.reviewOfSymptoms || '',
        
        // Step 2: Findings
        labResults: medicalHistory?.labResults || '',
        medications: medicalHistory?.medications || '',
        
        // Step 3: Diagnoses
        diagnoses: medicalHistory?.diagnosis || [],
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

      });
      
      console.log('🔍 Form data set with diagnoses:', medicalHistory?.diagnosis || []);
      console.log('🔍 Number of diagnoses in form data after setting:', (medicalHistory?.diagnosis || []).length);
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
  const [showFrequencyModal, setShowFrequencyModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showDurationUnitModal, setShowDurationUnitModal] = useState(false);
  
  // Step navigation state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;
  const [newPrescription, setNewPrescription] = useState({
    medication: '',
    dosage: '',
    frequency: '',
    route: '',
    durationNumber: '',
    durationUnit: '',
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

  // Diagnosis input state
  const [newDiagnosisCode, setNewDiagnosisCode] = useState('');
  const [newDiagnosisDescription, setNewDiagnosisDescription] = useState('');
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeChecked, setFeeChecked] = useState(false);
  const [professionalFee, setProfessionalFee] = useState<number | null>(null);
  const [loadingFee, setLoadingFee] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

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

  // Monitor formData changes for debugging
  useEffect(() => {
    console.log('🔍 FormData diagnoses changed:', formData.diagnoses);
    console.log('🔍 Number of diagnoses in formData:', formData.diagnoses.length);
  }, [formData.diagnoses]);

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
      const isDiagnosisDesc = activeField.startsWith('diagnoses.description.');
      const isNewDiagnosisDesc = activeField === 'newDiagnosis.description';

      if (isDiagnosisDesc) {
        const indexStr = activeField.split('.').pop() as string;
        const index = parseInt(indexStr, 10);
        setFormData((prev) => {
          const next = { ...prev };
          const list = [...next.diagnoses];
          if (list[index]) {
            list[index] = { ...list[index], description: transcript };
            next.diagnoses = list;
          }
          return next;
        });
        setHasChanges(true);
      } else if (isNewDiagnosisDesc) {
        setNewDiagnosisDescription(transcript);
        setHasChanges(true);
      } else {
        setFormData((prev) => {
          const updated: any = { ...prev };
          (updated as any)[activeField] = transcript; // fallback for simple fields
          return updated;
        });
        setHasChanges(true);
      }

      // Clear activeField after updating the form
      setTimeout(() => {
        setActiveField(null);
        setIsLoading(false);
        stopPulseAnimation();
        stopLoadingAnimation();
      }, 500);
    }
  }, [transcript, activeField]);

  // -- Diagnosis Management --
  const addDiagnosis = () => {
    if (newDiagnosisCode.trim() && newDiagnosisDescription.trim()) {
      console.log('Adding diagnosis:', { code: newDiagnosisCode.trim(), description: newDiagnosisDescription.trim() });
      
      setFormData(prev => {
        const newDiagnoses = [...prev.diagnoses, {
          code: newDiagnosisCode.trim(),
          description: newDiagnosisDescription.trim()
        }];
        console.log('Updated diagnoses array:', newDiagnoses);
        console.log('Number of diagnoses after adding:', newDiagnoses.length);
        
        return {
          ...prev,
          diagnoses: newDiagnoses
        };
      });
      setNewDiagnosisCode('');
      setNewDiagnosisDescription('');
      setHasChanges(true);
    }
  };

  const removeDiagnosis = (index: number) => {
    setFormData(prev => ({
      ...prev,
      diagnoses: prev.diagnoses.filter((_, i) => i !== index)
    }));
    setHasChanges(true);
  };

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
      // Start loading animation immediately, before awaiting stop
      setIsLoading(true);
      startLoadingAnimation();
      await stopRecording();
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

  // --- PROFESSIONAL FEE MODAL LOGIC ---
  const formatCurrency = (amount?: number | null) => {
    if (amount == null) return '₱0.00';
    try {
      return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
    } catch {
      return `₱${Number(amount).toFixed(2)}`;
    }
  };

  const loadProfessionalFee = async () => {
    if (!user?.uid) return;
    try {
      setLoadingFee(true);
      // Primary source: doctors node per DB export
      const doctorRecord = await databaseService.getDocument(`doctors/${user.uid}`);
      // Fallbacks for older nodes
      const specialist = doctorRecord || (await databaseService.getDocument(`specialists/${user.uid}`)) || (await databaseService.getDocument(`users/${user.uid}`));
      const fee = specialist?.professionalFee
        || specialist?.professional_fee
        || specialist?.consultationFee
        || specialist?.consultation_fee
        || specialist?.fee
        || 0;
      setProfessionalFee(Number(fee) || 0);
    } catch (e) {
      setProfessionalFee(0);
    } finally {
      setLoadingFee(false);
    }
  };

  const handleOpenFeeModal = async () => {
    setFeeChecked(false);
    await loadProfessionalFee();
    setShowFeeModal(true);
  };

  const handleCloseFeeModal = () => {
    setShowFeeModal(false);
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
    
    // Validate duration fields
    if (newPrescription.durationNumber && !newPrescription.durationUnit) {
      Alert.alert('Error', 'Please select a duration unit.');
      return;
    }
    
    if (newPrescription.durationUnit && !newPrescription.durationNumber) {
      Alert.alert('Error', 'Please enter a duration number.');
      return;
    }
    
    // Combine duration number and unit
    const duration = newPrescription.durationNumber && newPrescription.durationUnit 
      ? `${newPrescription.durationNumber} ${newPrescription.durationUnit}`
      : '';
    
    // const prescription = {
    //   id: Date.now(),
    //   ...newPrescription,
    //   duration,
    //   prescribedDate: new Date().toLocaleDateString(),
    // };

    const prescription = {
      id: Date.now(),
      medication: newPrescription.medication,
      dosage: newPrescription.dosage,
      frequency: newPrescription.frequency,
      route: newPrescription.route,
      duration,
      description: newPrescription.description,
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
      route: '',
      durationNumber: '',
      durationUnit: '',
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
      // doctor: 'Dr. Sarah Johnson',
      // clinic: 'San Francisco General Hospital',
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
      
      if (referralData && referralData.status === 'completed' && referralData.referralConsultationId) {
        // Use referralConsultationId from completed referral (this is the Firebase push key)
        consultationIdToUse = referralData.referralConsultationId;
      } else if (appointmentData && appointmentData.status === 'completed' && appointmentData.appointmentConsultationId) {
        // Use appointmentConsultationId from completed appointment (this is the Firebase push key)
        consultationIdToUse = appointmentData.appointmentConsultationId;
      } else if (referralData && referralData.status === 'completed' && referralData.consultationId) {
        // Fallback to old consultationId format
        consultationIdToUse = referralData.consultationId;
      } else if (appointmentData && appointmentData.status === 'completed' && appointmentData.consultationId) {
        // Fallback to old consultationId format
        consultationIdToUse = appointmentData.consultationId;
      } else {
        // Fallback to the original consultationIdString
        consultationIdToUse = (consultationIdString as string) || '';
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
          diagnosis: formData.diagnoses,
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
          
          consultationDate: new Date().toISOString(),
          consultationTime: new Date().toLocaleTimeString(),
          patientId: patientId as string,
          provider: {
            id: user?.uid || '',
            firstName: user?.firstName || '',
            lastName: user?.lastName || '',
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
          diagnosis: formData.diagnoses,
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
          medications: formData.medications,
          prescriptions: formData.prescriptions,
          certificates: formData.certificates,
          consultationDate: new Date().toISOString(),
          consultationTime: new Date().toLocaleTimeString(),
          patientId: patientId as string,
          provider: {
            id: user?.uid || '',
            firstName: user?.firstName || '',
            lastName: user?.lastName || '',
            providerType: 'specialist',
            sourceSystem: 'unihealth',
          },
          relatedAppointment: {
            id: consultationIdToUse,
            type: 'consultation',
          },
          type: 'consultation',
          clinicalSummary: formData.diagnoses.length > 0 ? formData.diagnoses[0].description : '',
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
    // Open fee modal first; confirmation proceeds after checkbox
    await loadProfessionalFee();
    setFeeChecked(false);
    setShowFeeModal(true);
  };

  const confirmCompleteConsultation = async () => {
    if (!patientId) {
      Alert.alert('Error', 'No patient ID found.');
      return;
    }

    const patientIdString = Array.isArray(patientId) ? patientId[0] : patientId;
    console.log('Using patientIdString:', patientIdString);

    try {
      setIsCompleting(true);
      setIsLoading(true);

      // Prepare consultation data
      console.log('Form data diagnoses before saving:', formData.diagnoses);
      console.log('Number of diagnoses:', formData.diagnoses.length);

      const consultationData = {
        diagnosis: formData.diagnoses,
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
        medications: formData.medications,
        prescriptions: formData.prescriptions,
        certificates: formData.certificates,
        clinicalSummary: formData.clinicalSummary,
        treatmentPlan: formData.treatmentPlan,
        provider: {
          id: user?.uid || '',
          firstName: user?.firstName || '',
          lastName: user?.lastName || '',
          providerType: 'specialist',
          sourceSystem: 'UniHealth_Patient_App',
        },
        type: 'General Consultation',
      };

      // Handle consultation - prioritize referral if both exist
      if (referralIdString) {
        console.log('Saving consultation for referral:', referralIdString);
        console.log('Referral ID format check:', {
          referralId: referralIdString,
          isFirebaseKey: (referralIdString as string).startsWith('-'),
          length: (referralIdString as string).length,
        });

        const referralConsultationId = await databaseService.saveReferralConsultationData(
          patientIdString,
          referralIdString as string,
          {
            ...consultationData,
            type: 'Referral Consultation',
          }
        );
        console.log('Referral consultation saved with ID:', referralConsultationId);

        // Update referral with the referralConsultationId to create the link
        try {
          const referralExists = await databaseService.getReferralById(referralIdString as string);
          if (referralExists) {
            await databaseService.updateReferral(referralIdString as string, {
              status: 'completed',
              referralConsultationId,
            });
            console.log('Referral updated with referralConsultationId:', referralConsultationId);
          } else {
            console.warn('Referral not found with ID:', referralIdString);
          }
        } catch (error) {
          console.error('Error updating referral with consultation ID:', error);
        }

        // Clean up temporary referral data saved with referralId as the key
        try {
          await databaseService.cleanupTemporaryReferralData(patientIdString, referralIdString as string);
          console.log('Temporary referral data cleaned up successfully');
        } catch (cleanupError) {
          console.error('Error cleaning up temporary referral data:', cleanupError);
        }

        // If there's also an appointment ID, update its status to completed
        if (consultationIdString) {
          try {
            await databaseService.updateAppointmentStatus(consultationIdString as string, 'completed');
            console.log('Appointment status updated to completed');
          } catch (error) {
            console.error('Error updating appointment status:', error);
          }
        }
      } else if (consultationIdString) {
        console.log('Saving consultation for appointment:', consultationIdString);
        const consultationId = await databaseService.saveConsultationData(
          patientIdString,
          consultationIdString as string,
          consultationData
        );
        console.log('Consultation saved with ID:', consultationId);

        // Update appointment status to completed
        try {
          await databaseService.updateAppointmentStatus(consultationIdString as string, 'completed');
          console.log('Appointment status updated to completed');
        } catch (error) {
          console.error('Error updating appointment status:', error);
        }
      }

      // Update local state to reflect completion
      setIsCompleted(true);

      // Close the modal and navigate back to force refresh of details page
      setShowFeeModal(false);
      const refreshParam = `&_=${Date.now()}`;
      if (referralIdString) {
        router.replace(`/(specialist)/referral-details?id=${referralIdString}${refreshParam}`);
      } else if (consultationIdString) {
        router.replace(`/visit-overview?id=${consultationIdString}${refreshParam}`);
      } else {
        router.back();
      }
    } catch (error) {
      console.error('Error saving consultation:', error);
      Alert.alert('Error', 'Failed to save consultation. Please try again.');
    } finally {
      setIsLoading(false);
      setIsCompleting(false);
    }
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
            <Text style={styles.stepProgressPercentage}>{progressPercent}% Complete</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>
        
        <View style={styles.stepTabs}>
          {steps.map((step) => (
            <TouchableOpacity
              key={step.id}
              style={[
                styles.stepTab,
                currentStep === step.id && styles.stepTabActive,
              ]}
              onPress={() => goToStep(step.id)}
            >
              <View style={[
                styles.stepIcon,
                currentStep === step.id && styles.stepIconActive,
              ]}>
                <View style={styles.stepIconContainer}>
                  {step.icon === 'User' && <User size={20} color={currentStep === step.id ? "#FFFFFF" : "#1E40AF"} />}
                  {step.icon === 'Search' && <Search size={20} color={currentStep === step.id ? "#FFFFFF" : "#1E40AF"} />}
                  {step.icon === 'FileText' && <FileText size={20} color={currentStep === step.id ? "#FFFFFF" : "#1E40AF"} />}
                  {step.icon === 'Edit' && <Edit size={20} color={currentStep === step.id ? "#FFFFFF" : "#1E40AF"} />}
                  {step.icon === 'Plus' && <Plus size={20} color={currentStep === step.id ? "#FFFFFF" : "#1E40AF"} />}
                </View>
              </View>
              <Text style={[
                styles.stepTitle,
                currentStep === step.id && styles.stepTitleActive,
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
      <Text style={styles.fieldLabel}>
        {label}
        <Text style={styles.requiredSuffix}> (required)</Text>
      </Text>
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
                <Text style={styles.stepSubtitle}>Evidence collection, diagnoses, and findings</Text>
              </View>
            </View>
            
            {/* Lab Results */}
            {renderFieldWithSpeech('Lab Results', 'labResults', true)}
            
            {/* Medications */}
            {renderFieldWithSpeech('Medications', 'medications', true)}
            
            {/* Diagnosis */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Diagnoses<Text style={styles.requiredSuffix}> (required)</Text></Text>
              
              {/* Existing Diagnoses (editable inputs) */}
              {formData.diagnoses.map((diagnosis, index) => (
                <View key={index} style={styles.diagnosisItem}>
                  <View style={styles.diagnosisInputsRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>
                        Code<Text style={styles.requiredAsterisk}> *</Text>
                      </Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          style={[styles.textInput, styles.diagnosisTextInput]}
                          placeholder="Enter code..."
                          placeholderTextColor="#9CA3AF"
                          value={diagnosis.code}
                          onChangeText={(v) => {
                            setFormData((prev) => {
                              const next = { ...prev };
                              const list = [...next.diagnoses];
                              list[index] = { ...list[index], code: v };
                              next.diagnoses = list;
                              return next;
                            });
                            setHasChanges(true);
                          }}
                        />
                      </View>
                    </View>
                    <View style={{ flex: 2, marginLeft: 12 }}>
                      <Text style={styles.fieldLabel}>
                        Description<Text style={styles.requiredSuffix}> (required)</Text>
                      </Text>
                      <View style={styles.inputContainerWithAction}>
                        <TextInput
                          style={[styles.textInput, styles.diagnosisTextInput, { flex: 1 }]}
                          placeholder="Enter description..."
                          placeholderTextColor="#9CA3AF"
                          value={diagnosis.description}
                          onChangeText={(v) => {
                            setFormData((prev) => {
                              const next = { ...prev };
                              const list = [...next.diagnoses];
                              list[index] = { ...list[index], description: v };
                              next.diagnoses = list;
                              return next;
                            });
                            setHasChanges(true);
                          }}
                        />
                        <TouchableOpacity
                          style={[
                            styles.micButton,
                            activeField === `diagnoses.description.${index}` && styles.micButtonActive,
                            { marginTop: 4 }
                          ]}
                          onPress={() => {
                            const fieldKey = `diagnoses.description.${index}`;
                            if (activeField === fieldKey && isRecording) {
                              handleStopRecording();
                            } else {
                              handleStartRecording(fieldKey);
                            }
                          }}
                        >
                          <Animated.View
                            style={[
                              styles.micIconContainer,
                              activeField === `diagnoses.description.${index}` && {
                                transform: [{ scale: pulseAnim }],
                                backgroundColor: '#1E40AF',
                                borderColor: '#1E40AF',
                              },
                            ]}
                          >
                            <Mic size={16} color={activeField === `diagnoses.description.${index}` ? '#FFFFFF' : '#1E40AF'} />
                          </Animated.View>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.removeDiagnosisButton]}
                      onPress={() => removeDiagnosis(index)}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              
              {/* Add New Diagnosis */}
              <View style={styles.addDiagnosisContainer}>
                <View style={styles.diagnosisInputRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Code<Text style={styles.requiredAsterisk}> *</Text></Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={[styles.textInput, styles.diagnosisCodeInput, styles.diagnosisTextInput]}
                        value={newDiagnosisCode}
                        onChangeText={setNewDiagnosisCode}
                        placeholder="Enter code..."
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.fieldLabel}>Description<Text style={styles.requiredSuffix}> (required)</Text></Text>
                    <View style={styles.inputContainerWithAction}>
                      <TextInput
                        style={[styles.textInput, styles.diagnosisDescriptionInput, styles.diagnosisTextInput, { flex: 1 }]}
                        value={newDiagnosisDescription}
                        onChangeText={setNewDiagnosisDescription}
                        placeholder="Enter description..."
                        placeholderTextColor="#9CA3AF"
                      />
                      <TouchableOpacity
                        style={[
                          styles.micButton,
                          activeField === 'newDiagnosis.description' && styles.micButtonActive,
                          { marginTop: 4 }
                        ]}
                        onPress={() => {
                          const fieldKey = 'newDiagnosis.description';
                          if (activeField === fieldKey && isRecording) {
                            handleStopRecording();
                          } else {
                            handleStartRecording(fieldKey);
                          }
                        }}
                      >
                        <Animated.View
                          style={[
                            styles.micIconContainer,
                            activeField === 'newDiagnosis.description' && {
                              transform: [{ scale: pulseAnim }],
                              backgroundColor: '#1E40AF',
                              borderColor: '#1E40AF',
                            },
                          ]}
                        >
                          <Mic size={16} color={activeField === 'newDiagnosis.description' ? '#FFFFFF' : '#1E40AF'} />
                        </Animated.View>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.addDiagnosisButton,
                      { backgroundColor: (!newDiagnosisCode.trim() || !newDiagnosisDescription.trim()) ? '#9CA3AF' : '#1E40AF' }
                    ]}
                    onPress={addDiagnosis}
                    disabled={!newDiagnosisCode.trim() || !newDiagnosisDescription.trim()}
                  >
                    <Plus size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            
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
                          {prescription.dosage} • {formatFrequency(prescription.frequency, 'patient')} • {formatRoute(prescription.route, 'patient')}
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
                             <TouchableOpacity
                               style={[styles.addFormInput, styles.addFormInputHalf, styles.frequencyButton]}
                               onPress={() => setShowFrequencyModal(true)}
                             >
                               <View style={styles.frequencyButtonContent}>
                                 <Text style={newPrescription.frequency ? styles.frequencyButtonText : styles.frequencyButtonPlaceholder}>
                                   {newPrescription.frequency || 'Frequency'}
                                 </Text>
                                 <ChevronDown size={16} color="#6B7280" />
                               </View>
                             </TouchableOpacity>
                           </View>
                           <View style={styles.addFormRow}>
                             <TouchableOpacity
                               style={[styles.addFormInput, styles.addFormInputRoute, styles.frequencyButton]}
                               onPress={() => setShowRouteModal(true)}
                             >
                               <View style={styles.frequencyButtonContent}>
                                 <Text style={newPrescription.route ? styles.frequencyButtonText : styles.frequencyButtonPlaceholder}>
                                   {newPrescription.route || 'Route'}
                                 </Text>
                                 <ChevronDown size={16} color="#6B7280" />
                               </View>
                             </TouchableOpacity>
                             <TextInput
                               style={[styles.addFormInput, styles.addFormInputDuration]}
                               placeholder="Duration"
                               value={newPrescription.durationNumber}
                               onChangeText={(value) => {
                                 // Only allow numbers 1-30
                                 const numValue = parseInt(value, 10);
                                 if (value === '' || (numValue >= 1 && numValue <= 30)) {
                                   setNewPrescription((prev) => ({ ...prev, durationNumber: value }));
                                 }
                               }}
                               keyboardType="numeric"
                               maxLength={2}
                             />
                             <TouchableOpacity
                               style={[styles.addFormInput, styles.addFormInputUnit, styles.frequencyButton]}
                               onPress={() => setShowDurationUnitModal(true)}
                             >
                               <View style={styles.frequencyButtonContent}>
                                 <Text style={newPrescription.durationUnit ? styles.frequencyButtonText : styles.frequencyButtonPlaceholder}>
                                   {newPrescription.durationUnit || 'Unit'}
                                 </Text>
                                 <ChevronDown size={16} color="#6B7280" />
                               </View>
                             </TouchableOpacity>
                           </View>
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
                          route: '',
                          durationNumber: '',
                          durationUnit: '',
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
        {/* Step Navigation (only for steps 1-4) */}
        {currentStep < totalSteps && (
          <View style={styles.stepNavigation}>
            {currentStep > 1 && (
              <TouchableOpacity
                style={styles.stepNavButtonSecondary}
                onPress={goToPreviousStep}
              >
                <Text style={styles.stepNavButtonTextSecondary}>Previous</Text>
              </TouchableOpacity>
            )}
            
            <Text style={styles.stepIndicator}>{currentStep}/{totalSteps}</Text>
            
            <TouchableOpacity
              style={styles.stepNavButton}
              onPress={goToNextStep}
            >
              <Text style={styles.stepNavButtonText}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Last step (5): show Save Consultation + Complete Consultation */}
        {currentStep === totalSteps && (
          <>
            <TouchableOpacity
              style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
              onPress={handleSaveChanges}
              disabled={!hasChanges}
            >
              <Text style={[styles.saveButtonText, !hasChanges && styles.saveButtonTextDisabled]}>Save Consultation</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.completeButton, !isCompleteEnabled && styles.completeButtonDisabled]}
              onPress={handleOpenFeeModal}
              disabled={!isCompleteEnabled}
            >
              <CheckCircle size={18} color="#FFFFFF" />
              <Text style={styles.completeButtonText}>Complete Consultation</Text>
            </TouchableOpacity>
          </>
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
                      <Text style={styles.medicalHistoryFieldLabel}>Diagnoses:</Text>
                      {medicalHistory.diagnosis && medicalHistory.diagnosis.length > 0 ? (
                        medicalHistory.diagnosis.map((diagnosis: any, index: number) => (
                          <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingVertical: 4 }}>
                            <Text style={{ fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#1E40AF', marginRight: 8, minWidth: 80 }}>{diagnosis.code}</Text>
                            <Text style={{ fontSize: 14, fontFamily: 'Inter-Regular', color: '#374151', flex: 1 }}>{diagnosis.description}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.medicalHistoryFieldValue}>Not specified</Text>
                      )}
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
                            {prescription.dosage} • {formatFrequency(prescription.frequency, 'patient')} • {formatRoute(prescription.route, 'patient')}
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

      {/* Professional Fee Modal (Bottom Sheet style) */}
      <Modal
        visible={showFeeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseFeeModal}
      >
        <Pressable style={feeModalStyles.backdrop} onPress={handleCloseFeeModal}>
          <View style={feeModalStyles.backdropOverlay} />
        </Pressable>
        <View style={feeModalStyles.modalContainer}>
          <SafeAreaView style={feeModalStyles.safeArea}>
            <View style={feeModalStyles.modalContent}>
              <View style={feeStyles.headerRow}>
                <View style={feeStyles.headerLeft}>
                  <Text style={feeStyles.title}>Confirm Professional Fee</Text>
                  <Text style={feeStyles.subtitle}>
                    To complete this consultation, please confirm that you have received your professional fee. This confirmation will be recorded in the visit report.
                  </Text>
                </View>
              </View>
              <View style={feeStyles.divider} />

              <View style={feeStyles.feeRow}>
                <View style={feeStyles.feeIcon}><Wallet size={22} color="#1E40AF" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={feeStyles.feeLabel}>Amount due</Text>
                  <Text style={feeStyles.feeAmount}>{loadingFee ? 'Loading…' : formatCurrency(professionalFee)}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[feeStyles.checkboxRow, feeChecked && feeStyles.checkboxRowActive]}
                onPress={() => setFeeChecked(v => !v)}
                activeOpacity={0.8}
              >
                <View style={[feeStyles.checkbox, feeChecked && feeStyles.checkboxChecked]}>
                  {feeChecked && <CheckCircle size={16} color="#FFFFFF" />}
                </View>
                <Text style={feeStyles.checkboxText}>
                  I confirm I have received {formatCurrency(professionalFee)} as my professional fee.
                </Text>
              </TouchableOpacity>

              <View style={feeModalStyles.actions}>
                <TouchableOpacity style={[feeModalStyles.primaryButton, !feeChecked && { opacity: 0.5 }]} disabled={!feeChecked} onPress={() => {
                  setShowFeeModal(false);
                  confirmCompleteConsultation();
                }}>
                  <Text style={feeModalStyles.primaryButtonText}>Confirm & Complete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Frequency Selection Modal */}
      <FrequencySelectionModal
        visible={showFrequencyModal}
        onClose={() => setShowFrequencyModal(false)}
        onSelect={(frequency) => setNewPrescription((prev) => ({ ...prev, frequency }))}
        userRole="specialist"
      />

      {/* Route Selection Modal */}
      <RouteSelectionModal
        visible={showRouteModal}
        onClose={() => setShowRouteModal(false)}
        onSelect={(route) => setNewPrescription((prev) => ({ ...prev, route }))}
        userRole="specialist"
      />

      {/* Duration Unit Selection Modal */}
      <DurationUnitSelectionModal
        visible={showDurationUnitModal}
        onClose={() => setShowDurationUnitModal(false)}
        onSelect={(durationUnit) => setNewPrescription((prev) => ({ ...prev, durationUnit }))}
        userRole="specialist"
      />
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
  requiredAsterisk: {
    color: '#1E40AF',
  },
  requiredSuffix: {
    color: '#1E40AF',
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
  inputContainerWithAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingRight: 6,
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
  diagnosisTextInput: {
    minHeight: 48,
    textAlignVertical: 'center',
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
  completeButtonDisabled: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  addFormInputRoute: {
    flex: 10, // 50% of the row (10/20)
  },
  addFormInputDuration: {
    flex: 3, // 15% of the row (3/20)
  },
  addFormInputUnit: {
    flex: 7, // 35% of the row (7/20)
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
  frequencyButton: {
    justifyContent: 'center',
  },
  frequencyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  frequencyButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  frequencyButtonPlaceholder: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
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
  // removed completed/checkmark visuals to avoid redundancy with progress bar
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
    backgroundColor: '#1E40AF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E40AF',
    minWidth: 80,
    alignItems: 'center',
  },
  stepNavButtonSecondary: {
    backgroundColor: '#FFFFFF',
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
    color: '#FFFFFF',
  },
  stepNavButtonTextSecondary: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  stepIndicator: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  
  // Diagnosis Styles
  diagnosisItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  diagnosisInputsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  diagnosisContent: {
    flex: 1,
  },
  diagnosisCode: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
    marginBottom: 2,
  },
  diagnosisDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  removeDiagnosisButton: {
    padding: 8,
    marginLeft: 8,
  },
  addDiagnosisContainer: {
    marginTop: 12,
  },
  diagnosisInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diagnosisCodeInput: {
    flex: 1,
    minWidth: 100,
  },
  diagnosisDescriptionInput: {
    flex: 2,
  },
  addDiagnosisButton: {
    backgroundColor: '#1E40AF',
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  addDiagnosisButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  
  // Medical History Diagnosis Styles
  medicalHistoryDiagnosisItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingVertical: 4,
  },
  medicalHistoryDiagnosisCode: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E40AF',
    marginRight: 8,
    minWidth: 80,
  },
  medicalHistoryDiagnosisDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    flex: 1,
  },
});

const feeStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  headerLeft: { flex: 1 },
  title: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 2 },
  subtitle: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 16 },
  feeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  feeIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#DBEAFE'
  },
  feeLabel: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#6B7280' },
  feeAmount: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#1F2937' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 12 },
  checkboxRowActive: { borderColor: '#1E40AF' },
  checkbox: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#1E40AF' },
  checkboxText: { flex: 1, fontSize: 14, fontFamily: 'Inter-Regular', color: '#374151' },
});

// Modal layout styles (mirroring signin bottom modal)
const feeModalStyles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },
  backdropOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContainer: { flex: 1, justifyContent: 'flex-end', zIndex: 2 },
  safeArea: { width: '100%' },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'stretch',
    minHeight: SCREEN_HEIGHT * 0.35,
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  primaryButton: { flex: 1, backgroundColor: '#1E40AF', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-SemiBold' },
});