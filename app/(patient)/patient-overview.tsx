import React, { useState, useEffect } from 'react';
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
  Linking,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  ChevronLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  Clock,
  ChevronRight,
  Pill,
  Heart,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Plus,
  ChevronDown,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/hooks/auth/useAuth';
import { databaseService, Patient, Appointment, MedicalHistory, Prescription } from '../../src/services/database/firebase';
import safeDataAccess from '../../src/utils/safeDataAccess';
import { capitalizeRelationship, formatRoute } from '../../src/utils/formatting';
import LoadingState from '../../src/components/ui/LoadingState';
import ErrorBoundary from '../../src/components/ui/ErrorBoundary';
import { dataValidation } from '../../src/utils/dataValidation';
import { performanceUtils } from '../../src/utils/performance';

interface PatientData extends Patient {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodType?: string;
  allergies?: string[];
  phone?: string;
  email?: string;
  emailAddress?: string;
  address?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  medicalConditions?: string[];
  currentCondition?: string;
  visitHistory?: {
    firstVisit?: string;
    lastVisit?: string;
    visitCount?: number;
    currentAdmission?: {
      admissionDate: string;
      department: string;
      attendingStaffName: string;
    };
  };
  medUse?: Array<{
    name: string;
    quantity: number;
    timestamp: string;
  }>;
}

