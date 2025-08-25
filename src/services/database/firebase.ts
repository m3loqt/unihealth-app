import { 
  ref, 
  get, 
  set, 
  push, 
  update, 
  remove, 
  query, 
  onValue,
  off,
  orderByChild,
  limitToLast,
  endBefore
} from 'firebase/database';
import { database } from '../../config/firebase';

export interface Appointment {
  id?: string;
  appointmentDate: string;
  appointmentTime: string;
  bookedByUserFirstName?: string; // Optional for walk-ins
  bookedByUserId?: string; // Optional for walk-ins
  bookedByUserLastName?: string; // Optional for walk-ins
  clinicId: string;
  clinicName?: string; // Optional for walk-ins
  createdAt: string;
  doctorFirstName?: string; // Optional for walk-ins
  doctorId: string;
  doctorLastName?: string; // Optional for walk-ins
  doctorSpecialty?: string; // Optional for walk-ins
  lastUpdated: string;
  appointmentPurpose?: string; // Changed from patientComplaint to appointmentPurpose
  additionalNotes?: string; // Changed from notes
  patientId: string;
  patientFirstName?: string; // Added back for UI display
  patientLastName?: string; // Added back for UI display
  relatedReferralId?: string; // Added back for referral appointments
  sourceSystem?: string; // Optional for walk-ins
  specialty?: string; // Added back for UI display
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  type: 'general_consultation' | 'walk-in' | string;
  consultationId?: string;
  appointmentConsultationId?: string;
}

export interface MedicalHistory {
  id?: string;
  clinicalSummary: string;
  consultationDate: string;
  consultationTime: string;
  createdAt: string;
  diagnosis?: Array<{
    code: string;
    description: string;
  }>;
  differentialDiagnosis?: string;
  lastUpdated: string;
  patientId: string;
  practiceLocation?: {
    clinicId: string;
    roomOrUnit: string;
  };
  prescriptions?: Array<{
    dosage: string;
    frequency: string;
    medication: string;
    duration: string;
  }>;
  presentIllnessHistory?: string;
  provider: {
    firstName: string;
    id: string;
    lastName: string;
    providerType: string;
    sourceSystem: string;
  };
  relatedAppointment?: {
    id: string;
    type: string;
  };
  reviewOfSymptoms?: string;
  soapNotes?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  treatmentPlan?: string;
  type: string;
}

export interface Prescription {
  id?: string;
  patientId: string;
  specialistId: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  prescribedDate: string;
  status: 'active' | 'completed' | 'discontinued';
  route?: string;
  formula?: string;
  take?: string;
  totalQuantity?: string;
}

export interface Certificate {
  id?: string;
  patientId: string;
  specialistId: string;
  type: string;
  issueDate: string;
  issueTime?: string;
  expiryDate?: string;
  status: 'active' | 'expired';
  description: string;
  documentUrl?: string;
  fileUrl?: string;
  certificateNumber?: string;
  doctor?: string;
  issuedDate?: string;
  clinicName?: string;
  medicalFindings?: string;
  restrictions?: string;
}

export interface Patient {
  id?: string;
  patientFirstName?: string;
  patientLastName?: string;
  address?: string;
  phoneNumber?: string;
  status?: string;
  lastVisit?: string;
  createdAt?: string;
  isScheduledVisit?: boolean;
}

export interface Clinic {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  zipCode: string;
  phone: string;
  email: string;
  type: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  hasGeneralistDoctors?: boolean; // Added to indicate if clinic has generalist doctors
}

export interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  specialty: string;
  contactNumber: string;
  clinicAffiliations: string[];
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

export interface Referral {
  id?: string;
  appointmentDate: string;
  appointmentTime: string;
  assignedSpecialistFirstName: string;
  assignedSpecialistId: string;
  assignedSpecialistLastName: string;
  clinicAppointmentId: string;
  consultationId?: string;
  referralConsultationId?: string;
  generalistNotes?: string;
  initialReasonForReferral: string;
  lastUpdated: string;
  patientArrivalConfirmed: boolean;
  patientFirstName: string;
  patientId: string;
  patientLastName: string;
  practiceLocation: {
    clinicId: string;
    roomOrUnit: string;
  };
  referralTimestamp: string;
  referringClinicId: string;
  referringClinicName: string;
  referringGeneralistFirstName: string;
  referringGeneralistId: string;
  referringGeneralistLastName: string;
  scheduleSlotPath: string;
  sourceSystem: string;
  specialistScheduleId: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  declineReason?: string;
  specialistNotes?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'appointment' | 'referral' | 'prescription' | 'certificate';
  title: string;
  message: string;
  timestamp: number; // Use timestamp for better indexing
  read: boolean;
  relatedId: string;
  priority: 'low' | 'medium' | 'high';
  expiresAt?: number; // Auto-cleanup old notifications
}

