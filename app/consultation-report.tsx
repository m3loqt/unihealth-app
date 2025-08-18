import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Download } from 'lucide-react-native';
import { databaseService } from '../src/services/database/firebase';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';

type MedicalHistory = any;

export default function ConsultationReportScreen() {
  const { id } = useLocalSearchParams(); // referralId
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referral, setReferral] = useState<any>(null);
  const [clinic, setClinic] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [history, setHistory] = useState<MedicalHistory | null>(null);
  const reportRef = useRef<View>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const refData = await databaseService.getReferralById(String(id));
        if (!refData) {
          setError('Referral not found');
          setLoading(false);
          return;
        }
        setReferral(refData);

        // Fetch related entities
        const [clinicData, patientData, specialistData] = await Promise.all([
          refData.referringClinicId ? databaseService.getDocument(`clinics/${refData.referringClinicId}`) : null,
          refData.patientId ? databaseService.getDocument(`users/${refData.patientId}`) : null,
          refData.assignedSpecialistId ? databaseService.getDocument(`specialists/${refData.assignedSpecialistId}`) : null,
        ]);
        setClinic(clinicData);
        setPatient(patientData);
        setProvider(specialistData);

        let mh: MedicalHistory | null = null;
        if (refData?.referralConsultationId) {
          mh = await databaseService.getDocument(
            `patientMedicalHistory/${refData.patientId}/entries/${refData.referralConsultationId}`
          );
        }
        if (!mh && refData?.clinicAppointmentId) {
          try {
            mh = await databaseService.getMedicalHistoryByAppointment(refData.clinicAppointmentId, refData.patientId);
          } catch {}
        }
        setHistory(mh);
      } catch (e) {
        setError('Failed to load report');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const requestMediaPermission = async () => {
    try {
      const res = await MediaLibrary.requestPermissionsAsync();
      return res.granted;
    } catch {
      return false;
    }
  };

  const handleDownloadReport = async () => {
    try {
      const ok = await requestMediaPermission();
      if (!ok) {
        Alert.alert('Permission required', 'Please allow media library access to save the report.');
        return;
      }
      if (!reportRef.current) return;
      const uri = await captureRef(reportRef, { format: 'png', quality: 1 });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', 'Report saved to your gallery.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save report.');
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return String(date);
    }
  };

  const formatTime = (time?: string) => {
    if (!time) return '—';
    if (time.includes('AM') || time.includes('PM')) return time;
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const fullName = (obj: any, fallback = '—') => {
    if (!obj) return fallback;
    const first = obj.firstName || obj.first_name || '';
    const last = obj.lastName || obj.last_name || '';
    const name = `${first} ${last}`.trim();
    return name || fallback;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Visit Report</Text>
        <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadReport}>
          <Download size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }}>
        <View ref={reportRef} collapsable={false} style={styles.reportPage}>
          {/* Top brand bar */}
          <View style={styles.brandBar}>
            <Text style={styles.brandText}>UNIHEALTH • Patient Visit Summary</Text>
          </View>

          {/* Clinic + Patient header */}
          <View style={styles.topBlock}>
            <View style={{ flex: 1 }}>
              <Text style={styles.clinicName}>{clinic?.name || referral?.referringClinicName || 'Clinic'}</Text>
              {!!clinic?.address && <Text style={styles.clinicMeta}>{clinic.address}</Text>}
              {!!clinic?.city && (
                <Text style={styles.clinicMeta}>{clinic.city}{clinic?.province ? `, ${clinic.province}` : ''}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{fullName(patient, 'Unknown Patient')}</Text>
              <Text style={styles.patientMeta}>Date: {formatDate(referral?.appointmentDate)} {formatTime(referral?.appointmentTime)}</Text>
              <Text style={styles.patientMeta}>Specialist: Dr. {fullName(provider, 'Unknown')}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reason for Visit</Text>
            <Text style={styles.sectionValue}>{referral?.initialReasonForReferral || 'Not specified'}</Text>
          </View>

          <View style={styles.sectionRow}>
            <View style={[styles.section, { flex: 1, marginRight: 8 }] }>
              <Text style={styles.sectionTitle}>History of Present Illness</Text>
              <Text style={styles.sectionValue}>{history?.presentIllnessHistory || 'Not recorded'}</Text>
            </View>
            <View style={[styles.section, { flex: 1, marginLeft: 8 }] }>
              <Text style={styles.sectionTitle}>Review of Symptoms</Text>
              <Text style={styles.sectionValue}>{history?.reviewOfSymptoms || 'Not recorded'}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Findings & Results</Text>
            <Text style={styles.fieldLabel}>Lab Results</Text>
            <Text style={styles.sectionValue}>{history?.labResults || 'No lab results recorded'}</Text>
            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Medications</Text>
            <Text style={styles.sectionValue}>
              {Array.isArray(history?.prescriptions) && history?.prescriptions?.length
                ? history?.prescriptions.map((p: any) => `${p.medication} ${p.dosage} • ${p.frequency || ''}`).join('\n')
                : 'No medications recorded'}
            </Text>
          </View>

          <View style={styles.sectionRow}>
            <View style={[styles.section, { flex: 1, marginRight: 8 }] }>
              <Text style={styles.sectionTitle}>Diagnosis</Text>
              <Text style={styles.sectionValue}>
                {Array.isArray(history?.diagnosis) && history?.diagnosis?.length
                  ? history?.diagnosis.map((d: any) => `${d.code ? `${d.code}: ` : ''}${d.description}`).join('\n')
                  : 'No diagnosis recorded'}
              </Text>
            </View>
            <View style={[styles.section, { flex: 1, marginLeft: 8 }] }>
              <Text style={styles.sectionTitle}>Differential Diagnosis</Text>
              <Text style={styles.sectionValue}>{history?.differentialDiagnosis || 'Not recorded'}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SOAP Notes</Text>
            <Text style={styles.fieldLabel}>Subjective</Text>
            <Text style={styles.sectionValue}>{history?.soapNotes?.subjective || '—'}</Text>
            <Text style={styles.fieldLabel}>Objective</Text>
            <Text style={styles.sectionValue}>{history?.soapNotes?.objective || '—'}</Text>
            <Text style={styles.fieldLabel}>Assessment</Text>
            <Text style={styles.sectionValue}>{history?.soapNotes?.assessment || '—'}</Text>
            <Text style={styles.fieldLabel}>Plan</Text>
            <Text style={styles.sectionValue}>{history?.soapNotes?.plan || '—'}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Treatment & Summary</Text>
            <Text style={styles.fieldLabel}>Treatment Plan</Text>
            <Text style={styles.sectionValue}>{history?.treatmentPlan || '—'}</Text>
            <Text style={styles.fieldLabel}>Clinical Summary</Text>
            <Text style={styles.sectionValue}>{history?.clinicalSummary || '—'}</Text>
          </View>

          {/* Footer */}
          <View style={styles.footerBar}>
            <Text style={styles.footerText}>Generated by UniHealth • {new Date().toLocaleString()}</Text>
          </View>
        </View>
      </ScrollView>
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
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  downloadBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { flex: 1 },
  reportPage: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  brandBar: {
    backgroundColor: '#1E40AF',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  brandText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    textAlign: 'center',
  },
  topBlock: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  clinicName: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 2,
  },
  clinicMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#6B7280',
  },
  patientName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 2,
    textAlign: 'right',
  },
  patientMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 6,
  },
  fieldLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  sectionValue: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
    whiteSpace: 'pre-wrap' as any,
  },
  footerBar: {
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  footerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});


