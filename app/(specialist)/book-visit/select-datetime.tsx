import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import {
  ChevronLeft,
  ChevronDown,
  Stethoscope,
  Syringe,
  HeartPulse,
  Shield,
  User,
  PlusCircle,
  Clock,
  Calendar,
  Phone,
} from 'lucide-react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { databaseService } from '../../../src/services/database/firebase';
import { safeDataAccess } from '../../../src/utils/safeDataAccess';

// ---- Constants ----
const BLUE = '#1E40AF';
const LIGHT_BLUE = '#DBEAFE';

const SERVICE_ICONS = {
  'General Consultation': Stethoscope,
  'Health Checkup': HeartPulse,
  'Vaccination': Syringe,
  'Family Medicine': User,
  'Preventive Care': Shield,
  'Minor Procedures': PlusCircle,
};

const REFERRAL_PURPOSES = [
  'Advanced Treatment',
  'Second Opinion',
  'Surgical Consultation',
  'Emergency Referral',
  'Other',
];

// Configuration for referral purpose specific form inputs
const REFERRAL_PURPOSE_CONFIGS = {
  'Referral': {
    inputType: 'textarea',
    label: 'Additional Notes',
    placeholder: 'Please describe the reason for referring this patient...',
    required: true
  },
  'Follow-up Visit': {
    inputType: 'textarea',
    label: 'Follow-up Details',
    placeholder: 'Please describe the follow-up requirements...',
    required: true
  },
  'Second Opinion': {
    inputType: 'textarea',
    label: 'Additional Notes',
    placeholder: 'Please describe why a second opinion is needed...',
    required: true
  },
  'Advanced Treatment': {
    inputType: 'textarea',
    label: 'Additional Notes',
    placeholder: 'Please describe the advanced treatment needed...',
    required: true
  },
  'Diagnostic Testing': {
    inputType: 'multiselect',
    label: 'Required Tests',
    options: ['Blood Tests', 'Imaging (X-ray, CT, MRI)', 'Biopsy', 'Endoscopy', 'Cardiac Tests', 'Neurological Tests', 'Other'],
    placeholder: 'Select required diagnostic tests...',
    required: true
  },
  'Surgical Consultation': {
    inputType: 'textarea',
    label: 'Additional Notes',
    placeholder: 'Please describe the surgical consultation needed...',
    required: true
  },
  'Emergency Referral': {
    inputType: 'textarea',
    label: 'Additional Notes',
    placeholder: 'Please describe the emergency situation...',
    required: true
  },
  'Other': {
    inputType: 'textarea',
    label: 'Additional Notes',
    placeholder: 'Please describe the referral purpose...',
    required: true
  }
};

// Default config for appointment purposes not specified above
const DEFAULT_PURPOSE_CONFIG = {
  inputType: 'textarea',
  label: 'Additional Notes',
  placeholder: 'Add any additional information...',
  required: false
};

// ---- Helper functions ----

function getNextNDays(n: number) {
  const months = [
    'JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'
  ];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const out = [];
  let date = new Date();
  
  for (let i = 0; i < n; ++i) {
    // Use local date formatting to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    out.push({
      date: dateString,
      month: months[date.getMonth()],
      day: date.getDate().toString(),
      dayName: days[date.getDay()],
    });
    date.setDate(date.getDate() + 1);
  }
  return out;
}

function timeToMinutes(t: any) {
  let hour = t.hour % 12;
  if (t.ampm === 'PM' && hour !== 12) hour += 12;
  if (t.ampm === 'AM' && hour === 12) hour = 0;
  return hour * 60 + t.min;
}

function generateTimeSlots(start: any, end: any) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  const slots = [];
  for (let i = startMinutes; i < endMinutes; i += 30) {
    const hour = Math.floor(i / 60);
    const min = i % 60;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    slots.push({
      time: `${displayHour}:${min.toString().padStart(2, '0')} ${ampm}`,
      minutes: i,
    });
  }
  return slots;
}

// Convert 24-hour format to 12-hour format
function convertTo12HourFormat(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

// Format structured purpose form data into readable text for additionalNotes
function formatPurposeDataToText(purpose: string, formData: { primaryValue: string | string[]; secondaryValue?: string; }, generalNotes: string): string {
  const config = REFERRAL_PURPOSE_CONFIGS[purpose];
  
  // If purpose has specific config, use structured formatting
  if (config) {
    let formattedText = '';
    
    // Handle different input types
    switch (config.inputType) {
      case 'multiselect':
        if (Array.isArray(formData.primaryValue) && formData.primaryValue.length > 0) {
          formattedText = `${config.label}: ${formData.primaryValue.join(', ')}`;
        }
        break;
        
      case 'dropdown_with_text':
        if (formData.primaryValue && typeof formData.primaryValue === 'string') {
          formattedText = `${config.label}: ${formData.primaryValue}`;
          if (formData.secondaryValue) {
            formattedText += `\n${config.secondaryLabel}: ${formData.secondaryValue}`;
          }
        }
        break;
        
      case 'dropdown':
        if (formData.primaryValue && typeof formData.primaryValue === 'string') {
          formattedText = `${config.label}: ${formData.primaryValue}`;
        }
        break;
        
      case 'textarea':
        if (formData.primaryValue && typeof formData.primaryValue === 'string') {
          // Don't add label prefix for "Additional Notes" to avoid duplication
          if (config.label === 'Additional Notes') {
            formattedText = formData.primaryValue;
          } else {
            formattedText = `${config.label}: ${formData.primaryValue}`;
          }
        }
        break;
    }
    
    return formattedText;
  } else {
    // For purposes without specific config (Follow-up, Health Checkup, etc.), use general notes
    return generalNotes.trim();
  }
}

function getPagerData(items: any[], numPages: number) {
  const pages = [];
  for (let i = 0; i < items.length; i += numPages) {
    pages.push(items.slice(i, i + numPages));
  }
  return { pages, pageSize: numPages };
}

interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  specialty: string;
  contactNumber: string;
  clinicAffiliations: string[];
  professionalFee?: number;
  isSpecialist?: boolean;
  middleName?: string;
  phoneNumber?: string;
  phone?: string;
  specialization?: string;
  clinicName?: string;
  clinicAddress?: string;
  availability: {
    lastUpdated: string;
    weeklySchedule: {
      monday?: { enabled: boolean; timeSlots?: Array<{ startTime: string; endTime: string }> };
      tuesday?: { enabled: boolean; timeSlots?: Array<{ startTime: string; endTime: string }> };
      wednesday?: { enabled: boolean; timeSlots?: Array<{ startTime: string; endTime: string }> };
      thursday?: { enabled: boolean; timeSlots?: Array<{ startTime: string; endTime: string }> };
      friday?: { enabled: boolean; timeSlots?: Array<{ startTime: string; endTime: string }> };
      saturday?: { enabled: boolean; timeSlots?: Array<{ startTime: string; endTime: string }> };
      sunday?: { enabled: boolean; timeSlots?: Array<{ startTime: string; endTime: string }> };
    };
    specificDates?: {
      [date: string]: {
        timeSlots: Array<{ startTime: string; endTime: string }>;
      };
    };
  };
}

