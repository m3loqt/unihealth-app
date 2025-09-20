import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Image,
  Dimensions,
  LayoutAnimation,
  UIManager,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import {
  Pill,
  FileText,
  Eye,
  Download,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  User,
  MapPin,
  Calendar,
  Clock,
  Stethoscope,
  X,
  Check,
  ChevronDown as ChevronIcon,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/hooks/auth/useAuth';
import { databaseService, Referral, MedicalHistory } from '../../src/services/database/firebase';
import { safeDataAccess } from '../../src/utils/safeDataAccess';
import { formatRoute, formatFrequency, formatFormula } from '../../src/utils/formatting';

// Extended interface for referral data that includes additional properties
interface ReferralData extends Referral {
  patientName?: string;
  patientPhoto?: string;
  referringDoctorName?: string;
  referringClinicAddress?: string;
  clinic?: string;
  date?: string;
  time?: string;
  address?: string;
  clinicAndAddress?: string;
  dateTime?: string;
  specialistClinic?: string;
  specialistClinicAndAddress?: string;
  additionalNotes?: string;
  
  // Clinical fields from medical history
  presentIllnessHistory?: string;
  reviewOfSymptoms?: string;
  labResults?: string;
  medications?: string;
  diagnosis?: string;
  differentialDiagnosis?: string;
  
  // SOAP Notes
  soapNotes?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  
  // Treatment & Wrap-Up
  treatmentPlan?: string;
  clinicalSummary?: string;
  

}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const HORIZONTAL_MARGIN = 24;

// Helper function to format date
// Formatting helpers (aligned with specialist screen)
const formatDate = (dateString: string) => {
  try {
    // Handle DD/MM/YYYY format
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    
    // Handle YYYY-MM-DD format (original logic)
    if (dateString.includes('-')) {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    
    // Fallback to native Date parsing
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    
    return 'Invalid date';
  } catch (error) {
    return 'Invalid date';
  }
};

// Helper function to format time
const formatTime = (timeString: string) => {
  if (timeString.includes('AM') || timeString.includes('PM')) {
    return timeString;
  }
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

// Helper function to get status color
const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
      return '#10B981';
    case 'confirmed':
      return '#3B82F6';
    case 'pending':
      return '#F59E0B';
    case 'cancelled':
      return '#EF4444';
    default:
      return '#6B7280';
  }
};

// Helper function to get status text
const getStatusText = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

// Monotone status icon (consistent with appointments screens)
const getMonotoneStatusIcon = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'confirmed') return <CheckCircle size={16} color="#6B7280" style={{ marginRight: 6 }} />;
  if (s === 'completed') return <CheckCircle size={16} color="#6B7280" style={{ marginRight: 6 }} />;
  if (s === 'cancelled') return <XCircle size={16} color="#6B7280" style={{ marginRight: 6 }} />;
  return <Clock size={16} color="#6B7280" style={{ marginRight: 6 }} />;
};

// Helper to render doctor names consistently with a "Dr." prefix without duplication
const formatDoctorName = (name?: string): string => {
  if (!name || name.trim().length === 0 || name.toLowerCase().includes('unknown')) {
    return 'Unknown Doctor';
  }
  const stripped = name.replace(/^Dr\.?\s+/i, '').trim();
  return `Dr. ${stripped}`;
};

 
// Helper function to format clinic address with fallbacks
const formatClinicAddress = (clinicData: any, fallbackClinicName?: string): string => {
  if (!clinicData) {
    return fallbackClinicName || 'Address not provided';
  }

  // Try to build address from individual components
  const addressParts = [];
  
  // Add street address if available
  if (clinicData.address) {
    addressParts.push(clinicData.address);
  }
  
  // Add city if available
  if (clinicData.city) {
    addressParts.push(clinicData.city);
  }
  
  // Add province/state if available
  if (clinicData.province) {
    addressParts.push(clinicData.province);
  }
  
  // Add zip code if available
  if (clinicData.zipCode) {
    addressParts.push(clinicData.zipCode);
  }
  
  // If we have address parts, join them
  if (addressParts.length > 0) {
    return addressParts.join(', ');
  }
  
  // Fallback to addressLine if available
  if (clinicData.addressLine) {
    return clinicData.addressLine;
  }
  
  // Fallback to clinic name
  if (clinicData.name) {
    return clinicData.name;
  }
  
  // Final fallback
  return fallbackClinicName || 'Address not provided';
};

// Helper function to merge clinic and address
const formatClinicAndAddress = (clinicData: any, fallbackClinicName?: string): string => {
  const clinicName = clinicData?.name || fallbackClinicName || 'Unknown Clinic';
  const address = formatClinicAddress(clinicData, fallbackClinicName);
  
  // If the address is the same as clinic name, just return clinic name
  if (address === clinicName) {
    return clinicName;
  }
  
  // If address contains the clinic name, just return the address
  if (address.includes(clinicName)) {
    return address;
  }
  
  // Otherwise, combine them
  return `${clinicName}, ${address}`;
};

// Helper function to merge specialist clinic and address
const formatSpecialistClinicAndAddress = (clinicData: any, fallbackClinicName?: string): string => {
  const clinicName = clinicData?.name || fallbackClinicName || 'Unknown Clinic';
  const address = formatClinicAddress(clinicData, fallbackClinicName);
  
  // If the address is the same as clinic name, just return clinic name
  if (address === clinicName) {
    return clinicName;
  }
  
  // If address contains the clinic name, just return the address
  if (address.includes(clinicName)) {
    return address;
  }
  
  // Otherwise, combine them
  return `${clinicName}, ${address}`;
};

// Helper function to merge date and time
const formatDateTime = (dateString?: string, timeString?: string): string => {
  if (!dateString && !timeString) {
    return 'Not specified';
  }
  
  const date = dateString ? formatDate(dateString) : '';
  const time = timeString ? formatTime(timeString) : '';
  
  if (date && time) {
    return `${date} at ${time}`;
  } else if (date) {
    return date;
  } else if (time) {
    return time;
  }
  
  return 'Not specified';
};

