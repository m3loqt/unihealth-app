import React, { useState } from 'react';
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
import { router } from 'expo-router';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const HORIZONTAL_MARGIN = 24;

const doctorPhoto = 'https://randomuser.me/api/portraits/women/44.jpg';

const consultationId = 'CONS-20240721-1201';
const doctorName = 'Dr. Emily Davis';
const clinic = 'Family Health Center';
const date = 'Dec 10, 2024';
const time = '3:00 PM';
const address = '789 Care Blvd, Room 102';

const clinicalSummary = {
  diagnosis: 'Mild Hypertension, controlled',
  differentialDiagnosis: 'Secondary Hypertension, White Coat Syndrome',
  reviewOfSymptoms: 'No chest pain, shortness of breath, or palpitations. Mild headache noted.',
  presentIllnessHistory: '52-year-old male presenting for routine follow-up. Reports intermittent mild headaches. No recent medication changes.',
  soapNotes: {
    subjective: 'Reports feeling well overall, mild fatigue.',
    objective: 'BP: 138/86 mmHg, Pulse: 72 bpm, Temp: 36.6°C. Heart/lungs clear.',
    assessment: 'Stable, controlled hypertension. No acute findings.',
    plan: 'Continue current medication. Encourage dietary changes. Repeat labs in 3 months.',
  },
  labResults: 'CBC and Lipid Profile within normal limits. Fasting blood sugar slightly elevated.',
  allergies: 'None',
  medications: 'Lisinopril 10mg daily',
  vitals: 'BP: 138/86 mmHg, Pulse: 72 bpm, Temp: 36.6°C',
};

const prescriptions = [
  {
    id: 1,
    medication: 'Lisinopril',
    dosage: '10mg',
    frequency: 'Once daily',
    remaining: '15 days',
    color: '#1E3A8A',
    description: 'Helps lower blood pressure.',
    prescribedBy: 'Dr. Emily Davis',
    prescribedDate: 'Dec 10, 2024',
    nextRefill: 'Jan 4, 2025',
  },
];

const certificates = [
  {
    id: 1,
    type: 'Fit to Work',
    doctor: 'Dr. Sarah Connor',
    clinic: 'Occupational Health Center',
    issuedDate: 'Jan 15, 2024',
    issuedTime: '09:30 AM',
    status: 'Valid',
  },
];

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

const clinicalSections = [
  {
    key: 'diagnosis',
    label: 'Diagnosis',
    fields: [
      { label: 'Diagnosis', value: clinicalSummary.diagnosis },
      { label: 'Differential Diagnosis', value: clinicalSummary.differentialDiagnosis },
    ],
  },
  {
    key: 'history',
    label: 'History',
    fields: [
      { label: 'History of Present Illness', value: clinicalSummary.presentIllnessHistory },
      { label: 'Review of Symptoms', value: clinicalSummary.reviewOfSymptoms },
    ],
  },
  {
    key: 'soapNotes',
    label: 'SOAP Notes',
    fields: [
      { label: 'Subjective', value: clinicalSummary.soapNotes.subjective },
      { label: 'Objective', value: clinicalSummary.soapNotes.objective },
      { label: 'Assessment', value: clinicalSummary.soapNotes.assessment },
      { label: 'Plan', value: clinicalSummary.soapNotes.plan },
    ],
  },
  {
    key: 'labResults',
    label: 'Lab Results',
    fields: [
      { label: 'Lab Results', value: clinicalSummary.labResults },
      { label: 'Allergies', value: clinicalSummary.allergies },
      { label: 'Vitals', value: clinicalSummary.vitals },
    ],
  },
  {
    key: 'medications',
    label: 'Medications',
    fields: [
      { label: 'Medications', value: clinicalSummary.medications },
    ],
  },
];

