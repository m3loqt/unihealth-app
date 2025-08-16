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
  User,
  MapPin,
  Calendar,
  Clock,
  Stethoscope,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/hooks/auth/useAuth';
import { databaseService, Referral, MedicalHistory } from '../../src/services/database/firebase';
import { safeDataAccess } from '../../src/utils/safeDataAccess';

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
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    patientHistory: true,
    findings: true,
    soapNotes: true,
    treatment: true,
    supplementary: true,
  });

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
      
      // Load referral data
      const referral = await databaseService.getReferralById(id as string);
      
      if (referral) {
        // Load clinic and doctor data for complete information
        let clinicData = null;
        let referringDoctorData = null;
        let patientData = null;
        let specialistClinicData = null;
        
        try {
          [clinicData, referringDoctorData, patientData] = await Promise.all([
            databaseService.getDocument(`clinics/${referral.referringClinicId}`),
            databaseService.getDocument(`specialists/${referral.referringGeneralistId}`),
            databaseService.getDocument(`users/${referral.patientId}`)
          ]);
        } catch (error) {
          console.log('Could not fetch clinic, doctor, or patient data:', error);
        }
         
                 // Additional: Fetch specialist's assigned clinic
         if (user?.uid && user?.role === 'specialist') {
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
          referringDoctorName: referral.referringGeneralistFirstName && referral.referringGeneralistLastName 
            ? `${referral.referringGeneralistFirstName} ${referral.referringGeneralistLastName}` 
            : referringDoctorData 
              ? `${referringDoctorData.firstName} ${referringDoctorData.lastName}`
              : 'Unknown Doctor',
          
          // Clinic information
          clinic: clinicData?.name || referral.referringClinicName || 'Unknown Clinic',
          date: referral.appointmentDate,
          time: referral.appointmentTime,
          address: formatClinicAddress(clinicData, clinicData?.name || referral.referringClinicName),
          // Merged fields for display
          clinicAndAddress: formatClinicAndAddress(clinicData, clinicData?.name || referral.referringClinicName),
          dateTime: formatDateTime(referral.appointmentDate, referral.appointmentTime),
          specialistClinic: specialistClinicData?.name || 'Not assigned',
          
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
           referralPrescriptions = medicalHistory.prescriptions || [];
           referralCertificates = medicalHistory.certificates || [];
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
           } catch (fallbackError) {
             console.log('Fallback method also failed for prescriptions/certificates:', fallbackError);
           }
         }
         
         setPrescriptions(referralPrescriptions);
         setCertificates(referralCertificates);
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
          <Text style={styles.headerTitle}>Referral Details</Text>
        </View>

        {/* --- REFERRAL DETAILS --- */}
        <View style={styles.sectionSpacing}>
          <Text style={styles.sectionTitle}>Referral Information</Text>
          <View style={styles.cardBox}>
            {/* Avatar initials (top-left) */}
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{avatarInitials}</Text>
            </View>
            {/* Fixed Status Badge (top-right) */}
            <View style={[styles.statusBadge, styles.statusBadgeFixed, { backgroundColor: getStatusColor(referralData.status) + '20' }]}> 
              <Text style={[styles.statusText, { color: getStatusColor(referralData.status) }]}> 
                {getStatusText(referralData.status)}
              </Text>
            </View>
            
            <View style={styles.referralDivider} />
            
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
              <View style={styles.referralDetailsRow}>
                <Text style={styles.referralLabel}>Referring Generalist</Text>
                <Text style={styles.referralValue}>{referralData.referringDoctorName || 'Unknown Doctor'}</Text>
              </View>
              <View style={styles.referralDetailsRowWrapped}>
                <Text style={styles.referralLabel}>Generalist Clinic</Text>
                <Text style={styles.referralValueWrapped}>{referralData.clinicAndAddress || 'Unknown Clinic'}</Text>
              </View>
              <View style={styles.referralDetailsRow}>
                <Text style={styles.referralLabel}>Appointment Date & Time</Text>
                <Text style={styles.referralValue}>{referralData.dateTime || 'Not specified'}</Text>
              </View>
              <View style={styles.referralDetailsRow}>
                <Text style={styles.referralLabel}>Specialist Clinic</Text>
                <Text style={styles.referralValue}>{referralData.specialistClinic || 'Not assigned'}</Text>
              </View>
              {referralData.practiceLocation?.roomOrUnit && (
                <View style={styles.referralDetailsRow}>
                  <Text style={styles.referralLabel}>Room/Unit</Text>
                  <Text style={styles.referralValue}>{referralData.practiceLocation.roomOrUnit}</Text>
                </View>
              )}
              <View style={styles.referralDetailsRowNoBorder}>
                <Text style={styles.referralLabel}>Reason for Referral</Text>
                <Text style={styles.referralValue}>{referralData.initialReasonForReferral || 'Not specified'}</Text>
              </View>
              {referralData.generalistNotes && (
                <View style={styles.referralDetailsRowNoBorder}>
                  <Text style={styles.referralLabel}>Generalist Notes</Text>
                  <Text style={styles.referralValue}>{referralData.generalistNotes}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* --- PRESCRIPTIONS --- */}
        <View style={styles.sectionSpacing}>
          <Text style={styles.sectionTitle}>Prescriptions</Text>
          {referralData.status.toLowerCase() === 'completed' && prescriptions.length ? prescriptions.map((p) => (
            <View key={p.id} style={styles.cardBox}>
              <View style={styles.prescriptionHeader}>
                <View style={[styles.medicationIcon, { backgroundColor: `${p.color}15` }]}>
                  <Pill size={20} color={p.color} />
                </View>
                <View style={styles.prescriptionDetails}>
                  <Text style={styles.medicationName}>{p.medication || 'Unknown Medication'}</Text>
                  <Text style={styles.medicationDosage}>{p.dosage || 'N/A'} • {p.frequency || 'N/A'}</Text>
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
                  <Text style={styles.metaValue}>{p.prescribedBy || 'Unknown Doctor'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Next refill:</Text>
                  <Text style={styles.metaValue}>{p.nextRefill || 'Not specified'}</Text>
                </View>
              </View>
            </View>
          )) : referralData.status.toLowerCase() === 'completed' ? (
            <View style={styles.emptyStateCard}>
              <Pill size={36} color="#9CA3AF" />
              <Text style={styles.emptyStateText}>No prescriptions for this referral.</Text>
            </View>
          ) : (
            <View style={styles.emptyStateCard}>
              <Pill size={36} color="#9CA3AF" />
              <Text style={styles.emptyStateText}>Prescriptions will be available after the referral is completed.</Text>
            </View>
          )}
        </View>

        {/* --- MEDICAL CERTIFICATES --- */}
        <View style={styles.sectionSpacing}>
          <Text style={styles.sectionTitle}>Medical Certificates</Text>
          {referralData.status.toLowerCase() === 'completed' && certificates.length ? certificates.map((cert) => {
            const statusStyle = getCertStatusStyles(cert.status);
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
                  <Text style={styles.certificateInfoValue}>{cert.doctor || 'Unknown Doctor'}</Text>
                </View>
                <View style={styles.certificateInfoRow}>
                  <Text style={styles.certificateLabel}>Issued on:</Text>
                  <Text style={styles.certificateInfoValue}>{cert.issuedDate || 'Date not specified'}</Text>
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
          }) : referralData.status.toLowerCase() === 'completed' ? (
            <View style={styles.emptyStateCard}>
              <FileText size={36} color="#9CA3AF" />
              <Text style={styles.emptyStateText}>No certificates were issued for this referral.</Text>
            </View>
          ) : (
            <View style={styles.emptyStateCard}>
              <FileText size={36} color="#9CA3AF" />
              <Text style={styles.emptyStateText}>Certificates will be available after the referral is completed.</Text>
            </View>
          )}
        </View>

        {/* --- CLINICAL SUMMARY --- */}
        <View style={styles.sectionSpacing}>
          <Text style={styles.sectionTitle}>Clinical Summary</Text>
          {referralData.status.toLowerCase() !== 'completed' ? (
            <View style={styles.emptyStateCard}>
              <FileText size={36} color="#9CA3AF" />
              <Text style={styles.emptyStateText}>
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
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>History of Present Illnesses:</Text>
                  <Text style={styles.clinicalFieldValue}>{referralData.presentIllnessHistory || 'No illness history recorded'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Review of Symptoms:</Text>
                  <Text style={styles.clinicalFieldValue}>{referralData.reviewOfSymptoms || 'No symptoms reviewed'}</Text>
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
                  <Text style={styles.clinicalFieldValue}>{referralData.labResults || 'No lab results recorded'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Medications:</Text>
                  <Text style={styles.clinicalFieldValue}>{referralData.medications || 'No medications recorded'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Diagnosis:</Text>
                  <Text style={styles.clinicalFieldValue}>{referralData.diagnosis || 'No diagnosis recorded'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Differential Diagnosis:</Text>
                  <Text style={styles.clinicalFieldValue}>{referralData.differentialDiagnosis || 'No differential diagnosis recorded'}</Text>
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
                  <View style={styles.clinicalFieldRow}>
                    <Text style={styles.clinicalFieldLabel}>Subjective:</Text>
                    <Text style={styles.clinicalFieldValue}>{referralData.soapNotes?.subjective || 'No subjective notes'}</Text>
                  </View>
                  <View style={styles.clinicalFieldRow}>
                    <Text style={styles.clinicalFieldLabel}>Objective:</Text>
                    <Text style={styles.clinicalFieldValue}>{referralData.soapNotes?.objective || 'No objective notes'}</Text>
                  </View>
                  <View style={styles.clinicalFieldRow}>
                    <Text style={styles.clinicalFieldLabel}>Assessment:</Text>
                    <Text style={styles.clinicalFieldValue}>{referralData.soapNotes?.assessment || 'No assessment notes'}</Text>
                  </View>
                  <View style={styles.clinicalFieldRow}>
                    <Text style={styles.clinicalFieldLabel}>Plan:</Text>
                    <Text style={styles.clinicalFieldValue}>{referralData.soapNotes?.plan || 'No plan notes'}</Text>
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
                  <View style={styles.clinicalFieldRow}>
                    <Text style={styles.clinicalFieldLabel}>Treatment Plan:</Text>
                    <Text style={styles.clinicalFieldValue}>{referralData.treatmentPlan || 'No treatment plan recorded'}</Text>
                  </View>
                  <View style={styles.clinicalFieldRow}>
                    <Text style={styles.clinicalFieldLabel}>Clinical Summary:</Text>
                    <Text style={styles.clinicalFieldValue}>{referralData.clinicalSummary || 'No clinical summary recorded'}</Text>
                  </View>
                </View>
              )}

              {/* Supplementary Information */}
              <TouchableOpacity style={styles.clinicalSectionHeader} onPress={() => toggleSection('supplementary')}>
                <Text style={styles.clinicalSectionLabel}>Supplementary Information</Text>
                {expandedSections['supplementary'] ? (
                  <ChevronDown size={23} color="#6B7280" />
                ) : (
                  <ChevronRight size={23} color="#9CA3AF" />
                )}
              </TouchableOpacity>
              {expandedSections['supplementary'] && (
                <View style={styles.clinicalSectionBody}>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* --- BOTTOM ACTION BAR --- */}
      {referralData.status.toLowerCase() === 'completed' && (
        <View style={styles.buttonBarVertical}>
          <TouchableOpacity
            style={styles.primaryBottomButton}
            onPress={() => {
              alert('Downloading referral record...');
            }}
            activeOpacity={0.8}
          >
            <Download size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBottomButtonText}>Download Record</Text>
          </TouchableOpacity>
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
  statusSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
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
    lineHeight: 27,
    letterSpacing: 0.01,
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
    paddingTop: 64,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  emptyStateCard: {
    padding: 18,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  emptyStateText: {
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 19,
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
