import { databaseService } from './database/firebase';

export interface ConsentRequest {
  id: string;
  patientId: string;
  specialistId: string;
  timestamp: number;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  expiresAt: number;
  qrData: any;
  consentMethod: 'in_app' | 'manual';
  responseTime?: number;
}

export interface TrustScore {
  consultationCount: number;
  successfulVisits: number;
  recentVisits: number;
  isTrusted: boolean;
  lastVisit?: string;
  trustReason?: string;
}

class ConsentService {
  private readonly TRUST_THRESHOLDS = {
    MIN_CONSULTATIONS: 2,
    MIN_SUCCESSFUL_VISITS: 1,
    MIN_RECENT_VISITS: 1,
    RECENT_VISIT_DAYS: 90
  };

  /**
   * Calculate if a specialist is trusted by a patient based on appointment history
   */
  async calculateSpecialistTrust(specialistId: string, patientId: string): Promise<TrustScore> {
    try {
      console.log(' Calculating trust for specialist:', specialistId, 'patient:', patientId);
      
      // Get all appointments for this patient
      const appointments = await databaseService.getAppointmentsByPatient(patientId);
      
      // Filter appointments for this specific specialist
      const specialistAppointments = appointments.filter(apt => 
        apt.doctorId === specialistId
      );
      
      // Calculate trust metrics
      const consultationCount = specialistAppointments.length;
      const successfulVisits = specialistAppointments.filter(apt => 
        apt.status === 'completed' || apt.status === 'confirmed'
      ).length;
      
      const recentCutoff = new Date(Date.now() - this.TRUST_THRESHOLDS.RECENT_VISIT_DAYS * 24 * 60 * 60 * 1000);
      const recentVisits = specialistAppointments.filter(apt => 
        new Date(apt.appointmentDate) > recentCutoff
      ).length;
      
      // Get most recent visit
      const sortedAppointments = specialistAppointments.sort((a, b) => 
        new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime()
      );
      const lastVisit = sortedAppointments[0]?.appointmentDate;
      
      // Determine trust status
      const isTrusted = consultationCount >= this.TRUST_THRESHOLDS.MIN_CONSULTATIONS &&
                       successfulVisits >= this.TRUST_THRESHOLDS.MIN_SUCCESSFUL_VISITS &&
                       recentVisits >= this.TRUST_THRESHOLDS.MIN_RECENT_VISITS;
      
      const trustScore: TrustScore = {
        consultationCount,
        successfulVisits,
        recentVisits,
        isTrusted,
        lastVisit,
        trustReason: isTrusted ? 
          `Trusted specialist (${consultationCount} consultations, ${successfulVisits} successful, ${recentVisits} recent)` :
          `New specialist (${consultationCount} consultations, ${successfulVisits} successful, ${recentVisits} recent)`
      };
      
      console.log(' Trust calculation result:', trustScore);
      return trustScore;
      
    } catch (error) {
      console.error(' Error calculating specialist trust:', error);
      throw new Error(`Failed to calculate specialist trust: ${error.message}`);
    }
  }

  /**
   * Create a new consent request
   */
  async createConsentRequest(qrData: any, specialistData: any): Promise<ConsentRequest> {
    try {
      const requestId = this.generateRequestId();
      const now = Date.now();
      const expiresAt = now + (5 * 60 * 1000); // 5 minutes
      
      const consentRequest: ConsentRequest = {
        id: requestId,
        patientId: qrData.id,
        specialistId: specialistData.id,
        timestamp: now,
        status: 'pending',
        expiresAt,
        qrData,
        consentMethod: 'in_app'
      };
      
      // Store in database for compliance
      await databaseService.setDocument(`permissionRequests/${requestId}`, consentRequest);
      
      console.log(' Consent request created:', requestId);
      return consentRequest;
      
    } catch (error) {
      console.error(' Error creating consent request:', error);
      throw new Error(`Failed to create consent request: ${error.message}`);
    }
  }

  /**
   * Handle consent response from patient
   */
  async handleConsentResponse(requestId: string, response: 'approved' | 'denied'): Promise<void> {
    try {
      const now = Date.now();
      
      // Get the request
      const request = await databaseService.getDocument(`permissionRequests/${requestId}`);
      if (!request) {
        throw new Error('Consent request not found');
      }
      
      // Calculate response time
      const responseTime = now - request.timestamp;
      
      // Update the request
      const updatedRequest = {
        ...request,
        status: response,
        responseTime
      };
      
      await databaseService.updateDocument(`permissionRequests/${requestId}`, updatedRequest);
      
      console.log(' Consent response handled:', response, 'for request:', requestId);
      
    } catch (error) {
      console.error(' Error handling consent response:', error);
      throw new Error(`Failed to handle consent response: ${error.message}`);
    }
  }

