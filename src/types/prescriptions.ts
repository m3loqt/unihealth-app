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

export interface CreatePrescriptionData {
  patientId: string;
  specialistId: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  status: 'active' | 'completed' | 'discontinued';
  route?: string;
  formula?: string;
  take?: string;
  totalQuantity?: string;
} 