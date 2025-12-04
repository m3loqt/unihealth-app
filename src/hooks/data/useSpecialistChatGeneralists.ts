import { useState, useEffect, useCallback } from 'react';
import { databaseService } from '@/services/database/firebase';

export interface SpecialistChatGeneralist {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'generalist';
  specialty?: string;
  avatar?: string;
  source: 'referral';
  sourceId: string; // referralId
  lastInteraction?: number;
}

export function useSpecialistChatGeneralists() {
  const [generalists, setGeneralists] = useState<SpecialistChatGeneralist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGeneralists = useCallback(async (specialistId: string) => {
    if (!specialistId) {
      setGeneralists([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const generalistsMap = new Map<string, SpecialistChatGeneralist>();

      // Fetch referrals where this specialist is assigned
      const referrals = await databaseService.getReferralsBySpecialist(specialistId);
      console.log(' Loaded referrals for specialist:', referrals.length);

      for (const referral of referrals) {
        if (referral.referringGeneralistId && referral.referringGeneralistId !== specialistId) {
          try {
            // Get generalist data from users node
            const generalistData = await databaseService.getDocument(`users/${referral.referringGeneralistId}`);
            
            if (generalistData) {
              const generalistKey = referral.referringGeneralistId;
              
              // Only add if not already added or if this referral is more recent
              if (!generalistsMap.has(generalistKey) || 
                  (referral.referralTimestamp && 
                   (!generalistsMap.get(generalistKey)?.lastInteraction || 
                    new Date(referral.referralTimestamp).getTime() > (generalistsMap.get(generalistKey)?.lastInteraction || 0)))) {
                
                generalistsMap.set(generalistKey, {
                  uid: referral.referringGeneralistId,
                  firstName: generalistData.firstName || generalistData.first_name || referral.referringGeneralistFirstName || 'Unknown',
                  lastName: generalistData.lastName || generalistData.last_name || referral.referringGeneralistLastName || 'Generalist',
                  email: generalistData.email || '',
                  role: 'generalist',
                  specialty: 'General Medicine', // Generalists typically have this specialty
                  avatar: generalistData.avatar || generalistData.profilePicture || '',
                  source: 'referral',
                  sourceId: referral.id || referral.referringGeneralistId,
                  lastInteraction: referral.referralTimestamp ? new Date(referral.referralTimestamp).getTime() : Date.now(),
                });
              }
            }
          } catch (generalistError) {
            console.error('Error loading generalist data for referral:', referral.id, generalistError);
          }
        }
      }

      // Convert map to array and sort by last interaction
      const generalistsArray = Array.from(generalistsMap.values()).sort((a, b) => {
        const timeA = a.lastInteraction || 0;
        const timeB = b.lastInteraction || 0;
        return timeB - timeA; // Most recent first
      });

      console.log(' Final generalists for specialist:', generalistsArray.length);
      setGeneralists(generalistsArray);
    } catch (error) {
      console.error('Error loading specialist generalists:', error);
      setError('Failed to load generalists. Please try again.');
      setGeneralists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    // This will be called by the component with the current specialist ID
    // The component should call loadGeneralists with the specialist ID
  }, []);

  return {
    generalists,
    loading,
    error,
    loadGeneralists,
    refresh,
  };
}
