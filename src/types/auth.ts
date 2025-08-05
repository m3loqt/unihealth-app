export interface UserProfile {
  uid: string;
  email: string;
  role: 'patient' | 'specialist';
  name: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
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
  lastName: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  contactNumber: string;
  
  // Step 2 data
  emergencyContactName: string;
  relationship: string;
  emergencyContactNumber: string;
  
  // Step 3 data
  password: string;
}

export interface UserNode {
  address?: string;
  contactNumber?: string;
  createdAt: string;
  email: string;
  firstName: string;
  lastName: string;
  patientId?: string;
  role: 'patient' | 'specialist';
}

export interface PatientNode {
  bloodType?: string;
  createdAt: string;
  dateOfBirth?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  firstName: string;
  gender?: string;
  lastName: string;
  lastUpdated?: string;
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