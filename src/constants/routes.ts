export const ROUTES = {
  // Auth routes
  SIGN_IN: '/',
  SIGN_UP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  CHANGE_PASSWORD: '/change-password',
  
  // Patient routes
  PATIENT_DASHBOARD: '/(tabs)',
  PATIENT_PROFILE: '/(tabs)/profile',
  PATIENT_APPOINTMENTS: '/(tabs)/appointments',
  PATIENT_PRESCRIPTIONS: '/(tabs)/prescriptions',
  PATIENT_CERTIFICATES: '/(tabs)/certificates',
  
  // Patient booking routes
  BOOK_VISIT: '/book-visit',
  SELECT_DATETIME: '/book-visit/select-datetime',
  REVIEW_CONFIRM: '/book-visit/review-confirm',
  
  // Specialist routes
  SPECIALIST_DASHBOARD: '/(specialist-tabs)',
  SPECIALIST_PROFILE: '/(specialist-tabs)/profile',
  SPECIALIST_PATIENTS: '/(specialist-tabs)/patients',
  SPECIALIST_APPOINTMENTS: '/(specialist-tabs)/appointments',
  
  // Shared routes
  HELP_SUPPORT: '/help-support',
  TERMS_PRIVACY: '/terms-privacy',
  NOT_FOUND: '/+not-found',
  
  // Patient detail routes
  PATIENT_OVERVIEW: '/patient-overview',
  PATIENT_CONSULTATION: '/patient-consultation',
  VISIT_OVERVIEW: '/visit-overview',
  CERTIFICATE_DETAILS: '/certificate-details',
  EDIT_PROFILE: '/edit-profile',
} as const;

export type RouteKey = keyof typeof ROUTES; 