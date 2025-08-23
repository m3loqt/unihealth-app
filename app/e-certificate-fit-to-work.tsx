import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Download, Share2 } from 'lucide-react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Modal, Button } from '../src/components/ui';
import { COLORS } from '../src/constants/colors';
import { databaseService } from '../src/services/database/firebase';
import { useAuth } from '../src/hooks/auth/useAuth';

type CertificateData = {
  id?: string;
  type: string;
  fitnessStatement?: string;
  workRestrictions?: string;
  nextReviewDate?: string;
  unfitPeriodStart?: string;
  unfitPeriodEnd?: string;
  medicalAdvice?: string;
  reasonForUnfitness?: string;
  followUpDate?: string;
  travelFitnessStatement?: string;
  travelMode?: string;
  destination?: string;
  travelDate?: string;
  specialConditions?: string;
  validityPeriod?: string;
  description: string;
  createdAt: string;
};

export default function FitToWorkCertificateScreen() {
  const { id, certificateId } = useLocalSearchParams(); // consultationId or referralId, certificateId
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referral, setReferral] = useState<any>(null);
  const [clinic, setClinic] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [providerUser, setProviderUser] = useState<any>(null);
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [downloadSavedPath, setDownloadSavedPath] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        
        // Load referral or appointment data
        let refData = null;
        let appointmentData = null;
        
        try {
          refData = await databaseService.getReferralById(String(id));
        } catch {}
        
        if (!refData) {
          try {
            appointmentData = await databaseService.getAppointmentById(String(id));
          } catch {}
        }
        
        const dataSource = refData || appointmentData;
        if (!dataSource) {
          setError('Consultation not found');
          setLoading(false);
          return;
        }
        
        setReferral(refData);
        
        // Related entities
        const [clinicData, userData, patientProfileData, specialistData, specialistUserDoc] = await Promise.all([
          dataSource.referringClinicId ? databaseService.getDocument(`clinics/${dataSource.referringClinicId}`) : null,
          dataSource.patientId ? databaseService.getDocument(`users/${dataSource.patientId}`) : null,
          dataSource.patientId ? databaseService.getDocument(`patients/${dataSource.patientId}`) : null,
          dataSource.assignedSpecialistId ? databaseService.getSpecialistProfile(dataSource.assignedSpecialistId) : null,
          dataSource.assignedSpecialistId ? databaseService.getDocument(`users/${dataSource.assignedSpecialistId}`) : null,
        ]);
        
        setClinic(clinicData);
        setPatient({ ...(userData || {}), ...(patientProfileData || {}) });
        setProvider(specialistData);
        setProviderUser(specialistUserDoc);

        // Load certificate data if certificateId is provided
        if (certificateId) {
          try {
            const medicalHistory = await databaseService.getMedicalHistoryByAppointment(String(id), dataSource.patientId);
            if (medicalHistory?.certificates) {
              const foundCertificate = medicalHistory.certificates.find((c: any) => c.id === certificateId);
              if (foundCertificate) {
                setCertificate(foundCertificate);
              }
            }
          } catch {}
        }

        // If no certificate found, create a default one for preview
        if (!certificate) {
          const defaultCertificate: CertificateData = {
            type: 'Fit to Work Certificate',
            fitnessStatement: 'The patient has been examined and is found to be medically fit to return to work.',
            workRestrictions: 'None',
            nextReviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
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
            description: 'Fit to Work Certificate',
            createdAt: new Date().toISOString(),
          };
          setCertificate(defaultCertificate);
        }
        
      } catch (e) {
        setError('Failed to load certificate data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, certificateId]);

  // Load logo for watermark/brand
  useEffect(() => {
    (async () => {
      try {
        const asset = Asset.fromModule(require('../assets/images/HEALTH Logo.png'));
        await asset.downloadAsync();
        const localUri = asset.localUri || asset.uri;
        if (localUri) {
          const b64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
          setLogoDataUri(`data:image/png;base64,${b64}`);
        }
      } catch {}
    })();
  }, []);

  const safe = (val?: any) => {
    if (val === undefined || val === null) return '—';
    const str = String(val);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br/>');
  };

  const fullName = (obj: any, fallback: string = '—') => {
    if (!obj) return fallback;
    const first = obj.firstName || obj.first_name || '';
    const last = obj.lastName || obj.last_name || '';
    const name = `${first} ${last}`.trim();
    return name || fallback;
  };

  const formatDateFlexible = (input?: any) => {
    if (!input) return '—';
    try {
      if (typeof input === 'object' && input.seconds) {
        return new Date(input.seconds * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }
      const str = String(input);
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return new Date(`${str}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }
      const asDate = new Date(str);
      if (!isNaN(asDate.getTime())) {
        return asDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }
      return str;
    } catch {
      return String(input);
    }
  };

  const computeAgeFromInput = (input?: any): string => {
    if (!input) return '—';
    try {
      let birth: Date | null = null;
      if (typeof input === 'object' && input?.seconds) {
        birth = new Date(input.seconds * 1000);
      } else if (typeof input === 'object' && typeof input?.toDate === 'function') {
        birth = input.toDate();
      } else {
        const str = String(input);
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
          birth = new Date(`${str}T00:00:00Z`);
        } else if (/^\d{10,13}$/.test(str)) {
          const ms = str.length === 13 ? Number(str) : Number(str) * 1000;
          birth = new Date(ms);
        } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
          const [a, b, y] = str.split('/').map(Number);
          const month = (a > 12 ? b : a) - 1;
          const day = a > 12 ? a : b;
          birth = new Date(Date.UTC(y, month, day));
        } else {
          const d = new Date(str);
          if (!isNaN(d.getTime())) birth = d;
        }
      }
      if (!birth) return '—';
      const today = new Date();
      let years = today.getFullYear() - birth.getFullYear();
      const monthDelta = today.getMonth() - birth.getMonth();
      if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
        years--;
      }
      return years >= 0 && years <= 130 ? String(years) : '—';
    } catch {
      return '—';
    }
  };

  const html = useMemo(() => {
    const brandPrimary = '#1E40AF';
    const subtle = '#6B7280';
    const border = '#E5E7EB';
    const text = '#111827';

    const clinicName = safe(clinic?.name || referral?.referringClinicName || 'Clinic');
    const addressParts = [
      clinic?.addressLine || clinic?.address || clinic?.addressLine1 || clinic?.street,
      clinic?.addressLine2,
      clinic?.barangay,
      clinic?.district,
      clinic?.city || clinic?.municipality,
      clinic?.province || clinic?.province,
      clinic?.postalCode || clinic?.zip || clinic?.zipCode,
      clinic?.country,
    ].filter(Boolean);
    const clinicAddress = safe(addressParts.join(', '));
    const clinicContact = safe((clinic?.contactNumber || clinic?.phone || clinic?.telephone || '') as any);
    const patientName = safe(fullName(patient, 'Unknown Patient'));
    const dob = safe(formatDateFlexible((patient?.dateOfBirth || patient?.dob || patient?.birthDate) as any));
    const age = computeAgeFromInput(patient?.dateOfBirth || patient?.dob || patient?.birthDate);
    const gender = safe((patient?.gender || patient?.sex || '') as any);
    const doctorName = safe(fullName(provider, (`${referral?.assignedSpecialistFirstName || ''} ${referral?.assignedSpecialistLastName || ''}`).trim() || 'Unknown'));
            const dateIssued = safe(formatDateFlexible(certificate?.createdAt));
    const examinationDate = safe(formatDateFlexible(certificate?.createdAt));
    const certificateId = safe(certificate?.id || `FTW-${Date.now()}`);
    const fitnessStatement = safe(certificate?.fitnessStatement || 'The patient has been examined and is found to be medically fit to return to work.');
    const workRestrictions = safe(certificate?.workRestrictions || 'None');
    const nextReviewDate = safe(formatDateFlexible(certificate?.nextReviewDate));

    const ageText = age && age !== '—' ? `${age} years old` : '—';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    @page { size: 8.5in 11in; margin: 0.5in; }
    html, body { margin: 0; padding: 0; background: #F3F4F6; color: ${text}; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: -apple-system, system-ui, Segoe UI, Roboto, Helvetica, Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"; }
    .preview { display: flex; flex-direction: column; align-items: center; padding: 16px; }
    .page { width: 100%; max-width: 8.5in; background: #FFFFFF; box-shadow: 0 2px 16px rgba(0,0,0,0.08); position: relative; border: 1px solid ${border}; display: flex; flex-direction: column; box-sizing: border-box; }
    .page .header, .page .top, .page .footer, .page .body { position: relative; z-index: 1; }
    .watermark { position: absolute; left: 0; right: 0; bottom: 56px; top: auto; display: flex; align-items: center; justify-content: center; opacity: 0.1; z-index: 0; pointer-events: none; }
    .watermark img { max-width: 65%; max-height: 65%; object-fit: contain; }

    .header { padding: 10px 16px; background: ${brandPrimary}; color: #fff; display: flex; align-items: center; justify-content: space-between; font-weight: 700; font-size: 14px; letter-spacing: 0.3px; }
    .brand-left { font-weight: 800; }
    .brand-right { font-weight: 600; opacity: 0.95; }

    .top { padding: 16px; }
    .clinic-name { font-weight: 700; font-size: 16px; margin: 0 0 2px; color: #111827; }
    .muted { color: ${subtle}; font-size: 12px; margin: 0; }
    .row { display: flex; gap: 16px; }
    .cell { flex: 1; }
    .label { color: ${subtle}; font-size: 12px; margin: 6px 0 2px; font-weight: 500; }
    .value { font-size: 13px; line-height: 1.6; }
    .strong { font-weight: 600; color: #111827; }
    .certificate-title { font-weight: 700; font-size: 18px; color: #1F2937; margin: 20px 0 16px; text-align: center; }

    .body { flex: 1; display: flex; flex-direction: column; padding: 0 24px; }
    .footer { padding: 8px 16px; color: ${subtle}; font-size: 11px; background: #F9FAFB; display: flex; align-items: center; justify-content: space-between; }
    .divider { height: 1px; background: ${border}; width: calc(100% - 48px); margin: 10px auto; }
    .divider-wider { width: calc(100% - 30px); }
    
    .certificate-content { margin: 20px 0; line-height: 1.8; font-size: 15px; color: #374151; }
    .certificate-statement { margin: 16px 0; padding: 16px; background: #F9FAFB; border-left: 4px solid ${brandPrimary}; border-radius: 4px; }
    .certificate-statement-text { font-size: 16px; line-height: 1.7; color: #1F2937; }
    
    .signature-section { margin-top: 40px; text-align: right; }
    .signature-wrap { text-align: left; display: inline-block; }
    .signature-line { height: 1px; background: ${border}; margin: 4px 0 6px 0; width: 200px; }
    .signature-name { color: #374151; font-size: 14px; font-weight: 700; }
    .signature-caption { color: ${subtle}; font-size: 12px; margin-top: 6px; }
    .signature-label { color: ${subtle}; font-size: 11px; margin-top: 6px; }

    @media screen and (max-width: 640px) { .certificate-content { font-size: 14px; } }
    @media print { .preview { padding: 0; } .page { box-shadow: none; width: 8.5in; height: 11in; border: none; margin: 0 auto; max-width: 8.5in; } }
    @media screen { .page { height: calc(100vh - 30px); aspect-ratio: 8.5 / 11; overflow: hidden; } }
  </style>
</head>
<body>
  <div class="preview">
    <div class="page">
      <div class="watermark">${logoDataUri ? `<img src="${logoDataUri}" />` : ''}</div>
      <div class="header"><span class="brand-left">UNIHEALTH</span><span class="brand-right">Medical Certificate</span></div>
      
      <div class="top">
        <div class="row">
          <div class="cell">
            <p class="label">Patient</p>
            <div class="value" style="font-size:16px; font-weight:700;">${patientName}</div>
            <p class="label">Age</p>
            <div class="value strong">${ageText}</div>
            <p class="label">Sex</p>
            <div class="value strong">${gender}</div>
          </div>
          <div class="cell" style="text-align:right">
            <p class="label">Certificate ID</p>
            <div class="value strong" style="font-size:16px; font-weight:700;">${certificateId}</div>
            <p class="label">Date Issued</p>
            <div class="value strong">${dateIssued}</div>
            <p class="label">Examination Date</p>
            <div class="value strong">${examinationDate}</div>
          </div>
        </div>
      </div>
      
      <div class="divider divider-wider"></div>

      <div class="body">
        <h1 class="certificate-title">FIT TO WORK CERTIFICATE</h1>
        
        <div class="certificate-content">
          <p>This is to certify that <strong>${patientName}</strong>, ${ageText}, ${gender}, was examined on <strong>${examinationDate}</strong> and is found to be medically fit to return to work.</p>
          
          <div class="certificate-statement">
            <div class="certificate-statement-text">
              <strong>Medical Assessment:</strong><br/>
              ${fitnessStatement}
            </div>
          </div>
          
          <p><strong>Work Restrictions:</strong> ${workRestrictions}</p>
          
          ${nextReviewDate && nextReviewDate !== '—' ? `<p><strong>Next Review Date:</strong> ${nextReviewDate}</p>` : ''}
          
          <p>This certificate is valid for employment purposes and confirms that the patient has been cleared to resume normal work activities.</p>
        </div>

        <div class="signature-section">
          <div class="signature-wrap">
            <div class="signature-label">Attending Physician</div>
            <div class="signature-name">Dr. ${doctorName}</div>
            <div class="signature-line"></div>
            ${provider?.prcId ? `<div class="signature-caption">PRC License No.: ${safe(provider.prcId)}</div>` : ''}
            ${provider?.phone || provider?.contactNumber ? `<div class="signature-caption">Contact: ${safe(provider.phone || provider.contactNumber)}</div>` : ''}
            ${providerUser?.email ? `<div class="signature-caption">Email: ${safe(providerUser.email)}</div>` : ''}
          </div>
        </div>
      </div>

      <div class="footer">
        <span class="footer-left">Generated by UniHealth • ${new Date().toLocaleString()}</span>
        <span class="footer-right">Page 1 of 1</span>
      </div>
    </div>
  </div>
  <script>
    (function(){
      // Signature line width = doctor name width + 10px
      var nameEl = document.querySelector('.signature-name');
      var lineEl = document.querySelector('.signature-line');
      if (nameEl && lineEl) {
        var w = Math.ceil(nameEl.getBoundingClientRect().width) + 10;
        lineEl.style.width = w + 'px';
      }
    })();
  </script>
</body>
</html>`;
  }, [clinic, patient, provider, referral, certificate, logoDataUri]);

  const handleGeneratePdf = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html, width: 576, height: 792, base64: false });
      return uri;
    } catch (e) {
      Alert.alert('Error', 'Failed to generate PDF.');
      return null;
    }
  };

  const handleDownloadPdf = async () => {
    const uri = await handleGeneratePdf();
    if (!uri) return;
    try {
      const filename = `UniHealth_FitToWork_Certificate_${Date.now()}.pdf`;
      if (Platform.OS === 'android') {
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
            const createdUri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              filename,
              'application/pdf'
            );
            await FileSystem.StorageAccessFramework.writeAsStringAsync(createdUri, base64, { encoding: FileSystem.EncodingType.Base64 });
            setDownloadSavedPath('Saved to selected folder');
            setDownloadModalVisible(true);
            return;
          }
        } catch {}
      }
      const dest = FileSystem.documentDirectory + filename;
      await FileSystem.copyAsync({ from: uri, to: dest });
      setDownloadSavedPath(dest);
      setDownloadModalVisible(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to save PDF.');
    }
  };

  const handleSharePdf = async () => {
    const uri = await handleGeneratePdf();
    if (!uri) return;
    try {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
    } catch (e) {
      Alert.alert('Error', 'Failed to share PDF.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fit to Work Certificate</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ flex: 1 }}>
        {!!error && (
          <View style={{ padding: 16 }}>
            <Text style={{ color: '#B91C1C' }}>{error}</Text>
          </View>
        )}
        {!error && (
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html }}
            style={{ flex: 1, backgroundColor: '#F3F4F6' }}
          />
        )}
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={[styles.primaryBtn]} onPress={handleDownloadPdf}>
          <Download size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Download Certificate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryBtn]} onPress={handleSharePdf}>
          <Share2 size={18} color="#1E40AF" />
          <Text style={styles.secondaryText}>Share Certificate</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={downloadModalVisible}
        onClose={() => setDownloadModalVisible(false)}
        showBackdrop
        backdropOpacity={0.4}
      >
        <View style={{ alignItems: 'center', gap: 12 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={36} color={COLORS.primary} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937' }}>Certificate Downloaded</Text>
          <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>
            {downloadSavedPath ? `Your certificate has been saved.${Platform.OS !== 'android' ? '\nPath: ' + downloadSavedPath : ''}` : 'Your certificate has been saved.'}
          </Text>
          <View style={{ height: 8 }} />
          <Button title="Done" onPress={() => setDownloadModalVisible(false)} fullWidth />
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
  bottomBar: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  primaryBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    marginLeft: 8,
  },
  secondaryBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: '#1E40AF',
    marginTop: 12,
  },
  secondaryText: {
    color: '#1E40AF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    marginLeft: 8,
  },
});
