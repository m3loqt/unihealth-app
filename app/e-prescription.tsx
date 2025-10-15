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
import { formatRoute, formatFrequency } from '../src/utils/formatting';
import { useAuth } from '../src/hooks/auth/useAuth';

type PrescriptionItem = {
  medication?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  description?: string;
  quantity?: string | number;
  route?: string;
};

export default function EPrescriptionScreen() {
  const { id } = useLocalSearchParams(); // referralId
  const { user } = useAuth(); // Get current user to determine role
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referral, setReferral] = useState<any>(null);
  const [clinic, setClinic] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [diagnoses, setDiagnoses] = useState<any[]>([]);
  const [providerUser, setProviderUser] = useState<any>(null);
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);
  const [rxDataUri, setRxDataUri] = useState<string | null>(null);
  const [doctorSignature, setDoctorSignature] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [downloadSavedPath, setDownloadSavedPath] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        
        // Try to load as referral first
        console.log('🔍 E-Prescription: Attempting to load data for ID:', id);
        let refData = await databaseService.getReferralById(String(id));
        let isAppointment = false;
        
        if (refData) {
          console.log('✅ E-Prescription: Found as referral');
        } else {
          console.log('ℹ️ E-Prescription: Not found as referral, trying as appointment');
        }
        
        // If not found as referral, try as appointment
        if (!refData) {
          try {
            const appointmentData = await databaseService.getAppointmentById(String(id));
            if (appointmentData) {
              // Convert appointment to referral-like structure for e-prescription
              refData = {
                id: appointmentData.id,
                patientId: appointmentData.patientId,
                assignedSpecialistId: appointmentData.doctorId,
                assignedSpecialistFirstName: appointmentData.doctorFirstName,
                assignedSpecialistLastName: appointmentData.doctorLastName,
                referringClinicId: appointmentData.clinicId,
                referringClinicName: appointmentData.clinicName,
                appointmentDate: appointmentData.appointmentDate,
                appointmentTime: appointmentData.appointmentTime,
                referralConsultationId: appointmentData.appointmentConsultationId,
                clinicAppointmentId: appointmentData.id,
                status: appointmentData.status,
                // Add appointment-specific fields as any to avoid type conflicts
                appointmentPurpose: appointmentData.appointmentPurpose,
                type: appointmentData.type,
              } as any;
              isAppointment = true;
              console.log('✅ Loaded appointment data for e-prescription:', appointmentData.id);
            }
          } catch (appointmentError) {
            console.log('Could not load as appointment:', appointmentError);
          }
        }
        
        if (!refData) {
          setError(`No data found for ID: ${id}. Please check if this is a valid referral or appointment.`);
          setLoading(false);
          return;
        }
        
        setReferral(refData);

        // Related entities
        const [clinicData, userData, patientProfileData, specialistData, specialistUserDoc] = await Promise.all([
          refData.referringClinicId ? databaseService.getDocument(`clinics/${refData.referringClinicId}`) : null,
          refData.patientId ? databaseService.getDocument(`users/${refData.patientId}`) : null,
          refData.patientId ? databaseService.getDocument(`patients/${refData.patientId}`) : null,
          refData.assignedSpecialistId ? databaseService.getSpecialistProfile(refData.assignedSpecialistId) : null,
          refData.assignedSpecialistId ? databaseService.getDocument(`users/${refData.assignedSpecialistId}`) : null,
        ]);
        setClinic(clinicData);
        setPatient({ ...(userData || {}), ...(patientProfileData || {}) });
        setProvider(specialistData);
        setProviderUser(specialistUserDoc);

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

        // Load doctor signature if provider is available
        if (refData.assignedSpecialistId) {
          try {
            const { signature, isSignatureSaved } = await databaseService.getDoctorSignature(refData.assignedSpecialistId);
            if (isSignatureSaved && signature) {
              setDoctorSignature(signature);
              console.log('✅ Loaded doctor signature for e-prescription');
            } else {
              console.log('ℹ️ No saved signature found for doctor');
            }
          } catch (error) {
            console.log('Could not load doctor signature:', error);
          }
        }
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

  // Load Rx image if available
  useEffect(() => {
    (async () => {
      try {
        const asset = Asset.fromModule(require('../assets/images/rx2.png'));
        await asset.downloadAsync();
        const localUri = asset.localUri || asset.uri;
        if (localUri) {
          const b64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
          setRxDataUri(`data:image/png;base64,${b64}`);
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
          // If first segment > 12, assume DD/MM/YYYY; else MM/DD/YYYY
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

  const toDateObj = (input?: any): Date | null => {
    if (!input) return null;
    try {
      if (typeof input === 'object') {
        if (input?.seconds) return new Date(input.seconds * 1000);
        if (typeof input?.toDate === 'function') return input.toDate();
      }
      const str = String(input).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(`${str}T00:00:00Z`);
      if (/^\d{10,13}$/.test(str)) {
        const ms = str.length === 13 ? Number(str) : Number(str) * 1000;
        return new Date(ms);
      }
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
        const [a, b, y] = str.split('/').map(Number);
        const month = (a > 12 ? b : a) - 1;
        const day = a > 12 ? a : b;
        return new Date(Date.UTC(y, month, day));
      }
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
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
    const age = computeAgeFromInput(patient?.dateOfBirth || patient?.dob || patient?.birthDate);
    const gender = safe((patient?.gender || patient?.sex || '') as any);
    const doctorName = safe(fullName(provider, (`${referral?.assignedSpecialistFirstName || ''} ${referral?.assignedSpecialistLastName || ''}`).trim() || 'Unknown'));
    const dateIssued = safe(formatDateFlexible(referral?.appointmentDate));
    const timeIssued = safe(referral?.appointmentTime || '');
    const issuedObj = toDateObj(referral?.appointmentDate);
    const expirationDate = issuedObj
      ? new Date(issuedObj.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : '—';
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

    const ageText = age && age !== '—' ? `${age} years old` : '—';
    const firstRx: any = Array.isArray(prescriptions) && prescriptions[0] ? (prescriptions[0] as any) : null;
    const prescriptionId = safe(((firstRx && (firstRx.id || firstRx.prescriptionId))
      || referral?.referralConsultationId
      || referral?.clinicAppointmentId
      || referral?.id
      || String(id)
      || '—'));

    const medicineRows = (Array.isArray(prescriptions) && prescriptions.length)
      ? prescriptions.map((p: any, idx: number) => `
          <tr>
            <td>${safe(p.medication || '')}</td>
            <td>${safe(p.dosage || '')}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="2">No prescriptions recorded</td></tr>`;

    const detailsRows = (Array.isArray(prescriptions) && prescriptions.length)
      ? prescriptions.map((p: any, idx: number) => `
          <tr>
            <td>${safe(formatFrequency(p.frequency, user?.role || 'patient'))}</td>
            <td>${safe(p.route ? formatRoute(p.route, user?.role || 'patient') : '')}</td>
            <td>${safe(p.duration || p.quantity || '')}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="3">No prescriptions recorded</td></tr>`;

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
    .rx-title { font-weight: 700; font-size: 15px; color: #1F2937; margin: 12px 0 6px; }

    .data-table { width: calc(100% - 48px); margin: 8px auto; border-collapse: collapse; font-size: 12px; }
    .data-table th { text-align: left; font-weight: 600; color: #374151; background: #F9FAFB; border-bottom: 1px solid ${border}; padding: 8px; }
    .data-table td { color: #374151; border-bottom: 1px solid ${border}; padding: 8px; vertical-align: top; }
    .data-table tbody tr:nth-child(even) { background: #FAFAFB; }

    .body { flex: 1; display: flex; flex-direction: column; }
    .footer { padding: 8px 16px; color: ${subtle}; font-size: 11px; background: #F9FAFB; display: flex; align-items: center; justify-content: space-between; }
    .divider { height: 1px; background: ${border}; width: calc(100% - 48px); margin: 10px auto; }
    .divider-wider { width: calc(100% - 30px); }
    .details { width: calc(100% - 32px); margin: 0 16px 4px; }
    .detail-item { margin-bottom: 8px; }
    .details-row { display:flex; gap:16px; align-items:flex-end; }
    .details-col { flex:1; }
    .text-right { text-align:right; }
    .text-center { text-align:center; }
    .kv-row { display:flex; align-items:flex-start; padding: 4px 0; }
    .kv-label { flex: 0 0 40%; color: ${subtle}; font-size: 12px; }
    .kv-value { flex: 1; text-align: right; font-size: 13px; font-weight: 600; }
    .signature-wrap { text-align: left; display: inline-block; }
    .signature-line { height: 1px; background: ${border}; margin: 4px 0 6px 0; width: 160px; }
    .signature-name { color: #374151; font-size: 13.5px; font-weight: 700; }
    .signature-caption { color: ${subtle}; font-size: 12.5px; margin-top: 6px; }
    .signature-label { color: ${subtle}; font-size: 11px; margin-top: 6px; }

    /* Rx layout */
    .rx-row { display: flex; gap: 12px; align-items: flex-start; width: calc(100% - 32px); margin: 0 16px; }
    .rx-badge { width: 60px; min-width: 60px; height: 60px; border-radius: 10px; background: transparent; color: #000000; display: flex; align-items: center; justify-content: center; font-size: 50px; font-weight: 700; line-height: 1; user-select: none; opacity: 0.9; }
    .rx-badge img { width: 100%; height: 100%; object-fit: contain; }
    .rx-table { width: 100%; margin: 0; }

    @media screen and (max-width: 640px) { .data-table { width: 100%; } }
    @media print { .preview { padding: 0; } .page { box-shadow: none; width: 8.5in; height: 11in; border: none; margin: 0 auto; max-width: 8.5in; } }
    @media screen { .page { height: calc(100vh - 30px); aspect-ratio: 8.5 / 11; overflow: hidden; } }
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
            <p class="label">Patient</p>
            <div class="value" style="font-size:16px; font-weight:700;">${patientName}</div>
            <p class="label">Age</p>
            <div class="value strong">${ageText}</div>
            ${patientContact && patientContact !== '—' ? `<p class="label">Contact Number</p><div class="value strong">${patientContact}</div>` : ''}
            ${patientAddressParts.length ? `<p class="label">Address</p><div class="value strong">${patientAddress}</div>` : ''}
          </div>
          <div class="cell" style="text-align:right">
            <p class="label">Prescription ID</p>
            <div class="value strong" style="font-size:16px; font-weight:700;">${prescriptionId}</div>
            <p class="label">Date Issued</p>
            <div class="value strong">${dateIssued}</div>
            <p class=\"label\">Expiration Date</p>
            <div class=\"value strong\">${expirationDate}</div>
          </div>
        </div>
      </div>
      <div class="divider divider-wider"></div>

      <div class="body">

                 <div class="rx-row">
           <div class="rx-badge">${rxDataUri ? `<img src="${rxDataUri}" />` : 'Rx'}</div>
           <div class="rx-table">
             <table class="data-table">
               <thead>
                 <tr>
                   <th style="width:50%">Medicine Name</th>
                   <th style="width:50%">Dosage</th>
                 </tr>
               </thead>
               <tbody>
                 ${medicineRows}
               </tbody>
             </table>
             
             <table class="data-table" style="margin-top: 16px;">
               <thead>
                 <tr>
                   <th style="width:33%">Frequency</th>
                   <th style="width:33%">Route</th>
                   <th style="width:34%">Duration</th>
                 </tr>
               </thead>
               <tbody>
                 ${detailsRows}
               </tbody>
             </table>
           </div>
         </div>
        

        <div style="padding: 6px 24px 12px;">
          <div style="display:flex; justify-content:flex-end; margin-top: 20px;">
            <div class="signature-wrap">
              <div class="signature-label">Prescribing Doctor</div>
              <div class="signature-name" id="sig-name" style="position: relative;">
                ${doctorSignature ? `
                  <div class="signature-image-container" style="position: absolute; top: -28px; left: 35%; transform: translateX(-50%); background-image: url('${doctorSignature}'); background-size: contain; background-repeat: no-repeat; background-position: center; width: 150px; height: 60px; z-index: 10;"></div>
                ` : ''}
                Dr. ${doctorName}
              </div>
              <div class="signature-line" id="sig-line"></div>
              ${provider?.prcId ? `<div class="signature-caption">PRC ID: ${safe(provider.prcId)}</div>` : ''}
              ${provider?.phone || provider?.contactNumber ? `<div class="signature-caption">Phone: ${safe(provider.phone || provider.contactNumber)}</div>` : ''}
              ${providerUser?.email ? `<div class="signature-caption">Email: ${safe(providerUser.email)}</div>` : ''}
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
  }, [clinic, patient, provider, referral, prescriptions, logoDataUri, user?.role, doctorSignature]);

  const handleGeneratePdf = async () => {
    try {
      // 8x11 inches in points (72dpi) = 576 x 792
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
          <Text style={styles.primaryText}>Download e-Prescription</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryBtn]} onPress={handleSharePdf}>
          <Share2 size={18} color="#1E40AF" />
          <Text style={styles.secondaryText}>Share e-Prescription</Text>
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


