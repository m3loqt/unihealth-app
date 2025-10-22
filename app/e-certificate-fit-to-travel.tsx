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
import { databaseService, Certificate } from '../src/services/database/firebase';
import { useAuth } from '../src/hooks/auth/useAuth';
import { useCertificateSignature } from '../src/hooks/ui/useSignatureManager';

export default function FitToTravelCertificateScreen() {
  const { id, certificateId, patientId } = useLocalSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referral, setReferral] = useState<any>(null);
  const [clinic, setClinic] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [providerUser, setProviderUser] = useState<any>(null);
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);
  const [currentUserDoctorProfile, setCurrentUserDoctorProfile] = useState<any>(null);
  const webViewRef = useRef<WebView>(null);
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [downloadSavedPath, setDownloadSavedPath] = useState<string | null>(null);
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [scheduleClinics, setScheduleClinics] = useState<any>({});

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        
        // Reset certificate state to ensure fresh loading
        setCertificate(null);
        
        // Track if certificate was loaded successfully
        let loadedCertificate: Certificate | null = null;
        
        // PRIORITY 1: Load certificate data first if certificateId is provided
        if (certificateId) {
          try {
            // Try direct lookup by certificate ID first (most efficient)
            const directCertificate = await databaseService.getCertificateById(String(certificateId));
            
            if (directCertificate) {
              loadedCertificate = directCertificate;
              
              // Batch all data loading in parallel for better performance
              const doctorId = directCertificate.doctorDetails?.id;
              const patientIdToUse = directCertificate.patientId;
              
              const [doctorData, doctorUserData, patientUserData, patientProfileData] = await Promise.all([
                doctorId ? databaseService.getDocument(`doctors/${doctorId}`).catch(() => null) : null,
                doctorId ? databaseService.getDocument(`users/${doctorId}`).catch(() => null) : null,
                patientIdToUse ? databaseService.getDocument(`users/${patientIdToUse}`).catch(() => null) : null,
                patientIdToUse ? databaseService.getDocument(`patients/${patientIdToUse}`).catch(() => null) : null,
              ]);
              
              // Batch state updates to reduce re-renders
              setCertificate(directCertificate);
              if (doctorData || doctorUserData) {
                setProvider(doctorData);
                setProviderUser(doctorUserData);
              }
              if (patientUserData || patientProfileData) {
                setPatient({ ...(patientUserData || {}), ...(patientProfileData || {}) });
              }
              
              // Load schedule data (specialist or generalist)
              if (doctorId && doctorData) {
                try {
                  const isGeneralist = doctorData?.isGeneralist === true;
                  if (isGeneralist) {
                    if (doctorData?.availability) {
                      setScheduleData(doctorData.availability);
                    }
                    if (doctorData?.clinicAffiliations && Array.isArray(doctorData.clinicAffiliations)) {
                      const clinicsMap: any = {};
                      for (const cid of doctorData.clinicAffiliations) {
                        try {
                          const info = await databaseService.getClinicById(cid);
                          if (info) clinicsMap[cid] = info;
                        } catch {}
                      }
                      setScheduleClinics(clinicsMap);
                    }
                  } else {
                    const schedules = await databaseService.getSpecialistSchedules(doctorId);
                    if (schedules) {
                      setScheduleData(schedules);
                      const clinicsMap: any = {};
                      const keys = Object.keys(schedules);
                      for (const key of keys) {
                        const schedule = schedules[key];
                        const cid = schedule?.practiceLocation?.clinicId;
                        if (cid && !clinicsMap[cid]) {
                          try {
                            const cdata = await databaseService.getClinicById(cid);
                            if (cdata) clinicsMap[cid] = cdata;
                          } catch {}
                        }
                      }
                      setScheduleClinics(clinicsMap);
                    }
                  }
                } catch {}
              }

              setLoading(false);
              return;
            }
          } catch (error) {
            console.error('Error loading certificate:', error);
          }
        }
        
        // Fallback to original consultation data loading if certificate not found
        if (!loadedCertificate) {
          let refData = null;
          let appointmentData = null;
          let medicalHistoryData = null;
          
          try {
            refData = await databaseService.getReferralById(String(id));
          } catch {}
          
          if (!refData) {
            try {
              appointmentData = await databaseService.getAppointmentById(String(id));
            } catch {}
          }
          
          if (!refData && !appointmentData) {
            // Try to load as medical history entry
            try {
              const patientIdToUse = patientId || user?.uid;
              if (patientIdToUse) {
                medicalHistoryData = await databaseService.getDocument(
                  `patientMedicalHistory/${patientIdToUse}/entries/${id}`
                );
              }
            } catch {}
          }
          
          const dataSource = refData || appointmentData || medicalHistoryData;
          if (!dataSource) {
            // Don't set error, just continue without consultation data
            // This allows the component to render with just certificate data
          }
          
          setReferral(refData);
          
          // Related entities - Get doctor details from the correct source
          let doctorId = null;
          let doctorData = null;
          let doctorUserData = null;
          
          if (medicalHistoryData?.provider?.id) {
            // If we have medical history data, use the provider from there
            doctorId = medicalHistoryData.provider.id;
            try {
              // Always get the full doctor profile from doctors collection for PRC info
              doctorData = await databaseService.getDocument(`doctors/${doctorId}`);
              doctorUserData = await databaseService.getDocument(`users/${doctorId}`);
            } catch {}
          } else if (dataSource?.assignedSpecialistId) {
            // Fallback to referral's assigned specialist
            doctorId = dataSource.assignedSpecialistId;
            try {
              doctorData = await databaseService.getDocument(`doctors/${doctorId}`);
              doctorUserData = await databaseService.getDocument(`users/${doctorId}`);
            } catch {}
          } else if (dataSource?.doctorId) {
            // Fallback to appointment's doctor
            doctorId = dataSource.doctorId;
            try {
              doctorData = await databaseService.getDocument(`doctors/${doctorId}`);
              doctorUserData = await databaseService.getDocument(`users/${doctorId}`);
            } catch {}
          }
          
          const [clinicData, userData, patientProfileData] = await Promise.all([
            dataSource?.referringClinicId ? databaseService.getDocument(`clinics/${dataSource.referringClinicId}`) : null,
            (patientId || dataSource.patientId) ? databaseService.getDocument(`users/${patientId || dataSource.patientId}`) : null,
            (patientId || dataSource.patientId) ? databaseService.getDocument(`patients/${patientId || dataSource.patientId}`) : null,
          ]);
          
          // Debug logging
          console.log('Data Source:', dataSource);
          console.log('Doctor ID:', doctorId);
          console.log('Doctor Data:', doctorData);
          console.log('Doctor User Data:', doctorUserData);
          
          setClinic(clinicData);
          setPatient({ ...(userData || {}), ...(patientProfileData || {}) });
          setProvider(doctorData);
          setProviderUser(doctorUserData);

          // Load schedule data (specialist or generalist)
          if (doctorId && doctorData) {
            try {
              const isGeneralist = doctorData?.isGeneralist === true;
              if (isGeneralist) {
                if (doctorData?.availability) {
                  setScheduleData(doctorData.availability);
                }
                if (doctorData?.clinicAffiliations && Array.isArray(doctorData.clinicAffiliations)) {
                  const clinicsMap: any = {};
                  for (const cid of doctorData.clinicAffiliations) {
                    try {
                      const info = await databaseService.getClinicById(cid);
                      if (info) clinicsMap[cid] = info;
                    } catch {}
                  }
                  setScheduleClinics(clinicsMap);
                }
              } else {
                const schedules = await databaseService.getSpecialistSchedules(doctorId);
                if (schedules) {
                  setScheduleData(schedules);
                  const clinicsMap: any = {};
                  const keys = Object.keys(schedules);
                  for (const key of keys) {
                    const schedule = schedules[key];
                    const cid = schedule?.practiceLocation?.clinicId;
                    if (cid && !clinicsMap[cid]) {
                      try {
                        const cdata = await databaseService.getClinicById(cid);
                        if (cdata) clinicsMap[cid] = cdata;
                      } catch {}
                    }
                  }
                  setScheduleClinics(clinicsMap);
                }
              }
            } catch {}
          }

          if (!loadedCertificate) {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const defaultCertificate: Certificate = {
              id: `FTT-${Date.now()}`,
              patientId: String(patientId || user?.uid || ''),
              specialistId: user?.uid || '',
              type: 'Fit to Travel Certificate',
              issueDate: today.toISOString(),
              status: 'active',
              description: 'Fit to Travel Certificate',
              consultationId: String(id),
              medicalDetails: {
                dateFrom: '',
                dateTo: '',
                diagnosis: '',
                recommendations: 'The patient has been examined and is found to be medically fit to travel.',
                restrictions: '',
                followUpDate: '',
                restDays: 0,
                travelMode: 'Air travel',
                destination: 'International',
                travelDate: tomorrow.toLocaleDateString(),
                specialConditions: 'None',
                validityPeriod: '30 days from date of issue'
              },
              digitalSignature: '',
              signedDate: '',
              isSigned: false
            };
            setCertificate(defaultCertificate);
          }
        }
        
      } catch (e) {
        setError('Failed to load certificate data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, certificateId]);

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

  // Load current user's doctor profile for PRC ID fallback
  useEffect(() => {
    const loadCurrentUserDoctorProfile = async () => {
      const doctorPrcId = provider?.prcId || (certificate as any)?.doctorDetails?.prcId || '';
      if (!doctorPrcId && user?.uid && !provider) {
        try {
          const doctorProfile = await databaseService.getDocument(`doctors/${user.uid}`);
          setCurrentUserDoctorProfile(doctorProfile);
        } catch (error) {
          console.log('Could not load current user doctor profile:', error);
        }
      }
    };
    
    loadCurrentUserDoctorProfile();
  }, [user?.uid, provider, certificate]);

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
          const ms = str.length === 13 ? Number(str) * 1000 : Number(str) * 1000;
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

  // Get signature from context
  const { signature: contextSignature } = useCertificateSignature(certificate);

  const html = useMemo(() => {
    // Don't generate HTML if still loading
    if (loading) {
      return '';
    }

    const brandPrimary = '#1E40AF';
    const subtle = '#6B7280';
    const border = '#E5E7EB';
    const text = '#111827';

    const patientName = safe(fullName(patient, certificate?.patientDetails ? `${certificate.patientDetails.firstName} ${certificate.patientDetails.lastName}`.trim() : 'Unknown Patient'));
    const age = computeAgeFromInput(patient?.dateOfBirth || patient?.dob || patient?.birthDate);
    const gender = safe((patient?.gender || patient?.sex || '') as any);
    const doctorName = safe(fullName(provider, 
      certificate?.doctorDetails ? `${certificate.doctorDetails.firstName} ${certificate.doctorDetails.lastName}`.trim() :
      (() => {
        // Try to get doctor name from multiple sources
        if (provider?.firstName && provider?.lastName) {
          return `${provider.firstName} ${provider.lastName}`;
        }
        if (referral?.assignedSpecialistFirstName && referral?.assignedSpecialistLastName) {
          return `${referral.assignedSpecialistFirstName} ${referral.assignedSpecialistLastName}`;
        }
        // Try to get from certificate doctor field
        if (certificate?.doctor) {
          return certificate.doctor;
        }
        return 'Unknown Doctor';
      })()
    ));
    
    // Get doctor details from certificate and loaded provider data
    const doctorId = (certificate as any)?.doctor?.id || (certificate as any)?.doctorDetails?.id;
    const doctorFirstName = (certificate as any)?.doctorDetails?.firstName || provider?.firstName || providerUser?.firstName || '';
    const doctorMiddleName = (certificate as any)?.doctorDetails?.middleName || (provider as any)?.middleName || providerUser?.middleName || '';
    const doctorLastName = (certificate as any)?.doctorDetails?.lastName || provider?.lastName || providerUser?.lastName || '';
    const doctorEmail = providerUser?.email || (certificate as any)?.doctorDetails?.email || (provider as any)?.email || '';
    const doctorPrcId = provider?.prcId || (certificate as any)?.doctorDetails?.prcId || '';
    
    // Use current user doctor profile PRC ID if available
    const finalDoctorPrcId = doctorPrcId || currentUserDoctorProfile?.prcId || '';
    
    // Construct full doctor name
    const fullDoctorName = [doctorFirstName, doctorMiddleName, doctorLastName].filter(Boolean).join(' ');
    
    // Simple date formatting - matching the certificates tab approach that works correctly
    const formatCertificateDate = (dateString: string) => {
      if (!dateString) return '—';
      try {
        // Use the same simple approach as certificates tab
        return new Date(dateString).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric'
        });
      } catch {
        return '—';
      }
    };
    
    // Debug: Log the actual date values we're receiving
    console.log('🔍 Certificate date debug:', {
      certificateIssueDate: certificate?.issueDate,
      certificateMetadataIssuedDate: (certificate as any)?.metadata?.issuedDate,
      certificateObject: certificate
    });
    
    const dateIssued = safe(formatCertificateDate(certificate?.issueDate || (certificate as any)?.metadata?.issuedDate || ''));
    const examinationDate = safe(formatCertificateDate(certificate?.issueDate || (certificate as any)?.metadata?.issuedDate || ''));
    
    // Calculate Valid Until date (1 year from issued date)
    const calculateValidUntil = () => {
      try {
        const issuedDateString = certificate?.issueDate || (certificate as any)?.metadata?.issuedDate;
        if (issuedDateString) {
          const issuedDate = new Date(issuedDateString);
          const validUntil = new Date(issuedDate);
          validUntil.setFullYear(validUntil.getFullYear() + 1);
          return formatCertificateDate(validUntil.toISOString());
        }
        return '—';
      } catch {
        return '—';
      }
    };
    const validUntil = safe(calculateValidUntil());
    // Use the URL parameter certificateId directly
    const travelFitnessStatement = safe(certificate?.medicalDetails?.recommendations || 'The patient has been examined and is found to be medically fit to travel.');
    const travelMode = safe(certificate?.medicalDetails?.travelMode || 'Not specified');
    const destination = safe(certificate?.medicalDetails?.destination || 'Not specified');
    const travelDate = safe(formatDateFlexible(certificate?.medicalDetails?.travelDate));
    const specialConditions = safe(certificate?.medicalDetails?.specialConditions || 'None');
    const validityPeriod = safe(certificate?.medicalDetails?.validityPeriod || '30 days from date of issue');

    const ageText = age && age !== '—' ? `${age} years old` : '—';

    // Build clinic header/schedule like FTW
    const clinicName = 'Clinic';
    let clinicScheduleInfo = '';
    const isGeneralist = provider?.isGeneralist === true;
    if (scheduleData) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayNamesMap: { [key: string]: number } = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      if (isGeneralist) {
        const weeklySchedule = scheduleData?.weeklySchedule || {};
        const enabledDays: Array<{ day: string; dayNum: number; times: string }> = [];
        Object.entries(weeklySchedule).forEach(([day, config]: [string, any]) => {
          if (config?.enabled && config?.timeSlots && config.timeSlots.length > 0) {
            const dayNum = dayNamesMap[day.toLowerCase()];
            const firstSlot = config.timeSlots[0];
            const startTime = firstSlot.startTime || '';
            let timeStr = '';
            if (startTime) {
              const [hours] = startTime.split(':').map(Number);
              const period = hours >= 12 ? 'PM' : 'AM';
              const displayHours = hours % 12 || 12;
              timeStr = `${displayHours}:00 ${period}`;
            }
            enabledDays.push({ day, dayNum, times: timeStr });
          }
        });
        enabledDays.sort((a, b) => a.dayNum - b.dayNum);
        let daysStr = '';
        if (enabledDays.length === 7) daysStr = 'Mon-Sun';
        else if (enabledDays.length > 0) {
          let isConsecutive = true;
          for (let i = 0; i < enabledDays.length - 1; i++) {
            if (enabledDays[i + 1].dayNum - enabledDays[i].dayNum !== 1) { isConsecutive = false; break; }
          }
          daysStr = isConsecutive ? `${dayNames[enabledDays[0].dayNum]}-${dayNames[enabledDays[enabledDays.length - 1].dayNum]}` : enabledDays.map(d => dayNames[d.dayNum]).join(', ');
        }
        const timeStr = enabledDays.length > 0 ? enabledDays[0].times : '';
        const clinicIds = Object.keys(scheduleClinics);
        clinicIds.forEach((cid) => {
          const sc = scheduleClinics[cid];
          const name = sc?.name || '';
          const addr = (sc?.addressLine || sc?.address ? (sc?.addressLine || sc?.address) : '');
          const contact = sc?.contactNumber || sc?.phone || '';
          clinicScheduleInfo += `<div class="schedule-entry">`;
          if (name) clinicScheduleInfo += `<div class="clinic-info">${name}${addr ? ', ' + addr : ''}</div>`;
          if (daysStr && timeStr) clinicScheduleInfo += `<div class="clinic-schedule">${daysStr} ${timeStr}</div>`;
          if (contact) clinicScheduleInfo += `<div class="clinic-info">Tel: ${contact}</div>`;
          clinicScheduleInfo += `</div>`;
        });
      } else {
        const keys = Object.keys(scheduleData);
        keys.forEach((key) => {
          const s = scheduleData[key];
          const cid = s?.practiceLocation?.clinicId || '';
          const sc = scheduleClinics[cid];
          const name = sc?.name || '';
          const addr = (sc?.addressLine || sc?.address ? (sc?.addressLine || sc?.address) : '');
          const contact = sc?.contactNumber || sc?.phone || '';
          const days = s?.recurrence?.dayOfWeek || [];
          let daysStr = '';
          if (days.length === 1) daysStr = dayNames[days[0]];
          else if (days.length === 7) daysStr = 'Mon-Sun';
          else if (days.length >= 2) {
            const sorted = [...days].sort((a: number, b: number) => a - b);
            let isConsecutive = true;
            for (let i = 0; i < sorted.length - 1; i++) { if (sorted[i + 1] - sorted[i] !== 1) { isConsecutive = false; break; } }
            daysStr = isConsecutive ? `${dayNames[sorted[0]]}-${dayNames[sorted[sorted.length - 1]]}` : sorted.map((d: number) => dayNames[d]).join(', ');
          }
          const slots = s?.slotTemplate || {};
          const times = Object.keys(slots).sort();
          let timeStr = '';
          if (times.length > 0) {
            const [hours, mins] = times[0].split(':').map(Number);
            const period = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            timeStr = `${displayHours}:${String(mins).padStart(2,'0')} ${period}`;
          }
          clinicScheduleInfo += `<div class=\"schedule-entry\">`;
          if (name) clinicScheduleInfo += `<div class=\"clinic-info\">${name}${addr ? ', ' + addr : ''}</div>`;
          if (daysStr && timeStr) clinicScheduleInfo += `<div class=\"clinic-schedule\">${daysStr} ${timeStr}</div>`;
          if (contact) clinicScheduleInfo += `<div class=\"clinic-info\">Tel: ${contact}</div>`;
          clinicScheduleInfo += `</div>`;
        });
      }
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    @page { size: 8.5in 13in; margin: 0; }
    html, body { margin: 0; padding: 0; background: #FFFFFF; color: ${text}; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: -apple-system, system-ui, Segoe UI, Roboto, Helvetica, Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"; }
    .preview { display: flex; flex-direction: column; align-items: center; min-height: 100vh; background: #F3F4F6; }
    .page { width: 8.5in; height: 13in; background: #FFFFFF; position: relative; display: block; box-sizing: border-box; padding: 0; }
    .page-content { padding: 32px 48px; padding-bottom: 3in; position: relative; z-index: 1; }
    .page .header, .page .top, .page .body { position: relative; z-index: 1; }
    .watermark { position: absolute; bottom: 0.8in; left: 48px; display: flex; align-items: flex-end; justify-content: flex-start; opacity: 0.18; z-index: 1; pointer-events: none; }
    .watermark img { max-width: 65%; height: auto; }
        
        .watermark-pattern {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          bottom: 0;
          opacity: 0.08;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }
        
        .watermark-logo-small {
          position: absolute;
          opacity: 0.12;
          transform: rotate(-30deg);
        }
        
        .watermark-logo-small img {
          max-width: 60px;
          max-height: 60px;
          object-fit: contain;
        }

    .document-header { background: ${brandPrimary}; color: #fff; padding: 16px 48px; display: flex; align-items: center; justify-content: space-between; font-weight: 700; font-size: 14px; letter-spacing: 0.3px; }
    .document-title { font-weight: 800; font-size: 20px; }
    .document-brand { font-weight: 600; opacity: 0.95; font-size: 18px; }

    .doctor-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0; padding-bottom: 0; gap: 24px; position: relative; }
    .doctor-info-left { flex: 1; text-align: left; margin-bottom: 0; padding-bottom: 0; }
    .doctor-logo-right { position: absolute; top: 0; right: 0; width: 150px; height: 150px; display: flex; align-items: flex-start; justify-content: flex-end; }
    .doctor-logo-right img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .doctor-name { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px 0; letter-spacing: 0.3px; text-transform: uppercase; }
    .doctor-credentials { font-size: 14px; color: #374151; margin: 0 0 0 0; line-height: 1.5; }
    .clinic-info { font-size: 13px; color: #6B7280; margin: 1px 0 0 0; line-height: 1.4; }
    .clinic-affiliation-section { margin-top: 20px; margin-bottom: 20px; padding-top: 0; padding-bottom: 0; display: flex; flex-wrap: wrap; gap: 0; }
    .schedule-entry { flex: 0 0 auto; min-width: 180px; margin-right: 24px; margin-bottom: 0; padding-bottom: 0; }
    .schedule-entry:last-child { margin-right: 0; }
    .clinic-schedule { font-size: 13px; color: #6B7280; margin: 1px 0 0 0; line-height: 1.4; }

    .header-divider { height: 1px; background: rgba(0, 0, 0, 0.15); margin: 20px 0 0 0; }
    .certificate-title { font-weight: 700; font-size: 28px; color: #111827; margin: 32px 0 24px; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; text-decoration: none; }
    .certificate-date { text-align: left; font-size: 14px; color: #374151; margin-top: 50px; margin-bottom: 50px; font-weight: 500; }
    
    .certificate-salutation { font-size: 14px; font-weight: 600; color: #111827; margin: 20px 0 20px; }
    
    .certificate-body { line-height: 2.0; font-size: 16px; color: #1F2937; text-align: justify; }
    .certificate-body p { margin: 20px 0; text-indent: 40px; line-height: 2.0; }
    .certificate-body strong { font-weight: 600; color: #111827; }
    .certificate-body em { font-style: italic; color: #374151; font-weight: 500; }
    
    .certificate-info-section { margin: 20px 0; padding: 16px; background: #F9FAFB; border-left: 3px solid ${brandPrimary}; border-radius: 4px; }
    
    .divider { height: 1px; background: rgba(0, 0, 0, 0.8); margin: 20px 0; }
    
    .signature-section { position: absolute; bottom: 0.8in; right: 0.8in; text-align: left; z-index: 2; }
    .signature-wrap { width: auto; max-width: 280px; text-align: left; }
    .signature-image-container { display: inline-block; text-align: left; width: auto; margin-bottom: 8px; }
    .signature-image-container img { display: inline-block; margin: 0 0 -20px -40px; max-width: 200px; max-height: 60px; object-fit: contain; vertical-align: top; }
    .signature-line { display: none; }
    .signature-name { color: #111827; font-size: 18px; font-weight: 700; text-align: left; margin: 6px 0 4px 0; }
    .signature-details { color: #6B7280; font-size: 12px; margin: 2px 0; text-align: left; }
    .signature-caption { color: #374151; font-size: 12px; margin-top: 4px; text-align: center; }
    .signature-label { color: ${subtle}; font-size: 11px; margin-top: 6px; }
    
    /* Reset any default image styling */
    img { border: none !important; outline: none !important; box-shadow: none !important; background: transparent !important; }
    
    /* Prevent loading states and intermediate rendering */
    img[src*="data:image"] { 
      opacity: 1 !important; 
      visibility: visible !important; 
      display: block !important;
    }
    
    /* Signature container styling */
    .signature-image-container {
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
      background-color: transparent !important;
    }
    
    .disclaimer { text-align: center; padding: 16px 0; margin-bottom: 60px; }

    @media screen {
      .preview { padding: 16px 0; }
      .page {
        height: 13in;
        transform: scale(0.47);
        transform-origin: top center;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        border: 1px solid #E5E7EB;
        margin-bottom: -600px;
      }
    }
    @media print { 
      .preview { padding: 0; background: #FFFFFF; display: block; } 
      .page { transform: none; box-shadow: none; border: none; margin: 0; padding: 0; width: 100%; height: 13in; } 
      .page-content { padding: 0.5in 0.6in; padding-bottom: 3in; }
      .signature-section { bottom: 0.8in; right: 0.8in; }
      .watermark { left: 0.6in; bottom: 0.8in; }
    }
  </style>
</head>
<body>
  <div class="preview">
    <div class="page">
      <div class="watermark">${logoDataUri ? `<img src="${logoDataUri}" />` : ''}</div>
      <div class="watermark-pattern">
        ${logoDataUri ? `
          <div class="watermark-logo-small" style="top: 10%; left: 5%;"><img src="${logoDataUri}" /></div>
          <div class="watermark-logo-small" style="top: 25%; left: 15%;"><img src="${logoDataUri}" /></div>
          <div class="watermark-logo-small" style="top: 40%; left: 25%;"><img src="${logoDataUri}" /></div>
          <div class="watermark-logo-small" style="top: 55%; left: 35%;"><img src="${logoDataUri}" /></div>
          <div class="watermark-logo-small" style="top: 70%; left: 45%;"><img src="${logoDataUri}" /></div>
          <div class="watermark-logo-small" style="top: 85%; left: 55%;"><img src="${logoDataUri}" /></div>
          <div class="watermark-logo-small" style="top: 15%; left: 65%;"><img src="${logoDataUri}" /></div>
          <div class="watermark-logo-small" style="top: 30%; left: 75%;"><img src="${logoDataUri}" /></div>
          <div class="watermark-logo-small" style="top: 45%; left: 85%;"><img src="${logoDataUri}" /></div>
          <div class="watermark-logo-small" style="top: 60%; left: 95%;"><img src="${logoDataUri}" /></div>
        ` : ''}
      </div>
      
      <div class="document-header">
        <span class="document-title">Medical Certificate</span>
        <span class="document-brand">UniHealth</span>
      </div>
      
      <div class="page-content">
        <div class="doctor-header">
          <div class="doctor-info-left">
            <h1 class="doctor-name">${fullDoctorName || doctorName}, MD</h1>
            <div class="doctor-credentials">${safe(provider?.specialty || 'General Practitioner')}</div>
            <div class="clinic-affiliation-section">
              ${clinicScheduleInfo || ''}
            </div>
          </div>
          <div class="doctor-logo-right">
            ${logoDataUri ? `<img src="${logoDataUri}" alt="UniHealth Logo" />` : ''}
          </div>
        </div>
        
        <div class="header-divider"></div>
        
        <h1 class="certificate-title">FIT TO TRAVEL CERTIFICATE</h1>
        
        <div class="certificate-date">Date Issued: ${dateIssued}</div>
        
        <div class="certificate-salutation">TO WHOM IT MAY CONCERN:</div>
        
        <div class="certificate-body">
          <p>This is to certify that <strong>${patientName}</strong>, ${ageText}, ${gender}, was examined on <strong>${examinationDate}</strong> and found to be <strong>medically fit to travel</strong>. The patient has undergone medical evaluation and is cleared for travel with no medical contraindications identified.</p>
          
          <p>The patient is cleared for <strong>${travelMode}</strong> to <strong>${destination}</strong> with planned travel date of <strong>${travelDate}</strong>. ${specialConditions !== 'None' ? `Special travel conditions: <strong>${specialConditions}</strong>.` : 'No special travel restrictions apply.'} No signs of contagious diseases were observed during examination.</p>
          
          <p>This travel fitness certificate is issued upon the patient's request for travel clearance purposes and may be used for airline, immigration, or other travel-related requirements, except medico-legal proceedings.</p>
        </div>
        
        <div class="signature-section">
          <div class="signature-wrap">
            ${contextSignature ? `
              <div class="signature-image-container">
                <img src="${contextSignature}" alt="Signature" />
              </div>
            ` : '<div style="height: 60px;"></div>'}
            <div class="signature-line"></div>
            <div class="signature-name">Dr. ${fullDoctorName || doctorName}</div>
            ${finalDoctorPrcId ? `<div class="signature-details">PRC ID: ${finalDoctorPrcId}</div>` : ''}
            ${(provider as any)?.medicalLicenseNumber ? `<div class="signature-details">License No.: ${safe((provider as any).medicalLicenseNumber)}</div>` : ''}
            ${(provider as any)?.contactNumber || (provider as any)?.phone ? `<div class="signature-details">Contact: ${safe((provider as any).contactNumber || (provider as any).phone)}</div>` : ''}
          </div>
        </div>
      </div>

    </div>
  </div>
  <script>
    (function(){
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
  }, [loading, clinic, patient, provider, referral, certificate, logoDataUri, contextSignature, scheduleData, scheduleClinics, providerUser]);

  const handleGeneratePdf = async () => {
    try {
      // 8.5 x 13 inches at 72dpi (long bond)
      const { uri } = await Print.printToFileAsync({ html, width: 612, height: 936, base64: false });
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
      const filename = `UniHealth_FitToTravel_Certificate_${Date.now()}.pdf`;
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
        <Text style={styles.headerTitle}>Fit to Travel Certificate</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ flex: 1 }}>
        {!!error && (
          <View style={{ padding: 16 }}>
            <Text style={{ color: '#B91C1C' }}>{error}</Text>
          </View>
        )}
        {!error && (
          <>
            {loading || !html ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}>
                <Text style={{ fontSize: 16, color: '#6B7280' }}>Loading certificate...</Text>
              </View>
            ) : (
              <WebView
                ref={webViewRef}
                originWhitelist={["*"]}
                source={{ html }}
                style={{ flex: 1, backgroundColor: '#F3F4F6' }}
              />
            )}
          </>
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
        <View style={styles.modalContent}>
          <View style={styles.modalIconContainer}>
            <CheckCircle2 size={36} color="#1E40AF" />
          </View>
          <Text style={styles.modalTitle}>Certificate Downloaded</Text>
          <Text style={styles.modalMessage}>
            {downloadSavedPath ? `Your certificate has been saved.${Platform.OS !== 'android' ? '\nPath: ' + downloadSavedPath : ''}` : 'Your certificate has been saved.'}
          </Text>
          <View style={{ height: 8 }} />
          <TouchableOpacity style={styles.modalButton} onPress={() => setDownloadModalVisible(false)}>
            <Text style={styles.modalButtonText}>Done</Text>
          </TouchableOpacity>
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
  modalContent: {
    alignItems: 'center',
    gap: 12,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
  },
});
