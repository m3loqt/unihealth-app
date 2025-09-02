import { databaseService, Notification } from './database/firebase';
import { formatFrequency, formatRoute, formatFormula } from '../utils/formatting';

export interface NotificationPayload {
  title: string;
  message: string;
  type: 'appointment' | 'referral' | 'prescription' | 'certificate';
  relatedId: string;
  priority: 'low' | 'medium' | 'high';
}

class NotificationService {
  // Helper method to fetch clinic name by clinicId
  private async getClinicName(clinicId: string): Promise<string> {
    try {
      if (!clinicId) {
        return 'Clinic not specified';
      }
      
      const clinicData = await databaseService.getClinicById(clinicId);
      return clinicData?.name || `Clinic ${clinicId}`;
    } catch (error) {
      console.error('Error fetching clinic name for ID:', clinicId, error);
      return `Clinic ${clinicId}`;
    }
  }

  // Helper method to fetch user name by userId
  private async getUserName(userId: string): Promise<string> {
    try {
      if (!userId) {
        return 'Unknown User';
      }
      
      const userData = await databaseService.getUserById(userId);
      if (!userData) {
        return 'Unknown User';
      }
      
      const { firstName, middleName, lastName } = userData;
      const nameParts = [firstName];
      if (middleName) {
        nameParts.push(middleName);
      }
      nameParts.push(lastName);
      
      return nameParts.join(' ').trim() || 'Unknown User';
    } catch (error) {
      console.error('Error fetching user name for ID:', userId, error);
      return 'Unknown User';
    }
  }

  async createAppointmentStatusNotification(
    userId: string,
    appointmentId: string,
    status: string,
    appointmentDetails: {
      date: string;
      time: string;
      doctorId: string;
      clinicId?: string;
      clinicName?: string; // Keep for backward compatibility
    }
  ): Promise<string> {
    // Fetch clinic name and doctor name using IDs
    const [clinicName, doctorName] = await Promise.all([
      appointmentDetails.clinicId 
        ? this.getClinicName(appointmentDetails.clinicId)
        : Promise.resolve(appointmentDetails.clinicName || 'Clinic not specified'),
      this.getUserName(appointmentDetails.doctorId)
    ]);

    const statusMessages = {
      'pending': {
        title: 'Appointment Booked',
        message: `Your appointment with Dr. ${doctorName} on ${appointmentDetails.date} at ${appointmentDetails.time} at ${clinicName} has been successfully booked and is pending confirmation.`,
        priority: 'medium' as const,
        route: '/(patient)/tabs/appointments',
        routeParams: { filter: 'pending' }
      },
      'confirmed': {
        title: 'Appointment Confirmed!',
        message: `Your appointment with Dr. ${doctorName} on ${appointmentDetails.date} at ${appointmentDetails.time} at ${clinicName} has been confirmed.`,
        priority: 'high' as const,
        route: '/(patient)/tabs/appointments',
        routeParams: { filter: 'confirmed' }
      },
      'completed': {
        title: 'Appointment Completed',
        message: `Your appointment with Dr. ${doctorName} at ${clinicName} has been completed. Please check your medical history for prescriptions, certificates, and consultation details.`,
        priority: 'high' as const,
        route: '/(patient)/tabs/appointments',
        routeParams: { filter: 'completed' }
      },
      'cancelled': {
        title: 'Appointment Cancelled',
        message: `Your appointment with Dr. ${doctorName} on ${appointmentDetails.date} at ${clinicName} has been cancelled.`,
        priority: 'high' as const,
        route: '/(patient)/tabs/appointments',
        routeParams: { filter: 'cancelled' }
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
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days from now
        route: message.route,
        routeParams: message.routeParams
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
      patientId: string;
      clinicId?: string;
      clinicName?: string; // Keep for backward compatibility
    }
  ): Promise<string> {
    // Fetch clinic name and patient name using IDs
    const [clinicName, patientName] = await Promise.all([
      appointmentDetails.clinicId 
        ? this.getClinicName(appointmentDetails.clinicId)
        : Promise.resolve(appointmentDetails.clinicName || 'Clinic not specified'),
      this.getUserName(appointmentDetails.patientId)
    ]);

    const statusMessages = {
      'pending': {
        title: 'New Appointment Booked',
        message: `New appointment with ${patientName} on ${appointmentDetails.date} at ${appointmentDetails.time} at ${clinicName} has been booked and is pending confirmation.`,
        priority: 'high' as const,
        route: '/(specialist)/tabs/appointments',
        routeParams: { filter: 'pending' }
      },
      'confirmed': {
        title: 'New Appointment Confirmed',
        message: `Appointment with ${patientName} on ${appointmentDetails.date} at ${appointmentDetails.time} at ${clinicName} has been confirmed.`,
        priority: 'high' as const,
        route: '/(specialist)/tabs/appointments',
        routeParams: { filter: 'confirmed' }
      },
      'completed': {
        title: 'Appointment Completed',
        message: `Appointment with ${patientName} at ${clinicName} has been completed. Medical history has been updated with consultation details.`,
        priority: 'medium' as const,
        route: '/(specialist)/tabs/appointments',
        routeParams: { filter: 'completed' }
      },
      'cancelled': {
        title: 'Appointment Cancelled',
        message: `Appointment with ${patientName} on ${appointmentDetails.date} at ${clinicName} has been cancelled.`,
        priority: 'high' as const,
        route: '/(specialist)/tabs/appointments',
        routeParams: { filter: 'cancelled' }
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
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days from now
        route: message.route,
        routeParams: message.routeParams
      });
    }
    
    throw new Error(`Unknown appointment status: ${status}`);
  }

