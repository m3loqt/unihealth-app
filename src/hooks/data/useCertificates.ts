import { useState, useEffect, useCallback } from 'react';
import { databaseService, Certificate } from '../../services/database/firebase';
import { useAuth } from '../auth/useAuth';

export interface UseCertificatesReturn {
  certificates: Certificate[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createCertificate: (certificateData: any, patientId: string, appointmentId?: string) => Promise<string | null>;
  updateCertificate: (id: string, updates: Partial<Certificate>) => Promise<void>;
  deleteCertificate: (id: string) => Promise<void>;
  getCertificateById: (certificateId: string) => Promise<Certificate | null>;
}

export const useCertificates = (): UseCertificatesReturn => {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCertificates = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const userCertificates = await databaseService.getCertificatesByPatientNew(user.uid);
      setCertificates(userCertificates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load certificates');
      console.error('Error loading certificates:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    await loadCertificates();
  }, [loadCertificates]);

  const createCertificate = useCallback(async (
    certificateData: any, 
    patientId: string,
    appointmentId?: string  // Optional - only for certificates from consultations
  ): Promise<string | null> => {
    if (!user) return null;

    try {
      setError(null);
      const certificateId = await databaseService.createCertificateInNewStructure(
        certificateData,
        patientId,
        user.uid,
        appointmentId  // Will be undefined for standalone certificates
      );
      // No need to manually refresh - real-time listener will handle this
      return certificateId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create certificate');
      console.error('Error creating certificate:', err);
      return null;
    }
  }, [user]);

  const updateCertificate = useCallback(async (id: string, updates: Partial<Certificate>): Promise<void> => {
    try {
      setError(null);
      await databaseService.updateCertificate(id, updates);
      // No need to manually refresh - real-time listener will handle this
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update certificate');
      console.error('Error updating certificate:', err);
    }
  }, []);

  const deleteCertificate = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      await databaseService.deleteCertificate(id);
      // No need to manually refresh - real-time listener will handle this
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete certificate');
      console.error('Error deleting certificate:', err);
    }
  }, []);

  const getCertificateById = useCallback(async (certificateId: string): Promise<Certificate | null> => {
    try {
      return await databaseService.getCertificateById(certificateId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get certificate');
      console.error('Error getting certificate:', err);
      return null;
    }
  }, []);

  // Set up real-time listener for certificates
  useEffect(() => {
    if (!user) {
      setCertificates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Subscribe to real-time updates
    const unsubscribe = databaseService.onCertificatesChange(
      user.uid, 
      (updatedCertificates) => {
        setCertificates(updatedCertificates);
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
    certificates,
    loading,
    error,
    refresh,
    createCertificate,
    updateCertificate,
    deleteCertificate,
    getCertificateById,
  };
};
