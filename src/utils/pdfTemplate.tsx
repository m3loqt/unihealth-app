import React, { useMemo } from 'react';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { Platform, Alert } from 'react-native';
import { Asset } from 'expo-asset';

// Helper functions for PDF generation
export const safe = (val?: any) => {
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

export const fullName = (obj: any, fallback: string = '—') => {
  if (!obj) return fallback;
  const first = obj.firstName || obj.first_name || '';
  const last = obj.lastName || obj.last_name || '';
  const name = `${first} ${last}`.trim();
  return name || fallback;
};

export const formatDateFlexible = (input?: any) => {
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

export const computeAgeFromInput = (input?: any): string => {
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

// Load logo for watermark
export const loadLogoDataUri = async (): Promise<string> => {
  try {
    const asset = Asset.fromModule(require('../../assets/images/HEALTH Logo.png'));
    await asset.downloadAsync();
    const localUri = asset.localUri || asset.uri;
    if (localUri) {
      const b64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
      return `data:image/png;base64,${b64}`;
    }
    return '';
  } catch {
    return '';
  }
};

// Base CSS styles for all PDF templates
export const getBaseStyles = (brandPrimary: string, subtle: string, borderColor: string, text: string) => `
  @page { size: 8.5in 11in; margin: 0.5in; }
  html, body { margin: 0; padding: 0; background: #F3F4F6; color: ${text}; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: -apple-system, system-ui, Segoe UI, Roboto, Helvetica, Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"; }
  .preview { display: flex; flex-direction: column; align-items: center; padding: 16px; }
  .page { width: 100%; max-width: 8.5in; height: auto; background: #FFFFFF; box-shadow: 0 2px 16px rgba(0,0,0,0.08); position: relative; border: 1px solid #E5E7EB; display: flex; flex-direction: column; box-sizing: border-box; }
  .page-body { flex: 1; }
  .page .header, .page .top, .page .footer, .page .page-body { position: relative; z-index: 1; }
  .watermark { position: absolute; left: 0; right: 0; bottom: 56px; top: auto; display: flex; align-items: center; justify-content: center; opacity: 0.1; z-index: 0; pointer-events: none; }
  .watermark img { max-width: 65%; max-height: 65%; object-fit: contain; }
  .preview { gap: 16px; }
  .page + .page { margin-top: 16px; }
  .header { padding: 8px 16px; background: ${brandPrimary}; color: #fff; font-weight: 600; font-size: 13px; letter-spacing: 0.3px; display: flex; align-items: center; justify-content: space-between; }
  .brand-left { font-weight: 700; }
  .brand-right { opacity: 0.95; }
  .top { padding: 22px 16px; border-bottom: 1px solid ${borderColor}; }
  .clinic { text-align: center; margin-bottom: 25px; }
  .clinic-name { font-weight: 700; font-size: 16px; color: #111827; margin: 0 0 2px; }
  .muted { color: ${subtle}; font-size: 12px; margin: 0; }
  .info-row { display: flex; gap: 16px; align-items: flex-start; }
  .left { flex: 1; text-align: left; }
  .right { flex: 1; text-align: right; }
  .info-subrow { display: flex; gap: 16px; align-items: flex-start; padding-top: 6px; }
  .sub-left { flex: 1; text-align: left; }
  .sub-right { flex: 1; text-align: right; }
  .item { margin: 2px 0; font-size: 12px; color: ${subtle}; font-weight: 400; }
  .item strong { color: #111827; }
  .divider { height: 1.5px; background: #9CA3AF; width: calc(100% - 48px); margin: 10px auto; opacity: 0.75; }
  .divider-narrow { width: calc(100% - 64px); }
  .section { padding: 16px; border-bottom: 1px solid #F3F4F6; }
  .no-border { border-bottom: 0; }
  .row { display: flex; gap: 16px; padding: 12px 16px; }
  .cell { flex: 1; }
  .title { font-weight: 600; font-size: 13px; margin: 0 0 8px; color: #1F2937; }
  .label { color: ${subtle}; font-size: 12px; margin: 8px 0 4px; font-weight: 500; }
  .value { font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
  .data-table { width: calc(100% - 48px); margin: 6px auto; border-collapse: collapse; font-size: 12px; }
  .data-table th { text-align: left; font-weight: 600; color: #374151; background: #F9FAFB; border-bottom: 1px solid #E5E7EB; padding: 8px; }
  .data-table td { color: #374151; border-bottom: 1px solid #E5E7EB; padding: 8px; vertical-align: top; }
  .data-table tbody tr:nth-child(even) { background: #FAFAFB; }
  .footer { padding: 8px 16px; color: ${subtle}; font-size: 11px; background: #F9FAFB; display: flex; align-items: center; justify-content: space-between; }
  .avoid-break { page-break-inside: avoid; }
  .page-break { page-break-before: always; }
  @media screen and (max-width: 640px) { .row { flex-direction: column; } .divider { width: 100%; } .data-table { width: 100%; } }
  @media print { body { background: #FFFFFF; } .preview { padding: 0; } .page { box-shadow: none; width: 100%; height: calc(11in - 0in); min-height: auto; border: none; margin: 0; max-width: none; } .footer-fixed { position: fixed; bottom: 0; left: 0; right: 0; } .header-fixed { position: fixed; top: 0; left: 0; right: 0; } }
  @media screen { .page { height: calc(100vh - 30px); aspect-ratio: 8.5 / 11; overflow: hidden; } }
`;

// Generic PDF generation function
export const generatePdf = async (html: string) => {
  try {
    const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792, base64: false });
    return uri;
  } catch (e) {
    Alert.alert('Error', 'Failed to generate PDF.');
    return null;
  }
};

// Generic PDF download function
export const downloadPdf = async (html: string, filename: string, setDownloadSavedPath: (path: string) => void, setDownloadModalVisible: (visible: boolean) => void) => {
  const uri = await generatePdf(html);
  if (!uri) return;
  
  try {
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
      } catch (err) {
        // fall through to internal save
      }
    }
    const dest = FileSystem.documentDirectory + filename;
    await FileSystem.copyAsync({ from: uri, to: dest });
    setDownloadSavedPath(dest);
    setDownloadModalVisible(true);
  } catch (e) {
    Alert.alert('Error', 'Failed to save PDF.');
  }
};

