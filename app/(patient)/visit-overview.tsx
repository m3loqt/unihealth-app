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
  Clock,
  MoreHorizontal,
  Stethoscope,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/hooks/auth/useAuth';
import { databaseService, Appointment, Prescription, Certificate, MedicalHistory } from '../../src/services/database/firebase';
import { safeDataAccess } from '../../src/utils/safeDataAccess';
import { formatRoute, formatFrequency, formatFormula } from '../../src/utils/formatting';
import { usePdfDownload } from '../../src/hooks/usePdfDownload';
import { generateVisitRecordPdf } from '../../src/utils/pdfTemplate';

// Extended interface for visit data that includes additional properties
interface VisitData extends Appointment {
  doctorName?: string;
  doctorPhoto?: string;
  doctorSpecialty?: string;
  clinic?: string;
  date?: string;
  time?: string;
  address?: string;
  // Step 1: Patient History
  presentIllnessHistory?: string;
  reviewOfSymptoms?: string;
  
  // Step 2: Findings
  labResults?: string;
  medications?: string;
  diagnosis?: string;
  differentialDiagnosis?: string;
  
  // Step 3: SOAP Notes
  soapNotes?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  
  // Step 4: Treatment & Wrap-Up
  treatmentPlan?: string;
  clinicalSummary?: string;
  
}

// Extended interface for prescriptions that includes additional properties
interface ExtendedPrescription extends Prescription {
  color?: string;
  description?: string;
  remaining?: string;
  prescribedBy?: string;
  nextRefill?: string;
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const HORIZONTAL_MARGIN = 24;

// Helper function to format date (matching referral details implementation)
const formatDate = (dateString: string) => {
  console.log('🔍 VISIT OVERVIEW - formatDate called with:', {
    input: dateString,
    type: typeof dateString,
    length: dateString?.length
  });
  
  try {
    // Handle DD/MM/YYYY format
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      const result = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      console.log('🔍 VISIT OVERVIEW - DD/MM/YYYY format result:', result);
      return result;
    }
    
    // Handle YYYY-MM-DD format (original logic)
    if (dateString.includes('-')) {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const result = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      console.log('🔍 VISIT OVERVIEW - YYYY-MM-DD format result:', result);
      return result;
    }
    
    // Fallback to native Date parsing
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const result = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      console.log('🔍 VISIT OVERVIEW - Native parsing result:', result);
      return result;
    }
    
    console.log('🔍 VISIT OVERVIEW - All parsing methods failed, returning Invalid date');
    return 'Invalid date';
  } catch (error) {
    console.log('🔍 VISIT OVERVIEW - formatDate error:', error);
    return 'Invalid date';
  }
};

// Helper function to format time
const formatTime = (timeString: string) => {
  return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
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

// Monotone status icon (consistent with patient referral UI)
const getMonotoneStatusIcon = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'confirmed') return <CheckCircle size={16} color="#6B7280" style={{ marginRight: 6 }} />;
  if (s === 'completed') return <CheckCircle size={16} color="#6B7280" style={{ marginRight: 6 }} />;
  if (s === 'cancelled') return <XCircle size={16} color="#6B7280" style={{ marginRight: 6 }} />;
  return <Clock size={16} color="#6B7280" style={{ marginRight: 6 }} />;
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

const formatDoctorName = (name?: string): string => {
  if (!name || name.trim().length === 0 || name.toLowerCase().includes('unknown')) {
    return 'Unknown Doctor';
  }
  const stripped = name.replace(/^Dr\.?\s+/i, '').trim();
  return `Dr. ${stripped}`;
};

