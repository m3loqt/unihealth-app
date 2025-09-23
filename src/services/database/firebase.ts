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
import { getCurrentLocalTimestamp } from '../../utils/date';

// Standardized data type definitions for immutable vs mutable data separation
export interface ImmutableUserData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'patient' | 'specialist';
  createdAt: string;
  middleName?: string;
  profileImage?: string;
}

export interface MutablePatientData {
  contactNumber?: string;
  address?: string;
  bloodType?: string;
  allergies?: string[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  medicalConditions?: string[];
  lastUpdated: string;
  dateOfBirth?: string;
  gender?: string;
}

export interface MutableSpecialistData {
  contactNumber?: string;
  address?: string;
  specialty?: string;
  yearsOfExperience?: number;
  medicalLicenseNumber?: string;
  professionalFee?: number;
  prcId?: string;
  prcExpiryDate?: string;
  gender?: string;
  dateOfBirth?: string;
  civilStatus?: string;
  lastUpdated: string;
}

export interface StandardizedPatientData extends ImmutableUserData, MutablePatientData {
  fullName: string;
  status?: string;
  lastVisit?: string;
  isScheduledVisit?: boolean;
}

export interface StandardizedSpecialistData extends ImmutableUserData, MutableSpecialistData {
  fullName: string;
}

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
  // Follow-up tracking fields
  isFollowUp?: boolean;
  originalAppointmentId?: string;
  isReferralFollowUp?: boolean;
  // Original referring generalist information for follow-ups
  originalReferringGeneralistFirstName?: string;
  originalReferringGeneralistLastName?: string;
  originalReferringGeneralistId?: string;
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
  certificates?: Array<{
    id: string;
    type: string;
    examinationDate: string;
    fitnessStatement?: string;
    workRestrictions?: string;
    nextReviewDate?: string;
    unfitPeriodStart?: string;
    unfitPeriodEnd?: string;
    medicalAdvice?: string;
    reasonForUnfitness?: string;
    followUpDate?: string;
    travelFitnessStatement?: string;
    travelMode?: string;
    destination?: string;
    travelDate?: string;
    specialConditions?: string;
    validityPeriod?: string;
    description: string;
    validUntil: string;
    restrictions: string;
    createdAt: string;
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
  consultationId?: string; // Add consultation ID for routing
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

// Enhanced patient interface that extends the standardized data
export interface EnhancedPatient extends StandardizedPatientData {
  // Additional fields specific to patient lists and overviews
  patientFirstName: string;
  patientLastName: string;
  phoneNumber: string;
  status: string;
  lastVisit: string;
  isScheduledVisit: boolean;
}

// Interface for patient profile data (used in profile screens)
export interface PatientProfileData extends StandardizedPatientData {
  // Profile-specific computed fields
  fullName: string;
  displayName: string;
  age?: number;
  formattedDateOfBirth?: string;
}

// Interface for specialist profile data (used in profile screens)
export interface SpecialistProfileData extends StandardizedSpecialistData {
  // Profile-specific computed fields
  fullName: string;
  displayName: string;
  age?: number;
  formattedDateOfBirth?: string;
  formattedYearsOfExperience?: string;
}

// Utility functions for data transformation and validation
export const DataTransformationUtils = {
  // Transform standardized patient data to enhanced patient format
  toEnhancedPatient: (data: StandardizedPatientData, additionalFields: {
    status?: string;
    lastVisit?: string;
    isScheduledVisit?: boolean;
  } = {}): EnhancedPatient => ({
    ...data,
    patientFirstName: data.firstName,
    patientLastName: data.lastName,
    phoneNumber: data.contactNumber || '',
    status: additionalFields.status || 'confirmed',
    lastVisit: additionalFields.lastVisit || 'No visits yet',
    isScheduledVisit: additionalFields.isScheduledVisit || false,
  }),

  // Transform standardized patient data to profile format
  toPatientProfile: (data: StandardizedPatientData): PatientProfileData => {
    const age = data.dateOfBirth ? 
      Math.floor((Date.now() - new Date(data.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 
      undefined;
    
    return {
      ...data,
      displayName: data.fullName,
      age,
      formattedDateOfBirth: data.dateOfBirth ? 
        new Date(data.dateOfBirth).toLocaleDateString() : 
        undefined,
    };
  },

  // Transform standardized specialist data to profile format
  toSpecialistProfile: (data: StandardizedSpecialistData): SpecialistProfileData => {
    const age = data.dateOfBirth ? 
      Math.floor((Date.now() - new Date(data.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 
      undefined;
    
    return {
      ...data,
      displayName: data.fullName,
      age,
      formattedDateOfBirth: data.dateOfBirth ? 
        new Date(data.dateOfBirth).toLocaleDateString() : 
        undefined,
      formattedYearsOfExperience: data.yearsOfExperience ? 
        `${data.yearsOfExperience} year${data.yearsOfExperience !== 1 ? 's' : ''} of experience` : 
        undefined,
    };
  },

  // Validate if data contains required immutable fields
  validateImmutableData: (data: any): boolean => {
    return !!(data?.id && data?.firstName && data?.lastName && data?.email);
  },

  // Validate if data contains required mutable fields
  validateMutablePatientData: (data: any): boolean => {
    return !!(data?.lastUpdated);
  },

  // Validate if data contains required mutable specialist fields
  validateMutableSpecialistData: (data: any): boolean => {
    return !!(data?.lastUpdated);
  },
};

export interface Clinic {
  id: string;
  name: string;
  address: string;
  addressLine?: string; // Alternative address field
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
  hasSpecialistDoctors?: boolean; // Added to indicate if clinic has specialist doctors
}

export interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  specialty: string;
  contactNumber: string;
  clinicAffiliations: string[];
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

export interface Referral {
  id?: string;
  appointmentDate: string;
  appointmentTime: string;
  assignedSpecialistFirstName: string;
  assignedSpecialistId: string;
  assignedSpecialistLastName: string;
  assignedSpecialistMiddleName?: string;
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
  // Specialist referral fields
  referringSpecialistId?: string;
  referringSpecialistFirstName?: string;
  referringSpecialistLastName?: string;
  referringSpecialistMiddleName?: string;
  scheduleSlotPath: string;
  sourceSystem: string;
  specialistScheduleId: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  declineReason?: string;
  specialistNotes?: string;
}


export const databaseService = {
  // Appointments
  async getAppointments(userId: string, role: 'patient' | 'specialist'): Promise<Appointment[]> {
    try {
      console.log(`🔍 getAppointments called for user: ${userId}, role: ${role}`);
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
        console.log(`🔍 Found ${resolvedAppointments.length} regular appointments`);
        
        // Also fetch specialist-to-specialist referrals for both patients and specialists
        const specialistReferrals = await this.getSpecialistReferralsForUser(userId, role);
        
        // Filter out specialist referrals that already have corresponding regular appointments
        const filteredSpecialistReferrals = specialistReferrals.filter(specialistReferral => {
          // Check if there's already a regular appointment with this referralId
          const hasCorrespondingAppointment = resolvedAppointments.some(appointment => 
            appointment.relatedReferralId === specialistReferral.id
          );
          return !hasCorrespondingAppointment;
        });
        
        appointments.push(...filteredSpecialistReferrals);
        console.log(`🔍 Total appointments (including filtered referrals): ${appointments.length}`);
        
        return appointments.sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime());
      }
      console.log('🔍 No appointments found in database');
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

  // Helper method to get specialist-to-specialist referrals for a user
  async getSpecialistReferralsForUser(userId: string, role: 'patient' | 'specialist'): Promise<Appointment[]> {
    try {
      console.log(`🔍 Fetching specialist referrals for user: ${userId}, role: ${role}`);
      const referralsRef = ref(database, 'referrals');
      const snapshot = await get(referralsRef);
      
      if (!snapshot.exists()) {
        console.log('🔍 No referrals found in database');
        return [];
      }

      const specialistReferrals: Appointment[] = [];
      const promises = [];
      let totalReferrals = 0;
      let relevantReferrals = 0;

      snapshot.forEach((childSnapshot) => {
        const referralData = childSnapshot.val();
        totalReferrals++;
        
        // Check if this is a specialist-to-specialist referral relevant to the user
        const isRelevantToUser = role === 'patient' 
          ? referralData.patientId === userId
          : referralData.assignedSpecialistId === userId;

        console.log(`🔍 Referral ${childSnapshot.key}: patientId=${referralData.patientId}, assignedSpecialistId=${referralData.assignedSpecialistId}, isRelevant=${isRelevantToUser}`);

        if (isRelevantToUser) {
          relevantReferrals++;
          const promise = this.convertSpecialistReferralToAppointment(referralData, childSnapshot.key).then(appointment => {
            if (appointment) {
              specialistReferrals.push(appointment);
              console.log(`✅ Converted specialist referral to appointment: ${appointment.id}`);
            } else {
              console.log(`❌ Failed to convert specialist referral to appointment: ${childSnapshot.key}`);
            }
          });
          promises.push(promise);
        }
      });

      console.log(`🔍 Found ${totalReferrals} total referrals, ${relevantReferrals} relevant to user`);
      await Promise.all(promises);
      console.log(`🔍 Returning ${specialistReferrals.length} specialist referrals`);
      return specialistReferrals;
    } catch (error) {
      console.error('Get specialist referrals for user error:', error);
      return [];
    }
  },

  // Helper method to convert specialist referral data to appointment format
  async convertSpecialistReferralToAppointment(referralData: any, referralId: string): Promise<Appointment | null> {
    try {
      console.log(`🔍 Converting specialist referral ${referralId} to appointment format`);
      console.log(`🔍 Referral data:`, referralData);
      
      // Enrich referral data with information from users, patients, doctors, and clinics nodes
      const enrichedData = await this.enrichSpecialistReferralData(referralData);
      
      if (!enrichedData) {
        console.log(`❌ Failed to enrich referral data for ${referralId}`);
        return null;
      }

      const appointment = {
        id: referralId,
        appointmentDate: referralData.appointmentDate,
        appointmentTime: referralData.appointmentTime,
        patientId: referralData.patientId,
        patientFirstName: enrichedData.patientFirstName,
        patientLastName: enrichedData.patientLastName,
        patientMiddleName: enrichedData.patientMiddleName,
        doctorId: referralData.assignedSpecialistId,
        doctorFirstName: enrichedData.assignedSpecialistFirstName,
        doctorLastName: enrichedData.assignedSpecialistLastName,
        doctorMiddleName: enrichedData.assignedSpecialistMiddleName,
        doctorSpecialty: enrichedData.assignedSpecialistSpecialty,
        clinicId: referralData.practiceLocation?.clinicId,
        clinicName: enrichedData.clinicName,
        status: referralData.status,
        type: 'specialist_referral',
        notes: referralData.additionalNotes,
        appointmentPurpose: referralData.additionalNotes || 'Specialist Referral',
        relatedReferralId: referralId,
        sourceSystem: referralData.sourceSystem,
        lastUpdated: referralData.lastUpdated,
        createdAt: referralData.referralTimestamp,
        referringSpecialistId: referralData.referringSpecialistId,
        referringSpecialistFirstName: enrichedData.referringSpecialistFirstName,
        referringSpecialistLastName: enrichedData.referringSpecialistLastName,
        referringSpecialistMiddleName: enrichedData.referringSpecialistMiddleName,
        referringClinicId: referralData.referringClinicId,
        referringClinicName: enrichedData.referringClinicName,
        practiceLocation: referralData.practiceLocation
      } as Appointment;
      
      console.log(`✅ Successfully converted referral ${referralId} to appointment:`, appointment);
      return appointment;
    } catch (error) {
      console.error('Error converting specialist referral to appointment:', error);
      return null;
    }
  },

  // Helper method to enrich specialist referral data with information from other nodes
  async enrichSpecialistReferralData(referralData: any): Promise<any> {
    try {
      console.log(`🔍 Enriching referral data for patient: ${referralData.patientId}, specialist: ${referralData.assignedSpecialistId}`);
      const enriched = { ...referralData };

      // Fetch patient data from users node
      if (referralData.patientId) {
        const userData = await this.getDocument(`users/${referralData.patientId}`);
        if (userData) {
          enriched.patientFirstName = userData.firstName || userData.first_name;
          enriched.patientLastName = userData.lastName || userData.last_name;
          enriched.patientMiddleName = userData.middleName || userData.middle_name;
          console.log(`✅ Enriched patient data from users node: ${userData.firstName} ${userData.lastName}`);
        } else {
          console.log(`❌ No patient data found for ID: ${referralData.patientId}`);
        }
      }

      // Fetch assigned specialist data from users and doctors nodes
      if (referralData.assignedSpecialistId) {
        console.log(`🔍 Fetching specialist data for ID: ${referralData.assignedSpecialistId}`);
        const [userData, doctorData] = await Promise.all([
          this.getDocument(`users/${referralData.assignedSpecialistId}`),
          this.getDocument(`doctors/${referralData.assignedSpecialistId}`)
        ]);
        
        console.log(`🔍 User data for specialist ${referralData.assignedSpecialistId}:`, userData);
        console.log(`🔍 Doctor data for specialist ${referralData.assignedSpecialistId}:`, doctorData);
        
        if (userData) {
          enriched.assignedSpecialistFirstName = userData.firstName || userData.first_name;
          enriched.assignedSpecialistLastName = userData.lastName || userData.last_name;
          enriched.assignedSpecialistMiddleName = userData.middleName || userData.middle_name;
          console.log(`✅ Enriched specialist name from users node: ${userData.firstName} ${userData.lastName}`);
        } else {
          console.log(`❌ No user data found for specialist ID: ${referralData.assignedSpecialistId}`);
        }
        
        if (doctorData) {
          enriched.assignedSpecialistSpecialty = doctorData.specialty;
          console.log(`✅ Enriched specialist specialty from doctors node: ${doctorData.specialty}`);
        } else {
          console.log(`❌ No doctor data found for specialist ID: ${referralData.assignedSpecialistId}`);
        }
        
        if (!userData && !doctorData) {
          console.log(`❌ No specialist data found for ID: ${referralData.assignedSpecialistId}`);
        }
      }

      // Fetch referring generalist data from users node (for generalist-to-specialist referrals)
      if (referralData.referringGeneralistId) {
        const referringGeneralistData = await this.getDocument(`users/${referralData.referringGeneralistId}`);
        if (referringGeneralistData) {
          enriched.referringGeneralistFirstName = referringGeneralistData.firstName || referringGeneralistData.first_name;
          enriched.referringGeneralistLastName = referringGeneralistData.lastName || referringGeneralistData.last_name;
          enriched.referringGeneralistMiddleName = referringGeneralistData.middleName || referringGeneralistData.middle_name;
          console.log(`✅ Enriched referring generalist data from users node: ${referringGeneralistData.firstName} ${referringGeneralistData.lastName}`);
        } else {
          console.log(`❌ No referring generalist data found for ID: ${referralData.referringGeneralistId}`);
        }
      }

      // Fetch referring specialist data from users node (for specialist-to-specialist referrals)
      if (referralData.referringSpecialistId) {
        const referringUserData = await this.getDocument(`users/${referralData.referringSpecialistId}`);
        if (referringUserData) {
          enriched.referringSpecialistFirstName = referringUserData.firstName || referringUserData.first_name;
          enriched.referringSpecialistLastName = referringUserData.lastName || referringUserData.last_name;
          enriched.referringSpecialistMiddleName = referringUserData.middleName || referringUserData.middle_name;
          console.log(`✅ Enriched referring specialist data from users node: ${referringUserData.firstName} ${referringUserData.lastName}`);
        } else {
          console.log(`❌ No referring specialist data found for ID: ${referralData.referringSpecialistId}`);
        }
      }

      // Fetch clinic data from clinics node
      if (referralData.practiceLocation?.clinicId) {
        const clinicData = await this.getClinicById(referralData.practiceLocation.clinicId);
        if (clinicData) {
          enriched.clinicName = clinicData.name;
          console.log(`✅ Enriched clinic data: ${clinicData.name}`);
        } else {
          console.log(`❌ No clinic data found for ID: ${referralData.practiceLocation.clinicId}`);
        }
      }

      // Fetch referring clinic data from clinics node
      if (referralData.referringClinicId) {
        const referringClinicData = await this.getClinicById(referralData.referringClinicId);
        if (referringClinicData) {
          enriched.referringClinicName = referringClinicData.name;
          console.log(`✅ Enriched referring clinic data: ${referringClinicData.name}`);
        } else {
          console.log(`❌ No referring clinic data found for ID: ${referralData.referringClinicId}`);
        }
      }

      return enriched;
    } catch (error) {
      console.error('Error enriching specialist referral data:', error);
      return referralData;
    }
  },

  // Test function to debug specialist referrals
  async testSpecialistReferralsForPatient(patientId: string): Promise<void> {
    console.log(`🧪 Testing specialist referrals for patient: ${patientId}`);
    
    try {
      // Test direct referrals query first to see raw data
      const referralsRef = ref(database, 'referrals');
      const snapshot = await get(referralsRef);
      console.log(`🧪 Direct referrals query found ${snapshot.size} total referrals`);
      
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const referralData = childSnapshot.val();
          if (referralData.patientId === patientId) {
            console.log(`🧪 FOUND REFERRAL FOR PATIENT ${patientId}:`, {
              id: childSnapshot.key,
              patientId: referralData.patientId,
              assignedSpecialistId: referralData.assignedSpecialistId,
              referringSpecialistId: referralData.referringSpecialistId,
              referringGeneralistId: referralData.referringGeneralistId,
              status: referralData.status,
              appointmentDate: referralData.appointmentDate,
              additionalNotes: referralData.additionalNotes,
              practiceLocation: referralData.practiceLocation,
              referringClinicId: referralData.referringClinicId
            });
          }
        });
      }

      // Test the specialist referrals function directly
      const specialistReferrals = await this.getSpecialistReferralsForUser(patientId, 'patient');
      console.log(`🧪 getSpecialistReferralsForUser returned ${specialistReferrals.length} specialist referrals`);
      specialistReferrals.forEach((ref, index) => {
        console.log(`🧪 Specialist Referral ${index + 1}:`, {
          id: ref.id,
          type: ref.type,
          patientId: ref.patientId,
          doctorId: ref.doctorId,
          doctorFirstName: ref.doctorFirstName,
          doctorLastName: ref.doctorLastName,
          doctorSpecialty: ref.doctorSpecialty,
          referringSpecialistId: ref.referringSpecialistId,
          referringSpecialistFirstName: ref.referringSpecialistFirstName,
          referringSpecialistLastName: ref.referringSpecialistLastName,
          status: ref.status,
          appointmentDate: ref.appointmentDate
        });
      });

      // Test the main getAppointments function
      const appointments = await this.getAppointments(patientId, 'patient');
      console.log(`🧪 getAppointments returned ${appointments.length} appointments`);
      appointments.forEach((apt, index) => {
        if (apt.type === 'specialist_referral') {
          console.log(`🧪 Specialist Referral Appointment ${index + 1}:`, {
            id: apt.id,
            type: apt.type,
            patientId: apt.patientId,
            doctorId: apt.doctorId,
            doctorFirstName: apt.doctorFirstName,
            doctorLastName: apt.doctorLastName,
            doctorSpecialty: apt.doctorSpecialty,
            referringSpecialistId: apt.referringSpecialistId,
            referringSpecialistFirstName: apt.referringSpecialistFirstName,
            referringSpecialistLastName: apt.referringSpecialistLastName,
            status: apt.status,
            appointmentDate: apt.appointmentDate
          });
        }
      });
    } catch (error) {
      console.error('🧪 Test failed:', error);
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

  // Helper method to check if clinic has specialist doctors
  async hasSpecialistDoctors(clinicId: string): Promise<boolean> {
    try {
      const doctorsRef = ref(database, 'doctors');
      const snapshot = await get(doctorsRef);
      
      if (snapshot.exists()) {
        let hasSpecialist = false;
        snapshot.forEach((childSnapshot) => {
          const doctorData = childSnapshot.val();
          // Check if doctor is affiliated with the clinic and is a specialist
          // Check both clinic ID and clinic name for affiliation
          if (doctorData.clinicAffiliations && 
              (doctorData.clinicAffiliations.includes(clinicId) ||
               doctorData.clinicAffiliations.some((affiliation: string) => 
                 affiliation.toLowerCase().includes(clinicId.toLowerCase()) ||
                 clinicId.toLowerCase().includes(affiliation.toLowerCase())
               )) &&
              doctorData.isSpecialist === true) {
            hasSpecialist = true;
          }
        });
        return hasSpecialist;
      }
      return false;
    } catch (error) {
      console.error('Check specialist doctors error:', error);
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

        // Check each valid clinic for generalist and specialist doctors
        for (const clinic of validClinics) {
          const [hasGeneralist, hasSpecialist] = await Promise.all([
            this.hasGeneralistDoctors(clinic.id),
            this.hasSpecialistDoctors(clinic.id)
          ]);
          // Show all clinics with valid addresses, but mark which ones have doctors
          clinics.push({
            id: clinic.id,
            ...clinic.data,
            hasGeneralistDoctors: hasGeneralist, // Add this flag for UI purposes
            hasSpecialistDoctors: hasSpecialist // Add this flag for specialist referrals
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

  // Get clinic by ID without strict address validation (for display purposes)
  async getClinicByIdForDisplay(clinicId: string): Promise<Clinic | null> {
    try {
      const clinicRef = ref(database, `clinics/${clinicId}`);
      const snapshot = await get(clinicRef);
      
      if (snapshot.exists()) {
        const clinicData = snapshot.val();
        // Return active clinics even without strict address validation
        if (clinicData.isActive) {
          return {
            id: snapshot.key!,
            ...clinicData
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Get clinic by ID for display error:', error);
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
                lastUpdated: getCurrentLocalTimestamp(),
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

  async getSpecialistDoctorsByClinic(clinicId: string): Promise<Doctor[]> {
    try {
      const doctorsRef = ref(database, 'doctors');
      const snapshot = await get(doctorsRef);
      
      if (snapshot.exists()) {
        const doctors: Doctor[] = [];
        snapshot.forEach((childSnapshot) => {
          const doctorData = childSnapshot.val();
          // Check if doctor is affiliated with the selected clinic and is a specialist
          // Check both clinic ID and clinic name for affiliation
          if (doctorData.clinicAffiliations && 
              (doctorData.clinicAffiliations.includes(clinicId) ||
               doctorData.clinicAffiliations.some((affiliation: string) => 
                 affiliation.toLowerCase().includes(clinicId.toLowerCase()) ||
                 clinicId.toLowerCase().includes(affiliation.toLowerCase())
               )) &&
              doctorData.isSpecialist === true) {
            // Ensure doctor has proper availability data
            const doctorWithDefaults = {
              id: childSnapshot.key!,
              ...doctorData,
              availability: doctorData.availability || {
                lastUpdated: getCurrentLocalTimestamp(),
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
      console.error('Get specialist doctors by clinic error:', error);
      throw new Error('Failed to load specialist doctors from database');
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
                lastUpdated: getCurrentLocalTimestamp(),
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

  async getDoctorById(doctorId: string, requireAvailability: boolean = true): Promise<Doctor | null> {
    try {
      const doctorRef = ref(database, `doctors/${doctorId}`);
      const snapshot = await get(doctorRef);
      
      if (snapshot.exists()) {
        const doctorData = snapshot.val();
        
        // If availability is required, check if doctor has valid availability data
        if (requireAvailability && !this.hasValidAvailability(doctorData)) {
          return null;
        }
        
        // Ensure doctor has proper availability data
        const doctorWithDefaults = {
          id: snapshot.key!,
          ...doctorData,
          availability: doctorData.availability || {
            lastUpdated: getCurrentLocalTimestamp(),
            weeklySchedule: {},
            specificDates: {}
          }
        };
        return doctorWithDefaults;
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
        const today = getCurrentLocalTimestamp().split('T')[0]; // Get today's date in YYYY-MM-DD format
        
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
        createdAt: getCurrentLocalTimestamp(),
        lastUpdated: getCurrentLocalTimestamp(),
      };
      
      await set(newAppointmentRef, appointmentData);
      
      // Create notifications for the appointment (pending status)
      // Notification creation disabled - using real-time listeners instead
      console.log('🔔 Real-time notifications will handle appointment creation');
      
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
        lastUpdated: getCurrentLocalTimestamp(),
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
                  formula: prescription.formula,
                  take: prescription.take,
                  totalQuantity: prescription.totalQuantity,
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
      
      // Get unique patient IDs from appointments and referrals
      const uniquePatientIds = await this.getUniquePatientIdsForSpecialist(specialistId);
      console.log(`📋 Found ${uniquePatientIds.length} unique patients for specialist:`, uniquePatientIds);
      
      // Fetch patient data using standardized method
      const patientPromises = uniquePatientIds.map(async (patientId) => {
        try {
          const patientData = await this.getPatientData(patientId);
          if (!patientData) {
            console.log(`❌ No standardized data found for patient: ${patientId}`);
            return null;
          }
          
          // Get additional data for patient status and last visit
          const [recentAppointment, lastConsultationResult] = await Promise.all([
            this.getMostRecentAppointmentForPatientById(patientId, specialistId),
            this.getMostRecentConsultationDate(patientId)
          ]);
          
          // Format the last visit date and track if it's from scheduled visit
          let formattedLastVisit: string;
          let isScheduledVisit = false;
          let status = 'confirmed';
          
          if (lastConsultationResult.date) {
            formattedLastVisit = this.formatDateToReadable(lastConsultationResult.date);
            isScheduledVisit = lastConsultationResult.isScheduledVisit;
          } else if (recentAppointment?.appointmentDate) {
            formattedLastVisit = this.formatDateToReadable(recentAppointment.appointmentDate);
            isScheduledVisit = true;
            status = recentAppointment.status || 'confirmed';
          } else {
            formattedLastVisit = 'No visits yet';
          }
          
          // Use utility function to transform standardized data to enhanced patient format
          const patientInfo: Patient = DataTransformationUtils.toEnhancedPatient(patientData, {
            status,
            lastVisit: formattedLastVisit,
            isScheduledVisit,
          });
          
          console.log(`✅ Standardized patient data processed for ${patientId}:`, patientInfo.patientFirstName, patientInfo.patientLastName);
          return patientInfo;
        } catch (error) {
          console.error(`❌ Error processing patient ${patientId}:`, error);
          return null;
        }
      });
      
      const patients = await Promise.all(patientPromises);
      const validPatients = patients.filter(patient => patient !== null) as Patient[];
      
      console.log(`🎯 Final result: ${validPatients.length} patients returned using standardized method`);
      return validPatients;
    } catch (error) {
      console.error('❌ Get patients by specialist error:', error);
      return [];
    }
  },

  // Helper method to get unique patient IDs for a specialist
  async getUniquePatientIdsForSpecialist(specialistId: string): Promise<string[]> {
    try {
      const uniquePatientIds = new Set<string>();
      
      // Get patients from appointments
      const appointmentsRef = ref(database, 'appointments');
      const appointmentsSnapshot = await get(appointmentsRef);
      
      if (appointmentsSnapshot.exists()) {
        appointmentsSnapshot.forEach((childSnapshot) => {
          const appointment = childSnapshot.val();
          const appointmentDoctorId = appointment.doctorId || appointment.specialistId;
          
          if (appointmentDoctorId === specialistId && 
              (appointment.status === 'confirmed' || appointment.status === 'completed') &&
              appointment.patientId) {
            uniquePatientIds.add(appointment.patientId);
          }
        });
      }
      
      // Get patients from referrals
      const referralsRef = ref(database, 'referrals');
      const referralsSnapshot = await get(referralsRef);
      
      if (referralsSnapshot.exists()) {
        referralsSnapshot.forEach((childSnapshot) => {
          const referral = childSnapshot.val();
          
          if (referral.assignedSpecialistId === specialistId && 
              (referral.status === 'confirmed' || referral.status === 'completed') &&
              referral.patientId) {
            uniquePatientIds.add(referral.patientId);
          }
        });
      }
      
      return Array.from(uniquePatientIds);
    } catch (error) {
      console.error('❌ Error getting unique patient IDs:', error);
      return [];
    }
  },

  // Helper method to get the most recent appointment for a patient by ID
  async getMostRecentAppointmentForPatientById(patientId: string, specialistId: string): Promise<any> {
    try {
      const appointmentsRef = ref(database, 'appointments');
      const appointmentsSnapshot = await get(appointmentsRef);
      
      if (!appointmentsSnapshot.exists()) {
        return null;
      }
      
      let mostRecentAppointment = null;
      let mostRecentDate = null;
      
      appointmentsSnapshot.forEach((childSnapshot: any) => {
        const appointment = childSnapshot.val();
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
    } catch (error) {
      console.error('❌ Error getting most recent appointment:', error);
      return null;
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
        
        // Also fetch specialist-to-specialist referrals for this specialist
        const specialistReferrals = await this.getSpecialistReferralsForUser(specialistId, 'specialist');
        appointments.push(...specialistReferrals);
        
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
        
        // Also fetch specialist-to-specialist referrals for this specialist with matching status
        const specialistReferrals = await this.getSpecialistReferralsForUser(specialistId, 'specialist');
        const filteredReferrals = specialistReferrals.filter(referral => referral.status === status);
        appointments.push(...filteredReferrals);
        
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
      console.log('🔍 Searching for certificates by specialist ID:', specialistId);
      
      // Get certificates from patientMedicalHistory entries
      const medicalHistoryRef = ref(database, 'patientMedicalHistory');
      const snapshot = await get(medicalHistoryRef);
      
      if (snapshot.exists()) {
        const certificates: Certificate[] = [];
        let totalEntries = 0;
        let matchingEntries = 0;
        
        snapshot.forEach((patientSnapshot) => {
          const patientHistory = patientSnapshot.val();
          if (patientHistory.entries) {
            Object.keys(patientHistory.entries).forEach((entryKey) => {
              const entry = patientHistory.entries[entryKey];
              totalEntries++;
              
              console.log('📋 Checking entry:', entryKey);
              console.log('👨‍⚕️ Entry provider ID:', entry.provider?.id);
              console.log('🎯 Looking for specialist ID:', specialistId);
              console.log('✅ Match?', entry.provider?.id === specialistId);
              
              // Check if this entry was created by the specialist (provider.id matches specialist UID)
              if (entry.provider && entry.provider.id === specialistId) {
                matchingEntries++;
                console.log('🎉 Found matching entry! Provider:', entry.provider);
                
                // Check for certificates node under this PMH entry
                if (entry.certificates && Array.isArray(entry.certificates)) {
                  console.log('📜 Found certificates array with', entry.certificates.length, 'certificates');
                  
                  entry.certificates.forEach((cert: any, certIndex: number) => {
                    console.log('📄 Processing certificate:', certIndex, cert);
                    
                    // Create a unique ID for the certificate
                    const certificateId = String(cert.id || `${entryKey}_cert_${certIndex}`);
                    
                    // Determine certificate status
                    let status: 'active' | 'expired' = 'active';
                    if (cert.validUntil) {
                      status = new Date(cert.validUntil) < new Date() ? 'expired' : 'active';
                    } else {
                      // If no expiry date, check if it's older than 1 year
                      const issueDate = new Date(cert.createdAt || entry.consultationDate);
                      const oneYearAgo = new Date();
                      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                      status = issueDate < oneYearAgo ? 'expired' : 'active';
                    }
                    
                    const certificateData = {
                      id: certificateId,
                      patientId: entry.patientId,
                      specialistId: entry.provider.id,
                      type: cert.type || 'Medical Certificate',
                      issueDate: cert.createdAt || entry.consultationDate,
                      expiryDate: cert.validUntil || '',
                      status: status,
                      description: cert.description || cert.type || 'Medical certificate issued',
                      medicalFindings: cert.medicalFindings,
                      restrictions: cert.restrictions,
                      documentUrl: cert.documentUrl,
                      consultationId: entryKey, // Add consultation ID for routing
                    };
                    
                    console.log('✅ Adding certificate:', certificateData);
                    certificates.push(certificateData);
                  });
                } else {
                  console.log('❌ No certificates array found in entry');
                }
              }
            });
          }
        });
        
        console.log('📊 Summary:');
        console.log('   Total entries checked:', totalEntries);
        console.log('   Matching entries found:', matchingEntries);
        console.log('   Certificates found:', certificates.length);
        
        return certificates.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
      }
      console.log('❌ No patientMedicalHistory data found');
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

  // Update lastLogin timestamp for a user (in patients or doctors node)
  async updateLastLogin(userId: string, userRole: 'patient' | 'specialist'): Promise<void> {
    try {
      console.log('🕐 Updating lastLogin for user:', userId, 'role:', userRole);
      
      const lastLoginTime = getCurrentLocalTimestamp();
      const nodeName = userRole === 'patient' ? 'patients' : 'doctors';
      const nodeRef = ref(database, `${nodeName}/${userId}`);
      
      await update(nodeRef, {
        lastLogin: lastLoginTime
      });
      
      console.log('✅ LastLogin updated successfully in', nodeName, 'node:', lastLoginTime);
    } catch (error) {
      console.error('❌ Error updating lastLogin:', error);
      throw error;
    }
  },

  // Get lastLogin timestamp for a user (from patients or doctors node)
  async getLastLogin(userId: string, userRole: 'patient' | 'specialist'): Promise<string | null> {
    try {
      const nodeName = userRole === 'patient' ? 'patients' : 'doctors';
      const nodeRef = ref(database, `${nodeName}/${userId}`);
      const snapshot = await get(nodeRef);
      
      if (snapshot.exists()) {
        const nodeData = snapshot.val();
        return nodeData.lastLogin || null;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error getting lastLogin:', error);
      return null;
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
      if (updates.gender !== undefined) doctorUpdates.gender = updates.gender;
      if (updates.dateOfBirth !== undefined) doctorUpdates.dateOfBirth = updates.dateOfBirth;
      if (updates.civilStatus !== undefined) doctorUpdates.civilStatus = updates.civilStatus;
      if (updates.lastUpdated !== undefined) doctorUpdates.lastUpdated = updates.lastUpdated;
      
      // Handle professional fee with status tracking
      if (updates.professionalFee !== undefined) {
        doctorUpdates.professionalFee = updates.professionalFee;
        
        // Get current professional fee to check if it's being changed
        const doctorRef = ref(database, `doctors/${specialistId}`);
        const doctorSnapshot = await get(doctorRef);
        if (doctorSnapshot.exists()) {
          const currentData = doctorSnapshot.val();
          const currentFee = currentData.professionalFee;
          const currentStatus = currentData.professionalFeeStatus;
          
          // If professional fee is being changed, set status to pending
          if (currentFee !== updates.professionalFee) {
            doctorUpdates.professionalFeeStatus = 'pending';
            console.log('Professional fee changed, setting status to pending');
          } else if (updates.professionalFeeStatus !== undefined) {
            // If status is explicitly provided in updates, use it
            doctorUpdates.professionalFeeStatus = updates.professionalFeeStatus;
          }
        } else {
          // If no existing data, set status to pending for new fee
          doctorUpdates.professionalFeeStatus = 'pending';
        }
      }
      
      // Handle professional fee status if explicitly provided
      if (updates.professionalFeeStatus !== undefined) {
        doctorUpdates.professionalFeeStatus = updates.professionalFeeStatus;
      }
      
      // Handle fee change request
      if (updates.feeChangeRequest !== undefined) {
        doctorUpdates.feeChangeRequest = updates.feeChangeRequest;
      }
      
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

  // Function to add fee history entry when a fee change is approved
  async addFeeHistoryEntry(specialistId: string, newFee: number): Promise<void> {
    try {
      const doctorRef = ref(database, `doctors/${specialistId}`);
      const doctorSnapshot = await get(doctorRef);
      
      if (doctorSnapshot.exists()) {
        const currentData = doctorSnapshot.val();
        const existingFeeHistory = currentData.feeHistory || [];
        
        // Add new fee history entry
        const newFeeEntry = {
          fee: newFee,
          effectiveDate: getCurrentLocalTimestamp(),
          status: 'active'
        };
        
        // Mark previous entries as inactive
        const updatedFeeHistory = existingFeeHistory.map((entry: any) => ({
          ...entry,
          status: 'inactive'
        }));
        
        // Add new entry
        updatedFeeHistory.push(newFeeEntry);
        
        await update(doctorRef, {
          feeHistory: updatedFeeHistory
        });
        
        console.log('📊 Fee history updated for specialist:', specialistId, {
          newFee,
          effectiveDate: newFeeEntry.effectiveDate
        });
      } else {
        console.log('Doctor profile not found for specialist:', specialistId);
      }
    } catch (error) {
      console.error('Error adding fee history entry:', error);
      throw error;
    }
  },

  // Function to manually update professional fee status (for admin/testing purposes)
  async updateProfessionalFeeStatus(specialistId: string, status: 'pending' | 'confirmed'): Promise<void> {
    try {
      const doctorRef = ref(database, `doctors/${specialistId}`);
      const doctorSnapshot = await get(doctorRef);
      
      if (doctorSnapshot.exists()) {
        await update(doctorRef, {
          professionalFeeStatus: status,
          lastUpdated: getCurrentLocalTimestamp(),
        });
        console.log(`Professional fee status updated to: ${status}`);
      } else {
        throw new Error('Specialist not found');
      }
    } catch (error) {
      console.error('Update professional fee status error:', error);
      throw error;
    }
  },

  // Standardized method for fetching patient data with proper immutable/mutable separation
  async getPatientData(patientId: string): Promise<StandardizedPatientData | null> {
    try {
      console.log('🔍 Fetching standardized patient data for:', patientId);
      
      // Fetch from both users and patients nodes in parallel
      const [userData, patientData] = await Promise.all([
        this.getDocument(`users/${patientId}`),
        this.getDocument(`patients/${patientId}`)
      ]);
      
      if (!userData && !patientData) {
        console.log('❌ No data found for patient:', patientId);
        return null;
      }
      
      // Combine immutable data from users node with mutable data from patients node
      const standardizedData: StandardizedPatientData = {
        // Immutable fields from users node
        id: patientId,
        firstName: userData?.firstName || userData?.first_name || userData?.givenName || 'Unknown',
        lastName: userData?.lastName || userData?.last_name || userData?.familyName || 'Patient',
        middleName: userData?.middleName || userData?.middle_name || '',
        email: userData?.email || userData?.emailAddress || '',
        role: userData?.role || 'patient',
        createdAt: userData?.createdAt || userData?.created_at || '',
        profileImage: userData?.profileImage || userData?.profilePicture || userData?.avatar || '',
        
        // Mutable fields from patients node
        contactNumber: patientData?.contactNumber || patientData?.phone || patientData?.phoneNumber || '',
        address: patientData?.address || '',
        bloodType: patientData?.bloodType || patientData?.blood_type || '',
        allergies: patientData?.allergies || [],
        emergencyContact: patientData?.emergencyContact || patientData?.emergency_contact || null,
        medicalConditions: patientData?.medicalConditions || patientData?.medical_conditions || [],
        dateOfBirth: patientData?.dateOfBirth || patientData?.date_of_birth || userData?.dateOfBirth || userData?.date_of_birth || '',
        gender: patientData?.gender || userData?.gender || '',
        lastUpdated: patientData?.lastUpdated || patientData?.last_updated || getCurrentLocalTimestamp(),
        
        // Computed fields
        fullName: `${userData?.firstName || userData?.first_name || userData?.givenName || ''} ${userData?.lastName || userData?.last_name || userData?.familyName || ''}`.trim() || 'Unknown Patient',
      };
      
      console.log('✅ Standardized patient data fetched:', standardizedData.fullName);
      return standardizedData;
    } catch (error) {
      console.error('❌ Error fetching standardized patient data:', error);
      return null;
    }
  },

  // Standardized method for fetching specialist data with proper immutable/mutable separation
  async getSpecialistData(specialistId: string): Promise<StandardizedSpecialistData | null> {
    try {
      console.log('🔍 Fetching standardized specialist data for:', specialistId);
      
      // Fetch from both users and doctors nodes in parallel
      const [userData, doctorData] = await Promise.all([
        this.getDocument(`users/${specialistId}`),
        this.getDocument(`doctors/${specialistId}`)
      ]);
      
      if (!userData && !doctorData) {
        console.log('❌ No data found for specialist:', specialistId);
        return null;
      }
      
      // Combine immutable data from users node with mutable data from doctors node
      const standardizedData: StandardizedSpecialistData = {
        // Immutable fields from users node
        id: specialistId,
        firstName: userData?.firstName || userData?.first_name || userData?.givenName || 'Unknown',
        lastName: userData?.lastName || userData?.last_name || userData?.familyName || 'Specialist',
        middleName: userData?.middleName || userData?.middle_name || '',
        email: userData?.email || userData?.emailAddress || '',
        role: userData?.role || 'specialist',
        createdAt: userData?.createdAt || userData?.created_at || '',
        profileImage: userData?.profileImage || userData?.profilePicture || userData?.avatar || '',
        
        // Mutable fields from doctors node
        contactNumber: doctorData?.contactNumber || doctorData?.phone || doctorData?.phoneNumber || '',
        address: doctorData?.address || '',
        specialty: doctorData?.specialty || doctorData?.specialization || '',
        yearsOfExperience: doctorData?.yearsOfExperience || doctorData?.years_of_experience || 0,
        medicalLicenseNumber: doctorData?.medicalLicenseNumber || doctorData?.medical_license_number || '',
        professionalFee: doctorData?.professionalFee || doctorData?.professional_fee || 0,
        prcId: doctorData?.prcId || doctorData?.prc_id || '',
        prcExpiryDate: doctorData?.prcExpiryDate || doctorData?.prc_expiry_date || '',
        gender: doctorData?.gender || userData?.gender || '',
        dateOfBirth: doctorData?.dateOfBirth || doctorData?.date_of_birth || userData?.dateOfBirth || userData?.date_of_birth || '',
        civilStatus: doctorData?.civilStatus || doctorData?.civil_status || '',
        lastUpdated: doctorData?.lastUpdated || doctorData?.last_updated || getCurrentLocalTimestamp(),
        
        // Computed fields
        fullName: `${userData?.firstName || userData?.first_name || userData?.givenName || ''} ${userData?.lastName || userData?.last_name || userData?.familyName || ''}`.trim() || 'Unknown Specialist',
      };
      
      console.log('✅ Standardized specialist data fetched:', standardizedData.fullName);
      return standardizedData;
    } catch (error) {
      console.error('❌ Error fetching standardized specialist data:', error);
      return null;
    }
  },

  async getPatientById(patientId: string): Promise<any> {
    try {
      console.log('🔍 getPatientById called with patientId:', patientId);
      
      // Use standardized method for consistent data fetching
      const standardizedData = await this.getPatientData(patientId);
      if (standardizedData) {
        console.log('✅ Using standardized patient data for getPatientById');
        return standardizedData;
      }
      
      // Fallback to appointments data as last resort
      console.log('🔄 Falling back to appointments data for patient:', patientId);
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
      
      console.log('❌ No patient data found in any source for:', patientId);
      return null;
    } catch (error) {
      console.error('❌ Get patient by ID error:', error);
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
        
        // Also fetch specialist-to-specialist referrals for this patient
        const specialistReferrals = await this.getSpecialistReferralsForUser(patientId, 'patient');
        appointments.push(...specialistReferrals);
        
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
        lastUpdated: getCurrentLocalTimestamp()
      };

      if (reason) {
        updates.declineReason = reason;
      }

      await update(appointmentRef, updates);
      console.log('✅ Appointment status updated successfully');

      // Notification creation disabled - using real-time listeners instead
      console.log('🔔 Real-time notifications will handle appointment status changes');

    } catch (error) {
      console.error('❌ Update appointment status error:', error);
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
        issueDate: getCurrentLocalTimestamp(),
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
        lastUpdated: getCurrentLocalTimestamp(),
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
        const enrichmentPromises: Promise<void>[] = [];
        
        snapshot.forEach((childSnapshot) => {
          const referral = childSnapshot.val();
          // Filter referrals assigned to this specialist
          if (referral.assignedSpecialistId === specialistId) {
            const referralWithId = {
              id: childSnapshot.key,
              ...referral
            };
            referrals.push(referralWithId);
            
            // Enrich referral data with names from users node
            enrichmentPromises.push(
              this.enrichSpecialistReferralData(referralWithId).then(enrichedData => {
                if (enrichedData) {
                  // Update the referral in the array with enriched data
                  const index = referrals.findIndex(r => r.id === referralWithId.id);
                  if (index !== -1) {
                    referrals[index] = { ...referrals[index], ...enrichedData };
                  }
                }
              }).catch(error => {
                console.error('Error enriching referral data:', error);
              })
            );
          }
        });
        
        // Wait for all enrichment to complete
        await Promise.all(enrichmentPromises);
        
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
        const enrichmentPromises: Promise<void>[] = [];
        
        snapshot.forEach((childSnapshot) => {
          const referral = childSnapshot.val();
          // Filter referrals assigned to this specialist with specific status
          if (referral.assignedSpecialistId === specialistId && referral.status === status) {
            const referralWithId = {
              id: childSnapshot.key,
              ...referral
            };
            referrals.push(referralWithId);
            
            // Enrich referral data with names from users node
            enrichmentPromises.push(
              this.enrichSpecialistReferralData(referralWithId).then(enrichedData => {
                if (enrichedData) {
                  // Update the referral in the array with enriched data
                  const index = referrals.findIndex(r => r.id === referralWithId.id);
                  if (index !== -1) {
                    referrals[index] = { ...referrals[index], ...enrichedData };
                  }
                }
              }).catch(error => {
                console.error('Error enriching referral data:', error);
              })
            );
          }
        });
        
        // Wait for all enrichment to complete
        await Promise.all(enrichmentPromises);
        
        return referrals.sort((a, b) => new Date(b.referralTimestamp).getTime() - new Date(a.referralTimestamp).getTime());
      }
      return [];
    } catch (error) {
      console.error('Get referrals by specialist and status error:', error);
      return [];
    }
  },

  async getReferralsByPatient(patientId: string): Promise<Referral[]> {
    try {
      const referralsRef = ref(database, 'referrals');
      const snapshot = await get(referralsRef);
      
      if (snapshot.exists()) {
        const referrals: Referral[] = [];
        const enrichmentPromises: Promise<void>[] = [];
        
        snapshot.forEach((childSnapshot) => {
          const referral = childSnapshot.val();
          // Filter referrals for this patient
          if (referral.patientId === patientId) {
            const referralWithId = {
              id: childSnapshot.key,
              ...referral
            };
            referrals.push(referralWithId);
            
            // Enrich referral data with names from users node
            enrichmentPromises.push(
              this.enrichSpecialistReferralData(referralWithId).then(enrichedData => {
                if (enrichedData) {
                  // Update the referral in the array with enriched data
                  const index = referrals.findIndex(r => r.id === referralWithId.id);
                  if (index !== -1) {
                    referrals[index] = { ...referrals[index], ...enrichedData };
                  }
                }
              }).catch(error => {
                console.error('Error enriching referral data:', error);
              })
            );
          }
        });
        
        // Wait for all enrichment to complete
        await Promise.all(enrichmentPromises);
        
        return referrals.sort((a, b) => new Date(b.referralTimestamp).getTime() - new Date(a.referralTimestamp).getTime());
      }
      return [];
    } catch (error) {
      console.error('Get referrals by patient error:', error);
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
        lastUpdated: getCurrentLocalTimestamp() 
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
        const referralData = {
          id: snapshot.key,
          ...snapshot.val()
        };
        
        // Enrich referral data with names from users node
        const enrichedData = await this.enrichSpecialistReferralData(referralData);
        if (enrichedData) {
          return { ...referralData, ...enrichedData };
        }
        
        return referralData;
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
        lastUpdated: getCurrentLocalTimestamp()
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
          
          // Also fetch specialist-to-specialist referrals for both patients and specialists
          const specialistReferrals = await this.getSpecialistReferralsForUser(userId, role);
          
          // Filter out specialist referrals that already have corresponding regular appointments
          const filteredSpecialistReferrals = specialistReferrals.filter(specialistReferral => {
            // Check if there's already a regular appointment with this referralId
            const hasCorrespondingAppointment = resolvedAppointments.some(appointment => 
              appointment.relatedReferralId === specialistReferral.id
            );
            return !hasCorrespondingAppointment;
          });
          
          appointments.push(...filteredSpecialistReferrals);
          
          callback(appointments.sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime()));
        } catch (error) {
          console.error('Error processing appointments in real-time listener:', error);
          callback([]);
        }
      } else {
        // Even if no appointments exist, we should still check for specialist referrals
        try {
          const specialistReferrals = await this.getSpecialistReferralsForUser(userId, role);
          callback(specialistReferrals.sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime()));
        } catch (error) {
          console.error('Error fetching specialist referrals in real-time listener:', error);
          callback([]);
        }
      }
    });
    
    return unsubscribe;
  },

  onReferralsChange(userId: string, callback: (referrals: Referral[]) => void) {
    const referralsRef = ref(database, 'referrals');
    
    const unsubscribe = onValue(referralsRef, async (snapshot) => {
      if (snapshot.exists()) {
        const referrals: Referral[] = [];
        const enrichmentPromises: Promise<void>[] = [];
        
        snapshot.forEach((childSnapshot) => {
          const referralData = childSnapshot.val();
          // Filter referrals for this user (either as specialist or patient)
          if (referralData.assignedSpecialistId === userId || referralData.patientId === userId) {
            const referralWithId = {
              id: childSnapshot.key,
              ...referralData
            };
            referrals.push(referralWithId);
            
            // Enrich referral data with names from users node
            enrichmentPromises.push(
              this.enrichSpecialistReferralData(referralWithId).then(enrichedData => {
                if (enrichedData) {
                  // Update the referral in the array with enriched data
                  const index = referrals.findIndex(r => r.id === referralWithId.id);
                  if (index !== -1) {
                    referrals[index] = { ...referrals[index], ...enrichedData };
                  }
                }
              }).catch(error => {
                console.error('Error enriching referral data in real-time listener:', error);
              })
            );
          }
        });
        
        // Wait for all enrichment to complete before calling callback
        await Promise.all(enrichmentPromises);
        
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



  // Monitor medical history for new prescriptions and certificates
  onMedicalHistoryPrescriptionsAndCertificatesChange(
    patientId: string, 
    callback: (data: { prescriptions: any[], certificates: any[] }) => void
  ) {
    const medicalHistoryRef = ref(database, `patientMedicalHistory/${patientId}/entries`);
    
    const unsubscribe = onValue(medicalHistoryRef, async (snapshot) => {
      if (snapshot.exists()) {
        const prescriptions: any[] = [];
        const certificates: any[] = [];
        
        snapshot.forEach((childSnapshot) => {
          const entryData = childSnapshot.val();
          const entryId = childSnapshot.key;
          
          // Extract prescriptions
          if (entryData.prescriptions && Array.isArray(entryData.prescriptions)) {
            entryData.prescriptions.forEach((prescription: any, index: number) => {
              prescriptions.push({
                id: prescription.id || `${entryId}_prescription_${index}`,
                entryId,
                patientId,
                medication: prescription.medication,
                dosage: prescription.dosage,
                frequency: prescription.frequency,
                duration: prescription.duration,
                route: prescription.route,
                prescribedDate: prescription.prescribedDate,
                description: prescription.description,
                doctorId: entryData.provider?.id,
                doctorName: `${entryData.provider?.firstName || ''} ${entryData.provider?.lastName || ''}`.trim(),
                consultationDate: entryData.consultationDate
              });
            });
          }
          
          // Extract certificates
          if (entryData.certificates && Array.isArray(entryData.certificates)) {
            entryData.certificates.forEach((certificate: any, index: number) => {
              certificates.push({
                id: certificate.id || `${entryId}_certificate_${index}`,
                entryId,
                patientId,
                type: certificate.type,
                fitnessStatement: certificate.fitnessStatement,
                workRestrictions: certificate.workRestrictions,
                issuedDate: certificate.issuedDate,
                issuedTime: certificate.issuedTime,
                status: certificate.status,
                description: certificate.description,
                destination: certificate.destination,
                followUpDate: certificate.followUpDate,
                medicalAdvice: certificate.medicalAdvice,
                nextReviewDate: certificate.nextReviewDate,
                reasonForUnfitness: certificate.reasonForUnfitness,
                specialConditions: certificate.specialConditions,
                travelDate: certificate.travelDate,
                travelFitnessStatement: certificate.travelFitnessStatement,
                travelMode: certificate.travelMode,
                unfitPeriodEnd: certificate.unfitPeriodEnd,
                unfitPeriodStart: certificate.unfitPeriodStart,
                validityPeriod: certificate.validityPeriod,
                doctorId: entryData.provider?.id,
                doctorName: `${entryData.provider?.firstName || ''} ${entryData.provider?.lastName || ''}`.trim(),
                consultationDate: entryData.consultationDate
              });
            });
          }
        });
        
        callback({ prescriptions, certificates });
      } else {
        callback({ prescriptions: [], certificates: [] });
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
        updatedAt: getCurrentLocalTimestamp(),
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
        updatedAt: getCurrentLocalTimestamp(),
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
        createdAt: getCurrentLocalTimestamp(),
        updatedAt: getCurrentLocalTimestamp(),
      });
      return newRef.key!;
    } catch (error) {
      console.error(`Push document error (${path}):`, error);
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
        consultationDate: getCurrentLocalTimestamp(),
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
        consultationDate: getCurrentLocalTimestamp(),
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
        referralTimestamp: getCurrentLocalTimestamp(),
        createdAt: getCurrentLocalTimestamp(),
        lastUpdated: getCurrentLocalTimestamp(),
        status: referralData.status || 'pending_acceptance'
      };

      // Use Firebase push to generate the referralId
      const referralId = await this.pushDocument('referrals', completeReferralData);
      console.log('✅ Referral created with Firebase push key:', referralId);
      
      // Create notifications for the referral (pending status)
      // Notification creation disabled - using real-time listeners instead
      console.log('🔔 Real-time notifications will handle referral creation');
      
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

  // Check if feedback already exists for a referral
  async checkReferralFeedbackExists(referralId: string): Promise<boolean> {
    try {
      const feedbackSnapshot = await get(ref(database, 'feedback'));
      const feedbackData = feedbackSnapshot.val();
      
      if (feedbackData) {
        const feedbackEntries = Object.values(feedbackData);
        return feedbackEntries.some((feedback: any) => feedback.referralId === referralId);
      }
      return false;
    } catch (error) {
      console.error('Error checking referral feedback existence:', error);
      return false;
    }
  },

  // Submit feedback
  async submitFeedback(feedbackData: {
    appointmentId?: string;
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
      
      // Check if feedback already exists
      let feedbackExists = false;
      if (feedbackData.appointmentId) {
        feedbackExists = await this.checkFeedbackExists(feedbackData.appointmentId);
        if (feedbackExists) {
          throw new Error('Feedback already submitted for this appointment');
        }
      } else if (feedbackData.referralId) {
        feedbackExists = await this.checkReferralFeedbackExists(feedbackData.referralId);
        if (feedbackExists) {
          throw new Error('Feedback already submitted for this referral');
        }
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

  // Get specialist schedules by specialist ID
  async getSpecialistSchedules(specialistId: string): Promise<any> {
    console.log('🗑️ getSpecialistSchedules called with specialistId:', specialistId);
    try {
      const schedulesRef = ref(database, `specialistSchedules/${specialistId}`);
      const snapshot = await get(schedulesRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log('🗑️ Found schedules data:', data);
        return data;
      }
      console.log('🗑️ No schedules found for specialist:', specialistId);
      return null;
    } catch (error) {
      console.error('❌ Error getting specialist schedules:', error);
      return null;
    }
  },

  // Get referrals for a specialist to check booked appointments
  async getSpecialistReferrals(specialistId: string): Promise<any[]> {
    try {
      const referralsRef = ref(database, 'referrals');
      const snapshot = await get(referralsRef);
      
      if (snapshot.exists()) {
        const referralsData = snapshot.val();
        const referralsArray: any[] = [];
        
        // Iterate through all referrals to find those assigned to this specialist
        Object.entries(referralsData).forEach(([referralId, referralData]: [string, any]) => {
          if (referralData.assignedSpecialistId === specialistId) {
            referralsArray.push({
              id: referralId,
              ...referralData
            });
          }
        });
        
        return referralsArray;
      }
      return [];
    } catch (error) {
      console.error('Error getting specialist referrals:', error);
      return [];
    }
  },

  // Add a new specialist schedule
  async addSpecialistSchedule(specialistId: string, scheduleData: any): Promise<string> {
    console.log('🔍 addSpecialistSchedule called');
    console.log('🔍 specialistId:', specialistId);
    console.log('🔍 scheduleData:', scheduleData);
    
    try {
      const schedulesRef = ref(database, `specialistSchedules/${specialistId}`);
      const newScheduleRef = push(schedulesRef);
      
      if (newScheduleRef.key) {
        console.log('🔍 Saving schedule to database...');
        await set(newScheduleRef, scheduleData);
        console.log('✅ Specialist schedule added with ID:', newScheduleRef.key);
        return newScheduleRef.key;
      } else {
        throw new Error('Failed to generate schedule ID');
      }
    } catch (error) {
      console.error('❌ Add specialist schedule error:', error);
      throw error;
    }
  },

  // Update an existing specialist schedule
  async updateSpecialistSchedule(specialistId: string, scheduleId: string, updateData: any): Promise<void> {
    try {
      const scheduleRef = ref(database, `specialistSchedules/${specialistId}/${scheduleId}`);
      await update(scheduleRef, updateData);
      console.log('✅ Specialist schedule updated:', scheduleId);
    } catch (error) {
      console.error('❌ Update specialist schedule error:', error);
      throw error;
    }
  },

  // Delete a specialist schedule
  async deleteSpecialistSchedule(specialistId: string, scheduleId: string): Promise<void> {
    console.log('🗑️ deleteSpecialistSchedule called with specialistId:', specialistId, 'scheduleId:', scheduleId);
    try {
      const scheduleRef = ref(database, `specialistSchedules/${specialistId}/${scheduleId}`);
      console.log('🗑️ Attempting to delete schedule at path:', `specialistSchedules/${specialistId}/${scheduleId}`);
      await remove(scheduleRef);
      console.log('✅ Specialist schedule deleted:', scheduleId);
    } catch (error) {
      console.error('❌ Delete specialist schedule error:', error);
      throw error;
    }
  },

  // Get all clinics for schedule management
  async getAllClinics(): Promise<any[]> {
    try {
      const clinicsRef = ref(database, 'clinics');
      const snapshot = await get(clinicsRef);
      
      if (snapshot.exists()) {
        const clinicsData = snapshot.val();
        return Object.entries(clinicsData).map(([id, data]: [string, any]) => ({
          id,
          ...data
        }));
      }
      return [];
    } catch (error) {
      console.error('Error getting clinics:', error);
      return [];
    }
  },


};  

