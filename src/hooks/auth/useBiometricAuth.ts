import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Constants for SecureStore keys
const BIOMETRIC_CREDENTIALS_KEY = 'biometric_credentials';

// Types for better type safety
export interface BiometricCredentials {
  email: string;
  password: string;
  nextRoute: string;
  role?: string;
}

export interface BiometricSupport {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
}

/**
 * Checks if the device supports biometric authentication and if the user has enrolled biometrics
 * @returns Promise<BiometricSupport> - Object containing hardware support and enrollment status
 */
export async function checkBiometricSupport(): Promise<BiometricSupport> {
  try {
    // Return false for web platform since biometric auth is not supported
    if (Platform.OS === 'web') {
      return {
        hasHardware: false,
        isEnrolled: false,
        supportedTypes: [],
      };
    }

    // Check if device has biometric hardware
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    
    // Check if user has enrolled biometrics (fingerprint, face ID, etc.)
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    
    // Get supported authentication types
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    
    return {
      hasHardware,
      isEnrolled,
      supportedTypes,
    };
  } catch (error) {
    console.error('Error checking biometric support:', error);
    return {
      hasHardware: false,
      isEnrolled: false,
      supportedTypes: [],
    };
  }
}

/**
 * Securely stores user credentials for biometric login
 * @param email - User's email address
 * @param password - User's password
 * @param nextRoute - The route to navigate to after successful login
 * @param role - Optional user role (patient/specialist)
 * @returns Promise<boolean> - True if credentials were saved successfully
 */
export async function saveBiometricCredentials(
  email: string,
  password: string,
  nextRoute: string,
  role?: string
): Promise<boolean> {
  // Return false for web platform since SecureStore is not supported
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    // Only save credentials if biometric authentication is available
    const biometricSupport = await checkBiometricSupport();
    if (!biometricSupport.hasHardware || !biometricSupport.isEnrolled) {
      console.warn('Cannot save biometric credentials: biometric authentication not available');
      return false;
    }

    const credentials: BiometricCredentials = {
      email,
      password,
      nextRoute,
      role,
    };

    // Store credentials securely using SecureStore
    await SecureStore.setItemAsync(
      BIOMETRIC_CREDENTIALS_KEY,
      JSON.stringify(credentials)
    );

    console.log('Biometric credentials saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving biometric credentials:', error);
    return false;
  }
}

/**
 * Retrieves securely stored biometric credentials
 * @returns Promise<BiometricCredentials | null> - Stored credentials or null if not found
 */
export async function getBiometricCredentials(): Promise<BiometricCredentials | null> {
  try {
    // Return null for web platform since SecureStore is not supported
    if (Platform.OS === 'web') {
      return null;
    }

    const credentialsString = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY);
    
    if (!credentialsString) {
      return null;
    }

    const credentials: BiometricCredentials = JSON.parse(credentialsString);
    return credentials;
  } catch (error) {
    console.error('Error retrieving biometric credentials:', error);
    return null;
  }
}

/**
 * Removes stored biometric credentials from secure storage
 * @returns Promise<boolean> - True if credentials were deleted successfully
 */
export async function deleteBiometricCredentials(): Promise<boolean> {
  try {
    // Return false for web platform since SecureStore is not supported
    if (Platform.OS === 'web') {
      return false;
    }

    await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY);
    console.log('Biometric credentials deleted successfully');
    return true;
  } catch (error) {
    console.error('Error deleting biometric credentials:', error);
    return false;
  }
}

/**
 * Prompts user for biometric authentication
 * @returns Promise<boolean> - True if authentication was successful
 */
export async function authenticateWithBiometrics(): Promise<boolean> {
  try {
    // Return false for web platform since biometric auth is not supported
    if (Platform.OS === 'web') {
      return false;
    }

    // Check if biometric authentication is available
    const biometricSupport = await checkBiometricSupport();
    if (!biometricSupport.hasHardware || !biometricSupport.isEnrolled) {
      console.warn('Biometric authentication not available');
      return false;
    }

    // Determine the prompt message based on supported authentication types
    let promptMessage = 'Authenticate with biometrics';
    let fallbackLabel = 'Use Password';

    if (biometricSupport.supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      promptMessage = 'Authenticate with your fingerprint';
      fallbackLabel = 'Use Password';
    } else if (biometricSupport.supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      promptMessage = 'Authenticate with Face ID';
      fallbackLabel = 'Use Password';
    }

    // Prompt for biometric authentication
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel,
      disableDeviceFallback: false, // Allow device passcode as fallback
      cancelLabel: 'Cancel',
    });

    if (result.success) {
      console.log('Biometric authentication successful');
      return true;
    } else {
      console.log('Biometric authentication failed or cancelled');
      return false;
    }
  } catch (error) {
    console.error('Error during biometric authentication:', error);
    return false;
  }
}

/**
 * Checks if biometric credentials are stored and available for use
 * @returns Promise<boolean> - True if biometric login is ready to use
 */
export async function isBiometricLoginAvailable(): Promise<boolean> {
  try {
    const biometricSupport = await checkBiometricSupport();
    const credentials = await getBiometricCredentials();
    
    return (
      biometricSupport.hasHardware &&
      biometricSupport.isEnrolled &&
      credentials !== null
    );
  } catch (error) {
    console.error('Error checking biometric login availability:', error);
    return false;
  }
}

/**
 * Gets a user-friendly message explaining why biometric login might not be available
 * @returns Promise<string> - Explanation message for the user
 */
export async function getBiometricUnavailableReason(): Promise<string> {
  try {
    const biometricSupport = await checkBiometricSupport();
    const credentials = await getBiometricCredentials();

    if (!biometricSupport.hasHardware) {
      return 'Biometric authentication not supported on this device';
    }
    
    if (!biometricSupport.isEnrolled) {
      if (Platform.OS === 'ios') {
        return 'Please set up Face ID or Touch ID in Settings';
      } else {
        return 'Please set up fingerprint or face unlock in Settings';
      }
    }
    
    if (!credentials) {
      return 'Biometric login not set up';
    }

    return 'Biometric login available';
  } catch (error) {
    console.error('Error getting biometric unavailable reason:', error);
    return 'Biometric authentication unavailable';
  }
}

/**
 * Performs complete biometric login flow
 * @returns Promise<BiometricCredentials | null> - User credentials if successful, null otherwise
 */
export async function performBiometricLogin(): Promise<BiometricCredentials | null> {
  try {
    // First check if biometric login is available
    const isAvailable = await isBiometricLoginAvailable();
    if (!isAvailable) {
      console.warn('Biometric login not available');
      return null;
    }

    // Authenticate with biometrics
    const authSuccess = await authenticateWithBiometrics();
    if (!authSuccess) {
      console.log('Biometric authentication failed');
      return null;
    }

    // Retrieve and return stored credentials
    const credentials = await getBiometricCredentials();
    return credentials;
  } catch (error) {
    console.error('Error during biometric login:', error);
    return null;
  }
}