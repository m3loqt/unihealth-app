import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SignatureContextType {
  // Current signature state
  currentSignature: string | null;
  isLoading: boolean;
  
  // Signature management functions
  setSignature: (signature: string) => Promise<void>;
  clearSignature: () => Promise<void>;
  getLatestSignature: () => Promise<string | null>;
  
  // Signature validation
  hasValidSignature: (signature: string | null) => boolean;
  
  // Signature history (optional - for future use)
  signatureHistory: string[];
  addToHistory: (signature: string) => Promise<void>;
}

const SignatureContext = createContext<SignatureContextType | undefined>(undefined);

interface SignatureProviderProps {
  children: ReactNode;
}

const SIGNATURE_STORAGE_KEYS = {
  CURRENT: 'current_signature',
  LATEST: 'latest_signature',
  HISTORY: 'signature_history',
} as const;

export function SignatureProvider({ children }: SignatureProviderProps) {
  const [currentSignature, setCurrentSignature] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [signatureHistory, setSignatureHistory] = useState<string[]>([]);

  // Load signature data on mount
  useEffect(() => {
    loadSignatureData();
  }, []);

  const loadSignatureData = async () => {
    try {
      setIsLoading(true);
      
      // Load current signature
      const current = await AsyncStorage.getItem(SIGNATURE_STORAGE_KEYS.CURRENT);
      if (current) {
        setCurrentSignature(current);
      }
      
      // Load signature history
      const history = await AsyncStorage.getItem(SIGNATURE_STORAGE_KEYS.HISTORY);
      if (history) {
        try {
          const parsedHistory = JSON.parse(history);
          setSignatureHistory(Array.isArray(parsedHistory) ? parsedHistory : []);
        } catch (e) {
          console.warn('Failed to parse signature history:', e);
          setSignatureHistory([]);
        }
      }
      
    } catch (error) {
      console.error('Error loading signature data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setSignature = async (signature: string): Promise<void> => {
    try {
      // Validate signature
      if (!hasValidSignature(signature)) {
        throw new Error('Invalid signature format');
      }

      // Update state
      setCurrentSignature(signature);
      
      // Save to AsyncStorage
      await Promise.all([
        AsyncStorage.setItem(SIGNATURE_STORAGE_KEYS.CURRENT, signature),
        AsyncStorage.setItem(SIGNATURE_STORAGE_KEYS.LATEST, signature),
      ]);
      
      // Add to history
      await addToHistory(signature);
      
      console.log('✅ Signature saved successfully');
    } catch (error) {
      console.error('Error saving signature:', error);
      throw error;
    }
  };

  const clearSignature = async (): Promise<void> => {
    try {
      setCurrentSignature(null);
      await AsyncStorage.removeItem(SIGNATURE_STORAGE_KEYS.CURRENT);
      console.log('✅ Signature cleared successfully');
    } catch (error) {
      console.error('Error clearing signature:', error);
      throw error;
    }
  };

  const getLatestSignature = async (): Promise<string | null> => {
    try {
      const latest = await AsyncStorage.getItem(SIGNATURE_STORAGE_KEYS.LATEST);
      return latest;
    } catch (error) {
      console.error('Error getting latest signature:', error);
      return null;
    }
  };

  const hasValidSignature = (signature: string | null): boolean => {
    if (!signature || typeof signature !== 'string') return false;
    
    const trimmed = signature.trim();
    if (trimmed === '') return false;
    
    // Check if it's a valid base64 image or data URL
    return (
      trimmed.startsWith('data:image') || 
      trimmed.length >= 100 // Minimum length for a valid signature
    );
  };

  const addToHistory = async (signature: string): Promise<void> => {
    try {
      const newHistory = [signature, ...signatureHistory.slice(0, 9)]; // Keep last 10 signatures
      setSignatureHistory(newHistory);
      await AsyncStorage.setItem(SIGNATURE_STORAGE_KEYS.HISTORY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error adding to signature history:', error);
    }
  };

  const contextValue: SignatureContextType = {
    currentSignature,
    isLoading,
    setSignature,
    clearSignature,
    getLatestSignature,
    hasValidSignature,
    signatureHistory,
    addToHistory,
  };

  return (
    <SignatureContext.Provider value={contextValue}>
      {children}
    </SignatureContext.Provider>
  );
}

export function useSignature(): SignatureContextType {
  const context = useContext(SignatureContext);
  if (context === undefined) {
    throw new Error('useSignature must be used within a SignatureProvider');
  }
  return context;
}

// Convenience hook for signature validation
export function useSignatureValidation() {
  const { hasValidSignature } = useSignature();
  
  return {
    isValidSignature: hasValidSignature,
    getSignatureStatus: (signature: string | null) => {
      if (!signature) return 'missing';
      if (hasValidSignature(signature)) return 'valid';
      return 'invalid';
    },
  };
}

