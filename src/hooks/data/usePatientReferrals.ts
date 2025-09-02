import { useState, useEffect, useCallback } from 'react';
import { databaseService, Referral } from '../../services/database/firebase';
import { useAuth } from '../auth/useAuth';

export interface UsePatientReferralsReturn {
  referrals: Referral[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getReferralById: (referralId: string) => Promise<Referral | null>;
}

export const usePatientReferrals = (): UsePatientReferralsReturn => {
  const { user } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReferrals = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const patientReferrals = await databaseService.getReferralsByPatient(user.uid);
      setReferrals(patientReferrals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load referrals');
      console.error('Error loading patient referrals:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    await loadReferrals();
  }, [loadReferrals]);

  const getReferralById = useCallback(async (referralId: string): Promise<Referral | null> => {
    try {
      return await databaseService.getReferralById(referralId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get referral');
      console.error('Error getting referral:', err);
      return null;
    }
  }, []);

  // Set up real-time listener for patient referrals
  useEffect(() => {
    if (!user) {
      setReferrals([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Subscribe to real-time updates for patient referrals
    const unsubscribe = databaseService.onReferralsChange(
      user.uid, 
      (updatedReferrals) => {
        setReferrals(updatedReferrals);
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
    referrals,
    loading,
    error,
    refresh,
    getReferralById,
  };
};
