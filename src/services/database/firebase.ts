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
import { database } from '@/src/config/firebase';

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
  }
};  