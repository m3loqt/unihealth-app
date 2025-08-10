import { useState, useEffect, useCallback } from 'react';
import { databaseService } from '../../services/database/firebase';
import { useAuth } from '../auth/useAuth';

export interface PatientProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  contactNumber?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  profileImage?: string;
  lastUpdated?: string;
}

export interface UsePatientProfileReturn {
  profile: PatientProfile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateProfile: (updates: Partial<PatientProfile>) => Promise<void>;
}

export const usePatientProfile = (): UsePatientProfileReturn => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      const patientProfile = await databaseService.getPatientProfile(user.uid);
      setProfile(patientProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
      console.error('Error loading patient profile:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  const updateProfile = useCallback(async (updates: Partial<PatientProfile>): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      setError(null);
      await databaseService.updatePatientProfile(user.uid, updates);
      // No need to manually refresh - real-time listener will handle this
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      console.error('Error updating patient profile:', err);
      throw err;
    }
  }, [user]);

  // Set up real-time listener for patient profile
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    console.log('=== usePatientProfile: Setting up real-time listener ===');
    console.log('User ID:', user.uid);

    // Subscribe to real-time updates
    const unsubscribe = databaseService.onPatientProfileChange(
      user.uid,
      (updatedProfile) => {
        console.log('=== usePatientProfile: Real-time update received ===');
        console.log('Updated profile:', updatedProfile);
        console.log('Contact number:', updatedProfile?.contactNumber);
        console.log('Address:', updatedProfile?.address);
        console.log('Address field type:', typeof updatedProfile?.address);
        console.log('Address field length:', updatedProfile?.address?.length);
        console.log('Previous profile state:', profile);
        console.log('Setting new profile state...');
        console.log('==============================================');
        
        setProfile(updatedProfile);
        setLoading(false);
        setError(null);
      }
    );

    // Cleanup subscription on unmount or user change
    return () => {
      console.log('=== usePatientProfile: Cleaning up listener ===');
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
