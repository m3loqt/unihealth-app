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
  ActivityIndicator,
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
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [scheduleClinics, setScheduleClinics] = useState<any>({});

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
        const [clinicData, userData, patientProfileData, doctorData, doctorUserDoc] = await Promise.all([
          refData.referringClinicId ? databaseService.getDocument(`clinics/${refData.referringClinicId}`) : null,
          refData.patientId ? databaseService.getDocument(`users/${refData.patientId}`) : null,
          refData.patientId ? databaseService.getDocument(`patients/${refData.patientId}`) : null,
          // Try both specialist and generalist paths
          refData.assignedSpecialistId ? (async () => {
            const specialistProfile = await databaseService.getSpecialistProfile(refData.assignedSpecialistId);
            if (specialistProfile) return specialistProfile;
            // If not found as specialist, try as doctor (generalist)
            const doctorDoc = await databaseService.getDocument(`doctors/${refData.assignedSpecialistId}`);
            return doctorDoc;
          })() : null,
          refData.assignedSpecialistId ? databaseService.getDocument(`users/${refData.assignedSpecialistId}`) : null,
        ]);
        setClinic(clinicData);
        setPatient({ ...(userData || {}), ...(patientProfileData || {}) });
        setProvider(doctorData);
        setProviderUser(doctorUserDoc);

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

          // Load schedule data (specialist or generalist)
          try {
            // Check if this is a specialist or generalist
            const isGeneralist = doctorData?.isGeneralist === true;
            
            if (isGeneralist) {
              console.log('✅ Doctor is a generalist - loading availability and clinics');
              
              // For generalists, get availability and clinic affiliations
              if (doctorData?.availability) {
                setScheduleData(doctorData.availability);
                console.log('✅ Loaded generalist availability data');
              }
              
              // Load clinics from clinicAffiliations
              if (doctorData?.clinicAffiliations && Array.isArray(doctorData.clinicAffiliations)) {
                const clinicsMap: any = {};
                for (const clinicId of doctorData.clinicAffiliations) {
                  try {
                    const clinicInfo = await databaseService.getClinicById(clinicId);
                    if (clinicInfo) {
                      clinicsMap[clinicId] = clinicInfo;
                    }
                  } catch (err) {
                    console.log(`Could not load clinic ${clinicId}:`, err);
                  }
                }
                setScheduleClinics(clinicsMap);
                console.log(`✅ Loaded ${Object.keys(clinicsMap).length} clinics for generalist`);
              }
            } else {
              // For specialists, use the existing specialist schedule logic
              const schedules = await databaseService.getSpecialistSchedules(refData.assignedSpecialistId);
              if (schedules) {
                setScheduleData(schedules);
                console.log('✅ Loaded specialist schedule data');
                
                // Load clinic data for each schedule
                const clinicsMap: any = {};
                const scheduleKeys = Object.keys(schedules);
                for (const key of scheduleKeys) {
                  const schedule = schedules[key];
                  const clinicId = schedule?.practiceLocation?.clinicId;
                  if (clinicId && !clinicsMap[clinicId]) {
                    try {
                      const clinicData = await databaseService.getClinicById(clinicId);
                      if (clinicData) {
                        clinicsMap[clinicId] = clinicData;
                      }
                    } catch (err) {
                      console.log('Could not load clinic:', clinicId);
                    }
                  }
                }
                setScheduleClinics(clinicsMap);
                console.log('✅ Loaded clinic data for schedules');
              }
            }
          } catch (error) {
            console.log('Could not load schedule data:', error);
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

    const ageText = age && age !== '—' ? `${age}` : '—';
    const firstRx: any = Array.isArray(prescriptions) && prescriptions[0] ? (prescriptions[0] as any) : null;
    const prescriptionId = safe(((firstRx && (firstRx.id || firstRx.prescriptionId))
      || referral?.referralConsultationId
      || referral?.clinicAppointmentId
      || referral?.id
      || String(id)
      || '—'));

    // Circle numbers for prescriptions
    const circleNumbers = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
    
    // Generate prescription items in flowing format (like real prescription)
    const prescriptionItems = (Array.isArray(prescriptions) && prescriptions.length)
      ? prescriptions.map((p: any, idx: number) => {
          const medName = safe(p.medication || 'Medication');
          const dosage = safe(p.dosage || '');
          const quantity = p.quantity || p.duration || '';
          const freq = formatFrequency(p.frequency, user?.role || 'patient');
          const route = p.route ? formatRoute(p.route, user?.role || 'patient') : 'by mouth';
          const duration = p.duration || '';
          
          // Build Sig instruction
          const sigInstruction = `Take ${dosage} ${freq} ${route}${duration ? ' for ' + duration : ''}`;
          
          return `
            <div class="prescription-item">
              <div class="prescription-number">${circleNumbers[idx] || `${idx + 1}.`}</div>
              <div class="prescription-details">
                <div class="medication-line">${medName} ${dosage}</div>
                ${quantity ? `<div class="dispense-line"><span class="label">Disp:</span> <span class="value">#${quantity}</span></div>` : ''}
                <div class="sig-line"><span class="label">Sig:</span> <span class="value">${sigInstruction}</span></div>
              </div>
            </div>
          `;
        }).join('')
      : `<div class="prescription-item"><div class="prescription-details"><div class="medication-line">No prescriptions recorded</div></div></div>`;
    
    // Doctor credentials and specialty
    const doctorSpecialty = safe(provider?.specialty || 'Medical Specialist');
    const doctorCredentials = provider?.medicalLicenseNumber ? `License No.: ${safe(provider.medicalLicenseNumber)}` : '';
    const prcId = provider?.prcId ? `PRC ID: ${safe(provider.prcId)}` : '';

    // Format clinic schedule data - show all schedules
    let clinicScheduleInfo = '';
    const isGeneralist = provider?.isGeneralist === true;
    
    if (scheduleData) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayNamesMap: { [key: string]: number } = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      
      if (isGeneralist) {
        // Handle generalist availability data
        console.log('🔍 Rendering generalist schedule');
        const weeklySchedule = scheduleData?.weeklySchedule || {};
        
        // Collect enabled days with time slots
        const enabledDays: Array<{ day: string; dayNum: number; times: string }> = [];
        Object.entries(weeklySchedule).forEach(([day, config]: [string, any]) => {
          if (config?.enabled && config?.timeSlots && config.timeSlots.length > 0) {
            const dayNum = dayNamesMap[day.toLowerCase()];
            const firstSlot = config.timeSlots[0];
            const startTime = firstSlot.startTime || '';
            const endTime = firstSlot.endTime || '';
            
            // Convert to 12h format
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
        
        // Sort by day number
        enabledDays.sort((a, b) => a.dayNum - b.dayNum);
        
        // Build schedule string
        let daysStr = '';
        if (enabledDays.length === 7) {
          daysStr = 'Mon-Sun';
        } else if (enabledDays.length > 0) {
          // Check if consecutive
          let isConsecutive = true;
          for (let i = 0; i < enabledDays.length - 1; i++) {
            if (enabledDays[i + 1].dayNum - enabledDays[i].dayNum !== 1) {
              isConsecutive = false;
              break;
            }
          }
          if (isConsecutive) {
            daysStr = `${dayNames[enabledDays[0].dayNum]}-${dayNames[enabledDays[enabledDays.length - 1].dayNum]}`;
          } else {
            daysStr = enabledDays.map(d => dayNames[d.dayNum]).join(', ');
          }
        }
        
        const timeStr = enabledDays.length > 0 ? enabledDays[0].times : '';
        
        // Build schedule entries for each affiliated clinic
        const clinicIds = Object.keys(scheduleClinics);
        clinicIds.forEach((clinicId) => {
          const scheduleClinic = scheduleClinics[clinicId];
          const scheduleClinicName = scheduleClinic?.name || '';
          const addressParts = [
            scheduleClinic?.addressLine || scheduleClinic?.address,
            scheduleClinic?.city
          ].filter(Boolean);
          const scheduleClinicAddress = addressParts.length > 0 ? addressParts[0] : '';
          const scheduleClinicContact = scheduleClinic?.contactNumber || scheduleClinic?.phone || '';
          
          clinicScheduleInfo += `<div class="schedule-entry">`;
          if (scheduleClinicName) {
            clinicScheduleInfo += `<div class="clinic-info">${scheduleClinicName}${scheduleClinicAddress ? ', ' + scheduleClinicAddress : ''}</div>`;
          }
          if (daysStr && timeStr) {
            clinicScheduleInfo += `<div class="clinic-schedule">${daysStr} ${timeStr}</div>`;
          }
          if (scheduleClinicContact) {
            clinicScheduleInfo += `<div class="clinic-info">Tel: ${scheduleClinicContact}</div>`;
          }
          clinicScheduleInfo += `</div>`;
        });
      } else {
        // Handle specialist schedule data
        const scheduleKeys = Object.keys(scheduleData);
        if (scheduleKeys.length > 0) {
          // Process each schedule
          scheduleKeys.forEach((scheduleKey, index) => {
            const schedule = scheduleData[scheduleKey];
            
            // Get room/unit
            const room = schedule?.practiceLocation?.roomOrUnit || '';
            
            // Get clinic info for this schedule
            const scheduleClinicId = schedule?.practiceLocation?.clinicId || '';
            let scheduleClinicName = '';
            let scheduleClinicAddress = '';
            
            // Look up clinic from scheduleClinics map
            const scheduleClinic = scheduleClinics[scheduleClinicId];
            let scheduleClinicContact = '';
            if (scheduleClinic) {
              scheduleClinicName = scheduleClinic.name || '';
              const addressParts = [
                scheduleClinic.addressLine || scheduleClinic.address,
                scheduleClinic.city
              ].filter(Boolean);
              scheduleClinicAddress = addressParts.length > 0 ? addressParts[0] : '';
              scheduleClinicContact = scheduleClinic.contactNumber || scheduleClinic.phone || '';
            } else if (scheduleClinicId === clinic?.id) {
              // Fallback to current clinic if it matches
              scheduleClinicName = clinicName;
              scheduleClinicAddress = clinicAddress && clinicAddress !== '—' ? clinicAddress.split(',')[0] : '';
              scheduleClinicContact = clinic?.contactNumber || clinic?.phone || '';
            }
            
            // Get days of week
            const daysOfWeek = schedule?.recurrence?.dayOfWeek || [];
            let daysStr = '';
            if (daysOfWeek.length > 0) {
              const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
              if (sortedDays.length === 1) {
                daysStr = dayNames[sortedDays[0]];
              } else if (sortedDays.length === 7) {
                daysStr = 'Mon-Sun';
              } else if (sortedDays.length >= 2) {
                // Check if consecutive
                let isConsecutive = true;
                for (let i = 0; i < sortedDays.length - 1; i++) {
                  if (sortedDays[i + 1] - sortedDays[i] !== 1) {
                    isConsecutive = false;
                    break;
                  }
                }
                if (isConsecutive) {
                  daysStr = `${dayNames[sortedDays[0]]}-${dayNames[sortedDays[sortedDays.length - 1]]}`;
                } else {
                  daysStr = sortedDays.map(d => dayNames[d]).join(', ');
                }
              }
            }
            
            // Get time slots
            const slots = schedule?.slotTemplate || {};
            const times = Object.keys(slots).sort();
            let timeStr = '';
            if (times.length > 0) {
              const firstTime = times[0];
              // Convert 24h to 12h format
              const [hours, mins] = firstTime.split(':').map(Number);
              const period = hours >= 12 ? 'PM' : 'AM';
              const displayHours = hours % 12 || 12;
              timeStr = `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
            }
            
            // Build schedule entry (wrapped in a div for side-by-side display)
            clinicScheduleInfo += `<div class="schedule-entry">`;
            if (room) {
              clinicScheduleInfo += `<div class="clinic-schedule">${room}</div>`;
            }
            if (scheduleClinicName) {
              clinicScheduleInfo += `<div class="clinic-info">${scheduleClinicName}${scheduleClinicAddress ? ', ' + scheduleClinicAddress : ''}</div>`;
            }
            if (daysStr && timeStr) {
              clinicScheduleInfo += `<div class="clinic-schedule">${daysStr} ${timeStr}</div>`;
            }
            if (scheduleClinicContact) {
              clinicScheduleInfo += `<div class="clinic-info">Tel: ${scheduleClinicContact}</div>`;
            }
            clinicScheduleInfo += `</div>`;
          });
        }
      }
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    /* Print-first approach: Base styles optimized for 8.5" x 11" paper */
    @page { 
      size: 8.5in 11in; 
      margin: 0; 
    }
    
    html, body { 
      margin: 0; 
      padding: 0; 
      background: #FFFFFF; 
      color: ${text}; 
      -webkit-print-color-adjust: exact; 
      print-color-adjust: exact; 
      font-family: -apple-system, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    }
    
    /* Container and page setup */
    .preview { 
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      justify-content: flex-start;
      min-height: 100vh;
      background: #F3F4F6;
      overflow-x: hidden;
    }
    
    /* Print-optimized page dimensions */
    .page { 
      width: 8.5in;
      min-height: 11in;
      background: #FFFFFF; 
      position: relative; 
      display: block;
      box-sizing: border-box;
      padding: 0;
    }

    /* Document Header */
    .document-header {
      background: #1E40AF;
      color: #FFFFFF;
      padding: 16px 48px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .document-title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .document-brand {
      font-size: 18px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    .page-content {
      padding: 32px 48px;
    }

    /* Doctor header section */
    .doctor-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0;
      padding-bottom: 0;
      gap: 24px;
      position: relative;
    }

    .doctor-info-left {
      flex: 1;
      text-align: left;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    .doctor-logo-right {
      position: absolute;
      top: 0;
      right: 0;
      width: 150px;
      height: 150px;
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
    }

    .doctor-logo-right img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .header-divider {
      height: 2px;
      background: rgba(0, 0, 0, 0.8);
      margin: 0 0 12px 0;
    }

    .doctor-name {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 4px 0;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }

    .doctor-credentials {
      font-size: 14px;
      color: #374151;
      margin: 0 0 0 0;
      line-height: 1.5;
    }

    .clinic-info {
      font-size: 13px;
      color: #6B7280;
      margin: 1px 0 0 0;
      line-height: 1.4;
    }

    .clinic-affiliation-section {
      margin-top: 20px;
      margin-bottom: 20px;
      padding-top: 0;
      padding-bottom: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 0;
    }

    .schedule-entry {
      flex: 0 0 auto;
      min-width: 180px;
      margin-right: 24px;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    
    .schedule-entry:last-child {
      margin-right: 0;
    }

    .clinic-schedule {
      font-size: 13px;
      color: #6B7280;
      margin: 1px 0 0 0;
      line-height: 1.4;
    }
    
    .clinic-schedule:last-child,
    .clinic-info:last-child {
      margin-bottom: 0;
    }

    /* Patient info section */
    .patient-section {
      margin: 0 0 16px 0;
      padding-top: 0;
      padding-bottom: 16px;
      border-bottom: 2px solid rgba(0, 0, 0, 0.8);
      font-size: 16px;                            
      line-height: 1.6;
    }

    .patient-line {
      display: flex;
      align-items: baseline;
      margin-bottom: 6px;
    }

    .patient-label {
      font-weight: 600;
      color: #111827;
      min-width: 100px;
    }

    .patient-value {
      flex: 1;
      color: #374151;
      border-bottom: 1px solid rgba(0, 0, 0, 0.8);
      padding-bottom: 2px;
      margin-left: 8px;
    }

    .patient-inline {
      display: inline-flex;
      align-items: baseline;
      margin-right: 32px;
    }

    /* Rx section - flowing format */
    .rx-section {
      margin: 20px 0;
      display: flex;
      gap: 20px;
      align-items: flex-start;
    }

    .rx-symbol {
      font-size: 72px;
      font-weight: 700;
      color: #1F2937;
      line-height: 1;
      min-width: 90px;
      font-family: 'Times New Roman', serif;
    }

    .prescriptions-list {
      flex: 1;
    }

    .prescription-item {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.15);
    }

    .prescription-item:last-child {
      border-bottom: none;
    }

    .prescription-number {
      font-size: 22px;
      font-weight: 700;
      color: #000000;
      min-width: 28px;
      line-height: 1.4;
    }

    .prescription-details {
      flex: 1;
    }

    .medication-line {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 8px;
      line-height: 1.4;
    }

    .dispense-line,
    .sig-line {
      font-size: 18px;
      color: #374151;
      margin-bottom: 4px;
      line-height: 1.5;
    }

    .label {
      font-weight: 600;
      color: #6B7280;
      margin-right: 8px;
    }

    .value {
      color: #111827;
    }

    /* Signature section */
    .signature-section {
      position: absolute;
      bottom: 1.2in;
      right: 0.8in;
    }

    .signature-wrap {
      text-align: left;
      width: auto;
      max-width: 280px;
    }

    .signature-image-container {
      margin-bottom: 8px;
      height: auto;
      width: auto;
      display: inline-block;
      text-align: left;
    }
    
    .signature-image-container img {
      max-width: 180px;
      height: auto;
      object-fit: contain;
      display: inline-block;
      margin: 0 0 -20px -40px;
      padding: 0;
      vertical-align: top;
    }

    .signature-line {
      display: none;
    }

    .signature-name {
      font-size: 17px;
      font-weight: 700;
      color: #111827;
      margin: 6px 0 4px 0;
    }

    .signature-details {
      font-size: 14px;
      color: #6B7280;
      margin: 2px 0;
      line-height: 1.4;
    }

    .footer {
      position: absolute;
      bottom: 0.4in;
      left: 0.6in;
      right: 0.6in;
      padding-top: 0.2in;
      text-align: center;
      font-size: 11px;
      color: #9CA3AF;
      border-top: 1px solid rgba(0, 0, 0, 0.15);
    }

    /* Mobile scaling - scale down the print-ready layout */
    @media screen {
      .preview {
        padding: 16px 0;
      }
      
      .page {
        transform: scale(0.47);
        transform-origin: top center;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        border: 1px solid #E5E7EB;
        margin-bottom: -600px; /* Compensate for scaled height */
      }
    }

    /* Print settings - use original sizes */
    @media print {
      .preview {
        padding: 0;
        background: #FFFFFF;
        display: block;
      }
      
      .page {
        transform: none;
        box-shadow: none;
        border: none;
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
      }

      .page-content {
        padding: 0.5in 0.6in;
      }
      
      .signature-section {
        bottom: 1.2in;
        right: 0.8in;
      }
      
      .footer {
        bottom: 0.4in;
        left: 0.6in;
        right: 0.6in;
      }
    }
  </style>
</head>
<body>
  <div class="preview">
    <div class="page">
      
      <!-- Document Header -->
      <div class="document-header">
        <div class="document-title">E-Prescription</div>
        <div class="document-brand">UniHealth</div>
      </div>

      <!-- Page Content -->
      <div class="page-content">
      
      <!-- Doctor Header Section -->
      <div class="doctor-header">
        <div class="doctor-info-left">
          <h1 class="doctor-name">${doctorName}, MD</h1>
          <div class="doctor-credentials">${doctorSpecialty}</div>
          <div class="clinic-affiliation-section">
            ${clinicScheduleInfo || `
              <div class="schedule-entry">
                <div class="clinic-info">${clinicName}${clinicAddress && clinicAddress !== '—' ? ', ' + clinicAddress.split(',')[0] : ''}</div>
                ${clinicContact && clinicContact !== '—' ? `<div class="clinic-info">Tel: ${clinicContact}</div>` : ''}
          </div>
            `}
          </div>
        </div>
        <div class="doctor-logo-right">
          ${logoDataUri ? `<img src="${logoDataUri}" alt="UniHealth Logo" />` : ''}
      </div>
      </div>

      <!-- Header Divider -->
      <div class="header-divider"></div>

      <!-- Patient Information Section -->
      <div class="patient-section">
        <div class="patient-line">
          <span class="patient-label">Patient:</span>
          <span class="patient-value" style="flex: 7;">${patientName}</span>
          <span class="patient-label" style="margin-left: 24px;">Age/Sex:</span>
          <span class="patient-value" style="flex: 3;">${ageText}${gender && gender !== '—' ? ' / ' + gender : ''}</span>
        </div>
        <div class="patient-line">
          <span class="patient-label">Address:</span>
          <span class="patient-value" style="flex: 7;">${patientAddress || '—'}</span>
          <span class="patient-label" style="margin-left: 24px;">Date:</span>
          <span class="patient-value" style="flex: 3;">${dateIssued}</span>
        </div>
      </div>

      <!-- Rx Section with Flowing Format -->
      <div class="rx-section">
        <div class="rx-symbol">Rx</div>
        <div class="prescriptions-list">
          ${prescriptionItems}
           </div>
         </div>
        
      <!-- Signature Section -->
      <div class="signature-section">
            <div class="signature-wrap">
                ${doctorSignature ? `
            <div class="signature-image-container">
              <img src="${doctorSignature}" alt="Doctor Signature" />
              </div>
          ` : '<div style="height: 60px;"></div>'}
          <div class="signature-line"></div>
          <div class="signature-name">Dr. ${doctorName}</div>
          ${prcId ? `<div class="signature-details">${prcId}</div>` : ''}
          ${doctorCredentials ? `<div class="signature-details">${doctorCredentials}</div>` : ''}
          ${provider?.contactNumber || provider?.phone ? `<div class="signature-details">Contact: ${safe(provider.contactNumber || provider.phone)}</div>` : ''}
            </div>
          </div>

      <!-- Footer -->
      <div class="footer">
        Generated by UniHealth E-Prescription System • ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
      
      </div><!-- End Page Content -->

    </div>
  </div>
</body>
</html>`;
  }, [clinic, patient, provider, referral, prescriptions, logoDataUri, user?.role, doctorSignature, scheduleData, scheduleClinics]);

  const handleGeneratePdf = async () => {
    try {
      // 8.5 x 11 inches at 72dpi (letter size)
      // Using standard letter size dimensions for proper print quality
      const { uri } = await Print.printToFileAsync({ 
        html, 
        width: 612,  // 8.5 inches * 72 dpi
        height: 792, // 11 inches * 72 dpi
        base64: false 
      });
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
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#1E40AF" />
            <Text style={styles.loaderText}>Loading e-prescription...</Text>
          </View>
        ) : !!error ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: '#B91C1C' }}>{error}</Text>
          </View>
        ) : (
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
        <View style={styles.modalContent}>
          <View style={styles.modalIconContainer}>
            <CheckCircle2 size={40} color="#1E40AF" />
          </View>
          <Text style={styles.modalTitle}>E-Prescription Downloaded</Text>
          <Text style={styles.modalMessage}>
            {downloadSavedPath ? `Your e-prescription has been saved successfully.${Platform.OS !== 'android' ? '\n\nPath: ' + downloadSavedPath : ''}` : 'Your e-prescription has been saved successfully.'}
          </Text>
          <TouchableOpacity 
            style={styles.modalButton}
            onPress={() => setDownloadModalVisible(false)}
          >
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
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loaderText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter-Medium',
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
    paddingVertical: 8,
    gap: 16,
  },
  modalIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
    paddingHorizontal: 8,
  },
  modalButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
});


