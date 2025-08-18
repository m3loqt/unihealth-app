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
  Alert,
  RefreshControl,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  Pill,
  FileText,
  CheckCircle,
  XCircle,
  Eye,
  Download,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/hooks/auth/useAuth';
import { databaseService, Referral, MedicalHistory } from '../../src/services/database/firebase';

interface ReferralData extends Referral {
  patientName?: string;
  referringDoctorName?: string;
  clinic?: string;
  date?: string;
  time?: string;
  address?: string;
  clinicAndAddress?: string;
  dateTime?: string;
  specialistClinic?: string;

  // Clinical fields
  presentIllnessHistory?: string;
  reviewOfSymptoms?: string;
  labResults?: string;
  medications?: string;
  diagnosis?: string;
  differentialDiagnosis?: string;
  soapNotes?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  treatmentPlan?: string;
  clinicalSummary?: string;
}

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const HORIZONTAL_MARGIN = 24;

// Formatting helpers (aligned with specialist screen)
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatTime = (timeString: string) => {
  if (!timeString) return 'Not specified';
  if (timeString.includes('AM') || timeString.includes('PM')) {
    return timeString;
  }
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

const getStatusText = (status: string) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';

const getMonotoneStatusIcon = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'confirmed') return <CheckCircle size={16} color="#6B7280" style={{ marginRight: 6 }} />;
  if (s === 'completed') return <CheckCircle size={16} color="#6B7280" style={{ marginRight: 6 }} />;
  if (s === 'cancelled') return <XCircle size={16} color="#6B7280" style={{ marginRight: 6 }} />;
  return <Clock size={16} color="#6B7280" style={{ marginRight: 6 }} />;
};

const formatDoctorName = (name?: string): string => {
  if (!name || name.trim().length === 0 || name.toLowerCase().includes('unknown')) {
    return 'Unknown Doctor';
  }
  const stripped = name.replace(/^Dr\.?\s+/i, '').trim();
  return `Dr. ${stripped}`;
};

const formatClinicAddress = (clinicData: any, fallbackClinicName?: string): string => {
  if (!clinicData) {
    return fallbackClinicName || 'Address not provided';
  }
  const addressParts: string[] = [];
  if (clinicData.address) addressParts.push(clinicData.address);
  if (clinicData.city) addressParts.push(clinicData.city);
  if (clinicData.province) addressParts.push(clinicData.province);
  if (clinicData.zipCode) addressParts.push(clinicData.zipCode);
  if (addressParts.length > 0) return addressParts.join(', ');
  if (clinicData.addressLine) return clinicData.addressLine;
  if (clinicData.name) return clinicData.name;
  return fallbackClinicName || 'Address not provided';
};

const formatClinicAndAddress = (clinicData: any, fallbackClinicName?: string): string => {
  const clinicName = clinicData?.name || fallbackClinicName || 'Unknown Clinic';
  const address = formatClinicAddress(clinicData, fallbackClinicName);
  if (address === clinicName) return clinicName;
  if (address.includes(clinicName)) return address;
  return `${clinicName}, ${address}`;
};

const formatDateTime = (dateString?: string, timeString?: string): string => {
  if (!dateString && !timeString) return 'Not specified';
  const date = dateString ? formatDate(dateString) : '';
  const time = timeString ? formatTime(timeString) : '';
  if (date && time) return `${date} at ${time}`;
  if (date) return date;
  if (time) return time;
  return 'Not specified';
};

