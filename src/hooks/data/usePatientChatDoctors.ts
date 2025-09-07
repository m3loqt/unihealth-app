import { useState, useEffect, useCallback } from 'react';
import { databaseService, Appointment, Referral } from '../../services/database/firebase';
import { useAuth } from '../auth/useAuth';

export interface ChatDoctor {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'specialist' | 'generalist';
  specialty?: string;
  avatar?: string;
  source: 'appointment' | 'referral';
  sourceId: string; // appointmentId or referralId
  lastInteraction?: number; // timestamp of last appointment/referral
}

export interface UsePatientChatDoctorsReturn {
  doctors: ChatDoctor[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const usePatientChatDoctors = (): UsePatientChatDoctorsReturn => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<ChatDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDoctors = useCallback(async () => {
    if (!user) {
      setDoctors([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Load appointments and referrals in parallel
      const [appointments, referrals] = await Promise.all([
        databaseService.getAppointments(user.uid, 'patient'),
        databaseService.getReferralsByPatient(user.uid)
      ]);

      const doctorMap = new Map<string, ChatDoctor>();

      // Process appointments
      appointments.forEach((appointment: Appointment) => {
        if (appointment.doctorId && appointment.doctorFirstName && appointment.doctorLastName) {
          const doctorKey = appointment.doctorId;
          const lastInteraction = new Date(appointment.appointmentDate).getTime();

          if (!doctorMap.has(doctorKey)) {
            doctorMap.set(doctorKey, {
              uid: appointment.doctorId,
              firstName: appointment.doctorFirstName,
              lastName: appointment.doctorLastName,
              email: `${appointment.doctorFirstName.toLowerCase()}.${appointment.doctorLastName.toLowerCase()}@unihealth.ph`,
              role: 'specialist',
              specialty: appointment.specialty || appointment.doctorSpecialty || 'General Medicine',
              avatar: '',
              source: 'appointment',
              sourceId: appointment.id || `appointment_${Date.now()}`,
              lastInteraction,
            });
          } else {
            // Update last interaction if this appointment is more recent
            const existing = doctorMap.get(doctorKey)!;
            if (lastInteraction > (existing.lastInteraction || 0)) {
              existing.lastInteraction = lastInteraction;
              existing.sourceId = appointment.id || `appointment_${Date.now()}`;
            }
          }
        }
      });

      // Process referrals
      referrals.forEach((referral: Referral) => {
        if (referral.assignedSpecialistId && referral.assignedSpecialistFirstName && referral.assignedSpecialistLastName) {
          const doctorKey = referral.assignedSpecialistId;
          const lastInteraction = new Date(referral.referralTimestamp).getTime();

          if (!doctorMap.has(doctorKey)) {
            doctorMap.set(doctorKey, {
              uid: referral.assignedSpecialistId,
              firstName: referral.assignedSpecialistFirstName,
              lastName: referral.assignedSpecialistLastName,
              email: `${referral.assignedSpecialistFirstName.toLowerCase()}.${referral.assignedSpecialistLastName.toLowerCase()}@unihealth.ph`,
              role: 'specialist',
              specialty: 'Specialist', // Referrals are always to specialists
              avatar: '',
              source: 'referral',
              sourceId: referral.id || `referral_${Date.now()}`,
              lastInteraction,
            });
          } else {
            // Update last interaction if this referral is more recent
            const existing = doctorMap.get(doctorKey)!;
            if (lastInteraction > (existing.lastInteraction || 0)) {
              existing.lastInteraction = lastInteraction;
              existing.sourceId = referral.id || `referral_${Date.now()}`;
            }
          }
        }
      });

      // Convert map to array and sort by last interaction
      const doctorsArray = Array.from(doctorMap.values()).sort((a, b) => {
        const timeA = a.lastInteraction || 0;
        const timeB = b.lastInteraction || 0;
        return timeB - timeA; // Most recent first
      });

      setDoctors(doctorsArray);
    } catch (err) {
      console.error('Error loading patient chat doctors:', err);
      setError(err instanceof Error ? err.message : 'Failed to load doctors');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    await loadDoctors();
  }, [loadDoctors]);

  // Load doctors when user changes
  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  return {
    doctors,
    loading,
    error,
    refresh,
  };
};