  async createReferralNotification(
    userId: string,
    referralId: string,
    status: string,
    referralDetails: {
      patientId: string;
      assignedSpecialistId: string;
      clinicId?: string;
      clinicName?: string; // Keep for backward compatibility
    }
  ): Promise<string> {
    // Fetch clinic name and specialist name using IDs
    const [clinicName, specialistName] = await Promise.all([
      referralDetails.clinicId 
        ? this.getClinicName(referralDetails.clinicId)
        : Promise.resolve(referralDetails.clinicName || 'Clinic not specified'),
      this.getUserName(referralDetails.assignedSpecialistId)
    ]);

    const statusMessages = {
      'pending': {
        title: 'Referral Sent',
        message: `Your referral to Dr. ${specialistName} at ${clinicName} has been sent and is pending acceptance.`,
        priority: 'medium' as const,
        route: '/(patient)/referral-details',
        routeParams: { id: referralId }
      },
      'confirmed': {
        title: 'Referral Confirmed',
        message: `Your referral to Dr. ${specialistName} at ${clinicName} has been confirmed.`,
        priority: 'high' as const,
        route: '/(patient)/referral-details',
        routeParams: { id: referralId }
      },
      'cancelled': {
        title: 'Referral Declined',
        message: `Your referral to Dr. ${specialistName} at ${clinicName} has been declined.`, // Let's try to add cancellation reason.
        priority: 'high' as const,
        route: '/(patient)/referral-details',
        routeParams: { id: referralId }
      },
      'completed': {
        title: 'Referral Completed',
        message: `Your referral to Dr. ${specialistName} at ${clinicName} has been completed. Please check your medical history for consultation details and any prescriptions or certificates.`,
        priority: 'high' as const,
        route: '/(patient)/referral-details',
        routeParams: { id: referralId }
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
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days from now
        route: message.route,
        routeParams: message.routeParams
      });
    }
    
