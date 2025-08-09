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
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/hooks/auth/useAuth';
import { databaseService, Appointment, Prescription, Certificate } from '../../src/services/database/firebase';
import { safeDataAccess } from '../../src/utils/safeDataAccess';

// Extended interface for visit data that includes additional properties
interface VisitData extends Appointment {
  doctorName?: string;
  doctorPhoto?: string;
  clinic?: string;
  date?: string;
  time?: string;
  address?: string;
  diagnosis?: string;
  differentialDiagnosis?: string;
  reviewOfSymptoms?: string;
  presentIllnessHistory?: string;
  soapNotes?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  labResults?: string;
  allergies?: string;
  vitals?: string;
  medications?: string;
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

export default function VisitOverviewScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [visitData, setVisitData] = useState<VisitData | null>(null);
  const [prescriptions, setPrescriptions] = useState<ExtendedPrescription[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    clinicalSummary: true,
    prescriptions: true,
    certificates: true,
  });

  // Load visit data from Firebase
  useEffect(() => {
    if (id) {
      loadVisitData();
    }
  }, [id]);

  const loadVisitData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      
      // Load appointment data
      const appointment = await databaseService.getAppointmentById(id as string);
      
      if (appointment) {
        setVisitData(appointment);
        
        // Load related prescriptions and certificates
        const [visitPrescriptions, visitCertificates] = await Promise.all([
          databaseService.getPrescriptionsByAppointment(id as string),
          databaseService.getCertificatesByAppointment(id as string)
        ]);
        
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
          <Text style={styles.headerTitle}>Visit Overview</Text>
        </View>

        {/* --- CONSULTATION DETAILS --- */}
        <View style={styles.sectionSpacing}>
          <Text style={styles.sectionTitle}>Consultation Details</Text>
          <View style={styles.cardBox}>
            <View style={styles.doctorRow}>
              <Text style={styles.doctorName}>{visitData.doctorName || 'Unknown Doctor'}</Text>
              {/* <Image 
                source={{ uri: visitData.doctorPhoto || undefined }} 
                style={styles.doctorImage} 
                resizeMode="cover"
                defaultSource={require('../../assets/default-avatar.png')}
              /> */}
            </View>
            <View style={styles.consultDivider} />
            <View style={styles.consultDetailsTable}>
              <View style={styles.consultDetailsRow}>
                <Text style={styles.consultLabel}>Consultation ID</Text>
                <Text style={styles.consultValue}>{visitData.consultationId || 'N/A'}</Text>
              </View>
              <View style={styles.consultDetailsRow}>
                <Text style={styles.consultLabel}>Clinic</Text>
                <Text style={styles.consultValue}>{visitData.clinic || 'Unknown Clinic'}</Text>
              </View>
              <View style={styles.consultDetailsRow}>
                <Text style={styles.consultLabel}>Date</Text>
                <Text style={styles.consultValue}>{visitData.date || 'Not specified'}</Text>
              </View>
              <View style={styles.consultDetailsRow}>
                <Text style={styles.consultLabel}>Time</Text>
                <Text style={styles.consultValue}>{visitData.time || 'Not specified'}</Text>
              </View>
              <View style={styles.consultDetailsRowNoBorder}>
                <Text style={styles.consultLabel}>Address</Text>
                <Text style={styles.consultValue}>{visitData.address || 'Address not provided'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* --- CLINICAL SUMMARY --- */}
        <View style={styles.sectionSpacing}>
          <Text style={styles.sectionTitle}>Clinical Summary</Text>
          <View style={styles.cardBoxClinical}>
            {/* Clinical Summary fields will be loaded here from visitData */}
            {/* For now, we'll show a placeholder or load dynamically */}
            <TouchableOpacity style={styles.clinicalSectionHeader} onPress={() => toggleSection('clinicalSummary')}>
              <Text style={styles.clinicalSectionLabel}>Clinical Summary</Text>
              {expandedSections['clinicalSummary'] ? (
                <ChevronDown size={23} color="#6B7280" />
              ) : (
                <ChevronRight size={23} color="#9CA3AF" />
              )}
            </TouchableOpacity>
            {expandedSections['clinicalSummary'] && (
              <View style={styles.clinicalSectionBody}>
                {/* Placeholder for clinical summary fields */}
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Diagnosis:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.diagnosis || 'No diagnosis recorded'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Differential Diagnosis:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.differentialDiagnosis || 'No differential diagnosis recorded'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Review of Symptoms:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.reviewOfSymptoms || 'No symptoms reviewed'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Present Illness History:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.presentIllnessHistory || 'No illness history recorded'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>SOAP Notes:</Text>
                  <View style={styles.soapNotesContainer}>
                    <View style={styles.soapNotesSubRow}>
                      <Text style={styles.soapNotesLabel}>Subjective:</Text>
                      <Text style={styles.soapNotesValue}>{visitData.soapNotes?.subjective || 'No subjective notes'}</Text>
                    </View>
                    <View style={styles.soapNotesSubRow}>
                      <Text style={styles.soapNotesLabel}>Objective:</Text>
                      <Text style={styles.soapNotesValue}>{visitData.soapNotes?.objective || 'No objective notes'}</Text>
                    </View>
                    <View style={styles.soapNotesSubRow}>
                      <Text style={styles.soapNotesLabel}>Assessment:</Text>
                      <Text style={styles.soapNotesValue}>{visitData.soapNotes?.assessment || 'No assessment notes'}</Text>
                    </View>
                    <View style={styles.soapNotesSubRow}>
                      <Text style={styles.soapNotesLabel}>Plan:</Text>
                      <Text style={styles.soapNotesValue}>{visitData.soapNotes?.plan || 'No plan notes'}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Lab Results:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.labResults || 'No lab results recorded'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Allergies:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.allergies || 'No allergies recorded'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Vitals:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.vitals || 'No vitals recorded'}</Text>
                </View>
                <View style={styles.clinicalFieldRow}>
                  <Text style={styles.clinicalFieldLabel}>Medications:</Text>
                  <Text style={styles.clinicalFieldValue}>{visitData.medications || 'No medications recorded'}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* --- PRESCRIPTIONS --- */}
        <View style={styles.sectionSpacing}>
          <Text style={styles.sectionTitle}>Prescriptions</Text>
          {prescriptions.length ? prescriptions.map((p) => (
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
          )) : (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateText}>No prescriptions for this visit.</Text>
            </View>
          )}
        </View>

        {/* --- MEDICAL CERTIFICATES --- */}
        <View style={styles.sectionSpacing}>
          <Text style={styles.sectionTitle}>Medical Certificates</Text>
          {certificates.length ? certificates.map((cert) => {
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
          }) : (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateText}>No certificates were issued for this visit.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* --- BOTTOM ACTION BAR (VERTICAL, OUTLINED SECONDARY) --- */}
      <View style={styles.buttonBarVertical}>
        <TouchableOpacity
          style={styles.primaryBottomButton}
          onPress={() => {
            alert('Downloading record...');
          }}
          activeOpacity={0.8}
        >
          <Download size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.primaryBottomButtonText}>Download Record</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBottomButtonOutline}
          onPress={() => {
            alert('Visit details hidden');
          }}
          activeOpacity={0.8}
        >
          <Eye size={18} color="#1E40AF" style={{ marginRight: 8 }} />
          <Text style={styles.secondaryBottomButtonOutlineText}>Hide Visit Details</Text>
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
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 13,
    justifyContent: 'space-between',
  },
  doctorName: {
    fontSize: 16,
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
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
  soapNotesContainer: {
    marginTop: 5,
    paddingLeft: 10,
  },
  soapNotesSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  soapNotesLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  soapNotesValue: {
    fontSize: 14,
    color: '#23272F',
    fontFamily: 'Inter-Medium',
    textAlign: 'right',
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

