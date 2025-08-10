import { useState, useEffect, useCallback } from 'react';
import { databaseService, MedicalHistory } from '../../services/database/firebase';
import { useAuth } from '../auth/useAuth';

export interface UseMedicalHistoryReturn {
  medicalHistory: MedicalHistory[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getMedicalHistoryByAppointment: (appointmentId: string, patientId: string) => Promise<MedicalHistory | null>;
}

export const useMedicalHistory = (): UseMedicalHistoryReturn => {
  const { user } = useAuth();
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMedicalHistory = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const userMedicalHistory = await databaseService.getMedicalHistory(user.uid);
      setMedicalHistory(userMedicalHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load medical history');
      console.error('Error loading medical history:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    await loadMedicalHistory();
  }, [loadMedicalHistory]);

  const getMedicalHistoryByAppointment = useCallback(async (
    appointmentId: string, 
    patientId: string
  ): Promise<MedicalHistory | null> => {
    try {
      return await databaseService.getMedicalHistoryByAppointment(appointmentId, patientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get medical history');
      console.error('Error getting medical history:', err);
      return null;
    }
  }, []);

  // Set up real-time listener for medical history
  useEffect(() => {
    if (!user) {
      setMedicalHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Subscribe to real-time updates
    const unsubscribe = databaseService.onMedicalHistoryChange(
      user.uid, 
      (updatedMedicalHistory) => {
        setMedicalHistory(updatedMedicalHistory);
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
    medicalHistory,
    loading,
    error,
    refresh,
    getMedicalHistoryByAppointment,
  };
};
