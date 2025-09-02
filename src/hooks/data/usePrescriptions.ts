import { useState, useEffect, useCallback } from 'react';
import { databaseService, Prescription } from '../../services/database/firebase';
import { useAuth } from '../auth/useAuth';

export interface UsePrescriptionsReturn {
  prescriptions: Prescription[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
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



  // Set up real-time listener for prescriptions from both sources
  useEffect(() => {
    if (!user) {
      setPrescriptions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    let dedicatedPrescriptions: Prescription[] = [];
    let medicalHistoryPrescriptions: Prescription[] = [];
    let currentMedicalHistory: any[] = [];
    
    // Function to combine both sources and update state
    const combineAndUpdatePrescriptions = () => {
      try {
        // Create a map of appointmentId to dedicated prescription for quick lookup
        const dedicatedPrescriptionMap = new Map();
        dedicatedPrescriptions.forEach(prescription => {
          if (prescription.appointmentId) {
            dedicatedPrescriptionMap.set(prescription.appointmentId, prescription);
          }
        });
        
        // Update medical history prescriptions with the latest dedicated prescription dates
        const updatedMedicalHistoryPrescriptions = medicalHistoryPrescriptions.map(prescription => {
          // Try to find the corresponding dedicated prescription by matching the prescription ID pattern
          const prescriptionIdParts = prescription.id.split('_prescription_');
          if (prescriptionIdParts.length === 2) {
            const entryId = prescriptionIdParts[0];
            const prescriptionIndex = prescriptionIdParts[1];
            
            // Find the medical history entry that contains this prescription
            const entry = currentMedicalHistory?.find(entry => entry.id === entryId);
            if (entry?.relatedAppointment?.id) {
              const dedicatedPrescription = dedicatedPrescriptionMap.get(entry.relatedAppointment.id);
              if (dedicatedPrescription?.prescribedDate) {
                return {
                  ...prescription,
                  prescribedDate: dedicatedPrescription.prescribedDate
                };
              }
            }
          }
          
          return prescription;
        });
        
        // Combine both sources and remove duplicates
        const allPrescriptions = [...dedicatedPrescriptions, ...updatedMedicalHistoryPrescriptions];
        const uniquePrescriptions = allPrescriptions.filter((prescription, index, self) => 
          index === self.findIndex(p => p.id === prescription.id)
        );
        
        const sortedPrescriptions = uniquePrescriptions.sort((a, b) => 
          new Date(b.prescribedDate).getTime() - new Date(a.prescribedDate).getTime()
        );
        
        setPrescriptions(sortedPrescriptions);
        setLoading(false);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load prescriptions');
        setLoading(false);
      }
    };
    
    // Subscribe to real-time updates from dedicated prescriptions node
    const unsubscribePrescriptions = databaseService.onPrescriptionsChange(
      user.uid,
      (prescriptions) => {
        dedicatedPrescriptions = prescriptions;
        combineAndUpdatePrescriptions();
      }
    );
    
    // Subscribe to real-time updates from medical history
    const unsubscribeMedicalHistory = databaseService.onMedicalHistoryChange(
      user.uid,
      (medicalHistory) => {
        currentMedicalHistory = medicalHistory;
        // Extract prescriptions from medical history entries
        const prescriptionsFromEntries: Prescription[] = [];
        medicalHistory.forEach((entry) => {
          if (entry.prescriptions) {
            entry.prescriptions.forEach((prescription: any, index: number) => {
              // Check if there's a corresponding prescription in the dedicated node
              const dedicatedPrescription = dedicatedPrescriptions.find(
                dp => dp.appointmentId === entry.relatedAppointment?.id
              );
              
              prescriptionsFromEntries.push({
                id: `${entry.id}_prescription_${index}`,
                patientId: user.uid,
                specialistId: entry.provider?.id || 'Unknown',
                medication: prescription.medication,
                dosage: prescription.dosage,
                frequency: prescription.frequency || 'As needed',
                duration: prescription.duration || 'Ongoing',
                instructions: prescription.instructions || 'As prescribed',
                // Use dedicated prescription date if available, otherwise fall back to consultation date
                prescribedDate: dedicatedPrescription?.prescribedDate || entry.consultationDate,
                status: 'active',
                route: prescription.route,
              });
            });
          }
        });
        
        medicalHistoryPrescriptions = prescriptionsFromEntries;
        combineAndUpdatePrescriptions();
      }
    );

    // Cleanup subscription on unmount or user change
    return () => {
      unsubscribePrescriptions();
      unsubscribeMedicalHistory();
    };
  }, [user]);

  return {
    prescriptions,
    loading,
    error,
    refresh,
  };
}; 