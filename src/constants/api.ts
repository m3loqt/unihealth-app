export const API_CONFIG = {
  // Firebase configuration
  FIREBASE_CONFIG: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  },
  
  // Database paths
  DATABASE_PATHS: {
    USERS: 'users',
    PATIENTS: 'patients',
    APPOINTMENTS: 'appointments',
    PRESCRIPTIONS: 'prescriptions',
    CERTIFICATES: 'certificates',
    MEDICAL_HISTORY: 'patientMedicalHistory',
  },
  
  // API endpoints
  ENDPOINTS: {
    AUTH: {
      SIGN_IN: '/auth/signin',
      SIGN_UP: '/auth/signup',
      SIGN_OUT: '/auth/signout',
      RESET_PASSWORD: '/auth/reset-password',
      CHANGE_PASSWORD: '/auth/change-password',
    },
    APPOINTMENTS: {
      GET_ALL: '/appointments',
      GET_BY_ID: '/appointments/:id',
      CREATE: '/appointments',
      UPDATE: '/appointments/:id',
      DELETE: '/appointments/:id',
    },
    PRESCRIPTIONS: {
      GET_ALL: '/prescriptions',
      GET_BY_ID: '/prescriptions/:id',
      CREATE: '/prescriptions',
      UPDATE: '/prescriptions/:id',
      DELETE: '/prescriptions/:id',
    },
    PATIENTS: {
      GET_ALL: '/patients',
      GET_BY_ID: '/patients/:id',
      CREATE: '/patients',
      UPDATE: '/patients/:id',
      DELETE: '/patients/:id',
    },
  },
  
  // Request configuration
  REQUEST_CONFIG: {
    TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 1 second
  },
  
  // Error messages
  ERROR_MESSAGES: {
    NETWORK_ERROR: 'Network error. Please check your connection.',
    TIMEOUT_ERROR: 'Request timeout. Please try again.',
    UNAUTHORIZED: 'Unauthorized. Please sign in again.',
    FORBIDDEN: 'Access denied.',
    NOT_FOUND: 'Resource not found.',
    SERVER_ERROR: 'Server error. Please try again later.',
    UNKNOWN_ERROR: 'An unknown error occurred.',
  },
} as const; 