export default function PatientReferralDetailsScreen() {
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

  useEffect(() => {
    if (id) {
      loadReferralData();
    }
  }, [id]);

  const loadReferralData = async () => {
    if (!id || !user) return;
    
    try {
      setLoading(true);
      
      const referral = await databaseService.getReferralById(id as string);
      
      if (referral) {
        let clinicData: any = null;
        let referringDoctorData: any = null;
        let specialistClinicData: any = null;
        let patientData: any = null;
        
        try {
          [clinicData, referringDoctorData, patientData] = await Promise.all([
            databaseService.getDocument(`clinics/${referral.referringClinicId}`),
            databaseService.getDocument(`specialists/${referral.referringGeneralistId}`),
            databaseService.getDocument(`users/${referral.patientId}`),
          ]);
        } catch (error) {
          console.log('Could not fetch clinic, doctor, or specialist data:', error);
        }
        
        // Fetch specialist clinic from schedule if available (patient view uses assignedSpecialistId)
        try {
          if (referral.assignedSpecialistId && referral.specialistScheduleId) {
            const specialistSchedules = await databaseService.getDocument(`specialistSchedules/${referral.assignedSpecialistId}`);
            const matchingSchedule = specialistSchedules?.[referral.specialistScheduleId];
            const practiceLocation = matchingSchedule?.practiceLocation;
            if (practiceLocation?.clinicId) {
              specialistClinicData = await databaseService.getDocument(`clinics/${practiceLocation.clinicId}`);
            }
          }
        } catch (error) {
          console.log('Could not fetch specialist schedule or clinic data:', error);
        }
        
        // Load medical history if completed
        let medicalHistory = null;
        if (referral.status.toLowerCase() === 'completed' && referral.referralConsultationId) {
          try {
            medicalHistory = await databaseService.getDocument(`patientMedicalHistory/${referral.patientId}/entries/${referral.referralConsultationId}`);
          } catch (error) {
            try {
              medicalHistory = await databaseService.getMedicalHistoryByAppointment(referral.clinicAppointmentId, referral.patientId);
            } catch (fallbackError) {
              console.log('Medical history not available');
            }
          }
        }
        
        const combinedReferralData: ReferralData = {
          ...referral,
          // Patient information (prefer fetched patient data if available)
          patientName: (() => {
            if (patientData) {
              const firstName = patientData.firstName || patientData.first_name || patientData.givenName || '';
              const lastName = patientData.lastName || patientData.last_name || patientData.familyName || '';
              const fullName = `${firstName} ${lastName}`.trim();
              if (fullName) return fullName;
            }
            if (referral.patientFirstName && referral.patientLastName) {
              return `${referral.patientFirstName} ${referral.patientLastName}`;
            }
            return 'Unknown Patient';
          })(),

          referringDoctorName:
            referringDoctorData?.firstName && referringDoctorData?.lastName
              ? `${referringDoctorData.firstName} ${referringDoctorData.lastName}`
              : `${referral.referringGeneralistFirstName || ''} ${referral.referringGeneralistLastName || ''}`.trim(),

          clinic: clinicData?.name || referral.referringClinicName || 'Unknown Clinic',
          date: referral.appointmentDate,
          time: referral.appointmentTime,
          address: formatClinicAddress(clinicData, clinicData?.name || referral.referringClinicName),
          clinicAndAddress: formatClinicAndAddress(clinicData, clinicData?.name || referral.referringClinicName),
          dateTime: formatDateTime(referral.appointmentDate, referral.appointmentTime),
          specialistClinic: specialistClinicData?.name || 'Not assigned',

          // Clinical fields
          presentIllnessHistory: (medicalHistory as any)?.presentIllnessHistory || '',
          reviewOfSymptoms: (medicalHistory as any)?.reviewOfSymptoms || '',
          labResults: (medicalHistory as any)?.labResults || '',
          medications: (medicalHistory as any)?.prescriptions
            ? (medicalHistory as any).prescriptions.map((p: any) => `${p.medication} ${p.dosage}`).join(', ')
            : '',
          diagnosis: (medicalHistory as any)?.diagnosis
            ? ((medicalHistory as any).diagnosis as any[]).map((d: any) => d.description).join(', ')
            : '',
          differentialDiagnosis: (medicalHistory as any)?.differentialDiagnosis || '',
          soapNotes: (medicalHistory as any)?.soapNotes || { subjective: '', objective: '', assessment: '', plan: '' },
          treatmentPlan: (medicalHistory as any)?.treatmentPlan || '',
          clinicalSummary: (medicalHistory as any)?.clinicalSummary || '',
        };
        
        setReferralData(combinedReferralData);

        // Load related prescriptions and certificates (with enrichment/fallbacks)
        let referralPrescriptions: any[] = [];
        let referralCertificates: any[] = [];

        if (referral.referralConsultationId && medicalHistory) {
          const potentialIds = new Set<string>();
          const providerId = (medicalHistory as any)?.provider?.userId || (medicalHistory as any)?.provider?.id;
          if (providerId) potentialIds.add(String(providerId));
          ((medicalHistory as any).prescriptions || []).forEach((pr: any) => {
            if (pr?.specialistId) potentialIds.add(String(pr.specialistId));
          });
          if ((referral as any)?.assignedSpecialistId) potentialIds.add(String((referral as any).assignedSpecialistId));

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

          const assignedSpecialistName = ((referral as any)?.assignedSpecialistFirstName || (referral as any)?.assignedSpecialistLastName)
            ? `${(referral as any)?.assignedSpecialistFirstName || ''} ${(referral as any)?.assignedSpecialistLastName || ''}`.trim()
            : undefined;
          const resolvedProviderName = (providerId && idToName[providerId])
            ? idToName[providerId]
            : (assignedSpecialistName || 'Unknown Doctor');

          referralPrescriptions = ((medicalHistory as any).prescriptions || []).map((prescription: any, index: number) => {
            const prescriberFromId = prescription?.specialistId ? idToName[String(prescription.specialistId)] : undefined;
            return {
              id: `${referral.referralConsultationId || 'mh'}-${index}`,
              ...prescription,
              prescribedBy: prescription.prescribedBy || prescriberFromId || resolvedProviderName,
            };
          });
          referralCertificates = (medicalHistory as any).certificates || [];
        } else {
          try {
            [referralPrescriptions, referralCertificates] = await Promise.all([
              databaseService.getPrescriptionsByAppointment(referral.clinicAppointmentId),
              databaseService.getCertificatesByAppointment(referral.clinicAppointmentId),
            ]);

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
          } catch (fallbackError) {
            console.log('Fallback method also failed for prescriptions/certificates:', fallbackError);
          }
        }

        setPrescriptions(referralPrescriptions);
        setCertificates(referralCertificates);
      }
    } catch (error) {
      console.error('Error loading referral data:', error);
      Alert.alert('Error', 'Failed to load referral details. Please try again.');
    } finally {
      setLoading(false);
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
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#1E40AF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Referral Details</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading referral details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!referralData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#1E40AF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Referral Details</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Referral not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Build avatar initials consistent with specialist UI
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
        contentContainerStyle={{ paddingBottom: (referralData.status?.toLowerCase?.() === 'completed') ? 90 : 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadReferralData} />
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#1E40AF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Referral Details</Text>
        </View>

        {/* Referral Information */}
        <View style={styles.sectionSpacing}>
          <Text style={styles.sectionTitle}>Referral Information</Text>
          <View style={styles.cardBox}>
            {/* Avatar initials (top-left) */}
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{avatarInitials}</Text>
            </View>
            {/* Fixed Status Badge (top-right) */}
            <View style={[styles.statusBadge, styles.statusBadgeFixed, styles.statusBadgeNeutral]}>
              {getMonotoneStatusIcon(referralData.status)}
              <Text style={styles.statusTextNeutral}>{getStatusText(referralData.status)}</Text>
            </View>

            <View style={styles.referralDetailsTable}> 
              <View style={styles.referralDetailsRow}>
                <Text style={styles.referralLabel}>Specialist</Text>
                <Text style={styles.referralValue}>
                  {(((referralData as any)?.assignedSpecialistFirstName || '') || ((referralData as any)?.assignedSpecialistLastName || ''))
                    ? formatDoctorName(`${(referralData as any)?.assignedSpecialistFirstName || ''} ${(referralData as any)?.assignedSpecialistLastName || ''}`.trim())
                    : 'Not assigned'}
                </Text>
              </View>
              <View style={styles.referralDetailsRow}>
                <Text style={styles.referralLabel}>Referring Generalist</Text>
                <Text style={styles.referralValue}>{formatDoctorName(referralData.referringDoctorName)}</Text>
              </View>
              <View style={styles.referralDetailsRowWrapped}>
                <Text style={styles.referralLabel}>Generalist Clinic</Text>
                <Text style={styles.referralValueWrapped}>{referralData.clinicAndAddress || 'Unknown Clinic'}</Text>
              </View>
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
              <View style={styles.referralDetailsRow}>
                <Text style={styles.referralLabel}>Specialist Clinic</Text>
                <Text style={styles.referralValue}>{referralData.specialistClinic || 'Not assigned'}</Text>
              </View>
              {referralData.practiceLocation?.roomOrUnit && (
                <View style={styles.referralDetailsRow}>
                  <Text style={styles.referralLabel}>Room/Unit</Text>
                  <Text style={styles.referralValue}>{(referralData as any).practiceLocation.roomOrUnit}</Text>
                </View>
              )}
              <View style={styles.referralDetailsRowNoBorder}>
                <Text style={styles.referralLabel}>Reason for Referral</Text>
                <Text style={styles.referralValue}>{referralData.initialReasonForReferral || 'Not specified'}</Text>
              </View>
              {referralData.generalistNotes && (
                <View style={styles.referralDetailsRowNoBorder}>
                  <Text style={styles.referralLabel}>Generalist Notes</Text>
                  <Text style={styles.referralValueNotes}>{referralData.generalistNotes}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Clinical Summary */}
        <View style={styles.sectionSpacing}>
          <Text style={styles.sectionTitle}>Clinical Summary</Text>
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
              {/* Patient History */}
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

              {/* Findings */}
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

              {/* Treatment */}
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

        {/* Prescriptions */}
        <View style={styles.sectionSpacing}>
          <Text style={styles.sectionTitle}>Prescriptions</Text>
          {referralData.status.toLowerCase() === 'completed' && prescriptions.length ? prescriptions.map((p, idx) => (
            <View key={p.id || idx} style={[styles.cardBox, styles.cardBoxPrescription]}>
              <View style={styles.prescriptionHeader}>
                <View style={[styles.medicationIcon, styles.medicationIconBlue]}>
                  <Pill size={20} color="#FFFFFF" />
                </View>
                <View style={styles.prescriptionDetails}>
                  <Text style={styles.medicationName}>{p.medication || 'Unknown Medication'}</Text>
                  <Text style={styles.medicationDosage}>{p.dosage || 'N/A'} • {p.frequency || 'N/A'}</Text>
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

        {/* Medical Certificates */}
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

        {/* View Visit Report (if completed) */}
        {referralData.status.toLowerCase() === 'completed' && (
          <View style={[styles.sectionSpacing, { marginTop: -10 }] }>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push({ pathname: '/consultation-report', params: { id: String(id) } })}
              activeOpacity={0.85}
            >
              <Download size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>View Visit Report</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom action bar (shown when completed) */}
      {referralData.status.toLowerCase() === 'completed' && (
        <View style={styles.buttonBarVertical}>
          <TouchableOpacity
            style={styles.primaryBottomButton}
            onPress={() => {
              Alert.alert('Download', 'Downloading referral record...');
            }}
            activeOpacity={0.8}
          >
            <Download size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBottomButtonText}>Download Record</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBottomButtonOutline}
            onPress={() => {
              Alert.alert('Hidden', 'Referral details hidden');
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

  // Clinical Summary card
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

  // Referral cards
  cardBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    paddingTop: 84,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },
  cardBoxPrescription: {
    paddingTop: 16,
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
  referralValueWrapped: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter-Regular',
    flex: 2,
    textAlign: 'right',
    lineHeight: 25,
    textAlignVertical: 'top',
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

  // Bottom bar buttons
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

  // Prescription styles
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

  // Certificate styles
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
    } as any;
  }
  return {
    container: {
      backgroundColor: '#FEF2F2',
      borderColor: '#EF4444',
    },
    icon: <XCircle size={17} color="#EF4444" style={{ marginRight: 4 }} />,
    text: { color: '#EF4444' },
    label: 'Expired',
  } as any;
}

