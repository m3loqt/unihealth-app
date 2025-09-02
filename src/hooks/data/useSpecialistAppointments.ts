import { useState, useEffect, useCallback } from 'react';
import { databaseService, Appointment } from '../../services/database/firebase';
import { useAuth } from '../auth/useAuth';

export interface UseSpecialistAppointmentsReturn {
  appointments: Appointment[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createAppointment: (appointmentData: any) => Promise<string | null>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
}

export const useSpecialistAppointments = (): UseSpecialistAppointmentsReturn => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const specialistAppointments = await databaseService.getAppointmentsBySpecialist(user.uid);
      setAppointments(specialistAppointments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load appointments');
      console.error('Error loading specialist appointments:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    await loadAppointments();
  }, [loadAppointments]);

  const createAppointment = useCallback(async (appointmentData: any): Promise<string | null> => {
    if (!user) return null;

    try {
      setError(null);
      const appointmentId = await databaseService.createAppointment(appointmentData);
      // No need to manually refresh - real-time listener will handle this
      return appointmentId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create appointment');
      console.error('Error creating appointment:', err);
      return null;
    }
  }, [user]);

  const updateAppointment = useCallback(async (id: string, updates: Partial<Appointment>): Promise<void> => {
    try {
      setError(null);
      await databaseService.updateAppointment(id, updates);
      // No need to manually refresh - real-time listener will handle this
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update appointment');
      console.error('Error updating appointment:', err);
    }
  }, []);

  const deleteAppointment = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      await databaseService.deleteAppointment(id);
      // No need to manually refresh - real-time listener will handle this
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete appointment');
      console.error('Error deleting appointment:', err);
    }
  }, []);

  // Set up real-time listener for specialist appointments
  useEffect(() => {
    if (!user) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Subscribe to real-time updates for specialist appointments
    const unsubscribe = databaseService.onAppointmentsChange(
      user.uid, 
      'specialist', 
      (updatedAppointments) => {
        setAppointments(updatedAppointments);
        setLoading(false);
        setError(null);
      }
    );

    // Cleanup subscription on unmount or user change
    return () => {
      unsubscribe();
    };
  }, [user]);

  return {
    appointments,
    loading,
    error,
    refresh,
    createAppointment,
    updateAppointment,
    deleteAppointment,
  };
};