export default function ReferralDetailsScreen() {
  const { id, isFollowUp, appointmentId, patientId } = useLocalSearchParams();
  const { user } = useAuth();
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [showReasonDropdown, setShowReasonDropdown] = useState(false);
  const [customReason, setCustomReason] = useState('');
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    patientHistory: true,
    findings: true,
    soapNotes: true,
    treatment: true,
  });

  // Check if this is a follow-up appointment
  const isFollowUpAppointment = isFollowUp === 'true';

  // Load referral data from Firebase
  useEffect(() => {
    if (id) {
      loadReferralData();
    }
  }, [id]);

  const loadReferralData = async () => {
    if (!id || !user) return;
    
    try {
      setLoading(true);
      
      let referral;
      
      if (isFollowUpAppointment) {
        // For follow-up appointments, load appointment data instead of referral
        const appointment = await databaseService.getDocument(`appointments/${id}`);
        if (appointment) {
          // Convert appointment to referral-like format for display
          referral = {
            id: appointment.id,
            patientId: appointment.patientId,
            patientFirstName: appointment.patientFirstName,
            patientLastName: appointment.patientLastName,
            appointmentDate: appointment.appointmentDate,
            appointmentTime: appointment.appointmentTime,
            initialReasonForReferral: appointment.appointmentPurpose || 'Follow-up visit',
            generalistNotes: appointment.additionalNotes || '',
            status: appointment.status,
            referringGeneralistFirstName: appointment.originalReferringGeneralistFirstName,
            referringGeneralistLastName: appointment.originalReferringGeneralistLastName,
            referringGeneralistId: appointment.originalReferringGeneralistId,
            referringClinicName: 'Follow-up Request',
            // Add other necessary fields with defaults
            referralTimestamp: appointment.createdAt,
            lastUpdated: appointment.lastUpdated,
            sourceSystem: appointment.sourceSystem || 'UniHealth_Patient_App',
            practiceLocation: {
              clinicId: appointment.clinicId,
              roomOrUnit: ''
            }
          };
        }
      } else {
        // Load referral data normally
        referral = await databaseService.getReferralById(id as string);
      }
      
      if (referral) {
        // Load clinic and doctor data for complete information
        let clinicData = null;
        let referringDoctorData = null;
        let patientData = null;
        let specialistClinicData = null;
        
        try {
          // Handle both generalist and specialist referrals
          const referringDoctorId = referral.referringGeneralistId || referral.referringSpecialistId;
          const referringDoctorNode = referral.referringGeneralistId ? 'specialists' : 'users';
          
          [clinicData, referringDoctorData, patientData] = await Promise.all([
            databaseService.getDocument(`clinics/${referral.referringClinicId}`),
            referringDoctorId ? databaseService.getDocument(`${referringDoctorNode}/${referringDoctorId}`) : null,
            databaseService.getDocument(`users/${referral.patientId}`)
          ]);
        } catch (error) {
          console.log('Could not fetch clinic, doctor, or patient data:', error);
        }
         
                 // Fetch specialist clinic from practiceLocation.clinicId first
         try {
           if (referral.practiceLocation?.clinicId) {
             console.log('🔍 Fetching specialist clinic from practiceLocation.clinicId:', referral.practiceLocation.clinicId);
             specialistClinicData = await databaseService.getDocument(`clinics/${referral.practiceLocation.clinicId}`);
             console.log('🔍 Specialist clinic data:', specialistClinicData);
           }
         } catch (error) {
           console.log('Could not fetch specialist clinic from practiceLocation:', error);
         }

         // Additional: Fetch specialist's assigned clinic (fallback for older referrals)
         if (!specialistClinicData && user?.uid && user?.role === 'specialist') {
           try {
             console.log('🔍 Fetching specialist schedules for logged-in user:', user.uid);
             const specialistSchedules = await databaseService.getDocument(`specialistSchedules/${user.uid}`);
             console.log('🔍 Specialist schedules data:', specialistSchedules);
             
             // Find the schedule that matches the referral's specialistScheduleId
             if (specialistSchedules && referral.specialistScheduleId) {
               const matchingSchedule = specialistSchedules[referral.specialistScheduleId];
               console.log('🔍 Matching schedule for ID:', referral.specialistScheduleId, matchingSchedule);
               
                               if (matchingSchedule) {
                 const practiceLocation = matchingSchedule.practiceLocation;
                 if (practiceLocation && practiceLocation.clinicId) {
                   console.log('🔍 Fetching specialist clinic for ID:', practiceLocation.clinicId);
                   specialistClinicData = await databaseService.getDocument(`clinics/${practiceLocation.clinicId}`);
                   console.log('🔍 Specialist clinic data:', specialistClinicData);
                   
                   // Additional debug logging for specialist clinic
                   console.log('🔍 SPECIALIST CLINIC DEBUG:', {
                     loggedInUserId: user.uid,
                     scheduleId: referral.specialistScheduleId,
                     assignedSpecialistId: matchingSchedule.assignedSpecialistId,
                     practiceLocation: practiceLocation,
                     clinicId: practiceLocation.clinicId,
                     clinicName: specialistClinicData?.name,
                     fullClinicData: specialistClinicData
                   });
                 }
               }
             }
           } catch (error) {
             console.log('Could not fetch specialist schedule or clinic data:', error);
           }
         }
        
        // Additional patient data fetching if the first attempt failed
        if (!patientData && referral.patientId) {
          try {
            console.log('🔍 Retrying patient data fetch for ID:', referral.patientId);
            patientData = await databaseService.getDocument(`users/${referral.patientId}`);
            console.log('🔍 Retry patient data result:', patientData);
          } catch (retryError) {
            console.log('🔍 Retry failed for patient data:', retryError);
          }
        }
        
                 // Load medical history/consultation data if referral is completed
         let medicalHistory = null;
         if (referral.status.toLowerCase() === 'completed' && referral.referralConsultationId) {
           try {
             // Fetch medical history from patientMedicalHistory > patientId > entries > referralConsultationId
             medicalHistory = await databaseService.getDocument(`patientMedicalHistory/${referral.patientId}/entries/${referral.referralConsultationId}`);
             console.log('🔍 Fetched medical history from referralConsultationId:', referral.referralConsultationId, medicalHistory);
           } catch (error) {
             console.log('No medical history found for this referral consultation:', error);
             
             // Fallback: try the old method if referralConsultationId approach fails
             try {
               medicalHistory = await databaseService.getMedicalHistoryByAppointment(referral.clinicAppointmentId, referral.patientId);
               console.log('🔍 Fallback: Fetched medical history using appointment method:', medicalHistory);
             } catch (fallbackError) {
               console.log('Fallback method also failed:', fallbackError);
             }
           }
         }
        
        // Debug logging
        console.log('🔍 REFERRAL DATA:', {
          id: referral.id,
          patientFirstName: referral.patientFirstName,
          patientLastName: referral.patientLastName,
          referringClinicName: referral.referringClinicName,
          initialReasonForReferral: referral.initialReasonForReferral,
          appointmentDate: referral.appointmentDate,
          appointmentTime: referral.appointmentTime
        });
        
        console.log('🔍 CLINIC DATA:', clinicData);
        console.log('🔍 REFERRING DOCTOR DATA:', referringDoctorData);
        console.log('🔍 PATIENT DATA:', patientData);
        console.log('🔍 PATIENT ID:', referral.patientId);
        console.log('🔍 REFERRAL PATIENT NAMES:', {
          firstName: referral.patientFirstName,
          lastName: referral.patientLastName
        });
        
        // Combine referral data with additional fetched data
        const combinedReferralData: ReferralData = {
          ...referral,
          // Patient information - prioritize fetched patient data over referral data
          patientName: (() => {
            // Try to get name from fetched patient data first
            if (patientData) {
              const firstName = patientData.firstName || patientData.first_name || patientData.givenName || '';
              const lastName = patientData.lastName || patientData.last_name || patientData.familyName || '';
              const fullName = `${firstName} ${lastName}`.trim();
              if (fullName) return fullName;
            }
            
            // Fallback to referral data
            if (referral.patientFirstName && referral.patientLastName) {
              return `${referral.patientFirstName} ${referral.patientLastName}`;
            }
            
            // Final fallback
            return 'Unknown Patient';
          })(),
          
          // Referring doctor information
          referringDoctorName: (() => {
            // Handle both generalist and specialist referrals
            if (referral.referringSpecialistId) {
              return referral.referringSpecialistFirstName && referral.referringSpecialistLastName 
                ? `${referral.referringSpecialistFirstName} ${referral.referringSpecialistLastName}` 
                : referringDoctorData 
                  ? `${referringDoctorData.firstName} ${referringDoctorData.lastName}`
                  : 'Unknown Specialist';
            } else {
              return referral.referringGeneralistFirstName && referral.referringGeneralistLastName 
                ? `${referral.referringGeneralistFirstName} ${referral.referringGeneralistLastName}` 
                : referringDoctorData 
                  ? `${referringDoctorData.firstName} ${referringDoctorData.lastName}`
                  : 'Unknown Doctor';
            }
          })(),
          
          // Clinic information
          clinic: clinicData?.name || referral.referringClinicName || 'Unknown Clinic',
          date: referral.appointmentDate,
          time: referral.appointmentTime,
          address: formatClinicAddress(clinicData, clinicData?.name || referral.referringClinicName),
          // Merged fields for display
          clinicAndAddress: formatClinicAndAddress(clinicData, clinicData?.name || referral.referringClinicName),
          dateTime: formatDateTime(referral.appointmentDate, referral.appointmentTime),
          specialistClinic: specialistClinicData?.name || 'Not assigned',
          specialistClinicAndAddress: formatSpecialistClinicAndAddress(specialistClinicData, specialistClinicData?.name || 'Not assigned'),
          
          // Clinical fields from medical history
          presentIllnessHistory: medicalHistory?.presentIllnessHistory || '',
          reviewOfSymptoms: medicalHistory?.reviewOfSymptoms || '',
          labResults: medicalHistory?.labResults || '',
          medications: medicalHistory?.prescriptions ? medicalHistory.prescriptions.map(prescription => `${prescription.medication} ${prescription.dosage}`).join(', ') : '',
          diagnosis: medicalHistory?.diagnosis ? medicalHistory.diagnosis.map(d => d.description).join(', ') : '',
          differentialDiagnosis: medicalHistory?.differentialDiagnosis || '',
          soapNotes: medicalHistory?.soapNotes || {
            subjective: '',
            objective: '',
            assessment: '',
            plan: ''
          },
          treatmentPlan: medicalHistory?.treatmentPlan || '',
          clinicalSummary: medicalHistory?.clinicalSummary || ''
        };
        
        console.log('🔍 FINAL PATIENT NAME:', combinedReferralData.patientName);
        console.log('🔍 FINAL REFERRAL DATA:', combinedReferralData);
        
        setReferralData(combinedReferralData);
        
                 // Load related prescriptions and certificates
         let referralPrescriptions = [];
         let referralCertificates = [];
         
         if (referral.referralConsultationId && medicalHistory) {
           // Extract prescriptions and certificates from the medical history data
           // Build a set of potential specialist/provider IDs to resolve names dynamically
           const potentialIds = new Set<string>();
           const providerId = (medicalHistory as any)?.provider?.userId || (medicalHistory as any)?.provider?.id;
           if (providerId) potentialIds.add(String(providerId));
           (medicalHistory.prescriptions || []).forEach((pr: any) => {
             if (pr?.specialistId) potentialIds.add(String(pr.specialistId));
           });
           if ((referral as any)?.assignedSpecialistId) potentialIds.add(String((referral as any).assignedSpecialistId));

           // Fetch names for all potential IDs (specialists preferred, fallback to users)
           const idList = Array.from(potentialIds);
           const profiles = await Promise.all(idList.map(async (specId) => {
             let profile = await databaseService.getDocument(`specialists/${specId}`);
             if (!profile) {
               profile = await databaseService.getDocument(`users/${specId}`);
             }
             return { id: specId, profile };
           }));

           const idToName: Record<string, string> = {};
           profiles.forEach(({ id, profile }) => {
             const name = profile
               ? `${profile.firstName || profile.first_name || ''} ${profile.lastName || profile.last_name || ''}`.trim()
               : '';
             idToName[id] = name || 'Unknown Doctor';
           });

           // Compute fallback names
           const assignedSpecialistName = ((referral as any)?.assignedSpecialistFirstName || (referral as any)?.assignedSpecialistLastName)
             ? `${(referral as any)?.assignedSpecialistFirstName || ''} ${(referral as any)?.assignedSpecialistLastName || ''}`.trim()
             : undefined;
           const resolvedProviderName = (providerId && idToName[providerId])
             ? idToName[providerId]
             : (assignedSpecialistName || 'Unknown Doctor');

           // Map prescriptions, deriving prescribedBy from prescription specialistId -> fetched name,
           // then provider, then assigned specialist
           referralPrescriptions = (medicalHistory.prescriptions || []).map((prescription: any, index: number) => {
             const prescriberFromId = prescription?.specialistId ? idToName[String(prescription.specialistId)] : undefined;
             return {
               id: `${referral.referralConsultationId || 'mh'}-${index}`,
               ...prescription,
               prescribedBy: prescription.prescribedBy || prescriberFromId || resolvedProviderName,
             };
           });
           referralCertificates = (medicalHistory.certificates || []).map((certificate: any, index: number) => {
             // Get the issuing doctor from the certificate or fallback to the provider/specialist
             const issuingDoctor = certificate.doctor || certificate.prescribedBy || certificate.specialistName || 
               (providerId && idToName[providerId]) || assignedSpecialistName || 'Unknown Doctor';
             
             return {
               id: certificate.id || `${referral.referralConsultationId || 'mh'}-cert-${index}`,
               ...certificate,
               doctor: issuingDoctor,
               // Ensure we have a proper date field
               issuedDate: certificate.issuedDate || certificate.createdAt || certificate.consultationDate
             };
           });
           console.log('🔍 Extracted prescriptions and certificates from medical history:', {
             prescriptions: referralPrescriptions.length,
             certificates: referralCertificates.length
           });
         } else {
           // Fallback: try using appointment method
           try {
             [referralPrescriptions, referralCertificates] = await Promise.all([
               databaseService.getPrescriptionsByAppointment(referral.clinicAppointmentId),
               databaseService.getCertificatesByAppointment(referral.clinicAppointmentId)
             ]);
             console.log('🔍 Fallback: Fetched prescriptions and certificates using appointment method');

             // Enrich prescriptions with specialist names from DB
             const uniqueSpecialistIds = Array.from(new Set((referralPrescriptions || [])
               .map((p: any) => p.specialistId)
               .filter(Boolean)));

             const specialistProfiles = await Promise.all(uniqueSpecialistIds.map(async (specId) => {
               let profile = await databaseService.getDocument(`specialists/${specId}`);
               if (!profile) {
                 profile = await databaseService.getDocument(`users/${specId}`);
               }
               return { id: specId, profile };
             }));

             const specialistIdToName: Record<string, string> = {};
             specialistProfiles.forEach(({ id, profile }) => {
               const name = profile
                 ? `${profile.firstName || profile.first_name || ''} ${profile.lastName || profile.last_name || ''}`.trim()
                 : '';
               specialistIdToName[id] = name || 'Unknown Doctor';
             });

             referralPrescriptions = (referralPrescriptions || []).map((p: any, index: number) => ({
               id: p.id || `${referral.clinicAppointmentId || 'appt'}-${index}`,
               ...p,
               prescribedBy: p.prescribedBy || specialistIdToName[p.specialistId] || (
                 ((referral as any)?.assignedSpecialistFirstName || (referral as any)?.assignedSpecialistLastName)
                   ? `${(referral as any)?.assignedSpecialistFirstName || ''} ${(referral as any)?.assignedSpecialistLastName || ''}`.trim()
                   : 'Unknown Doctor'
               )
             }));
             
             // Enrich certificates with specialist names
             referralCertificates = (referralCertificates || []).map((cert: any, index: number) => {
               const issuingDoctor = cert.doctor || cert.prescribedBy || cert.specialistName || 
                 (cert.specialistId && specialistIdToName[cert.specialistId]) || 
                 ((referral as any)?.assignedSpecialistFirstName && (referral as any)?.assignedSpecialistLastName
                   ? `${(referral as any)?.assignedSpecialistFirstName || ''} ${(referral as any)?.assignedSpecialistLastName || ''}`.trim()
                   : 'Unknown Doctor');
               
               return {
                 id: cert.id || `${referral.clinicAppointmentId || 'appt'}-cert-${index}`,
                 ...cert,
                 doctor: issuingDoctor,
                 // Ensure we have a proper date field
                 issuedDate: cert.issuedDate || cert.createdAt || cert.consultationDate
               };
             });
           } catch (fallbackError) {
             console.log('Fallback method also failed for prescriptions/certificates:', fallbackError);
           }
         }
         
         setPrescriptions(referralPrescriptions);
         setCertificates(referralCertificates);
         
         // Debug: Log the processed certificates
         console.log('🔍 Processed certificates:', referralCertificates.map(cert => ({
           id: cert.id,
           type: cert.type,
           doctor: cert.doctor,
           issuedDate: cert.issuedDate,
           createdAt: cert.createdAt
         })));
      }
    } catch (error) {
      console.error('Error loading referral data:', error);
      Alert.alert('Error', 'Failed to load referral data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReferralData();
    setRefreshing(false);
  };

  const isPending = (referralData?.status || '').toLowerCase() === 'pending' || (referralData?.status || '').toLowerCase() === 'pending_acceptance';
  const isConfirmed = (referralData?.status || '').toLowerCase() === 'confirmed';

  // Accept referral
  const handleAcceptReferral = async () => {
    if (!referralData?.id) return;
    try {
      await databaseService.updateReferralStatus(referralData.id, 'confirmed');
      Alert.alert('Success', 'Referral confirmed successfully!');
      await loadReferralData();
    } catch (error) {
      Alert.alert('Error', 'Failed to accept referral. Please try again.');
    }
  };

  // Decline referral
  const handleDeclineReferral = async () => {
    setShowDeclineModal(true);
  };

  const submitDeclineReferral = async () => {
    if (!referralData?.id) return;
    const finalReason = declineReason === 'Other (specify)' ? customReason : declineReason;
    if (!finalReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for declining.');
      return;
    }
    try {
      await databaseService.updateReferralStatus(referralData.id, 'cancelled', finalReason);
      Alert.alert('Success', 'Referral declined successfully!');
      setShowDeclineModal(false);
      setDeclineReason('');
      setCustomReason('');
      await loadReferralData();
    } catch (error) {
      Alert.alert('Error', 'Failed to decline referral. Please try again.');
    }
  };

  const toggleSection = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading referral data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!referralData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Referral not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Compute avatar initials based on role
  const isPatientUser = user?.role === 'patient';
  const specialistName = `${(referralData as any)?.assignedSpecialistFirstName || ''} ${(referralData as any)?.assignedSpecialistLastName || ''}`.trim();
  const patientNameFromFields = `${(referralData as any)?.patientFirstName || ''} ${(referralData as any)?.patientLastName || ''}`.trim();
  const displayPatientName = referralData.patientName || patientNameFromFields;
  const avatarName = (isPatientUser ? specialistName : displayPatientName) || 'User';
  const avatarInitials = avatarName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'U';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#1E40AF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isFollowUpAppointment ? 'Follow-up Details' : 'Referral Details'}
          </Text>
        </View>

        {/* --- REFERRAL DETAILS --- */}
        <View style={styles.sectionSpacing}>
          <Text style={styles.sectionTitle}>
            {isFollowUpAppointment ? 'Follow-up Information' : 'Referral Information'}
          </Text>
          <View style={styles.cardBox}>
            {/* Avatar initials (top-left) */}
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{avatarInitials}</Text>
            </View>
            {/* Fixed Status Badge (top-right) - Monotone with icon */}
            <View style={[styles.statusBadge, styles.statusBadgeFixed, styles.statusBadgeNeutral]}> 
              {getMonotoneStatusIcon(referralData.status)}
              <Text style={styles.statusTextNeutral}>{getStatusText(referralData.status)}</Text>
            </View>
            
            <View style={styles.referralDetailsTable}>
              {user?.role === 'patient' ? (
                <View style={styles.referralDetailsRow}>
                  <Text style={styles.referralLabel}>Specialist</Text>
                  <Text style={styles.referralValue}>
                    {(referralData as any)?.assignedSpecialistFirstName || (referralData as any)?.assignedSpecialistLastName
                      ? `${(referralData as any)?.assignedSpecialistFirstName || ''} ${(referralData as any)?.assignedSpecialistLastName || ''}`.trim()
                      : 'Not assigned'}
                  </Text>
                </View>
              ) : (
                <View style={styles.referralDetailsRow}>
                  <Text style={styles.referralLabel}>Patient</Text>
                  <Text style={styles.referralValue}>{referralData.patientName || 'Unknown Patient'}</Text>
                </View>
              )}
              {!isFollowUpAppointment && (
                <View style={styles.referralDetailsRowWrapped}>
                  <Text style={styles.referralLabel}>Specialist Clinic</Text>
                  <Text style={styles.referralValueWrapped}>{referralData.specialistClinicAndAddress || 'Not assigned'}</Text>
                </View>
              )}
              {referralData.practiceLocation?.roomOrUnit && (
                <View style={styles.referralDetailsRow}>
                  <Text style={styles.referralLabel}>Room/Unit</Text>
                  <Text style={styles.referralValue}>{referralData.practiceLocation.roomOrUnit}</Text>
                </View>
              )}
              {!isFollowUpAppointment && (
                <View style={styles.referralDetailsRow}>
                  <Text style={styles.referralLabel}>
                    {(referralData as any)?.referringSpecialistId ? 'Referring Specialist' : 'Referring Generalist'}
                  </Text>
                  <Text style={styles.referralValue}>{referralData.referringDoctorName || 'Unknown Doctor'}</Text>
                </View>
              )}
              {!isFollowUpAppointment && (
                <View style={styles.referralDetailsRowWrapped}>
                  <Text style={styles.referralLabel}>
                    {(referralData as any)?.referringSpecialistId ? 'Referring Specialist Clinic' : 'Generalist Clinic'}
                  </Text>
                  <Text style={styles.referralValueWrapped}>{referralData.clinicAndAddress || 'Unknown Clinic'}</Text>
                </View>
              )}
              <View style={styles.referralDetailsRow}>
                <Text style={styles.referralLabel}>Date</Text>
                <Text style={styles.referralValue}>
                  {referralData.date ? formatDate(referralData.date) : 'Not specified'}
                </Text>
              </View>
              <View style={styles.referralDetailsRow}>
                <Text style={styles.referralLabel}>Time</Text>
                <Text style={styles.referralValue}>
                  {referralData.time ? formatTime(referralData.time) : 'Not specified'}
                </Text>
              </View>
              {/* {!isFollowUpAppointment && (
                <View style={styles.referralDetailsRowWrapped}>
                  <Text style={styles.referralLabel}>Specialist Clinic</Text>
                  <Text style={styles.referralValueWrapped}>{referralData.specialistClinicAndAddress || 'Not assigned'}</Text>
                </View>
              )}
              {referralData.practiceLocation?.roomOrUnit && (
                <View style={styles.referralDetailsRow}>
                  <Text style={styles.referralLabel}>Room/Unit</Text>
                  <Text style={styles.referralValue}>{referralData.practiceLocation.roomOrUnit}</Text>
                </View>
              )} */}
              <View style={styles.referralDetailsRowNoBorder}>
                <Text style={styles.referralLabel}>
                  {isFollowUpAppointment ? 'Additional Notes' : 'Reason for Referral'}
                </Text>
                <Text style={styles.referralValue}>
                  {isFollowUpAppointment 
                    ? (referralData.generalistNotes || 'No additional notes')
                    : ((referralData as any)?.referringSpecialistId 
                        ? (referralData.additionalNotes || 'Not specified')
                        : (referralData.initialReasonForReferral || 'Not specified')
                      )
                  }
                </Text>
              </View>
              {!isFollowUpAppointment && referralData.generalistNotes && (
                <View style={styles.referralDetailsRowNoBorder}>
                  <Text style={styles.referralLabel}>Generalist Notes</Text>
                  <Text style={styles.referralValueNotes}>{referralData.generalistNotes}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* --- CLINICAL SUMMARY (moved above Prescriptions) --- */}
        <View style={[styles.sectionSpacing, { marginBottom: 20 }]}>
          <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>Clinical Summary</Text>
          {referralData.status.toLowerCase() !== 'completed' ? (
            <View style={styles.emptyStateCard}>
              <FileText size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>Consultation details unavailable</Text>
              <Text style={styles.emptyStateDescription}>
                Consultation details will be available after the referral is completed.
              </Text>
            </View>
          ) : (
            <View style={styles.cardBoxClinical}>
            {/* Step 1: Patient History */}
            <TouchableOpacity style={styles.clinicalSectionHeader} onPress={() => toggleSection('patientHistory')}>
              <Text style={styles.clinicalSectionLabel}>Patient History</Text>
              {expandedSections['patientHistory'] ? (
                <ChevronDown size={23} color="#6B7280" />
              ) : (
                <ChevronRight size={23} color="#9CA3AF" />
              )}
            </TouchableOpacity>
            {expandedSections['patientHistory'] && (
              <View style={styles.clinicalSectionBody}>
                <Text style={styles.fieldLabel}>History of Present Illnesses</Text>
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldValue}>{referralData.presentIllnessHistory || 'No illness history recorded'}</Text>
                </View>
                <Text style={styles.fieldLabel}>Review of Symptoms</Text>
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldValue}>{referralData.reviewOfSymptoms || 'No symptoms reviewed'}</Text>
                </View>
              </View>
            )}

            {/* Step 2: Findings */}
            <TouchableOpacity style={styles.clinicalSectionHeader} onPress={() => toggleSection('findings')}>
              <Text style={styles.clinicalSectionLabel}>Findings</Text>
              {expandedSections['findings'] ? (
                <ChevronDown size={23} color="#6B7280" />
              ) : (
                <ChevronRight size={23} color="#9CA3AF" />
              )}
            </TouchableOpacity>
            {expandedSections['findings'] && (
              <View style={styles.clinicalSectionBody}>
                <Text style={styles.fieldLabel}>Lab Results</Text>
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldValue}>{referralData.labResults || 'No lab results recorded'}</Text>
                </View>
                <Text style={styles.fieldLabel}>Medications</Text>
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldValue}>{referralData.medications || 'No medications recorded'}</Text>
                </View>
                <Text style={styles.fieldLabel}>Diagnosis</Text>
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldValue}>{referralData.diagnosis || 'No diagnosis recorded'}</Text>
                </View>
                <Text style={styles.fieldLabel}>Differential Diagnosis</Text>
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldValue}>{referralData.differentialDiagnosis || 'No differential diagnosis recorded'}</Text>
                </View>
              </View>
            )}

              {/* SOAP Notes */}
              <TouchableOpacity style={styles.clinicalSectionHeader} onPress={() => toggleSection('soapNotes')}>
                <Text style={styles.clinicalSectionLabel}>SOAP Notes</Text>
                {expandedSections['soapNotes'] ? (
                  <ChevronDown size={23} color="#6B7280" />
                ) : (
                  <ChevronRight size={23} color="#9CA3AF" />
                )}
              </TouchableOpacity>
              {expandedSections['soapNotes'] && (
                <View style={styles.clinicalSectionBody}>
                  <Text style={styles.fieldLabel}>Subjective</Text>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldValue}>{referralData.soapNotes?.subjective || 'No subjective notes'}</Text>
                  </View>
                  <Text style={styles.fieldLabel}>Objective</Text>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldValue}>{referralData.soapNotes?.objective || 'No objective notes'}</Text>
                  </View>
                  <Text style={styles.fieldLabel}>Assessment</Text>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldValue}>{referralData.soapNotes?.assessment || 'No assessment notes'}</Text>
                  </View>
                  <Text style={styles.fieldLabel}>Plan</Text>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldValue}>{referralData.soapNotes?.plan || 'No plan notes'}</Text>
                  </View>
                </View>
              )}

              {/* Treatment & Wrap-Up */}
              <TouchableOpacity style={styles.clinicalSectionHeader} onPress={() => toggleSection('treatment')}>
                <Text style={styles.clinicalSectionLabel}>Treatment & Wrap-Up</Text>
                {expandedSections['treatment'] ? (
                  <ChevronDown size={23} color="#6B7280" />
                ) : (
                  <ChevronRight size={23} color="#9CA3AF" />
                )}
              </TouchableOpacity>
              {expandedSections['treatment'] && (
                <View style={styles.clinicalSectionBody}>
                  <Text style={styles.fieldLabel}>Treatment Plan</Text>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldValue}>{referralData.treatmentPlan || 'No treatment plan recorded'}</Text>
                  </View>
                  <Text style={styles.fieldLabel}>Clinical Summary</Text>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldValue}>{referralData.clinicalSummary || 'No clinical summary recorded'}</Text>
                  </View>
                </View>
              )}

            </View>
          )}
        </View>

        {/* --- PRESCRIPTIONS (moved below Clinical Summary) --- */}
        <View style={[styles.sectionSpacing, { marginBottom: 20 }]}>
          <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>Prescriptions</Text>
          {referralData.status.toLowerCase() === 'completed' && prescriptions.length ? prescriptions.map((p, idx) => (
            <View key={p.id || idx} style={[styles.cardBox, styles.cardBoxPrescription]}>
              <View style={styles.prescriptionHeader}>
                <View style={[styles.medicationIcon, styles.medicationIconBlue]}>
                  <Pill size={20} color="#FFFFFF" />
                </View>
                <View style={styles.prescriptionDetails}>
                  <Text style={styles.medicationName}>{p.medication || 'Unknown Medication'}</Text>
                  <Text style={styles.medicationDosage}>
                    {p.dosage || 'N/A'} • {formatFrequency(p.frequency, 'specialist')}
                    {p.route && ` • ${formatRoute(p.route, 'specialist')}`}
                    {p.formula && ` • ${formatFormula(p.formula, 'specialist')}`}
                    {p.duration && ` • ${p.duration}`}
                  </Text>
                </View>
                {/* <View style={styles.prescriptionStatus}>
                  <Text style={styles.remainingDays}>{p.remaining}</Text>
                  <Text style={styles.remainingLabel}>remaining</Text>
                </View> */}
              </View>
              <View style={styles.prescriptionMeta}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Prescribed by:</Text>
                  <Text style={styles.metaValue}>{formatDoctorName(p.prescribedBy)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Description:</Text>
                  <Text style={styles.metaValue}>{p.description || 'No description provided'}</Text>
                </View>
              </View>
            </View>
          )) : referralData.status.toLowerCase() === 'completed' ? (
            <View style={styles.emptyStateCard}>
              <Pill size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>No Prescriptions</Text>
              <Text style={styles.emptyStateDescription}>No prescriptions for this referral.</Text>
            </View>
          ) : (
            <View style={styles.emptyStateCard}>
              <Pill size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>Prescriptions unavailable</Text>
              <Text style={styles.emptyStateDescription}>Prescriptions will be available after the referral is completed.</Text>
            </View>
          )}
        </View>

        {/* --- MEDICAL CERTIFICATES --- */}
        <View style={[styles.sectionSpacing, { marginBottom: 20 }]}>
          <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>Medical Certificates</Text>
          {referralData.status.toLowerCase() === 'completed' && certificates.length ? certificates.map((cert) => {
            const statusStyle = getCertStatusStyles(cert.status);
            // Get the issuing doctor from the certificate data or fallback to the assigned specialist
            const issuingDoctor = cert.doctor || cert.prescribedBy || cert.specialistName || 
              ((referralData as any)?.assignedSpecialistFirstName && (referralData as any)?.assignedSpecialistLastName
                ? `${(referralData as any).assignedSpecialistFirstName} ${(referralData as any).assignedSpecialistLastName}`
                : 'Unknown Doctor');
            
            return (
              <View key={cert.id} style={[styles.cardBox, styles.cardBoxCertificate]}>
                <View style={styles.certificateIconTitleRow}>
                  <View style={styles.uniformIconCircle}>
                    <FileText size={20} color="#1E3A8A" />
                  </View>
                  <Text style={styles.certificateType}>{cert.type || 'Unknown Type'}</Text>
                  <View style={[styles.certificateStatus, statusStyle.container]}>
                    {statusStyle.icon}
                    <Text style={[styles.certificateStatusText, statusStyle.text]}>
                      {statusStyle.label}
                    </Text>
                  </View>
                </View>
                <View style={styles.certificateDivider} />
                <View style={styles.certificateInfoRow}>
                  <Text style={styles.certificateLabel}>Issued by:</Text>
                  <Text style={styles.certificateInfoValue}>{issuingDoctor}</Text>
                </View>
                <View style={styles.certificateInfoRow}>
                  <Text style={styles.certificateLabel}>Issued on:</Text>
                  <Text style={styles.certificateInfoValue}>{cert.issuedDate ? formatDate(cert.issuedDate) : 'Not specified'}</Text>
                </View>
                <View style={styles.certificateActions}>
                  <TouchableOpacity 
                    style={[styles.secondaryButton, { marginRight: 9 }]}
                    onPress={() => {
                      // Route to the corresponding certificate screen based on type
                      const certificateType = cert.type?.toLowerCase();
                      if (certificateType?.includes('fit to work')) {
                        router.push({
                          pathname: '/e-certificate-fit-to-work',
                          params: { 
                            certificateId: cert.id,
                            consultationId: referralData.referralConsultationId || '',
                            referralId: String(id),
                            patientId: referralData.patientId || ''
                          }
                        });
                      } else if (certificateType?.includes('medical') || certificateType?.includes('sickness')) {
                        router.push({
                          pathname: '/e-certificate-medical-sickness',
                          params: { 
                            certificateId: cert.id,
                            consultationId: referralData.referralConsultationId || '',
                            referralId: String(id),
                            patientId: referralData.patientId || ''
                          }
                        });
                      } else if (certificateType?.includes('fit to travel')) {
                        router.push({
                          pathname: '/e-certificate-fit-to-travel',
                          params: { 
                            certificateId: cert.id,
                            consultationId: referralData.referralConsultationId || '',
                            referralId: String(id),
                            patientId: referralData.patientId || ''
                          }
                        });
                      } else {
                        // Fallback for unknown certificate types
                        router.push({
                          pathname: '/e-certificate-fit-to-work',
                          params: { 
                            certificateId: cert.id,
                            consultationId: referralData.referralConsultationId || '',
                            referralId: String(id),
                            patientId: referralData.patientId || ''
                          }
                        });
                      }
                    }}
                  >
                    <Eye size={18} color="#374151" />
                    <Text style={styles.secondaryButtonText}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.primaryButton}>
                    <Download size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Download</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }) : referralData.status.toLowerCase() === 'completed' ? (
            <View style={styles.emptyStateCard}>
              <FileText size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>No Certificates</Text>
              <Text style={styles.emptyStateDescription}>No certificates were issued for this referral.</Text>
            </View>
          ) : (
            <View style={styles.emptyStateCard}>
              <FileText size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>Certificates unavailable</Text>
              <Text style={styles.emptyStateDescription}>Certificates will be available after the referral is completed.</Text>
            </View>
          )}
        </View>
        </ScrollView>

      {/* --- BOTTOM ACTION BAR --- */}
      {(referralData.status.toLowerCase() === 'completed' || isPending || isConfirmed) && (
        <View style={styles.buttonBarVertical}>
          {isPending ? (
            <View>
              <TouchableOpacity
                style={styles.primaryBottomButton}
                onPress={handleAcceptReferral}
                activeOpacity={0.8}
              >
                <Check size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBottomButtonText}>Accept Referral</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBottomButtonOutline}
                onPress={handleDeclineReferral}
                activeOpacity={0.8}
              >
                <X size={18} color="#1E40AF" style={{ marginRight: 8 }} />
                <Text style={styles.secondaryBottomButtonOutlineText}>Decline Referral</Text>
              </TouchableOpacity>
            </View>
          ) : referralData.status.toLowerCase() === 'completed' ? (
            <View>
              <TouchableOpacity
                style={styles.primaryBottomButton}
                onPress={() => {
                  router.push({ pathname: '/consultation-report', params: { id: String(id) } });
                }}
                activeOpacity={0.8}
              >
                <Download size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBottomButtonText}>Generate Visit Report</Text>
              </TouchableOpacity>
              {user?.role !== 'specialist' && (
                <TouchableOpacity
                  style={styles.secondaryBottomButtonOutline}
                  onPress={() => {
                    alert('Referral details hidden');
                  }}
                  activeOpacity={0.8}
                >
                  <Eye size={18} color="#1E40AF" style={{ marginRight: 8 }} />
                  <Text style={styles.secondaryBottomButtonOutlineText}>Hide Referral Details</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : isConfirmed ? (
            <View>
              <TouchableOpacity
                style={styles.primaryBottomButton}
                onPress={() => {
                  // Navigate to patient consultation using referral context
                  router.push({
                    pathname: '/patient-consultation',
                    params: {
                      patientId: referralData?.patientId || '',
                      referralId: String(id || referralData?.id || ''),
                      appointmentId: isFollowUpAppointment ? String(appointmentId) : undefined,
                    },
                  });
                }}
                activeOpacity={0.8}
              >
                <Stethoscope size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBottomButtonText}>Diagnose Patient</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      )}

      {/* Decline Referral Modal */}
      <Modal
        visible={showDeclineModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeclineModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Decline Referral</Text>
              <Text style={styles.modalSubtitle}>Please select a reason for declining</Text>

              <View style={styles.reasonContainer}>
                <TouchableOpacity
                  style={styles.reasonDropdown}
                  onPress={() => setShowReasonDropdown((v) => !v)}
                >
                  <Text style={[styles.reasonText, !declineReason && styles.reasonPlaceholder]}>
                    {declineReason || 'Select reason'}
                  </Text>
                  <ChevronIcon size={20} color="#6B7280" />
                </TouchableOpacity>
                {showReasonDropdown && (
                  <View style={styles.reasonDropdownMenu}>
                    {['Schedule conflict','Patient needs different specialist','Insufficient information provided','Outside my area of expertise','Clinic capacity full','Other (specify)'].map((reason) => (
                      <TouchableOpacity
                        key={reason}
                        style={styles.reasonDropdownItem}
                        onPress={() => {
                          setDeclineReason(reason);
                          setShowReasonDropdown(false);
                        }}
                      >
                        <Text style={styles.reasonDropdownText}>{reason}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {declineReason === 'Other (specify)' && (
                <View style={styles.customReasonContainer}>
                  <Text style={styles.customReasonLabel}>Please specify:</Text>
                  <TextInput
                    style={styles.customReasonInput}
                    placeholder="Enter your reason..."
                    placeholderTextColor="#9CA3AF"
                    value={customReason}
                    onChangeText={setCustomReason}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowDeclineModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitButton, { backgroundColor: '#EF4444' }]}
                  onPress={submitDeclineReferral}
                  disabled={!declineReason || (declineReason === 'Other (specify)' && !customReason.trim())}
                >
                  <Text style={styles.modalSubmitText}>Submit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
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
  scrollView: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: HORIZONTAL_MARGIN,
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    position: 'relative',
  },
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 21,
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
    zIndex: 0,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    zIndex: 1,
  },
  sectionSpacing: {
    marginHorizontal: HORIZONTAL_MARGIN,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 19,
    color: '#1F2937',
    fontFamily: 'Inter-Bold',
    marginBottom: 20,
    letterSpacing: 0.15,
  },
  statusSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadgeFixed: {
    position: 'absolute',
    right: 16,
    top: 16,
    alignSelf: 'flex-end',
    zIndex: 10,
  },
  statusText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  statusBadgeNeutral: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  statusTextNeutral: {
    color: '#374151',
    fontSize: 13.5,
    fontFamily: 'Inter-SemiBold',
  },

  // === Improved Card for Clinical Summary ===
  cardBoxClinical: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },
  clinicalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: 'transparent',
    marginBottom: 0,
    marginTop: 4,
  },
  clinicalSectionHeaderOpen: {
    backgroundColor: 'transparent',
  },
  clinicalSectionLabel: {
    fontSize: 16, 
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.05,
  },
  clinicalSectionBody: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  // Field-like containers to match SignIn input styling
  fieldContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 6,
  },
  fieldValue: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    lineHeight: 24,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 18,
    marginVertical: 2,
  },

  // ---- Referral cards ----
  cardBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    paddingTop: 84,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },
  // Compact variant for prescription cards to remove large top spacing
  cardBoxPrescription: {
    paddingTop: 16,
  },
  // Compact variant for certificate cards to remove large top spacing
  cardBoxCertificate: {
    paddingTop: 16, // Use normal padding instead of the large 84px padding
  },
  referralDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  referralDetailsTable: {
    marginTop: 2,
  },
  referralDetailsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 2,
    minHeight: 38,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  referralDetailsRowNoBorder: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 2,
    minHeight: 38,
  },
  referralDetailsRowWrapped: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 2,
    minHeight: 38,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  referralLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
    flex: 1.1,
  },
  referralValue: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter-Regular',
    flex: 2,
    textAlign: 'right',
    textAlignVertical: 'top',
    lineHeight: 19,
  },
  wrappedText: {
    flexWrap: 'wrap',
    textAlign: 'left',
  },
  referralValueWrapped: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter-Regular',
    flex: 2,
    textAlign: 'right',
    lineHeight: 25,
    textAlignVertical: 'top',
  },
  // Avatar styles
  avatarCircle: {
    position: 'absolute',
    left: 16,
    top: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  emptyStateCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  referralValueNotes: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter-Regular',
    flex: 2,
    textAlign: 'right',
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: 18,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },

  // ------- BOTTOM BAR BUTTONS (VERTICAL, OUTLINED SECONDARY) --------
  buttonBarVertical: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: HORIZONTAL_MARGIN,
    paddingBottom: Platform.OS === 'ios' ? 26 : 18,
    paddingTop: 18,
  },
  // Modal styles reused from specialist appointments for consistency
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  reasonContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  reasonDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reasonText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  reasonPlaceholder: {
    color: '#9CA3AF',
  },
  reasonDropdownMenu: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    zIndex: 10,
    maxHeight: 200,
  },
  reasonDropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  reasonDropdownText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  customReasonContainer: {
    marginBottom: 16,
  },
  customReasonLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  customReasonInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    minHeight: 80,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  primaryBottomButton: {
    width: '100%',
    backgroundColor: '#1E40AF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    paddingVertical: 15,
    marginBottom: 11,
  },
  primaryBottomButtonText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.2,
  },
  secondaryBottomButtonOutline: {
    width: '100%',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    paddingVertical: 15,
    borderWidth: 1.5,
    borderColor: '#1E40AF',
  },
  secondaryBottomButtonOutlineText: {
    color: '#1E40AF',
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.2,
  },

  // ---- Prescription styles ----
  prescriptionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  medicationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  medicationIconBlue: {
    backgroundColor: '#1E40AF',
  },
  prescriptionDetails: { flex: 1 },
  medicationName: {
    fontSize: 16,
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 2,
  },
  medicationDosage: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 1,
    fontFamily: 'Inter-Regular',
  },
  prescriptionDescription: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  prescriptionStatus: {
    alignItems: 'flex-end',
  },
  remainingDays: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
  },
  remainingLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  prescriptionMeta: {
    marginBottom: 6,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  metaLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  metaValue: {
    fontSize: 13,
    color: '#374151',
    fontFamily: 'Inter-Regular',
  },

  // ---- Certificate styles ----
  certificateIconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  uniformIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  certificateType: {
    fontSize: 16,
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
    flex: 1,
  },
  certificateStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    marginLeft: 7,
    minWidth: 76,
    justifyContent: 'center',
  },
  certificateStatusText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  certificateDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 9,
  },
  certificateInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  certificateLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
    minWidth: 80,
  },
  certificateInfoValue: {
    fontSize: 13,
    color: '#1F2937',
    flex: 1,
    textAlign: 'right',
    fontFamily: 'Inter-Regular',
  },
  certificateActions: {
    flexDirection: 'row',
    marginTop: 13,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginLeft: 9,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'center',
    marginRight: 0,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    marginLeft: 3,
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    marginLeft: 3,
  },
});

function getCertStatusStyles(status: string) {
  const mainBlue = '#1E3A8A';
  if (status === 'Valid') {
    return {
      container: {
        backgroundColor: '#EFF6FF',
        borderColor: mainBlue,
      },
      icon: <CheckCircle size={17} color={mainBlue} style={{ marginRight: 4 }} />,
      text: { color: mainBlue },
      label: 'Valid',
    };
  }
  return {
    container: {
      backgroundColor: '#FEF2F2',
      borderColor: '#EF4444',
    },
    icon: <XCircle size={17} color="#EF4444" style={{ marginRight: 4 }} />,
    text: { color: '#EF4444' },
    label: 'Expired',
  };
}
