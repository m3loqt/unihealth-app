import { useState, useEffect, useCallback } from 'react';
import { databaseService } from '../../services/database/firebase';
import { useAuth } from '../auth/useAuth';
import { FeeHistoryEntry } from './useSpecialistProfile';

export interface FeePeriodEarnings {
  fee: number;
  appointments: number;
  referrals: number;
  totalConsultations: number;
  earnings: number;
}

export interface SpecialistEarnings {
  totalEarnings: number;
  totalAppointments: number;
  totalReferrals: number;
  currentFee: number;
  previousFee: number | null;
  currentPeriod: FeePeriodEarnings | null;
  previousPeriod: FeePeriodEarnings | null;
  loading: boolean;
  error: string | null;
}

export interface UseSpecialistEarningsReturn {
  earnings: SpecialistEarnings;
  refreshEarnings: () => Promise<void>;
}

export function useSpecialistEarnings(): UseSpecialistEarningsReturn {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<SpecialistEarnings>({
    totalEarnings: 0,
    totalAppointments: 0,
    totalReferrals: 0,
    currentFee: 0,
    previousFee: null,
    currentPeriod: null,
    previousPeriod: null,
    loading: true,
    error: null,
  });

  // Helper function to get the active fee at a specific date
  const getActiveFeeAtDate = useCallback((feeHistory: any, targetDate: string): number => {
    if (!feeHistory) return 0;
    
    // Convert Firebase object to array (Firebase stores arrays as objects with numeric keys)
    let feeHistoryArray: FeeHistoryEntry[] = [];
    if (Array.isArray(feeHistory)) {
      feeHistoryArray = feeHistory;
    } else if (typeof feeHistory === 'object') {
      feeHistoryArray = Object.values(feeHistory).filter((entry: any) => 
        entry && typeof entry === 'object' && entry.fee && entry.effectiveDate
      ) as FeeHistoryEntry[];
    }
    
    if (feeHistoryArray.length === 0) return 0;
    
    // Sort by effective date (most recent first)
    const sortedHistory = [...feeHistoryArray].sort((a, b) => 
      new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
    );
    
    // Find the most recent fee that was active before or on the target date
    const targetDateTime = new Date(targetDate).getTime();
    
    for (const entry of sortedHistory) {
      const entryDateTime = new Date(entry.effectiveDate).getTime();
      if (entryDateTime <= targetDateTime && entry.status === 'active') {
        return entry.fee;
      }
    }
    
    // If no fee found, return the oldest fee (fallback)
    return sortedHistory[sortedHistory.length - 1]?.fee || 0;
  }, []);

  // Helper function to get the previous fee from fee history
  const getPreviousFee = useCallback((feeHistory: any): number | null => {
    if (!feeHistory) return null;
    
    // Convert Firebase object to array
    let feeHistoryArray: FeeHistoryEntry[] = [];
    if (Array.isArray(feeHistory)) {
      feeHistoryArray = feeHistory;
    } else if (typeof feeHistory === 'object') {
      feeHistoryArray = Object.values(feeHistory).filter((entry: any) => 
        entry && typeof entry === 'object' && entry.fee && entry.effectiveDate
      ) as FeeHistoryEntry[];
    }
    
    if (feeHistoryArray.length < 2) return null;
    
    // Sort by effective date (most recent first)
    const sortedHistory = [...feeHistoryArray].sort((a, b) => 
      new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
    );
    
    // Return the second most recent fee (previous fee)
    return sortedHistory[1]?.fee || null;
  }, []);

  const calculateEarnings = useCallback(async (specialistId: string) => {
    try {
      setEarnings(prev => ({ ...prev, loading: true, error: null }));

      // Get specialist profile and fee history
      const specialistProfile = await databaseService.getSpecialistProfile(specialistId);
      const currentFee = specialistProfile?.professionalFee || 0;
      
      // Get fee history (if it exists)
      const feeHistory = specialistProfile?.feeHistory || [];
      const previousFee = getPreviousFee(feeHistory);
      
      console.log('🔍 Fee History Debug:', {
        specialistId,
        currentFee,
        previousFee,
        feeHistoryRaw: feeHistory,
        feeHistoryType: typeof feeHistory,
        isArray: Array.isArray(feeHistory)
      });
      
      // Get appointments and referrals - use separate sources to avoid duplicates
      const [allAppointmentsData, referrals] = await Promise.all([
        databaseService.getAppointmentsBySpecialist(specialistId), // This already includes referrals
        databaseService.getReferralsBySpecialist(specialistId) // This gets referrals separately
      ]);

      console.log('📊 Earnings Debug - Raw Data:', {
        specialistId,
        totalAppointments: allAppointmentsData.length,
        totalReferrals: referrals.length,
        appointments: allAppointmentsData.map(a => ({ id: a.id, status: a.status, appointmentDate: a.appointmentDate, type: a.type || 'appointment' })),
        referrals: referrals.map(r => ({ id: r.id, status: r.status, appointmentDate: r.appointmentDate }))
      });

      // Separate regular appointments from referrals in the combined data
      const regularAppointments = allAppointmentsData.filter(a => 
        !a.type || 
        (a.type !== 'Referral' && a.type !== 'specialist_referral' && a.type !== 'referral')
      );
      const referralAppointments = allAppointmentsData.filter(a => 
        a.type === 'Referral' || a.type === 'specialist_referral' || a.type === 'referral'
      );
      
      console.log('📊 Earnings Debug - Separated Data:', {
        regularAppointments: regularAppointments.length,
        referralAppointments: referralAppointments.length,
        separateReferrals: referrals.length,
        regularAppointmentsData: regularAppointments.map(a => ({ id: a.id, status: a.status, appointmentDate: a.appointmentDate })),
        referralAppointmentsData: referralAppointments.map(a => ({ id: a.id, status: a.status, appointmentDate: a.appointmentDate }))
      });

      // Filter completed consultations - use only regular appointments and separate referrals to avoid duplicates
      const completedAppointments = regularAppointments.filter(a => a.status === 'completed');
      const completedReferrals = referrals.filter(r => r.status === 'completed');
      
      console.log('📊 Earnings Debug - Final Filtered Data:', {
        completedRegularAppointments: completedAppointments.length,
        completedReferrals: completedReferrals.length,
        totalCompleted: completedAppointments.length + completedReferrals.length,
        completedAppointmentsData: completedAppointments.map(a => ({ id: a.id, status: a.status, appointmentDate: a.appointmentDate, type: a.type })),
        completedReferralsData: completedReferrals.map(r => ({ id: r.id, status: r.status, appointmentDate: r.appointmentDate }))
      });
      
      // Calculate earnings by fee period
      let totalEarnings = 0;
      let currentPeriod: FeePeriodEarnings | null = null;
      let previousPeriod: FeePeriodEarnings | null = null;
      
      if (feeHistory && (Array.isArray(feeHistory) ? feeHistory.length > 0 : Object.keys(feeHistory).length > 0)) {
        // Use historical fees for accurate calculation
        console.log('📊 Using historical fees for calculation');
        
        // Initialize period tracking
        const currentFeeData = { appointments: 0, referrals: 0, earnings: 0 };
        const previousFeeData = { appointments: 0, referrals: 0, earnings: 0 };
        
        // Process appointments
        for (const appointment of completedAppointments) {
          const completionDate = appointment.lastUpdated || appointment.createdAt;
          const feeAtTime = getActiveFeeAtDate(feeHistory, completionDate);
          console.log(`Appointment ${appointment.id}: completionDate=${completionDate}, feeAtTime=${feeAtTime}`);
          totalEarnings += feeAtTime;
          
          if (feeAtTime === currentFee) {
            currentFeeData.appointments++;
            currentFeeData.earnings += feeAtTime;
          } else if (feeAtTime === previousFee) {
            previousFeeData.appointments++;
            previousFeeData.earnings += feeAtTime;
          }
        }
        
        // Process referrals
        for (const referral of completedReferrals) {
          const completionDate = referral.lastUpdated || referral.referralTimestamp;
          const feeAtTime = getActiveFeeAtDate(feeHistory, completionDate);
          console.log(`Referral ${referral.id}: completionDate=${completionDate}, feeAtTime=${feeAtTime}`);
          totalEarnings += feeAtTime;
          
          if (feeAtTime === currentFee) {
            currentFeeData.referrals++;
            currentFeeData.earnings += feeAtTime;
          } else if (feeAtTime === previousFee) {
            previousFeeData.referrals++;
            previousFeeData.earnings += feeAtTime;
          }
        }
        
        // Create period objects
        if (currentFeeData.appointments > 0 || currentFeeData.referrals > 0) {
          currentPeriod = {
            fee: currentFee,
            appointments: currentFeeData.appointments,
            referrals: currentFeeData.referrals,
            totalConsultations: currentFeeData.appointments + currentFeeData.referrals,
            earnings: currentFeeData.earnings
          };
        }
        
        if (previousFee && (previousFeeData.appointments > 0 || previousFeeData.referrals > 0)) {
          previousPeriod = {
            fee: previousFee,
            appointments: previousFeeData.appointments,
            referrals: previousFeeData.referrals,
            totalConsultations: previousFeeData.appointments + previousFeeData.referrals,
            earnings: previousFeeData.earnings
          };
        }
      } else {
        // Fallback to current fee for all consultations
        console.log('📊 Using current fee for all consultations (no fee history)');
        totalEarnings = currentFee * (completedAppointments.length + completedReferrals.length);
        
        currentPeriod = {
          fee: currentFee,
          appointments: completedAppointments.length,
          referrals: completedReferrals.length,
          totalConsultations: completedAppointments.length + completedReferrals.length,
          earnings: totalEarnings
        };
      }

      const finalEarnings = {
        totalEarnings,
        totalAppointments: completedAppointments.length,
        totalReferrals: completedReferrals.length,
        currentFee,
        previousFee,
        currentPeriod,
        previousPeriod,
        loading: false,
        error: null,
      };

      setEarnings(finalEarnings);

      console.log('💰 Specialist Earnings Calculated:', {
        specialistId,
        currentFee,
        totalAppointments: completedAppointments.length,
        totalReferrals: completedReferrals.length,
        totalEarnings,
        usingHistoricalFees: feeHistory.length > 0,
        finalEarningsBreakdown: {
          appointments: finalEarnings.totalAppointments,
          referrals: finalEarnings.totalReferrals,
          total: finalEarnings.totalAppointments + finalEarnings.totalReferrals
        }
      });

    } catch (error) {
      console.error('Error calculating specialist earnings:', error);
      setEarnings(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to calculate earnings',
      }));
    }
  }, [getActiveFeeAtDate]);


  const refreshEarnings = useCallback(async () => {
    if (user?.uid) {
      await calculateEarnings(user.uid);
    }
  }, [user?.uid, calculateEarnings]);


  // Initial calculation when component mounts
  useEffect(() => {
    if (user?.uid) {
      calculateEarnings(user.uid);
    }
  }, [user?.uid, calculateEarnings]);

  return {
    earnings,
    refreshEarnings,
  };
}