export default function VisitOverviewScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [visitData, setVisitData] = useState<VisitData | null>(null);
  const [prescriptions, setPrescriptions] = useState<ExtendedPrescription[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isVisitHidden, setIsVisitHidden] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    patientHistory: true,
    findings: true,
    soapNotes: true,
    treatment: true,
    prescriptions: true,
    certificates: true,
  });
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  
  // PDF download functionality
  const { downloadModalVisible, setDownloadModalVisible, downloadSavedPath, logoDataUri, handleDownload } = usePdfDownload();

  // Load visit data from Firebase
  useEffect(() => {
    if (id) {
      loadVisitData();
    }
  }, [id]);

  const loadVisitData = async () => {
    if (!id || !user) return;
    
    try {
      setLoading(true);
      
      // Load appointment data
      const appointment = await databaseService.getAppointmentById(id as string);
      
              if (appointment) {
          // Load clinic, doctor name (from users), and doctor specialty (from doctors) data
          let clinicData = null;
          let doctorNameData = null;
          let doctorSpecialtyData = null;
          
          try {
            [clinicData, doctorNameData, doctorSpecialtyData] = await Promise.all([
              databaseService.getDocument(`clinics/${appointment.clinicId}`),
              databaseService.getDocument(`users/${appointment.doctorId}`), // Get name from users node
              databaseService.getDocument(`doctors/${appointment.doctorId}`) // Get specialty from doctors node
            ]);
          } catch (error) {
            console.log('Could not fetch clinic or doctor data:', error);
          }
          
          // Load medical history/consultation data if appointment is completed
          let medicalHistory = null;
          if (appointment.status.toLowerCase() === 'completed') {
            console.log('🔍 VISIT OVERVIEW - Starting PMH fetch for completed appointment:', {
              appointmentId: id,
              patientId: appointment.patientId,
              appointmentConsultationId: appointment.appointmentConsultationId,
              status: appointment.status
            });
            
            try {
              // Primary approach: Try direct access using appointmentConsultationId if available
              if (appointment.appointmentConsultationId) {
                console.log('🔍 VISIT OVERVIEW - Attempting direct PMH access with consultation ID:', appointment.appointmentConsultationId);
                medicalHistory = await databaseService.getDocument(`patientMedicalHistory/${appointment.patientId}/entries/${appointment.appointmentConsultationId}`);
                console.log('🔍 VISIT OVERVIEW - Direct PMH access successful:', {
                  found: !!medicalHistory,
                  hasPresentIllnessHistory: !!(medicalHistory as any)?.presentIllnessHistory,
                  hasReviewOfSymptoms: !!(medicalHistory as any)?.reviewOfSymptoms,
                  hasLabResults: !!(medicalHistory as any)?.labResults,
                  hasDiagnosis: !!(medicalHistory as any)?.diagnosis,
                  hasSoapNotes: !!(medicalHistory as any)?.soapNotes,
                  hasTreatmentPlan: !!(medicalHistory as any)?.treatmentPlan,
                  hasClinicalSummary: !!(medicalHistory as any)?.clinicalSummary
                });
              } else {
                console.log('🔍 VISIT OVERVIEW - No appointmentConsultationId available, skipping direct access');
              }
            } catch (error) {
              console.log('🔍 VISIT OVERVIEW - Direct medical history access failed, trying fallback method:', error);
              try {
                // Fallback approach: Use the getMedicalHistoryByAppointment method
                console.log('🔍 VISIT OVERVIEW - Attempting fallback PMH access via getMedicalHistoryByAppointment');
                medicalHistory = await databaseService.getMedicalHistoryByAppointment(id as string, appointment.patientId);
                console.log('🔍 VISIT OVERVIEW - Fallback PMH access result:', {
                  found: !!medicalHistory,
                  hasPresentIllnessHistory: !!(medicalHistory as any)?.presentIllnessHistory,
                  hasReviewOfSymptoms: !!(medicalHistory as any)?.reviewOfSymptoms,
                  hasLabResults: !!(medicalHistory as any)?.labResults,
                  hasDiagnosis: !!(medicalHistory as any)?.diagnosis,
                  hasSoapNotes: !!(medicalHistory as any)?.soapNotes,
                  hasTreatmentPlan: !!(medicalHistory as any)?.treatmentPlan,
                  hasClinicalSummary: !!(medicalHistory as any)?.clinicalSummary
                });
              } catch (fallbackError) {
                console.log('🔍 VISIT OVERVIEW - No medical history found for this appointment:', fallbackError);
              }
            }
            
            // Final PMH debug summary
            console.log('🔍 VISIT OVERVIEW - Final PMH fetch summary:', {
              appointmentId: id,
              patientId: appointment.patientId,
              medicalHistoryFound: !!medicalHistory,
              medicalHistoryId: (medicalHistory as any)?.id,
              consultationDate: (medicalHistory as any)?.consultationDate,
              consultationTime: (medicalHistory as any)?.consultationTime,
              provider: (medicalHistory as any)?.provider ? {
                id: (medicalHistory as any).provider.id,
                name: `${(medicalHistory as any).provider.firstName} ${(medicalHistory as any).provider.lastName}`,
                type: (medicalHistory as any).provider.providerType
              } : null,
              clinicalFields: {
                presentIllnessHistory: (medicalHistory as any)?.presentIllnessHistory || 'Not available',
                reviewOfSymptoms: (medicalHistory as any)?.reviewOfSymptoms || 'Not available',
                labResults: (medicalHistory as any)?.labResults || 'Not available',
                diagnosis: (medicalHistory as any)?.diagnosis || 'Not available',
                differentialDiagnosis: (medicalHistory as any)?.differentialDiagnosis || 'Not available',
                treatmentPlan: (medicalHistory as any)?.treatmentPlan || 'Not available',
                clinicalSummary: (medicalHistory as any)?.clinicalSummary || 'Not available'
              },
              soapNotes: (medicalHistory as any)?.soapNotes ? {
                hasSubjective: !!(medicalHistory as any).soapNotes.subjective,
                hasObjective: !!(medicalHistory as any).soapNotes.objective,
                hasAssessment: !!(medicalHistory as any).soapNotes.assessment,
                hasPlan: !!(medicalHistory as any).soapNotes.plan
              } : null,
              prescriptions: (medicalHistory as any)?.prescriptions ? {
                count: (medicalHistory as any).prescriptions.length,
                medications: (medicalHistory as any).prescriptions.map((p: any) => p.medication)
              } : null,
              certificates: (medicalHistory as any)?.certificates ? {
                count: (medicalHistory as any).certificates.length,
                types: (medicalHistory as any).certificates.map((c: any) => c.type)
              } : null
            });
          } else {
            console.log('🔍 VISIT OVERVIEW - Appointment not completed, skipping PMH fetch:', {
              appointmentId: id,
              status: appointment.status
            });
          }
          
          // Debug logging
          console.log('🔍 APPOINTMENT DATA:', {
            id: appointment.id,
            doctorFirstName: appointment.doctorFirstName,
            doctorLastName: appointment.doctorLastName,
            clinicName: appointment.clinicName,
            consultationId: appointment.consultationId,
            appointmentDate: appointment.appointmentDate,
            appointmentTime: appointment.appointmentTime
          });
          
          console.log('🔍 CLINIC DATA:', clinicData);
          console.log('🔍 DOCTOR NAME DATA (users):', doctorNameData);
          console.log('🔍 DOCTOR SPECIALTY DATA (doctors):', doctorSpecialtyData);
          
          // Combine appointment data with consultation data
          const combinedVisitData: VisitData = {
            ...appointment,
            // Construct doctor name from users node (firstName, middleName, lastName)
            doctorName: (() => {
              // First try appointment data
              if (appointment.doctorFirstName && appointment.doctorLastName) {
                return `Dr. ${appointment.doctorFirstName} ${appointment.doctorLastName}`;
              }
              // Then try users node data
              if (doctorNameData) {
                const firstName = doctorNameData.firstName || doctorNameData.first_name || '';
                const middleName = doctorNameData.middleName || doctorNameData.middle_name || '';
                const lastName = doctorNameData.lastName || doctorNameData.last_name || '';
                const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
                return fullName ? `Dr. ${fullName}` : 'Dr. Unknown Doctor';
              }
              return 'Dr. Unknown Doctor';
            })(),
            // Get specialty from doctors node
            doctorSpecialty: appointment.doctorSpecialty || doctorSpecialtyData?.specialty || 'General Medicine',
            clinic: clinicData?.name || appointment.clinicName || 'Unknown Clinic',
            date: appointment.appointmentDate,
            time: appointment.appointmentTime,
            address: formatClinicAddress(clinicData, clinicData?.name || appointment.clinicName),
            // Use appointmentConsultationId if available, otherwise use consultationId
            consultationId: appointment.appointmentConsultationId || appointment.consultationId || 'N/A',
          
          // Consultation fields from medical history
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
          clinicalSummary: medicalHistory?.clinicalSummary || '',
          
        };
        
        setVisitData(combinedVisitData);
        
        // Determine if this visit is hidden (persisted flag on medical history entry)
        try {
          const consultationIdToCheck = combinedVisitData.appointmentConsultationId || combinedVisitData.consultationId;
          if (consultationIdToCheck) {
            const medicalHistoryForHide = await databaseService.getDocument(`patientMedicalHistory/${appointment.patientId}/entries/${consultationIdToCheck}`);
            setIsVisitHidden((medicalHistoryForHide as any)?.isHidden === true);
          } else {
            setIsVisitHidden(false);
          }
        } catch (hideFlagErr) {
          setIsVisitHidden(false);
        }
        
        // Load related prescriptions and certificates
        // First try to get them from the medical history if available
        let visitPrescriptions: any[] = [];
        let visitCertificates: any[] = [];
        
        if (medicalHistory) {
          // Use prescriptions and certificates from medical history if available
          const mhPrescriptions = (medicalHistory as any)?.prescriptions || [];
          const mhCertificates = (medicalHistory as any)?.certificates || [];
          
          // Process prescriptions to ensure they have proper prescribedBy field
          visitPrescriptions = mhPrescriptions.map((prescription: any, index: number) => ({
            id: prescription.id || `${(medicalHistory as any)?.id || 'mh'}-${index}`,
            ...prescription,
            prescribedBy: prescription.prescribedBy || prescription.specialistName || 
              ((medicalHistory as any)?.provider ? 
                `${(medicalHistory as any).provider.firstName} ${(medicalHistory as any).provider.lastName}` : 
                visitData?.doctorName || 'Unknown Doctor')
          }));
          
          visitCertificates = mhCertificates;
          
          console.log('🔍 VISIT OVERVIEW - Using prescriptions/certificates from medical history:', {
            prescriptionsFromMH: visitPrescriptions.length,
            certificatesFromMH: visitCertificates.length,
            processedPrescriptions: visitPrescriptions.map(p => ({ 
              id: p.id, 
              medication: p.medication, 
              prescribedBy: p.prescribedBy 
            }))
          });
        }
        
        // If no prescriptions/certificates from medical history, try separate database calls
        if (visitPrescriptions.length === 0 || visitCertificates.length === 0) {
          console.log('🔍 VISIT OVERVIEW - Fetching prescriptions/certificates from separate database calls');
          const [dbPrescriptions, dbCertificates] = await Promise.all([
            databaseService.getPrescriptionsByAppointment(id as string),
            databaseService.getCertificatesByAppointment(id as string)
          ]);
          
          // Use database results if medical history didn't have them
          if (visitPrescriptions.length === 0) {
            visitPrescriptions = dbPrescriptions;
          }
          if (visitCertificates.length === 0) {
            visitCertificates = dbCertificates;
          }
        }
        
        console.log('🔍 VISIT OVERVIEW - Final prescriptions/certificates to display:', {
          prescriptionsCount: visitPrescriptions.length,
          certificatesCount: visitCertificates.length,
          prescriptions: visitPrescriptions.map(p => ({ id: p.id, medication: p.medication, dosage: p.dosage })),
          certificates: visitCertificates.map(c => ({ 
            id: c.id, 
            type: c.type, 
            status: c.status, 
            issuedDate: (c as any).issuedDate,
            doctor: (c as any).doctor,
            prescribedBy: (c as any).prescribedBy,
            specialistName: (c as any).specialistName
          }))
        });
        
        setPrescriptions(visitPrescriptions);
        setCertificates(visitCertificates);
      }
    } catch (error) {
      console.error('Error loading visit data:', error);
      Alert.alert('Error', 'Failed to load visit data. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  const handleHideVisitDetails = async () => {
    if (!visitData || !user) return;
    try {
      // Require completed appointment and a consultation id to persist hide
      if ((visitData.status || '').toLowerCase() !== 'completed') {
        Alert.alert('Error', 'Cannot hide visit details. Visit must be completed first.');
        return;
      }
      const consultationIdToUse = (visitData as any).appointmentConsultationId || (visitData as any).consultationId;
      if (!consultationIdToUse) {
        Alert.alert('Error', 'Cannot hide visit details. No consultation reference was found.');
        return;
      }

      Alert.alert(
        'Hide Visit Details',
        'Are you sure you want to hide this visit from your medical history? You can show it again anytime.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Hide',
            style: 'destructive',
            onPress: async () => {
              try {
                await databaseService.updateDocument(
                  `patientMedicalHistory/${visitData.patientId}/entries/${consultationIdToUse}`,
                  { isHidden: true }
                );
                setIsVisitHidden(true);
                Alert.alert('Success', 'Visit details have been hidden from your medical history.', [
                  { text: 'OK' }
                ]);
              } catch (error) {
                Alert.alert('Error', 'Failed to hide visit details. Please try again.');
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const handleShowVisitDetails = async () => {
    if (!visitData || !user) return;
    try {
      if ((visitData.status || '').toLowerCase() !== 'completed') {
        Alert.alert('Error', 'Cannot show visit details. Visit must be completed first.');
        return;
      }
      const consultationIdToUse = (visitData as any).appointmentConsultationId || (visitData as any).consultationId;
      if (!consultationIdToUse) {
        Alert.alert('Error', 'Cannot show visit details. No consultation reference was found.');
        return;
      }

      Alert.alert(
        'Show Visit Details',
        'Are you sure you want to show this visit in your medical history again?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Show',
            onPress: async () => {
              try {
                await databaseService.updateDocument(
                  `patientMedicalHistory/${visitData.patientId}/entries/${consultationIdToUse}`,
                  { isHidden: null }
                );
                setIsVisitHidden(false);
                Alert.alert('Success', 'Visit details have been shown in your medical history again.', [
                  { text: 'OK' }
                ]);
              } catch (error) {
                Alert.alert('Error', 'Failed to show visit details. Please try again.');
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVisitData();
    setRefreshing(false);
  };

  const toggleSection = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleDownloadPdf = async () => {
    if (!visitData) return;
    
    const html = generateVisitRecordPdf(visitData, prescriptions, certificates, user, logoDataUri);
    const filename = `UniHealth_Visit_Record_${Date.now()}.pdf`;
    await handleDownload(html, filename);
  };

  const handleVisitFollowUp = () => {
    if (!visitData) return;
    const specialistOrDoctorId = (visitData as any).doctorId || (visitData as any).assignedSpecialistId;
    const clinicId = (visitData as any).clinicId;
    const doctorName = visitData.doctorName || 'Doctor';
    if (!specialistOrDoctorId || !clinicId) {
      Alert.alert('Error', 'Unable to book follow-up. Missing doctor or clinic information.');
      return;
    }
    const params = {
      doctorId: specialistOrDoctorId,
      clinicId: clinicId,
      clinicName: '',
      doctorName: doctorName,
      doctorSpecialty: visitData.doctorSpecialty || 'Consultation',
      isFollowUp: 'true',
      originalAppointmentId: String(id),
      isReferralFollowUp: 'false',
    } as any;
    router.push({ pathname: '/(patient)/book-visit/select-datetime', params });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading visit data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!visitData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Visit not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: (visitData.status?.toLowerCase?.() === 'completed') ? 120 : 24 }}
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
          <Text style={styles.headerTitle}>Visit Overview</Text>
        </View>

        {/* --- CONSULTATION DETAILS --- */}
        <View style={styles.sectionSpacing}>
          <Text style={styles.sectionTitle}>Consultation Details</Text>
          <View style={[styles.cardBox, styles.cardBoxTopAvatar]}>
            {/* Avatar initials (top-left) */}
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{(() => {
                const name = (visitData.doctorName || '').replace(/^Dr\.?\s+/i, '').trim() || 'Doctor';
                return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || 'DR';
              })()}</Text>
            </View>
            {/* Fixed Status Badge (top-right) - Monotone */}
            <View style={[styles.statusBadge, styles.statusBadgeFixed, styles.statusBadgeNeutral]}>
              {getMonotoneStatusIcon(visitData.status)}
              <Text style={styles.statusTextNeutral}>{getStatusText(visitData.status)}</Text>
            </View>

            <View style={styles.consultDetailsTable}>
              <View style={styles.consultDetailsRow}>
                <Text style={styles.consultLabel}>Doctor</Text>
                <Text style={styles.consultValue}>{visitData.doctorName || 'Unknown Doctor'}</Text>
              </View>
              <View style={styles.consultDetailsRow}>
                <Text style={styles.consultLabel}>Specialty</Text>
                <Text style={styles.consultValue}>{visitData.doctorSpecialty || 'General Medicine'}</Text>
              </View>
              <View style={styles.consultDetailsRow}>
                <Text style={styles.consultLabel}>Clinic</Text>
                <Text style={styles.consultValue}>{visitData.clinic || 'Unknown Clinic'}</Text>
              </View>
              <View style={styles.consultDetailsRow}>
                <Text style={styles.consultLabel}>Address</Text>
                <Text style={styles.consultValue}>{visitData.address || 'Address not provided'}</Text>
              </View>
              <View style={styles.consultDetailsRow}>
                <Text style={styles.consultLabel}>Date</Text>
                <Text style={styles.consultValue}>{visitData.appointmentDate ? formatDate(visitData.appointmentDate) : 'Not specified'}</Text>
              </View>
              <View style={styles.consultDetailsRow}>
                <Text style={styles.consultLabel}>Time</Text>
                <Text style={styles.consultValue}>{visitData.appointmentTime}</Text>
              </View>
              <View style={styles.consultDetailsRow}>
                <Text style={styles.consultLabel}>Purpose</Text>
                <Text style={styles.consultValue}>{visitData.appointmentPurpose || 'Not specified'}</Text>
              </View>
              {visitData.additionalNotes && (
                <View style={styles.consultDetailsRowNoBorder}>
                  <Text style={styles.consultLabel}>Notes</Text>
                  <Text style={styles.consultValue}>{visitData.additionalNotes}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

         {/* --- CLINICAL SUMMARY --- */}
         <View style={styles.sectionSpacing}>
          <Text style={styles.sectionTitle}>Clinical Summary</Text>
          {visitData.status.toLowerCase() !== 'completed' ? (
            <View style={styles.emptyStateCard}>
              <FileText size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>Consultation details unavailable</Text>
              <Text style={styles.emptyStateDescription}>
                Consultation details will be available after the appointment is completed.
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
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>History of Present Illnesses:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.presentIllnessHistory || 'No illness history recorded'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Review of Symptoms:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.reviewOfSymptoms || 'No symptoms reviewed'}</Text>
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
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Lab Results:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.labResults || 'No lab results recorded'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Medications:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.medications || 'No medications recorded'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Diagnosis:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.diagnosis || 'No diagnosis recorded'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Differential Diagnosis:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.differentialDiagnosis || 'No differential diagnosis recorded'}</Text>
                </View>
              </View>
            )}

            {/* Step 3: SOAP Notes */}
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
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Subjective:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.soapNotes?.subjective || 'No subjective notes'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Objective:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.soapNotes?.objective || 'No objective notes'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Assessment:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.soapNotes?.assessment || 'No assessment notes'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Plan:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.soapNotes?.plan || 'No plan notes'}</Text>
                </View>
              </View>
            )}

            {/* Step 4: Treatment & Wrap-Up */}
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
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Treatment Plan:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.treatmentPlan || 'No treatment plan recorded'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Clinical Summary:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.clinicalSummary || 'No clinical summary recorded'}</Text>
                </View>
              </View>
            )}


          </View>
          )}
        </View>

        {/* --- PRESCRIPTIONS --- */}
        <View style={styles.sectionSpacing}>
          <Text style={styles.sectionTitle}>Prescriptions</Text>
          {visitData.status.toLowerCase() === 'completed' && prescriptions.length ? prescriptions.map((p) => (
            <View key={p.id} style={styles.cardBox}>
              <View style={styles.prescriptionHeader}>
                <View style={[styles.medicationIcon, { backgroundColor: `${p.color}15` }]}>
                  <Pill size={20} color={p.color} />
                </View>
                <View style={styles.prescriptionDetails}>
                  <Text style={styles.medicationName}>{p.medication || 'Unknown Medication'}</Text>
                  <Text style={styles.medicationDosage}>
                    {p.dosage || 'N/A'} • {formatFrequency(p.frequency, 'patient')}
                    {p.route && ` • ${formatRoute(p.route, 'patient')}`}
                    {p.formula && ` • ${formatFormula(p.formula, 'patient')}`}
                    {p.take && ` • Take: ${p.take}`}
                    {p.totalQuantity && ` • Total: ${p.totalQuantity}`}
                  </Text>
                  <Text style={styles.prescriptionDescription}>{p.description || 'No description provided'}</Text>
                </View>
                <View style={styles.prescriptionStatus}>
                  <Text style={styles.remainingDays}>{p.remaining}</Text>
                  <Text style={styles.remainingLabel}>remaining</Text>
                </View>
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
          )) : visitData.status.toLowerCase() === 'completed' ? (
            <View style={styles.emptyStateCard}>
              <Pill size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>No Prescriptions</Text>
              <Text style={styles.emptyStateDescription}>No prescriptions for this visit.</Text>
            </View>
          ) : (
            <View style={styles.emptyStateCard}>
              <Pill size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>Prescriptions unavailable</Text>
              <Text style={styles.emptyStateDescription}>Prescriptions will be available after the appointment is completed.</Text>
            </View>
          )}
        </View>

        {/* --- MEDICAL CERTIFICATES --- */}
        <View style={styles.sectionSpacing}>
          <Text style={styles.sectionTitle}>Medical Certificates</Text>
          {visitData.status.toLowerCase() === 'completed' && certificates.length ? certificates.map((cert) => {
            const statusStyle = getCertStatusStyles(cert.status);
            const certData = cert as any;
            const issuingDoctor = certData.doctor || certData.prescribedBy || certData.specialistName || visitData?.doctorName;
            
            // Enhanced date handling with fallbacks
            const issuedDate = certData.issuedDate || 
                              certData.createdAt || 
                              certData.examinationDate || 
                              certData.date ||
                              certData.validUntil ||
                              visitData?.date;
            
            // Debug logging for certificate date
            console.log('🔍 VISIT OVERVIEW - Certificate date debug:', {
              certificateId: cert.id,
              certificateType: cert.type,
              certDataIssuedDate: certData.issuedDate,
              certDataCreatedAt: certData.createdAt,
              certDataExaminationDate: certData.examinationDate,
              certDataDate: certData.date,
              certDataValidUntil: certData.validUntil,
              visitDataDate: visitData?.date,
              finalIssuedDate: issuedDate,
              issuedDateType: typeof issuedDate,
              issuedDateValue: issuedDate,
              allCertDataKeys: Object.keys(certData)
            });
            
            return (
              <View key={cert.id} style={styles.cardBox}>
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
                  <Text style={styles.certificateInfoValue}>{formatDoctorName(issuingDoctor)}</Text>
                </View>
                <View style={styles.certificateInfoRow}>
                  <Text style={styles.certificateLabel}>Issued on:</Text>
                  <Text style={styles.certificateInfoValue}>{issuedDate ? formatDate(issuedDate) : 'Not specified'}</Text>
                </View>
                <View style={styles.certificateActions}>
                  <TouchableOpacity style={[styles.secondaryButton, { marginRight: 9 }]}>
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
          }          ) : visitData.status.toLowerCase() === 'completed' ? (
            <View style={styles.emptyStateCard}>
              <FileText size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>No Certificates</Text>
              <Text style={styles.emptyStateDescription}>No certificates were issued for this visit.</Text>
            </View>
          ) : (
            <View style={styles.emptyStateCard}>
              <FileText size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>Certificates unavailable</Text>
              <Text style={styles.emptyStateDescription}>Certificates will be available after the appointment is completed.</Text>
            </View>
          )}
        </View>

       
      </ScrollView>

      {/* --- BOTTOM ACTION BAR (COMPACT WITH MORE MENU) --- */}
      {visitData.status.toLowerCase() === 'completed' && (
        <View style={styles.compactButtonBar}>
          <TouchableOpacity
            style={[styles.primaryActionButton, user?.role !== 'patient' && styles.primaryActionButtonFullWidth]}
            onPress={handleDownloadPdf}
            activeOpacity={0.8}
          >
            <Download size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryActionButtonText}>Generate Visit Report</Text>
          </TouchableOpacity>
          {user?.role === 'patient' && (
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => setShowMoreMenu(!showMoreMenu)}
              activeOpacity={0.8}
            >
              <MoreHorizontal size={20} color="#1E40AF" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* More Menu Dropdown */}
      {showMoreMenu && user?.role === 'patient' && (
        <View style={styles.moreMenuOverlay}>
          <TouchableOpacity
            style={styles.moreMenuBackdrop}
            onPress={() => setShowMoreMenu(false)}
            activeOpacity={1}
          />
          <View style={styles.moreMenuContainer}>
            <TouchableOpacity
              style={styles.moreMenuItem}
              onPress={() => {
                setShowMoreMenu(false);
                router.push({ pathname: '/e-prescription', params: { id: String(id) } });
              }}
              activeOpacity={0.8}
            >
              <FileText size={18} color="#1E40AF" style={{ marginRight: 12 }} />
              <Text style={styles.moreMenuItemText}>Generate E‑Prescription</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.moreMenuItem}
              onPress={() => {
                setShowMoreMenu(false);
                handleVisitFollowUp();
              }}
              activeOpacity={0.8}
            >
              <Stethoscope size={18} color="#1E40AF" style={{ marginRight: 12 }} />
              <Text style={styles.moreMenuItemText}>Book Follow-up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.moreMenuItem}
              onPress={() => {
                setShowMoreMenu(false);
                if (isVisitHidden) {
                  handleShowVisitDetails();
                } else {
                  handleHideVisitDetails();
                }
              }}
              activeOpacity={0.8}
            >
              <Eye size={18} color="#1E40AF" style={{ marginRight: 12 }} />
              <Text style={styles.moreMenuItemText}>{isVisitHidden ? 'Show Visit Details' : 'Hide Visit Details'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Download Success Modal */}
      {downloadModalVisible && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <View style={{
            backgroundColor: 'white',
            borderRadius: 12,
            padding: 24,
            margin: 24,
            alignItems: 'center',
            minWidth: 280,
          }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 12 }}>
              Visit Record Downloaded
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20 }}>
              {downloadSavedPath ? `Your visit record has been saved.${Platform.OS !== 'android' ? '\nPath: ' + downloadSavedPath : ''}` : 'Your visit record has been saved.'}
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#1E40AF',
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 8,
                width: '100%',
                alignItems: 'center',
              }}
              onPress={() => setDownloadModalVisible(false)}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>Done</Text>
            </TouchableOpacity>
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
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
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
  statusText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },

  // === Improved Card for Clinical Summary ===
  cardBoxClinical: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 7,
    paddingHorizontal: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
    shadowColor: '#00000022',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  clinicalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 12,
    backgroundColor: '#F5F6F8',
    marginBottom: 2,
    marginTop: 2,
  },
  clinicalSectionHeaderOpen: {
    backgroundColor: '#F3F4F6',
  },
  clinicalSectionLabel: {
    fontSize: 16, 
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.05,
  },
  clinicalSectionBody: {
    paddingHorizontal: 26,
    paddingTop: 6,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  clinicalFieldRow: {
    marginBottom: 0,
    paddingVertical: 8,
    borderRadius: 7,
  },
  clinicalFieldRowWithGap: {
    marginBottom: 9,
  },
  clinicalFieldLabel: {
    fontSize: 14,
    color: '#8B949E',
    fontFamily: 'Inter-Regular',
    marginBottom: 2,
  },
  clinicalFieldValue: {
    fontSize: 14,
    color: '#23272F',
    fontFamily: 'Inter-Medium',
    lineHeight: 22,
    letterSpacing: 0.01,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 18,
    marginVertical: 2,
  },

  // ---- original cards (prescriptions, certificates, etc) ----
  cardBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },
  cardBoxTopAvatar: {
    paddingTop: 84,
  },
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
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 13,
    justifyContent: 'space-between',
  },
  doctorName: {
    fontSize: 16,
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
  },
  doctorInfo: {
    flex: 1,
  },
  doctorSpecialty: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  doctorImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E5E7EB',
  },
  consultDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  consultDetailsTable: {
    marginTop: 2,
  },
  consultDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 2,
    minHeight: 38,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  consultDetailsRowNoBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 2,
    minHeight: 38,
  },
  consultLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
    flex: 1.1,
  },
  consultValue: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter-Regular',
    flex: 2,
    textAlign: 'right',
  },

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
  compactButtonBar: {
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    paddingVertical: 15,
  },
  primaryActionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.2,
  },
  primaryActionButtonFullWidth: {
    flex: 1,
    marginRight: 0,
  },
  moreButton: {
    width: 48,
    height: 48,
    backgroundColor: '#F9FAFB',
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  moreMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  moreMenuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  moreMenuContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 90 : 82,
    right: HORIZONTAL_MARGIN,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 200,
  },
  moreMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  moreMenuItemText: {
    color: '#1F2937',
    fontSize: 15,
    fontFamily: 'Inter-Medium',
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

