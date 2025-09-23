import { databaseService } from './firebase';
import { getCurrentLocalTimestamp } from '../../utils/date';

export interface NotificationData {
  type: 'appointment' | 'referral' | 'prescription' | 'certificate';
  title: string;
  message: string;
  userId: string;
  relatedId: string;
}

export const notificationService = {
  async createNotification(notificationData: NotificationData): Promise<string> {
    try {
      const notification = {
        ...notificationData,
        timestamp: getCurrentLocalTimestamp(),
        read: false,
      };
      
      return await databaseService.pushDocument('notifications', notification);
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  },

  async createAppointmentNotification(
    userId: string, 
    appointmentId: string, 
    action: 'created' | 'updated' | 'cancelled' | 'confirmed',
    appointmentData: any
  ): Promise<void> {
    const notifications = [];
    
    // Notification for patient
    if (action === 'created') {
      notifications.push({
        type: 'appointment' as const,
        title: 'Appointment Booked',
        message: `Your appointment with Dr. ${appointmentData.doctorLastName} on ${appointmentData.appointmentDate} at ${appointmentData.appointmentTime} has been successfully booked.`,
        userId: appointmentData.patientId,
        relatedId: appointmentId,
      });
    } else if (action === 'updated') {
      notifications.push({
        type: 'appointment' as const,
        title: 'Appointment Updated',
        message: `Your appointment with Dr. ${appointmentData.doctorLastName} has been updated.`,
        userId: appointmentData.patientId,
        relatedId: appointmentId,
      });
    } else if (action === 'cancelled') {
      notifications.push({
        type: 'appointment' as const,
        title: 'Appointment Cancelled',
        message: `Your appointment with Dr. ${appointmentData.doctorLastName} on ${appointmentData.appointmentDate} has been cancelled.`,
        userId: appointmentData.patientId,
        relatedId: appointmentId,
      });
    } else if (action === 'confirmed') {
      notifications.push({
        type: 'appointment' as const,
        title: 'Appointment Confirmed',
        message: `Your appointment with Dr. ${appointmentData.doctorLastName} on ${appointmentData.appointmentDate} at ${appointmentData.appointmentTime} has been confirmed.`,
        userId: appointmentData.patientId,
        relatedId: appointmentId,
      });
    }

    // Create all notifications
    for (const notification of notifications) {
      await this.createNotification(notification);
    }
  },

  async createReferralNotification(
    specialistId: string,
    referralId: string,
    action: 'received' | 'confirmed' | 'cancelled',
    referralData: any
  ): Promise<void> {
    const notifications = [];
    
    if (action === 'received') {
      notifications.push({
        type: 'referral' as const,
        title: 'New Referral Received',
        message: `You have received a new referral for ${referralData.patientFirstName} ${referralData.patientLastName}.`,
        userId: specialistId,
        relatedId: referralId,
      });
    } else if (action === 'confirmed') {
      notifications.push({
        type: 'referral' as const,
        title: 'Referral Confirmed',
        message: `Your referral to Dr. ${referralData.assignedSpecialistLastName} has been confirmed.`,
        userId: referralData.patientId,
        relatedId: referralId,
      });
    } else if (action === 'cancelled') {
      notifications.push({
        type: 'referral' as const,
        title: 'Referral Cancelled',
        message: `Your referral to Dr. ${referralData.assignedSpecialistLastName} has been cancelled.`,
        userId: referralData.patientId,
        relatedId: referralId,
      });
    }

    // Create all notifications
    for (const notification of notifications) {
      await this.createNotification(notification);
    }
  },

  async createPrescriptionNotification(
    patientId: string,
    prescriptionId: string,
    action: 'created' | 'updated',
    prescriptionData: any
  ): Promise<void> {
    const notifications = [];
    
    if (action === 'created') {
      notifications.push({
        type: 'prescription' as const,
        title: 'New Prescription',
        message: `You have a new prescription for ${prescriptionData.medication}.`,
        userId: patientId,
        relatedId: prescriptionId,
      });
    } else if (action === 'updated') {
      notifications.push({
        type: 'prescription' as const,
        title: 'Prescription Updated',
        message: `Your prescription for ${prescriptionData.medication} has been updated.`,
        userId: patientId,
        relatedId: prescriptionId,
      });
    }

    // Create all notifications
    for (const notification of notifications) {
      await this.createNotification(notification);
    }
  },

  async createCertificateNotification(
    patientId: string,
    certificateId: string,
    action: 'issued' | 'updated',
    certificateData: any
  ): Promise<void> {
    const notifications = [];
    
    if (action === 'issued') {
      notifications.push({
        type: 'certificate' as const,
        title: 'Medical Certificate Issued',
        message: `Your ${certificateData.type} has been issued.`,
        userId: patientId,
        relatedId: certificateId,
      });
    } else if (action === 'updated') {
      notifications.push({
        type: 'certificate' as const,
        title: 'Medical Certificate Updated',
        message: `Your ${certificateData.type} has been updated.`,
        userId: patientId,
        relatedId: certificateId,
      });
    }

    // Create all notifications
    for (const notification of notifications) {
      await this.createNotification(notification);
    }
  },
};
