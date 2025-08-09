import { useState, useEffect, useCallback } from 'react';
import { databaseService, Prescription } from '../../services/database/firebase';
import { useAuth } from '../auth/useAuth';

export interface UsePrescriptionsReturn {
  prescriptions: Prescription[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createPrescription: (prescriptionData: any) => Promise<string | null>;
  updatePrescription: (id: string, updates: Partial<Prescription>) => Promise<void>;
  deletePrescription: (id: string) => Promise<void>;
}

export const usePrescriptions = (): UsePrescriptionsReturn => {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPrescriptions = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const userPrescriptions = await databaseService.getPrescriptions(user.uid);
      setPrescriptions(userPrescriptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prescriptions');
      console.error('Error loading prescriptions:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    await loadPrescriptions();
  }, [loadPrescriptions]);

  const createPrescription = useCallback(async (prescriptionData: any): Promise<string | null> => {
    if (!user) return null;

    try {
      setError(null);
      const prescriptionId = await databaseService.createPrescription(prescriptionData);
      await loadPrescriptions(); // Refresh the list
      return prescriptionId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create prescription');
      console.error('Error creating prescription:', err);
      return null;
    }
  }, [user, loadPrescriptions]);

  const updatePrescription = useCallback(async (id: string, updates: Partial<Prescription>): Promise<void> => {
    try {
      setError(null);
      // TODO: Implement updatePrescription in database service
      console.warn('updatePrescription not yet implemented');
      await loadPrescriptions(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update prescription');
      console.error('Error updating prescription:', err);
    }
  }, [loadPrescriptions]);

  const deletePrescription = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      // TODO: Implement deletePrescription in database service
      console.warn('deletePrescription not yet implemented');
      await loadPrescriptions(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete prescription');
      console.error('Error deleting prescription:', err);
    }
  }, [loadPrescriptions]);

  useEffect(() => {
    loadPrescriptions();
  }, [loadPrescriptions]);

  return {
    prescriptions,
    loading,
    error,
    refresh,
    createPrescription,
    updatePrescription,
    deletePrescription,
  };
}; 