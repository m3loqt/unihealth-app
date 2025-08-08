import { 
  ref, 
  get, 
  set, 
  push, 
  update, 
  remove, 
  query, 
  onValue,
  off
} from 'firebase/database';
import { database } from '@/config/firebase';

export interface Appointment {
  id?: string;
  appointmentDate: string;
  appointmentTime: string;
  bookedByUserFirstName: string;
  bookedByUserId: string;
  bookedByUserLastName: string;
  clinicId: string;
  clinicName: string;
  createdAt: string;
  doctorFirstName: string;
  doctorId: string;
  doctorLastName: string;
  lastUpdated: string;
  notes?: string;
  patientComplaint?: string[];
  patientFirstName: string;
  patientId: string;
  patientLastName: string;
  relatedReferralId?: string;
  consultationId?: string;
  appointmentConsultationId?: string;
  sourceSystem: string;
  specialty: string;
  status: 'pending' | 'confirmed' | 'completed' | 'canceled';
  type: string;
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
  followUpInstructions?: string;
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
  }>;
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
  treatmentPlan?: string;
  type: string;
  labResultsSummary?: Array<{
    test: string;
    value: string;
    notes?: string;
  }>;
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
  refills?: number;
  remainingRefills?: number;
}

export interface Certificate {
  id?: string;
  patientId: string;
  specialistId: string;
  type: string;
  issueDate: string;
  expiryDate?: string;
  status: 'active' | 'expired';
  description: string;
  fileUrl?: string;
}

export interface Patient {
  id?: string;
  patientFirstName?: string;
  patientLastName?: string;
  referredFrom?: string;
  status?: string;
  lastVisit?: string;
  createdAt?: string;
  specialty?: string;
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
  status: 'pending_acceptance' | 'accepted' | 'declined' | 'completed';
  declineReason?: string;
  specialistNotes?: string;
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
        
