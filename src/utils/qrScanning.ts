import { consentService, ConsentRequest } from '../services/consentService';

export interface QRScanResult {
  action: 'direct_access' | 'request_consent' | 'manual_consent_required' | 'error';
  data?: any;
  requestId?: string;
  reason?: string;
  error?: string;
  fallback?: boolean;
  offline?: boolean;
}

/**
 * Handle QR code scanning with consent logic
 */
export const handleQRScan = async (qrData: any, specialistId: string): Promise<QRScanResult> => {
  try {
    console.log('🔍 Processing QR scan for specialist:', specialistId, 'patient:', qrData.id);
    
    // Validate QR data
    if (!qrData || qrData.type !== 'patient' || !qrData.id) {
      return {
        action: 'error',
        error: 'Invalid QR code data'
      };
    }
    
    // Check if specialist is trusted
    const trustScore = await consentService.calculateSpecialistTrust(specialistId, qrData.id);
    
    if (trustScore.isTrusted) {
      console.log('✅ Specialist is trusted, granting direct access');
      return {
        action: 'direct_access',
        data: qrData,
        reason: 'trusted_specialist'
      };
    } else {
      console.log('⚠️ New specialist, requesting consent');
      
      // Get specialist data for consent request
      const specialistData = await consentService.getSpecialistData(specialistId);
      
      // Create consent request
      const consentRequest = await consentService.createConsentRequest(qrData, specialistData);
      
      return {
        action: 'request_consent',
        requestId: consentRequest.id,
        data: qrData,
        reason: 'new_specialist'
      };
    }
    
  } catch (error) {
    console.error('❌ QR scan processing failed:', error);
    
    // Return error result - no fallback to direct access
    return {
      action: 'error',
      error: error.message,
      reason: 'system_error'
    };
  }
};

/**
 * Handle manual consent when electronic system fails
 */
export const handleManualConsent = async (qrData: any, specialistId: string): Promise<QRScanResult> => {
  try {
    console.log('🔧 Processing manual consent for specialist:', specialistId, 'patient:', qrData.id);
    
    // Log manual consent request
    await consentService.logManualConsent(qrData.id, specialistId, 'pending');
    
    return {
      action: 'manual_consent_required',
      data: qrData,
      reason: 'electronic_system_failed'
    };
    
  } catch (error) {
    console.error('❌ Manual consent processing failed:', error);
    return {
      action: 'error',
      error: error.message,
      reason: 'manual_consent_error'
    };
  }
};

/**
 * Handle consent response from patient
 */
export const handleConsentResponse = async (requestId: string, response: 'approved' | 'denied'): Promise<QRScanResult> => {
  try {
    console.log('📝 Processing consent response:', response, 'for request:', requestId);
    
    // Handle the consent response
    await consentService.handleConsentResponse(requestId, response);
    
    if (response === 'approved') {
      return {
        action: 'direct_access',
        reason: 'consent_approved'
      };
    } else {
      return {
        action: 'error',
        error: 'Access denied by patient',
        reason: 'consent_denied'
      };
    }
    
  } catch (error) {
    console.error('❌ Consent response processing failed:', error);
    return {
      action: 'error',
      error: error.message,
      reason: 'consent_response_error'
    };
  }
};

/**
 * Validate QR code data structure
 */
export const validateQRData = (data: any): boolean => {
  try {
    const qrData = typeof data === 'string' ? JSON.parse(data) : data;
    
    return qrData && 
           qrData.type === 'patient' && 
           qrData.id && 
           typeof qrData.id === 'string' &&
           qrData.id.length > 0;
  } catch (error) {
    console.error('❌ QR data validation failed:', error);
    return false;
  }
};

/**
 * Parse QR code data safely
 */
export const parseQRData = (data: string): any => {
  try {
    const qrData = JSON.parse(data);
    
    if (!validateQRData(qrData)) {
      throw new Error('Invalid QR code format');
    }
    
    return qrData;
  } catch (error) {
    console.error('❌ QR data parsing failed:', error);
    throw new Error(`Invalid QR code: ${error.message}`);
  }
};

/**
 * Get consent request status
 */
export const getConsentRequestStatus = async (requestId: string): Promise<string | null> => {
  try {
    const request = await consentService.getConsentRequest(requestId);
    return request ? request.status : null;
  } catch (error) {
    console.error('❌ Error getting consent request status:', error);
    return null;
  }
};

/**
 * Check if consent request is still pending
 */
export const isConsentRequestPending = async (requestId: string): Promise<boolean> => {
  try {
    const status = await getConsentRequestStatus(requestId);
    return status === 'pending';
  } catch (error) {
    console.error('❌ Error checking consent request status:', error);
    return false;
  }
};
