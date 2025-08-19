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

type PrescriptionItem = {
  medication?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  description?: string;
  quantity?: string | number;
};

export default function EPrescriptionScreen() {
  const { id } = useLocalSearchParams(); // referralId
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referral, setReferral] = useState<any>(null);
  const [clinic, setClinic] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [diagnoses, setDiagnoses] = useState<any[]>([]);
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
        const refData = await databaseService.getReferralById(String(id));
        if (!refData) {
          setError('Referral not found');
          setLoading(false);
          return;
        }
        setReferral(refData);

        // Related entities
        const [clinicData, userData, patientProfileData, specialistData] = await Promise.all([
          refData.referringClinicId ? databaseService.getDocument(`clinics/${refData.referringClinicId}`) : null,
          refData.patientId ? databaseService.getDocument(`users/${refData.patientId}`) : null,
          refData.patientId ? databaseService.getDocument(`patients/${refData.patientId}`) : null,
          refData.assignedSpecialistId ? databaseService.getSpecialistProfile(refData.assignedSpecialistId) : null,
        ]);
        setClinic(clinicData);
        setPatient({ ...(userData || {}), ...(patientProfileData || {}) });
        setProvider(specialistData);

        // Prescriptions from medical history if available, otherwise by appointment
        let loadedPrescriptions: any[] = [];
        let mhData: any = null;
        if (refData?.referralConsultationId) {
          try {
            const mh = await databaseService.getDocument(
              `patientMedicalHistory/${refData.patientId}/entries/${refData.referralConsultationId}`
            );
            mhData = mh;
            loadedPrescriptions = (mh?.prescriptions || []) as any[];
          } catch {}
        }
        if (!mhData && refData?.clinicAppointmentId) {
          try {
            mhData = await databaseService.getMedicalHistoryByAppointment(refData.clinicAppointmentId, refData.patientId);
            if (!loadedPrescriptions.length) {
              loadedPrescriptions = await databaseService.getPrescriptionsByAppointment(refData.clinicAppointmentId);
            }
          } catch {}
        }
        setPrescriptions(loadedPrescriptions || []);
        const dx = Array.isArray(mhData?.diagnosis) ? mhData.diagnosis : [];
        setDiagnoses(dx);
      } catch (e) {
        setError('Failed to load e-prescription');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

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
      clinic?.province || clinic?.state,
      clinic?.postalCode || clinic?.zip || clinic?.zipCode,
      clinic?.country,
    ].filter(Boolean);
    const clinicAddress = safe(addressParts.join(', '));
    const clinicContact = safe((clinic?.contactNumber || clinic?.phone || clinic?.telephone || '') as any);
    const patientName = safe(fullName(patient, 'Unknown Patient'));
    const dob = safe(formatDateFlexible((patient?.dateOfBirth || patient?.dob || patient?.birthDate) as any));
    const gender = safe((patient?.gender || patient?.sex || '') as any);
    const doctorName = safe(fullName(provider, (`${referral?.assignedSpecialistFirstName || ''} ${referral?.assignedSpecialistLastName || ''}`).trim() || 'Unknown'));
    const dateIssued = safe(formatDateFlexible(referral?.appointmentDate));
    const timeIssued = safe(referral?.appointmentTime || '');
    const patientContact = safe((patient?.contactNumber || patient?.phoneNumber || patient?.mobile || patient?.phone || '') as any);
    const patientAddressParts = [
      patient?.addressLine || patient?.address || patient?.addressLine1 || patient?.street,
      patient?.addressLine2,
      patient?.barangay,
      patient?.district,
      patient?.city || patient?.municipality,
      patient?.province || patient?.state,
      patient?.postalCode || patient?.zip || patient?.zipCode,
      patient?.country,
    ].filter(Boolean);
    const patientAddress = safe(patientAddressParts.join(', '));

    const rows = (Array.isArray(prescriptions) && prescriptions.length)
      ? prescriptions.map((p: any, idx: number) => `
          <tr>
            <td>${safe(p.medication || '')}</td>
            <td>${safe(p.dosage || '')}</td>
            <td>${safe(p.frequency || p.description || '')}</td>
            <td>${safe(p.duration || p.quantity || '')}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="4">No prescriptions recorded</td></tr>`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    @page { size: 8.5in 11in; margin: 0.5in; }
    html, body { margin: 0; padding: 0; background: #F3F4F6; color: ${text}; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: -apple-system, system-ui, Segoe UI, Roboto, Helvetica, Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"; }
    .preview { display: flex; flex-direction: column; align-items: center; padding: 16px; }
    .page { width: 100%; max-width: 8.5in; height: 11in; background: #FFFFFF; box-shadow: 0 2px 16px rgba(0,0,0,0.08); position: relative; border: 1px solid ${border}; display: flex; flex-direction: column; box-sizing: border-box; }
    .page .header, .page .top, .page .footer, .page .body { position: relative; z-index: 1; }
    .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0.1; z-index: 0; pointer-events: none; }
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
    .rx-title { font-weight: 700; font-size: 15px; color: #1F2937; margin: 12px 0 6px; }

    .data-table { width: calc(100% - 48px); margin: 8px auto; border-collapse: collapse; font-size: 12px; }
    .data-table th { text-align: left; font-weight: 600; color: #374151; background: #F9FAFB; border-bottom: 1px solid ${border}; padding: 8px; }
    .data-table td { color: #374151; border-bottom: 1px solid ${border}; padding: 8px; vertical-align: top; }
    .data-table tbody tr:nth-child(even) { background: #FAFAFB; }

    .body { flex: 1; display: flex; flex-direction: column; }
    .footer { padding: 8px 16px; color: ${subtle}; font-size: 11px; background: #F9FAFB; display: flex; align-items: center; justify-content: space-between; }
    .divider { height: 1px; background: ${border}; width: calc(100% - 48px); margin: 10px auto; }
    .details { width: calc(100% - 48px); margin: 0 auto 4px; }
    .detail-item { margin-bottom: 8px; }
    .details-row { display:flex; gap:16px; align-items:flex-end; }
    .details-col { flex:1; }
    .text-right { text-align:right; }
    .text-center { text-align:center; }
    .signature-wrap { text-align: center; display: inline-block; }
    .signature-line { height: 1px; background: ${border}; margin: 0 auto 6px; width: 160px; }
    .signature-name { color: #374151; font-size: 12px; }
    .signature-caption { color: ${subtle}; font-size: 11px; }

    @media screen and (max-width: 640px) { .data-table { width: 100%; } }
    @media print { .preview { padding: 0; } .page { box-shadow: none; width: 100%; height: calc(11in - 0in); border: none; margin: 0; max-width: none; } }
  </style>
</head>
<body>
  <div class="preview">
    <div class="page">
      <div class="watermark">${logoDataUri ? `<img src="${logoDataUri}" />` : ''}</div>
      <div class="header"><span class="brand-left">UNIHEALTH</span><span class="brand-right">E-Prescription</span></div>
      <div class="top">
        <div class="row">
          <div class="cell">
            <p class="label">Prescribing Doctor</p>
            <div class="value strong" style="font-size:16px; font-weight:700;">Dr. ${doctorName}</div>
            <p class="label">Date</p>
            <div class="value strong">${dateIssued}</div>
            ${timeIssued ? `<p class=\"label\">Time</p><div class=\"value strong\">${timeIssued}</div>` : ''}
          </div>
          <div class="cell" style="text-align:right">
            <div class="clinic-name" style="display:inline-block">${clinicName}</div>
            ${addressParts.length ? `<p class="muted" style="margin-top:2px; margin-bottom:14px;">${clinicAddress}</p>` : ''}
            ${clinicContact && clinicContact !== '—' ? `<p class="muted">${clinicContact}</p>` : ''}
          </div>
        </div>
      </div>
      <div class="divider"></div>

      <div class="body">
        <p class="rx-title" style="padding: 0 16px; font-weight:400; font-size:12px;">Patient Details</p>
        <div class="details">
          <div class="detail-item"><div class="value" style="font-size:16px; font-weight:700;">${patientName}</div></div>
          <div class="details-row">
            <div class="details-col">
              <p class="label" style="margin-bottom:2px;">Date of Birth</p>
              <div class="value">${dob}</div>
            </div>
            <div class="details-col text-center">
              <div class="value">${gender || '—'}</div>
            </div>
            <div class="details-col text-right">
              ${patientContact && patientContact !== '—' ? `<div class="value">${patientContact}</div>` : ''}
            </div>
          </div>
          ${patientAddressParts.length ? `<div class="detail-item"><div class="value">${patientAddress}</div></div>` : ''}
        </div>
        <div class="divider"></div>

        <p class="rx-title" style="padding: 0 16px;">Medicines</p>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:38%">Medicine Name</th>
              <th style="width:20%">Dosage</th>
              <th style="width:27%">Instructions</th>
              <th style="width:15%">Duration</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        ${Array.isArray(diagnoses) && diagnoses.length ? `
        <p class=\"rx-title\" style=\"padding: 0 16px;\">Diagnoses</p>
        <table class=\"data-table\">
          <thead>
            <tr>
              <th style=\"width:25%\">Code</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${diagnoses.map((d:any) => `
              <tr>
                <td>${safe(d.code || '')}</td>
                <td>${safe(d.description || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class=\"divider\"></div>` : ''}

        <div style="padding: 6px 24px 12px;">
          <div style="display:flex; justify-content:flex-end; margin-top: 12px;">
            <div class="signature-wrap">
              <div class="signature-line" id="sig-line"></div>
              <div class="signature-name" id="sig-name">Dr. ${doctorName}</div>
              <div class="signature-caption">Signature</div>
            </div>
          </div>
        </div>
      </div>

      <div class="footer"><span class="footer-left">Generated by UniHealth • ${new Date().toLocaleString()}</span><span class="footer-right"></span></div>
    </div>
  </div>
  <script>
    (function(){
      // Single page layout for prescription; still set page indicator
      var page = document.querySelector('.page');
      var foot = page.querySelector('.footer');
      var right = foot.querySelector('.footer-right');
      right.textContent = 'Page 1 of 1';

      // Signature line width = doctor name width + 10px
      var nameEl = document.getElementById('sig-name');
      var lineEl = document.getElementById('sig-line');
      if (nameEl && lineEl) {
        // Use getBoundingClientRect for accurate width
        var w = Math.ceil(nameEl.getBoundingClientRect().width) + 5;
        lineEl.style.width = w + 'px';
      }
    })();
  </script>
</body>
</html>`;
  }, [clinic, patient, provider, referral, prescriptions, logoDataUri]);

  const handleGeneratePdf = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792, base64: false });
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
      const filename = `UniHealth_E-Prescription_${Date.now()}.pdf`;
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
        <Text style={styles.headerTitle}>E-Prescription</Text>
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
          <Text style={styles.primaryText}>Download PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryBtn]} onPress={handleSharePdf}>
          <Share2 size={18} color="#1E40AF" />
          <Text style={styles.secondaryText}>Share PDF</Text>
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
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937' }}>E-Prescription Downloaded</Text>
          <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>
            {downloadSavedPath ? `Your e-prescription has been saved.${Platform.OS !== 'android' ? '\nPath: ' + downloadSavedPath : ''}` : 'Your e-prescription has been saved.'}
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


