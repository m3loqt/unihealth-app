import { useState, useEffect, useCallback } from 'react';
import { databaseService } from '@/services/database/firebase';

export interface SpecialistChatPatient {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'patient';
  specialty?: string;
  avatar?: string;
  source: 'appointment' | 'referral';
  sourceId: string;
  lastInteraction?: number;
}

export function useSpecialistChatPatients() {
  const [patients, setPatients] = useState<SpecialistChatPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPatients = useCallback(async (specialistId: string) => {
    if (!specialistId) {
      setPatients([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const patientsMap = new Map<string, SpecialistChatPatient>();

      // Fetch appointments where this specialist is the doctor
      const appointments = await databaseService.getAppointmentsBySpecialist(specialistId);
      console.log(' Loaded appointments for specialist:', appointments.length);

      for (const appointment of appointments) {
        if (appointment.patientId && appointment.patientId !== specialistId) {
          try {
            // Get patient data
            const patientData = await databaseService.getDocument(`users/${appointment.patientId}`);
            
            if (patientData) {
              const patientKey = appointment.patientId;
              
              // Only add if not already added or if this appointment is more recent
              if (!patientsMap.has(patientKey) || 
                  (appointment.appointmentDate && 
                   (!patientsMap.get(patientKey)?.lastInteraction || 
                    new Date(appointment.appointmentDate).getTime() > (patientsMap.get(patientKey)?.lastInteraction || 0)))) {
                
                patientsMap.set(patientKey, {
                  uid: appointment.patientId,
                  firstName: patientData.firstName || patientData.first_name || 'Unknown',
                  lastName: patientData.lastName || patientData.last_name || 'Patient',
                  email: patientData.email || '',
                  role: 'patient',
                  specialty: appointment.specialty || 'General Medicine',
                  avatar: patientData.avatar || patientData.profilePicture || '',
                  source: 'appointment',
                  sourceId: appointment.id || appointment.patientId,
                  lastInteraction: appointment.appointmentDate ? new Date(appointment.appointmentDate).getTime() : Date.now(),
                });
              }
            }
          } catch (patientError) {
            console.error('Error loading patient data for appointment:', appointment.id, patientError);
          }
        }
      }

      // Fetch referrals where this specialist is assigned
      const referrals = await databaseService.getReferralsBySpecialist(specialistId);
      console.log(' Loaded referrals for specialist:', referrals.length);

      for (const referral of referrals) {
        if (referral.patientId && referral.patientId !== specialistId) {
          try {
            // Get patient data
            const patientData = await databaseService.getDocument(`users/${referral.patientId}`);
            
            if (patientData) {
              const patientKey = referral.patientId;
              
              // Only add if not already added or if this referral is more recent
              if (!patientsMap.has(patientKey) || 
                  (referral.appointmentDate && 
                   (!patientsMap.get(patientKey)?.lastInteraction || 
                    new Date(referral.appointmentDate).getTime() > (patientsMap.get(patientKey)?.lastInteraction || 0)))) {
                
                patientsMap.set(patientKey, {
                  uid: referral.patientId,
                  firstName: patientData.firstName || patientData.first_name || 'Unknown',
                  lastName: patientData.lastName || patientData.last_name || 'Patient',
                  email: patientData.email || '',
                  role: 'patient',
                  specialty: referral.specialty || 'General Medicine',
                  avatar: patientData.avatar || patientData.profilePicture || '',
                  source: 'referral',
                  sourceId: referral.id || referral.patientId,
                  lastInteraction: referral.appointmentDate ? new Date(referral.appointmentDate).getTime() : Date.now(),
                });
              }
            }
          } catch (patientError) {
            console.error('Error loading patient data for referral:', referral.id, patientError);
          }
        }
      }

      // Convert map to array and sort by last interaction
      const patientsArray = Array.from(patientsMap.values()).sort((a, b) => {
        const timeA = a.lastInteraction || 0;
        const timeB = b.lastInteraction || 0;
        return timeB - timeA; // Most recent first
      });

      console.log(' Final patients for specialist:', patientsArray.length);
      setPatients(patientsArray);
    } catch (error) {
      console.error('Error loading specialist patients:', error);
      setError('Failed to load patients. Please try again.');
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    // This will be called by the component with the current specialist ID
    // The component should call loadPatients with the specialist ID
  }, []);

  return {
    patients,
    loading,
    error,
    loadPatients,
    refresh,
  };
}
