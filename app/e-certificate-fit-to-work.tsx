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

export default function FitToWorkCertificateScreen() {
  const { id, certificateId, patientId } = useLocalSearchParams(); // consultationId or referralId, certificateId, patientId
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

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Reset certificate state to ensure fresh loading
      setCertificate(null);
      
      // If no id parameter, show error but don't crash
      if (!id) {
        setError('No consultation ID provided');
        setLoading(false);
        return;
      }
      
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
            
            // Load schedule data if we have a doctor
            if (doctorId && doctorData) {
              try {
                const isGeneralist = doctorData?.isGeneralist === true;
                
                if (isGeneralist) {
                  console.log(' Doctor is a generalist - loading availability and clinics');
                  
                  // For generalists, get availability and clinic affiliations
                  if (doctorData?.availability) {
                    setScheduleData(doctorData.availability);
                    console.log(' Loaded generalist availability data');
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
                    console.log(` Loaded ${Object.keys(clinicsMap).length} clinics for generalist`);
                  }
                } else {
                  // For specialists, use the existing specialist schedule logic
                  const schedules = await databaseService.getSpecialistSchedules(doctorId);
                  if (schedules) {
                    setScheduleData(schedules);
                    console.log(' Loaded specialist schedule data');
                    
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
                    console.log(' Loaded clinic data for schedules');
                  }
                }
              } catch (error) {
                console.log('Could not load schedule data:', error);
              }
            }
            
            // Early return - we have everything we need
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error('Error loading certificate:', error);
        }
      }
        
        // Fallback to original consultation data loading if certificate not found
        if (!loadedCertificate) {
          // Load referral, appointment, or medical history data
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
        
        if (dataSource && medicalHistoryData?.provider?.id) {
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
           (patientId || dataSource?.patientId) ? databaseService.getDocument(`users/${patientId || dataSource.patientId}`) : null,
           (patientId || dataSource?.patientId) ? databaseService.getDocument(`patients/${patientId || dataSource.patientId}`) : null,
         ]);
        
        // Debug logging
        setClinic(clinicData);
        setPatient({ ...(userData || {}), ...(patientProfileData || {}) });
        setProvider(doctorData);
        setProviderUser(doctorUserData);
        
        // Load schedule data if we have a doctor
        if (doctorId && doctorData) {
          try {
            const isGeneralist = doctorData?.isGeneralist === true;
            
            if (isGeneralist) {
              console.log(' Doctor is a generalist - loading availability and clinics');
              
              // For generalists, get availability and clinic affiliations
              if (doctorData?.availability) {
                setScheduleData(doctorData.availability);
                console.log(' Loaded generalist availability data');
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
                console.log(` Loaded ${Object.keys(clinicsMap).length} clinics for generalist`);
              }
            } else {
              // For specialists, use the existing specialist schedule logic
              const schedules = await databaseService.getSpecialistSchedules(doctorId);
              if (schedules) {
                setScheduleData(schedules);
                console.log(' Loaded specialist schedule data');
                
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
                console.log(' Loaded clinic data for schedules');
              }
            }
          } catch (error) {
            console.log('Could not load schedule data:', error);
          }
        }
        }
        
        // If no certificate found, create a default one for preview
        // BUT ONLY if we don't already have a certificate with signature data
        if (!loadedCertificate) {
          const defaultCertificate: Certificate = {
            id: `FTW-${Date.now()}`,
            patientId: String(patientId || user?.uid || ''),
            specialistId: user?.uid || '',
            type: 'Fit to Work Certificate',
            issueDate: new Date().toISOString(),
            status: 'active',
            description: 'Fit to Work Certificate',
            consultationId: String(id),
            medicalDetails: {
              dateFrom: '',
              dateTo: '',
              diagnosis: '',
              recommendations: 'The patient has been examined and is found to be medically fit to return to work.',
              restrictions: 'None',
              followUpDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
              restDays: 0
            },
            digitalSignature: '',
            signedDate: '',
            isSigned: false
          };
          // Only set default if we don't have a loaded certificate with signature
          if (!loadedCertificate?.digitalSignature) {
            setCertificate(defaultCertificate);
          }
        }
        
      } catch (e) {
        setError('Failed to load certificate data');
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    loadData();
    // Only reload when certificateId or id changes, not patientId (reduces unnecessary reloads)
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
    const patientName = safe(fullName(patient, certificate?.patientDetails ? `${certificate.patientDetails.firstName} ${certificate.patientDetails.lastName}`.trim() : 'Unknown Patient'));
    const dob = safe(formatDateFlexible((patient?.dateOfBirth || patient?.dob || patient?.birthDate) as any));
    const age = computeAgeFromInput(patient?.dateOfBirth || patient?.dob || patient?.birthDate);
    const gender = safe((patient?.gender || patient?.sex || '') as any);
    const patientAddress = safe((patient?.address || certificate?.patientDetails?.address || '') as any);
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
        // Try to get from medical history provider
        if (referral?.referralConsultationId || referral?.consultationId) {
          try {
            const consultationId = referral.referralConsultationId || referral.consultationId;
            const mh = databaseService.getDocument(
              `patientMedicalHistory/${referral.patientId}/entries/${consultationId}`
            ).then(mh => {
              if (mh?.provider?.firstName && mh?.provider?.lastName) {
                return `${mh.provider.firstName} ${mh.provider.lastName}`;
              }
            });
          } catch {}
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
    const doctorEmail = providerUser?.email || (certificate as any)?.doctorDetails?.email || (provider as any)?.email || user?.email || '';
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
    console.log(' Certificate date debug:', {
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
    
    // Extract medical details from certificate
    const diagnosis = safe(certificate?.medicalDetails?.diagnosis || 'Not specified');
    const fitnessStatement = safe(certificate?.medicalDetails?.fitnessStatement || certificate?.medicalDetails?.recommendations || 'The patient has been examined and is found to be medically fit to return to work.');
    const recommendations = safe(certificate?.medicalDetails?.recommendations || 'Follow medical advice');
    const workRestrictions = safe(certificate?.medicalDetails?.restrictions || 'None');
    const remarks = safe(certificate?.medicalDetails?.remarks || '');
    const nextReviewDate = safe(formatDateFlexible(certificate?.medicalDetails?.followUpDate));

    const ageText = age && age !== '—' ? `${age} years old` : '—';
    
    // Get doctor specialty
    const doctorSpecialty = safe(provider?.specialty || 'General Practitioner');

    // Format clinic schedule data - show all schedules
    let clinicScheduleInfo = '';
    const isGeneralist = provider?.isGeneralist === true;
    
    if (scheduleData) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayNamesMap: { [key: string]: number } = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      
      if (isGeneralist) {
        // Handle generalist availability data
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
      size: 8.5in 13in; 
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
      min-height: 13in;
      background: #FFFFFF; 
      position: relative; 
      display: block;
      box-sizing: border-box;
      padding: 0;
    }

    .page-content {
      padding: 32px 48px;
      padding-bottom: 3in;
      position: relative;
      z-index: 1;
    }
    
    .page .header, .page .top, .page .body { position: relative; z-index: 1; }

    /* Watermark */
    .watermark {
      position: absolute;
      bottom: 0.8in;
      left: 48px;
      display: flex;
      align-items: flex-end;
      justify-content: flex-start;
      opacity: 0.18;
      z-index: 1;
      pointer-events: none;
    }
    .watermark img {
      max-width: 65%;
      height: auto;
      transform: translateY(12px);
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
      height: 1px;
      background: rgba(0, 0, 0, 0.15);
      margin: 20px 0 0 0;
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

    .certificate-title { 
      font-weight: 700; 
      font-size: 28px; 
      color: #111827; 
      margin: 32px 0 24px; 
      text-align: center; 
      text-transform: uppercase; 
      letter-spacing: 0.5px; 
      text-decoration: none; 
    }
    
    .certificate-date { 
      text-align: left; 
      font-size: 14px; 
      color: #374151; 
      margin-top: 50px;
      margin-bottom: 50px; 
      font-weight: 500;
    }
    
    .certificate-salutation { 
      font-size: 15px; 
      font-weight: 700; 
      color: #111827; 
      margin: 24px 0; 
      letter-spacing: 0.5px;
    }
    
    .certificate-body { 
      line-height: 2.0; 
      font-size: 16px; 
      color: #1F2937; 
      text-align: justify; 
    }
    
    .certificate-body p { 
      margin: 20px 0; 
      text-indent: 40px; 
      line-height: 2.0;
    }
    
    .certificate-body strong {
      font-weight: 600;
      color: #111827;
    }
    
    .certificate-body em {
      font-style: italic;
      color: #374151;
      font-weight: 500;
    }
    
    .certificate-info-section { 
      margin: 24px 0; 
      padding: 18px; 
      background: #F9FAFB; 
      border-left: 3px solid ${brandPrimary}; 
      border-radius: 4px; 
    }
    
    /* Signature section */
    .signature-section {
      position: absolute;
      bottom: 1.2in;
      right: 0.8in;
      z-index: 2;
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

    .signature-line { display: none; }

    .signature-name {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin: 6px 0 4px 0;
    }

    .signature-caption {
      font-size: 13px;
      color: #6B7280;
      margin: 2px 0;
      line-height: 1.4;
    }
    
    .signature-details {
      font-size: 14px;
      color: #6B7280;
      margin: 2px 0;
      line-height: 1.4;
    }
    
    
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
      
      .watermark { left: 0.6in; bottom: 0.8in; }
    }
  </style>
</head>
<body>
  <div class="preview">
    <div class="page">
      <!-- Watermark -->
      <div class="watermark">
        ${logoDataUri ? `<img src="${logoDataUri}" alt="UniHealth Watermark" />` : ''}
      </div>
      <!-- Document Header -->
      <div class="document-header">
        <div class="document-title">Medical Certificate</div>
        <div class="document-brand">UniHealth</div>
      </div>

      <!-- Page Content -->
      <div class="page-content">
        <!-- Doctor Header Section -->
        <div class="doctor-header">
          <div class="doctor-info-left">
            <h1 class="doctor-name">${fullDoctorName || doctorName}, MD</h1>
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
        
        <h1 class="certificate-title">FIT TO WORK CERTIFICATE</h1>
        
        <div class="certificate-date">Date Issued: ${dateIssued}</div>
        
        <div class="certificate-salutation">TO WHOM IT MAY CONCERN:</div>
        
        <div class="certificate-body">
          <p>This is to certify that <strong>${patientName}</strong>, ${ageText}, ${gender}, residing at ${patientAddress || 'address on file'}, was examined on <strong>${examinationDate}</strong> at our medical facility. ${diagnosis && diagnosis !== 'Not specified' ? `Upon examination, the patient presented with a medical history of <strong>${diagnosis}</strong>. ` : ''}Following a comprehensive medical assessment and review of the patient's current health status, it has been determined that the individual is <strong>${fitnessStatement}</strong>.</p>
          
          ${workRestrictions && workRestrictions !== 'None' ? `<p>Based on the medical evaluation, the following work restrictions are recommended for the patient's safety and well-being: <strong>${workRestrictions}</strong>. These restrictions should be observed to ensure optimal recovery and prevent any potential complications during work activities.</p>` : '<p>Based on the medical evaluation, the patient is cleared to resume all regular work activities without any restrictions. The individual is deemed fit to perform duties commensurate with their job description and responsibilities.</p>'}
          
          ${recommendations && recommendations !== 'Follow medical advice' ? `<p>The following medical recommendations are advised: <strong>${recommendations}</strong>. Adherence to these recommendations will support the patient's continued health and successful return to work.</p>` : ''}
          
          ${remarks ? `<p><em>Additional Medical Notes:</em> ${remarks}</p>` : ''}
          
          <p style="margin-top: 30px;">This medical certificate is issued in good faith based on the findings at the time of examination. It is being provided upon the patient's request for employment, administrative, or other legitimate purposes, except for medico-legal proceedings.</p>
        </div>
      </div>
      
      <!-- Signature Section (outside page-content) -->
      <div class="signature-section">
        <div class="signature-wrap">
          ${contextSignature ? `
            <div class="signature-image-container">
              <img src="${contextSignature}" alt="Signature" />
            </div>
          ` : '<div style="height: 60px;"></div>'}
          
          <div class="signature-name">Dr. ${fullDoctorName || doctorName}</div>
          ${finalDoctorPrcId ? `<div class="signature-details">PRC ID: ${finalDoctorPrcId}</div>` : ''}
          ${(provider as any)?.medicalLicenseNumber ? `<div class="signature-details">License No.: ${safe((provider as any).medicalLicenseNumber)}</div>` : ''}
          ${(provider as any)?.contactNumber || (provider as any)?.phone ? `<div class="signature-details">Contact: ${safe((provider as any).contactNumber || (provider as any).phone)}</div>` : ''}
        </div>
      </div>

    </div>
  </div>
  <script>
    (function(){
      // Signature line width = doctor name width + 10px
      var nameEl = document.querySelector('.signature-name');
      
    })();
  </script>
</body>
</html>`;
  }, [clinic, patient, provider, referral, certificate, logoDataUri, contextSignature, scheduleData, scheduleClinics]);

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
          <>
            {loading || !html ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6', padding: 20 }}>
                <Text style={{ fontSize: 16, color: '#6B7280', marginBottom: 10 }}>Loading certificate...</Text>
                {/* <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 5 }}>ID: {id || 'None'}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 5 }}>Certificate ID: {certificateId || 'None'}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 5 }}>Patient ID: {patientId || 'None'}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 5 }}>Has Certificate: {certificate ? 'Yes' : 'No'}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 5 }}>Has Signature: {contextSignature ? 'Yes' : 'No'}</Text> */}
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
