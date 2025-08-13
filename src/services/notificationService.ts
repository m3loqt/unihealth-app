import { databaseService, Notification } from './database/firebase';

export interface NotificationPayload {
  title: string;
  message: string;
  type: 'appointment' | 'referral' | 'prescription' | 'certificate';
  relatedId: string;
  priority: 'low' | 'medium' | 'high';
}

class NotificationService {
  async createAppointmentStatusNotification(
    userId: string,
    appointmentId: string,
    status: string,
    appointmentDetails: {
      date: string;
      time: string;
      doctorName: string;
      clinicName: string;
    }
  ): Promise<string> {
    const statusMessages = {
      'confirmed': {
        title: 'Appointment Confirmed!',
        message: `Your appointment with Dr. ${appointmentDetails.doctorName} on ${appointmentDetails.date} at ${appointmentDetails.time} has been confirmed.`,
        priority: 'high' as const
      },
      'completed': {
        title: 'Appointment Completed',
        message: `Your appointment with Dr. ${appointmentDetails.doctorName} has been marked as completed.`,
        priority: 'medium' as const
      },
      'cancelled': {
        title: 'Appointment Cancelled',
        message: `Your appointment with Dr. ${appointmentDetails.doctorName} on ${appointmentDetails.date} has been cancelled.`,
        priority: 'high' as const
      },
      'pending': {
        title: 'Appointment Pending',
        message: `Your appointment with Dr. ${appointmentDetails.doctorName} on ${appointmentDetails.date} is pending confirmation.`,
        priority: 'medium' as const
      }
    };

    const message = statusMessages[status as keyof typeof statusMessages];
    
    if (message) {
      return await databaseService.createNotification({
        userId,
        type: 'appointment',
        title: message.title,
        message: message.message,
        timestamp: Date.now(),
        read: false,
        relatedId: appointmentId,
        priority: message.priority,
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days from now
      });
    }
    
    throw new Error(`Unknown appointment status: ${status}`);
  }

  async createDoctorNotification(
    doctorId: string,
    appointmentId: string,
    status: string,
    appointmentDetails: {
      date: string;
      time: string;
      patientName: string;
      clinicName: string;
    }
  ): Promise<string> {
    const statusMessages = {
      'confirmed': {
        title: 'New Appointment Confirmed',
        message: `Appointment with ${appointmentDetails.patientName} on ${appointmentDetails.date} at ${appointmentDetails.time} has been confirmed.`,
        priority: 'high' as const
      },
      'completed': {
        title: 'Appointment Completed',
        message: `Appointment with ${appointmentDetails.patientName} has been marked as completed.`,
        priority: 'medium' as const
      },
      'cancelled': {
        title: 'Appointment Cancelled',
        message: `Appointment with ${appointmentDetails.patientName} on ${appointmentDetails.date} has been cancelled.`,
        priority: 'high' as const
      }
    };

    const message = statusMessages[status as keyof typeof statusMessages];
    
    if (message) {
      return await databaseService.createNotification({
        userId: doctorId,
        type: 'appointment',
        title: message.title,
        message: message.message,
        timestamp: Date.now(),
        read: false,
        relatedId: appointmentId,
        priority: message.priority,
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days from now
      });
    }
    
    throw new Error(`Unknown appointment status: ${status}`);
  }

  async createReferralNotification(
    userId: string,
    referralId: string,
    status: string,
    referralDetails: {
      patientName: string;
      specialty: string;
      clinicName: string;
    }
  ): Promise<string> {
        const statusMessages = {
      'confirmed': {
        title: 'Referral Confirmed',
        message: `Your referral to ${referralDetails.specialty} at ${referralDetails.clinicName} has been confirmed.`,
        priority: 'high' as const
      },
      'cancelled': {
        title: 'Referral Declined',
        message: `Your referral to ${referralDetails.specialty} at ${referralDetails.clinicName} has been declined.`,
        priority: 'high' as const
      },
      'completed': {
        title: 'Referral Completed',
        message: `Your referral to ${referralDetails.specialty} has been completed.`,
        priority: 'medium' as const
      }
    };

    const message = statusMessages[status as keyof typeof statusMessages];
    
    if (message) {
      return await databaseService.createNotification({
        userId,
        type: 'referral',
        title: message.title,
        message: message.message,
        timestamp: Date.now(),
        read: false,
        relatedId: referralId,
        priority: message.priority,
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days from now
      });
    }
    
    throw new Error(`Unknown referral status: ${status}`);
  }

  async createPrescriptionNotification(
    userId: string,
    prescriptionId: string,
    prescriptionDetails: {
      medication: string;
      doctorName: string;
    }
  ): Promise<string> {
    return await databaseService.createNotification({
      userId,
      type: 'prescription',
      title: 'New Prescription',
      message: `Dr. ${prescriptionDetails.doctorName} has prescribed ${prescriptionDetails.medication} for you.`,
      timestamp: Date.now(),
      read: false,
      relatedId: prescriptionId,
      priority: 'medium',
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days from now
    });
  }

  async createCertificateNotification(
    userId: string,
    certificateId: string,
    certificateDetails: {
      type: string;
      doctorName: string;
    }
  ): Promise<string> {
    return await databaseService.createNotification({
      userId,
      type: 'certificate',
      title: 'New Medical Certificate',
      message: `Dr. ${certificateDetails.doctorName} has issued a ${certificateDetails.type} certificate for you.`,
      timestamp: Date.now(),
      read: false,
      relatedId: certificateId,
      priority: 'medium',
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days from now
    });
  }

  // Batch create multiple notifications
  async createBatchNotifications(notifications: Array<{
    userId: string;
    payload: NotificationPayload;
    relatedId: string;
  }>): Promise<string[]> {
    const notificationPromises = notifications.map(({ userId, payload, relatedId }) =>
      databaseService.createNotification({
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        timestamp: Date.now(),
        read: false,
        relatedId,
        priority: payload.priority,
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days from now
      })
    );

    return await Promise.all(notificationPromises);
  }
}

export const notificationService = new NotificationService();