export const databaseService = {
  // Appointments
  async getAppointments(userId: string, role: 'patient' | 'specialist'): Promise<Appointment[]> {
    try {
      const appointmentsRef = ref(database, 'appointments');
      const snapshot = await get(appointmentsRef);
      
      if (snapshot.exists()) {
        const appointments: Appointment[] = [];
        const field = role === 'patient' ? 'patientId' : 'doctorId';
        
        // Process appointments sequentially to handle async normalization
        const promises = [];
        snapshot.forEach((childSnapshot) => {
          const appointmentData = childSnapshot.val();
          // Filter appointments based on user role
          if (appointmentData[field] === userId) {
            // Handle both regular appointments and walk-in appointments
            const promise = this.normalizeAppointmentData(appointmentData).then(normalizedAppointment => ({
              id: childSnapshot.key,
              ...normalizedAppointment
            }));
            promises.push(promise);
          }
        });
        
        const resolvedAppointments = await Promise.all(promises);
        appointments.push(...resolvedAppointments);
        
        return appointments.sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime());
      }
      return [];
    } catch (error) {
      // Suppress Firebase indexing errors
      if (error instanceof Error && error.message.includes('indexOn')) {
        console.log('Firebase indexing not configured, using client-side filtering');
      } else {
        console.error('Get appointments error:', error);
      }
      return [];
    }
  },

  // Helper method to normalize appointment data from different structures
  async normalizeAppointmentData(appointmentData: any): Promise<any> {
    // Handle walk-in appointments that use 'date' and 'time' instead of 'appointmentDate' and 'appointmentTime'
    if (appointmentData.date && appointmentData.time && !appointmentData.appointmentDate && !appointmentData.appointmentTime) {
      const normalized = {
        ...appointmentData,
        appointmentDate: appointmentData.date,
        appointmentTime: appointmentData.time,
        // Remove the old field names to avoid confusion
        date: undefined,
        time: undefined
      };

      // Always enrich with data from respective nodes
      const enrichedData = await this.enrichAppointmentData(normalized);
      return enrichedData;
    }
    
    // For regular appointments, always enrich with data from respective nodes
    const enrichedData = await this.enrichAppointmentData(appointmentData);
    return enrichedData;
  },

  // Helper method to fetch missing data from respective nodes
  async enrichAppointmentData(appointmentData: any): Promise<any> {
    const enriched = { ...appointmentData };

    try {
      // Always fetch clinic data if clinicId is available
      if (appointmentData.clinicId) {
        const clinicData = await this.getClinicById(appointmentData.clinicId);
        if (clinicData) {
          enriched.clinicName = clinicData.name; // Clinic interface uses 'name' field
        }
      }

      // Always fetch doctor data if doctorId is available
      if (appointmentData.doctorId) {
        const doctorData = await this.getDoctorById(appointmentData.doctorId);
        if (doctorData) {
          enriched.doctorFirstName = doctorData.firstName; // Doctor interface uses 'firstName'
          enriched.doctorLastName = doctorData.lastName; // Doctor interface uses 'lastName'
          enriched.doctorSpecialty = doctorData.specialty; // Doctor interface uses 'specialty'
        }
      }

      // Always fetch patient data if patientId is available
      if (appointmentData.patientId) {
        const patientData = await this.getPatientById(appointmentData.patientId);
        if (patientData) {
          // Patient data can come from either patients node (firstName/lastName) or users node (firstName/lastName)
          // Both use the same field names in our new structure
          enriched.patientFirstName = patientData.firstName;
          enriched.patientLastName = patientData.lastName;
        }
      }

      // For booked appointments, the patient is the one who booked it
      if (appointmentData.patientId && appointmentData.type === 'general_consultation') {
        enriched.bookedByUserId = appointmentData.patientId;
        enriched.bookedByUserFirstName = enriched.patientFirstName;
        enriched.bookedByUserLastName = enriched.patientLastName;
      }

    } catch (error) {
      console.error('Error enriching appointment data:', error);
    }

    return enriched;
  },

  // Helper method to fetch user data by ID
  async getUserById(userId: string): Promise<any> {
    try {
      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  },

  // Clinics
  // Helper method to check if clinic has generalist doctors
  async hasGeneralistDoctors(clinicId: string): Promise<boolean> {
    try {
      const doctorsRef = ref(database, 'doctors');
      const snapshot = await get(doctorsRef);
      
      if (snapshot.exists()) {
        let hasGeneralist = false;
        snapshot.forEach((childSnapshot) => {
          const doctorData = childSnapshot.val();
          // Check if doctor is affiliated with the clinic and is a generalist
          // Check both clinic ID and clinic name for affiliation
          if (doctorData.clinicAffiliations && 
              (doctorData.clinicAffiliations.includes(clinicId) ||
               doctorData.clinicAffiliations.some((affiliation: string) => 
                 affiliation.toLowerCase().includes(clinicId.toLowerCase()) ||
                 clinicId.toLowerCase().includes(affiliation.toLowerCase())
               )) &&
              doctorData.isGeneralist === true &&
              this.hasValidAvailability(doctorData)) {
            hasGeneralist = true;
          }
        });
        return hasGeneralist;
      }
      return false;
    } catch (error) {
      console.error('Check generalist doctors error:', error);
      return false;
    }
  },

  async getClinics(): Promise<Clinic[]> {
    try {
      const clinicsRef = ref(database, 'clinics');
      const snapshot = await get(clinicsRef);
      
      if (snapshot.exists()) {
        const clinics: Clinic[] = [];
        const clinicPromises = [];
        
        // First, collect all clinics with valid addresses
        const validClinics: { id: string; data: any }[] = [];
        snapshot.forEach((childSnapshot) => {
          const clinicData = childSnapshot.val();
          // Only include active clinics with valid addresses
          if (clinicData.isActive && this.hasValidAddress(clinicData)) {
            validClinics.push({
              id: childSnapshot.key!,
              data: clinicData
            });
          }
        });

        // Check each valid clinic for generalist doctors
        for (const clinic of validClinics) {
          const hasGeneralist = await this.hasGeneralistDoctors(clinic.id);
          // Show all clinics with valid addresses, but mark which ones have generalist doctors
          clinics.push({
            id: clinic.id,
            ...clinic.data,
            hasGeneralistDoctors: hasGeneralist // Add this flag for UI purposes
          });
        }
        
        return clinics;
      }
      return [];
    } catch (error) {
      console.error('Get clinics error:', error);
      throw new Error('Failed to load clinics from database');
    }
  },

  // Helper method to check if clinic has a valid address
  hasValidAddress(clinicData: any): boolean {
    // Check for new address format (address, city, province)
    const hasNewFormat = clinicData.address && 
                        typeof clinicData.address === 'string' && 
                        clinicData.address.trim().length > 0 &&
                        clinicData.city && 
                        typeof clinicData.city === 'string' && 
                        clinicData.city.trim().length > 0 &&
                        clinicData.province && 
                        typeof clinicData.province === 'string' && 
                        clinicData.province.trim().length > 0;
    
    // Check for old address format (addressLine)
    const hasOldFormat = clinicData.addressLine && 
                        typeof clinicData.addressLine === 'string' && 
                        clinicData.addressLine.trim().length > 0;
    
    // Return true if either format is valid
    return hasNewFormat || hasOldFormat;
  },

  async getClinicById(clinicId: string): Promise<Clinic | null> {
    try {
      const clinicRef = ref(database, `clinics/${clinicId}`);
      const snapshot = await get(clinicRef);
      
      if (snapshot.exists()) {
        const clinicData = snapshot.val();
        // Only return active clinics with valid addresses
        if (clinicData.isActive && this.hasValidAddress(clinicData)) {
          return {
            id: snapshot.key!,
            ...clinicData
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Get clinic by ID error:', error);
      throw new Error('Failed to load clinic from database');
    }
  },

  // Helper method to check if doctor has valid availability data
  hasValidAvailability(doctorData: any): boolean {
    // Check if doctor has availability data
    if (!doctorData.availability) {
      return false;
    }

    const availability = doctorData.availability;
    
    // Check if there's at least one day with enabled schedule and time slots
    const weeklySchedule = availability.weeklySchedule;
    if (weeklySchedule) {
      for (const day in weeklySchedule) {
        const daySchedule = weeklySchedule[day];
        if (daySchedule?.enabled && daySchedule?.timeSlots && daySchedule.timeSlots.length > 0) {
          return true;
        }
      }
    }

    // Check if there are specific dates with time slots
    const specificDates = availability.specificDates;
    if (specificDates) {
      for (const date in specificDates) {
        const dateSchedule = specificDates[date];
        if (dateSchedule?.timeSlots && dateSchedule.timeSlots.length > 0) {
          return true;
        }
      }
    }

    return false;
  },

  async getDoctorsByClinic(clinicId: string): Promise<Doctor[]> {
    try {
      const doctorsRef = ref(database, 'doctors');
      const snapshot = await get(doctorsRef);
      
      if (snapshot.exists()) {
        const doctors: Doctor[] = [];
        snapshot.forEach((childSnapshot) => {
          const doctorData = childSnapshot.val();
          // Check if doctor is affiliated with the selected clinic and is a generalist
          // Check both clinic ID and clinic name for affiliation
          if (doctorData.clinicAffiliations && 
              (doctorData.clinicAffiliations.includes(clinicId) ||
               doctorData.clinicAffiliations.some((affiliation: string) => 
                 affiliation.toLowerCase().includes(clinicId.toLowerCase()) ||
                 clinicId.toLowerCase().includes(affiliation.toLowerCase())
               )) &&
              doctorData.isGeneralist === true &&
              this.hasValidAvailability(doctorData)) {
            // Ensure doctor has proper availability data
            const doctorWithDefaults = {
              id: childSnapshot.key!,
              ...doctorData,
              availability: doctorData.availability || {
                lastUpdated: new Date().toISOString(),
                weeklySchedule: {},
                specificDates: {}
              }
            };
            doctors.push(doctorWithDefaults);
          }
        });
        return doctors;
      }
      return [];
    } catch (error) {
      console.error('Get doctors by clinic error:', error);
      throw new Error('Failed to load doctors from database');
    }
  },

  async getAllDoctors(): Promise<Doctor[]> {
    try {
      const doctorsRef = ref(database, 'doctors');
      const snapshot = await get(doctorsRef);
      
      if (snapshot.exists()) {
        const doctorsData = snapshot.val();
        const doctors: Doctor[] = [];
        
        Object.keys(doctorsData).forEach(doctorId => {
          const doctorData = doctorsData[doctorId];
          if (this.hasValidAvailability(doctorData)) {
            doctors.push({
              id: doctorId,
              ...doctorData,
              availability: doctorData.availability || {
                lastUpdated: new Date().toISOString(),
                weeklySchedule: {},
                specificDates: {}
              }
            });
          }
        });
        
        return doctors;
      }
      return [];
    } catch (error) {
      console.error('Get all doctors error:', error);
      throw new Error('Failed to load doctors from database');
    }
  },

  async getDoctorById(doctorId: string): Promise<Doctor | null> {
    try {
      const doctorRef = ref(database, `doctors/${doctorId}`);
      const snapshot = await get(doctorRef);
      
      if (snapshot.exists()) {
        const doctorData = snapshot.val();
        // Only return doctor if they have valid availability data
        if (this.hasValidAvailability(doctorData)) {
          // Ensure doctor has proper availability data
          const doctorWithDefaults = {
            id: snapshot.key!,
            ...doctorData,
            availability: doctorData.availability || {
              lastUpdated: new Date().toISOString(),
              weeklySchedule: {},
              specificDates: {}
            }
          };
          return doctorWithDefaults;
        }
      }
      return null;
    } catch (error) {
      console.error('Get doctor by ID error:', error);
      throw new Error('Failed to load doctor from database');
    }
  },

  // Helper method to generate 20-minute time slots from start time to end time
  generateTimeSlots(startTime: string, endTime: string): string[] {
    const slots: string[] = [];
    
    console.log(`Generating 20-minute time slots from ${startTime} to ${endTime}`);
    
    // Parse start and end times (assuming format "HH:MM" or "HH:MM:SS")
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    
    console.log('Parsed start time:', start);
    console.log('Parsed end time:', end);
    
    // Generate 20-minute slots
    let current = new Date(start);
    while (current < end) {
      const timeString = current.toTimeString().slice(0, 5); // Format as "HH:MM"
      slots.push(timeString);
      console.log(`Added slot: ${timeString}`);
      
      // Add 20 minutes
      current.setMinutes(current.getMinutes() + 20);
    }
    
    console.log('Generated slots:', slots);
    return slots;
  },

  // Helper method to get available dates for a doctor
  async getAvailableDates(doctorId: string, startDate: string, endDate: string): Promise<string[]> {
    try {
      const doctor = await this.getDoctorById(doctorId);
      if (!doctor) return [];

      const availableDates: string[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Iterate through each date in the range
      for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
        const dateString = current.toISOString().split('T')[0];
        const dayOfWeek = current.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        
        // Check if doctor has availability for this date
        const weeklySchedule = doctor.availability?.weeklySchedule?.[dayOfWeek];
        const specificDate = doctor.availability?.specificDates?.[dateString];
        
        // Check specific date first (overrides weekly schedule)
        if (specificDate?.timeSlots && specificDate.timeSlots.length > 0) {
          // Check if there are any available time slots for this specific date
          const availableSlots = await this.getAvailableTimeSlots(doctorId, dateString);
          if (availableSlots.length > 0) {
            availableDates.push(dateString);
          }
        } else if (weeklySchedule?.enabled && weeklySchedule?.timeSlots && weeklySchedule.timeSlots.length > 0) {
          // Check if there are any available time slots for this day of week
          const availableSlots = await this.getAvailableTimeSlots(doctorId, dateString);
          if (availableSlots.length > 0) {
            availableDates.push(dateString);
          }
        }
      }
      
      return availableDates;
    } catch (error) {
      console.error('Get available dates error:', error);
      return [];
    }
  },

  async getAvailableTimeSlots(doctorId: string, date: string): Promise<string[]> {
    try {
      const doctor = await this.getDoctorById(doctorId);
      if (!doctor) return [];

      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const weeklySchedule = doctor.availability?.weeklySchedule?.[dayOfWeek];
      const specificDate = doctor.availability?.specificDates?.[date];

      console.log('Checking availability for date:', date);
      console.log('Day of week:', dayOfWeek);
      console.log('Weekly schedule:', weeklySchedule);
      console.log('Specific date:', specificDate);

      let availableSlots: string[] = [];

      // Check specific date first (overrides weekly schedule)
      if (specificDate?.timeSlots) {
        console.log('Using specific date time slots:', specificDate.timeSlots);
        // Generate 20-minute slots for each time slot range
        specificDate.timeSlots.forEach(slot => {
          const slots = this.generateTimeSlots(slot.startTime, slot.endTime);
          console.log(`Generated slots for ${slot.startTime}-${slot.endTime}:`, slots);
          availableSlots.push(...slots);
        });
      } else if (weeklySchedule?.enabled && weeklySchedule?.timeSlots) {
        console.log('Using weekly schedule time slots:', weeklySchedule.timeSlots);
        // Generate 20-minute slots for each time slot range
        weeklySchedule.timeSlots.forEach(slot => {
          const slots = this.generateTimeSlots(slot.startTime, slot.endTime);
          console.log(`Generated slots for ${slot.startTime}-${slot.endTime}:`, slots);
          availableSlots.push(...slots);
        });
      }

      console.log('All available slots before filtering:', availableSlots);

      // Filter out already booked slots
      const bookedSlots = await this.getBookedTimeSlots(doctorId, date);
      console.log('Booked slots:', bookedSlots);
      
      const finalSlots = availableSlots.filter(slot => !bookedSlots.includes(slot));
      console.log('Final available slots:', finalSlots);
      
      return finalSlots;
    } catch (error) {
      console.error('Get available time slots error:', error);
      throw new Error('Failed to load available time slots');
    }
  },

      async getBookedTimeSlots(doctorId: string, date: string): Promise<string[]> {
      try {
        console.log('🔍 getBookedTimeSlots: Searching for', { doctorId, date });
        const appointmentsRef = ref(database, 'appointments');
        const snapshot = await get(appointmentsRef);
      
      if (snapshot.exists()) {
        const bookedSlots: string[] = [];
        console.log('🔍 Found appointments, checking each one...');
        
        snapshot.forEach((childSnapshot) => {
          const appointmentData = childSnapshot.val();
          console.log('🔍 Checking appointment:', {
            id: childSnapshot.key,
            doctorId: appointmentData.doctorId,
            doctor: appointmentData.doctor,
            appointmentDate: appointmentData.appointmentDate,
            appointmentTime: appointmentData.appointmentTime,
            searchingFor: { doctorId, date }
          });
          
          // Check if appointment is for the same doctor and date
          // Handle both doctorId and doctor field names for compatibility
          const appointmentDoctorId = appointmentData.doctorId || appointmentData.doctor;
          if (appointmentDoctorId === doctorId && appointmentData.appointmentDate === date) {
            console.log('🔍 ✅ Found matching appointment:', appointmentData.appointmentTime);
            bookedSlots.push(appointmentData.appointmentTime);
          }
        });
        
        console.log('🔍 Final booked slots:', bookedSlots);
        return bookedSlots;
      } else {
        console.log('🔍 No appointments found in database');
        return [];
      }
    } catch (error) {
      console.error('❌ Get booked time slots error:', error);
      return [];
    }
  },

  // Helper method to check if a time slot is already booked
  async isTimeSlotBooked(doctorId: string, date: string, time: string): Promise<boolean> {
    try {
      const appointmentsRef = ref(database, 'appointments');
      const snapshot = await get(appointmentsRef);
      
      if (snapshot.exists()) {
        let isBooked = false;
        snapshot.forEach((childSnapshot) => {
          const appointmentData = childSnapshot.val();
          // Handle both doctorId and doctor field names for compatibility
          const appointmentDoctorId = appointmentData.doctorId || appointmentData.doctor;
          if (appointmentDoctorId === doctorId && 
              appointmentData.appointmentDate === date && 
              appointmentData.appointmentTime === time) {
            isBooked = true;
          }
        });
        return isBooked;
      }
      return false;
    } catch (error) {
      console.error('Check time slot booked error:', error);
      return false;
    }
  },

  // Helper method to get all appointments for a doctor from today onwards
  async getDoctorAppointmentsFromToday(doctorId: string): Promise<Appointment[]> {
    try {
      const appointmentsRef = ref(database, 'appointments');
      const snapshot = await get(appointmentsRef);
      
      if (snapshot.exists()) {
        const appointments: Appointment[] = [];
        const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
        
        snapshot.forEach((childSnapshot) => {
          const appointmentData = childSnapshot.val();
          // Handle both doctorId and doctor field names for compatibility
          const appointmentDoctorId = appointmentData.doctorId || appointmentData.doctor;
          
          // Check if appointment is for this doctor and date is today or in the future
          if (appointmentDoctorId === doctorId && appointmentData.appointmentDate >= today) {
            appointments.push({
              id: childSnapshot.key,
              ...appointmentData
            });
          }
        });
        
        return appointments.sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime());
      }
      return [];
    } catch (error) {
      console.error('Get doctor appointments from today error:', error);
      return [];
    }
  },

  // Helper method to get doctor's complete schedule including booked slots for a specific date
  async getDoctorScheduleWithBookings(doctorId: string, date: string): Promise<{
    availableSlots: string[];
    bookedSlots: string[];
    allSlots: string[];
  }> {
    try {
      console.log('🔍 getDoctorScheduleWithBookings: Starting for', { doctorId, date });
      
      // Get all available slots for the doctor on this date
      const availableSlots = await this.getAvailableTimeSlots(doctorId, date);
      console.log('🔍 Available slots:', availableSlots);
      
      // Get booked slots for the doctor on this date
      const bookedSlots = await this.getBookedTimeSlots(doctorId, date);
      console.log('🔍 Booked slots:', bookedSlots);
      
      // Get doctor's schedule to determine all possible slots
      const doctor = await this.getDoctorById(doctorId);
      if (!doctor) {
        console.log('🔍 Doctor not found');
        return { availableSlots: [], bookedSlots: [], allSlots: [] };
      }

      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const weeklySchedule = doctor.availability?.weeklySchedule?.[dayOfWeek];
      const specificDate = doctor.availability?.specificDates?.[date];

      console.log('🔍 Doctor schedule info:', {
        dayOfWeek,
        hasWeeklySchedule: !!weeklySchedule,
        hasSpecificDate: !!specificDate,
        weeklyScheduleEnabled: weeklySchedule?.enabled,
        weeklyTimeSlots: weeklySchedule?.timeSlots,
        specificTimeSlots: specificDate?.timeSlots
      });

      let allSlots: string[] = [];

      // Check specific date first (overrides weekly schedule)
      if (specificDate?.timeSlots) {
        specificDate.timeSlots.forEach(slot => {
          const slots = this.generateTimeSlots(slot.startTime, slot.endTime);
          allSlots.push(...slots);
        });
      } else if (weeklySchedule?.enabled && weeklySchedule?.timeSlots) {
        weeklySchedule.timeSlots.forEach(slot => {
          const slots = this.generateTimeSlots(slot.startTime, slot.endTime);
          allSlots.push(...slots);
        });
      }

      console.log('🔍 All possible slots:', allSlots);

      const result = {
        availableSlots,
        bookedSlots,
        allSlots
      };
      
      console.log('🔍 Final result:', result);
      return result;
    } catch (error) {
      console.error('❌ Get doctor schedule with bookings error:', error);
      return { availableSlots: [], bookedSlots: [], allSlots: [] };
    }
  },

  async createClinic(clinic: Omit<Clinic, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const clinicsRef = ref(database, 'clinics');
      const newClinicRef = push(clinicsRef);
      
      const clinicData = {
        ...clinic,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      await set(newClinicRef, clinicData);
      return newClinicRef.key!;
    } catch (error) {
      console.error('Create clinic error:', error);
      throw error;
    }
  },

  async updateClinic(id: string, updates: Partial<Clinic>): Promise<void> {
    try {
      const clinicRef = ref(database, `clinics/${id}`);
      await update(clinicRef, {
        ...updates,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('Update clinic error:', error);
      throw error;
    }
  },

  async deleteClinic(id: string): Promise<void> {
    try {
      const clinicRef = ref(database, `clinics/${id}`);
      await remove(clinicRef);
    } catch (error) {
      console.error('Delete clinic error:', error);
      throw error;
    }
  },

  async createAppointment(appointment: Omit<Appointment, 'id' | 'createdAt' | 'lastUpdated'>): Promise<string> {
    try {
      // Validate that the time slot is not already booked
      const isBooked = await this.isTimeSlotBooked(
        appointment.doctorId, 
        appointment.appointmentDate, 
        appointment.appointmentTime
      );
      
      if (isBooked) {
        throw new Error(`Time slot ${appointment.appointmentTime} on ${appointment.appointmentDate} is already booked for this doctor.`);
      }
      
      const appointmentsRef = ref(database, 'appointments');
      const newAppointmentRef = push(appointmentsRef);
      
      const appointmentData = {
        ...appointment,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
      
      await set(newAppointmentRef, appointmentData);
      
      // Create notification for the appointment
      try {
        const { notificationService } = await import('./notificationService');
        await notificationService.createAppointmentNotification(
          appointment.patientId,
          newAppointmentRef.key!,
          'created',
          appointmentData
        );
      } catch (notificationError) {
        console.warn('Failed to create appointment notification:', notificationError);
        // Don't fail the appointment creation if notification fails
      }
      
      return newAppointmentRef.key!;
    } catch (error) {
      console.error('Create appointment error:', error);
      throw error;
    }
  },

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<void> {
    try {
      const appointmentRef = ref(database, `appointments/${id}`);
      await update(appointmentRef, {
        ...updates,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Update appointment error:', error);
      throw error;
    }
  },

  async deleteAppointment(id: string): Promise<void> {
    try {
      const appointmentRef = ref(database, `appointments/${id}`);
      await remove(appointmentRef);
    } catch (error) {
      console.error('Delete appointment error:', error);
      throw error;
    }
  },

  async getAppointmentById(appointmentId: string): Promise<Appointment | null> {
    try {
      const appointmentRef = ref(database, `appointments/${appointmentId}`);
      const snapshot = await get(appointmentRef);
      
      if (snapshot.exists()) {
        const appointmentData = snapshot.val();
        
        // Normalize and enrich the appointment data (same as getAppointments)
        const normalizedAppointment = await this.normalizeAppointmentData(appointmentData);
        
        return {
          id: snapshot.key,
          ...normalizedAppointment
        };
      }
      return null;
    } catch (error) {
      console.error('Get appointment by ID error:', error);
      return null;
    }
  },

  // Prescriptions
  async getPrescriptions(userId: string): Promise<Prescription[]> {
    try {
      // Get prescriptions from both dedicated prescriptions node and medical history
      const [dedicatedPrescriptions, medicalHistorySnapshot] = await Promise.all([
        this.getPrescriptionsByPatient(userId),
        get(ref(database, `patientMedicalHistory/${userId}`))
      ]);
      
      const prescriptions: Prescription[] = [];
      
      if (medicalHistorySnapshot.exists()) {
        const patientHistory = medicalHistorySnapshot.val();

        if (patientHistory.entries) {
          Object.keys(patientHistory.entries).forEach((entryKey) => {
            const entry = patientHistory.entries[entryKey];
            if (entry.prescriptions) {
              entry.prescriptions.forEach((prescription: any, index: number) => {
                // Check if there's a corresponding prescription in the dedicated node
                const dedicatedPrescription = dedicatedPrescriptions.find(
                  dp => dp.appointmentId === entry.relatedAppointment?.id
                );
                
                prescriptions.push({
                  id: `${entryKey}_prescription_${index}`,
                  patientId: userId,
                  specialistId: entry.provider?.id || 'Unknown',
                  medication: prescription.medication,
                  dosage: prescription.dosage,
                  frequency: prescription.frequency || 'As needed',
                  duration: prescription.duration || 'Ongoing',
                  instructions: prescription.instructions || 'As prescribed',
                  // Use dedicated prescription date if available, otherwise fall back to consultation date
                  prescribedDate: dedicatedPrescription?.prescribedDate || entry.consultationDate,
                  status: 'active',
                  route: prescription.route,
                });
              });
            }
          });
        }
      }
      
      // Combine both sources and remove duplicates
      const allPrescriptions = [...dedicatedPrescriptions, ...prescriptions];
      const uniquePrescriptions = allPrescriptions.filter((prescription, index, self) => 
        index === self.findIndex(p => p.id === prescription.id)
      );
      
      return uniquePrescriptions.sort((a, b) => new Date(b.prescribedDate).getTime() - new Date(a.prescribedDate).getTime());
    } catch (error) {
      console.error('Get prescriptions error:', error);
      throw error;
    }
  },



  // Specialist-specific methods
  async getPatientsBySpecialist(specialistId: string): Promise<Patient[]> {
    try {
      console.log('🔍 getPatientsBySpecialist called with specialistId:', specialistId);
      const patients = new Map();
      const patientPromises: Promise<void>[] = [];
      
      // Get patients from appointments
      const appointmentsRef = ref(database, 'appointments');
      const appointmentsSnapshot = await get(appointmentsRef);
      
      if (appointmentsSnapshot.exists()) {
        console.log('📋 Found appointments, checking for specialist:', specialistId);
        let appointmentCount = 0;
        let matchingAppointments = 0;
        
        appointmentsSnapshot.forEach((childSnapshot) => {
          const appointment = childSnapshot.val();
          appointmentCount++;
          
          console.log(`📅 Appointment ${appointmentCount}:`, {
            doctorId: appointment.doctorId,
            specialistId: appointment.specialistId,
            patientId: appointment.patientId,
            status: appointment.status,
            patientFirstName: appointment.patientFirstName,
            patientLastName: appointment.patientLastName
          });
          
          // Only include confirmed or completed appointments
          // Check for both doctorId and specialistId (fallback)
          const appointmentDoctorId = appointment.doctorId || appointment.specialistId;
          if (appointmentDoctorId === specialistId && 
              (appointment.status === 'confirmed' || appointment.status === 'completed')) {
            matchingAppointments++;
            console.log(`✅ Found matching appointment ${matchingAppointments}:`, {
              patientId: appointment.patientId,
              status: appointment.status,
              patientName: `${appointment.patientFirstName} ${appointment.patientLastName}`,
              doctorId: appointment.doctorId,
              specialistId: appointment.specialistId
            });
            
            const patientKey = appointment.patientId;
            
            if (!patients.has(patientKey)) {
              console.log(`👤 Fetching patient details for: ${patientKey}`);
              // Fetch patient details from patients node
              const patientPromise = this.getPatientById(patientKey).then(async (patientData) => {
                if (patientData) {
                  console.log(`✅ Patient data fetched for ${patientKey}:`, patientData);
                  // Get the most recent appointment for this patient
                  const recentAppointment = this.getMostRecentAppointmentForPatient(appointmentsSnapshot, patientKey, specialistId);
                  
                  // Get the most recent consultation date from medical history
                  const lastConsultationResult = await this.getMostRecentConsultationDate(patientKey);
                  console.log(`📅 Last consultation result for ${patientKey}:`, lastConsultationResult);
                  
                  // Format the last visit date and track if it's from scheduled visit
                  let formattedLastVisit: string;
                  let isScheduledVisit = false;
                  
                  if (lastConsultationResult.date) {
                    formattedLastVisit = this.formatDateToReadable(lastConsultationResult.date);
                    isScheduledVisit = lastConsultationResult.isScheduledVisit;
                  } else if (recentAppointment?.appointmentDate) {
                    formattedLastVisit = this.formatDateToReadable(recentAppointment.appointmentDate);
                    isScheduledVisit = true;
                  } else {
                    formattedLastVisit = 'No visits yet';
                  }
                  
                  const patientInfo = {
                    id: patientKey,
                    patientFirstName: patientData.firstName || patientData.patientFirstName || 'Unknown',
                    patientLastName: patientData.lastName || patientData.patientLastName || 'Patient',
                    address: patientData.address || patientData.homeAddress || 'Address not available',
                    phoneNumber: patientData.phoneNumber || patientData.contactNumber || patientData.phone || 'Phone not available',
                    status: recentAppointment?.status || 'confirmed',
                    lastVisit: formattedLastVisit,
                    createdAt: patientData.createdAt || recentAppointment?.createdAt,
                    isScheduledVisit: isScheduledVisit,
                  };
                  
                  console.log(`👤 Setting patient info for ${patientKey}:`, patientInfo);
                  patients.set(patientKey, patientInfo);
                } else {
                  console.log(`❌ No patient data found for ${patientKey}`);
                }
              }).catch(error => {
                console.error(`❌ Error fetching patient ${patientKey}:`, error);
                // Fallback to appointment data if patient fetch fails
                const recentAppointment = this.getMostRecentAppointmentForPatient(appointmentsSnapshot, patientKey, specialistId);
                
                // Format the last visit date for fallback
                const formattedFallbackLastVisit = recentAppointment?.appointmentDate 
                  ? this.formatDateToReadable(recentAppointment.appointmentDate)
                  : 'No visits yet';
                
                const fallbackPatientInfo = {
                  id: patientKey,
                  patientFirstName: appointment.patientFirstName || 'Unknown',
                  patientLastName: appointment.patientLastName || 'Patient',
                  address: 'Address not available',
                  phoneNumber: 'Phone not available',
                  status: recentAppointment?.status || 'confirmed',
                  lastVisit: formattedFallbackLastVisit,
                  createdAt: recentAppointment?.createdAt,
                  isScheduledVisit: !!recentAppointment?.appointmentDate,
                };
                
                console.log(`🔄 Using fallback patient info for ${patientKey}:`, fallbackPatientInfo);
                patients.set(patientKey, fallbackPatientInfo);
              });
              
              patientPromises.push(patientPromise);
            } else {
              console.log(`👤 Patient ${patientKey} already being processed`);
            }
          }
        });
        
        console.log(`📊 Appointments Summary: ${appointmentCount} total appointments, ${matchingAppointments} matching appointments`);
      } else {
        console.log('❌ No appointments found in database');
      }
      
      // Get patients from referrals
      const referralsRef = ref(database, 'referrals');
      const referralsSnapshot = await get(referralsRef);
      
      if (referralsSnapshot.exists()) {
        console.log('📋 Found referrals, checking for specialist:', specialistId);
        let referralCount = 0;
        let matchingReferrals = 0;
        
        referralsSnapshot.forEach((childSnapshot) => {
          const referral = childSnapshot.val();
          referralCount++;
          
          console.log(`📋 Referral ${referralCount}:`, {
            assignedSpecialistId: referral.assignedSpecialistId,
            patientId: referral.patientId,
            status: referral.status,
            patientFirstName: referral.patientFirstName,
            patientLastName: referral.patientLastName
          });
          
          // Only include confirmed or completed referrals
          if (referral.assignedSpecialistId === specialistId && 
              (referral.status === 'confirmed' || referral.status === 'completed')) {
            matchingReferrals++;
            console.log(`✅ Found matching referral ${matchingReferrals}:`, {
              patientId: referral.patientId,
              status: referral.status,
              patientName: `${referral.patientFirstName} ${referral.patientLastName}`,
              assignedSpecialistId: referral.assignedSpecialistId
            });
            
            const patientKey = referral.patientId;
            
            if (!patients.has(patientKey)) {
              console.log(`👤 Fetching patient details for referral: ${patientKey}`);
              // Fetch patient details from patients node
              const patientPromise = this.getPatientById(patientKey).then(async (patientData) => {
                if (patientData) {
                  console.log(`✅ Patient data fetched for referral ${patientKey}:`, patientData);
                  
                  // Get the consultation date from medical history using referralId
                  const lastConsultationResult = await this.getMostRecentConsultationDate(patientKey, childSnapshot.key);
                  console.log(`📅 Last consultation result for referral ${patientKey}:`, lastConsultationResult);
                  
                  // Format the last visit date for referrals and track if it's from scheduled visit
                  let formattedReferralLastVisit: string;
                  let isScheduledVisit = false;
                  
                  if (lastConsultationResult.date) {
                    formattedReferralLastVisit = this.formatDateToReadable(lastConsultationResult.date);
                    isScheduledVisit = lastConsultationResult.isScheduledVisit;
                  } else if (referral.appointmentDate) {
                    formattedReferralLastVisit = this.formatDateToReadable(referral.appointmentDate);
                    isScheduledVisit = true;
                  } else {
                    formattedReferralLastVisit = 'No visits yet';
                  }
                  
                  const patientInfo = {
                    id: patientKey,
                    patientFirstName: patientData.firstName || patientData.patientFirstName || referral.patientFirstName || 'Unknown',
                    patientLastName: patientData.lastName || patientData.patientLastName || referral.patientLastName || 'Patient',
                    address: patientData.address || patientData.homeAddress || 'Address not available',
                    phoneNumber: patientData.phoneNumber || patientData.contactNumber || patientData.phone || 'Phone not available',
                    status: referral.status || 'confirmed',
                    lastVisit: formattedReferralLastVisit,
                    createdAt: patientData.createdAt || referral.referralTimestamp,
                    isScheduledVisit: isScheduledVisit,
                  };
                  
                  console.log(`👤 Setting patient info for referral ${patientKey}:`, patientInfo);
                  patients.set(patientKey, patientInfo);
                } else {
                  console.log(`❌ No patient data found for referral ${patientKey}`);
                }
              }).catch(error => {
                console.error(`❌ Error fetching patient for referral ${patientKey}:`, error);
                // Fallback to referral data if patient fetch fails
                const formattedReferralFallbackLastVisit = referral.appointmentDate 
                  ? this.formatDateToReadable(referral.appointmentDate)
                  : 'No visits yet';
                
                const fallbackPatientInfo = {
                  id: patientKey,
                  patientFirstName: referral.patientFirstName || 'Unknown',
                  patientLastName: referral.patientLastName || 'Patient',
                  address: 'Address not available',
                  phoneNumber: 'Phone not available',
                  status: referral.status || 'confirmed',
                  lastVisit: formattedReferralFallbackLastVisit,
                  createdAt: referral.referralTimestamp,
                  isScheduledVisit: !!referral.appointmentDate,
                };
                
                console.log(`🔄 Using fallback patient info for referral ${patientKey}:`, fallbackPatientInfo);
                patients.set(patientKey, fallbackPatientInfo);
              });
              
              patientPromises.push(patientPromise);
            } else {
              console.log(`👤 Patient ${patientKey} from referral already being processed`);
            }
          }
        });
        
        console.log(`📊 Referrals Summary: ${referralCount} total referrals, ${matchingReferrals} matching referrals`);
      } else {
        console.log('❌ No referrals found in database');
      }
      
      // Wait for all patient data to be fetched
      await Promise.all(patientPromises);
      const result = Array.from(patients.values());
      console.log(`🎯 Final result: ${result.length} patients returned:`, result);
      return result;
    } catch (error) {
      console.error('❌ Get patients by specialist error:', error);
      return [];
    }
  },

  // Helper method to get the most recent appointment for a patient
  getMostRecentAppointmentForPatient(appointmentsSnapshot: any, patientId: string, specialistId: string): any {
    let mostRecentAppointment = null;
    let mostRecentDate = null;
    
    appointmentsSnapshot.forEach((childSnapshot: any) => {
      const appointment = childSnapshot.val();
      // Check for both doctorId and specialistId (fallback)
      const appointmentDoctorId = appointment.doctorId || appointment.specialistId;
      if (appointment.patientId === patientId && 
          appointmentDoctorId === specialistId &&
          (appointment.status === 'confirmed' || appointment.status === 'completed')) {
        
        const appointmentDate = new Date(appointment.appointmentDate);
        if (!mostRecentDate || appointmentDate > mostRecentDate) {
          mostRecentDate = appointmentDate;
          mostRecentAppointment = appointment;
        }
      }
    });
    
    return mostRecentAppointment;
  },

  // Helper method to get the most recent consultation date from medical history
  async getMostRecentConsultationDate(patientId: string, referralId?: string): Promise<{ date: string | null; isScheduledVisit: boolean }> {
    try {
      // If we have a referralId, follow the specific path to get consultationDate
      if (referralId) {
        console.log(`🔍 Fetching consultation date for referral: ${referralId}`);
        
        // Step 1: Get referralConsultationId from referrals node of that referralId
        const referralRef = ref(database, `referrals/${referralId}`);
        const referralSnapshot = await get(referralRef);
        
        if (referralSnapshot.exists()) {
          const referral = referralSnapshot.val();
          const referralConsultationId = referral.referralConsultationId;
          
          console.log(`📋 Found referral ${referralId}, referralConsultationId:`, referralConsultationId);
          
          if (referralConsultationId) {
            // Step 2: Go to patientMedicalHistory > patientId > entries > referralConsultationId > consultationDate
            const consultationRef = ref(database, `patientMedicalHistory/${patientId}/entries/${referralConsultationId}`);
            const consultationSnapshot = await get(consultationRef);
            
            if (consultationSnapshot.exists()) {
              const consultation = consultationSnapshot.val();
              const consultationDate = consultation.consultationDate;
              
              console.log(`✅ Found consultation for referral ${referralId}:`, consultationDate);
              return { date: consultationDate, isScheduledVisit: false };
            } else {
              console.log(`❌ No consultation found for referralConsultationId ${referralConsultationId}`);
            }
          } else {
            console.log(`⚠️ No referralConsultationId found in referral ${referralId}`);
          }
          
          // Step 3: If consultationDate is null, look for appointmentDate inside referrals node of that referralId
          const appointmentDate = referral.appointmentDate;
          if (appointmentDate) {
            console.log(`📅 Using appointmentDate from referral ${referralId}:`, appointmentDate);
            return { date: appointmentDate, isScheduledVisit: true };
          } else {
            console.log(`❌ No appointmentDate found in referral ${referralId}`);
          }
        } else {
          console.log(`❌ No referral found for referralId ${referralId}`);
        }
      }
      
      // Fallback to getting the most recent consultation from all entries
      const medicalHistory = await this.getMedicalHistoryByPatient(patientId);
      if (medicalHistory.length > 0) {
        // Medical history is already sorted by consultation date (most recent first)
        const mostRecent = medicalHistory[0];
        console.log(`📅 Using most recent consultation date: ${mostRecent.consultationDate}`);
        return { date: mostRecent.consultationDate, isScheduledVisit: false };
      }
      return { date: null, isScheduledVisit: false };
    } catch (error) {
      console.error(`Error fetching medical history for patient ${patientId}:`, error);
      return { date: null, isScheduledVisit: false };
    }
  },

  // Helper method to format date to "May 16, 2025" format
  formatDateToReadable(dateString: string): string {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      };
      
      return date.toLocaleDateString('en-US', options);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  },

  async getAppointmentsBySpecialist(specialistId: string): Promise<Appointment[]> {
    try {
      const appointmentsRef = ref(database, 'appointments');
      const snapshot = await get(appointmentsRef);
      
      if (snapshot.exists()) {
        const appointments: Appointment[] = [];
        const promises = [];
        
        snapshot.forEach((childSnapshot) => {
          const appointment = childSnapshot.val();
          if (appointment.doctorId === specialistId) {
            // Handle both regular appointments and walk-in appointments
            const promise = this.normalizeAppointmentData(appointment).then(normalizedAppointment => ({
              id: childSnapshot.key,
              ...normalizedAppointment
            }));
            promises.push(promise);
          }
        });
        
        const resolvedAppointments = await Promise.all(promises);
        appointments.push(...resolvedAppointments);
        
        return appointments.sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime());
      }
      return [];
    } catch (error) {
      console.error('Get appointments by specialist error:', error);
      return [];
    }
  },

  async getAppointmentsBySpecialistAndStatus(specialistId: string, status: string): Promise<Appointment[]> {
    try {
      const appointmentsRef = ref(database, 'appointments');
      const snapshot = await get(appointmentsRef);
      
      if (snapshot.exists()) {
        const appointments: Appointment[] = [];
        const promises = [];
        
        snapshot.forEach((childSnapshot) => {
          const appointment = childSnapshot.val();
          if (appointment.doctorId === specialistId && appointment.status === status) {
            // Handle both regular appointments and walk-in appointments
            const promise = this.normalizeAppointmentData(appointment).then(normalizedAppointment => ({
              id: childSnapshot.key,
              ...normalizedAppointment
            }));
            promises.push(promise);
          }
        });
        
        const resolvedAppointments = await Promise.all(promises);
        appointments.push(...resolvedAppointments);
        
        return appointments.sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime());
      }
      return [];
    } catch (error) {
      console.error('Get appointments by specialist and status error:', error);
      return [];
    }
  },

  async getPrescriptionsBySpecialist(specialistId: string): Promise<Prescription[]> {
    try {
      // Get prescriptions from patientMedicalHistory entries
      const medicalHistoryRef = ref(database, 'patientMedicalHistory');
      const snapshot = await get(medicalHistoryRef);
      
      if (snapshot.exists()) {
        const prescriptions: Prescription[] = [];
        
        snapshot.forEach((patientSnapshot) => {
          const patientHistory = patientSnapshot.val();
          if (patientHistory.entries) {
            Object.keys(patientHistory.entries).forEach((entryKey) => {
              const entry = patientHistory.entries[entryKey];
              // Check if this entry was created by the specialist
              if (entry.provider && entry.provider.id === specialistId && entry.prescriptions) {
                entry.prescriptions.forEach((prescription: any, index: number) => {
                  prescriptions.push({
                    id: `${entryKey}_prescription_${index}`,
                    patientId: entry.patientId,
                    specialistId: entry.provider.id,
                    medication: prescription.medication,
                    dosage: prescription.dosage,
                    frequency: prescription.frequency || 'As needed',
                    duration: prescription.duration || 'Ongoing',
                    instructions: prescription.instructions || 'As prescribed',
                    prescribedDate: entry.consultationDate,
                    status: 'active',
                    route: prescription.route,
                  });
                });
              }
            });
          }
        });
        
        return prescriptions.sort((a, b) => new Date(b.prescribedDate).getTime() - new Date(a.prescribedDate).getTime());
      }
      return [];
    } catch (error) {
      console.error('Get prescriptions by specialist error:', error);
      return [];
    }
  },

  async getCertificatesBySpecialist(specialistId: string): Promise<Certificate[]> {
    try {
      // Get certificates from patientMedicalHistory entries (medical certificates would be entries with specific types)
      const medicalHistoryRef = ref(database, 'patientMedicalHistory');
      const snapshot = await get(medicalHistoryRef);
      
      if (snapshot.exists()) {
        const certificates: Certificate[] = [];
        
        snapshot.forEach((patientSnapshot) => {
          const patientHistory = patientSnapshot.val();
          if (patientHistory.entries) {
            Object.keys(patientHistory.entries).forEach((entryKey) => {
              const entry = patientHistory.entries[entryKey];
              // Check if this entry was created by the specialist and is a certificate type
              if (entry.provider && entry.provider.id === specialistId && 
                  (entry.type === 'Medical Certificate' || entry.type === 'Fit to Work' || entry.type === 'Medical Clearance')) {
                certificates.push({
                  id: entryKey,
                  patientId: entry.patientId,
                  specialistId: entry.provider.id,
                  type: entry.type,
                  issueDate: entry.consultationDate,
                  status: 'active',
                  description: entry.clinicalSummary || entry.treatmentPlan || 'Medical certificate issued',
                });
              }
            });
          }
        });
        
        return certificates.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
      }
      return [];
    } catch (error) {
      console.error('Get certificates by specialist error:', error);
      return [];
    }
  },

  async getSpecialistProfile(specialistId: string): Promise<any> {
    try {
      // Get data from both users and doctors nodes
      const userRef = ref(database, `users/${specialistId}`);
      const doctorRef = ref(database, `doctors/${specialistId}`);
      
      const [userSnapshot, doctorSnapshot] = await Promise.all([
        get(userRef),
        get(doctorRef)
      ]);
      
      let combinedProfile: any = { id: specialistId };
      
      // Add user data (immutable fields)
      if (userSnapshot.exists()) {
        const userData = userSnapshot.val();
        combinedProfile = { ...combinedProfile, ...userData };
      }
      
      // Add doctor data (editable fields)
      if (doctorSnapshot.exists()) {
        const doctorData = doctorSnapshot.val();
        combinedProfile = { ...combinedProfile, ...doctorData };
      }
      
      return combinedProfile;
    } catch (error) {
      console.error('Get specialist profile error:', error);
      return null;
    }
  },

  async getPatientProfile(patientId: string): Promise<any> {
    try {
      // Get data from both users and patients nodes
      const userRef = ref(database, `users/${patientId}`);
      const patientRef = ref(database, `patients/${patientId}`);
      
      const [userSnapshot, patientSnapshot] = await Promise.all([
        get(userRef),
        get(patientRef)
      ]);
      
      let combinedProfile: any = { id: patientId };
      
      // Add user data (immutable fields)
      if (userSnapshot.exists()) {
        const userData = userSnapshot.val();
        combinedProfile = { ...combinedProfile, ...userData };
      }
      
      // Add patient data (editable fields)
      if (patientSnapshot.exists()) {
        const patientData = patientSnapshot.val();
        combinedProfile = { ...combinedProfile, ...patientData };
      }
      
      return combinedProfile;
    } catch (error) {
      console.error('Get patient profile error:', error);
      return null;
    }
  },

  async updatePatientProfile(patientId: string, updates: any): Promise<void> {
    try {
      console.log('=== updatePatientProfile: Starting update ===');
      console.log('Patient ID:', patientId);
      console.log('Updates received:', updates);
      console.log('Address in updates:', updates.address);
      console.log('Contact number in updates:', updates.contactNumber);
      
      // Separate updates for different nodes
      const userUpdates: any = {};
      const patientUpdates: any = {};
      
      // Fields that go to users node (only immutable fields)
      if (updates.firstName !== undefined) userUpdates.firstName = updates.firstName;
      if (updates.lastName !== undefined) userUpdates.lastName = updates.lastName;
      if (updates.email !== undefined) userUpdates.email = updates.email;
      
      // Fields that go to patients node (editable fields)
      if (updates.contactNumber !== undefined) patientUpdates.contactNumber = updates.contactNumber;
      if (updates.address !== undefined) patientUpdates.address = updates.address;
      if (updates.bloodType !== undefined) patientUpdates.bloodType = updates.bloodType;
      if (updates.allergies !== undefined) patientUpdates.allergies = updates.allergies;
      if (updates.emergencyContact !== undefined) patientUpdates.emergencyContact = updates.emergencyContact;
      if (updates.lastUpdated !== undefined) patientUpdates.lastUpdated = updates.lastUpdated;
      
      console.log('User updates to be applied:', userUpdates);
      console.log('Patient updates to be applied:', patientUpdates);
      console.log('Address will be written to patients node:', patientUpdates.address);
      
      // Update users node if there are user-specific updates
      if (Object.keys(userUpdates).length > 0) {
        const userRef = ref(database, `users/${patientId}`);
        const userSnapshot = await get(userRef);
        if (userSnapshot.exists()) {
          console.log('Updating users node with:', userUpdates);
          await update(userRef, userUpdates);
          console.log('Users node updated successfully');
          
          // Verify the update
          const verifySnapshot = await get(userRef);
          if (verifySnapshot.exists()) {
            const updatedData = verifySnapshot.val();
            console.log('Users node after update:', updatedData);
            console.log('Contact number after update:', updatedData.contactNumber);
            console.log('Address after update:', updatedData.address);
            console.log('Address field type:', typeof updatedData.address);
            console.log('Address field length:', updatedData.address?.length);
          }
        } else {
          console.log('Users node does not exist for patient:', patientId);
        }
      }
      
      // Update patients node if there are patient-specific updates
      if (Object.keys(patientUpdates).length > 0) {
        const patientRef = ref(database, `patients/${patientId}`);
        const patientSnapshot = await get(patientRef);
        if (patientSnapshot.exists()) {
          console.log('Updating patients node with:', patientUpdates);
          await update(patientRef, patientUpdates);
          console.log('Patients node updated successfully');
        } else {
          console.log('Patients node does not exist for patient:', patientId);
        }
      }
      
      console.log('Profile update completed successfully');
      console.log('=== updatePatientProfile: Update completed ===');
    } catch (error) {
      console.error('Update patient profile error:', error);
      throw error;
    }
  },

  async updateSpecialistProfile(specialistId: string, updates: any): Promise<void> {
    try {
      // Separate updates for different nodes
      const userUpdates: any = {};
      const doctorUpdates: any = {};
      
      // Fields that go to users node (only immutable fields)
      if (updates.firstName !== undefined) userUpdates.firstName = updates.firstName;
      if (updates.lastName !== undefined) userUpdates.lastName = updates.lastName;
      if (updates.email !== undefined) userUpdates.email = updates.email;
      
      // Fields that go to doctors node (editable fields)
      if (updates.contactNumber !== undefined) doctorUpdates.contactNumber = updates.contactNumber;
      if (updates.address !== undefined) doctorUpdates.address = updates.address;
      if (updates.specialty !== undefined) doctorUpdates.specialty = updates.specialty;
      if (updates.yearsOfExperience !== undefined) doctorUpdates.yearsOfExperience = updates.yearsOfExperience;
      if (updates.medicalLicenseNumber !== undefined) doctorUpdates.medicalLicenseNumber = updates.medicalLicenseNumber;
      if (updates.prcId !== undefined) doctorUpdates.prcId = updates.prcId;
      if (updates.prcExpiryDate !== undefined) doctorUpdates.prcExpiryDate = updates.prcExpiryDate;
      if (updates.professionalFee !== undefined) doctorUpdates.professionalFee = updates.professionalFee;
      if (updates.gender !== undefined) doctorUpdates.gender = updates.gender;
      if (updates.dateOfBirth !== undefined) doctorUpdates.dateOfBirth = updates.dateOfBirth;
      if (updates.civilStatus !== undefined) doctorUpdates.civilStatus = updates.civilStatus;
      if (updates.lastUpdated !== undefined) doctorUpdates.lastUpdated = updates.lastUpdated;
      
      // Update users node if there are user-specific updates
      if (Object.keys(userUpdates).length > 0) {
        const userRef = ref(database, `users/${specialistId}`);
        const userSnapshot = await get(userRef);
        if (userSnapshot.exists()) {
          await update(userRef, userUpdates);
          console.log('Updated users node with:', userUpdates);
        } else {
          console.log('Users node does not exist for specialist:', specialistId);
        }
      }
      
      // Update doctors node if there are doctor-specific updates
      if (Object.keys(doctorUpdates).length > 0) {
        const doctorRef = ref(database, `doctors/${specialistId}`);
        const doctorSnapshot = await get(doctorRef);
        if (doctorSnapshot.exists()) {
          await update(doctorRef, doctorUpdates);
          console.log('Updated doctors node with:', doctorUpdates);
        } else {
          console.log('Doctors node does not exist for specialist:', specialistId);
        }
      }
      
      console.log('Specialist profile update completed successfully');
    } catch (error) {
      console.error('Update specialist profile error:', error);
      throw error;
    }
  },

  async getPatientById(patientId: string): Promise<any> {
    try {
      // First try to get from patients node
      const patientRef = ref(database, `patients/${patientId}`);
      const patientSnapshot = await get(patientRef);
      if (patientSnapshot.exists()) {
        return { id: patientId, ...patientSnapshot.val() };
      }
      
      // If not found in patients, try users node
      const userRef = ref(database, `users/${patientId}`);
      const userSnapshot = await get(userRef);
      if (userSnapshot.exists()) {
        return { id: patientId, ...userSnapshot.val() };
      }
      
      // If not found in either, get from appointments data
      const appointmentsRef = ref(database, 'appointments');
      const snapshot = await get(appointmentsRef);
      
      if (snapshot.exists()) {
        let patientData = null;
        snapshot.forEach((childSnapshot) => {
          const appointment = childSnapshot.val();
          if (appointment.patientId === patientId && !patientData) {
            patientData = {
              id: patientId,
              firstName: appointment.patientFirstName || 'Unknown',
              lastName: appointment.patientLastName || 'Patient',
              email: appointment.bookedByUserId || '', // Using bookedByUserId as email
            };
          }
        });
        return patientData;
      }
      return null;
    } catch (error) {
      console.error('Get patient by ID error:', error);
      return null;
    }
  },

  async getAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
    try {
      const appointmentsRef = ref(database, 'appointments');
      const snapshot = await get(appointmentsRef);
      
      if (snapshot.exists()) {
        const appointments: Appointment[] = [];
        const promises = [];
        
        snapshot.forEach((childSnapshot) => {
          const appointment = childSnapshot.val();
          if (appointment.patientId === patientId) {
            // Handle both regular appointments and walk-in appointments
            const promise = this.normalizeAppointmentData(appointment).then(normalizedAppointment => ({
              id: childSnapshot.key,
              ...normalizedAppointment
            }));
            promises.push(promise);
          }
        });
        
        const resolvedAppointments = await Promise.all(promises);
        appointments.push(...resolvedAppointments);
        
        return appointments.sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime());
      }
      return [];
    } catch (error) {
      console.error('Get appointments by patient error:', error);
      return [];
    }
  },

  async getPrescriptionsByAppointment(appointmentId: string): Promise<Prescription[]> {
    try {
      const prescriptionsRef = ref(database, 'prescriptions');
      const snapshot = await get(prescriptionsRef);
      
      if (snapshot.exists()) {
        const prescriptions: Prescription[] = [];
        snapshot.forEach((childSnapshot) => {
          const prescription = childSnapshot.val();
          if (prescription.appointmentId === appointmentId) {
            prescriptions.push({
              id: childSnapshot.key,
              ...prescription
            });
          }
        });
        return prescriptions;
      }
      return [];
    } catch (error) {
      console.error('Get prescriptions by appointment error:', error);
      return [];
    }
  },

  async getPrescriptionsByPatient(patientId: string): Promise<Prescription[]> {
    try {
      const prescriptionsRef = ref(database, 'prescriptions');
      const snapshot = await get(prescriptionsRef);
      
      if (snapshot.exists()) {
        const prescriptions: Prescription[] = [];
        snapshot.forEach((childSnapshot) => {
          const prescription = childSnapshot.val();
          if (prescription.patientId === patientId) {
            prescriptions.push({
              id: childSnapshot.key,
              ...prescription
            });
          }
        });
        return prescriptions.sort((a, b) => new Date(b.prescribedDate).getTime() - new Date(a.prescribedDate).getTime());
      }
      return [];
    } catch (error) {
      console.error('Get prescriptions by patient error:', error);
      return [];
    }
  },

  async getCertificatesByAppointment(appointmentId: string): Promise<Certificate[]> {
    try {
      const certificatesRef = ref(database, 'certificates');
      const snapshot = await get(certificatesRef);
      
      if (snapshot.exists()) {
        const certificates: Certificate[] = [];
        snapshot.forEach((childSnapshot) => {
          const certificate = childSnapshot.val();
          if (certificate.appointmentId === appointmentId) {
            certificates.push({
              id: childSnapshot.key,
              ...certificate
            });
          }
        });
        return certificates;
      }
      return [];
    } catch (error) {
      console.error('Get certificates by appointment error:', error);
      return [];
    }
  },

  async getCertificateById(certificateId: string): Promise<Certificate | null> {
    try {
      const certificateRef = ref(database, `certificates/${certificateId}`);
      const snapshot = await get(certificateRef);
      return snapshot.exists() ? { id: certificateId, ...snapshot.val() } : null;
    } catch (error) {
      console.error('Get certificate by ID error:', error);
      return null;
    }
  },

  async updateAppointmentStatus(id: string, status: string, reason?: string): Promise<void> {
    try {
      console.log('🔔 Starting updateAppointmentStatus for appointment:', id, 'with status:', status);
      
      const appointmentRef = ref(database, `appointments/${id}`);
      const snapshot = await get(appointmentRef);
      
      if (!snapshot.exists()) {
        throw new Error('Appointment not found');
      }

      const appointment = snapshot.val();
      console.log('📋 Appointment data:', appointment);
      
      const updates: any = {
        status,
        lastUpdated: new Date().toISOString()
      };

      if (reason) {
        updates.declineReason = reason;
      }

      await update(appointmentRef, updates);
      console.log('✅ Appointment status updated successfully');

      // Send notifications to both patient and doctor
      try {
        console.log('🔔 Attempting to import notification service...');
        const { notificationService } = await import('../notificationService');
        console.log('✅ Notification service imported successfully');
        
        // Send to patient
        console.log('🔔 Creating patient notification for:', appointment.patientId);
        const patientNotificationId = await notificationService.createAppointmentStatusNotification(
          appointment.patientId,
          id,
          status,
          {
            date: appointment.appointmentDate,
            time: appointment.appointmentTime,
            doctorName: `${appointment.doctorFirstName || 'Dr.'} ${appointment.doctorLastName || 'Unknown'}`,
            clinicId: appointment.clinicId,
            clinicName: appointment.clinicName // Keep for backward compatibility
          }
        );
        console.log('✅ Patient notification created with ID:', patientNotificationId);

        // Send to doctor
        console.log('🔔 Creating doctor notification for:', appointment.doctorId);
        const doctorNotificationId = await notificationService.createDoctorNotification(
          appointment.doctorId,
          id,
          status,
          {
            date: appointment.appointmentDate,
            time: appointment.appointmentTime,
            patientName: `${appointment.patientFirstName || 'Unknown'} ${appointment.patientLastName || 'Patient'}`,
            clinicId: appointment.clinicId,
            clinicName: appointment.clinicName // Keep for backward compatibility
          }
        );
        console.log('✅ Doctor notification created with ID:', doctorNotificationId);

      } catch (notificationError) {
        console.error('❌ Error creating notifications:', notificationError);
        
        // Fallback: Create notifications directly using database service
        console.log('🔄 Attempting fallback notification creation...');
        try {
          await this.createFallbackNotification(
            appointment.patientId,
            'appointment',
            id,
            status,
            `Your appointment status has been updated to: ${status}`
          );
          
          await this.createFallbackNotification(
            appointment.doctorId,
            'appointment',
            id,
            status,
            `Appointment status updated to: ${status}`
          );
          
          console.log('✅ Fallback notifications created successfully');
        } catch (fallbackError) {
          console.error('❌ Fallback notification creation also failed:', fallbackError);
        }
      }

    } catch (error) {
      console.error('❌ Update appointment status error:', error);
      throw error;
    }
  },

  // Fallback notification creation method
  async createFallbackNotification(
    userId: string,
    type: string,
    relatedId: string,
    status: string,
    message: string
  ): Promise<string> {
    try {
      const notificationRef = ref(database, `notifications/${userId}`);
      const newNotificationRef = push(notificationRef);
      
      const notification: Notification = {
        id: newNotificationRef.key!,
        userId,
        type: type as any,
        title: `Appointment ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message,
        timestamp: Date.now(),
        read: false,
        relatedId,
        priority: 'medium',
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000)
      };

      await set(newNotificationRef, notification);
      console.log('✅ Fallback notification created for user:', userId);
      return newNotificationRef.key!;
    } catch (error) {
      console.error('❌ Error creating fallback notification:', error);
      throw error;
    }
  },

  // Certificates
  async getCertificates(userId: string): Promise<Certificate[]> {
    try {
      const certificatesRef = ref(database, 'certificates');
      const snapshot = await get(certificatesRef);
      
      if (snapshot.exists()) {
        const certificates: Certificate[] = [];
        snapshot.forEach((childSnapshot) => {
          const certificate = childSnapshot.val();
          // Filter client-side by patientId
          if (certificate.patientId === userId) {
            certificates.push({
              id: childSnapshot.key,
              ...certificate
            });
          }
        });
        return certificates.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
      }
      return [];
    } catch (error) {
      // Suppress Firebase indexing errors
      if (error instanceof Error && error.message.includes('indexOn')) {
        console.log('Firebase indexing not configured, using client-side filtering');
      } else {
        console.error('Get certificates error:', error);
      }
      return [];
    }
  },

  async createCertificate(certificate: Omit<Certificate, 'id'>): Promise<string> {
    try {
      const certificatesRef = ref(database, 'certificates');
      const newCertificateRef = push(certificatesRef);
      
      const certificateData = {
        ...certificate,
        issueDate: new Date().toISOString(),
      };
      
      await set(newCertificateRef, certificateData);
      return newCertificateRef.key!;
    } catch (error) {
      console.error('Create certificate error:', error);
      throw error;
    }
  },

  async updateCertificate(id: string, updates: Partial<Certificate>): Promise<void> {
    try {
      const certificateRef = ref(database, `certificates/${id}`);
      await update(certificateRef, {
        ...updates,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Update certificate error:', error);
      throw error;
    }
  },

  async deleteCertificate(id: string): Promise<void> {
    try {
      const certificateRef = ref(database, `certificates/${id}`);
      await remove(certificateRef);
    } catch (error) {
      console.error('Delete certificate error:', error);
      throw error;
    }
  },

  // Medical History
  async getMedicalHistory(patientId: string): Promise<MedicalHistory[]> {
    try {
      const medicalHistoryRef = ref(database, 'patientMedicalHistory');
      const snapshot = await get(medicalHistoryRef);
      
      if (snapshot.exists()) {
        const medicalHistory: MedicalHistory[] = [];
        
        // Look for the specific patient's medical history
        const patientHistory = snapshot.val()[patientId];
        if (patientHistory && patientHistory.entries) {
          Object.keys(patientHistory.entries).forEach((entryKey) => {
            const entry = patientHistory.entries[entryKey];
            medicalHistory.push({
              id: entryKey,
              ...entry
            });
          });
        }
        
        return medicalHistory.sort((a, b) => new Date(b.consultationDate).getTime() - new Date(a.consultationDate).getTime());
      }
      return [];
    } catch (error) {
      console.error('Get medical history error:', error);
      return [];
    }
  },

  async getMedicalHistoryByAppointment(appointmentId: string, patientId: string): Promise<MedicalHistory | null> {
    try {
      // First, get the appointment to find the appointmentConsultationId
      const appointment = await this.getAppointmentById(appointmentId);
      if (!appointment || !appointment.appointmentConsultationId) {
        console.log('No appointmentConsultationId found for appointment:', appointmentId);
        return null;
      }

      // Use the appointmentConsultationId to get the medical history entry
      const medicalHistoryRef = ref(database, `patientMedicalHistory/${patientId}/entries/${appointment.appointmentConsultationId}`);
      const snapshot = await get(medicalHistoryRef);
      
      if (snapshot.exists()) {
        const entry = snapshot.val();
        return {
          id: appointment.appointmentConsultationId,
          ...entry
        };
      }
      return null;
    } catch (error) {
      console.error('Get medical history by appointment error:', error);
      throw new Error('Failed to load medical history from database');
    }
  },
  
  async getMedicalHistoryByPatient(patientId: string): Promise<MedicalHistory[]> {
    try {
      const medicalHistoryRef = ref(database, `patientMedicalHistory/${patientId}/entries`);
      const snapshot = await get(medicalHistoryRef);
      
      if (snapshot.exists()) {
        const medicalHistory: MedicalHistory[] = [];
        snapshot.forEach((childSnapshot) => {
          const entry = childSnapshot.val();
          medicalHistory.push({
            id: childSnapshot.key!,
            ...entry
          });
        });
        
        return medicalHistory.sort((a, b) => new Date(b.consultationDate).getTime() - new Date(a.consultationDate).getTime());
      }
      return [];
    } catch (error) {
      console.error('Get medical history by patient error:', error);
      return [];
    }
  },

  // Referrals
  async getReferralsBySpecialist(specialistId: string): Promise<Referral[]> {
    try {
      const referralsRef = ref(database, 'referrals');
      const snapshot = await get(referralsRef);
      
      if (snapshot.exists()) {
        const referrals: Referral[] = [];
        snapshot.forEach((childSnapshot) => {
          const referral = childSnapshot.val();
          // Filter referrals assigned to this specialist
          if (referral.assignedSpecialistId === specialistId) {
            referrals.push({
              id: childSnapshot.key,
              ...referral
            });
          }
        });
        return referrals.sort((a, b) => new Date(b.referralTimestamp).getTime() - new Date(a.referralTimestamp).getTime());
      }
      return [];
    } catch (error) {
      console.error('Get referrals by specialist error:', error);
      return [];
    }
  },

  async getReferralsBySpecialistAndStatus(specialistId: string, status: string): Promise<Referral[]> {
    try {
      const referralsRef = ref(database, 'referrals');
      const snapshot = await get(referralsRef);
      
      if (snapshot.exists()) {
        const referrals: Referral[] = [];
        snapshot.forEach((childSnapshot) => {
          const referral = childSnapshot.val();
          // Filter referrals assigned to this specialist with specific status
          if (referral.assignedSpecialistId === specialistId && referral.status === status) {
            referrals.push({
              id: childSnapshot.key,
              ...referral
            });
          }
        });
        return referrals.sort((a, b) => new Date(b.referralTimestamp).getTime() - new Date(a.referralTimestamp).getTime());
      }
      return [];
    } catch (error) {
      console.error('Get referrals by specialist and status error:', error);
      return [];
    }
  },

  async updateReferralStatus(referralId: string, status: 'confirmed' | 'cancelled', declineReason?: string, specialistNotes?: string): Promise<void> {
    try {
      console.log('🔔 Starting updateReferralStatus for referral:', referralId, 'with status:', status);
      
      const referralRef = ref(database, `referrals/${referralId}`);
      const snapshot = await get(referralRef);
      
      if (!snapshot.exists()) {
        throw new Error('Referral not found');
      }

      const referral = snapshot.val();
      console.log('📋 Referral data:', referral);
      
      const updates: any = { 
        status, 
        lastUpdated: new Date().toISOString() 
      };
      
      if (declineReason) {
        updates.declineReason = declineReason;
      }
      
      if (specialistNotes) {
        updates.specialistNotes = specialistNotes;
      }
      
      // Update the referral
      await update(referralRef, updates);
      console.log('✅ Referral status updated successfully');
      
      // Create notifications for the referral status change
      try {
        console.log('🔔 Creating notifications for referral status change...');
        
        if (status === 'confirmed') {
          // Create patient notification
          await this.createFallbackNotification(
            referral.patientId,
            'referral',
            referralId,
                    'confirmed',
        `Your referral to ${referral.practiceLocation.roomOrUnit || 'Specialist'} at ${referral.referringClinicName} has been confirmed.`
          );
          
          // Create specialist notification
          await this.createFallbackNotification(
            referral.assignedSpecialistId,
            'referral',
            referralId,
                    'confirmed',
        `You have confirmed a referral for ${referral.patientFirstName} ${referral.patientLastName}.`
          );
        } else if (status === 'cancelled') {
          // Create patient notification
          await this.createFallbackNotification(
            referral.patientId,
            'referral',
            referralId,
                    'cancelled',
        `Your referral to ${referral.practiceLocation.roomOrUnit || 'Specialist'} at ${referral.referringClinicName} has been cancelled.`
          );
          
          // Create specialist notification
          await this.createFallbackNotification(
            referral.referringGeneralistId,
            'referral',
            referralId,
                    'cancelled',
        `Referral for ${referral.patientFirstName} ${referral.patientLastName} has been cancelled by specialist.`
          );
        }
        
        console.log('✅ Notifications created successfully');
        
      } catch (notificationError) {
        console.warn('⚠️ Failed to create notifications for referral status change:', notificationError);
        // Don't fail the referral update if notifications fail
      }
      
    } catch (error) {
      console.error('❌ Update referral status error:', error);
      throw error;
    }
  },

  async getReferralById(referralId: string): Promise<Referral | null> {
    try {
      const referralRef = ref(database, `referrals/${referralId}`);
      const snapshot = await get(referralRef);
      
      if (snapshot.exists()) {
        return {
          id: snapshot.key,
          ...snapshot.val()
        };
      }
      return null;
    } catch (error) {
      console.error('Get referral by ID error:', error);
      return null;
    }
  },

  async updateReferral(referralId: string, updates: Partial<Referral>): Promise<void> {
    try {
      console.log('🔔 Starting updateReferral for referral:', referralId, 'with updates:', updates);
      
      const referralRef = ref(database, `referrals/${referralId}`);
      const snapshot = await get(referralRef);
      
      if (!snapshot.exists()) {
        throw new Error('Referral not found');
      }

      const currentReferral = snapshot.val();
      console.log('📋 Current referral data:', currentReferral);
      
      const updatedData = {
        ...updates,
        lastUpdated: new Date().toISOString()
      };
      
      // Update the referral
      await update(referralRef, updatedData);
      console.log('✅ Referral updated successfully');
      
    } catch (error) {
      console.error('❌ Update referral error:', error);
      throw error;
    }
  },

  // Real-time listeners
  onAppointmentsChange(userId: string, role: 'patient' | 'specialist', callback: (appointments: Appointment[]) => void) {
    const appointmentsRef = ref(database, 'appointments');
    
    const unsubscribe = onValue(appointmentsRef, async (snapshot) => {
      if (snapshot.exists()) {
        const appointments: Appointment[] = [];
        const field = role === 'patient' ? 'patientId' : 'doctorId';
        const promises = [];
        
        snapshot.forEach((childSnapshot) => {
          const appointmentData = childSnapshot.val();
          // Filter appointments based on user role
          if (appointmentData[field] === userId) {
            // Handle both regular appointments and walk-in appointments
            const promise = this.normalizeAppointmentData(appointmentData).then(normalizedAppointment => ({
              id: childSnapshot.key,
              ...normalizedAppointment
            }));
            promises.push(promise);
          }
        });
        
        try {
          const resolvedAppointments = await Promise.all(promises);
          appointments.push(...resolvedAppointments);
          callback(appointments.sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime()));
        } catch (error) {
          console.error('Error processing appointments in real-time listener:', error);
          callback([]);
        }
      } else {
        callback([]);
      }
    });
    
    return unsubscribe;
  },

  onReferralsChange(specialistId: string, callback: (referrals: Referral[]) => void) {
    const referralsRef = ref(database, 'referrals');
    
    const unsubscribe = onValue(referralsRef, (snapshot) => {
      if (snapshot.exists()) {
        const referrals: Referral[] = [];
        
        snapshot.forEach((childSnapshot) => {
          const referralData = childSnapshot.val();
          // Filter referrals assigned to this specialist
          if (referralData.assignedSpecialistId === specialistId) {
            referrals.push({
              id: childSnapshot.key,
              ...referralData
            });
          }
        });
        
        callback(referrals.sort((a, b) => new Date(b.referralTimestamp).getTime() - new Date(a.referralTimestamp).getTime()));
      } else {
        callback([]);
      }
    });
    
    return unsubscribe;
  },



  onMedicalHistoryChange(patientId: string, callback: (medicalHistory: MedicalHistory[]) => void) {
    const medicalHistoryRef = ref(database, `patientMedicalHistory/${patientId}/entries`);
    
    const unsubscribe = onValue(medicalHistoryRef, (snapshot) => {
      if (snapshot.exists()) {
        const medicalHistory: MedicalHistory[] = [];
        
        snapshot.forEach((childSnapshot) => {
          const entry = childSnapshot.val();
          medicalHistory.push({
            id: childSnapshot.key!,
            ...entry
          });
        });
        
        callback(medicalHistory.sort((a, b) => new Date(b.consultationDate).getTime() - new Date(a.consultationDate).getTime()));
      } else {
        callback([]);
      }
    });
    
    return unsubscribe;
  },

  onPrescriptionsChange(patientId: string, callback: (prescriptions: Prescription[]) => void) {
    const prescriptionsRef = ref(database, 'prescriptions');
    
    const unsubscribe = onValue(prescriptionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const prescriptions: Prescription[] = [];
        
        snapshot.forEach((childSnapshot) => {
          const prescription = childSnapshot.val();
          if (prescription.patientId === patientId) {
            prescriptions.push({
              id: childSnapshot.key,
              ...prescription
            });
          }
        });
        
        callback(prescriptions.sort((a, b) => new Date(b.prescribedDate).getTime() - new Date(a.prescribedDate).getTime()));
      } else {
        callback([]);
      }
    });
    
    return unsubscribe;
  },

  onCertificatesChange(patientId: string, callback: (certificates: Certificate[]) => void) {
    const certificatesRef = ref(database, 'certificates');
    
    const unsubscribe = onValue(certificatesRef, (snapshot) => {
      if (snapshot.exists()) {
        const certificates: Certificate[] = [];
        
        snapshot.forEach((childSnapshot) => {
          const certificateData = childSnapshot.val();
          // Filter certificates by patientId
          if (certificateData.patientId === patientId) {
            certificates.push({
              id: childSnapshot.key,
              ...certificateData
            });
          }
        });
        
        callback(certificates.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()));
      } else {
        callback([]);
      }
    });
    
    return unsubscribe;
  },

  onNotificationsChange(userId: string, callback: (notifications: any[]) => void) {
    console.log('🔔 Setting up notifications listener for user:', userId);
    const notificationsRef = ref(database, `notifications/${userId}`);
    
    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      console.log('🔔 Notifications update received for user:', userId);
      if (snapshot.exists()) {
        const notifications: any[] = [];
        
        snapshot.forEach((childSnapshot) => {
          const notificationData = childSnapshot.val();
          notifications.push({
            id: childSnapshot.key,
            ...notificationData
          });
        });
        
        console.log('🔔 Found notifications:', notifications.length);
        const sortedNotifications = notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        callback(sortedNotifications);
      } else {
        console.log('🔔 No notifications found for user:', userId);
        callback([]);
      }
    });
    
    return unsubscribe;
  },

  // Real-time profile listeners
  onPatientProfileChange(patientId: string, callback: (profile: any) => void) {
    console.log('=== onPatientProfileChange: Setting up listeners ===');
    console.log('Patient ID:', patientId);
    
    // Listen to both patients and users nodes for comprehensive profile data
    const patientsRef = ref(database, `patients/${patientId}`);
    const usersRef = ref(database, `users/${patientId}`);
    
    let patientData: any = null;
    let userData: any = null;
    let hasCalledCallback = false;
    
    // Function to combine data and call callback
    const combineAndCallback = () => {
      console.log('=== combineAndCallback called ===');
      console.log('Current userData:', userData);
      console.log('Current patientData:', patientData);
      console.log('Has called callback before:', hasCalledCallback);
      
      if (userData || patientData) {
        const combinedProfile = {
          id: patientId,
          // User data (immutable fields)
          firstName: userData?.firstName,
          lastName: userData?.lastName,
          email: userData?.email,
          role: userData?.role,
          // Patient data (editable fields)
          contactNumber: patientData?.contactNumber,
          address: patientData?.address,
          dateOfBirth: patientData?.dateOfBirth,
          gender: patientData?.gender,
          bloodType: patientData?.bloodType,
          allergies: patientData?.allergies,
          emergencyContact: patientData?.emergencyContact,
          // Timestamps
          createdAt: userData?.createdAt || patientData?.createdAt,
          lastUpdated: userData?.lastUpdated || patientData?.lastUpdated,
        };
        
        console.log('Combined profile created:', combinedProfile);
        console.log('Address in combined profile:', combinedProfile.address);
        console.log('Contact number in combined profile:', combinedProfile.contactNumber);
        
        // Only call callback if we haven't called it before or if data has changed
        if (!hasCalledCallback || JSON.stringify(combinedProfile) !== JSON.stringify(lastCombinedProfile)) {
          console.log('Calling callback with combined profile');
          callback(combinedProfile);
          hasCalledCallback = true;
          lastCombinedProfile = JSON.stringify(combinedProfile);
        } else {
          console.log('Skipping callback - data unchanged');
        }
      } else {
        console.log('No data available yet');
        if (!hasCalledCallback) {
          callback(null);
          hasCalledCallback = true;
        }
      }
    };
    
    let lastCombinedProfile: string = '';
    
    const unsubscribePatients = onValue(patientsRef, (snapshot) => {
      console.log('=== onPatientProfileChange: Patients node update ===');
      if (snapshot.exists()) {
        patientData = snapshot.val();
        console.log('Patient data received:', patientData);
        console.log('Patient data keys:', Object.keys(patientData || {}));
      } else {
        patientData = null;
        console.log('Patients node does not exist');
      }
      combineAndCallback();
    });
    
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      console.log('=== onPatientProfileChange: Users node update ===');
      if (snapshot.exists()) {
        userData = snapshot.val();
        console.log('User data received:', userData);
        console.log('User data keys:', Object.keys(userData || {}));
        console.log('User address field:', userData?.address);
        console.log('User contactNumber field:', userData?.contactNumber);
      } else {
        userData = null;
        console.log('Users node does not exist');
      }
      combineAndCallback();
    });
    
    // Return function to unsubscribe from both listeners
    return () => {
      console.log('=== onPatientProfileChange: Cleaning up listeners ===');
      unsubscribePatients();
      unsubscribeUsers();
    };
  },

  onSpecialistProfileChange(specialistId: string, callback: (profile: any) => void) {
    // Listen to doctors node (primary) and users node (fallback)
    const doctorsRef = ref(database, `doctors/${specialistId}`);
    const usersRef = ref(database, `users/${specialistId}`);
    
    let doctorData: any = null;
    let userData: any = null;
    
    const unsubscribeDoctors = onValue(doctorsRef, (snapshot) => {
      if (snapshot.exists()) {
        doctorData = snapshot.val();
        // Combine data and call callback
        if (userData || doctorData) {
          const combinedProfile = {
            id: specialistId,
            ...userData,
            ...doctorData,
          };
          callback(combinedProfile);
        }
      } else {
        doctorData = null;
        // Still call callback with user data if available
        if (userData) {
          const combinedProfile = {
            id: specialistId,
            ...userData,
          };
          callback(combinedProfile);
        } else {
          callback(null);
        }
      }
    });
    
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Only include user data if it's a specialist
        if (data.role === 'specialist') {
          userData = data;
          // Combine data and call callback
          if (doctorData || userData) {
            const combinedProfile = {
              id: specialistId,
              ...userData,
              ...doctorData,
            };
            callback(combinedProfile);
          }
        } else {
          userData = null;
          // Still call callback with doctor data if available
          if (doctorData) {
            const combinedProfile = {
              id: specialistId,
              ...doctorData,
            };
            callback(combinedProfile);
          } else {
            callback(null);
          }
        }
      } else {
        userData = null;
        // Still call callback with doctor data if available
        if (doctorData) {
          const combinedProfile = {
            id: specialistId,
            ...doctorData,
          };
          callback(combinedProfile);
        } else {
          callback(null);
        }
      }
    });
    
    // Return function to unsubscribe from both listeners
    return () => {
      unsubscribeDoctors();
      unsubscribeUsers();
    };
  },

  // Generic document operations
  async getDocument(path: string) {
    try {
      const docRef = ref(database, path);
      const snapshot = await get(docRef);
      
      if (snapshot.exists()) {
        return { id: snapshot.key, ...snapshot.val() };
      }
      return null;
    } catch (error) {
      console.error(`Get document error (${path}):`, error);
      return null;
    }
  },

  async setDocument(path: string, data: any): Promise<void> {
    try {
      const docRef = ref(database, path);
      await set(docRef, {
        ...data,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`Set document error (${path}):`, error);
      throw error;
    }
  },

  async updateDocument(path: string, updates: any): Promise<void> {
    try {
      const docRef = ref(database, path);
      await update(docRef, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`Update document error (${path}):`, error);
      throw error;
    }
  },

  async deleteDocument(path: string): Promise<void> {
    try {
      const docRef = ref(database, path);
      await remove(docRef);
    } catch (error) {
      console.error(`Delete document error (${path}):`, error);
      throw error;
    }
  },

  async pushDocument(path: string, data: any): Promise<string> {
    try {
      const docRef = ref(database, path);
      const newRef = push(docRef);
      await set(newRef, {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return newRef.key!;
    } catch (error) {
      console.error(`Push document error (${path}):`, error);
      throw error;
    }
  },

  // Batch update notifications (more efficient)
  async markNotificationsAsRead(userId: string, notificationIds: string[]): Promise<void> {
    try {
      const updates: Record<string, any> = {};
      
      notificationIds.forEach(id => {
        updates[`notifications/${userId}/${id}/read`] = true;
        updates[`notifications/${userId}/${id}/readAt`] = Date.now();
      });

      await update(ref(database), updates);
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      throw error;
    }
  },

  // Paginated notifications with limits
  async getNotificationsPaginated(
    userId: string, 
    limit: number = 20, 
    lastTimestamp?: number
  ): Promise<Notification[]> {
    try {
      // Try indexed query first (requires .indexOn rule)
      try {
        let notificationsQuery = query(
          ref(database, `notifications/${userId}`),
          orderByChild('timestamp'),
          limitToLast(limit)
        );

        if (lastTimestamp) {
          notificationsQuery = query(
            notificationsQuery,
            endBefore(lastTimestamp)
          );
        }

        const snapshot = await get(notificationsQuery);
        
        if (snapshot.exists()) {
          const notifications = snapshot.val();
          return Object.values(notifications)
            .map((n: any) => n as Notification)
            .sort((a, b) => b.timestamp - a.timestamp);
        }
        
        return [];
      } catch (indexError) {
        // Fallback to non-indexed approach if indexing fails
        console.log('Indexed query failed, using fallback method:', indexError);
        
        const notificationsRef = ref(database, `notifications/${userId}`);
        const snapshot = await get(notificationsRef);
        
        if (!snapshot.exists()) return [];
        
        const notifications = snapshot.val();
        const notificationArray = Object.values(notifications).map((n: any) => n as Notification);
        
        // Sort by timestamp (newest first)
        const sortedNotifications = notificationArray.sort((a, b) => b.timestamp - a.timestamp);
        
        // Apply pagination manually
        if (lastTimestamp) {
          const startIndex = sortedNotifications.findIndex(n => n.timestamp < lastTimestamp);
          if (startIndex === -1) return [];
          return sortedNotifications.slice(startIndex, startIndex + limit);
        }
        
        return sortedNotifications.slice(0, limit);
      }
    } catch (error) {
      console.error('Error getting paginated notifications:', error);
      throw error;
    }
  },

  // Cleanup old notifications
  async cleanupOldNotifications(userId: string, daysOld: number = 30): Promise<void> {
    try {
      const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
      
      const notificationsRef = ref(database, `notifications/${userId}`);
      const snapshot = await get(notificationsRef);
      
      if (snapshot.exists()) {
        const notifications = snapshot.val();
        const updates: Record<string, any> = {};
        
        Object.entries(notifications).forEach(([id, notification]: [string, any]) => {
          if (notification.timestamp < cutoffTime) {
            updates[`notifications/${userId}/${id}`] = null; // Delete
          }
        });
        
        if (Object.keys(updates).length > 0) {
          await update(ref(database), updates);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
    }
  },

  // Create notification (for testing and manual creation)
  async createNotification(notification: Omit<Notification, 'id'>): Promise<string> {
    try {
      const notificationRef = ref(database, `notifications/${notification.userId}`);
      const newNotificationRef = push(notificationRef);
      
      const notificationWithId: Notification = {
        ...notification,
        id: newNotificationRef.key!,
        timestamp: notification.timestamp || Date.now(),
        read: false
      };

      await set(newNotificationRef, notificationWithId);
      return newNotificationRef.key!;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  },

  // Get notification count for badge
  async getNotificationCount(userId: string, unreadOnly: boolean = false): Promise<number> {
    try {
      const notificationsRef = ref(database, `notifications/${userId}`);
      const snapshot = await get(notificationsRef);
      
      if (!snapshot.exists()) return 0;
      
      const notifications = snapshot.val();
      
      if (unreadOnly) {
        return Object.values(notifications).filter((n: any) => !n.read).length;
      }
      
      return Object.keys(notifications).length;
    } catch (error) {
      console.error('Error getting notification count:', error);
      return 0;
    }
  },

  // Simple method to get all notifications (no pagination, no indexing required)
  async getNotifications(userId: string): Promise<Notification[]> {
    try {
      const notificationsRef = ref(database, `notifications/${userId}`);
      const snapshot = await get(notificationsRef);
      
      if (!snapshot.exists()) return [];
      
      const notifications = snapshot.val();
      const notificationArray = Object.values(notifications) as Notification[];
      
      // Sort by timestamp (newest first)
      return notificationArray.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  },

  // Test function to create sample notifications
  async createTestNotifications(userId: string): Promise<void> {
    try {
      console.log('🧪 Creating test notifications for user:', userId);
      
      // Create sample appointment notification
      const appointmentNotificationId = await this.createFallbackNotification(
        userId,
        'appointment',
        'test-appointment-1',
        'confirmed',
        'Your appointment with Dr. Smith on 2024-01-15 at 2:00 PM has been confirmed.'
      );

      // Create sample referral notification
      const referralNotificationId = await this.createFallbackNotification(
        userId,
        'referral',
        'test-referral-1',
        'confirmed',
        'Your referral to Cardiology at Heart Institute has been confirmed.'
      );

      // Create sample prescription notification
      const prescriptionNotificationId = await this.createFallbackNotification(
        userId,
        'prescription',
        'test-prescription-1',
        'active',
        'Dr. Johnson has prescribed Amoxicillin 500mg for you.'
      );

      console.log('✅ Test notifications created successfully:');
      console.log('  - Appointment:', appointmentNotificationId);
      console.log('  - Referral:', referralNotificationId);
      console.log('  - Prescription:', prescriptionNotificationId);
      
    } catch (error) {
      console.error('❌ Error creating test notifications:', error);
    }
  },

  // Simple test function to create one notification
  async createSimpleTestNotification(userId: string, message: string): Promise<string> {
    try {
      console.log('🧪 Creating simple test notification for user:', userId);
      
      const notificationId = await this.createFallbackNotification(
        userId,
        'appointment',
        'test-simple',
        'test',
        message
      );
      
      console.log('✅ Simple test notification created with ID:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('❌ Error creating simple test notification:', error);
      throw error;
    }
  },

  // Save consultation data with new structure
  async saveConsultationData(
    patientId: string, 
    appointmentId: string, 
    consultationData: Partial<MedicalHistory>
  ): Promise<string> {
    try {
      // Generate consultation data with required fields
      const medicalHistoryData = {
        ...consultationData,
        consultationDate: new Date().toISOString(),
        consultationTime: new Date().toLocaleTimeString(),
        patientId: patientId,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        updatedAt: Date.now(),
        relatedAppointment: {
          id: appointmentId,
          type: consultationData.type || 'General Consultation'
        }
      };

      // Use Firebase push to generate the consultationId
      const consultationId = await this.pushDocument(`patientMedicalHistory/${patientId}/entries`, medicalHistoryData);
      console.log('Generated consultationId using Firebase push key:', consultationId);

      // Update the appointment with the appointmentConsultationId
      await this.updateAppointment(appointmentId, {
        status: 'completed',
        appointmentConsultationId: consultationId,
      });

      console.log('Appointment updated with appointmentConsultationId:', consultationId);
      return consultationId;
    } catch (error) {
      console.error('Save consultation data error:', error);
      throw new Error('Failed to save consultation data');
    }
  },

  // Save referral consultation data with new structure
  async saveReferralConsultationData(
    patientId: string, 
    referralId: string, 
    consultationData: Partial<MedicalHistory>
  ): Promise<string> {
    try {
      console.log('🔍 saveReferralConsultationData - Input consultationData:', consultationData);
      console.log('🔍 Number of diagnoses in consultationData:', consultationData.diagnosis?.length || 0);
      console.log('🔍 Diagnoses array:', consultationData.diagnosis);
      
      // Generate consultation data with required fields
      const medicalHistoryData = {
        ...consultationData,
        consultationDate: new Date().toISOString(),
        consultationTime: new Date().toLocaleTimeString(),
        patientId: patientId,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        updatedAt: Date.now(),
        relatedReferral: {
          id: referralId,
          type: consultationData.type || 'Referral Consultation'
        }
      };
      
      console.log('🔍 medicalHistoryData to be saved:', medicalHistoryData);
      console.log('🔍 Number of diagnoses in medicalHistoryData:', medicalHistoryData.diagnosis?.length || 0);

      // Use Firebase push to generate the consultationId
      const consultationId = await this.pushDocument(`patientMedicalHistory/${patientId}/entries`, medicalHistoryData);
      console.log('Generated referral consultationId using Firebase push key:', consultationId);

      console.log('Referral consultation saved with ID:', consultationId);
      return consultationId;
    } catch (error) {
      console.error('Save referral consultation data error:', error);
      throw new Error('Failed to save referral consultation data');
    }
  },

  // Clean up temporary referral consultation data
  async cleanupTemporaryReferralData(
    patientId: string,
    referralId: string
  ): Promise<void> {
    try {
      console.log('🧹 Cleaning up temporary referral data for patient:', patientId, 'referral:', referralId);
      
      // Check if temporary data exists before trying to remove it
      const temporaryDataPath = `patientMedicalHistory/${patientId}/entries/${referralId}`;
      const temporaryData = await this.getDocument(temporaryDataPath);
      
      if (temporaryData) {
        // Remove the temporary data saved with referralId as the key
        await this.removeDocument(temporaryDataPath);
        console.log('✅ Temporary referral data cleaned up successfully');
      } else {
        console.log('ℹ️ No temporary referral data found to clean up');
      }
    } catch (error) {
      console.error('❌ Error cleaning up temporary referral data:', error);
      // Don't throw error - cleanup failure shouldn't break the main flow
    }
  },

  // Create referral with Firebase push key
  async createReferral(referralData: Partial<Referral>): Promise<string> {
    try {
      console.log('🔔 Creating referral with Firebase push key...');
      
      // Prepare referral data with required fields
      const completeReferralData = {
        ...referralData,
        referralTimestamp: new Date().toISOString(),
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        status: referralData.status || 'pending_acceptance'
      };

      // Use Firebase push to generate the referralId
      const referralId = await this.pushDocument('referrals', completeReferralData);
      console.log('✅ Referral created with Firebase push key:', referralId);
      
      return referralId;
    } catch (error) {
      console.error('❌ Create referral error:', error);
      throw new Error('Failed to create referral');
    }
  },

  // Check if feedback already exists for an appointment
  async checkFeedbackExists(appointmentId: string): Promise<boolean> {
    try {
      const feedbackSnapshot = await get(ref(database, 'feedback'));
      const feedbackData = feedbackSnapshot.val();
      
      if (feedbackData) {
        const feedbackEntries = Object.values(feedbackData);
        return feedbackEntries.some((feedback: any) => feedback.appointmentId === appointmentId);
      }
      return false;
    } catch (error) {
      console.error('Error checking feedback existence:', error);
      return false;
    }
  },

  // Submit feedback
  async submitFeedback(feedbackData: {
    appointmentId: string;
    referralId?: string;
    patientId: string;
    patientName: string;
    patientEmail: string;
    doctorId: string;
    doctorName: string;
    clinicId: string;
    clinicName: string;
    appointmentDate: string;
    serviceType: 'appointment' | 'referral';
    treatmentType: string;
    rating: number;
    comment: string;
    tags: string[];
    isAnonymous: boolean;
  }): Promise<string> {
    try {
      console.log('🔔 Submitting feedback...');
      
      // Check if feedback already exists for this appointment
      const feedbackExists = await this.checkFeedbackExists(feedbackData.appointmentId);
      if (feedbackExists) {
        throw new Error('Feedback already submitted for this appointment');
      }

      // Prepare feedback data with required fields
      const completeFeedbackData = {
        ...feedbackData,
        status: '', // blank status as requested
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Use Firebase push to generate the feedbackId
      const feedbackId = await this.pushDocument('feedback', completeFeedbackData);
      console.log('✅ Feedback submitted with ID:', feedbackId);
      
      return feedbackId;
    } catch (error) {
      console.error('❌ Submit feedback error:', error);
      throw error;
    }
  },

  // Get feedback by appointment ID
  async getFeedbackByAppointmentId(appointmentId: string): Promise<any> {
    try {
      const feedbackSnapshot = await get(ref(database, 'feedback'));
      const feedbackData = feedbackSnapshot.val();
      
      if (feedbackData) {
        const feedbackEntries = Object.values(feedbackData);
        return feedbackEntries.find((feedback: any) => feedback.appointmentId === appointmentId);
      }
      return null;
    } catch (error) {
      console.error('Error getting feedback by appointment ID:', error);
      return null;
    }
  },

  // Get all feedback (for admin/specialist view)
  async getAllFeedback(): Promise<any[]> {
    try {
      const feedbackSnapshot = await get(ref(database, 'feedback'));
      const feedbackData = feedbackSnapshot.val();
      
      if (feedbackData) {
        return Object.values(feedbackData);
      }
      return [];
    } catch (error) {
      console.error('Error getting all feedback:', error);
      return [];
    }
  },
};  