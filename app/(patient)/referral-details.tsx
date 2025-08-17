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
} from 'react-native';
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  User,
  MapPin,
  Calendar,
  Clock,
  Stethoscope,
  Pill,
  FileText,
  CheckCircle,
  XCircle,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/hooks/auth/useAuth';
import { databaseService, Referral, MedicalHistory } from '../../src/services/database/firebase';

interface ReferralData extends Referral {
  patientName?: string;
  referringDoctorName?: string;
  clinic?: string;
  address?: string;
  dateTime?: string;
  medicalHistory?: MedicalHistory;
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
  prescriptions?: any[];
  certificates?: any[];
}

export default function PatientReferralDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
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
        let clinicData = null;
        let referringDoctorData = null;
        let specialistData = null;
        
        try {
          [clinicData, referringDoctorData, specialistData] = await Promise.all([
            databaseService.getDocument(`clinics/${referral.referringClinicId}`),
            databaseService.getDocument(`specialists/${referral.referringGeneralistId}`),
            databaseService.getDocument(`specialists/${referral.assignedSpecialistId}`)
          ]);
        } catch (error) {
          console.log('Could not fetch clinic, doctor, or specialist data:', error);
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
          patientName: `${referral.patientFirstName} ${referral.patientLastName}`,
          referringDoctorName: referringDoctorData?.firstName && referringDoctorData?.lastName
            ? `Dr. ${referringDoctorData.firstName} ${referringDoctorData.lastName}`
            : `Dr. ${referral.referringGeneralistFirstName} ${referral.referringGeneralistLastName}`,
          clinic: clinicData?.name || referral.referringClinicName,
          address: clinicData?.address ? 
            [clinicData.address.street, clinicData.address.city, clinicData.address.state, clinicData.address.zipCode].filter(Boolean).join(', ') :
            'Address not available',
          dateTime: `${formatDate(referral.appointmentDate)} at ${formatTime(referral.appointmentTime)}`,
          medicalHistory: medicalHistory,
          presentIllnessHistory: medicalHistory?.presentIllnessHistory || '',
          reviewOfSymptoms: medicalHistory?.reviewOfSymptoms || '',
          labResults: medicalHistory?.labResults || '',
          medications: medicalHistory?.medications || '',
          diagnosis: medicalHistory?.diagnosis || '',
          differentialDiagnosis: medicalHistory?.differentialDiagnosis || '',
          soapNotes: medicalHistory?.soapNotes || {},
          treatmentPlan: medicalHistory?.treatmentPlan || '',
          clinicalSummary: medicalHistory?.clinicalSummary || '',
          prescriptions: medicalHistory?.prescriptions || [],
          certificates: medicalHistory?.certificates || [],
        };
        
        setReferralData(combinedReferralData);
      }
    } catch (error) {
      console.error('Error loading referral data:', error);
      Alert.alert('Error', 'Failed to load referral details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not specified';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      return dateString;
    }
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return 'Not specified';
    try {
      return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch (error) {
      return timeString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return '#10B981';
      case 'confirmed': return '#3B82F6';
      case 'pending': return '#F59E0B';
      case 'cancelled': return '#EF4444';
      default: return '#6B7280';
    }
  };

  // Monotone status helpers (align with specialist screen)
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

  const toggleSection = (key: string) => {
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
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#1E40AF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Referral Details</Text>
          <View style={styles.headerSpacer} />
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
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#1E40AF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Referral Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Referral not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Build avatar initials consistent with specialist UI
  const isPatientUser = user?.role === 'patient';
  const specialistName = `${referralData.assignedSpecialistFirstName || ''} ${referralData.assignedSpecialistLastName || ''}`.trim();
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
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Referral Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadReferralData} />
        }
      >
        {/* Referral Information (card with avatar + monotone badge) */}
        <View style={styles.sectionSpacing}>
          <Text style={styles.sectionTitle}>Referral Information</Text>
          <View style={styles.cardBox}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{avatarInitials}</Text>
            </View>
            <View style={[styles.statusBadge, styles.statusBadgeFixed, styles.statusBadgeNeutral]}>
              {getMonotoneStatusIcon(referralData.status)}
              <Text style={styles.statusTextNeutral}>{getStatusText(referralData.status)}</Text>
            </View>
            <View style={styles.referralDetailsTable}> 
              <View style={styles.referralDetailsRow}>
                <Text style={styles.referralLabel}>Specialist</Text>
                <Text style={styles.referralValue}>
                  {referralData.assignedSpecialistFirstName && referralData.assignedSpecialistLastName
                    ? `Dr. ${referralData.assignedSpecialistFirstName} ${referralData.assignedSpecialistLastName}`
                    : 'Not assigned'}
                </Text>
              </View>
              <View style={styles.referralDetailsRow}>
                <Text style={styles.referralLabel}>Referring Generalist</Text>
                <Text style={styles.referralValue}>{formatDoctorName(referralData.referringDoctorName)}</Text>
              </View>
              <View style={styles.referralDetailsRow}>
                <Text style={styles.referralLabel}>Clinic</Text>
                <Text style={styles.referralValue}>{referralData.clinic || 'Unknown Clinic'}</Text>
              </View>
              <View style={styles.referralDetailsRow}>
                <Text style={styles.referralLabel}>Date & Time</Text>
                <Text style={styles.referralValue}>{referralData.dateTime || 'Not specified'}</Text>
              </View>
              <View style={styles.referralDetailsRowNoBorder}>
                <Text style={styles.referralLabel}>Reason for Referral</Text>
                <Text style={styles.referralValue}>{referralData.initialReasonForReferral || 'Not specified'}</Text>
              </View>
              {!!referralData.generalistNotes && (
                <View style={styles.referralDetailsRowNoBorder}>
                  <Text style={styles.referralLabel}>Doctor's Notes</Text>
                  <Text style={styles.referralValue}>{referralData.generalistNotes}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Clinical Summary (match specialist UI), with fallbacks */}
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

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  statusContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  referralDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
    marginTop: 20,
  },
  referralDetailsTable: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  referralDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  referralDetailsRowNoBorder: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  referralLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
    flex: 1,
  },
  referralValue: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter-Medium',
    flex: 2,
    textAlign: 'right',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
    marginTop: 30,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
    marginLeft: 12,
    flex: 1,
  },
  sectionContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  clinicalFieldRow: {
    marginBottom: 16,
  },
  clinicalFieldLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
    marginBottom: 4,
  },
  clinicalFieldValue: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter-Medium',
    lineHeight: 20,
  },
  prescriptionItem: {
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  prescriptionMedication: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  prescriptionDetails: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  bottomSpacer: {
    height: 40,
  },
});

