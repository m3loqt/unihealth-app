import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useSignature } from '@/contexts/SignatureContext';

interface UseSignatureManagerOptions {
  autoSave?: boolean;
  showAlerts?: boolean;
  onSignatureChange?: (signature: string | null) => void;
}

interface UseSignatureManagerReturn {
  // Current signature state
  signature: string | null;
  isLoading: boolean;
  hasSignature: boolean;
  
  // Signature actions
  saveSignature: (signature: string) => Promise<boolean>;
  clearSignature: () => Promise<void>;
  loadLatestSignature: () => Promise<string | null>;
  
  // Signature validation
  isValidSignature: (signature: string | null) => boolean;
  getSignatureStatus: (signature: string | null) => 'missing' | 'valid' | 'invalid';
  
  // Certificate integration
  addSignatureToCertificate: (certificateData: any) => any;
  getSignatureForCertificate: (certificateData: any) => string | null;
}

export function useSignatureManager(options: UseSignatureManagerOptions = {}): UseSignatureManagerReturn {
  const {
    autoSave = true,
    showAlerts = true,
    onSignatureChange,
  } = options;

  const {
    currentSignature,
    isLoading,
    setSignature,
    clearSignature: clearContextSignature,
    getLatestSignature,
    hasValidSignature,
  } = useSignature();

  const [localSignature, setLocalSignature] = useState<string | null>(currentSignature);

  // Sync local state with context
  useEffect(() => {
    setLocalSignature(currentSignature);
    onSignatureChange?.(currentSignature);
  }, [currentSignature, onSignatureChange]);

  const saveSignature = useCallback(async (signature: string): Promise<boolean> => {
    try {
      if (!hasValidSignature(signature)) {
        if (showAlerts) {
          Alert.alert('Invalid Signature', 'Please provide a valid signature before saving.');
        }
        return false;
      }

      await setSignature(signature);
      
      if (showAlerts) {
        Alert.alert(
          'Signature Saved',
          'Your digital signature has been captured and saved successfully.',
          [{ text: 'OK' }]
        );
      }
      
      return true;
    } catch (error) {
      console.error('Error saving signature:', error);
      if (showAlerts) {
        Alert.alert(
          'Save Failed',
          'Failed to save your signature. Please try again.',
          [{ text: 'OK' }]
        );
      }
      return false;
    }
  }, [setSignature, hasValidSignature, showAlerts]);

  const clearSignature = useCallback(async (): Promise<void> => {
    try {
      await clearContextSignature();
      setLocalSignature(null);
      
      if (showAlerts) {
        Alert.alert(
          'Signature Cleared',
          'Your signature has been cleared successfully.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error clearing signature:', error);
      if (showAlerts) {
        Alert.alert(
          'Clear Failed',
          'Failed to clear your signature. Please try again.',
          [{ text: 'OK' }]
        );
      }
    }
  }, [clearContextSignature, showAlerts]);

  const loadLatestSignature = useCallback(async (): Promise<string | null> => {
    try {
      const latest = await getLatestSignature();
      if (latest && hasValidSignature(latest)) {
        setLocalSignature(latest);
        return latest;
      }
      return null;
    } catch (error) {
      console.error('Error loading latest signature:', error);
      return null;
    }
  }, [getLatestSignature, hasValidSignature]);

  const isValidSignature = useCallback((signature: string | null): boolean => {
    return hasValidSignature(signature);
  }, [hasValidSignature]);

  const getSignatureStatus = useCallback((signature: string | null): 'missing' | 'valid' | 'invalid' => {
    if (!signature) return 'missing';
    if (hasValidSignature(signature)) return 'valid';
    return 'invalid';
  }, [hasValidSignature]);

  const addSignatureToCertificate = useCallback((certificateData: any): any => {
    const signature = localSignature || currentSignature;
    
    if (!signature || !hasValidSignature(signature)) {
      return certificateData;
    }

    return {
      ...certificateData,
      digitalSignature: signature,
      signatureKey: `signature_${Date.now()}`,
      signedAt: new Date().toISOString(),
    };
  }, [localSignature, currentSignature, hasValidSignature]);

  const getSignatureForCertificate = useCallback((certificateData: any): string | null => {
    // First check if certificate already has a signature
    if (certificateData?.digitalSignature && hasValidSignature(certificateData.digitalSignature)) {
      return certificateData.digitalSignature;
    }
    
    // Otherwise return current signature
    return localSignature || currentSignature;
  }, [localSignature, currentSignature, hasValidSignature]);

  return {
    signature: localSignature,
    isLoading,
    hasSignature: !!localSignature && hasValidSignature(localSignature),
    saveSignature,
    clearSignature,
    loadLatestSignature,
    isValidSignature,
    getSignatureStatus,
    addSignatureToCertificate,
    getSignatureForCertificate,
  };
}

// Specialized hook for signature page
export function useSignaturePage() {
  const signatureManager = useSignatureManager({
    autoSave: false, // Manual save on signature page
    showAlerts: false, // Don't show alerts on signature page (we handle our own prompts)
  });

  const handleSignatureCapture = useCallback((signature: string) => {
    console.log('Signature captured:', {
      hasSignature: !!signature,
      signatureLength: signature ? signature.length : 0,
      signatureStart: signature ? signature.substring(0, 50) : 'none'
    });
    
    // Update local state immediately for UI feedback
    signatureManager.saveSignature(signature);
  }, [signatureManager]);

  return {
    ...signatureManager,
    handleSignatureCapture,
  };
}

// Specialized hook for certificate views
export function useCertificateSignature(certificateData: any) {
  const signatureManager = useSignatureManager({
    autoSave: true,
    showAlerts: false, // Don't show alerts in certificate views
  });

  const certificateSignature = signatureManager.getSignatureForCertificate(certificateData);
  const signatureStatus = signatureManager.getSignatureStatus(certificateSignature);

  return {
    signature: certificateSignature,
    signatureStatus,
    hasSignature: signatureStatus === 'valid',
    isValidSignature: signatureManager.isValidSignature,
  };
}

