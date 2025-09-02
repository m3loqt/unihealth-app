import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/useAuth';
import { databaseService } from '../../services/database/firebase';
import { notificationService } from '../../services/notificationService';

export const useMedicalHistoryNotifications = () => {
  const { user } = useAuth();
  const previousDataRef = useRef<{ prescriptions: any[], certificates: any[] }>({ prescriptions: [], certificates: [] });
  const cleanupRunRef = useRef<boolean>(false);

  useEffect(() => {
    if (!user?.uid) return;

    console.log('🔔 Setting up medical history notifications monitoring for user:', user.uid);

    // Clean up old processed notifications and existing duplicates on startup (only once per session)
    if (!cleanupRunRef.current) {
      console.log('🧹 Running one-time cleanup for user:', user.uid);
      databaseService.cleanupProcessedNotifications(user.uid).catch(error => {
        console.error('❌ Error during processed notifications cleanup:', error);
      });
      databaseService.cleanupDuplicateNotifications(user.uid).catch(error => {
        console.error('❌ Error during duplicate notifications cleanup:', error);
      });
      cleanupRunRef.current = true;
    }

    const unsubscribe = databaseService.onMedicalHistoryPrescriptionsAndCertificatesChange(
      user.uid,
      async (currentData) => {
        const previousData = previousDataRef.current;
        
        // Check for new prescriptions
        if (currentData.prescriptions.length > previousData.prescriptions.length) {
          const newPrescriptions = currentData.prescriptions.filter(
            (currentPrescription) => 
              !previousData.prescriptions.some(
                (prevPrescription) => prevPrescription.id === currentPrescription.id
              )
          );

          // Create notifications for new prescriptions (with persistent duplicate prevention)
          for (const prescription of newPrescriptions) {
            // Validate prescription data
            if (!prescription.entryId || !prescription.medication) {
              console.warn('⚠️ Invalid prescription data:', prescription);
              continue;
            }

            const notificationKey = `prescription-${prescription.entryId}-${prescription.medication}`;
            console.log('🔍 Processing prescription notification key:', notificationKey);
            
            // Check if we've already processed this notification (database check)
            const isProcessed = await databaseService.isNotificationProcessed(user.uid, notificationKey);
            if (isProcessed) {
              console.log('🔔 Skipping duplicate prescription notification for:', prescription.medication);
              continue;
            }

            try {
              console.log('🔔 Creating prescription notification for:', prescription.medication);
              await notificationService.createPrescriptionNotificationFromMedicalHistory(
                user.uid,
                prescription.entryId,
                {
                  medication: prescription.medication,
                  dosage: prescription.dosage,
                  frequency: prescription.frequency,
                  duration: prescription.duration,
                  route: prescription.route,
                  formula: prescription.formula,
                  prescribedDate: prescription.prescribedDate,
                  doctorId: prescription.doctorId,
                  appointmentId: prescription.appointmentId,
                  referralId: prescription.referralId
                }
              );
              
              // Mark this notification as processed in database
              console.log('🔍 Marking prescription notification as processed:', notificationKey);
              await databaseService.markNotificationAsProcessed(user.uid, notificationKey);
            } catch (error) {
              console.error('❌ Failed to create prescription notification:', error);
            }
          }
        }

        // Check for new certificates
        if (currentData.certificates.length > previousData.certificates.length) {
          const newCertificates = currentData.certificates.filter(
            (currentCertificate) => 
              !previousData.certificates.some(
                (prevCertificate) => prevCertificate.id === currentCertificate.id
              )
          );

          // Create notifications for new certificates (with persistent duplicate prevention)
          for (const certificate of newCertificates) {
            // Validate certificate data
            if (!certificate.entryId || !certificate.type) {
              console.warn('⚠️ Invalid certificate data:', certificate);
              continue;
            }

            const notificationKey = `certificate-${certificate.entryId}-${certificate.type}`;
            console.log('🔍 Processing certificate notification key:', notificationKey);
            
            // Check if we've already processed this notification (database check)
            const isProcessed = await databaseService.isNotificationProcessed(user.uid, notificationKey);
            if (isProcessed) {
              console.log('🔔 Skipping duplicate certificate notification for:', certificate.type);
              continue;
            }

            try {
              console.log('🔔 Creating certificate notification for:', certificate.type);
              await notificationService.createCertificateNotificationFromMedicalHistory(
                user.uid,
                certificate.entryId,
                {
                  type: certificate.type,
                  fitnessStatement: certificate.fitnessStatement,
                  workRestrictions: certificate.workRestrictions,
                  issuedDate: certificate.issuedDate,
                  issuedTime: certificate.issuedTime,
                  status: certificate.status,
                  doctorId: certificate.doctorId,
                  appointmentId: certificate.appointmentId,
                  referralId: certificate.referralId
                }
              );
              
              // Mark this notification as processed in database
              console.log('🔍 Marking certificate notification as processed:', notificationKey);
              await databaseService.markNotificationAsProcessed(user.uid, notificationKey);
            } catch (error) {
              console.error('❌ Failed to create certificate notification:', error);
            }
          }
        }

        // Update the previous data reference
        previousDataRef.current = currentData;
      }
    );

    return () => {
      console.log('🔔 Cleaning up medical history notifications monitoring');
      unsubscribe();
    };
  }, [user?.uid]);

  return null; // This hook doesn't return any data, it just monitors and creates notifications
};