export default function VisitOverviewScreen() {
  // All sections open by default, each can be toggled individually
  const [openSections, setOpenSections] = useState({
    diagnosis: true,
    history: true,
    soapNotes: true,
    labResults: true,
    medications: true,
  });

  const toggleSection = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev],
    }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
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
              <Text style={styles.doctorName}>{doctorName}</Text>
              <Image source={{ uri: doctorPhoto }} style={styles.doctorImage} resizeMode="cover" />
            </View>
            <View style={styles.consultDivider} />
            <View style={styles.consultDetailsTable}>
              <View style={styles.consultDetailsRow}>
                <Text style={styles.consultLabel}>Consultation ID</Text>
                <Text style={styles.consultValue}>{consultationId}</Text>
              </View>
              <View style={styles.consultDetailsRow}>
                <Text style={styles.consultLabel}>Clinic</Text>
                <Text style={styles.consultValue}>{clinic}</Text>
              </View>
              <View style={styles.consultDetailsRow}>
                <Text style={styles.consultLabel}>Date</Text>
                <Text style={styles.consultValue}>{date}</Text>
              </View>
              <View style={styles.consultDetailsRow}>
                <Text style={styles.consultLabel}>Time</Text>
                <Text style={styles.consultValue}>{time}</Text>
              </View>
              <View style={styles.consultDetailsRowNoBorder}>
                <Text style={styles.consultLabel}>Address</Text>
                <Text style={styles.consultValue}>{address}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* --- CLINICAL SUMMARY --- */}
        <View style={styles.sectionSpacing}>
          <Text style={styles.sectionTitle}>Clinical Summary</Text>
          <View style={styles.cardBoxClinical}>
            {clinicalSections.map((section, idx) => (
              <View key={section.key}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[
                    styles.clinicalSectionHeader,
                    openSections[section.key as keyof typeof openSections] && styles.clinicalSectionHeaderOpen,
                    idx === 0 && { marginTop: 2 },
                  ]}
                  onPress={() => toggleSection(section.key)}
                >
                  <Text style={styles.clinicalSectionLabel}>{section.label}</Text>
                  {openSections[section.key as keyof typeof openSections] ? (
                    <ChevronDown size={23} color="#6B7280" />
                  ) : (
                    <ChevronRight size={23} color="#9CA3AF" />
                  )}
                </TouchableOpacity>
                {openSections[section.key as keyof typeof openSections] && (
                  <View style={styles.clinicalSectionBody}>
                    {section.fields.map((field, i) => (
                      <View
                        key={field.label}
                        style={[
                          styles.clinicalFieldRow,
                          i < section.fields.length - 1 && styles.clinicalFieldRowWithGap,
                        ]}
                      >
                        <Text style={styles.clinicalFieldLabel}>{field.label}</Text>
                        <Text style={styles.clinicalFieldValue}>{field.value}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {idx < clinicalSections.length - 1 && (
                  <View style={styles.sectionDivider} />
                )}
              </View>
            ))}
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
                  <Text style={styles.medicationName}>{p.medication}</Text>
                  <Text style={styles.medicationDosage}>{p.dosage} • {p.frequency}</Text>
                  <Text style={styles.prescriptionDescription}>{p.description}</Text>
                </View>
                <View style={styles.prescriptionStatus}>
                  <Text style={styles.remainingDays}>{p.remaining}</Text>
                  <Text style={styles.remainingLabel}>remaining</Text>
                </View>
              </View>
              <View style={styles.prescriptionMeta}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Prescribed by:</Text>
                  <Text style={styles.metaValue}>{p.prescribedBy}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Next refill:</Text>
                  <Text style={styles.metaValue}>{p.nextRefill}</Text>
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
                  <Text style={styles.certificateType}>{cert.type}</Text>
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
                  <Text style={styles.certificateInfoValue}>{cert.doctor}</Text>
                </View>
                <View style={styles.certificateInfoRow}>
                  <Text style={styles.certificateLabel}>Issued on:</Text>
                  <Text style={styles.certificateInfoValue}>{cert.issuedDate}</Text>
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