        snapshot.forEach((childSnapshot) => {
          const appointmentData = childSnapshot.val();
          // Filter appointments based on user role
          if (appointmentData[field] === userId) {
            appointments.push({
              id: childSnapshot.key,
              ...appointmentData
            });
          }
        });
        
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
              doctorData.isGeneralist === true) {
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

  // Helper method to generate 1-hour time slots from start time to end time
  generateTimeSlots(startTime: string, endTime: string): string[] {
    const slots: string[] = [];
    
    console.log(`Generating time slots from ${startTime} to ${endTime}`);
    
    // Parse start and end times (assuming format "HH:MM" or "HH:MM:SS")
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    
    console.log('Parsed start time:', start);
    console.log('Parsed end time:', end);
    
    // Generate 1-hour slots
    let current = new Date(start);
    while (current < end) {
      const timeString = current.toTimeString().slice(0, 5); // Format as "HH:MM"
      slots.push(timeString);
      console.log(`Added slot: ${timeString}`);
      
      // Add 1 hour
      current.setHours(current.getHours() + 1);
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
        // Generate 1-hour slots for each time slot range
        specificDate.timeSlots.forEach(slot => {
          const slots = this.generateTimeSlots(slot.startTime, slot.endTime);
          console.log(`Generated slots for ${slot.startTime}-${slot.endTime}:`, slots);
          availableSlots.push(...slots);
        });
      } else if (weeklySchedule?.enabled && weeklySchedule?.timeSlots) {
        console.log('Using weekly schedule time slots:', weeklySchedule.timeSlots);
        // Generate 1-hour slots for each time slot range
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
      const appointmentsRef = ref(database, 'appointments');
      const snapshot = await get(appointmentsRef);
      
      if (snapshot.exists()) {
        const bookedSlots: string[] = [];
        snapshot.forEach((childSnapshot) => {
          const appointmentData = childSnapshot.val();
          // Check if appointment is for the same doctor and date
          if (appointmentData.doctor === doctorId && appointmentData.appointmentDate === date) {
            bookedSlots.push(appointmentData.appointmentTime);
          }
        });
        return bookedSlots;
      }
      return [];
    } catch (error) {
      console.error('Get booked time slots error:', error);
      return [];
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
      const appointmentsRef = ref(database, 'appointments');
      const newAppointmentRef = push(appointmentsRef);
      
      const appointmentData = {
        ...appointment,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
      
      await set(newAppointmentRef, appointmentData);
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
        return {
          id: snapshot.key,
          ...snapshot.val()
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
      const prescriptionsRef = ref(database, 'prescriptions');
      const snapshot = await get(prescriptionsRef);
      
      if (snapshot.exists()) {
        const prescriptions: Prescription[] = [];
        snapshot.forEach((childSnapshot) => {
          const prescription = childSnapshot.val();
          // Filter client-side by patientId
          if (prescription.patientId === userId) {
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
      // Suppress Firebase indexing errors
      if (error instanceof Error && error.message.includes('indexOn')) {
        console.log('Firebase indexing not configured, using client-side filtering');
      } else {
        console.error('Get prescriptions error:', error);
      }
      return [];
    }
  },

  async createPrescription(prescription: Omit<Prescription, 'id'>): Promise<string> {
    try {
      const prescriptionsRef = ref(database, 'prescriptions');
      const newPrescriptionRef = push(prescriptionsRef);
      
      const prescriptionData = {
        ...prescription,
        prescribedDate: new Date().toISOString(),
      };
      
      await set(newPrescriptionRef, prescriptionData);
      return newPrescriptionRef.key!;
    } catch (error) {
      console.error('Create prescription error:', error);
      throw error;
    }
  },

  // Specialist-specific methods
  async getPatientsBySpecialist(specialistId: string): Promise<any[]> {
    try {
      const appointmentsRef = ref(database, 'appointments');
      const snapshot = await get(appointmentsRef);
      
      if (snapshot.exists()) {
        const patients = new Map();
        snapshot.forEach((childSnapshot) => {
          const appointment = childSnapshot.val();
          if (appointment.doctorId === specialistId) {
            const patientKey = appointment.patientId;
            if (!patients.has(patientKey)) {
              patients.set(patientKey, {
                id: patientKey,
                patientFirstName: appointment.patientFirstName,
                patientLastName: appointment.patientLastName,
                referredFrom: appointment.specialty,
                status: appointment.status,
                lastVisit: appointment.appointmentDate,
                createdAt: appointment.createdAt,
              });
            }
          }
        });
        return Array.from(patients.values());
      }
      return [];
    } catch (error) {
      console.error('Get patients by specialist error:', error);
      return [];
    }
  },

  async getAppointmentsBySpecialist(specialistId: string): Promise<Appointment[]> {
    try {
      const appointmentsRef = ref(database, 'appointments');
      const snapshot = await get(appointmentsRef);
      
      if (snapshot.exists()) {
        const appointments: Appointment[] = [];
        snapshot.forEach((childSnapshot) => {
          const appointment = childSnapshot.val();
          if (appointment.doctorId === specialistId) {
            appointments.push({
              id: childSnapshot.key,
              ...appointment
            });
          }
        });
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
        snapshot.forEach((childSnapshot) => {
          const appointment = childSnapshot.val();
          if (appointment.doctorId === specialistId && appointment.status === status) {
            appointments.push({
              id: childSnapshot.key,
              ...appointment
            });
          }
        });
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
                    frequency: prescription.frequency,
                    duration: 'Ongoing',
                    instructions: 'As prescribed',
                    prescribedDate: entry.consultationDate,
                    status: 'active',
                    remainingRefills: 3, // Default value
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
      // First try doctors node (where specialist data is stored)
      const specialistRef = ref(database, `doctors/${specialistId}`);
      const specialistSnapshot = await get(specialistRef);
      if (specialistSnapshot.exists()) {
        return specialistSnapshot.val();
      }
      
      // Fallback: try users node for backward compatibility
      const userRef = ref(database, `users/${specialistId}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        // Check if this user is a specialist
        if (userData.role === 'specialist') {
          return userData;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Get specialist profile error:', error);
      return null;
    }
  },

  async getPatientProfile(patientId: string): Promise<any> {
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
      const appointmentsSnapshot = await get(appointmentsRef);
      
      if (appointmentsSnapshot.exists()) {
        let patientData = null;
        appointmentsSnapshot.forEach((childSnapshot) => {
          const appointment = childSnapshot.val();
          if (appointment.patientId === patientId && !patientData) {
            patientData = {
              id: patientId,
              firstName: appointment.patientFirstName,
              lastName: appointment.patientLastName,
              email: appointment.bookedByUserId, // Using bookedByUserId as email
            };
          }
        });
        return patientData;
      }
      
      return null;
    } catch (error) {
      console.error('Get patient profile error:', error);
      return null;
    }
  },

  async updatePatientProfile(patientId: string, updates: any): Promise<void> {
    try {
      // Try to update in patients node first
      const patientRef = ref(database, `patients/${patientId}`);
      const patientSnapshot = await get(patientRef);
      if (patientSnapshot.exists()) {
        await update(patientRef, {
          ...updates,
          lastUpdated: new Date().toISOString(),
        });
        return;
      }
      
      // If not found in patients, try users node
      const userRef = ref(database, `users/${patientId}`);
      const userSnapshot = await get(userRef);
      if (userSnapshot.exists()) {
        await update(userRef, {
          ...updates,
          lastUpdated: new Date().toISOString(),
        });
        return;
      }
      
      throw new Error('Patient not found in database');
    } catch (error) {
      console.error('Update patient profile error:', error);
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
              firstName: appointment.patientFirstName,
              lastName: appointment.patientLastName,
              email: appointment.bookedByUserId, // Using bookedByUserId as email
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
        snapshot.forEach((childSnapshot) => {
          const appointment = childSnapshot.val();
          if (appointment.patientId === patientId) {
            appointments.push({
              id: childSnapshot.key,
              ...appointment
            });
          }
        });
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
      const appointmentRef = ref(database, `appointments/${id}`);
      const updates: any = { status, lastUpdated: new Date().toISOString() };
      if (reason) {
        updates.declineReason = reason;
      }
      await update(appointmentRef, updates);
    } catch (error) {
      console.error('Update appointment status error:', error);
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
      const medicalHistoryRef = ref(database, `patientMedicalHistory/${patientId}/entries`);
      const snapshot = await get(medicalHistoryRef);
      
      if (snapshot.exists()) {
        let foundEntry: MedicalHistory | null = null;
        
        snapshot.forEach((childSnapshot) => {
          const entry = childSnapshot.val();
          // Check if this entry is related to the specific appointment
          if (entry.relatedAppointment && entry.relatedAppointment.id === appointmentId) {
            foundEntry = {
              id: childSnapshot.key!,
              ...entry
            };
          }
        });
        
        return foundEntry;
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

  async updateReferralStatus(referralId: string, status: 'accepted' | 'declined', declineReason?: string, specialistNotes?: string): Promise<void> {
    try {
      const referralRef = ref(database, `referrals/${referralId}`);
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
      
      await update(referralRef, updates);
    } catch (error) {
      console.error('Update referral status error:', error);
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

  // Real-time listeners
  onAppointmentsChange(userId: string, role: 'patient' | 'specialist', callback: (appointments: Appointment[]) => void) {
    const appointmentsRef = ref(database, 'appointments');
    
    const unsubscribe = onValue(appointmentsRef, (snapshot) => {
      if (snapshot.exists()) {
        const appointments: Appointment[] = [];
        const field = role === 'patient' ? 'patientId' : 'doctorId';
        
        snapshot.forEach((childSnapshot) => {
          const appointmentData = childSnapshot.val();
          // Filter appointments based on user role
          if (appointmentData[field] === userId) {
            appointments.push({
              id: childSnapshot.key,
              ...appointmentData
            });
          }
        });
        
        callback(appointments.sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime()));
      } else {
        callback([]);
      }
    });
    
    return unsubscribe;
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
  }
};  