export default function SelectDateTimeScreen() {
  const params = useLocalSearchParams<{ 
    doctorId: string; 
    clinicId: string; 
    clinicName: string; 
    doctorName: string; 
    doctorSpecialty: string;
    patientId: string;
    patientFirstName: string;
    patientLastName: string;
    originalAppointmentId?: string;
    isReferral?: string;
    reasonForReferral?: string;
  }>();
  
  const { 
    doctorId, 
    clinicId, 
    clinicName, 
    doctorName, 
    doctorSpecialty,
    patientId,
    patientFirstName,
    patientLastName,
    originalAppointmentId,
    isReferral,
    reasonForReferral,
  } = params;
  
  // Debug: Log all received parameters
  console.log('🔍 Specialist select-datetime parameters:', {
    originalAppointmentId,
    isReferral,
    patientId,
    patientFirstName,
    patientLastName,
    reasonForReferral,
    doctorId,
    doctorName,
    clinicId,
    clinicName
  });
  
  // State
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedPurpose, setSelectedPurpose] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  
  // State for original referring generalist (for follow-ups)
  const [originalReferringGeneralist, setOriginalReferringGeneralist] = useState<{
    firstName: string;
    lastName: string;
    id: string;
  } | null>(null);
  
  // Dynamic form state for appointment purpose specific inputs
  const [purposeFormData, setPurposeFormData] = useState<{
    primaryValue: string | string[];
    secondaryValue?: string;
  }>({
    primaryValue: '',
    secondaryValue: ''
  });
  const [showPurposeDropdown, setShowPurposeDropdown] = useState(false);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<Array<{time: string; minutes: number}>>([]);
  const [bookedTimeSlots, setBookedTimeSlots] = useState<string[]>([]);
  const [specialistAvailableDays, setSpecialistAvailableDays] = useState<number[]>([]);
  const [specialistDaysLoaded, setSpecialistDaysLoaded] = useState(false);
  const [generalistAvailableDays, setGeneralistAvailableDays] = useState<number[]>([]);
  const [generalistDaysLoaded, setGeneralistDaysLoaded] = useState(false);
  
  // Refs
  const dateScrollRef = useRef<ScrollView>(null);
  const timeScrollRef = useRef<ScrollView>(null);

  // Computed values - use doctor data if available, otherwise use URL params
  const displayDoctorName = doctor ? `${doctor.firstName} ${doctor.lastName}` : doctorName || '';
  const displayDoctorSpecialty = doctor?.specialty || doctorSpecialty || '';
  const displayClinicName = doctor?.clinicName || clinicName || 'Clinic Name';
  const displayClinicAddress = doctor?.clinicAddress || '';

  // Generate the next 30 days as selectable dates
  const AVAILABLE_DATES = useMemo(() => {
    const months = [
      'JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'
    ];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dates = [];
    
    let currentDate = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() + i);
      
      // Use local date formatting to avoid timezone issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      dates.push({
        date: dateString,
        month: months[date.getMonth()],
        day: date.getDate().toString(),
        dayName: days[date.getDay()],
        dayOfWeek: date.getDay(), // Add dayOfWeek for filtering
      });
    }
    
    return dates;
  }, []);

  // Filter dates based on doctor availability
  const FILTERED_DATES = useMemo(() => {
    console.log('🔍 FILTERED_DATES calculation:', {
      isSpecialist: doctor?.isSpecialist,
      specialistAvailableDays,
      specialistDaysLoaded,
      availableDaysLength: specialistAvailableDays.length,
      doctorId: doctor?.id
    });
    
    // If we're still loading, show all dates for now
    if (loading) {
      console.log('🔍 Still loading, using all dates for now');
      return AVAILABLE_DATES;
    }
    
    // For specialists, use specialist availability filtering
    if (doctor?.isSpecialist) {
      if (!specialistDaysLoaded || specialistAvailableDays.length === 0) {
        console.log('🔍 Specialist days not loaded yet or empty, using all dates for now');
        return AVAILABLE_DATES;
      }
      
      // Filter dates to only show available days
      const filtered = AVAILABLE_DATES.filter(date => 
        specialistAvailableDays.includes(date.dayOfWeek)
      );
      console.log('🔍 Filtered dates for specialist:', filtered.length, 'out of', AVAILABLE_DATES.length);
      console.log('🔍 Available days:', specialistAvailableDays);
      return filtered;
    }
    
    // For generalists, show all dates
    return AVAILABLE_DATES;
  }, [AVAILABLE_DATES, doctor?.isSpecialist, specialistAvailableDays, specialistDaysLoaded, loading]);

  const datePager = useMemo(() => getPagerData(FILTERED_DATES, 7), [FILTERED_DATES]);
    // Use available time slots directly (they already include all standard slots)
  const allTimeSlots = useMemo(() => {
    console.log('🔍 allTimeSlots calculation:', {
      availableTimeSlots,
      bookedTimeSlots
    });
    
    // availableTimeSlots already contains all standard time slots
    return availableTimeSlots;
  }, [availableTimeSlots, bookedTimeSlots]);

  const timePager = useMemo(() => getPagerData(allTimeSlots, 4), [allTimeSlots]);

  const loadDoctorData = async () => {
    if (!doctorId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // First try to get doctor data from doctors node (for regular appointments)
      let doctorData = await databaseService.getDoctorById(doctorId);
      
      // If not found in doctors node, try to get from users node (for follow-up appointments)
      if (!doctorData) {
        console.log('🔍 Doctor not found in doctors node, trying users node for:', doctorId);
        
        // Fetch from both users and doctors nodes in parallel
        const [userData, doctorDataFromDoctors] = await Promise.all([
          databaseService.getDocument(`users/${doctorId}`),
          databaseService.getDocument(`doctors/${doctorId}`)
        ]);
        
        if (userData) {
          console.log('🔍 Found user data, creating doctor object from users node');
          
          // Create a doctor object from user data
          doctorData = {
            id: doctorId,
            firstName: userData.firstName || userData.first_name || '',
            lastName: userData.lastName || userData.last_name || '',
            middleName: userData.middleName || userData.middle_name || '',
            fullName: `${userData.firstName || userData.first_name || ''} ${userData.middleName || userData.middle_name || ''} ${userData.lastName || userData.last_name || ''}`.trim(),
            specialty: doctorDataFromDoctors?.specialty || doctorDataFromDoctors?.specialization || 'General Medicine',
            contactNumber: doctorDataFromDoctors?.contactNumber || doctorDataFromDoctors?.phone || doctorDataFromDoctors?.phoneNumber || '',
            clinicAffiliations: doctorDataFromDoctors?.clinicAffiliations || [],
            isSpecialist: doctorDataFromDoctors?.isSpecialist || userData.role === 'specialist',
            availability: doctorDataFromDoctors?.availability || {
              lastUpdated: new Date().toISOString(),
              weeklySchedule: {},
              specificDates: {}
            }
          };
        }
      }
      
      if (!doctorData) {
        setError('Doctor not found');
        return;
      }
      
      setDoctor(doctorData);
      
      // Load available days for date filtering
      if (doctorData.isSpecialist) {
        await loadSpecialistAvailableDays(doctorId);
      } else {
        await loadGeneralistAvailableDays(doctorData);
      }
    } catch (error) {
      console.error('Error loading doctor data:', error);
      setError('Failed to load doctor data');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableTimeSlots = async () => {
    if (!doctor || !selectedDate) {
      console.log('🔍 loadAvailableTimeSlots: Missing doctor or selectedDate', { doctor, selectedDate });
      return;
    }
    
    console.log('🔍 loadAvailableTimeSlots: Starting with', { doctorId: doctor.id, selectedDate, isSpecialist: doctor.isSpecialist });
    
    try {
      // Check if this is a specialist (use specialistSchedules + referrals)
      if (doctor.isSpecialist) {
        console.log('🔍 This is a specialist, loading specialist schedules and checking referrals for booked slots');
        await loadSpecialistTimeSlots();
        return;
      }
      
      // For generalists (use doctors.availability + appointments)
      console.log('🔍 This is a generalist, loading doctor availability and checking appointments for booked slots');
      await loadGeneralistTimeSlots();
      
    } catch (error) {
      console.error('❌ Error loading time slots:', error);
      setAvailableTimeSlots([]);
      setBookedTimeSlots([]);
    }
  };

  const loadSpecialistAvailableDays = async (specialistId?: string) => {
    const idToUse = specialistId || doctor?.id;
    if (!idToUse) return;
    
    setSpecialistDaysLoaded(false);
    
    try {
      console.log('🔍 Loading specialist available days for:', idToUse);
      
      // Get specialist schedules
      const specialistSchedules = await databaseService.getSpecialistSchedules(idToUse);
      if (!specialistSchedules) {
        console.log('🔍 No specialist schedules found');
        return;
      }

      console.log('🔍 Raw specialist schedules:', specialistSchedules);

      // Find all active schedules and collect their available days
      const allAvailableDays = new Set<number>();
      const today = new Date();
      
      // The structure is specialistSchedules[scheduleId] = { specialistId, recurrence, ... }
      Object.values(specialistSchedules).forEach((schedule: any) => {
        console.log('🔍 Processing schedule:', schedule);
        // Check if this schedule belongs to the specialist we're looking for
        if (schedule.specialistId === idToUse && schedule.isActive && new Date(schedule.validFrom) <= today) {
          if (schedule.recurrence && schedule.recurrence.dayOfWeek) {
            console.log('🔍 Found valid schedule with days:', schedule.recurrence.dayOfWeek);
            schedule.recurrence.dayOfWeek.forEach((day: number) => {
              allAvailableDays.add(day);
            });
          }
        }
      });

      const availableDaysArray = Array.from(allAvailableDays).sort();
      setSpecialistAvailableDays(availableDaysArray);
      setSpecialistDaysLoaded(true);
      console.log('🔍 Specialist available days loaded:', availableDaysArray);

    } catch (error) {
      console.error('❌ Error loading specialist available days:', error);
    }
  };

  const loadGeneralistAvailableDays = async (doctorData: any) => {
    if (!doctorData) return;
    
    setGeneralistDaysLoaded(false);
    
    try {
      console.log('🔍 Loading generalist available days for:', doctorData.id);
      
      // Check if doctor has availability data
      if (!doctorData.availability?.weeklySchedule) {
        console.log('🔍 No generalist availability found for doctor:', doctorData.id);
        setGeneralistAvailableDays([]);
        setGeneralistDaysLoaded(true);
        return;
      }

      console.log('🔍 Raw generalist availability:', doctorData.availability.weeklySchedule);

      // Find all days where enabled is true and timeSlots exist
      const allAvailableDays = new Set<number>();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      dayNames.forEach((dayName, index) => {
        const daySchedule = doctorData.availability.weeklySchedule[dayName as keyof typeof doctorData.availability.weeklySchedule];
        console.log('🔍 Processing day:', dayName, 'index:', index, daySchedule);
        
        // Check if day is enabled and has timeSlots with startTime and endTime
        if (daySchedule?.enabled && daySchedule.timeSlots && daySchedule.timeSlots.length > 0) {
          // Verify that timeSlots have valid startTime and endTime
          const hasValidTimeSlots = daySchedule.timeSlots.some(slot => 
            slot.startTime && slot.endTime && 
            slot.startTime.trim() !== '' && slot.endTime.trim() !== ''
          );
          
          if (hasValidTimeSlots) {
            console.log('🔍 Found valid generalist schedule for', dayName, 'index:', index, ':', daySchedule.timeSlots);
            allAvailableDays.add(index);
          } else {
            console.log('🔍 Day', dayName, 'enabled but no valid time slots');
          }
        } else {
          console.log('🔍 Day', dayName, 'not available - enabled:', daySchedule?.enabled, 'timeSlots:', daySchedule?.timeSlots?.length || 0);
        }
      });

      const availableDaysArray = Array.from(allAvailableDays).sort();
      setGeneralistAvailableDays(availableDaysArray);
      setGeneralistDaysLoaded(true);
      console.log('🔍 Generalist available days loaded:', availableDaysArray);

    } catch (error) {
      console.error('❌ Error loading generalist available days:', error);
    }
  };

  const loadSpecialistTimeSlots = async () => {
    try {
      console.log('🔍 Loading specialist schedules for:', doctor?.id);
      
      // Get specialist schedules
      const specialistSchedules = await databaseService.getSpecialistSchedules(doctor!.id);
      if (!specialistSchedules) {
        setError('Specialist schedule functionality is not available yet. Please contact support.');
        setAvailableTimeSlots([]);
        setBookedTimeSlots([]);
        return;
      }

      // Get specialist referrals to check for booked slots
      const specialistReferrals = await databaseService.getSpecialistReferrals(doctor!.id);
      console.log('🔍 Specialist referrals:', specialistReferrals);

      // Find active schedule for the selected date
      // Parse date string as local date to avoid timezone issues
      const [year, month, day] = selectedDate.split('-').map(Number);
      const selectedDateObj = new Date(year, month - 1, day); // month is 0-indexed
      const dayOfWeek = selectedDateObj.getDay();
      
      console.log('🔍 DEBUG - Selected date:', selectedDate);
      console.log('🔍 DEBUG - Selected date object:', selectedDateObj);
      console.log('🔍 DEBUG - Day of week:', dayOfWeek);
      console.log('🔍 DEBUG - All specialist schedules:', specialistSchedules);
      
      // The structure is specialistSchedules[scheduleId] = { specialistId, recurrence, ... }
      let activeSchedule = null;
      
      activeSchedule = Object.values(specialistSchedules).find((schedule: any) => {
        console.log('🔍 DEBUG - Checking schedule:', {
          scheduleId: Object.keys(specialistSchedules).find(key => specialistSchedules[key] === schedule),
          specialistId: schedule.specialistId,
          doctorId: doctor!.id,
          isActive: schedule.isActive,
          validFrom: schedule.validFrom,
          validFromDate: new Date(schedule.validFrom),
          selectedDateObj: selectedDateObj,
          validFromCheck: new Date(schedule.validFrom) > selectedDateObj,
          recurrence: schedule.recurrence,
          dayOfWeek: dayOfWeek,
          includesCheck: schedule.recurrence.dayOfWeek.includes(dayOfWeek)
        });
        
        if (schedule.specialistId !== doctor!.id || !schedule.isActive || new Date(schedule.validFrom) > selectedDateObj) return false;
        return schedule.recurrence.dayOfWeek.includes(dayOfWeek);
      });

      if (!activeSchedule) {
        setError('No available schedule for this date. Please select a different date.');
        setAvailableTimeSlots([]);
        setBookedTimeSlots([]);
        return;
      }

      console.log('🔍 Found active schedule:', activeSchedule);

      // Generate time slots from specialist's slotTemplate
      const schedule = activeSchedule as any; // Type assertion for schedule object
      const specialistTimeSlots = Object.keys(schedule.slotTemplate || {}).map(time => ({
        time,
        minutes: schedule.slotTemplate[time]?.durationMinutes || 0
      }));

      // Check for booked slots from referrals
      const bookedSlotsFromReferrals = specialistReferrals
        .filter((referral: any) => 
          referral.assignedSpecialistId === doctor!.id &&
          referral.appointmentDate === selectedDate &&
          (referral.status === 'pending' || referral.status === 'confirmed' || referral.status === 'completed')
        )
        .map((referral: any) => referral.appointmentTime);

      // Also check for booked slots from appointments (follow-up appointments, etc.)
      const specialistAppointments = await databaseService.getAppointments(doctor!.id, 'specialist');
      const bookedSlotsFromAppointments = specialistAppointments
        .filter((appointment: any) => 
          appointment.doctorId === doctor!.id &&
          appointment.appointmentDate === selectedDate &&
          appointment.status !== 'cancelled' // Block if status is NOT cancelled
        )
        .map((appointment: any) => appointment.appointmentTime);

      // Combine both sources of booked slots
      const allBookedSlots = [...new Set([...bookedSlotsFromReferrals, ...bookedSlotsFromAppointments])];

      console.log('🔍 Specialist time slots:', specialistTimeSlots);
      console.log('🔍 Booked slots from referrals:', bookedSlotsFromReferrals);
      console.log('🔍 Booked slots from appointments:', bookedSlotsFromAppointments);
      console.log('🔍 All booked slots:', allBookedSlots);

      setAvailableTimeSlots(specialistTimeSlots);
      setBookedTimeSlots(allBookedSlots);

    } catch (error) {
      console.error('❌ Error loading specialist time slots:', error);
      setError('Specialist schedule functionality is not available yet. Please contact support.');
      setAvailableTimeSlots([]);
      setBookedTimeSlots([]);
    }
  };

  const loadGeneralistTimeSlots = async () => {
    try {
      console.log('🔍 Loading generalist time slots for doctor:', doctor!.id);
      
      // Get booked time slots for this doctor on this date (from appointments)
      const bookedSlots = await databaseService.getBookedTimeSlots(doctor!.id, selectedDate);
      console.log('🔍 Booked slots found:', bookedSlots);
      
      // Use doctor's availability from doctors node if available, otherwise use standard slots
      let availableTimeSlots = [];
      
      if (doctor?.availability?.weeklySchedule) {
        console.log('🔍 Using doctor availability from doctors node');
        // Get the day of week for the selected date
        // Parse date string as local date to avoid timezone issues
        const [year, month, day] = selectedDate.split('-').map(Number);
        const selectedDateObj = new Date(year, month - 1, day); // month is 0-indexed
        const dayOfWeek = selectedDateObj.getDay();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek];
        
        const daySchedule = doctor.availability.weeklySchedule[dayName];
        if (daySchedule?.enabled && daySchedule.timeSlots) {
          // Generate 20-minute intervals between startTime and endTime
          availableTimeSlots = [];
          daySchedule.timeSlots.forEach(slot => {
            const intervals = generateTimeIntervals(slot.startTime, slot.endTime, 20);
            availableTimeSlots.push(...intervals);
          });
          console.log('🔍 Using doctor schedule for', dayName, ':', availableTimeSlots);
        } else {
          console.log('🔍 Doctor not available on', dayName, ', using standard slots');
          availableTimeSlots = generateStandardTimeSlots();
        }
      } else {
        console.log('🔍 No doctor availability found, using standard slots');
        availableTimeSlots = generateStandardTimeSlots();
      }
      
      setAvailableTimeSlots(availableTimeSlots);
      setBookedTimeSlots(bookedSlots);
      
      console.log('🔍 Final time slots - Available:', availableTimeSlots.length, 'Booked:', bookedSlots.length);
      
    } catch (error) {
      console.error('❌ Error loading generalist time slots:', error);
      setAvailableTimeSlots([]);
      setBookedTimeSlots([]);
    }
  };

  const generateTimeIntervals = (startTime: string, endTime: string, intervalMinutes: number) => {
    const intervals = [];
    
    // Parse start and end times (format: "HH:MM")
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    // Generate intervals
    for (let minutes = startMinutes; minutes < endMinutes; minutes += intervalMinutes) {
      const hour = Math.floor(minutes / 60);
      const min = minutes % 60;
      const time24 = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const time12 = convertTo12HourFormat(time24);
      
      intervals.push({
        time: time12,
        minutes: 0
      });
    }
    
    return intervals;
  };

  const generateStandardTimeSlots = () => {
    // Generate standard time slots (9 AM to 5 PM, every 20 minutes)
    return [
      { time: '9:00 AM', minutes: 0 },
      { time: '9:20 AM', minutes: 0 },
      { time: '9:40 AM', minutes: 0 },
      { time: '10:00 AM', minutes: 0 },
      { time: '10:20 AM', minutes: 0 },
      { time: '10:40 AM', minutes: 0 },
      { time: '11:00 AM', minutes: 0 },
      { time: '11:20 AM', minutes: 0 },
      { time: '11:40 AM', minutes: 0 },
      { time: '12:00 PM', minutes: 0 },
      { time: '12:20 PM', minutes: 0 },
      { time: '12:40 PM', minutes: 0 },
      { time: '1:00 PM', minutes: 0 },
      { time: '1:20 PM', minutes: 0 },
      { time: '1:40 PM', minutes: 0 },
      { time: '2:00 PM', minutes: 0 },
      { time: '2:20 PM', minutes: 0 },
      { time: '2:40 PM', minutes: 0 },
      { time: '3:00 PM', minutes: 0 },
      { time: '3:20 PM', minutes: 0 },
      { time: '3:40 PM', minutes: 0 },
      { time: '4:00 PM', minutes: 0 },
      { time: '4:20 PM', minutes: 0 },
      { time: '4:40 PM', minutes: 0 },
      { time: '5:00 PM', minutes: 0 },
    ];
  };

  useEffect(() => {
    console.log('🔍 useEffect triggered:', { 
      doctorId, 
      patientId,
      patientFirstName,
      patientLastName
    });
    
    console.log('🔍 Loading doctor data...');
    loadDoctorData();
  }, [doctorId]);

  useEffect(() => {
    if (selectedDate) {
      loadAvailableTimeSlots();
    }
  }, [selectedDate, doctorId]);

  // Monitor bookedTimeSlots state changes
  useEffect(() => {
    console.log('🔍 bookedTimeSlots state changed:', bookedTimeSlots);
  }, [bookedTimeSlots]);

  // Initialize referral mode
  useEffect(() => {
    if (reasonForReferral) {
      setSelectedPurpose('Advanced Treatment');
      setPurposeFormData({
        primaryValue: reasonForReferral,
        secondaryValue: ''
      });
    }
  }, [reasonForReferral]);

  // Reset purpose form data when purpose changes
  useEffect(() => {
    if (selectedPurpose) {
      const config = REFERRAL_PURPOSE_CONFIGS[selectedPurpose];
      if (config) {
        setPurposeFormData({
          primaryValue: config.inputType === 'multiselect' ? [] : '',
          secondaryValue: ''
        });
      }
    }
  }, [selectedPurpose]);

  // Refresh time slots when screen comes into focus (in case someone else booked a slot)
  useFocusEffect(
    React.useCallback(() => {
      if (selectedDate && doctorId) {
        loadAvailableTimeSlots();
      }
    }, [selectedDate, doctorId])
  );

  // onScroll event to update active page
  const handleDateScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const w = datePager.pageSize * 64; // Card+margin width
    // This logic needs to be updated to reflect the new datePager structure
    // For now, it will always be 0 as datePager.pageSize is not defined here
    // setDatePage(Math.round(x / w)); 
  };
  
  const handleTimeScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const w = timePager.pageSize * 70;
    // This logic needs to be updated to reflect the new timePager structure
    // For now, it will always be 0 as timePager.pageSize is not defined here
    // setTimePage(Math.round(x / w)); 
  };

  // Render purpose-specific form components
  const renderPurposeSpecificForm = () => {
    if (!selectedPurpose) return null;
    
    const config = REFERRAL_PURPOSE_CONFIGS[selectedPurpose];
    if (!config) return null;

    switch (config.inputType) {
      case 'textarea':
        return (
          <>
            <Text style={styles.sectionTitle}>{config.label}</Text>
            <TextInput
              style={[styles.notesInput, { minHeight: 88 }]}
              placeholder={config.placeholder}
              value={typeof purposeFormData.primaryValue === 'string' ? purposeFormData.primaryValue : ''}
              onChangeText={(text) => setPurposeFormData(prev => ({ ...prev, primaryValue: text }))}
              multiline
              numberOfLines={4}
              placeholderTextColor="#9CA3AF"
            />
          </>
        );

      case 'dropdown':
        return (
          <>
            <Text style={styles.sectionTitle}>{config.label}</Text>
            <TouchableOpacity
              style={styles.purposeDropdown}
              onPress={() => setShowPurposeDropdown(!showPurposeDropdown)}
            >
              <Text style={[
                styles.purposeDropdownText,
                !purposeFormData.primaryValue && styles.purposePlaceholder
              ]}>
                {purposeFormData.primaryValue || config.placeholder || `Select ${config.label.toLowerCase()}`}
              </Text>
              <ChevronDown size={20} color="#6B7280" />
            </TouchableOpacity>
            
            {showPurposeDropdown && (
              <View style={styles.purposeDropdownMenu}>
                <ScrollView style={styles.purposeDropdownScrollView}>
                  {config.options?.map((option, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.purposeDropdownItem}
                      onPress={() => {
                        setPurposeFormData(prev => ({ ...prev, primaryValue: option }));
                        setShowPurposeDropdown(false);
                      }}
                    >
                      <Text style={styles.purposeDropdownItemText}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        );

      case 'multiselect':
        return (
          <>
            <Text style={styles.sectionTitle}>{config.label}</Text>
            <View style={styles.multiselectContainer}>
              {config.options?.map((option, index) => {
                const isSelected = Array.isArray(purposeFormData.primaryValue) && 
                                 purposeFormData.primaryValue.includes(option);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.multiselectOption,
                      isSelected && styles.multiselectOptionSelected
                    ]}
                    onPress={() => {
                      const currentValues = Array.isArray(purposeFormData.primaryValue) 
                        ? purposeFormData.primaryValue 
                        : [];
                      
                      let newValues;
                      if (isSelected) {
                        newValues = currentValues.filter(v => v !== option);
                      } else {
                        newValues = [...currentValues, option];
                      }
                      
                      setPurposeFormData(prev => ({ ...prev, primaryValue: newValues }));
                    }}
                  >
                    <Text style={[
                      styles.multiselectOptionText,
                      isSelected && styles.multiselectOptionTextSelected
                    ]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        );

      case 'dropdown_with_text':
        return (
          <>
            <Text style={styles.sectionTitle}>{config.label}</Text>
            <TouchableOpacity
              style={styles.purposeDropdown}
              onPress={() => setShowPurposeDropdown(!showPurposeDropdown)}
            >
              <Text style={[
                styles.purposeDropdownText,
                !purposeFormData.primaryValue && styles.purposePlaceholder
              ]}>
                {purposeFormData.primaryValue || `Select ${config.label.toLowerCase()}`}
              </Text>
              <ChevronDown size={20} color="#6B7280" />
            </TouchableOpacity>
            
            {showPurposeDropdown && (
              <View style={styles.purposeDropdownMenu}>
                <ScrollView style={styles.purposeDropdownScrollView}>
                  {config.options?.map((option, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.purposeDropdownItem}
                      onPress={() => {
                        setPurposeFormData(prev => ({ ...prev, primaryValue: option }));
                        setShowPurposeDropdown(false);
                      }}
                    >
                      <Text style={styles.purposeDropdownItemText}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            
            {purposeFormData.primaryValue && config.secondaryLabel && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.sectionTitle}>{config.secondaryLabel}</Text>
                <TextInput
                  style={[styles.notesInput, { minHeight: 88 }]}
                  placeholder={config.secondaryPlaceholder}
                  value={purposeFormData.secondaryValue || ''}
                  onChangeText={(text) => setPurposeFormData(prev => ({ ...prev, secondaryValue: text }))}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            )}
          </>
        );

      default:
        return null;
    }
  };

  // Check if purpose-specific form is valid
  const isPurposeFormValid = () => {
    if (!selectedPurpose) return false;
    
    const config = REFERRAL_PURPOSE_CONFIGS[selectedPurpose];
    
    // If purpose has specific config, validate structured form
    if (config) {
      if (!config.required) return true;
      
      // Check if primary value is filled
      if (config.inputType === 'multiselect') {
        return Array.isArray(purposeFormData.primaryValue) && purposeFormData.primaryValue.length > 0;
      } else {
        return purposeFormData.primaryValue && String(purposeFormData.primaryValue).trim().length > 0;
      }
    } else {
      // For purposes without specific config, no validation needed (notes are optional)
      return true;
    }
  };

  const handleContinue = () => {
    if (selectedDate && selectedTime && selectedPurpose && isPurposeFormValid()) {
      // Format the structured purpose data into text for additionalNotes
      const formattedNotes = formatPurposeDataToText(selectedPurpose, purposeFormData, notes);
      
      // Debug: Log all parameters before navigation
      console.log('Navigation parameters:', {
        clinicId,
        clinicName,
        doctorId,
        doctorName,
        doctorSpecialty,
        patientId,
        patientFirstName,
        patientLastName,
        selectedDate,
        selectedTime,
        selectedPurpose,
        notes,
        formattedNotes,
        purposeFormData,
        doctor: doctor,
        displayClinicName,
        displayClinicAddress
      });
      
      // Use fetched doctor data if available, otherwise fall back to URL params
      const finalClinicName = displayClinicName || clinicName || '';
      const finalClinicAddress = displayClinicAddress || '';
      const finalDoctorName = displayDoctorName || doctorName || '';
      const finalDoctorSpecialty = displayDoctorSpecialty || doctorSpecialty || '';
      
      // More robust parameter validation - ensure all values are strings and not undefined
      const params = {
        clinicId: String(clinicId || ''),
        clinicName: String(finalClinicName),
        clinicAddress: String(finalClinicAddress), // Add clinic address to params
        doctorId: String(doctorId || ''),
        doctorName: String(finalDoctorName),
        doctorSpecialty: String(finalDoctorSpecialty),
        patientId: String(patientId || ''),
        patientFirstName: String(patientFirstName || ''),
        patientLastName: String(patientLastName || ''),
        originalAppointmentId: String(originalAppointmentId || ''), // Pass originalAppointmentId
        isReferral: String(isReferral || 'true'), // Pass isReferral flag
        selectedDate: String(selectedDate),
        selectedTime: String(selectedTime),
        selectedPurpose: String(selectedPurpose),
        notes: String(formattedNotes || ''), // Use formatted notes instead of raw notes
        reasonForReferral: String(formattedNotes || ''), // Use formatted notes for referral reason
      };
      
      console.log('Sanitized parameters with fetched data:', params);
      
      // Additional validation to ensure no undefined values
      const hasUndefinedValues = Object.values(params).some(value => value === 'undefined' || value === undefined);
      if (hasUndefinedValues) {
        console.error('Found undefined values in params:', params);
        Alert.alert('Error', 'Some required information is missing. Please try again.');
        return;
      }
      
      router.push({
        pathname: '/book-visit/review-confirm',
        params,
      });
    } else {
      let missingInfo = [];
      if (!selectedDate) missingInfo.push('date');
      if (!selectedTime) missingInfo.push('time');
      if (!selectedPurpose) missingInfo.push('referral purpose');
      if (selectedPurpose && !isPurposeFormValid()) {
        const config = REFERRAL_PURPOSE_CONFIGS[selectedPurpose];
        if (config) {
          missingInfo.push(config.label.toLowerCase());
        }
      }
      
      Alert.alert('Missing Information', `Please provide: ${missingInfo.join(', ')}.`);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Date & Time</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E40AF" />
          <Text style={styles.loadingText}>Loading doctor availability...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Date & Time</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadDoctorData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

             {/* Header */}
       <View style={styles.header}>
         <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
           <ChevronLeft size={24} color="#1E40AF" />
         </TouchableOpacity>
         <Text style={styles.headerTitle}>Select Date & Time</Text>
         <View style={styles.headerRight} />
       </View>

      {/* Progress Bar */}
      <View style={styles.progressBarRoot}>
        <View style={styles.progressBarBg} />
        <View style={[styles.progressBarActive, { width: '105%' }]} />
        <View style={styles.progressDotsRow}>
          <View style={[styles.progressDotNew, styles.progressDotActiveNew, { left: 0 }]} />
          <View style={[styles.progressDotNew, styles.progressDotActiveNew, { left: '45%' }]} />
          <View style={[styles.progressDotNew, styles.progressDotActiveNew, { left: '90%' }]} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={styles.scrollViewContent}
          bounces={true}
          scrollEnabled={true}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
        {/* Doctor Card */}
        <View style={styles.clinicCardContainer}>
          <View style={styles.clinicCardTopRow}>
            <View style={styles.clinicCardNameCol}>
              <Text style={styles.clinicName}>{displayDoctorName}</Text>
              <Text style={styles.clinicDistance}>{displayClinicName}</Text>
              {displayClinicAddress ? (
                <Text style={styles.clinicAddress}>{displayClinicAddress}</Text>
              ) : null}
            </View>
            <View style={styles.clinicCardIconContainer}>
              <User size={24} color="#1E40AF" />
            </View>
          </View>
          <View style={styles.clinicCardBottomRow}>
            {displayDoctorSpecialty && (
              <View style={styles.clinicCardInfoItem}>
                <Clock size={16} color="#6B7280" />
                <Text style={styles.clinicCardInfoText}>{displayDoctorSpecialty}</Text>
              </View>
            )}
            {doctor?.contactNumber && (
              <View style={styles.clinicCardInfoItem}>
                <Phone size={16} color="#6B7280" />
                <Text style={styles.clinicCardInfoText}>{doctor.contactNumber}</Text>
              </View>
            )}
            {doctor?.professionalFee && (
              <View style={styles.clinicCardInfoItem}>
                <Text style={styles.clinicCardInfoText}>₱{doctor.professionalFee}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Patient Info */}
        {/* <View style={styles.section}>
          <Text style={styles.sectionTitle}>Referring Patient</Text>
          <View style={styles.patientInfoCard}>
            <Text style={styles.patientName}>{patientFirstName} {patientLastName}</Text>
            <Text style={styles.patientId}>Patient ID: {patientId}</Text>
          </View>
        </View> */}

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={handleDateScroll}
            scrollEventThrottle={16}
            ref={dateScrollRef}
          >
            {datePager.pages.map((page, pageIndex) => (
              <View key={pageIndex} style={styles.dateRow}>
                {page.map((dateItem, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dateCard,
                      selectedDate === dateItem.date && styles.dateCardSelected
                    ]}
                    onPress={() => setSelectedDate(dateItem.date)}
                  >
                    <Text style={[
                      styles.dateDayName,
                      selectedDate === dateItem.date && styles.dateDayNameSelected
                    ]}>
                      {dateItem.dayName}
                    </Text>
                    <Text style={[
                      styles.dateDay,
                      selectedDate === dateItem.date && styles.dateDaySelected
                    ]}>
                      {dateItem.day}
                    </Text>
                    <Text style={[
                      styles.dateMonth,
                      selectedDate === dateItem.date && styles.dateMonthSelected
                    ]}>
                      {dateItem.month}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Time Selection */}
        {selectedDate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Time</Text>
            {availableTimeSlots.length === 0 ? (
              <View style={styles.noSlotsContainer}>
                <Text style={styles.noSlotsText}>Loading time slots...</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                onScroll={handleTimeScroll}
                scrollEventThrottle={16}
                ref={timeScrollRef}
              >
                {timePager.pages.map((page, pageIndex) => (
                  <View key={pageIndex} style={styles.timeRow}>
                    {page.map((timeItem, index) => {
                      const isBooked = bookedTimeSlots.includes(timeItem.time);
                      console.log('🔍 Rendering time slot:', {
                        time: timeItem.time,
                        isBooked,
                        bookedTimeSlots,
                        includes: bookedTimeSlots.includes(timeItem.time),
                        bookedTimeSlotsLength: bookedTimeSlots.length
                      });
                      
                      // Debug: Log only if this slot should be booked but isn't being detected
                      if (bookedTimeSlots.length > 0 && !isBooked) {
                        console.log('🔍 WARNING: Slot should be booked but isBooked=false:', {
                          time: timeItem.time,
                          bookedTimeSlots,
                          includes: bookedTimeSlots.includes(timeItem.time)
                        });
                      }
                      
                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.timeCard,
                            selectedTime === timeItem.time && styles.timeCardSelected,
                            isBooked && styles.timeCardBooked
                          ]}
                          onPress={() => {
                            console.log('🔍 Time slot pressed:', { time: timeItem.time, isBooked });
                            if (isBooked) {
                              Alert.alert('Slot Booked', `This time slot (${timeItem.time}) is already booked and cannot be selected.`);
                              return;
                            }
                            setSelectedTime(timeItem.time);
                          }}
                          disabled={isBooked}
                          activeOpacity={isBooked ? 1 : 0.7}
                        >
                          <Text style={[
                            styles.timeText,
                            selectedTime === timeItem.time && styles.timeTextSelected,
                            isBooked && styles.timeTextBooked
                          ]}>
                            {timeItem.time}
                          </Text>
                          {isBooked && (
                            <>
                              <View style={styles.bookedOverlay} />
                              <Text style={styles.bookedLabel}>Booked</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Referral Purpose */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Referral Purpose</Text>
          <TouchableOpacity
            style={styles.purposeDropdown}
            onPress={() => setShowPurposeDropdown(!showPurposeDropdown)}
          >
            <Text style={[
              styles.purposeDropdownText,
              !selectedPurpose && styles.purposePlaceholder
            ]}>
              {selectedPurpose || 'Select referral purpose'}
            </Text>
            <ChevronDown size={20} color="#6B7280" />
          </TouchableOpacity>
          
          {showPurposeDropdown && (
            <View style={styles.purposeDropdownMenu}>
              <ScrollView
                style={styles.purposeDropdownScrollView}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                bounces={false}
                scrollEnabled={true}
              >
                {REFERRAL_PURPOSES.map((purpose, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.purposeDropdownItem}
                    onPress={() => {
                      setSelectedPurpose(purpose);
                      setShowPurposeDropdown(false);
                    }}
                  >
                    <Text style={styles.purposeDropdownItemText}>{purpose}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Dynamic Purpose-Specific Form OR Additional Notes */}
        {selectedPurpose && (
          <View style={styles.section}>
            {REFERRAL_PURPOSE_CONFIGS[selectedPurpose] ? (
              renderPurposeSpecificForm()
            ) : (
              <>
                <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Add any additional information..."
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor="#9CA3AF"
                />
              </>
            )}
          </View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Continue Button */}
      <View style={styles.continueButtonContainer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            (!selectedDate || !selectedTime || !selectedPurpose || !isPurposeFormValid()) && styles.continueButtonDisabled
          ]}
          onPress={handleContinue}
          disabled={!selectedDate || !selectedTime || !selectedPurpose || !isPurposeFormValid()}
        >
          <Text style={[
            styles.continueButtonText,
            (!selectedDate || !selectedTime || !selectedPurpose || !isPurposeFormValid()) && styles.continueButtonTextDisabled
          ]}>
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ---- Styles ----
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 10,
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
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  headerSpacer: {
    width: 40,
  },
  headerRight: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 200,
    minHeight: '100%',
  },
  progressBarRoot: {
    height: 26,
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: -6,
    paddingHorizontal: 36,
    position: 'relative',
  },
  progressBarBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    top: '50%',
    marginTop: -2,
  },
  progressBarActive: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: BLUE,
    top: '50%',
    marginTop: -2,
    zIndex: 1,
  },
  progressDotsRow: {
    position: 'absolute',
    top: '50%',
    left: 50,
    right: 0,
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
    marginTop: -9,
    pointerEvents: 'none',
    paddingHorizontal: 16,
  },
  progressDotNew: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'absolute',
  },
  progressDotActiveNew: {
    backgroundColor: BLUE,
    borderColor: BLUE,
    zIndex: 10,
  },
  progressDotInactiveNew: {
    backgroundColor: '#E5E7EB',
    borderColor: '#E5E7EB',
    zIndex: 10,
  },
  clinicCardContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginHorizontal: 24,
    marginBottom: 22,
    padding: 18,
    minHeight: 120,
    position: 'relative',
  },
  clinicCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  clinicCardNameCol: {
    flex: 1,
    marginRight: 12,
  },
  clinicCardIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clinicCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  clinicCardInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: LIGHT_BLUE,
    marginRight: 5,
    marginBottom: 5,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  clinicCardInfoText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
    marginLeft: 4,
  },
  clinicName: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
    marginRight: 16,
    flexWrap: 'wrap',
  },
  clinicDistance: {
    fontSize: 12,
    marginTop: 3,
    color: '#9CA3AF',
    fontFamily: 'Inter-Medium',
    marginBottom: 2,
  },
  clinicAddress: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 2,
  },
  patientInfoCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  patientName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  patientId: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  servicesTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 0,
    width: '100%',
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: LIGHT_BLUE,
    marginRight: 5,
    marginBottom: 5,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  serviceTagText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: BLUE,
    marginLeft: 2,
  },

  section: {
    marginHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 16,
    marginLeft: 0,
  },
  datesContainer: {
    paddingRight: 12,
  },
  dateRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  dateCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 11,
    marginRight: 9,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    minWidth: 52,
    minHeight: 72,
    justifyContent: 'center',
  },
  dateCardSelected: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  dateDayName: {
    textTransform: 'uppercase',
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: -2,
  },
  dateDayNameSelected: {
    color: '#fff',
  },
  dateDay: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    letterSpacing: 1,
    marginTop: 0,
    marginBottom: -2,
  },
  dateDaySelected: {
    color: '#fff',
  },
  dateMonth: {
    textTransform: 'uppercase',
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: -2,
  },
  dateMonthSelected: {
    color: '#fff',
  },
  timesContainer: {
    paddingRight: 12,
  },
  timeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  timeCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 13,
    marginRight: 9,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    minWidth: 62,
    minHeight: 38,
    justifyContent: 'center',
  },
  timeCardSelected: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  timeCardBooked: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
    opacity: 0.8,
    position: 'relative',
  },
  bookedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
  },
  timeText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  timeTextSelected: {
    color: '#fff',
  },
  timeTextBooked: {
    color: '#DC2626',
    textDecorationLine: 'line-through',
    fontWeight: 'bold',
  },
  bookedLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#DC2626',
    marginTop: 2,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  noSlotsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noSlotsText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontFamily: 'Inter-Medium',
    marginBottom: 5,
  },
  noSlotsSubtext: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  noDatesContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noDatesText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontFamily: 'Inter-Medium',
    marginTop: 10,
    textAlign: 'center',
  },
  dateLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  dateLoadingText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },

  indicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10, 
    marginBottom: 2,
  },
  circleIndicator: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 3,
    opacity: 0.7,
  },
  circleIndicatorActive: {
    backgroundColor: BLUE,
    opacity: 1,
  },

  purposeContainer: {
    position: 'relative',
    zIndex: 10,
  },
  purposeDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  purposeDropdownText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  purposePlaceholder: {
    color: '#9CA3AF',
  },
  purposeDropdownDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  purposeDropdownTextDisabled: {
    color: '#6B7280',
  },
  purposeDropdownMenu: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    zIndex: 1000,
    maxHeight: 250,
    shadowColor: '#00000022',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  purposeDropdownScrollView: {
    maxHeight: 230,
  },
  purposeDropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  purposeDropdownItemActive: {
    backgroundColor: '#EFF6FF',
  },
  purposeDropdownItemText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  purposeDropdownItemTextActive: {
    color: BLUE,
    fontFamily: 'Inter-SemiBold',
  },
  notesInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    minHeight: 88,
  },
  continueButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  continueButton: {
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  continueButtonTextDisabled: {
    color: '#9CA3AF',
  },
  
  // Multiselect styles
  multiselectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  multiselectOption: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
    marginRight: 8,
  },
  multiselectOptionSelected: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  multiselectOptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
  },
  multiselectOptionTextSelected: {
    color: '#FFFFFF',
  },
});