// Visit Record PDF Template
export const generateVisitRecordPdf = (
  visitData: any,
  prescriptions: any[],
  certificates: any[],
  user: any,
  logoDataUri: string
) => {
  const brandPrimary = '#1E40AF';
  const subtle = '#6B7280';
  const borderColor = '#E5E7EB';
  const text = '#111827';

  const patientName = safe(fullName(user, 'Unknown Patient'));
  const patientDob = safe(formatDateFlexible(user?.dateOfBirth || user?.dob || user?.birthDate));
  const patientAge = computeAgeFromInput(user?.dateOfBirth || user?.dob || user?.birthDate);
  const patientGender = safe(user?.gender || user?.sex || '');
  const doctorName = safe(visitData.doctorName || 'Unknown Doctor');
  const doctorSpecialty = safe(visitData.doctorSpecialty || 'General Medicine');
  const clinicName = safe(visitData.clinic || 'Unknown Clinic');
  const visitDate = safe(formatDateFlexible(visitData.date));
  const visitTime = safe(visitData.time);

  // Build prescription table
  const prescriptionRows = prescriptions.length > 0
    ? prescriptions.map((prescription: any) => `
        <tr>
          <td>${safe(prescription.medication)}</td>
          <td>${safe(prescription.dosage)}</td>
          <td>${safe(prescription.frequency)}</td>
          <td>${safe(prescription.duration || prescription.quantity)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4">No prescriptions recorded</td></tr>';

  // Build certificate table
  const certificateRows = certificates.length > 0
    ? certificates.map((certificate: any) => `
        <tr>
          <td>${safe(certificate.type)}</td>
          <td>${safe(certificate.certificateNumber)}</td>
          <td>${safe(formatDateFlexible(certificate.issueDate))}</td>
          <td>${safe(certificate.status)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4">No certificates issued</td></tr>';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    ${getBaseStyles(brandPrimary, subtle, borderColor, text)}
  </style>
</head>
<body>
  <div class="preview">
    <div class="page">
      <div class="watermark">${logoDataUri ? `<img src="${logoDataUri}" />` : ''}</div>
      <div class="header"><span class="brand-left">UNIHEALTH</span><span class="brand-right">VISIT RECORD</span></div>
      <div class="top avoid-break">
        <div class="clinic">
          <p class="clinic-name">${clinicName}</p>
        </div>
        <div class="info-row" style="margin-bottom:0px;">
          <div class="left">
            <p class="clinic-name" style="margin-bottom:6px;">${patientName}</p>
            <p class="item"><span style="color:${subtle}">Date of Birth:</span> ${patientDob}</p>
            <p class="item"><span style="color:${subtle}">Age:</span> ${patientAge} years old</p>
            <p class="item"><span style="color:${subtle}">Gender:</span> ${patientGender || '—'}</p>
            <div style="height:12px"></div>
          </div>
          <div class="right">
            <p class="clinic-name" style="margin-bottom:6px;">Dr. ${doctorName}</p>
            <p class="item">${doctorSpecialty}</p>
            <p class="item"><span style="color:${subtle}">Visit Date:</span> ${visitDate}</p>
            <p class="item"><span style="color:${subtle}">Visit Time:</span> ${visitTime}</p>
          </div>
        </div>
      </div>
      <div class="page-body">
        <div class="section avoid-break">
          <div class="title">Patient History</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:50%">History of Present Illness</th>
                <th style="width:50%">Review of Symptoms</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${safe(visitData.presentIllnessHistory || 'Not recorded')}</td>
                <td>${safe(visitData.reviewOfSymptoms || 'Not recorded')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="section avoid-break">
          <div class="title">Clinical Findings</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:50%">Lab Results</th>
                <th style="width:50%">Diagnosis</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${safe(visitData.labResults || 'No lab results recorded')}</td>
                <td>${safe(visitData.diagnosis || 'No diagnosis recorded')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="section avoid-break">
          <div class="title">SOAP Notes</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:50%">Subjective</th>
                <th style="width:50%">Objective</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${safe(visitData.soapNotes?.subjective || '—')}</td>
                <td>${safe(visitData.soapNotes?.objective || '—')}</td>
              </tr>
            </tbody>
          </table>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:50%">Assessment</th>
                <th style="width:50%">Plan</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${safe(visitData.soapNotes?.assessment || '—')}</td>
                <td>${safe(visitData.soapNotes?.plan || '—')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="section avoid-break">
          <div class="title">Treatment & Summary</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:50%">Treatment Plan</th>
                <th style="width:50%">Clinical Summary</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${safe(visitData.treatmentPlan || '—')}</td>
                <td>${safe(visitData.clinicalSummary || '—')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="section avoid-break">
          <div class="title">Prescriptions</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:25%">Medication</th>
                <th style="width:25%">Dosage</th>
                <th style="width:25%">Frequency</th>
                <th style="width:25%">Duration</th>
              </tr>
            </thead>
            <tbody>
              ${prescriptionRows}
            </tbody>
          </table>
        </div>
        <div class="section no-border">
          <div class="title">Certificates Issued</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:25%">Type</th>
                <th style="width:25%">Certificate Number</th>
                <th style="width:25%">Issue Date</th>
                <th style="width:25%">Status</th>
              </tr>
            </thead>
            <tbody>
              ${certificateRows}
            </tbody>
          </table>
        </div>
      </div>
      <div class="footer">
        <span>Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
        <span>UniHealth Medical Records</span>
      </div>
    </div>
  </div>
</body>
</html>`;
};

// Referral Record PDF Template
export const generateReferralRecordPdf = (
  referralData: any,
  prescriptions: any[],
  certificates: any[],
  user: any,
  logoDataUri: string,
  isSpecialist: boolean = false
) => {
  const brandPrimary = '#1E40AF';
  const subtle = '#6B7280';
  const borderColor = '#E5E7EB';
  const text = '#111827';

  const patientName = safe(fullName(user, 'Unknown Patient'));
  const patientDob = safe(formatDateFlexible(user?.dateOfBirth || user?.dob || user?.birthDate));
  const patientAge = computeAgeFromInput(user?.dateOfBirth || user?.dob || user?.birthDate);
  const patientGender = safe(user?.gender || user?.sex || '');
  const referringDoctorName = safe(referralData.referringDoctorName || 'Unknown Doctor');
  const clinicName = safe(referralData.clinic || 'Unknown Clinic');
  const referralDate = safe(formatDateFlexible(referralData.date));
  const referralTime = safe(referralData.time);
  const specialistClinic = safe(referralData.specialistClinic || 'Not assigned');
  const reasonForReferral = safe(referralData.initialReasonForReferral || referralData.reasonForReferral || 'Not specified');

  // Build prescription table
  const prescriptionRows = prescriptions.length > 0
    ? prescriptions.map((prescription: any) => `
        <tr>
          <td>${safe(prescription.medication)}</td>
          <td>${safe(prescription.dosage)}</td>
          <td>${safe(prescription.frequency)}</td>
          <td>${safe(prescription.duration || prescription.quantity)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4">No prescriptions recorded</td></tr>';

  // Build certificate table
  const certificateRows = certificates.length > 0
    ? certificates.map((certificate: any) => `
        <tr>
          <td>${safe(certificate.type)}</td>
          <td>${safe(certificate.certificateNumber)}</td>
          <td>${safe(formatDateFlexible(certificate.issueDate))}</td>
          <td>${safe(certificate.status)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4">No certificates issued</td></tr>';

  const documentType = isSpecialist ? 'SPECIALIST REFERRAL' : 'REFERRAL RECORD';
  const headerTitle = isSpecialist ? 'Specialist Referral' : 'Referral Record';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    ${getBaseStyles(brandPrimary, subtle, borderColor, text)}
  </style>
</head>
<body>
  <div class="preview">
    <div class="page">
      <div class="watermark">${logoDataUri ? `<img src="${logoDataUri}" />` : ''}</div>
      <div class="header"><span class="brand-left">UNIHEALTH</span><span class="brand-right">${documentType}</span></div>
      <div class="top avoid-break">
        <div class="clinic">
          <p class="clinic-name">${clinicName}</p>
        </div>
        <div class="info-row" style="margin-bottom:0px;">
          <div class="left">
            <p class="clinic-name" style="margin-bottom:6px;">${patientName}</p>
            <p class="item"><span style="color:${subtle}">Date of Birth:</span> ${patientDob}</p>
            <p class="item"><span style="color:${subtle}">Age:</span> ${patientAge} years old</p>
            <p class="item"><span style="color:${subtle}">Gender:</span> ${patientGender || '—'}</p>
            <div style="height:12px"></div>
          </div>
          <div class="right">
            <p class="clinic-name" style="margin-bottom:6px;">Dr. ${referringDoctorName}</p>
            <p class="item"><span style="color:${subtle}">Referral Date:</span> ${referralDate}</p>
            <p class="item"><span style="color:${subtle}">Referral Time:</span> ${referralTime}</p>
            <p class="item"><span style="color:${subtle}">Specialist Clinic:</span> ${specialistClinic}</p>
          </div>
        </div>
        <div class="info-subrow">
          <div class="sub-left">
            <p class="title" style="margin:0 0 4px;">Reason for Referral</p>
            <div class="value">${reasonForReferral}</div>
          </div>
        </div>
      </div>
      <div class="page-body">
        <div class="section avoid-break">
          <div class="title">Patient History</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:50%">History of Present Illness</th>
                <th style="width:50%">Review of Symptoms</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${safe(referralData.presentIllnessHistory || 'Not recorded')}</td>
                <td>${safe(referralData.reviewOfSymptoms || 'Not recorded')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="section avoid-break">
          <div class="title">Clinical Findings</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:50%">Lab Results</th>
                <th style="width:50%">Diagnosis</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${safe(referralData.labResults || 'No lab results recorded')}</td>
                <td>${safe(referralData.diagnosis || 'No diagnosis recorded')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="section avoid-break">
          <div class="title">SOAP Notes</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:50%">Subjective</th>
                <th style="width:50%">Objective</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${safe(referralData.soapNotes?.subjective || '—')}</td>
                <td>${safe(referralData.soapNotes?.objective || '—')}</td>
              </tr>
            </tbody>
          </table>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:50%">Assessment</th>
                <th style="width:50%">Plan</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${safe(referralData.soapNotes?.assessment || '—')}</td>
                <td>${safe(referralData.soapNotes?.plan || '—')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="section avoid-break">
          <div class="title">Treatment & Summary</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:50%">Treatment Plan</th>
                <th style="width:50%">Clinical Summary</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${safe(referralData.treatmentPlan || '—')}</td>
                <td>${safe(referralData.clinicalSummary || '—')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="section avoid-break">
          <div class="title">Prescriptions</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:25%">Medication</th>
                <th style="width:25%">Dosage</th>
                <th style="width:25%">Frequency</th>
                <th style="width:25%">Duration</th>
              </tr>
            </thead>
            <tbody>
              ${prescriptionRows}
            </tbody>
          </table>
        </div>
        <div class="section no-border">
          <div class="title">Certificates Issued</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:25%">Type</th>
                <th style="width:25%">Certificate Number</th>
                <th style="width:25%">Issue Date</th>
                <th style="width:25%">Status</th>
              </tr>
            </thead>
            <tbody>
              ${certificateRows}
            </tbody>
          </table>
        </div>
      </div>
      <div class="footer">
        <span>Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
        <span>UniHealth Medical Records</span>
      </div>
    </div>
  </div>
</body>
</html>`;
};
