import React, { useState, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { BlurView } from 'expo-blur';
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
  X,
  AlertTriangle,
  Wallet,
  ChevronDown,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

import { useVoiceToText } from '../../src/hooks/useVoiceToText';
import { useAuth } from '../../src/hooks/auth/useAuth';
import { databaseService } from '../../src/services/database/firebase';
import { ref, update } from 'firebase/database';
import { database } from '@/config/firebase';
import { safeDataAccess } from '../../src/utils/safeDataAccess';
import { FrequencySelectionModal, RouteSelectionModal, DurationUnitSelectionModal, FormulaSelectionModal } from '../../src/components';
import { DynamicUnitInput, PrescriptionUnitInputs, KeyboardAvoidingScrollView } from '../../src/components/ui';
import { formatFrequency, formatRoute, formatFormula, determineUnit } from '../../src/utils/formatting';

export default function PatientConsultationScreen() {
  const params = useLocalSearchParams();
  const { patientId, consultationId, referralId, isFollowUp, originalReferralId } = params;
  const { user } = useAuth();
  
  // Convert consultationId to string if it's an array
  const consultationIdString = Array.isArray(consultationId) ? consultationId[0] : consultationId;
  const patientIdString = Array.isArray(patientId) ? patientId[0] : patientId;
  // Convert referralId to string if it's an array
  const referralIdString = Array.isArray(referralId) ? referralId[0] : referralId;
  // Convert isFollowUp to boolean
  const isFollowUpAppointment = isFollowUp === 'true';
  // Convert originalReferralId to string if it's an array
  const originalReferralIdString = Array.isArray(originalReferralId) ? originalReferralId[0] : originalReferralId;

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
      // Don't load from Firebase if we're returning from signature page
      if (params.signatureAdded === 'true') {
        console.log(' Skipping Firebase load - returning from signature page');
        return;
      }
      
      // Also don't load if we already have data in the form
      const hasExistingData = formData.diagnoses.length > 0 || 
                             formData.presentIllnessHistory.trim() !== '' ||
                             formData.reviewOfSymptoms.trim() !== '';
      
      if (hasExistingData) {
        console.log(' Skipping Firebase load - already have consultation data');
        return;
      }
      
      loadConsultationData();
    }
  }, [consultationIdString, referralIdString, params.signatureAdded]);

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
      
      // Check if the current doctor is tagged to this consultation
      const checkDoctorTagging = () => {
        if (referral && user?.uid) {
          // For referrals, check if the current user is the assigned specialist
          const isTagged = referral.assignedSpecialistId === user.uid;
          setIsDoctorTagged(isTagged);
        } else if (consultation && user?.uid) {
          // For appointments, check if the current user is the assigned doctor
          const isTagged = consultation.doctorId === user.uid;
          setIsDoctorTagged(isTagged);
        } else {
          setIsDoctorTagged(false);
        }
      };
      
      checkDoctorTagging();
      
      // Also try to get medical history for this appointment or referral
      let medicalHistory = null;
      
      // For regular appointments
      if (patientId && consultationIdString && !referralIdString) {
        try {
          medicalHistory = await databaseService.getMedicalHistoryByAppointment(consultationIdString as string, patientId as string);
          console.log(' Loaded medical history for appointment:', medicalHistory);
        } catch (error) {
          console.log('No medical history found for this appointment:', error);
        }
      }
      
      // For referrals
      if (patientId && referralIdString && referral?.referralConsultationId) {
        try {
          medicalHistory = await databaseService.getDocument(`patientMedicalHistory/${patientId}/entries/${referral.referralConsultationId}`);
          console.log(' Loaded medical history for referral:', medicalHistory);
        } catch (error) {
          console.log('No medical history found for this referral:', error);
        }
      }

      console.log(' Loading medical history:', medicalHistory);
      console.log(' Medical history diagnosis field:', medicalHistory?.diagnoses);
      console.log(' Number of diagnoses in medical history:', medicalHistory?.diagnoses?.length || 0);
      console.log(' Medical history certificates:', medicalHistory?.certificates);
      console.log(' Number of certificates in medical history:', medicalHistory?.certificates?.length || 0);
      console.log(' Medical history keys:', medicalHistory ? Object.keys(medicalHistory) : 'No medical history');
      console.log(' Full medical history object:', JSON.stringify(medicalHistory, null, 2));
      
      // Load certificates from PMC that are associated with this appointment/referral
      let certificatesForConsultation: any[] = [];
      if (patientIdString) {
        try {
          const appointmentOrReferralId = consultationIdString || referralIdString;
          console.log(' Loading certificates for appointment/referral:', appointmentOrReferralId);
          
          // Get all certificates for this patient from PMC
          const allPatientCertificates = await databaseService.getCertificatesByPatientNew(patientIdString);
          console.log(' All patient certificates:', allPatientCertificates.length);
          
          // Filter certificates that belong to this specific appointment/referral
          certificatesForConsultation = allPatientCertificates.filter(cert => {
            // Check if certificate has appointmentId matching our consultation/referral
            const certAppointmentId = (cert as any).appointmentId;
            const matches = certAppointmentId === appointmentOrReferralId;
            console.log(' Certificate check:', {
              certId: cert.id,
              certAppointmentId,
              appointmentOrReferralId,
              matches
            });
            return matches;
          });
          
          console.log(' Certificates for this consultation:', certificatesForConsultation.length);
        } catch (error) {
          console.error('Error loading certificates for consultation:', error);
        }
      }
      
      setFormData(prevFormData => ({
        // Step 1: Patient History
        presentIllnessHistory: medicalHistory?.presentIllnessHistory || '',
        reviewOfSymptoms: medicalHistory?.reviewOfSymptoms || '',
        
        // Step 2: Findings
        labResults: medicalHistory?.labResults || '',
        medications: medicalHistory?.medications || '',
        
        // Step 3: Diagnoses
        diagnoses: medicalHistory?.diagnoses || [],
        differentialDiagnosis: medicalHistory?.differentialDiagnosis || '',
        
        // Step 4: SOAP Notes
        subjective: medicalHistory?.soapNotes?.subjective || '',
        objective: medicalHistory?.soapNotes?.objective || '',
        assessment: medicalHistory?.soapNotes?.assessment || '',
        plan: medicalHistory?.soapNotes?.plan || '',
        
        // Step 5: Treatment & Wrap-Up
        treatmentPlan: medicalHistory?.treatmentPlan || '',
        clinicalSummary: medicalHistory?.clinicalSummary || '',
        
        prescriptions: medicalHistory?.prescriptions || [],
        certificates: certificatesForConsultation.length > 0 ? certificatesForConsultation : (prevFormData.certificates || []), // Load certificates from PMC or preserve existing ones
      }));
      
      console.log(' Form data set with diagnoses:', medicalHistory?.diagnoses || []);
      console.log(' Number of diagnoses in form data after setting:', (medicalHistory?.diagnoses || []).length);
      console.log(' Form data certificates loaded:', medicalHistory?.certificates || []);
      console.log(' Number of certificates in form data after setting:', (medicalHistory?.certificates || []).length);
    } catch (error) {
      console.error('Error loading consultation data:', error);
      Alert.alert('Error', 'Failed to load consultation data. Please try again.');
    }
  };

  // UI state
  const [activeField, setActiveField] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingSpeech, setIsProcessingSpeech] = useState(false);
  
  // Animated progress
  const [animatedProgress, setAnimatedProgress] = useState(0);
  
  // Animate progress bar when progressPercent changes
  useEffect(() => {
    const duration = 800; // Animation duration in ms
    const startTime = Date.now();
    const startProgress = animatedProgress;
    const targetProgress = progressPercent;
    
    if (startProgress === targetProgress) return;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      const currentProgress = startProgress + (targetProgress - startProgress) * easeOutCubic;
      
      setAnimatedProgress(Math.round(currentProgress));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [progressPercent]);
  
  const [showAddPrescription, setShowAddPrescription] = useState(false);
  const [showAddCertificate, setShowAddCertificate] = useState(false);
  const [showFrequencyModal, setShowFrequencyModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showDiagnosisTooltip, setShowDiagnosisTooltip] = useState(false);
  const [showPrescriptionTooltip, setShowPrescriptionTooltip] = useState(false);
  const [showCertificateTooltip, setShowCertificateTooltip] = useState(false);
  const [showDurationUnitModal, setShowDurationUnitModal] = useState(false);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  
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
    formula: '',
    take: '',
    totalQuantity: '',
  });
  const [newCertificate, setNewCertificate] = useState({
    type: '',
    description: '',
    // Fit to Work specific fields
    fitnessStatement: '',
    workRestrictions: '',
    nextReviewDate: '',
    // Medical/Sickness specific fields
    unfitPeriodStart: '',
    unfitPeriodEnd: '',
    medicalAdvice: '',
    reasonForUnfitness: '',
    followUpDate: '',
    // Fit to Travel specific fields
    travelFitnessStatement: '',
    travelMode: '',
    destination: '',
    travelDate: '',
    specialConditions: '',
    validityPeriod: '',
  });

  // Medical History Modal State
  const [showMedicalHistoryModal, setShowMedicalHistoryModal] = useState(false);
  const [medicalHistory, setMedicalHistory] = useState<any>(null);
  const [loadingMedicalHistory, setLoadingMedicalHistory] = useState(false);

  // Add state for appointment and referral data
  const [appointmentData, setAppointmentData] = useState<any>(null);
  const [referralData, setReferralData] = useState<any>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isDoctorTagged, setIsDoctorTagged] = useState(false);

  // Diagnosis input state
  const [newDiagnosisCode, setNewDiagnosisCode] = useState('');
  const [newDiagnosisDescription, setNewDiagnosisDescription] = useState('');
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeChecked, setFeeChecked] = useState(false);
  const [professionalFee, setProfessionalFee] = useState<number | null>(null);
  const [loadingFee, setLoadingFee] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  
  // Unsaved forms modal state
  const [showUnsavedFormsModal, setShowUnsavedFormsModal] = useState(false);
  
  // Exit confirmation modal state
  const [showExitConfirmationModal, setShowExitConfirmationModal] = useState(false);

  // Handle signature data when returning from signature page
  useEffect(() => {
    const signatureAdded = params.signatureAdded;
    const certificateDataParam = params.certificateData;
    
    if (signatureAdded === 'true' && certificateDataParam) {
      // Restore consultation data from AsyncStorage and add certificate
      const timeoutId = setTimeout(async () => {
        try {
          const certificateData = JSON.parse(certificateDataParam as string);
          
          // Debug: Log the certificate data to understand what's being passed
          console.log('Processing signature data:', {
            hasDigitalSignature: !!certificateData.digitalSignature,
            signatureLength: certificateData.digitalSignature ? certificateData.digitalSignature.length : 0,
            signatureStart: certificateData.digitalSignature ? certificateData.digitalSignature.substring(0, 50) : 'none',
            certificateType: certificateData.type,
            fullCertificateData: certificateData
          });
          
          // Try to restore consultation data from AsyncStorage
          const consultationDataKey = `consultation_data_${consultationIdString || referralIdString || 'temp'}`;
          try {
            const storedData = await AsyncStorage.getItem(consultationDataKey);
            if (storedData) {
              const restoredFormData = JSON.parse(storedData);
              console.log(' Restored consultation data from AsyncStorage:', {
                diagnosesCount: restoredFormData.diagnoses?.length || 0,
                hasPresentIllnessHistory: !!restoredFormData.presentIllnessHistory,
                hasReviewOfSymptoms: !!restoredFormData.reviewOfSymptoms,
                certificatesCount: restoredFormData.certificates?.length || 0
              });
              
              // Restore the consultation data and add the new certificate
              setFormData({
                ...restoredFormData,
                certificates: [...(restoredFormData.certificates || []), certificateData]
              });
              
              // Save the certificate with signature to database immediately
              try {
                console.log(' Saving certificate with signature to database immediately');
                const appointmentOrReferralId = consultationIdString || referralIdString;
                const certificateId = await databaseService.createCertificateInNewStructure(
                  certificateData,
                  patientIdString || user?.uid || '',
                  user?.uid || '',
                  appointmentOrReferralId  // Pass appointmentId (from appointment) or referralId (from referral)
                );
                console.log(' Certificate saved to database with ID and appointmentId:', certificateId);
                
                // Update the certificate data with the database ID and appointmentId
                setFormData(prev => ({
                  ...prev,
                  certificates: prev.certificates.map(cert => 
                    cert.id === certificateData.id 
                      ? { ...cert, id: certificateId, appointmentId: appointmentOrReferralId }
                      : cert
                  )
                }));
              } catch (error) {
                console.error('Error saving certificate to database:', error);
                // Continue with the flow even if database save fails
              }
              
              // Clean up the stored data
              await AsyncStorage.removeItem(consultationDataKey);
              console.log(' Cleaned up AsyncStorage data');
            } else {
              console.log(' No stored consultation data found, adding certificate to current formData');
              // Fallback: add certificate to current formData
              setFormData(prev => ({
                ...prev,
                certificates: [...prev.certificates, certificateData]
              }));
              
              // Save the certificate with signature to database immediately
              try {
                console.log(' Saving certificate with signature to database immediately (fallback)');
                const appointmentOrReferralId = consultationIdString || referralIdString;
                const certificateId = await databaseService.createCertificateInNewStructure(
                  certificateData,
                  patientIdString || user?.uid || '',
                  user?.uid || '',
                  appointmentOrReferralId  // Pass appointmentId (from appointment) or referralId (from referral)
                );
                console.log(' Certificate saved to database with ID and appointmentId:', certificateId);
                
                // Update the certificate data with the database ID and appointmentId
                setFormData(prev => ({
                  ...prev,
                  certificates: prev.certificates.map(cert => 
                    cert.id === certificateData.id 
                      ? { ...cert, id: certificateId, appointmentId: appointmentOrReferralId }
                      : cert
                  )
                }));
              } catch (error) {
                console.error('Error saving certificate to database (fallback):', error);
                // Continue with the flow even if database save fails
              }
            }
          } catch (storageError) {
            console.error('Error restoring consultation data from AsyncStorage:', storageError);
            // Fallback: add certificate to current formData
            setFormData(prev => ({
              ...prev,
              certificates: [...prev.certificates, certificateData]
            }));
          }
          
          // Clear the certificate form
          setNewCertificate({
            type: '', description: '', fitnessStatement: '', workRestrictions: '', nextReviewDate: '',
            unfitPeriodStart: '', unfitPeriodEnd: '', medicalAdvice: '', reasonForUnfitness: '',
            followUpDate: '', travelFitnessStatement: '', travelMode: '', destination: '',
            travelDate: '', specialConditions: '', validityPeriod: '',
          });
          
          // Hide the form
          setShowAddCertificate(false);
          setHasChanges(true);
          
          // Debug: Log what's happening after signature is added
          console.log('After signature processing:', {
            certificatesCount: formData.certificates.length + 1, // +1 because we're adding one
            hasChanges: true,
            progressPercent: progressPercent,
            isCompleteEnabled: isCompleteEnabled
          });
          
          // Show success message
          Alert.alert(
            'Certificate Signed', 
            'Your certificate has been signed and added to the consultation. You can continue adding more certificates or complete the consultation when ready.',
            [{ text: 'OK', style: 'default' }]
          );
          
          // Clear the params to prevent re-processing
          router.setParams({ signatureAdded: undefined, certificateData: undefined });
        } catch (error) {
          console.error('Error parsing certificate data:', error);
        }
      }, 100); // Small delay to ensure consultation data is loaded first
      
      return () => clearTimeout(timeoutId);
    }
  }, [params.signatureAdded, params.certificateData]);

  // Handle prescription signature data when returning from signature page
  useEffect(() => {
    const signatureAdded = params.signatureAdded;
    const prescriptionDataParam = params.prescriptionData;
    
    if (signatureAdded === 'true' && prescriptionDataParam) {
      // Restore consultation data from AsyncStorage and add prescription
      const timeoutId = setTimeout(async () => {
        try {
          const prescriptionData = JSON.parse(prescriptionDataParam as string);
          
          // Debug: Log the prescription data to understand what's being passed
          console.log('Processing prescription signature data:', {
            hasDigitalSignature: !!prescriptionData.digitalSignature,
            signatureLength: prescriptionData.digitalSignature ? prescriptionData.digitalSignature.length : 0,
            signatureStart: prescriptionData.digitalSignature ? prescriptionData.digitalSignature.substring(0, 50) : 'none',
            medication: prescriptionData.medication,
            fullPrescriptionData: prescriptionData
          });
          
          // Try to restore consultation data from AsyncStorage
          const consultationDataKey = `consultation_data_${consultationIdString || referralIdString || 'temp'}`;
          try {
            const storedData = await AsyncStorage.getItem(consultationDataKey);
            if (storedData) {
              const restoredFormData = JSON.parse(storedData);
              console.log(' Restored consultation data from AsyncStorage for prescription:', {
                diagnosesCount: restoredFormData.diagnoses?.length || 0,
                hasPresentIllnessHistory: !!restoredFormData.presentIllnessHistory,
                hasReviewOfSymptoms: !!restoredFormData.reviewOfSymptoms,
                prescriptionsCount: restoredFormData.prescriptions?.length || 0
              });
              
              // Restore the consultation data and add the new prescription
              setFormData({
                ...restoredFormData,
                prescriptions: [...(restoredFormData.prescriptions || []), prescriptionData]
              });
              
              // Clean up the stored data
              await AsyncStorage.removeItem(consultationDataKey);
              console.log(' Cleaned up AsyncStorage data for prescription');
            } else {
              console.log(' No stored consultation data found, adding prescription to current formData');
              // Fallback: add prescription to current formData
              setFormData(prev => ({
                ...prev,
                prescriptions: [...prev.prescriptions, prescriptionData]
              }));
            }
          } catch (storageError) {
            console.error('Error restoring consultation data from AsyncStorage for prescription:', storageError);
            // Fallback: add prescription to current formData
            setFormData(prev => ({
              ...prev,
              prescriptions: [...prev.prescriptions, prescriptionData]
            }));
          }
          
          // Clear the prescription form
          setNewPrescription({
            medication: '',
            dosage: '',
            frequency: '',
            route: '',
            durationNumber: '',
            durationUnit: '',
            description: '',
            formula: '',
            take: '',
            totalQuantity: '',
          });
          
          // Hide the form
          setShowAddPrescription(false);
          setHasChanges(true);
          
          // Debug: Log what's happening after signature is added
          console.log('After prescription signature processing:', {
            prescriptionsCount: formData.prescriptions.length + 1, // +1 because we're adding one
            hasChanges: true,
            progressPercent: progressPercent,
            isCompleteEnabled: isCompleteEnabled
          });
          
          // Show success message
          Alert.alert(
            'Prescription Signed', 
            'Your prescription has been signed and added to the consultation. You can continue adding more prescriptions or complete the consultation when ready.',
            [{ text: 'OK', style: 'default' }]
          );
          
          // Clear the params to prevent re-processing
          router.setParams({ signatureAdded: undefined, prescriptionData: undefined });
        } catch (error) {
          console.error('Error parsing prescription data:', error);
        }
      }, 100); // Small delay to ensure consultation data is loaded first
      
      return () => clearTimeout(timeoutId);
    }
  }, [params.signatureAdded, params.prescriptionData]);

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
    console.log(' FormData diagnoses changed:', formData.diagnoses);
    console.log(' Number of diagnoses in formData:', formData.diagnoses.length);
    console.log(' FormData presentIllnessHistory:', formData.presentIllnessHistory);
    console.log(' FormData reviewOfSymptoms:', formData.reviewOfSymptoms);
    console.log(' FormData certificates:', formData.certificates.length);
    console.log(' Full formData:', JSON.stringify(formData, null, 2));
  }, [formData]);

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
      
      // Store the current activeField to prevent race conditions
      const currentField = activeField;
      
      const isDiagnosisDesc = currentField.startsWith('diagnoses.description.');
      const isNewDiagnosisDesc = currentField === 'newDiagnosis.description';

      if (isDiagnosisDesc) {
        const indexStr = currentField.split('.').pop() as string;
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
          (updated as any)[currentField] = transcript; // fallback for simple fields
          return updated;
        });
        setHasChanges(true);
      }

      // Clear activeField and reset loading state immediately
      setActiveField(null);
      setIsLoading(false);
      setIsProcessingSpeech(false);
      stopPulseAnimation();
      stopLoadingAnimation();
    }
  }, [transcript, activeField]);

  // Fallback effect to reset loading state if no transcript is received
  useEffect(() => {
    if (activeField && !isRecording && isLoading) {
      const timeout = setTimeout(() => {
        console.log('Fallback: Resetting loading state due to no transcript');
        setIsLoading(false);
        setIsProcessingSpeech(false);
        stopLoadingAnimation();
        setActiveField(null);
      }, 5000); // 5 second fallback

      return () => clearTimeout(timeout);
    }
  }, [activeField, isRecording, isLoading]);

  // Auto-show diagnosis tooltip for 5 seconds when on diagnosis step
  useEffect(() => {
    if (currentStep === 2) { // Diagnosis step
      setShowDiagnosisTooltip(true);
      const timer = setTimeout(() => {
        setShowDiagnosisTooltip(false);
      }, 5000); // 5 seconds

      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  // Auto-show prescription tooltip when prescription form is opened
  useEffect(() => {
    if (showAddPrescription) {
      setShowPrescriptionTooltip(true);
      const timer = setTimeout(() => {
        setShowPrescriptionTooltip(false);
      }, 5000); // 5 seconds

      return () => clearTimeout(timer);
    }
  }, [showAddPrescription]);

  // Auto-show certificate tooltip when certificate form is opened
  useEffect(() => {
    if (showAddCertificate) {
      setShowCertificateTooltip(true);
      const timer = setTimeout(() => {
        setShowCertificateTooltip(false);
      }, 5000); // 5 seconds

      return () => clearTimeout(timer);
    }
  }, [showAddCertificate]);

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

    // If already recording for a different field, stop that first
    if (isRecording && activeField !== fieldName) {
      console.log('Stopping previous recording for field:', activeField);
      await stopRecording();
      // Wait a bit for the previous recording to fully stop
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // If already recording for the same field, stop it
    if (isRecording && activeField === fieldName) {
      await stopRecording();
      return;
    }

    try {
      // Reset any previous processing state
      setIsProcessingSpeech(false);
      setIsLoading(false);
      stopLoadingAnimation();
      
      // Clear any previous transcript
      resetTranscript();
      
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
      // Only process if we have an active field
      if (!activeField) {
        console.log('No active field to stop recording for');
        return;
      }

      // Start processing speech overlay
      setIsProcessingSpeech(true);
      setIsLoading(true);
      startLoadingAnimation();
      await stopRecording();
      
      // Reset loading state after a short delay to allow transcript processing
      setTimeout(() => {
        setIsLoading(false);
        stopLoadingAnimation();
        setActiveField(null);
        setIsProcessingSpeech(false);
      }, 2000); // Give 2 seconds for transcript processing
    } catch (error) {
      console.error('Stop recording error:', error);
      stopPulseAnimation();
      stopLoadingAnimation();
      setIsLoading(false);
      setActiveField(null);
      setIsProcessingSpeech(false);
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
    // First check for unsaved forms (validation step)
    const { hasUnsavedPrescription, hasUnsavedCertificate } = hasUnsavedForms();
    
    if (hasUnsavedPrescription || hasUnsavedCertificate) {
      // Show the unsaved forms modal first
      setShowUnsavedFormsModal(true);
      return;
    }

    // Check for certificates without signatures
    const certificatesWithoutSignatures = formData.certificates.filter((cert: any) => {
      // Debug: Log signature data to understand the issue
      console.log('Checking certificate signature:', {
        type: cert.type,
        hasDigitalSignature: !!cert.digitalSignature,
        signatureLength: cert.digitalSignature ? cert.digitalSignature.length : 0,
        signatureStart: cert.digitalSignature ? cert.digitalSignature.substring(0, 50) : 'none'
      });
      
      // Check if digitalSignature exists and is not empty
      if (!cert.digitalSignature) return true;
      
      // Handle base64 signature strings - they should start with 'data:image' or be a valid base64 string
      const signature = cert.digitalSignature.trim();
      if (signature === '') return true;
      
      // Check if it's a valid base64 image string (starts with 'data:image')
      if (signature.startsWith('data:image')) return false;
      
      // Check if it's a valid base64 string (at least 100 characters for a meaningful signature)
      if (signature.length < 100) return true;
      
      return false;
    });

    if (certificatesWithoutSignatures.length > 0) {
      Alert.alert(
        'Missing Signatures',
        `You have ${certificatesWithoutSignatures.length} certificate(s) without digital signatures. Please sign all certificates before completing the consultation.`,
        [
          { text: 'OK', style: 'default' }
        ]
      );
      return;
    }

    // No unsaved forms and all certificates are signed, proceed to fee modal
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
  const handleAddPrescription = async () => {
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
    
    // Create prescription data for signature flow
    const prescriptionData = {
      id: Date.now(),
      medication: newPrescription.medication,
      dosage: newPrescription.dosage,
      frequency: newPrescription.frequency,
      route: newPrescription.route,
      duration,
      description: newPrescription.description,
      formula: newPrescription.formula,
      take: newPrescription.take,
      totalQuantity: newPrescription.totalQuantity,
      issuedDate: new Date().toLocaleDateString(),
      issuedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Active',
    };

    try {
      // Check if doctor has a saved signature
      if (user?.uid) {
        const { signature: savedSignature, isSignatureSaved } = await databaseService.getDoctorSignature(user.uid);
        
        if (isSignatureSaved && savedSignature) {
          // Auto-use saved signature, skip signature page
          console.log(' Using saved signature for prescription, skipping signature page');
          
          const signedPrescription = {
            ...prescriptionData,
            digitalSignature: savedSignature,
            signatureKey: `signature_${Date.now()}`,
            signedAt: new Date().toISOString(),
          };
          
          // Add signed prescription to form data
          setFormData((prev) => ({
            ...prev,
            prescriptions: [...prev.prescriptions, signedPrescription],
          }));
          
          // Clear prescription form
          setNewPrescription({
            medication: '',
            dosage: '',
            frequency: '',
            route: '',
            durationNumber: '',
            durationUnit: '',
            description: '',
            formula: '',
            take: '',
            totalQuantity: '',
          });
          
          setShowAddPrescription(false);
          setHasChanges(true);
          
          console.log(' Prescription added with saved signature');
          return;
        }
      }
      
      // No saved signature, navigate to signature page
      // Store consultation data in AsyncStorage before navigating to signature page
      const storeData = async () => {
        try {
          const consultationDataKey = `consultation_data_${consultationIdString || referralIdString || 'temp'}`;
          await AsyncStorage.setItem(consultationDataKey, JSON.stringify(formData));
          console.log(' Stored consultation data in AsyncStorage:', consultationDataKey);
        } catch (error) {
          console.error('Error storing consultation data:', error);
        }
      };
      
      storeData();

      router.push({
        pathname: '/(patient)/signature-page',
        params: {
          prescriptionData: JSON.stringify(prescriptionData),
          ...(consultationIdString && { consultationId: consultationIdString }),
          ...(referralIdString && { referralId: referralIdString }),
          ...(patientId && { patientId: Array.isArray(patientId) ? patientId[0] : patientId }),
        },
      });
      
    } catch (error) {
      console.error(' Error checking saved signature for prescription:', error);
      // Fallback: navigate to signature page
      router.push({
        pathname: '/(patient)/signature-page',
        params: {
          prescriptionData: JSON.stringify(prescriptionData),
          ...(consultationIdString && { consultationId: consultationIdString }),
          ...(referralIdString && { referralId: referralIdString }),
          ...(patientId && { patientId: Array.isArray(patientId) ? patientId[0] : patientId }),
        },
      });
    }
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
  const handleAddCertificate = async () => {
    if (!newCertificate.type?.trim() || !newCertificate.description?.trim()) {
      Alert.alert('Error', 'Please fill in certificate type and description fields.');
      return;
    }
    
    // Create certificate data for signature flow
    const certificateData = {
      id: Date.now(),
      ...newCertificate,
      issuedDate: new Date().toLocaleDateString(),
      issuedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Valid',
    };

    try {
      // Check if doctor has a saved signature
      if (user?.uid) {
        const { signature: savedSignature, isSignatureSaved } = await databaseService.getDoctorSignature(user.uid);
        
        if (isSignatureSaved && savedSignature) {
          // Auto-use saved signature, skip signature page
          console.log(' Using saved signature for certificate, skipping signature page');
          
          const signedCertificate = {
            ...certificateData,
            digitalSignature: savedSignature,
            signatureKey: `signature_${Date.now()}`,
            signedAt: new Date().toISOString(),
          };
          
          // Add signed certificate to form data
          setFormData((prev) => ({
            ...prev,
            certificates: [...prev.certificates, signedCertificate],
          }));
          
          // Clear certificate form
          setNewCertificate({
            type: '',
            description: '',
            fitnessStatement: '',
            workRestrictions: '',
            nextReviewDate: '',
            unfitPeriodStart: '',
            unfitPeriodEnd: '',
            medicalAdvice: '',
            reasonForUnfitness: '',
            followUpDate: '',
            travelFitnessStatement: '',
            travelMode: '',
            destination: '',
            travelDate: '',
            specialConditions: '',
            validityPeriod: '',
          });
          
          setShowAddCertificate(false);
          setHasChanges(true);
          
          console.log(' Certificate added with saved signature');
          return;
        }
      }
      
      // No saved signature, navigate to signature page
      // Store consultation data in AsyncStorage before navigating to signature page
      const storeData = async () => {
        try {
          const consultationDataKey = `consultation_data_${consultationIdString || referralIdString || 'temp'}`;
          await AsyncStorage.setItem(consultationDataKey, JSON.stringify(formData));
          console.log(' Stored consultation data in AsyncStorage:', consultationDataKey);
        } catch (error) {
          console.error('Error storing consultation data:', error);
        }
      };
      
      storeData();

      router.push({
        pathname: '/(patient)/signature-page',
        params: {
          certificateData: JSON.stringify(certificateData),
          ...(consultationIdString && { consultationId: consultationIdString }),
          ...(referralIdString && { referralId: referralIdString }),
          ...(patientId && { patientId: Array.isArray(patientId) ? patientId[0] : patientId }),
        },
      });
      
    } catch (error) {
      console.error(' Error checking saved signature for certificate:', error);
      // Fallback: navigate to signature page
      router.push({
        pathname: '/(patient)/signature-page',
        params: {
          certificateData: JSON.stringify(certificateData),
          ...(consultationIdString && { consultationId: consultationIdString }),
          ...(referralIdString && { referralId: referralIdString }),
          ...(patientId && { patientId: Array.isArray(patientId) ? patientId[0] : patientId }),
        },
      });
    }
  };

  const handleRemoveCertificate = (id: number | string) => {
    Alert.alert(
      'Remove Certificate',
      'Are you sure you want to remove this certificate?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            // Remove from local state
            setFormData((prev) => ({
              ...prev,
              certificates: prev.certificates.filter((c) => c.id !== id),
            }));
            
            // Also delete from database if it exists there
            try {
              // Check if this is a database ID (starts with MC-) or a temporary ID (number)
              if (typeof id === 'string' && id.startsWith('MC-')) {
                await databaseService.deleteCertificate(id);
                console.log(' Certificate deleted from database:', id);
              } else {
                console.log('ℹ️ Certificate was not yet saved to database, only removed from local state. ID:', id, 'Type:', typeof id);
              }
            } catch (error) {
              console.error('Error deleting certificate from database:', error);
              // Continue anyway - local removal is more important
            }
            
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

    const patientIdString = Array.isArray(patientId) ? patientId[0] : patientId;
    console.log('Using patientIdString for save:', patientIdString);

    try {
      // Prepare consultation data WITHOUT certificates (they're saved separately to pmc)
      const { certificates, ...consultationDataWithoutCertificates } = formData;
      
      // Debug: Check if certificates are properly excluded
      console.log(' Destructuring check (handleSaveChanges):', {
        originalFormDataHasCertificates: !!formData.certificates,
        originalCertificatesCount: formData.certificates?.length || 0,
        consultationDataWithoutCertificatesHasCertificates: !!(consultationDataWithoutCertificates as any).certificates,
        consultationDataWithoutCertificatesCertificatesCount: (consultationDataWithoutCertificates as any).certificates?.length || 0,
        consultationDataWithoutCertificatesKeys: Object.keys(consultationDataWithoutCertificates),
        // Debug diagnoses specifically
        originalFormDataHasDiagnoses: !!formData.diagnoses,
        originalDiagnosesCount: formData.diagnoses?.length || 0,
        originalDiagnoses: formData.diagnoses,
        consultationDataWithoutCertificatesHasDiagnoses: !!(consultationDataWithoutCertificates as any).diagnoses,
        consultationDataWithoutCertificatesDiagnosesCount: (consultationDataWithoutCertificates as any).diagnoses?.length || 0,
        consultationDataWithoutCertificatesDiagnoses: (consultationDataWithoutCertificates as any).diagnoses
      });
      
      const consultationData = {
        ...consultationDataWithoutCertificates,
        soapNotes: {
          subjective: formData.subjective,
          objective: formData.objective,
          assessment: formData.assessment,
          plan: formData.plan,
        },
        provider: {
          id: user?.uid || '',
          firstName: user?.firstName || '',
          lastName: user?.lastName || '',
          providerType: 'specialist',
          sourceSystem: 'UniHealth_Patient_App',
        },
        type: 'General Consultation',
      };
      
      // Debug: Verify certificates are excluded from consultation data
      console.log(' Consultation data verification (handleSaveChanges):', {
        hasCertificates: !!(consultationData as any).certificates,
        certificatesCount: (consultationData as any).certificates ? (consultationData as any).certificates.length : 0,
        consultationDataKeys: Object.keys(consultationData),
        hasDiagnoses: !!consultationData.diagnoses,
        diagnosesCount: consultationData.diagnoses ? consultationData.diagnoses.length : 0,
        diagnoses: consultationData.diagnoses
      });

      // Save certificates to new structure if they exist (same as complete consultation)
      if (formData.certificates && formData.certificates.length > 0) {
        console.log(' About to save certificates to new structure (handleSaveChanges):', formData.certificates.length);
        console.log(' Certificate data (handleSaveChanges):', formData.certificates.map(cert => ({
          id: cert.id,
          type: cert.type,
          hasDigitalSignature: !!cert.digitalSignature,
          signatureLength: cert.digitalSignature ? cert.digitalSignature.length : 0
        })));
        try {
          // Pre-validate all data before creating certificates
          const validation = await databaseService.validateCertificateCreationData(patientIdString, user.uid);
          
          if (!validation.isValid) {
            const errorMessage = `Cannot save certificates due to data issues:\n\n${validation.errors.join('\n')}\n\nPlease resolve these issues before saving.`;
            Alert.alert('Data Validation Error', errorMessage);
            return;
          }
          
          // All data is valid, proceed with certificate creation
          const appointmentOrReferralId = consultationIdString || referralIdString;
          
          // Only save certificates that haven't been saved to database yet
          const certificatesToSave = formData.certificates.filter(cert => {
            // Check if certificate already has a database ID (starts with MC-)
            const hasDatabaseId = typeof cert.id === 'string' && cert.id.startsWith('MC-');
            if (hasDatabaseId) {
              console.log('ℹ️ Certificate already saved to database, skipping:', cert.id);
            }
            return !hasDatabaseId;
          });
          
          if (certificatesToSave.length > 0) {
            await Promise.all(
              certificatesToSave.map(cert => 
                databaseService.createCertificateInNewStructure(
                  cert,
                  patientIdString,
                  user.uid,
                  appointmentOrReferralId  // Pass appointmentId (from appointment) or referralId (from referral)
                )
              )
            );
            console.log(' New certificates saved to new structure successfully in handleSaveChanges with appointmentId:', appointmentOrReferralId);
          } else {
            console.log('ℹ️ All certificates already saved to database, skipping certificate creation in handleSaveChanges');
          }
        } catch (error) {
          console.error(' Error saving certificates to new structure in handleSaveChanges:', error);
          Alert.alert('Error', `Failed to save certificates: ${error.message || 'Unknown error'}. Consultation cannot be saved.`);
          return;
        }
      }

      // Handle consultation - prioritize referral if both exist (same logic as complete consultation)
      if (referralIdString) {
        console.log('Saving consultation for referral:', referralIdString);
        
        // Check if referral already has a consultation ID
        try {
          const referralData = await databaseService.getReferralById(referralIdString as string);
          const existingReferralConsultationId = referralData?.referralConsultationId;
          
          if (existingReferralConsultationId) {
            // Update existing consultation
            const medicalHistoryPath = `patientMedicalHistory/${patientIdString}/entries/${existingReferralConsultationId}`;
            const medicalHistoryData = {
              ...consultationData,
              type: 'Referral Consultation',
              consultationDate: new Date().toISOString(),
              consultationTime: new Date().toLocaleTimeString(),
              patientId: patientIdString,
              provider: {
                id: user?.uid || '',
                firstName: user?.firstName || '',
                lastName: user?.lastName || '',
                providerType: 'specialist',
                sourceSystem: 'UniHealth_Patient_App',
              },
              relatedReferral: {
                id: referralIdString,
                type: 'Referral Consultation'
              },
              lastUpdated: new Date().toISOString(),
            };
            await databaseService.setDocument(medicalHistoryPath, medicalHistoryData);
            console.log('Updated existing referral consultation with ID:', existingReferralConsultationId);
          } else {
            // Create new consultation for referral
            const referralConsultationId = await databaseService.saveReferralConsultationData(
              patientIdString,
              referralIdString as string,
              {
                ...consultationData,
                type: 'Referral Consultation',
              }
            );
            console.log('Created new referral consultation with ID:', referralConsultationId);
            
            // Update referral with the consultation ID
            try {
              const referralExists = await databaseService.getReferralById(referralIdString as string);
              if (referralExists) {
                await databaseService.updateReferral(referralIdString as string, {
                  referralConsultationId,
                });
                console.log('Referral updated with referralConsultationId:', referralConsultationId);
              }
            } catch (error) {
              console.error('Error updating referral with consultation ID:', error);
            }
          }
        } catch (error) {
          console.error('Error checking referral for existing consultation ID:', error);
          // Fallback: create new consultation
          const referralConsultationId = await databaseService.saveReferralConsultationData(
            patientIdString,
            referralIdString as string,
            {
              ...consultationData,
              type: 'Referral Consultation',
            }
          );
          console.log('Created new referral consultation with ID (fallback):', referralConsultationId);
        }
      } else if (consultationIdString) {
        console.log('Saving consultation for appointment:', consultationIdString);
        
        // Update existing consultation
        const medicalHistoryPath = `patientMedicalHistory/${patientIdString}/entries/${consultationIdString}`;
        const medicalHistoryData = {
          ...consultationData,
          consultationDate: new Date().toISOString(),
          consultationTime: new Date().toLocaleTimeString(),
          patientId: patientIdString,
          provider: {
            id: user?.uid || '',
            firstName: user?.firstName || '',
            lastName: user?.lastName || '',
            providerType: 'specialist',
            sourceSystem: 'UniHealth_Patient_App',
          },
          relatedAppointment: {
            id: consultationIdString,
            type: 'General Consultation'
          },
          lastUpdated: new Date().toISOString(),
        };
        await databaseService.setDocument(medicalHistoryPath, medicalHistoryData);
        console.log('Updated existing appointment consultation with ID:', consultationIdString);
        
        // Ensure appointment is linked to this consultation ID
        try {
          await databaseService.updateAppointment(consultationIdString as string, {
            appointmentConsultationId: consultationIdString,
          });
          console.log('Appointment linked with appointmentConsultationId:', consultationIdString);
        } catch (error) {
          console.error('Error linking appointment with consultation ID:', error);
        }
      } else {
        // No existing consultation ID - this shouldn't happen in normal flow
        console.warn('No consultation ID or referral ID found for save operation');
        Alert.alert('Error', 'No consultation context found. Please try again.');
        return;
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

  // Check for unsaved forms (filled but not added)
  const hasUnsavedForms = () => {
    const hasUnsavedPrescription = newPrescription.medication?.trim() || 
                                  newPrescription.dosage?.trim() || 
                                  newPrescription.frequency?.trim() || 
                                  newPrescription.route?.trim() || 
                                  newPrescription.durationNumber?.trim() || 
                                  newPrescription.durationUnit?.trim() || 
                                  newPrescription.description?.trim() || 
                                  newPrescription.formula?.trim() || 
                                  newPrescription.take?.trim() || 
                                  newPrescription.totalQuantity?.trim();

    const hasUnsavedCertificate = newCertificate.type?.trim() || 
                                 newCertificate.description?.trim() || 
                                 newCertificate.fitnessStatement?.trim() || 
                                 newCertificate.workRestrictions?.trim() || 
                                 newCertificate.nextReviewDate?.trim() || 
                                 newCertificate.unfitPeriodStart?.trim() || 
                                 newCertificate.unfitPeriodEnd?.trim() || 
                                 newCertificate.medicalAdvice?.trim() || 
                                 newCertificate.reasonForUnfitness?.trim() || 
                                 newCertificate.followUpDate?.trim() || 
                                 newCertificate.travelFitnessStatement?.trim() || 
                                 newCertificate.travelMode?.trim() || 
                                 newCertificate.destination?.trim() || 
                                 newCertificate.travelDate?.trim() || 
                                 newCertificate.specialConditions?.trim() || 
                                 newCertificate.validityPeriod?.trim();

    return { hasUnsavedPrescription, hasUnsavedCertificate };
  };

  // Get unsaved forms status for UI indicators
  const unsavedFormsStatus = hasUnsavedForms();

  const confirmCompleteConsultation = async () => {
    if (!patientId) {
      Alert.alert('Error', 'No patient ID found.');
      return;
    }

    const patientIdString = Array.isArray(patientId) ? patientId[0] : patientId;
    console.log('Using patientIdString:', patientIdString);

    // Proceed directly to completion (unsaved forms already checked in handleOpenFeeModal)
    proceedWithCompletion();
  };

  // Modal handlers
  const handleCloseUnsavedFormsModal = () => {
    setShowUnsavedFormsModal(false);
  };

  // Exit confirmation handlers
  const handleBackPress = () => {
    console.log('Back button pressed');
    // Check if there's any unsaved data
    const { hasUnsavedPrescription, hasUnsavedCertificate } = hasUnsavedForms();
    const hasUnsavedFormData = hasChanges; // Use existing hasChanges logic

    console.log('Unsaved data check:', { hasUnsavedPrescription, hasUnsavedCertificate, hasUnsavedFormData });

    if (hasUnsavedPrescription || hasUnsavedCertificate || hasUnsavedFormData) {
      console.log('Showing exit confirmation modal');
      setShowExitConfirmationModal(true);
    } else {
      console.log('No unsaved data, navigating back');
      // Navigate back based on how we got here
      if (referralIdString) {
        console.log('Navigating to referral details:', referralIdString);
        router.replace(`/(specialist)/referral-details?id=${referralIdString}`);
      } else if (consultationIdString) {
        console.log('Navigating to visit overview:', consultationIdString);
        router.replace(`/visit-overview?id=${consultationIdString}`);
      } else {
        console.log('Using router.back()');
        router.back();
      }
    }
  };

  const handleConfirmExit = () => {
    console.log('Exit anyway button pressed');
    
    // Close modal first
    setShowExitConfirmationModal(false);
    
    // Use a longer timeout to ensure modal is fully closed
    setTimeout(() => {
      console.log('Navigating after modal close');
      try {
        if (referralIdString) {
          console.log('Navigating to referral details:', referralIdString);
          router.replace(`/(specialist)/referral-details?id=${referralIdString}`);
        } else if (consultationIdString) {
          console.log('Navigating to visit overview:', consultationIdString);
          router.replace(`/visit-overview?id=${consultationIdString}`);
        } else {
          console.log('Using router.back()');
          router.back();
        }
      } catch (error) {
        console.error('Navigation error:', error);
        // Try alternative navigation methods
        try {
          router.dismiss();
        } catch (dismissError) {
          console.error('Dismiss error:', dismissError);
        }
      }
    }, 300); // Increased timeout
  };

  const handleCancelExit = () => {
    setShowExitConfirmationModal(false);
  };


  const handleSaveAndComplete = async () => {
    setShowUnsavedFormsModal(false);
    
    // Auto-save prescriptions if they exist, discard certificates
    await autoSaveFormsAndComplete();
    
    // Then proceed to fee modal
    setFeeChecked(false);
    await loadProfessionalFee();
    setShowFeeModal(true);
  };

  const autoSaveFormsAndComplete = async () => {
    try {
      // Auto-add prescription if filled
      if (newPrescription.medication?.trim() || 
          newPrescription.dosage?.trim() || 
          newPrescription.frequency?.trim() || 
          newPrescription.route?.trim() || 
          newPrescription.durationNumber?.trim() || 
          newPrescription.durationUnit?.trim() || 
          newPrescription.description?.trim() || 
          newPrescription.formula?.trim() || 
          newPrescription.take?.trim() || 
          newPrescription.totalQuantity?.trim()) {
        
        const prescription = {
          id: Date.now(),
          ...newPrescription,
          issuedDate: new Date().toLocaleDateString(),
          issuedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'Active',
        };
        
        setFormData(prev => ({
          ...prev,
          prescriptions: [...prev.prescriptions, prescription]
        }));
        
        // Clear prescription form
        setNewPrescription({
          medication: '',
          dosage: '',
          frequency: '',
          route: '',
          durationNumber: '',
          durationUnit: '',
          description: '',
          formula: '',
          take: '',
          totalQuantity: '',
        });
      }

      // NOTE: Certificates are NOT auto-saved because they require signatures
      // Users must click "Issue Certificate" to go through the signature process
      // This prevents incomplete certificates from being added to the list

      // Clear certificate form if there are unsaved certificates (discard them)
      const { hasUnsavedCertificate } = hasUnsavedForms();
      if (hasUnsavedCertificate) {
        setNewCertificate({
          type: '', description: '', fitnessStatement: '', workRestrictions: '', nextReviewDate: '',
          unfitPeriodStart: '', unfitPeriodEnd: '', medicalAdvice: '', reasonForUnfitness: '',
          followUpDate: '', travelFitnessStatement: '', travelMode: '', destination: '',
          travelDate: '', specialConditions: '', validityPeriod: '',
        });
      }

      // Forms are now saved, fee modal will handle completion
    } catch (error) {
      console.error('Error auto-saving forms:', error);
      Alert.alert('Error', 'Failed to auto-save forms. Please try again.');
    }
  };

  const proceedWithCompletion = async () => {
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

      // Create consultation data WITHOUT certificates (they're saved separately to pmc)
      const { certificates, ...consultationDataWithoutCertificates } = formData;
      
      // Debug: Check if certificates are properly excluded
      console.log(' Destructuring check:', {
        originalFormDataHasCertificates: !!formData.certificates,
        originalCertificatesCount: formData.certificates?.length || 0,
        consultationDataWithoutCertificatesHasCertificates: !!(consultationDataWithoutCertificates as any).certificates,
        consultationDataWithoutCertificatesCertificatesCount: (consultationDataWithoutCertificates as any).certificates?.length || 0,
        consultationDataWithoutCertificatesKeys: Object.keys(consultationDataWithoutCertificates),
        // Debug diagnoses specifically
        originalFormDataHasDiagnoses: !!formData.diagnoses,
        originalDiagnosesCount: formData.diagnoses?.length || 0,
        originalDiagnoses: formData.diagnoses,
        consultationDataWithoutCertificatesHasDiagnoses: !!(consultationDataWithoutCertificates as any).diagnoses,
        consultationDataWithoutCertificatesDiagnosesCount: (consultationDataWithoutCertificates as any).diagnoses?.length || 0,
        consultationDataWithoutCertificatesDiagnoses: (consultationDataWithoutCertificates as any).diagnoses
      });
      
      const consultationData = {
        ...consultationDataWithoutCertificates,
        soapNotes: {
          subjective: formData.subjective,
          objective: formData.objective,
          assessment: formData.assessment,
          plan: formData.plan,
        },
        provider: {
          id: user?.uid || '',
          firstName: user?.firstName || '',
          lastName: user?.lastName || '',
          providerType: 'specialist',
          sourceSystem: 'UniHealth_Patient_App',
        },
        type: 'General Consultation',
      };
      
      // Debug: Verify certificates are excluded from consultation data
      console.log(' Consultation data verification:', {
        hasCertificates: !!(consultationData as any).certificates,
        certificatesCount: (consultationData as any).certificates ? (consultationData as any).certificates.length : 0,
        consultationDataKeys: Object.keys(consultationData),
        hasDiagnoses: !!consultationData.diagnoses,
        diagnosesCount: consultationData.diagnoses ? consultationData.diagnoses.length : 0,
        diagnoses: consultationData.diagnoses
      });

      // Save certificates to new structure if they exist
      if (formData.certificates && formData.certificates.length > 0) {
        console.log(' About to save certificates to new structure:', formData.certificates.length);
        console.log(' Certificate data:', formData.certificates.map(cert => ({
          id: cert.id,
          type: cert.type,
          hasDigitalSignature: !!cert.digitalSignature,
          signatureLength: cert.digitalSignature ? cert.digitalSignature.length : 0
        })));
        
        // Validate required data before saving certificates
        if (!user?.uid) {
          Alert.alert('Error', 'User authentication required. Cannot create certificates.');
          setIsCompleting(false);
          setIsLoading(false);
          return;
        }
        
        if (!patientIdString) {
          Alert.alert('Error', 'Patient ID required. Cannot create certificates.');
          setIsCompleting(false);
          setIsLoading(false);
          return;
        }
        
        try {
          // Pre-validate all data before creating certificates
          const validation = await databaseService.validateCertificateCreationData(patientIdString, user.uid);
          
          if (!validation.isValid) {
            const errorMessage = `Cannot create certificates due to data issues:\n\n${validation.errors.join('\n')}\n\nPlease resolve these issues before completing the consultation.`;
            Alert.alert('Data Validation Error', errorMessage);
            setIsCompleting(false);
            setIsLoading(false);
            return;
          }
          
          // All data is valid, proceed with certificate creation
          const appointmentOrReferralId = consultationIdString || referralIdString;
          
          // Only save certificates that haven't been saved to database yet
          const certificatesToSave = formData.certificates.filter(cert => {
            // Check if certificate already has a database ID (starts with MC-)
            const hasDatabaseId = typeof cert.id === 'string' && cert.id.startsWith('MC-');
            if (hasDatabaseId) {
              console.log('ℹ️ Certificate already saved to database, skipping:', cert.id);
            }
            return !hasDatabaseId;
          });
          
          if (certificatesToSave.length > 0) {
            await Promise.all(
              certificatesToSave.map(cert => 
                databaseService.createCertificateInNewStructure(
                  cert,
                  patientIdString,
                  user.uid,
                  appointmentOrReferralId  // Pass appointmentId (from appointment) or referralId (from referral)
                )
              )
            );
            console.log(' New certificates saved to new structure successfully with appointmentId:', appointmentOrReferralId);
          } else {
            console.log('ℹ️ All certificates already saved to database, skipping certificate creation in completion');
          }
        } catch (error) {
          console.error(' Error saving certificates to new structure:', error);
          Alert.alert('Error', `Failed to save certificates: ${error.message || 'Unknown error'}. Consultation cannot be completed.`);
          setIsCompleting(false);
          setIsLoading(false);
          return; // Stop consultation completion
        }
      }

      // Handle consultation - prioritize referral if both exist
      if (referralIdString) {
        console.log('Completing consultation for referral:', referralIdString);
        console.log('Referral ID format check:', {
          referralId: referralIdString,
          isFirebaseKey: (referralIdString as string).startsWith('-'),
          length: (referralIdString as string).length,
        });

        // Check if referral already has a consultation ID
        try {
          const referralData = await databaseService.getReferralById(referralIdString as string);
          const existingReferralConsultationId = referralData?.referralConsultationId;
          
          if (existingReferralConsultationId) {
            // Update existing consultation and mark as completed
            const medicalHistoryPath = `patientMedicalHistory/${patientIdString}/entries/${existingReferralConsultationId}`;
            const medicalHistoryData = {
              ...consultationData,
              type: 'Referral Consultation',
              consultationDate: new Date().toISOString(),
              consultationTime: new Date().toLocaleTimeString(),
              patientId: patientIdString,
              provider: {
                id: user?.uid || '',
                firstName: user?.firstName || '',
                lastName: user?.lastName || '',
                providerType: 'specialist',
                sourceSystem: 'UniHealth_Patient_App',
              },
              relatedReferral: {
                id: referralIdString,
                type: 'Referral Consultation'
              },
              lastUpdated: new Date().toISOString(),
            };
            await databaseService.setDocument(medicalHistoryPath, medicalHistoryData);
            console.log('Updated existing referral consultation with ID:', existingReferralConsultationId);
            
            // Update referral status to completed
            try {
              const referralExists = await databaseService.getReferralById(referralIdString as string);
              if (referralExists) {
                await databaseService.updateReferral(referralIdString as string, {
                  status: 'completed',
                  referralConsultationId: existingReferralConsultationId,
                });
                console.log('Referral updated with referralConsultationId:', existingReferralConsultationId);
              } else {
                console.warn('Referral not found with ID:', referralIdString);
              }
            } catch (error) {
              console.error('Error updating referral with consultation ID:', error);
            }
          } else {
            // Create new consultation for referral
            const referralConsultationId = await databaseService.saveReferralConsultationData(
              patientIdString,
              referralIdString as string,
              {
                ...consultationData,
                type: 'Referral Consultation',
              }
            );
            console.log('Created new referral consultation with ID:', referralConsultationId);

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
          }
        } catch (error) {
          console.error('Error checking referral for existing consultation ID:', error);
          // Fallback: create new consultation
          const referralConsultationId = await databaseService.saveReferralConsultationData(
            patientIdString,
            referralIdString as string,
            {
              ...consultationData,
              type: 'Referral Consultation',
            }
          );
          console.log('Created new referral consultation with ID (fallback):', referralConsultationId);
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
        console.log('Completing consultation for appointment:', consultationIdString);
        
        // Check if we already have a consultation entry for this appointment
        const existingConsultation = await databaseService.getDocument(`patientMedicalHistory/${patientIdString}/entries/${consultationIdString}`);
        
        if (existingConsultation) {
          // Update existing consultation
          const medicalHistoryPath = `patientMedicalHistory/${patientIdString}/entries/${consultationIdString}`;
          const medicalHistoryData = {
            ...consultationData,
            consultationDate: new Date().toISOString(),
            consultationTime: new Date().toLocaleTimeString(),
            patientId: patientIdString,
            provider: {
              id: user?.uid || '',
              firstName: user?.firstName || '',
              lastName: user?.lastName || '',
              providerType: 'specialist',
              sourceSystem: 'UniHealth_Patient_App',
            },
            relatedAppointment: {
              id: consultationIdString,
              type: 'General Consultation'
            },
            lastUpdated: new Date().toISOString(),
          };
          await databaseService.setDocument(medicalHistoryPath, medicalHistoryData);
          console.log('Updated existing appointment consultation with ID:', consultationIdString);
        } else {
          // Create new consultation for appointment
          const consultationId = await databaseService.saveConsultationData(
            patientIdString,
            consultationIdString as string,
            consultationData
          );
          console.log('Created new appointment consultation with ID:', consultationId);
        }

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
        if (isFollowUpAppointment && originalReferralIdString) {
          // For follow-up appointments, navigate back to the original referral details
          router.replace(`/(specialist)/referral-details?id=${originalReferralIdString}&isFollowUp=true&appointmentId=${consultationIdString}${refreshParam}`);
        } else {
          router.replace(`/visit-overview?id=${consultationIdString}${refreshParam}`);
        }
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
            <Text style={styles.stepProgressPercentage}>{animatedProgress}% Complete</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${animatedProgress}%` }]} />
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
  const renderFieldWithSpeech = (label: string, field: string, multiline = false, useAsterisk = false) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>
        {label}
        {useAsterisk ? (
          <Text style={styles.requiredAsterisk}> *</Text>
        ) : (
          <Text style={styles.requiredSuffix}> (required)</Text>
        )}
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
           Recording... Tap microphone to stop
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
            
            <Text style={styles.requiredFieldsLegend}><Text style={styles.requiredAsterisk}>*</Text> required fields</Text>
            
            {/* History of Present Illnesses */}
            {renderFieldWithSpeech('History of Present Illnesses', 'presentIllnessHistory', true, true)}
            
            {/* Review of Symptoms */}
            {renderFieldWithSpeech('Review of Symptoms', 'reviewOfSymptoms', true, true)}
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
            
            <Text style={styles.requiredFieldsLegend}><Text style={styles.requiredAsterisk}>*</Text> required fields</Text>
            
            {/* Lab Results */}
            {renderFieldWithSpeech('Lab Results', 'labResults', true, true)}
            
            {/* Medications */}
            {renderFieldWithSpeech('Medications', 'medications', true, true)}
            
            {/* Diagnosis */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Diagnoses<Text style={styles.requiredAsterisk}> *</Text></Text>
              
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
                        Description<Text style={styles.requiredAsterisk}> *</Text>
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
                    <Text style={styles.fieldLabel}>Description<Text style={styles.requiredAsterisk}> *</Text></Text>
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
                  <View style={styles.addDiagnosisButtonContainer}>
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
                    
                    {/* Tooltip */}
                    {showDiagnosisTooltip && (
                      <View style={styles.diagnosisTooltip}>
                        <View style={styles.tooltipBubble}>
                          <Text style={styles.tooltipText}>
                            Click + to add{'\n'}diagnosis
                          </Text>
                        </View>
                        <View style={styles.tooltipArrow} />
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>
            
            {/* Differential Diagnosis */}
            {renderFieldWithSpeech('Differential Diagnosis', 'differentialDiagnosis', true, true)}
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
            
            <Text style={styles.requiredFieldsLegend}><Text style={styles.requiredAsterisk}>*</Text> required fields</Text>
            
            {/* SOAP Notes */}
            {renderFieldWithSpeech('Subjective', 'subjective', true, true)}
            {renderFieldWithSpeech('Objective', 'objective', true, true)}
            {renderFieldWithSpeech('Assessment', 'assessment', true, true)}
            {renderFieldWithSpeech('Plan', 'plan', true, true)}
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
            
            <Text style={styles.requiredFieldsLegend}><Text style={styles.requiredAsterisk}>*</Text> required fields</Text>
            
            {/* Treatment Plan */}
            {renderFieldWithSpeech('Treatment Plan', 'treatmentPlan', true, true)}
            
            {/* Clinical Summary */}
            {renderFieldWithSpeech('Clinical Summary', 'clinicalSummary', true, true)}
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
                          {prescription.formula && ` • ${formatFormula(prescription.formula, 'patient')}`}
                          {prescription.take && ` • Take: ${prescription.take}`}
                          {prescription.totalQuantity && ` • Total: ${prescription.totalQuantity}`}
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
                      {prescription.take && (
                        <View style={styles.metaRow}>
                          <Text style={styles.metaLabel}>Take:</Text>
                          <Text style={styles.metaValue}>{prescription.take}</Text>
                        </View>
                      )}
                      {prescription.totalQuantity && (
                        <View style={styles.metaRow}>
                          <Text style={styles.metaLabel}>Total Quantity:</Text>
                          <Text style={styles.metaValue}>{prescription.totalQuantity}</Text>
                        </View>
                      )}
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.addFormTitle}>Add New Prescription</Text>
                    {unsavedFormsStatus.hasUnsavedPrescription && (
                      <View style={{ 
                        backgroundColor: '#FFE4B5', 
                        paddingHorizontal: 8, 
                        paddingVertical: 4, 
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#FFA500'
                      }}>
                        <Text style={{ 
                          fontSize: 12, 
                          color: '#FF8C00', 
                          fontWeight: 'bold' 
                        }}>
                           UNSAVED
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.requiredFieldsLegend}><Text style={styles.requiredAsterisk}>*</Text> required fields</Text>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Medication name <Text style={styles.requiredAsterisk}>*</Text></Text>
                    <TextInput
                      style={styles.addFormInput}
                      placeholder="Enter medication name"
                      placeholderTextColor="#9CA3AF"
                      value={newPrescription.medication}
                      onChangeText={(value) => setNewPrescription((prev) => ({ ...prev, medication: value }))}
                    />
                  </View>
                  
                  {/* Row 2: Dosage + Formulation */}
                  <View style={styles.addFormRow}>
                    <View style={styles.fieldContainerHalf}>
                      <Text style={styles.fieldLabel}>Dosage <Text style={styles.requiredAsterisk}>*</Text></Text>
                      <TextInput
                        style={[styles.addFormInput, styles.addFormInputHalf]}
                        placeholder="e.g., 10mg"
                        placeholderTextColor="#9CA3AF"
                        value={newPrescription.dosage}
                        onChangeText={(value) => setNewPrescription((prev) => ({ ...prev, dosage: value }))}
                      />
                    </View>
                    <View style={styles.fieldContainerHalf}>
                      <Text style={styles.fieldLabel}>Formulation <Text style={styles.requiredAsterisk}>*</Text></Text>
                      <TouchableOpacity
                        style={[styles.addFormInput, styles.addFormInputHalf, styles.frequencyButton]}
                        onPress={() => setShowFormulaModal(true)}
                      >
                        <View style={styles.frequencyButtonContent}>
                          <Text style={newPrescription.formula ? styles.frequencyButtonText : styles.frequencyButtonPlaceholder}>
                            {newPrescription.formula || 'Select formulation'}
                          </Text>
                          <ChevronDown size={16} color="#6B7280" />
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {/* Row 3: Take & Total Quantity with Dynamic Units */}
                  <PrescriptionUnitInputs
                    formula={newPrescription.formula}
                    takeValue={newPrescription.take}
                    onTakeChange={(value) => setNewPrescription((prev) => ({ ...prev, take: value }))}
                    totalValue={newPrescription.totalQuantity}
                    onTotalChange={(value) => setNewPrescription((prev) => ({ ...prev, totalQuantity: value }))}
                    takePlaceholder="Take amount"
                    totalPlaceholder="Total quantity"
                  />
                  
                  {/* Row 4: Frequency + Route */}
                  <View style={styles.addFormRow}>
                    <View style={styles.fieldContainerHalf}>
                      <Text style={styles.fieldLabel}>Frequency <Text style={styles.requiredAsterisk}>*</Text></Text>
                      <TouchableOpacity
                        style={[styles.addFormInput, styles.addFormInputHalf, styles.frequencyButton]}
                        onPress={() => setShowFrequencyModal(true)}
                      >
                        <View style={styles.frequencyButtonContent}>
                          <Text style={newPrescription.frequency ? styles.frequencyButtonText : styles.frequencyButtonPlaceholder}>
                            {newPrescription.frequency || 'Select frequency'}
                          </Text>
                          <ChevronDown size={16} color="#6B7280" />
                        </View>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.fieldContainerHalf}>
                      <Text style={styles.fieldLabel}>Route <Text style={styles.requiredAsterisk}>*</Text></Text>
                      <TouchableOpacity
                        style={[styles.addFormInput, styles.addFormInputHalf, styles.frequencyButton]}
                        onPress={() => setShowRouteModal(true)}
                      >
                        <View style={styles.frequencyButtonContent}>
                          <Text style={newPrescription.route ? styles.frequencyButtonText : styles.frequencyButtonPlaceholder}>
                            {newPrescription.route || 'Select route'}
                          </Text>
                          <ChevronDown size={16} color="#6B7280" />
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {/* Row 5: Duration */}
                  <View style={styles.addFormRow}>
                    <View style={styles.fieldContainerHalf}>
                      <Text style={styles.fieldLabel}>Duration <Text style={styles.requiredAsterisk}>*</Text></Text>
                      <View style={[styles.addFormInput, styles.addFormInputHalf, { flexDirection: 'row', gap: 8 }]}>
                        <TextInput
                          style={[styles.addFormInput, { flex: 1, marginBottom: 0 }]}
                          placeholder="Enter duration"
                          placeholderTextColor="#9CA3AF"
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
                          style={[styles.addFormInput, { flex: 1, marginBottom: 0 }, styles.frequencyButton]}
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
                    </View>
                  </View>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Description/Instructions <Text style={styles.requiredAsterisk}>*</Text></Text>
                    <TextInput
                      style={[styles.addFormInput, styles.addFormTextArea]}
                      placeholder="Enter description or instructions"
                      placeholderTextColor="#9CA3AF"
                      value={newPrescription.description}
                      onChangeText={(value) => setNewPrescription((prev) => ({ ...prev, description: value }))}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>
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
                          formula: '',
                          take: '',
                          totalQuantity: '',
                        });
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <View style={styles.addFormSubmitButtonContainer}>
                      <TouchableOpacity
                        style={styles.addFormSubmitButton}
                        onPress={handleAddPrescription}
                      >
                        <Text style={styles.addFormSubmitButtonText}>Add Prescription</Text>
                      </TouchableOpacity>
                      
                      {/* Prescription Tooltip */}
                      {showPrescriptionTooltip && (
                        <View style={styles.prescriptionTooltip}>
                          <View style={styles.tooltipBubble}>
                            <Text style={styles.tooltipText}>
                              Click to add this{'\n'}prescription
                            </Text>
                          </View>
                          <View style={styles.tooltipArrow} />
                        </View>
                      )}
                    </View>
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
                        <View style={styles.certificateTitleRow}>
                          <Text style={styles.certificateType}>{certificate.type}</Text>
                          {certificate.digitalSignature ? (
                            <View style={styles.signatureIndicator}>
                              <CheckCircle size={16} color="#10B981" />
                              <Text style={styles.signatureText}>Signed</Text>
                            </View>
                          ) : (
                            <View style={styles.signatureIndicator}>
                              <AlertTriangle size={16} color="#F59E0B" />
                              <Text style={[styles.signatureText, { color: '#F59E0B' }]}>Needs Signature</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.certificateDescription}>{certificate.description}</Text>
                      </View>
                      <View style={styles.certificateActions}>
                        <TouchableOpacity
                          style={styles.viewCertificateButton}
                          onPress={() => {
                            // Navigate to appropriate certificate view based on type
                            const route = certificate.type === 'Fit to Work Certificate' 
                              ? '/e-certificate-fit-to-work'
                              : certificate.type === 'Medical/Sickness Certificate'
                              ? '/e-certificate-medical-sickness'
                              : certificate.type === 'Fit to Travel Certificate'
                              ? '/e-certificate-fit-to-travel'
                              : '/e-certificate-fit-to-work'; // fallback
                            
                            router.push(`${route}?id=${consultationIdString || referralIdString}&certificateId=${certificate.id}`);
                          }}
                        >
                          <Eye size={16} color="#1E40AF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => handleRemoveCertificate(certificate.id)}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.certificateMeta}>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Issued:</Text>
                        <Text style={styles.metaValue}>{certificate.issuedDate}</Text>
                      </View>

                    </View>
                  </View>
                ))
              )}

              {/* Add Certificate Form */}
              {showAddCertificate && (
                <View style={styles.addForm}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.addFormTitle}>Issue New Certificate</Text>
                    {unsavedFormsStatus.hasUnsavedCertificate && (
                      <View style={{ 
                        backgroundColor: '#FFE4B5', 
                        paddingHorizontal: 8, 
                        paddingVertical: 4, 
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#FFA500'
                      }}>
                        <Text style={{ 
                          fontSize: 12, 
                          color: '#FF8C00', 
                          fontWeight: 'bold' 
                        }}>
                           UNSAVED
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.requiredFieldsLegend}><Text style={styles.requiredAsterisk}>*</Text> required fields</Text>
                  <View style={styles.addFormInput}>
                    <Text style={styles.addFormLabel}>Certificate Type <Text style={styles.requiredAsterisk}>*</Text></Text>
                    <View style={styles.certificateTypeSelector}>
                      {['Fit to Work Certificate', 'Medical/Sickness Certificate', 'Fit to Travel Certificate'].map((certType) => (
                        <TouchableOpacity
                          key={certType}
                          style={[
                            styles.certificateTypeOption,
                            newCertificate.type === certType && styles.certificateTypeOptionSelected
                          ]}
                          onPress={() => setNewCertificate((prev) => ({ ...prev, type: certType }))}
                        >
                          <Text style={[
                            styles.certificateTypeOptionText,
                            newCertificate.type === certType && styles.certificateTypeOptionTextSelected
                          ]}>
                            {certType}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Description/Medical findings <Text style={styles.requiredAsterisk}>*</Text></Text>
                    <TextInput
                      style={[styles.addFormInput, styles.addFormTextArea]}
                      placeholder="Enter description or medical findings"
                      placeholderTextColor="#9CA3AF"
                      value={newCertificate.description}
                      onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, description: value }))}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>


                  {/* Dynamic fields based on certificate type */}
                  {newCertificate.type === 'Fit to Work Certificate' && (
                    <>
                      <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>Fitness Statement <Text style={styles.requiredAsterisk}>*</Text></Text>
                        <TextInput
                          style={[styles.addFormInput, styles.addFormTextArea]}
                          placeholder="e.g., Patient is medically fit to return to work"
                          placeholderTextColor="#9CA3AF"
                          value={newCertificate.fitnessStatement}
                          onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, fitnessStatement: value }))}
                          multiline
                          numberOfLines={3}
                          textAlignVertical="top"
                        />
                      </View>
                      <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>Work Restrictions <Text style={styles.requiredAsterisk}>*</Text></Text>
                        <TextInput
                          style={styles.addFormInput}
                          placeholder="e.g., None, Light duty only"
                          placeholderTextColor="#9CA3AF"
                          value={newCertificate.workRestrictions}
                          onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, workRestrictions: value }))}
                        />
                      </View>
                      <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>Next Review Date</Text>
                        <TextInput
                          style={styles.addFormInput}
                          placeholder="Optional - e.g., Aug 30, 2025"
                          placeholderTextColor="#9CA3AF"
                          value={newCertificate.nextReviewDate}
                          onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, nextReviewDate: value }))}
                        />
                      </View>
                    </>
                  )}

                  {newCertificate.type === 'Medical/Sickness Certificate' && (
                    <>
                      <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>Unfit Period Start <Text style={styles.requiredAsterisk}>*</Text></Text>
                        <TextInput
                          style={styles.addFormInput}
                          placeholder="e.g., Aug 20, 2025"
                          placeholderTextColor="#9CA3AF"
                          value={newCertificate.unfitPeriodStart}
                          onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, unfitPeriodStart: value }))}
                        />
                      </View>
                      <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>Unfit Period End <Text style={styles.requiredAsterisk}>*</Text></Text>
                        <TextInput
                          style={styles.addFormInput}
                          placeholder="e.g., Aug 22, 2025"
                          placeholderTextColor="#9CA3AF"
                          value={newCertificate.unfitPeriodEnd}
                          onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, unfitPeriodEnd: value }))}
                        />
                      </View>
                      <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>Reason for Unfitness <Text style={styles.requiredAsterisk}>*</Text></Text>
                        <TextInput
                          style={[styles.addFormInput, styles.addFormTextArea]}
                          placeholder="e.g., Medical condition requiring rest"
                          placeholderTextColor="#9CA3AF"
                          value={newCertificate.reasonForUnfitness}
                          onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, reasonForUnfitness: value }))}
                          multiline
                          numberOfLines={3}
                          textAlignVertical="top"
                        />
                      </View>
                      <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>Medical Advice <Text style={styles.requiredAsterisk}>*</Text></Text>
                        <TextInput
                          style={[styles.addFormInput, styles.addFormTextArea]}
                          placeholder="e.g., Patient is advised to rest and refrain from work"
                          placeholderTextColor="#9CA3AF"
                          value={newCertificate.medicalAdvice}
                          onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, medicalAdvice: value }))}
                          multiline
                          numberOfLines={3}
                          textAlignVertical="top"
                        />
                      </View>
                      <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>Follow-up Date</Text>
                        <TextInput
                          style={styles.addFormInput}
                          placeholder="Optional - e.g., Aug 25, 2025"
                          placeholderTextColor="#9CA3AF"
                          value={newCertificate.followUpDate}
                          onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, followUpDate: value }))}
                        />
                      </View>
                    </>
                  )}

                  {newCertificate.type === 'Fit to Travel Certificate' && (
                    <>
                      <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>Travel Fitness Statement <Text style={styles.requiredAsterisk}>*</Text></Text>
                        <TextInput
                          style={[styles.addFormInput, styles.addFormTextArea]}
                          placeholder="e.g., Patient is medically fit to travel"
                          placeholderTextColor="#9CA3AF"
                          value={newCertificate.travelFitnessStatement}
                          onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, travelFitnessStatement: value }))}
                          multiline
                          numberOfLines={3}
                          textAlignVertical="top"
                        />
                      </View>
                      <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>Mode of Travel <Text style={styles.requiredAsterisk}>*</Text></Text>
                        <TextInput
                          style={styles.addFormInput}
                          placeholder="e.g., Air, Sea, Land"
                          placeholderTextColor="#9CA3AF"
                          value={newCertificate.travelMode}
                          onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, travelMode: value }))}
                        />
                      </View>
                      <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>Destination <Text style={styles.requiredAsterisk}>*</Text></Text>
                        <TextInput
                          style={styles.addFormInput}
                          placeholder="e.g., International, Domestic"
                          placeholderTextColor="#9CA3AF"
                          value={newCertificate.destination}
                          onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, destination: value }))}
                        />
                      </View>
                      <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>Travel Date <Text style={styles.requiredAsterisk}>*</Text></Text>
                        <TextInput
                          style={styles.addFormInput}
                          placeholder="e.g., Aug 25, 2025"
                          placeholderTextColor="#9CA3AF"
                          value={newCertificate.travelDate}
                          onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, travelDate: value }))}
                        />
                      </View>
                      <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>Special Conditions <Text style={styles.requiredAsterisk}>*</Text></Text>
                        <TextInput
                          style={styles.addFormInput}
                          placeholder="e.g., None, Wheelchair assistance"
                          placeholderTextColor="#9CA3AF"
                          value={newCertificate.specialConditions}
                          onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, specialConditions: value }))}
                        />
                      </View>
                      <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>Validity Period <Text style={styles.requiredAsterisk}>*</Text></Text>
                        <TextInput
                          style={styles.addFormInput}
                          placeholder="e.g., 30 days from issue"
                          placeholderTextColor="#9CA3AF"
                          value={newCertificate.validityPeriod}
                          onChangeText={(value) => setNewCertificate((prev) => ({ ...prev, validityPeriod: value }))}
                        />
                      </View>
                    </>
                  )}
                  <View style={styles.addFormActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setShowAddCertificate(false);
                        setNewCertificate({
                          type: '',
                          description: '',
                          // Fit to Work specific fields
                          fitnessStatement: '',
                          workRestrictions: '',
                          nextReviewDate: '',
                          // Medical/Sickness specific fields
                          unfitPeriodStart: '',
                          unfitPeriodEnd: '',
                          medicalAdvice: '',
                          reasonForUnfitness: '',
                          followUpDate: '',
                          // Fit to Travel specific fields
                          travelFitnessStatement: '',
                          travelMode: '',
                          destination: '',
                          travelDate: '',
                          specialConditions: '',
                          validityPeriod: '',
                        });
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <View style={styles.addFormSubmitButtonContainer}>
                      <TouchableOpacity
                        style={styles.addFormSubmitButton}
                        onPress={handleAddCertificate}
                      >
                        <Text style={styles.addFormSubmitButtonText}>Issue Certificate</Text>
                      </TouchableOpacity>
                      
                      {/* Certificate Tooltip */}
                      {showCertificateTooltip && (
                        <View style={styles.certificateTooltip}>
                          <View style={styles.tooltipBubble}>
                            <Text style={styles.tooltipText}>
                              Click to issue this{'\n'}certificate
                            </Text>
                          </View>
                          <View style={styles.tooltipArrow} />
                        </View>
                      )}
                    </View>
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
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => {
            console.log('Back button TouchableOpacity pressed');
            handleBackPress();
          }}
        >
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

      <KeyboardAvoidingScrollView
        style={styles.scrollView}
        extraOffset={20}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
                {/* Step Content */}
        {renderStepContent()}
      </KeyboardAvoidingScrollView>

      {/* Bottom Action Buttons */}
      <View style={styles.bottomContainer}>
        
        
        {/* Save/Complete Consultation Button - Show both when at 100% progress */}
        {progressPercent < 100 ? (
          <TouchableOpacity
            style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
            onPress={handleSaveChanges}
            disabled={!hasChanges}
          >
            <Text style={[styles.saveButtonText, !hasChanges && styles.saveButtonTextDisabled]}>Save Consultation</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
              onPress={handleSaveChanges}
              disabled={!hasChanges}
            >
              <Text style={[styles.saveButtonText, !hasChanges && styles.saveButtonTextDisabled]}>Save Consultation</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.completeButton, !isCompleteEnabled && styles.saveButtonDisabled]}
              onPress={handleOpenFeeModal}
              disabled={!isCompleteEnabled}
            >
              <CheckCircle size={18} color="#FFFFFF" />
              <Text style={styles.completeButtonText}>Complete Consultation</Text>
            </TouchableOpacity>
          </>
        )}

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

                {/* Certificates - Loaded from new patientMedicalCertificates structure */}
                {(() => {
                  // Load certificates from new structure for this consultation
                  const [consultationCertificates, setConsultationCertificates] = React.useState<any[]>([]);
                  
                  React.useEffect(() => {
                    const loadCertificates = async () => {
                      if (patientId && consultationIdString) {
                        try {
                          const certificates = await databaseService.getCertificatesByPatientNew(patientId as string);
                          // Filter certificates that might be related to this consultation
                          const relatedCertificates = certificates.filter(cert => {
                            const certDate = new Date(cert.issueDate);
                            const consultationDate = new Date(medicalHistory?.consultationDate || '');
                            // Include certificates issued on the same date as the consultation
                            return certDate.toDateString() === consultationDate.toDateString();
                          });
                          setConsultationCertificates(relatedCertificates);
                        } catch (error) {
                          console.error('Error loading certificates for consultation:', error);
                        }
                      }
                    };
                    
                    loadCertificates();
                  }, [patientId, consultationIdString, medicalHistory?.consultationDate]);
                  
                  return consultationCertificates.length > 0 ? (
                    <View style={styles.medicalHistorySection}>
                      <Text style={styles.medicalHistorySectionTitle}>Medical Certificates</Text>
                      <View style={styles.medicalHistoryCard}>
                        {consultationCertificates.map((certificate: any, index: number) => (
                          <View key={index} style={styles.certificateItem}>
                            <Text style={styles.certificateTypeText}>{certificate.type}</Text>
                            <Text style={styles.certificateDescriptionText}>{certificate.description}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null;
                })()}

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

      {/* Unsaved Forms Modal */}
      <Modal
        visible={showUnsavedFormsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseUnsavedFormsModal}
      >
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <Pressable style={unsavedFormsModalStyles.backdrop} onPress={handleCloseUnsavedFormsModal}>
          <BlurView intensity={22} style={unsavedFormsModalStyles.blurView}>
            <View style={unsavedFormsModalStyles.overlay} />
          </BlurView>
        </Pressable>
        <View style={unsavedFormsModalStyles.modalContainer}>
          <SafeAreaView style={unsavedFormsModalStyles.safeArea}>
            <View style={unsavedFormsModalStyles.modalContent}>
              {/* Header */}
              <View style={unsavedFormsModalStyles.header}>
                <View style={unsavedFormsModalStyles.headerLeft}>
                  <View style={unsavedFormsModalStyles.warningIcon}>
                    <AlertTriangle size={24} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={unsavedFormsModalStyles.headerTitle}>Unsaved Forms Detected</Text>
                    <Text style={unsavedFormsModalStyles.headerSubtitle}>You have forms with data that haven't been saved</Text>
                  </View>
                </View>
                <TouchableOpacity style={unsavedFormsModalStyles.closeButton} onPress={handleCloseUnsavedFormsModal}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              {/* Divider */}
              <View style={unsavedFormsModalStyles.divider} />
              
              {/* Content */}
              <View style={unsavedFormsModalStyles.content}>
                <Text style={unsavedFormsModalStyles.warningText}>
                  You have filled out forms but haven't clicked the save buttons yet:
                </Text>
                
                {/* {unsavedFormsStatus.hasUnsavedCertificate && (
                  <View style={unsavedFormsModalStyles.certificateWarning}>
                    <Text style={unsavedFormsModalStyles.certificateWarningText}>
                       Certificate forms will be lost if you choose "Save & Complete" because certificates require digital signatures.
                    </Text>
                  </View>
                )} */}
                
                <View style={unsavedFormsModalStyles.formsList}>
                  {unsavedFormsStatus.hasUnsavedPrescription && (
                    <View style={unsavedFormsModalStyles.formItem}>
                      <View style={unsavedFormsModalStyles.formIcon}>
                        <Pill size={20} color="#1E40AF" />
                      </View>
                      <View style={unsavedFormsModalStyles.formDetails}>
                        <Text style={unsavedFormsModalStyles.formTitle}>Prescription Form</Text>
                        <Text style={unsavedFormsModalStyles.formDescription}>
                          To save: Click "Add Prescription" button in the prescription section
                        </Text>
                      </View>
                    </View>
                  )}
                  
                  {unsavedFormsStatus.hasUnsavedCertificate && (
                    <View style={unsavedFormsModalStyles.formItem}>
                      <View style={unsavedFormsModalStyles.formIcon}>
                        <FileText size={20} color="#1E40AF" />
                      </View>
                      <View style={unsavedFormsModalStyles.formDetails}>
                        <Text style={unsavedFormsModalStyles.formTitle}>Certificate Form</Text>
                        <Text style={unsavedFormsModalStyles.formDescription}>
                          To save: Click "Issue Certificate" button in the certificate section
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
                
                <Text style={unsavedFormsModalStyles.instructionText}>
                  What would you like to do with these unsaved forms?
                </Text>
              </View>
              
              {/* Actions */}
              <View style={unsavedFormsModalStyles.actions}>
                <TouchableOpacity 
                  style={unsavedFormsModalStyles.saveButton} 
                  onPress={handleSaveAndComplete}
                >
                  <Text style={unsavedFormsModalStyles.saveButtonText}>
                    {unsavedFormsStatus.hasUnsavedPrescription 
                      ? 'Save Prescriptions & Complete' 
                      : 'Complete Without Saving'
                    }
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Exit Confirmation Modal */}
      <Modal
        visible={showExitConfirmationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancelExit}
        statusBarTranslucent={true}
      >
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <Pressable style={exitConfirmationModalStyles.backdrop} onPress={handleCancelExit}>
          <BlurView intensity={22} style={exitConfirmationModalStyles.blurView}>
            <View style={exitConfirmationModalStyles.overlay} />
          </BlurView>
        </Pressable>
        <View style={exitConfirmationModalStyles.modalContainer}>
          <SafeAreaView style={exitConfirmationModalStyles.safeArea}>
            <View style={exitConfirmationModalStyles.modalContent}>
              {/* Header */}
              <View style={exitConfirmationModalStyles.header}>
                <View style={exitConfirmationModalStyles.headerLeft}>
                  <View style={exitConfirmationModalStyles.warningIcon}>
                    <AlertTriangle size={24} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={exitConfirmationModalStyles.headerTitle}>Unsaved Changes</Text>
                    <Text style={exitConfirmationModalStyles.headerSubtitle}>You have unsaved data that will be lost</Text>
                  </View>
                </View>
                <TouchableOpacity style={exitConfirmationModalStyles.closeButton} onPress={handleCancelExit}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              {/* Divider */}
              <View style={exitConfirmationModalStyles.divider} />
              
              {/* Content */}
              <View style={exitConfirmationModalStyles.content}>
                <Text style={exitConfirmationModalStyles.warningText}>
                  Are you sure you want to exit this page? You have unsaved changes that will be lost.
                </Text>
                
                <Text style={exitConfirmationModalStyles.instructionText}>
                  {progressPercent < 100 
                    ? 'If you want to continue later, please click "Save Consultation" to save your progress.'
                    : 'If you want to continue later, please click "Complete Consultation" to save your progress.'
                  }
                </Text>
              </View>
              
              {/* Actions */}
              <View style={exitConfirmationModalStyles.actions}>
                <TouchableOpacity 
                  style={exitConfirmationModalStyles.cancelButton} 
                  onPress={handleCancelExit}
                >
                  <Text style={exitConfirmationModalStyles.cancelButtonText}>Stay on Page</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={exitConfirmationModalStyles.exitButton} 
                  onPress={() => {
                    console.log('Exit Anyway button TouchableOpacity pressed');
                    handleConfirmExit();
                  }}
                >
                  <Text style={exitConfirmationModalStyles.exitButtonText}>Exit Anyway</Text>
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

      {/* Formula Selection Modal */}
      <FormulaSelectionModal
        visible={showFormulaModal}
        onClose={() => setShowFormulaModal(false)}
        onSelect={(formula) => setNewPrescription((prev) => ({ ...prev, formula }))}
        userRole="specialist"
      />

      {/* Processing Speech Overlay */}
      {isProcessingSpeech && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingContainer}>
            <View style={styles.processingIconContainer}>
              <Mic size={32} color="#1E40AF" />
            </View>
            <Text style={styles.processingTitle}>Processing Speech</Text>
            <Text style={styles.processingSubtitle}>Converting your voice to text...</Text>
            <View style={styles.processingDotsContainer}>
              <Animated.View
                style={[
                  styles.processingDot,
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
                  styles.processingDot,
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
                  styles.processingDot,
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
        </View>
      )}
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
    paddingTop: Platform.OS === 'ios' ? 34 : 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    flexDirection: 'column',
    gap: 8,
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
    marginBottom: 8,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  completeButtonDisabled: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  certificateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  signatureIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  signatureText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#10B981',
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
  requiredFieldsLegend: {
    fontSize: 12,
    fontFamily: 'Inter-Italic',
    color: '#6B7280',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldContainerHalf: {
    flex: 1,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  requiredAsterisk: {
    color: '#EF4444',
    fontWeight: 'bold',
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
    paddingHorizontal: 12,
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
  addDiagnosisButtonContainer: {
    position: 'relative',
  },
  diagnosisTooltip: {
    position: 'absolute',
    bottom: 60,
    right: -10,
    zIndex: 1000,
  },
  tooltipBubble: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 140,
    maxWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
    lineHeight: 16,
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -6,
    right: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1F2937',
  },
  addButtonContainer: {
    position: 'relative',
  },
  addFormSubmitButtonContainer: {
    position: 'relative',
  },
  prescriptionTooltip: {
    position: 'absolute',
    bottom: 50,
    right: -10,
    zIndex: 1000,
  },
  certificateTooltip: {
    position: 'absolute',
    bottom: 50,
    right: -10,
    zIndex: 1000,
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
  
  // Certificate Type Selector Styles
  addFormLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  certificateTypeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  certificateTypeOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  certificateTypeOptionSelected: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  certificateTypeOptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  certificateTypeOptionTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
  },
  
  // Certificate Actions Styles
  certificateActions: {
    flexDirection: 'row',
    gap: 8,
  },
  viewCertificateButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  
  // Processing Speech Overlay Styles
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  processingContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  processingIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#DBEAFE',
  },
  processingTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  processingSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  processingDotsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  processingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1E40AF',
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

// Unsaved Forms Modal Styles
const unsavedFormsModalStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    zIndex: 1,
  },
  blurView: { 
    flex: 1 
  },
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.34)' 
  },
  modalContainer: {
    flex: 1, 
    justifyContent: 'flex-end', 
    zIndex: 2,
  },
  safeArea: { 
    width: '100%' 
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    alignItems: 'stretch',
    minHeight: SCREEN_HEIGHT * 0.4,
    maxHeight: SCREEN_HEIGHT * 0.8,
  },
  header: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16,
  },
  headerLeft: { 
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1 
  },
  warningIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20, 
    fontFamily: 'Inter-Bold', 
    color: '#1F2937', 
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14, 
    fontFamily: 'Inter-Regular', 
    color: '#6B7280',
  },
  closeButton: {
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    marginLeft: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  content: {
    marginBottom: 24,
  },
  warningText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 20,
    lineHeight: 24,
  },
  formsList: {
    marginBottom: 20,
  },
  formItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  formIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  formDetails: {
    flex: 1,
  },
  formTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  formDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  instructionText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  discardButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  discardButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  certificateWarning: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  certificateWarningText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#92400E',
    lineHeight: 20,
  },
});

// Exit Confirmation Modal Styles
const exitConfirmationModalStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    zIndex: 1,
  },
  blurView: { 
    flex: 1 
  },
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.34)' 
  },
  modalContainer: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 2,
  },
  safeArea: { 
    width: SCREEN_WIDTH * 0.92, 
    maxWidth: 410 
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 26,
    alignItems: 'stretch',
  },
  header: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16,
  },
  headerLeft: { 
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1 
  },
  warningIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20, 
    fontFamily: 'Inter-Bold', 
    color: '#1F2937', 
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14, 
    fontFamily: 'Inter-Regular', 
    color: '#6B7280',
  },
  closeButton: {
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    marginLeft: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  content: {
    marginBottom: 24,
  },
  warningText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 16,
    lineHeight: 24,
  },
  instructionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  exitButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  exitButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});