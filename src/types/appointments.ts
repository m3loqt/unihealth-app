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
  sourceSystem: string;
  specialty: string;
  status: 'pending' | 'confirmed' | 'completed' | 'canceled';
  type: string;
  consultationId?: string;
  appointmentConsultationId?: string;
}

export interface CreateAppointmentData {
  appointmentDate: string;
  appointmentTime: string;
  bookedByUserFirstName: string;
  bookedByUserId: string;
  bookedByUserLastName: string;
  clinicId: string;
  clinicName: string;
  doctorFirstName: string;
  doctorId: string;
  doctorLastName: string;
  notes?: string;
  patientComplaint?: string[];
  patientFirstName: string;
  patientId: string;
  patientLastName: string;
  relatedReferralId?: string;
  sourceSystem: string;
  specialty: string;
  status: 'pending' | 'confirmed' | 'completed' | 'canceled';
  type: string;
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