export default function PatientOverviewScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [joinedDate, setJoinedDate] = useState<string | null>(null);
  const [resolvedDOB, setResolvedDOB] = useState<string | null>(null);
  const [resolvedAge, setResolvedAge] = useState<number | null>(null);
  const [confirmedReferrals, setConfirmedReferrals] = useState<any[]>([]);
  
     // New state for collapsible sections
   const [showAllPrescriptions, setShowAllPrescriptions] = useState(false);
   const [showAllRecords, setShowAllRecords] = useState(false);
   
   // Pagination state
   const [prescriptionPage, setPrescriptionPage] = useState(1);
   const [medicalHistoryPage, setMedicalHistoryPage] = useState(1);
   const itemsPerPage = 5;

  // Load patient data from Firebase
  useEffect(() => {
    if (id) {
      loadPatientData();
    }
  }, [id]);

  const loadPatientData = async () => {
    if (!id) return;
    
    console.log('🔍 PATIENT OVERVIEW - Loading data for patient ID:', id);
    
    try {
      setLoading(true);
      setError(null);
      
      // Load all patient data in parallel
      const [patient, patientAppointments, patientMedicalHistory, patientPrescriptions, allReferrals] = await Promise.all([
        databaseService.getPatientById(id as string),
        databaseService.getAppointmentsByPatient(id as string),
        databaseService.getMedicalHistory(id as string),
        databaseService.getPrescriptions(id as string),
        databaseService.getDocument('referrals')
      ]);

      if (patient) {
        // Additional patient data fetching from users node for complete information
        let usersNodeData = null;
        try {
          usersNodeData = await databaseService.getDocument(`users/${id}`);
          console.log('🔍 USERS NODE DATA:', usersNodeData);
        } catch (error) {
          console.log('Could not fetch users node data:', error);
        }

        // Fallback: try to find user data by userId field if direct UID lookup failed
        let usersNodeDataByPatientId = null;
        if (!usersNodeData && (patient as any)?.userId) {
          try {
            usersNodeDataByPatientId = await databaseService.getDocument(`users/${(patient as any).userId}`);
            console.log('🔍 FALLBACK - USERS NODE DATA BY USERID FIELD:', usersNodeDataByPatientId);
          } catch (error) {
            console.log('Fallback failed - could not fetch users node data by userId field:', error);
          }
        }

        // Patient objects from DB may not have a `uid`; accept as-is
        const validAppointments = dataValidation.validateArray(patientAppointments, dataValidation.isValidAppointment);
        const validPrescriptions = dataValidation.validateArray(patientPrescriptions, dataValidation.isValidPrescription);

        // Filter medical history to only show entries that have a corresponding appointment with appointmentConsultationId
        // or referral with referralConsultationId, and exclude hidden records
        const filteredMedicalHistory = patientMedicalHistory?.filter(historyItem => {
          // First check if the record is hidden - if so, exclude it
          // Only exclude if isHidden is explicitly true (null or undefined means it should be shown)
          if ((historyItem as any)?.isHidden === true) {
            return false;
          }
          
          // Check if there's an appointment with appointmentConsultationId matching this medical history entry ID
          const hasMatchingAppointment = validAppointments.some(appointment => 
            appointment.appointmentConsultationId === historyItem.id
          );
          
          // Check if there's a referral with referralConsultationId matching this medical history entry ID
          let hasMatchingReferral = false;
          if (allReferrals) {
            hasMatchingReferral = Object.values(allReferrals as Record<string, any>).some((referral: any) => 
              referral?.patientId === id && 
              referral?.referralConsultationId === historyItem.id
            );
          }
          
          return hasMatchingAppointment || hasMatchingReferral;
        }) || [];

        // Combine patient data with additional fetched data (similar to referral-details.tsx approach)
        const combinedPatientData: PatientData = {
          ...patient,
          // Enhanced patient information - prioritize fetched users node data over patient node data
          firstName: (() => {
            // Try to get name from users node data first
            const userData = usersNodeData || usersNodeDataByPatientId;
            if (userData) {
              const firstName = userData.firstName || userData.first_name || userData.givenName || '';
              if (firstName) return firstName;
            }
            
            // Fallback to patient node data
            return (patient as any)?.firstName || (patient as any)?.first_name || (patient as any)?.givenName || '';
          })(),
          
          lastName: (() => {
            // Try to get name from users node data first
            const userData = usersNodeData || usersNodeDataByPatientId;
            if (userData) {
              const lastName = userData.lastName || userData.last_name || userData.familyName || '';
              if (lastName) return lastName;
            }
            
            // Fallback to patient node data
            return (patient as any)?.lastName || (patient as any)?.last_name || (patient as any)?.familyName || '';
          })(),
          
          dateOfBirth: (() => {
            // Try to get DOB from users node data first
            const userData = usersNodeData || usersNodeDataByPatientId;
            if (userData) {
              const dob = userData.dateOfBirth || userData.dob || userData.birthDate || userData.birthday || 
                         userData.profile?.dateOfBirth || userData.profile?.dob || '';
              if (dob) return dob;
            }
            
            // Fallback to patient node data
            return (patient as any)?.dateOfBirth || (patient as any)?.dob || (patient as any)?.birthDate || (patient as any)?.birthday || '';
          })(),
          
          gender: (() => {
            // Try to get gender from users node data first
            const userData = usersNodeData || usersNodeDataByPatientId;
            if (userData) {
              const gender = userData.gender || userData.sex || userData.profile?.gender || '';
              if (gender) return gender;
            }
            
            // Fallback to patient node data
            return (patient as any)?.gender || (patient as any)?.sex || '';
          })(),
          
          phone: (() => {
            // Try to get phone from users node data first
            const userData = usersNodeData || usersNodeDataByPatientId;
            if (userData) {
              const phone = userData.phone || userData.phoneNumber || userData.mobile || userData.contactNumber || '';
              if (phone) return phone;
            }
            
            // Fallback to patient node data
            return (patient as any)?.phone || (patient as any)?.phoneNumber || (patient as any)?.mobile || (patient as any)?.contactNumber || '';
          })(),
          
          email: (() => {
            // Try to get email from users node data first
            const userData = usersNodeData || usersNodeDataByPatientId;
            if (userData) {
              const email = userData.email || userData.emailAddress || '';
              if (email) return email;
            }
            
            // Fallback to patient node data
            return (patient as any)?.email || (patient as any)?.emailAddress || '';
          })(),
          
          address: (() => {
            // Try to get address from users node data first
            const userData = usersNodeData || usersNodeDataByPatientId;
            if (userData) {
              const address = userData.address || userData.homeAddress || userData.residentialAddress || 
                            userData.profile?.address || userData.profile?.homeAddress || '';
              if (address) return address;
            }
            
            // Fallback to patient node data
            return (patient as any)?.address || (patient as any)?.homeAddress || (patient as any)?.residentialAddress || '';
          })(),
          
          bloodType: (() => {
            // Try to get blood type from users node data first
            const userData = usersNodeData || usersNodeDataByPatientId;
            if (userData) {
              const bloodType = userData.bloodType || userData.bloodGroup || userData.profile?.bloodType || '';
              if (bloodType) return bloodType;
            }
            
            // Fallback to patient node data
            return (patient as any)?.bloodType || (patient as any)?.bloodGroup || '';
          })(),
          
          allergies: (() => {
            // Try to get allergies from users node data first
            const userData = usersNodeData || usersNodeDataByPatientId;
            if (userData) {
              const allergies = userData.allergies || userData.allergyList || userData.profile?.allergies || [];
              if (allergies && Array.isArray(allergies) && allergies.length > 0) return allergies;
            }
            
            // Fallback to patient node data
            return (patient as any)?.allergies || (patient as any)?.allergyList || [];
          })(),
          
          medicalConditions: (() => {
            // Try to get medical conditions from users node data first
            const userData = usersNodeData || usersNodeDataByPatientId;
            if (userData) {
              const conditions = userData.medicalConditions || userData.conditions || userData.profile?.medicalConditions || [];
              if (conditions && Array.isArray(conditions) && conditions.length > 0) return conditions;
            }
            
            // Fallback to patient node data
            return (patient as any)?.medicalConditions || (patient as any)?.conditions || [];
          })(),
          
          emergencyContact: (() => {
            // Try to get emergency contact from users node data first
            const userData = usersNodeData || usersNodeDataByPatientId;
            if (userData) {
              const emergencyContact = userData.emergencyContact || userData.emergency || userData.profile?.emergencyContact || null;
              if (emergencyContact) return emergencyContact;
            }
            
            // Fallback to patient node data
            return (patient as any)?.emergencyContact || (patient as any)?.emergency || null;
          })(),
        };

        setPatientData(combinedPatientData);
        setAppointments(validAppointments);
        setMedicalHistory(filteredMedicalHistory);
        setPrescriptions(validPrescriptions);

        // Debug logging for enhanced patient data retrieval
        console.log('🔍 PATIENT DATA RETRIEVAL DEBUG:', {
          patientId: id,
          patientNodeData: patient,
          usersNodeData: usersNodeData,
          usersNodeDataByPatientId: usersNodeDataByPatientId,
          finalUserDataUsed: usersNodeData || usersNodeDataByPatientId,
          combinedPatientData: {
            firstName: combinedPatientData.firstName,
            lastName: combinedPatientData.lastName,
            dateOfBirth: combinedPatientData.dateOfBirth,
            gender: combinedPatientData.gender,
            phone: combinedPatientData.phone,
            email: combinedPatientData.email,
            address: combinedPatientData.address,
            bloodType: combinedPatientData.bloodType,
            allergies: combinedPatientData.allergies,
            medicalConditions: combinedPatientData.medicalConditions,
            emergencyContact: combinedPatientData.emergencyContact
          }
        });

        // Debug logging for medical history
        console.log('🔍 MEDICAL HISTORY FILTERING DEBUG:', {
          originalCount: patientMedicalHistory?.length || 0,
          filteredCount: filteredMedicalHistory.length,
          filteredOutCount: (patientMedicalHistory?.length || 0) - filteredMedicalHistory.length,
          hiddenRecordsCount: patientMedicalHistory?.filter(item => (item as any)?.isHidden === true).length || 0,
          filteredItems: filteredMedicalHistory.map(item => ({
            id: item.id,
            type: item.type,
            consultationDate: item.consultationDate,
            provider: item.provider,
            isHidden: (item as any)?.isHidden || false,
            hasMatchingAppointment: validAppointments.some(appointment => 
              appointment.appointmentConsultationId === item.id
            ),
            hasMatchingReferral: allReferrals ? Object.values(allReferrals as Record<string, any>).some((referral: any) => 
              referral?.patientId === id && 
              referral?.referralConsultationId === item.id
            ) : false
          }))
        });

        // Debug logging for appointments
        console.log('🔍 APPOINTMENTS DEBUG:', {
          count: validAppointments?.length || 0,
          items: validAppointments?.map(item => ({
            id: item.id,
            type: item.type,
            status: item.status,
            appointmentConsultationId: item.appointmentConsultationId,
            consultationId: item.consultationId
          }))
        });

        // Debug logging for prescriptions filtering
        console.log('🔍 PRESCRIPTIONS FILTERING DEBUG:', {
          totalPrescriptions: validPrescriptions?.length || 0,
          activePrescriptions: validPrescriptions?.filter(p => p.status === 'active').length || 0,
          hiddenHistoryEntries: filteredMedicalHistory.filter(item => (item as any)?.isHidden === true).length,
          prescriptionsWithConsultationIds: validPrescriptions?.filter(p => p.consultationId || p.appointmentConsultationId).length || 0
        });

        // Debug logging for user role
        console.log('🔍 USER ROLE DEBUG:', {
          userId: user?.uid,
          userRole: user?.role,
          userEmail: user?.email,
          isSpecialist: user?.role === 'specialist'
        });

        // Derive Joined Date from multiple sources (patients/users.createdAt, earliest appointment/referral)
        try {
          const dateCandidates: number[] = [];
          const pushIfValid = (d?: any) => {
            if (!d) return;
            const t = new Date(d).getTime();
            if (!isNaN(t)) dateCandidates.push(t);
          };

          // patients node createdAt
          pushIfValid((patient as any)?.createdAt);

          // users node createdAt
          const usersNodeRecordLocal = await databaseService.getDocument(`users/${id}`);
          pushIfValid(usersNodeRecordLocal?.createdAt);

          // earliest appointment date
          (patientAppointments || []).forEach((apt) => pushIfValid(apt?.appointmentDate));

          // earliest referral timestamp/date
          try {
            const allReferrals = await databaseService.getDocument('referrals');
            if (allReferrals) {
              Object.values(allReferrals).forEach((r: any) => {
                if (r?.patientId === id) {
                  pushIfValid(r?.referralTimestamp);
                  pushIfValid(r?.appointmentDate);
                }
              });
            }
          } catch {}

          if (dateCandidates.length > 0) {
            const earliest = new Date(Math.min(...dateCandidates));
            const formatted = formatDate(earliest.toISOString());
            setJoinedDate(formatted);
          } else {
            setJoinedDate(null);
          }
        } catch {}

        // Resolve DOB and Age from patients/users nodes
        try {
          const usersNodeRecordLocal = await databaseService.getDocument(`users/${id}`);
          const parseDate = (raw: any): Date | null => {
            if (!raw) return null;
            try {
              if (typeof raw === 'number') {
                // Handle seconds vs milliseconds epoch
                const ms = raw < 1e12 ? raw * 1000 : raw;
                const d = new Date(ms);
                return isNaN(d.getTime()) ? null : d;
              }
              if (typeof raw === 'string') {
                const maybeNum = Number(raw);
                if (!isNaN(maybeNum) && raw.trim() !== '') {
                  const ms = maybeNum < 1e12 ? maybeNum * 1000 : maybeNum;
                  const dNum = new Date(ms);
                  if (!isNaN(dNum.getTime())) return dNum;
                }
                // Try native parse first
                const dNative = new Date(raw);
                if (!isNaN(dNative.getTime())) return dNative;
                // Try common date formats like DD/MM/YYYY or MM/DD/YYYY or YYYY/MM/DD
                const cleaned = raw.replace(/[-\.]/g, '/');
                const parts = cleaned.split('/').map(p => p.trim());
                if (parts.length === 3) {
                  let day: number, month: number, year: number;
                  if (parts[0].length === 4) {
                    // YYYY/MM/DD
                    year = Number(parts[0]); month = Number(parts[1]); day = Number(parts[2]);
                  } else if (Number(parts[0]) > 12) {
                    // DD/MM/YYYY
                    day = Number(parts[0]); month = Number(parts[1]); year = Number(parts[2]);
                  } else if (Number(parts[1]) > 12) {
                    // MM/DD/YYYY (second part as day if >12)
                    month = Number(parts[0]); day = Number(parts[1]); year = Number(parts[2]);
                  } else {
                    // Fallback assume MM/DD/YYYY
                    month = Number(parts[0]); day = Number(parts[1]); year = Number(parts[2]);
                  }
                  if (year && month && day) {
                    const dParts = new Date(year, month - 1, day);
                    if (!isNaN(dParts.getTime())) return dParts;
                  }
                }
                return null;
              }
              return null;
            } catch {
              return null;
            }
          };

          // Candidates from already fetched patient and users node
          const dobCandidates: any[] = [
            (patient as any)?.dateOfBirth,
            (patient as any)?.dob,
            (patient as any)?.birthDate,
            (patient as any)?.birthday,
          ];
          if (usersNodeRecordLocal) {
            dobCandidates.push(
              usersNodeRecordLocal?.dateOfBirth,
              usersNodeRecordLocal?.dob,
              usersNodeRecordLocal?.birthDate,
              usersNodeRecordLocal?.birthday,
              usersNodeRecordLocal?.profile?.dateOfBirth,
              usersNodeRecordLocal?.profile?.dob,
            );
          }
          let dobDate: Date | null = null;
          for (const cand of dobCandidates) {
            const parsed = parseDate(cand);
            if (parsed) { dobDate = parsed; break; }
          }
          if (dobDate) {
            setResolvedDOB(formatDate(dobDate.toISOString()));
            // Compute age
            const today = new Date();
            let age = today.getFullYear() - dobDate.getFullYear();
            const monthDiff = today.getMonth() - dobDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
              age -= 1;
            }
            setResolvedAge(age);
          } else {
            // Fallback: use explicit age fields if present
            const explicitAge = safeDataAccess.getUserAge(patient as any, null) ?? safeDataAccess.getUserAge(usersNodeRecordLocal as any, null);
            setResolvedDOB(null);
            setResolvedAge(explicitAge);
          }
        } catch {}

        // Collect confirmed referrals for this patient
        try {
          const allReferrals = await databaseService.getDocument('referrals');
          const refs: any[] = [];
          if (allReferrals) {
            Object.entries(allReferrals as Record<string, any>).forEach(([refId, r]) => {
              if (r?.patientId === id && String(r?.status).toLowerCase() === 'confirmed') {
                refs.push({
                  id: refId,
                  type: r?.type || 'referral',
                  appointmentDate: r?.appointmentDate,
                  appointmentTime: r?.appointmentTime,
                  status: r?.status,
                  specialistId: r?.assignedSpecialistId,
                  specialistName: r?.assignedSpecialistFirstName || r?.assignedSpecialistLastName
                    ? `${r?.assignedSpecialistFirstName || ''} ${r?.assignedSpecialistLastName || ''}`.trim()
                    : (r?.specialistName || ''),
                  reason: r?.initialReasonForReferral || r?.reason || '',
                  source: 'referral',
                });
              }
            });
          }
          setConfirmedReferrals(refs);
        } catch {}
      }
    } catch (error) {
      console.error('Error loading patient data:', error);
      setError('Failed to load patient data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPatientData();
    setRefreshing(false);
  };

  const handleRetry = () => {
    setError(null);
    loadPatientData();
  };

  const handleEmergencyCall = () => {
    const emergencyPhone = safeDataAccess.getEmergencyContactPhone(patientData);
    if (emergencyPhone && emergencyPhone !== 'Not provided') {
      Linking.openURL(`tel:${emergencyPhone}`);
    } else {
      Alert.alert('No Emergency Contact', 'Emergency contact information is not available.');
    }
  };

  const handleActiveConsultationPress = () => {
    if (activeConsultations.length === 0) return;
    const item: any = activeConsultations[0];
    if (item.source === 'referral') {
      router.push(`/(specialist)/referral-details?id=${item.id}`);
    } else {
      router.push(`/visit-overview?id=${item.id}`);
    }
  };

  const handleMedicalHistoryPress = async (historyItem: MedicalHistory) => {
    try {
      console.log('🔍 MEDICAL HISTORY PRESS DEBUG:', {
        historyItemId: historyItem.id,
        historyItemType: historyItem.type,
        userRole: user?.role
      });

      // First, check if this medical history item has a related referral ID
      if ((historyItem as any)?.relatedReferral?.id) {
        // If it has a related referral, route to referral details
        console.log('🔍 Routing to referral details with referral ID:', (historyItem as any).relatedReferral.id);
        router.push(`/(specialist)/referral-details?id=${(historyItem as any).relatedReferral.id}`);
        return;
      }

      // Instead of using relatedAppointment.id, find the appointment by checking appointmentConsultationId
      // Get all appointments for this patient and find the one with matching appointmentConsultationId
      const patientIdStr = String(id);
      console.log('🔍 Finding appointment for medical history entry ID:', historyItem.id);
      console.log('🔍 Patient ID:', patientIdStr);
      
      try {
        // Get all appointments for this patient
        const patientAppointments = await databaseService.getAppointmentsByPatient(patientIdStr);
        console.log('🔍 Retrieved patient appointments:', patientAppointments);
        
        // Find the appointment that has appointmentConsultationId matching this medical history entry ID
        const matchingAppointment = patientAppointments.find(appointment => 
          appointment.appointmentConsultationId === historyItem.id
        );
        
        if (matchingAppointment) {
          console.log('🔍 Found matching appointment:', matchingAppointment);
          console.log('🔍 Routing to visit overview with appointment ID:', matchingAppointment.id);
          router.push(`/visit-overview?id=${matchingAppointment.id}`);
          return;
        } else {
          console.log('🔍 No matching appointment found for medical history entry ID:', historyItem.id);
          Alert.alert('No Medical History', 'Medical history is only available for completed consultations.');
          return;
        }
      } catch (error) {
        console.error('🔍 Error fetching appointments:', error);
        Alert.alert('Error', 'Failed to load appointment details. Please try again.');
        return;
      }

      // Check if this medical history item has a consultation ID that matches a referral
      const allReferrals = await databaseService.getDocument('referrals');
      let matchedReferralId: string | null = null;

      if (allReferrals) {
        for (const [refId, r] of Object.entries(allReferrals as Record<string, any>)) {
          if (r?.patientId === patientIdStr) {
            // Check if this medical history item matches a referral consultation
            if (
              r?.referralConsultationId === historyItem.id ||
              r?.consultationId === historyItem.id ||
              r?.clinicConsultationId === historyItem.id
            ) {
              matchedReferralId = refId;
              break;
            }
          }
        }
      }

      if (matchedReferralId) {
        // Route to referral details for both patients and specialists
        console.log('🔍 Routing to referral details with referral ID:', matchedReferralId);
        router.push(`/(specialist)/referral-details?id=${matchedReferralId}`);
      } else {
        // If no referral found and no appointment, show an alert
        Alert.alert(
          'Visit Details Unavailable',
          'This medical record does not have associated visit details. Please contact your healthcare provider for more information.',
          [{ text: 'OK' }]
        );
      }
    } catch (e) {
      console.error('Error handling medical history press:', e);
      Alert.alert(
        'Error',
        'Unable to load visit details. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleNewConsultation = () => {
    if (patientData) {
      router.push(`/patient-consultation?patientId=${patientData.id}`);
    }
  };

  const getPatientName = () => {
    return safeDataAccess.getUserFullName(patientData, 'Unknown Patient');
  };

  const getPatientAge = () => {
    if (patientData?.dateOfBirth) {
      const birthDate = new Date(patientData.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        return age - 1;
      }
      return age;
    }
    return null;
  };

  // Performance optimization: memoize filtered data
  const activeAppointments = performanceUtils.useDeepMemo(() => {
    return appointments.filter(apt => apt.status === 'confirmed');
  }, [appointments]);

  const activeConsultations = performanceUtils.useDeepMemo(() => {
    // Merge confirmed appointments and confirmed referrals; sort by date desc
    const items: any[] = [
      ...activeAppointments,
      ...confirmedReferrals,
    ];
    return items.sort((a, b) => new Date(b?.appointmentDate || 0).getTime() - new Date(a?.appointmentDate || 0).getTime());
  }, [activeAppointments, confirmedReferrals]);

  const completedAppointments = performanceUtils.useDeepMemo(() => {
    return appointments.filter(apt => apt.status === 'completed');
  }, [appointments]);

  const activePrescriptions = performanceUtils.useDeepMemo(() => {
    return prescriptions.filter(pres => {
      // First check if prescription is active
      if (pres.status !== 'active') return false;
      
      // Check if this prescription belongs to a hidden medical history entry
      // We need to check if the prescription's consultation ID matches a hidden medical history entry
      const prescriptionConsultationId = pres.consultationId || pres.appointmentConsultationId;
      if (prescriptionConsultationId) {
        const isFromHiddenHistory = medicalHistory.some(historyItem => 
          historyItem.id === prescriptionConsultationId && (historyItem as any)?.isHidden === true
        );
        if (isFromHiddenHistory) return false;
      }
      
      return true;
    });
  }, [prescriptions, medicalHistory]);

  const getActiveAppointments = () => activeAppointments;
  const getCompletedAppointments = () => completedAppointments;
  const getActivePrescriptions = () => activePrescriptions;

  const formatDate = (dateString: string) => {
    try {
      // Handle both ISO date strings and YYYY-MM-DD format
      let date: Date;
      
      if (dateString.includes('T')) {
        // ISO date string (e.g., "2024-01-15T10:30:00.000Z")
        date = new Date(dateString);
      } else {
        // YYYY-MM-DD format
        const [year, month, day] = dateString.split('-').map(Number);
        date = new Date(year, month - 1, day); // month is 0-indexed
      }
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const formatTime = (timeString: string) => {
    if (!timeString || typeof timeString !== 'string') {
      return 'Invalid time';
    }
    
    try {
      // Handle different time formats
      let timeToFormat = timeString.trim();
      
      // If it already contains AM/PM, format to show only hours and minutes
      if (timeToFormat.includes('AM') || timeToFormat.includes('PM')) {
        // Extract time and AM/PM parts
        const timeMatch = timeToFormat.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
        if (timeMatch) {
          const [, hours, minutes, ampm] = timeMatch;
          return `${hours}:${minutes} ${ampm.toUpperCase()}`;
        }
        return timeToFormat;
      }
      
      // If it's in HH:MM:SS format, convert to 12-hour format
      if (timeToFormat.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
        const [hours, minutes, seconds] = timeToFormat.split(':');
        const hour24 = parseInt(hours, 10);
        const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
        const ampm = hour24 >= 12 ? 'PM' : 'AM';
        return `${hour12}:${minutes} ${ampm}`;
      }
      
      // Try to parse as a date and format
      const date = new Date(`2000-01-01T${timeToFormat}`);
      if (isNaN(date.getTime())) {
        return 'Invalid time';
      }
      
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting time:', error, 'Input:', timeString);
      return 'Invalid time';
    }
  };

  const formatTypeLabel = (raw?: string): string => {
    if (!raw || typeof raw !== 'string') return 'Consultation';
    const normalized = raw.replace(/[_-]+/g, ' ').trim();
    return normalized
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E40AF" />
          <Text style={styles.loadingText}>Loading patient data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!patientData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Patient not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const patientAge = getPatientAge();
  const patientInitials = (() => {
    const full = safeDataAccess.getUserFullName(patientData, 'P');
    return full
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n: string) => n[0]?.toUpperCase())
      .join('') || 'P';
  })();
  const patientDOB = patientData?.dateOfBirth ? formatDate(patientData.dateOfBirth) : 'Not provided';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Patient Overview</Text>
        {/* <TouchableOpacity style={styles.newConsultationButton} onPress={handleNewConsultation}>
          <Plus size={20} color="#1E40AF" />
        </TouchableOpacity> */}
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Loading and Error States */}
        {loading ? (
          <LoadingState
            message="Loading patient data..."
            variant="inline"
            size="large"
          />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Patient Details</Text>
              <View style={styles.patientCard}>
                <View style={styles.patientHeader}>
                  <View style={styles.patientAvatar}>
                    <Text style={styles.patientInitial}>{patientInitials}</Text>
                  </View>
                  <View style={styles.patientInfo}>
                    <Text style={styles.patientName}>{getPatientName()}</Text>
                    {joinedDate && (
                      <Text style={styles.joinedDate}>Joined: {joinedDate}</Text>
                    )}
                  </View>
                </View>

                {/* Patient meta details (label/value layout) */}
                <View style={styles.detailsTable}>
                  <View style={styles.detailsRow}>
                    <Text style={styles.detailsLabel}>Date of Birth</Text>
                    <Text style={styles.detailsValue}>{resolvedDOB || patientData?.dateOfBirth || 'Not provided'}</Text>
                  </View>
                  <View style={styles.detailsRow}>
                    <Text style={styles.detailsLabel}>Age</Text>
                    <Text style={styles.detailsValue}>{resolvedAge != null ? `${resolvedAge} years` : 'Not provided'}</Text>
                  </View>
                  <View style={styles.detailsRow}>
                    <Text style={styles.detailsLabel}>Gender</Text>
                    <Text style={styles.detailsValue}>
                      {(() => {
                        const gender = patientData?.gender || safeDataAccess.getUserGender(patientData);
                        if (gender === 'Not specified' || !gender) return 'Not specified';
                        return gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
                      })()}
                    </Text>
                  </View>
                  <View style={styles.detailsRow}>
                    <Text style={styles.detailsLabel}>Contact Number</Text>
                    <Text style={styles.detailsValue}>{patientData?.phone || safeDataAccess.getUserPhone(patientData)}</Text>
                  </View>
                  <View style={styles.detailsRow}>
                    <Text style={styles.detailsLabel}>Blood Type</Text>
                    <Text style={styles.detailsValue}>{patientData?.bloodType || safeDataAccess.getBloodType(patientData)}</Text>
                  </View>
                  {patientData?.allergies && patientData.allergies.length > 0 && (
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsLabel}>Allergies</Text>
                      <Text style={styles.detailsValue}>
                        {patientData.allergies
                          .map(allergy => allergy.charAt(0).toUpperCase() + allergy.slice(1).toLowerCase())
                          .join(', ')}
                      </Text>
                    </View>
                  )}
                  <View style={styles.detailsRowNoBorder}>
                    <Text style={styles.detailsLabel}>Address</Text>
                    <Text style={styles.detailsValue}>{patientData?.address || safeDataAccess.getUserAddress(patientData)}</Text>
                  </View>
                </View>

                
                {patientData?.medicalConditions && patientData.medicalConditions.length > 0 && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.medicalConditions}>
                      <Text style={styles.medicalConditionsTitle}>Medical Conditions</Text>
                      {patientData.medicalConditions.map((condition, index) => (
                        <View key={index} style={styles.conditionItem}>
                          <AlertCircle size={14} color="#EF4444" />
                          <Text style={styles.conditionText}>
                            {condition.charAt(0).toUpperCase() + condition.slice(1).toLowerCase()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                        </View>
            </View>

            {/* Emergency Contact */}
            {patientData?.emergencyContact?.name && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Emergency Contact</Text>
                <View style={styles.emergencyCard}>
                  {patientData.emergencyContact.relationship ? (
                    <View style={styles.relationshipBadgeContainer}>
                      <Text style={styles.relationshipPill}>{capitalizeRelationship(patientData.emergencyContact.relationship) || 'Unknown'}</Text>
                    </View>
                  ) : null}
                  <View style={styles.emergencyLeft}>
                    <View style={styles.emergencyAvatar}>
                      <Text style={styles.emergencyInitial}>
                        {patientData.emergencyContact.name
                          .split(' ')
                          .map((n: string) => n[0])
                          .join('')
                          .toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.emergencyInfo}>
                      <Text style={styles.emergencyName}>{patientData.emergencyContact.name}</Text>
                      <Text style={styles.emergencyPhone}>{safeDataAccess.getEmergencyContactPhone(patientData)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.emergencyCallButton} onPress={handleEmergencyCall}>
                    <Phone size={18} color="#fff" />
                    <Text style={styles.emergencyCallText}>Call</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Visit Summary */}
            {patientData?.visitHistory && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Visit Summary</Text>
                <View style={styles.visitSummaryCard}>
                  <View style={styles.visitStats}>
                    <View style={styles.visitStat}>
                      <Text style={styles.visitStatValue}>{patientData.visitHistory.visitCount || 0}</Text>
                      <Text style={styles.visitStatLabel}>Total Visits</Text>
                    </View>
                    <View style={styles.visitStat}>
                      <Text style={styles.visitStatValue}>
                        {patientData.visitHistory.firstVisit ? formatDate(patientData.visitHistory.firstVisit) : 'N/A'}
                      </Text>
                      <Text style={styles.visitStatLabel}>First Visit</Text>
                    </View>
                    <View style={styles.visitStat}>
                      <Text style={styles.visitStatValue}>
                        {patientData.visitHistory.lastVisit ? formatDate(patientData.visitHistory.lastVisit) : 'N/A'}
                      </Text>
                      <Text style={styles.visitStatLabel}>Last Visit</Text>
                    </View>
                  </View>
                  {patientData.visitHistory.currentAdmission && (
                    <View style={styles.currentAdmission}>
                      <Text style={styles.currentAdmissionTitle}>Currently Admitted</Text>
                      <Text style={styles.currentAdmissionText}>
                        {patientData.visitHistory.currentAdmission.department} • {patientData.visitHistory.currentAdmission.attendingStaffName}
                      </Text>
                      <Text style={styles.currentAdmissionDate}>
                        Since {formatDate(patientData.visitHistory.currentAdmission.admissionDate)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Active Consultation */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Active Consultation</Text>
              {activeConsultations.length > 0 ? (
                <TouchableOpacity style={styles.consultationCard} onPress={handleActiveConsultationPress}>
                  <View style={styles.consultationHeader}>
                    <View style={styles.consultationIcon}>
                      <FileText size={20} color="#FFFFFF" />
                    </View>
                    <View style={styles.consultationInfo}>
                      <Text style={styles.consultationType}>
                        {activeConsultations[0]?.source === 'referral'
                          ? (activeConsultations[0]?.reason || 'Not specified')
                          : (activeConsultations[0]?.appointmentPurpose || formatTypeLabel(activeConsultations[0]?.type))}
                      </Text>
                      <Text style={styles.consultationDate}>
                        {activeConsultations[0]?.source === 'referral'
                          ? (() => {
                              const name = activeConsultations[0]?.specialistName;
                              const stripped = (name || '').replace(/^Dr\.?\s+/i, '').trim();
                              return `Dr. ${stripped || 'Unknown Doctor'}`;
                            })()
                          : (() => {
                              const doctor = safeDataAccess.getAppointmentDoctorName(activeConsultations[0] as any, 'Dr. Unknown Doctor');
                              return doctor;
                            })()}
                      </Text>
                      <Text style={styles.consultationDate}>
                        {activeConsultations[0]?.appointmentDate ? formatDate(activeConsultations[0].appointmentDate) : 'N/A'} at {activeConsultations[0]?.appointmentTime ? formatTime(activeConsultations[0].appointmentTime) : 'N/A'}
                      </Text>
                      {/* Status pill removed for active consultation preview */}
                    </View>
                    <ChevronRight size={20} color="#9CA3AF" />
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.noConsultationCard}>
                  <FileText size={32} color="#9CA3AF" />
                  <Text style={styles.noConsultationText}>No active consultation</Text>
                  {/* <Text style={styles.noConsultationSubtext}>
                    Start a new consultation to begin patient care
                  </Text>
                  <TouchableOpacity style={styles.startConsultationButton} onPress={handleNewConsultation}>
                    <Text style={styles.startConsultationButtonText}>Start Consultation</Text>
                  </TouchableOpacity> */}
                </View>
              )}
            </View>

            {/* Active Prescriptions */}
            {activePrescriptions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Active Prescriptions</Text>
                                 <View style={styles.prescriptionsContainer}>
                   {activePrescriptions.slice((prescriptionPage - 1) * itemsPerPage, prescriptionPage * itemsPerPage).map((prescription) => (
                    <View key={prescription.id} style={styles.prescriptionCard}>
                      <View style={styles.prescriptionHeader}>
                        <View style={styles.prescriptionIcon}>
                          <Pill size={16} color="#1E40AF" />
                        </View>
                        <View style={styles.prescriptionInfo}>
                          <Text style={styles.prescriptionMedication}>{prescription?.medication || 'Unknown Medication'}</Text>
                          <Text style={styles.prescriptionDosage}>
                            {prescription?.dosage || 'Dosage not specified'} • {prescription?.frequency || 'Frequency not specified'}
                            {prescription?.route && ` • ${formatRoute(prescription.route, 'patient')}`}
                          </Text>
                          <Text style={styles.prescriptionDate}>
                            Prescribed: {prescription?.prescribedDate ? formatDate(prescription.prescribedDate) : 'Date not specified'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                  
                  {/* Pagination controls above the View all button */}
                  {activePrescriptions.length > 3 && (
                    <View style={styles.paginationContainer}>
                      <View style={styles.paginationControls}>
                        <TouchableOpacity 
                          style={[styles.paginationButton, prescriptionPage === 1 && styles.paginationButtonDisabled]}
                          onPress={() => setPrescriptionPage(Math.max(1, prescriptionPage - 1))}
                          disabled={prescriptionPage === 1}
                        >
                          <ChevronLeft size={16} color={prescriptionPage === 1 ? "#9CA3AF" : "#1E40AF"} />
                        </TouchableOpacity>
                        
                        <Text style={styles.paginationText}>
                          {prescriptionPage} of {Math.ceil(activePrescriptions.length / itemsPerPage)}
                        </Text>
                        
                        <TouchableOpacity 
                          style={[styles.paginationButton, prescriptionPage === Math.ceil(activePrescriptions.length / itemsPerPage) && styles.paginationButtonDisabled]}
                          onPress={() => setPrescriptionPage(Math.min(Math.ceil(activePrescriptions.length / itemsPerPage), prescriptionPage + 1))}
                          disabled={prescriptionPage === Math.ceil(activePrescriptions.length / itemsPerPage)}
                        >
                          <ChevronRight size={16} color={prescriptionPage === Math.ceil(activePrescriptions.length / itemsPerPage) ? "#9CA3AF" : "#1E40AF"} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  
                  
                  
                </View>
              </View>
            )}

            {/* Medical History */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Medical History</Text>
              {medicalHistory.length > 0 ? (
                                 <View style={styles.historyContainer}>
                   {medicalHistory.slice((medicalHistoryPage - 1) * itemsPerPage, medicalHistoryPage * itemsPerPage).map((item: MedicalHistory) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.consultationCard}
                      onPress={() => handleMedicalHistoryPress(item)}
                    >
                      <View style={styles.consultationHeader}>
                        <View style={styles.consultationIcon}>
                          <FileText size={20} color="#FFFFFF" />
                        </View>
                        <View style={styles.consultationInfo}>
                          <Text style={styles.consultationType}>
                            {(item?.diagnosis && item.diagnosis.length > 0 && item.diagnosis[0]?.description)
                              || (item?.type || 'Consultation')}
                          </Text>
                          <Text style={styles.consultationDate}>
                            Dr. {safeDataAccess.getUserFullName(item?.provider, 'Unknown Doctor')}
                          </Text>
                          <Text style={styles.consultationDate}>
                            {formatDate(item.consultationDate)} at {formatTime(item.consultationTime)}
                          </Text>
                        </View>
                        <ChevronRight size={20} color="#9CA3AF" />
                      </View>
                    </TouchableOpacity>
                  ))}
                  
                  {/* Pagination controls above the View all button */}
                  {medicalHistory.length > 5 && (
                    <View style={styles.paginationContainer}>
                      <View style={styles.paginationControls}>
                        <TouchableOpacity 
                          style={[styles.paginationButton, medicalHistoryPage === 1 && styles.paginationButtonDisabled]}
                          onPress={() => setMedicalHistoryPage(Math.max(1, medicalHistoryPage - 1))}
                          disabled={medicalHistoryPage === 1}
                        >
                          <ChevronLeft size={16} color={medicalHistoryPage === 1 ? "#9CA3AF" : "#1E40AF"} />
                        </TouchableOpacity>
                        
                        {Array.from({ length: Math.ceil(medicalHistory.length / itemsPerPage) }, (_, i) => i + 1).map((pageNum) => (
                          <TouchableOpacity
                            key={pageNum}
                            style={[styles.paginationPageButton, medicalHistoryPage === pageNum && styles.paginationPageButtonActive]}
                            onPress={() => setMedicalHistoryPage(pageNum)}
                          >
                            <Text style={[styles.paginationPageText, medicalHistoryPage === pageNum && styles.paginationPageTextActive]}>
                              {pageNum}
                            </Text>
                          </TouchableOpacity>
                        ))}
                        
                        <TouchableOpacity 
                          style={[styles.paginationButton, medicalHistoryPage === Math.ceil(medicalHistory.length / itemsPerPage) && styles.paginationButtonDisabled]}
                          onPress={() => setMedicalHistoryPage(Math.min(Math.ceil(medicalHistory.length / itemsPerPage), medicalHistoryPage + 1))}
                          disabled={medicalHistoryPage === Math.ceil(medicalHistory.length / itemsPerPage)}
                        >
                          <ChevronRight size={16} color={medicalHistoryPage === Math.ceil(medicalHistory.length / itemsPerPage) ? "#9CA3AF" : "#1E40AF"} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  
                  
                  
                                     {/* Page info text */}
                   {medicalHistory.length > itemsPerPage && (
                     <View style={styles.pageInfoContainer}>
                       <Text style={styles.pageInfoText}>
                         Page {medicalHistoryPage} of {Math.ceil(medicalHistory.length / itemsPerPage)}
                       </Text>
                     </View>
                   )}
                </View>
              ) : (
                <View style={styles.noConsultationCard}>
                  <FileText size={32} color="#9CA3AF" />
                  <Text style={styles.noConsultationText}>No medical history</Text>
                  <Text style={styles.noConsultationSubtext}>
                    No previous visits or consultations recorded.
                  </Text>
                </View>
              )}
            </View>

        
          </> 
        )}
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    textAlign: 'center',
    flex: 1,
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 0,
  },
  newConsultationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 16,
  },
  patientCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  patientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 22,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  joinedDate: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  patientInitial: {
    color: '#FFFFFF',
    fontSize: 28,
    fontFamily: 'Inter-SemiBold',
  },
  detailsTable: {
    marginTop: 8,
    marginBottom: 8,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailsRowNoBorder: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  detailsLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
    flex: 1.1,
  },
  detailsValue: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter-Regular',
    flex: 2,
    textAlign: 'right',
    lineHeight: 19,
  },
  patientAge: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  patientId: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  contactInfo: {
    gap: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  medicalConditions: {
    gap: 8,
  },
  medicalConditionsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 8,
  },
  conditionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  conditionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  emergencyCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    paddingTop: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  relationshipBadgeContainer: {
    position: 'absolute',
    right: 16,
    top: 14,
  },
  emergencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emergencyAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emergencyInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  emergencyInfo: {
    flex: 1,
  },
  emergencyName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  relationshipPill: {
    backgroundColor: '#EFF6FF',
    color: '#1E40AF',
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  emergencyPhone: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  emergencyCallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E40AF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    gap: 7,
    marginTop: 20,
  },
  emergencyCallText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    marginLeft: 5,
  },
  visitSummaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  visitStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  visitStat: {
    alignItems: 'center',
    flex: 1,
  },
  visitStatValue: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  visitStatLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  currentAdmission: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  currentAdmissionTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  currentAdmissionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginBottom: 2,
  },
  currentAdmissionDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  consultationCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  consultationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  consultationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  consultationInfo: {
    flex: 1,
  },
  consultationType: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  consultationDate: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusConfirmed: {
    backgroundColor: '#D1FAE5',
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  noConsultationCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  noConsultationText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginTop: 12,
    marginBottom: 4,
  },
  noConsultationSubtext: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 16,
  },
  startConsultationButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  startConsultationButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  prescriptionsContainer: {
    gap: 12,
  },
  prescriptionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  prescriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prescriptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  prescriptionInfo: {
    flex: 1,
  },
  prescriptionMedication: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  prescriptionDosage: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  prescriptionDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  prescriptionStatus: {
    marginLeft: 8,
  },
  historyContainer: {
    gap: 12,
  },
  historyCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyInfo: {
    flex: 1,
  },
  historyType: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  historyDoctor: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginBottom: 2,
  },
  historyDiagnosis: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  appointmentsContainer: {
    gap: 12,
  },
  appointmentCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appointmentIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentType: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  appointmentDate: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  appointmentDoctor: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  appointmentStatus: {
    marginLeft: 8,
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  viewMoreText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: 18,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginTop: 16,
  },
  // Error state styles
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    margin: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Inter-Regular',
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Collapsible section styles
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  collapsibleHeaderText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
  },
  collapsibleContent: {
    gap: 12,
  },
  // Pagination styles
  paginationContainer: {
    alignItems: 'flex-end',
    paddingVertical: 8,
    marginTop: 4,
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paginationButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paginationButtonDisabled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  paginationText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
   // Page info styles
   pageInfoContainer: {
     alignItems: 'center',
     paddingVertical: 8,
     marginTop: 4,
   },
   pageInfoText: {
     fontSize: 13,
     fontFamily: 'Inter-Regular',
     color: '#6B7280',
   },
 });
 