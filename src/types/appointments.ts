export interface Appointment {
  id?: string;
  appointmentDate: string;
  appointmentTime: string;
  clinicId: string;
  clinicName?: string; // Optional for walk-ins
  createdAt: string;
  doctorId: string;
  lastUpdated: string;
  appointmentPurpose?: string; // Changed from patientComplaint to appointmentPurpose
  additionalNotes?: string; // Changed from notes
  patientId: string;
  patientFirstName?: string; // Added back for UI display
  patientLastName?: string; // Added back for UI display
  patientMiddleName?: string; // Added for specialist referrals
  doctorFirstName?: string; // Added back for UI display
  doctorLastName?: string; // Added back for UI display
  doctorMiddleName?: string; // Added for specialist referrals
  doctorSpecialty?: string; // Added for specialist referrals
  relatedReferralId?: string; // Added back for referral appointments
  sourceSystem?: string; // Optional for walk-ins
  specialty?: string; // Added back for UI display
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  type: 'general_consultation' | 'walk-in' | 'specialist_referral' | string;
  consultationId?: string;
  appointmentConsultationId?: string;
  // Specialist referral specific fields
  referringSpecialistId?: string;
  referringSpecialistFirstName?: string;
  referringSpecialistLastName?: string;
  referringSpecialistMiddleName?: string;
  referringClinicId?: string;
  referringClinicName?: string;
  practiceLocation?: {
    clinicId: string;
    roomOrUnit: string;
  };
}

export interface CreateAppointmentData {
  appointmentDate: string;
  appointmentTime: string;
  clinicId: string;
  clinicName: string;
  doctorId: string;
  appointmentPurpose: string;
  additionalNotes?: string;
  patientId: string;
  sourceSystem: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  type: 'general_consultation' | string;
}

// New interface for walk-in appointments (read-only)
export interface WalkInAppointment {
  id?: string;
  appointmentDate: string;
  appointmentTime: string;
  clinicId: string;
  createdAt: string;
  doctorId: string;
  lastUpdated: string;
  appointmentPurpose?: string;
  additionalNotes?: string;
  patientId: string;
  sourceSystem?: string;
  status: 'confirmed' | 'completed' | 'cancelled';
  type: 'walk-in';
  consultationId?: string;
  appointmentConsultationId?: string;
}

export interface Referral {
  id?: string;
  appointmentDate: string;
  appointmentTime: string;
  assignedSpecialistFirstName: string;
  assignedSpecialistId: string;
  assignedSpecialistLastName: string;
  clinicAppointmentId?: string; // Made optional for specialist-to-specialist referrals
  consultationId?: string;
  referralConsultationId?: string;
  generalistNotes?: string;
  initialReasonForReferral: string;
  additionalNotes?: string;
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