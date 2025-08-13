import { useState, useEffect, useCallback } from 'react';
import { databaseService, Referral } from '../../services/database/firebase';
import { useAuth } from '../auth/useAuth';

export interface UseReferralsReturn {
  referrals: Referral[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateReferralStatus: (referralId: string, status: 'confirmed' | 'cancelled', declineReason?: string, specialistNotes?: string) => Promise<void>;
  getReferralById: (referralId: string) => Promise<Referral | null>;
}

export const useReferrals = (): UseReferralsReturn => {
  const { user } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReferrals = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const userReferrals = await databaseService.getReferralsBySpecialist(user.uid);
      setReferrals(userReferrals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load referrals');
      console.error('Error loading referrals:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    await loadReferrals();
  }, [loadReferrals]);

  const updateReferralStatus = useCallback(async (
    referralId: string, 
    status: 'confirmed' | 'cancelled', 
    declineReason?: string, 
    specialistNotes?: string
  ): Promise<void> => {
    try {
      setError(null);
      await databaseService.updateReferralStatus(referralId, status, declineReason, specialistNotes);
      // No need to manually refresh - real-time listener will handle this
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update referral status');
      console.error('Error updating referral status:', err);
    }
  }, []);

  const getReferralById = useCallback(async (referralId: string): Promise<Referral | null> => {
    try {
      return await databaseService.getReferralById(referralId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get referral');
      console.error('Error getting referral:', err);
      return null;
    }
  }, []);

  // Set up real-time listener for referrals
  useEffect(() => {
    if (!user) {
      setReferrals([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Subscribe to real-time updates
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
    updateReferralStatus,
    getReferralById,
  };
};
