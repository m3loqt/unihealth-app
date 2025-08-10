import { useState, useEffect, useCallback } from 'react';
import { databaseService } from '../../services/database/firebase';
import { useAuth } from '../auth/useAuth';

export interface SpecialistProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  contactNumber?: string;
  address?: string;
  specialty?: string;
  yearsOfExperience?: number;
  medicalLicenseNumber?: string;
  prcId?: string;
  prcExpiryDate?: string;
  professionalFee?: number;
  gender?: string;
  dateOfBirth?: string;
  civilStatus?: string;
  status?: string;
  clinicAffiliations?: string[];
  lastUpdated?: string;
}

export interface UseSpecialistProfileReturn {
  profile: SpecialistProfile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateProfile: (updates: Partial<SpecialistProfile>) => Promise<void>;
}

export const useSpecialistProfile = (): UseSpecialistProfileReturn => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<SpecialistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      const specialistProfile = await databaseService.getSpecialistProfile(user.uid);
      setProfile(specialistProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
      console.error('Error loading specialist profile:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  const updateProfile = useCallback(async (updates: Partial<SpecialistProfile>): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      setError(null);
      await databaseService.updateSpecialistProfile(user.uid, updates);
      // No need to manually refresh - real-time listener will handle this
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      console.error('Error updating specialist profile:', err);
      throw err;
    }
  }, [user]);

  // Set up real-time listener for specialist profile
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Subscribe to real-time updates
    const unsubscribe = databaseService.onSpecialistProfileChange(
      user.uid,
      (updatedProfile) => {
        setProfile(updatedProfile);
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
    profile,
    loading,
    error,
    refresh,
    updateProfile,
  };
};
