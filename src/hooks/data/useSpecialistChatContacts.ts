import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSpecialistChatPatients, SpecialistChatPatient } from './useSpecialistChatPatients';
import { useSpecialistChatGeneralists, SpecialistChatGeneralist } from './useSpecialistChatGeneralists';

export interface SpecialistChatContact {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'patient' | 'generalist';
  specialty?: string;
  avatar?: string;
  source: 'appointment' | 'referral';
  sourceId: string;
  lastInteraction?: number;
}

export function useSpecialistChatContacts() {
  const [contacts, setContacts] = useState<SpecialistChatContact[]>([]);

  const { 
    patients, 
    loading: patientsLoading, 
    error: patientsError, 
    loadPatients 
  } = useSpecialistChatPatients();

  const { 
    generalists, 
    loading: generalistsLoading, 
    error: generalistsError, 
    loadGeneralists 
  } = useSpecialistChatGeneralists();

  const loadContacts = useCallback(async (specialistId: string) => {
    if (!specialistId) {
      setContacts([]);
      return;
    }

    // Load both patients and generalists in parallel
    await Promise.all([
      loadPatients(specialistId),
      loadGeneralists(specialistId)
    ]);
  }, [loadPatients, loadGeneralists]);

  // Memoize the combined contacts to prevent unnecessary re-renders
  const combinedContacts = useMemo(() => {
    if (patientsLoading || generalistsLoading) {
      return [];
    }

    const allContacts: SpecialistChatContact[] = [
      ...patients.map(patient => ({
        uid: patient.uid,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        role: 'patient' as const,
        specialty: patient.specialty,
        avatar: patient.avatar,
        source: patient.source,
        sourceId: patient.sourceId,
        lastInteraction: patient.lastInteraction,
      })),
      ...generalists.map(generalist => ({
        uid: generalist.uid,
        firstName: generalist.firstName,
        lastName: generalist.lastName,
        email: generalist.email,
        role: 'generalist' as const,
        specialty: generalist.specialty,
        avatar: generalist.avatar,
        source: generalist.source,
        sourceId: generalist.sourceId,
        lastInteraction: generalist.lastInteraction,
      }))
    ];

    // Sort by last interaction (most recent first)
    allContacts.sort((a, b) => {
      const timeA = a.lastInteraction || 0;
      const timeB = b.lastInteraction || 0;
      return timeB - timeA;
    });

    return allContacts;
  }, [patients, generalists, patientsLoading, generalistsLoading]);

  // Update contacts when the memoized value changes
  useEffect(() => {
    setContacts(combinedContacts);
  }, [combinedContacts]);

  const refresh = useCallback(async (specialistId: string) => {
    await loadContacts(specialistId);
  }, [loadContacts]);

  return {
    contacts,
    loading: patientsLoading || generalistsLoading,
    error: patientsError || generalistsError,
    loadContacts,
    refresh,
  };
}
