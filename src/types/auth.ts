export interface UserProfile {
  uid: string;
  email: string;
  role: 'patient' | 'specialist';
  firstName: string;
  middleName?: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  highestEducationalAttainment?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}

export interface SignUpData {
  // Step 1 data
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  contactNumber: string;
  highestEducationalAttainment?: string;
  bloodType?: string;
  allergies?: string;
  
  // Step 2 data
  emergencyContactName: string;
  relationship: string;
  emergencyContactNumber: string;
  
  // Step 3 data
  password: string;
}

export interface UserNode {
  createdAt: string;
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  patientId?: string;
  doctorId?: string;
  role: 'patient' | 'specialist';
}

export interface PatientNode {
  address?: string;
  bloodType?: string;
  allergies?: string[];
  contactNumber?: string;
  createdAt: string;
  dateOfBirth?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  firstName: string;
  middleName?: string;
  gender?: string;
  lastName: string;
  lastUpdated?: string;
  userId: string;
  highestEducationalAttainment?: string;
}

export interface DoctorNode {
  address?: string;
  civilStatus?: string;
  clinicAffiliations?: string[];
  contactNumber?: string;
  createdAt: string;
  dateOfBirth?: string;
  email?: string;
  firstName: string;
  gender?: string;
  isGeneralist?: boolean;
  isSpecialist?: boolean;
  lastLogin?: string;
  lastName: string;
  medicalLicenseNumber?: string;
  middleName?: string;
  prcExpiryDate?: string;
  prcId?: string;
  professionalFee?: number;
  profileImageUrl?: string;
  specialty?: string;
  status?: string;
  userId: string;
}

export interface BiometricCredentials {
  email: string;
  password: string;
  nextRoute: string;
  role?: string;
}

export interface BiometricSupport {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: any[];
} 