    throw new Error(`Unknown referral status: ${status}`);
  }

  async createPrescriptionNotification(
    userId: string,
    prescriptionId: string,
    prescriptionDetails: {
      medication: string;
      dosage?: string;
      frequency?: string;
      route?: string;
      formula?: string;
      doctorId: string;
    }
  ): Promise<string> {
    const doctorName = await this.getUserName(prescriptionDetails.doctorId);
    const dosageText = prescriptionDetails.dosage ? ` (${prescriptionDetails.dosage})` : '';
    
    // Format medical abbreviations for patient-friendly display
    const frequencyText = prescriptionDetails.frequency 
      ? ` - ${formatFrequency(prescriptionDetails.frequency, 'patient')}` 
      : '';
    const routeText = prescriptionDetails.route 
      ? ` - ${formatRoute(prescriptionDetails.route, 'patient')}` 
      : '';
    const formulaText = prescriptionDetails.formula 
      ? ` - ${formatFormula(prescriptionDetails.formula, 'patient')}` 
      : '';
    
    return await databaseService.createNotification({
      userId,
      type: 'prescription',
      title: 'New Prescription',
      message: `Dr. ${doctorName} has prescribed ${prescriptionDetails.medication}${dosageText}${frequencyText}${routeText}${formulaText} for you.`,
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
      doctorId: string;
    }
  ): Promise<string> {
    const doctorName = await this.getUserName(certificateDetails.doctorId);
    
    return await databaseService.createNotification({
      userId,
      type: 'certificate',
      title: 'New Medical Certificate',
      message: `Dr. ${doctorName} has issued a ${certificateDetails.type} certificate for you.`,
      timestamp: Date.now(),
      read: false,
      relatedId: certificateId,
      priority: 'medium',
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days from now
    });
  }

  // Create prescription notification from medical history
  async createPrescriptionNotificationFromMedicalHistory(
    patientId: string,
    consultationId: string,
    prescriptionData: {
      medication: string;
      dosage?: string;
      frequency?: string;
      duration?: string;
      route?: string;
      formula?: string;
      prescribedDate?: string;
      doctorId: string;
      appointmentId?: string;
      referralId?: string;
    }
  ): Promise<string> {
    const doctorName = await this.getUserName(prescriptionData.doctorId);
    const dosageText = prescriptionData.dosage ? ` (${prescriptionData.dosage})` : '';
    
    // Format medical abbreviations for patient-friendly display
    const frequencyText = prescriptionData.frequency 
      ? ` - ${formatFrequency(prescriptionData.frequency, 'patient')}` 
      : '';
    const routeText = prescriptionData.route 
      ? ` - ${formatRoute(prescriptionData.route, 'patient')}` 
      : '';
    const formulaText = prescriptionData.formula 
      ? ` - ${formatFormula(prescriptionData.formula, 'patient')}` 
      : '';
    const durationText = prescriptionData.duration ? ` for ${prescriptionData.duration}` : '';
    
    return await databaseService.createNotification({
      userId: patientId,
      type: 'prescription',
      title: 'New Prescription Added',
      message: `Dr. ${doctorName} has prescribed ${prescriptionData.medication}${dosageText}${frequencyText}${routeText}${formulaText}${durationText}.`,
      timestamp: Date.now(),
      read: false,
      relatedId: consultationId,
      priority: 'medium',
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days from now
      route: '/(patient)/tabs/prescriptions',
      routeParams: {}
    });
  }

  // Create certificate notification from medical history
  async createCertificateNotificationFromMedicalHistory(
    patientId: string,
    consultationId: string,
    certificateData: {
      type: string;
      fitnessStatement?: string;
      workRestrictions?: string;
      issuedDate?: string;
      issuedTime?: string;
      status?: string;
      doctorId: string;
      appointmentId?: string;
      referralId?: string;
    }
  ): Promise<string> {
    const doctorName = await this.getUserName(certificateData.doctorId);
    const statusText = certificateData.status ? ` (${certificateData.status})` : '';
    const restrictionsText = certificateData.workRestrictions ? ` with restrictions: ${certificateData.workRestrictions}` : '';
    
    return await databaseService.createNotification({
      userId: patientId,
      type: 'certificate',
      title: 'New Medical Certificate Issued',
      message: `Dr. ${doctorName} has issued a ${certificateData.type}${statusText}${restrictionsText}.`,
      timestamp: Date.now(),
      read: false,
      relatedId: consultationId,
      priority: 'medium',
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days from now
      route: '/(patient)/tabs/certificates',
      routeParams: {}
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
