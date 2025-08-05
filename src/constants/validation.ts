export const VALIDATION_RULES = {
  // Email validation
  EMAIL: {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    MESSAGE: 'Please enter a valid email address',
  },
  
  // Password validation
  PASSWORD: {
    MIN_LENGTH: 8,
    PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    MESSAGE: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
  },
  
  // Phone validation
  PHONE: {
    PATTERN: /^\+?[\d\s\-\(\)]+$/,
    MESSAGE: 'Please enter a valid phone number',
  },
  
  // Name validation
  NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z\s]+$/,
    MESSAGE: 'Name must be 2-50 characters and contain only letters',
  },
  
  // Date validation
  DATE: {
    PATTERN: /^\d{4}-\d{2}-\d{2}$/,
    MESSAGE: 'Please enter a valid date in YYYY-MM-DD format',
  },
  
  // Required field validation
  REQUIRED: {
    MESSAGE: 'This field is required',
  },
  
  // Number validation
  NUMBER: {
    PATTERN: /^\d+$/,
    MESSAGE: 'Please enter a valid number',
  },
  
  // URL validation
  URL: {
    PATTERN: /^https?:\/\/.+/,
    MESSAGE: 'Please enter a valid URL',
  },
} as const;

export const VALIDATION_MESSAGES = {
  // Common messages
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PASSWORD: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
  INVALID_PHONE: 'Please enter a valid phone number',
  INVALID_NAME: 'Name must be 2-50 characters and contain only letters',
  INVALID_DATE: 'Please enter a valid date',
  INVALID_NUMBER: 'Please enter a valid number',
  INVALID_URL: 'Please enter a valid URL',
  
  // Length messages
  TOO_SHORT: (field: string, min: number) => `${field} must be at least ${min} characters`,
  TOO_LONG: (field: string, max: number) => `${field} must be no more than ${max} characters`,
  
  // Password messages
  PASSWORD_MISMATCH: 'Passwords do not match',
  WEAK_PASSWORD: 'Password is too weak',
  
  // Email messages
  EMAIL_IN_USE: 'This email is already in use',
  INVALID_EMAIL_FORMAT: 'Please enter a valid email format',
  
  // Phone messages
  INVALID_PHONE_FORMAT: 'Please enter a valid phone number format',
  
  // Date messages
  FUTURE_DATE: 'Date cannot be in the future',
  PAST_DATE: 'Date cannot be in the past',
  INVALID_DATE_RANGE: 'Date is outside the allowed range',
} as const; 