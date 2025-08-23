export interface Patient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  bloodType?: string;
  allergies?: string[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  createdAt: string;
  lastUpdated?: string;
}

export interface PatientMedicalHistory {
  id?: string;
  clinicalSummary: string;
  consultationDate: string;
  consultationTime: string;
  createdAt: string;
  diagnosis?: Array<{
    code: string;
    description: string;
  }>;
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
    route?: string;
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