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
import { databaseService } from '../src/services/database/firebase';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Modal, Button } from '../src/components/ui';
import { COLORS } from '../src/constants/colors';
import { formatRoute, formatFrequency } from '../src/utils/formatting';
import { useAuth } from '../src/hooks/auth/useAuth';

type MedicalHistory = any;

export default function ConsultationReportScreen() {
  const { id } = useLocalSearchParams(); // referralId
  const { user } = useAuth(); // Get current user to determine role
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referral, setReferral] = useState<any>(null);
  const [clinic, setClinic] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [history, setHistory] = useState<MedicalHistory | null>(null);
  const webViewRef = useRef<WebView>(null);
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);
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

        // Fetch related entities
        const [clinicData, userData, patientProfileData, specialistData] = await Promise.all([
          refData.referringClinicId ? databaseService.getDocument(`clinics/${refData.referringClinicId}`) : null,
          refData.patientId ? databaseService.getDocument(`users/${refData.patientId}`) : null,
          refData.patientId ? databaseService.getDocument(`patients/${refData.patientId}`) : null,
          refData.assignedSpecialistId ? databaseService.getSpecialistProfile(refData.assignedSpecialistId) : null,
        ]);
        setClinic(clinicData);
        setPatient({ ...(userData || {}), ...(patientProfileData || {}) });
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

  // Load logo asset as base64 for watermark
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
      } catch (e) {
        // ignore watermark load failures
      }
    })();
  }, []);

  // Build safe HTML helpers and PDF actions
  const buildSafe = (val?: any) => {
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

  // More tolerant parser for DOB and similar fields
  const formatDateFlexible = (input?: any) => {
    if (!input) return '—';
    try {
      // Firestore Timestamp
      if (typeof input === 'object' && input.seconds) {
        return new Date(input.seconds * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }
      const str = String(input).trim();
      // YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return new Date(`${str}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }
      // MM/DD/YYYY
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
        const [m, d, y] = str.split('/').map(Number);
        return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }
      // Milliseconds timestamp
      if (/^\d{10,13}$/.test(str)) {
        const ms = str.length === 13 ? Number(str) : Number(str) * 1000;
        return new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }
      // Fallback to native Date parsing
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
    const full = (o: any, fb: string) => fullName(o, fb);
    const clinicName = buildSafe(clinic?.name || referral?.referringClinicName || 'Clinic');
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
    const clinicAddress = addressParts.join(', ');
    const clinicContact = buildSafe((clinic?.contactNumber || clinic?.phone || clinic?.telephone || '') as any);
    const patientName = buildSafe(full(patient, 'Unknown Patient'));
    const patientDob = buildSafe(formatDateFlexible((patient?.dateOfBirth || patient?.dob || patient?.birthDate) as any));
    const patientGender = buildSafe((patient?.gender || patient?.sex || '') as string) || '—';
    const visitDate = `${formatDate(referral?.appointmentDate)} ${formatTime(referral?.appointmentTime)}`;
    const specialistName = buildSafe(full(provider, (`${referral?.assignedSpecialistFirstName || ''} ${referral?.assignedSpecialistLastName || ''}`).trim() || 'Unknown'));
    const specialistSpecialty = buildSafe((provider?.specialty || provider?.specialization || provider?.field || referral?.assignedSpecialistSpecialty || referral?.specialty || '') as string) || '—';

    const diagnosis = Array.isArray(history?.diagnosis) && history?.diagnosis?.length
      ? history?.diagnosis.map((d: any) => `${d.code ? `${d.code}: ` : ''}${d.description}`).join('<br/>')
      : 'No diagnosis recorded';

    const meds = Array.isArray(history?.prescriptions) && history?.prescriptions?.length
      ? history?.prescriptions.map((p: any) => `${buildSafe(p.medication)} ${buildSafe(p.dosage)} • ${buildSafe(formatFrequency(p.frequency, user?.role || 'patient'))}${p.route ? ` • ${buildSafe(formatRoute(p.route, user?.role || 'patient'))}` : ''}`).join('<br/>')
      : 'No medications recorded';

    const brandPrimary = '#1E40AF';
    const borderColor = '#E5E7EB';
    const subtle = '#6B7280';
    const text = '#111827';

    // Build tabular HTML fragments
    const hpiRosTableHtml = `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:50%">History of Present Illness</th>
            <th style="width:50%">Review of Symptoms</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${buildSafe(history?.presentIllnessHistory || 'Not recorded')}</td>
            <td>${buildSafe(history?.reviewOfSymptoms || 'Not recorded')}</td>
          </tr>
        </tbody>
      </table>
    `;

    let labTableHtml = '';
    if (Array.isArray(history?.labResults) && history?.labResults?.length) {
      const labRows = history?.labResults.map((r: any) => {
        const test = r?.test || r?.name || r?.parameter || r?.title || '';
        const result = r?.result || r?.value || r?.finding || '';
        const units = r?.units || r?.unit || '';
        const dateVal = r?.date || r?.performedAt || r?.updatedAt || r?.createdAt || '';
        const date = formatDateFlexible(dateVal);
        const notes = r?.notes || r?.note || r?.comment || r?.comments || '';
        return `
          <tr>
            <td>${buildSafe(test)}</td>
            <td>${buildSafe(result)}</td>
            <td>${buildSafe(units)}</td>
            <td>${buildSafe(date)}</td>
            <td>${buildSafe(notes)}</td>
          </tr>
        `;
      }).join('');
      labTableHtml = `
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:30%">Lab Test</th>
              <th style="width:20%">Result</th>
              <th style="width:15%">Units</th>
              <th style="width:20%">Date</th>
              <th style="width:15%">Notes</th>
            </tr>
          </thead>
          <tbody>
            ${labRows}
          </tbody>
        </table>
      `;
    } else {
      labTableHtml = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Lab Results</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${buildSafe(history?.labResults || 'No lab results recorded')}</td>
            </tr>
          </tbody>
        </table>
      `;
    }

    // Differential Diagnosis table (supports string, array of strings, or array of objects with code/description)
    let diffDxTableHtml = '';
    const diffDx = (history as any)?.differentialDiagnosis;
    if (Array.isArray(diffDx) && diffDx.length) {
      const first = diffDx[0];
      if (typeof first === 'string') {
        const rows = diffDx.map((val: string) => `<tr><td>${buildSafe(val)}</td></tr>`).join('');
        diffDxTableHtml = `
          <table class="data-table">
            <thead>
              <tr><th>Differential Diagnosis</th></tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        `;
      } else {
        const rows = diffDx.map((d: any) => `
          <tr>
            <td>${buildSafe(d?.code || '')}</td>
            <td>${buildSafe(d?.description || '')}</td>
          </tr>
        `).join('');
        diffDxTableHtml = `
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:25%">Code</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        `;
      }
    } else {
      diffDxTableHtml = `
        <table class="data-table">
          <thead>
            <tr><th>Differential Diagnosis</th></tr>
          </thead>
          <tbody>
            <tr><td>${buildSafe(diffDx || 'Not recorded')}</td></tr>
          </tbody>
        </table>
      `;
    }

    // SOAP Notes as tables (two separate two-column tables for clarity)
    const soapTablesHtml = `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:50%">Subjective</th>
            <th style="width:50%">Objective</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${buildSafe(history?.soapNotes?.subjective || '—')}</td>
            <td>${buildSafe(history?.soapNotes?.objective || '—')}</td>
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
            <td>${buildSafe(history?.soapNotes?.assessment || '—')}</td>
            <td>${buildSafe(history?.soapNotes?.plan || '—')}</td>
          </tr>
        </tbody>
      </table>
    `;

    // Treatment & Summary as table
    const treatmentSummaryTableHtml = `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:50%">Treatment Plan</th>
            <th style="width:50%">Clinical Summary</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${buildSafe(history?.treatmentPlan || '—')}</td>
            <td>${buildSafe(history?.clinicalSummary || '—')}</td>
          </tr>
        </tbody>
      </table>
    `;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
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

    /* Screen-only adjustments for narrow devices */
    @media screen and (max-width: 640px) {
      .row { flex-direction: column; }
      .divider { width: 100%; }
      .data-table { width: 100%; }
    }

    @media print {
      body { background: #FFFFFF; }
      .preview { padding: 0; }
      .page { box-shadow: none; width: 100%; height: calc(11in - 0in); min-height: auto; border: none; margin: 0; max-width: none; }
      .footer-fixed { position: fixed; bottom: 0; left: 0; right: 0; }
      .header-fixed { position: fixed; top: 0; left: 0; right: 0; }
    }
    @media screen { .page { height: calc(100vh - 30px); aspect-ratio: 8.5 / 11; overflow: hidden; } }
  </style>
</head>
<body>
  <div class="preview">
    <div class="page">
      <div class="watermark">${logoDataUri ? `<img src="${logoDataUri}" />` : ''}</div>
      <div class="header"><span class="brand-left">UNIHEALTH</span><span class="brand-right">PATIENT VISIT SUMMARY</span></div>
      <div class="top avoid-break">
        <div class="clinic">
          <p class="clinic-name">${clinicName}</p>
          ${clinicContact ? `<p class="muted">${clinicContact}</p>` : ''}
          ${clinicAddress ? `<p class="muted">${buildSafe(clinicAddress)}</p>` : ''}
        </div>
        <div class="info-row" style="margin-bottom:0px;">
          <div class="left">
            <p class="clinic-name" style="margin-bottom:6px;">${patientName}</p>
            <p class="item"><span style="color:${subtle}">Date of Birth:</span> ${patientDob}</p>
            <p class="item"><span style="color:${subtle}">Gender:</span> ${patientGender || '—'}</p>
            <div style="height:12px"></div>
          </div>
          <div class="right">
            <p class="clinic-name" style="margin-bottom:6px;">Dr. ${specialistName}</p>
            <p class="item">${specialistSpecialty}</p>
          </div>
        </div>
        <div class="info-subrow">
          <div class="sub-left">
            <p class="title" style="margin:0 0 4px;">Reason for Visit</p>
            <div class="value">${buildSafe(referral?.initialReasonForReferral || 'Not specified')}</div>
          </div>
          <div class="sub-right">
            <p class="item"><span style="color:${subtle}">Visit Date:</span> ${buildSafe(formatDate(referral?.appointmentDate))}</p>
            <p class="item"><span style="color:${subtle}">Visit Time:</span> ${buildSafe(formatTime(referral?.appointmentTime))}</p>
          </div>
        </div>
      </div>

      <div id="content">
        <div class="section avoid-break no-border">
          <p class="title">Medical History</p>
          ${hpiRosTableHtml}
        </div>
        <div class="divider divider-narrow"></div>

        <div class="section no-border">
          <p class="title">Findings & Results</p>
          ${labTableHtml}
          <p class="title" style="margin-top:20px">Medications</p>
          ${Array.isArray(history?.prescriptions) && history?.prescriptions?.length ? `
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:35%">Medication</th>
                  <th style="width:20%">Dosage</th>
                  <th style="width:20%">Frequency</th>
                  <th style="width:15%">Route</th>
                  <th style="width:10%">Duration</th>
                </tr>
              </thead>
              <tbody>
                ${history?.prescriptions.map((p:any) => `
                  <tr>
                    <td>${buildSafe(p.medication)}</td>
                    <td>${buildSafe(p.dosage)}</td>
                    <td>${buildSafe(formatFrequency(p.frequency, user?.role || 'patient'))}</td>
                    <td>${buildSafe(p.route ? formatRoute(p.route, user?.role || 'patient') : '')}</td>
                    <td>${buildSafe(p.duration || '')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `<div class=\"value\">No medications recorded</div>`}
        </div>
        
        <div class="row">
          <div class="cell">
            <p class="title">Diagnosis</p>
            ${Array.isArray(history?.diagnosis) && history?.diagnosis?.length ? `
              <table class="data-table">
                <thead>
                  <tr>
                    <th style="width:25%">Code</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  ${history?.diagnosis.map((d:any) => `
                    <tr>
                      <td>${buildSafe(d.code || '')}</td>
                      <td>${buildSafe(d.description || '')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : `<div class=\\\"value\\\">No diagnosis recorded</div>`}
          </div>
          <div class="cell">
            <p class="title">Differential Diagnosis</p>
            ${diffDxTableHtml}
          </div>
        </div>
        <div class="divider"></div>

        <div class="section no-border">
          <p class="title">SOAP Notes</p>
          ${soapTablesHtml}
        </div>
        <div class="divider"></div>

        <div class="section">
          <p class="title">Treatment & Summary</p>
          ${treatmentSummaryTableHtml}
        </div>
      </div>

      <div class="footer"><span class="footer-left">Generated by UniHealth • ${new Date().toLocaleString()}</span><span class="footer-right"></span></div>
    </div>
  </div>

  <script>
    (function() {
      const inch = 96;
      const firstPage = document.querySelector('.page');
      const header = firstPage.querySelector('.header');
      const top = firstPage.querySelector('.top');
      const footer = firstPage.querySelector('.footer');
      // Use the actual rendered height for better accuracy across devices/scales
      const pageHeight = firstPage.getBoundingClientRect().height || (11 * inch);
      const availableFirst = pageHeight - header.offsetHeight - top.offsetHeight - footer.offsetHeight;
      const availableOther = pageHeight - header.offsetHeight - footer.offsetHeight;
      const pages = [firstPage];
      const watermarkSrc = '${logoDataUri || ''}';

      function createPage() {
        const page = document.createElement('div');
        page.className = 'page';
        const wm = document.createElement('div');
        wm.className = 'watermark';
        if (watermarkSrc) { wm.innerHTML = '<img src="' + watermarkSrc + '" />'; }
        page.appendChild(wm);
        page.appendChild(header.cloneNode(true));
        const body = document.createElement('div');
        body.className = 'page-body';
        page.appendChild(body);
        page.appendChild(footer.cloneNode(true));
        document.querySelector('.preview').appendChild(page);
        pages.push(page);
        return body;
      }

      const content = document.getElementById('content');
      const blocks = Array.from(content.children);
      content.remove();

      const firstBody = document.createElement('div');
      firstBody.className = 'page-body';
      firstPage.insertBefore(firstBody, footer);
      let currentBody = firstBody;
      let isFirstBody = true;

      blocks.forEach(block => {
        const currentAvailable = isFirstBody ? availableFirst : availableOther;
        currentBody.appendChild(block);
        let exceeds = currentBody.scrollHeight > currentAvailable;
        // If it exceeds but the block itself is smaller than the available space,
        // it means a tiny remainder is forcing a new page. Move it directly to a new page.
        if (exceeds) {
          const blockHeight = block.getBoundingClientRect().height;
          const canFitAlone = blockHeight <= currentAvailable;
          currentBody.removeChild(block);
          currentBody = createPage();
          isFirstBody = false;
          currentBody.appendChild(block);
          // Re-check in case of edge cases; if still exceeding, leave it (it will span next page's start)
        }
      });

      // Update page indicators
      const total = pages.length;
      pages.forEach((p, i) => {
        const foot = p.querySelector('.footer');
        if (!foot) return;
        let right = foot.querySelector('.footer-right');
        if (!right) {
          right = document.createElement('span');
          right.className = 'footer-right';
          foot.appendChild(right);
        }
        right.textContent = 'Page ' + (i + 1) + ' of ' + total;
        // Watermark stays centered by CSS
      });
    })();
  </script>
</body>
</html>`;
  }, [clinic, referral, patient, provider, history, logoDataUri, user?.role]);

  const handleGeneratePdf = async () => {
    try {
      // Letter size in points: 8.5in x 11in = 612 x 792
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
      const filename = `UniHealth_Visit_Report_${Date.now()}.pdf`;
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
      // Fallback (iOS or if user denied folder selection on Android): save to app documents
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

  function fullName(obj: any, fallback: string = '—') {
    if (!obj) return fallback;
    const first = obj.firstName || obj.first_name || '';
    const last = obj.lastName || obj.last_name || '';
    const name = `${first} ${last}`.trim();
    return name || fallback;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Visit Report</Text>
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
          <Text style={styles.primaryText}>Download PDF Report</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryBtn]} onPress={handleSharePdf}>
          <Share2 size={18} color="#1E40AF" />
          <Text style={styles.secondaryText}>Share PDF Report</Text>
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
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937' }}>Visit Report Successfully Downloaded</Text>
          <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>
            {downloadSavedPath ? `Your report has been saved.${Platform.OS !== 'android' ? '\nPath: ' + downloadSavedPath : ''}` : 'Your report has been saved.'}
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
  downloadBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { flex: 1 },
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