  /**
   * Create manual consent log for compliance
   */
  async logManualConsent(patientId: string, specialistId: string, response: 'approved' | 'denied' | 'pending'): Promise<void> {
    try {
      const now = Date.now();
      const requestId = this.generateRequestId();
      
      const manualConsentLog = {
        id: requestId,
        patientId,
        specialistId,
        timestamp: now,
        status: response,
        consentMethod: 'manual',
        systemStatus: 'electronic_system_failed'
      };
      
      await databaseService.setDocument(`permissionRequests/${requestId}`, manualConsentLog);
      
      console.log(' Manual consent logged:', response, 'for patient:', patientId);
      
    } catch (error) {
      console.error(' Error logging manual consent:', error);
      throw new Error(`Failed to log manual consent: ${error.message}`);
    }
  }

  /**
   * Get specialist data for consent requests
   */
  async getSpecialistData(specialistId: string): Promise<any> {
    try {
      const specialistData = await databaseService.getDocument(`users/${specialistId}`);
      if (!specialistData) {
        throw new Error('Specialist not found');
      }
      
      return {
        id: specialistId,
        name: `${specialistData.firstName || ''} ${specialistData.middleName || ''} ${specialistData.lastName || ''}`.trim() || 'Unknown Specialist',
        email: specialistData.email,
        specialty: specialistData.specialty,
        clinic: specialistData.clinicName
      };
      
    } catch (error) {
      console.error(' Error getting specialist data:', error);
      throw new Error(`Failed to get specialist data: ${error.message}`);
    }
  }

  /**
   * Get specialist details from consent request (fetches dynamically)
   */
  async getSpecialistDetailsFromConsentRequest(consentRequest: ConsentRequest): Promise<any> {
    try {
      const specialistData = await databaseService.getDocument(`users/${consentRequest.specialistId}`);
      if (!specialistData) {
        return {
          id: consentRequest.specialistId,
          name: 'Unknown Specialist',
          email: 'Unknown Email',
          specialty: 'Unknown Specialty'
        };
      }
      
      return {
        id: consentRequest.specialistId,
        name: `${specialistData.firstName || ''} ${specialistData.middleName || ''} ${specialistData.lastName || ''}`.trim() || 'Unknown Specialist',
        email: specialistData.email || 'Unknown Email',
        specialty: specialistData.specialty || 'Unknown Specialty',
        clinic: specialistData.clinicName || 'Unknown Clinic'
      };
      
    } catch (error) {
      console.error(' Error getting specialist details from consent request:', error);
      return {
        id: consentRequest.specialistId,
        name: 'Unknown Specialist',
        email: 'Unknown Email',
        specialty: 'Unknown Specialty'
      };
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if consent request has expired
   */
  isConsentRequestExpired(request: ConsentRequest): boolean {
    return Date.now() > request.expiresAt;
  }

  /**
   * Auto-expire pending requests
   */
  async autoExpirePendingRequests(): Promise<void> {
    try {
      console.log('🕐 Checking for expired consent requests...');
      
      const allRequests = await databaseService.getPermissionRequests();
      const expiredRequests = allRequests.filter(req => 
        req.status === 'pending' && this.isConsentRequestExpired(req)
      );
      
      for (const request of expiredRequests) {
        await databaseService.updateDocument(`permissionRequests/${request.id}`, {
          status: 'expired'
        });
        console.log('⏰ Expired consent request:', request.id);
      }
      
      if (expiredRequests.length > 0) {
        console.log(` Auto-expired ${expiredRequests.length} consent requests`);
      }
      
    } catch (error) {
      console.error(' Error auto-expiring requests:', error);
    }
  }

  /**
   * Get consent request by ID
   */
  async getConsentRequest(requestId: string): Promise<ConsentRequest | null> {
    try {
      const request = await databaseService.getDocument(`permissionRequests/${requestId}`);
      return request || null;
    } catch (error) {
      console.error(' Error getting consent request:', error);
      return null;
    }
  }

  /**
   * Clean up expired consent requests
   */
  async cleanupExpiredRequests(): Promise<void> {
    try {
      // This would be called periodically to clean up expired requests
      // Implementation depends on your database structure
      console.log('🧹 Cleaning up expired consent requests...');
    } catch (error) {
      console.error(' Error cleaning up expired requests:', error);
    }
  }
}

export const consentService = new ConsentService();
