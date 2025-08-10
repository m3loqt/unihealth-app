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
      // No need to manually refresh - real-time listener will handle this
      return prescriptionId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create prescription');
      console.error('Error creating prescription:', err);
      return null;
    }
  }, [user]);

  const updatePrescription = useCallback(async (id: string, updates: Partial<Prescription>): Promise<void> => {
    try {
      setError(null);
      await databaseService.updatePrescription(id, updates);
      // No need to manually refresh - real-time listener will handle this
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update prescription');
      console.error('Error updating prescription:', err);
    }
  }, []);

  const deletePrescription = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      await databaseService.deletePrescription(id);
      // No need to manually refresh - real-time listener will handle this
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete prescription');
      console.error('Error deleting prescription:', err);
    }
  }, []);

  // Set up real-time listener for prescriptions
  useEffect(() => {
    if (!user) {
      setPrescriptions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Subscribe to real-time updates
    const unsubscribe = databaseService.onPrescriptionsChange(
      user.uid, 
      (updatedPrescriptions) => {
        setPrescriptions(updatedPrescriptions);
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
    prescriptions,
    loading,
    error,
    refresh,
    createPrescription,
    updatePrescription,
    deletePrescription,
  };
}; 