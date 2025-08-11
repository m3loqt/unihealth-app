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

  async updatePrescription(id: string, updates: Partial<Prescription>): Promise<void> {
    try {
      const prescriptionRef = ref(database, `prescriptions/${id}`);
      await update(prescriptionRef, {
        ...updates,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Update prescription error:', error);
      throw error;
    }
  },

  async deletePrescription(id: string): Promise<void> {
    try {
      const prescriptionRef = ref(database, `prescriptions/${id}`);
      await remove(prescriptionRef);
    } catch (error) {
      console.error('Delete prescription error:', error);
      throw error;
    }
  },

  // Specialist-specific methods
  async getPatientsBySpecialist(specialistId: string): Promise<Patient[]> {
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
      console.log('=== updatePatientProfile: Starting update ===');
      console.log('Patient ID:', patientId);
      console.log('Updates received:', updates);
      console.log('Address in updates:', updates.address);
      console.log('Contact number in updates:', updates.contactNumber);
      
      // Separate updates for different nodes
      const userUpdates: any = {};
      const patientUpdates: any = {};
      
      // Fields that go to users node
      if (updates.contactNumber !== undefined) userUpdates.contactNumber = updates.contactNumber;
      if (updates.address !== undefined) userUpdates.address = updates.address;
      if (updates.name !== undefined) userUpdates.name = updates.name;
      if (updates.email !== undefined) userUpdates.email = updates.email;
      if (updates.lastUpdated !== undefined) userUpdates.lastUpdated = updates.lastUpdated;
      
      // Fields that go to patients node
      if (updates.emergencyContact !== undefined) patientUpdates.emergencyContact = updates.emergencyContact;
      if (updates.lastUpdated !== undefined) patientUpdates.lastUpdated = updates.lastUpdated;
      
      console.log('User updates to be applied:', userUpdates);
      console.log('Patient updates to be applied:', patientUpdates);
      console.log('Address will be written to users node:', userUpdates.address);
      
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
      
      // Fields that go to users node
      if (updates.firstName !== undefined) userUpdates.firstName = updates.firstName;
      if (updates.lastName !== undefined) userUpdates.lastName = updates.lastName;
      if (updates.email !== undefined) userUpdates.email = updates.email;
      if (updates.contactNumber !== undefined) userUpdates.contactNumber = updates.contactNumber;
      if (updates.address !== undefined) userUpdates.address = updates.address;
      if (updates.lastUpdated !== undefined) userUpdates.lastUpdated = updates.lastUpdated;
      
      // Fields that go to doctors node
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
            doctorName: `${appointment.doctorFirstName} ${appointment.doctorLastName}`,
            clinicName: appointment.clinicName
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
            patientName: `${appointment.patientFirstName} ${appointment.patientLastName}`,
            clinicName: appointment.clinicName
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
        
        if (status === 'accepted') {
          // Create patient notification
          await this.createFallbackNotification(
            referral.patientId,
            'referral',
            referralId,
            'accepted',
            `Your referral to ${referral.practiceLocation.roomOrUnit || 'Specialist'} at ${referral.referringClinicName} has been accepted.`
          );
          
          // Create specialist notification
          await this.createFallbackNotification(
            referral.assignedSpecialistId,
            'referral',
            referralId,
            'accepted',
            `You have accepted a referral for ${referral.patientFirstName} ${referral.patientLastName}.`
          );
        } else if (status === 'declined') {
          // Create patient notification
          await this.createFallbackNotification(
            referral.patientId,
            'referral',
            referralId,
            'declined',
            `Your referral to ${referral.practiceLocation.roomOrUnit || 'Specialist'} at ${referral.referringClinicName} has been declined.`
          );
          
          // Create specialist notification
          await this.createFallbackNotification(
            referral.referringGeneralistId,
            'referral',
            referralId,
            'declined',
            `Referral for ${referral.patientFirstName} ${referral.patientLastName} has been declined by specialist.`
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

  onPrescriptionsChange(patientId: string, callback: (prescriptions: Prescription[]) => void) {
    const prescriptionsRef = ref(database, 'prescriptions');
    
    const unsubscribe = onValue(prescriptionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const prescriptions: Prescription[] = [];
        
        snapshot.forEach((childSnapshot) => {
          const prescriptionData = childSnapshot.val();
          // Filter prescriptions by patientId
          if (prescriptionData.patientId === patientId) {
            prescriptions.push({
              id: childSnapshot.key,
              ...prescriptionData
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
          // User data (basic info like name, email, contact, address)
          firstName: userData?.firstName,
          lastName: userData?.lastName,
          email: userData?.email,
          contactNumber: userData?.contactNumber,
          address: userData?.address,
          role: userData?.role,
          // Patient data (medical-specific info)
          dateOfBirth: patientData?.dateOfBirth,
          gender: patientData?.gender,
          bloodType: patientData?.bloodType,
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
            .sort((a: any, b: any) => b.timestamp - a.timestamp);
        }
        
        return [];
      } catch (indexError) {
        // Fallback to non-indexed approach if indexing fails
        console.log('Indexed query failed, using fallback method:', indexError);
        
        const notificationsRef = ref(database, `notifications/${userId}`);
        const snapshot = await get(notificationsRef);
        
        if (!snapshot.exists()) return [];
        
        const notifications = snapshot.val();
        const notificationArray = Object.values(notifications) as Notification[];
        
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
        'accepted',
        'Your referral to Cardiology at Heart Institute has been accepted.'
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
  }
};  