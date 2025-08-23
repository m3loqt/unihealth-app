/**
 * Formatting utility functions for data presentation
 */

import { formatDate, formatTime, getAge } from './date';
import { capitalize, truncate, getInitials, formatPhoneNumber } from './string';

/**
 * Format currency amount
 * @param amount - Amount to format
 * @param currency - Currency code (default: 'USD')
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

/**
 * Format file size in bytes
 * @param bytes - Size in bytes
 * @returns Formatted file size string
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format percentage
 * @param value - Value to format as percentage
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format duration in seconds to human readable format
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours < 24) {
    return `${hours}h ${remainingMinutes}m`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  return `${days}d ${remainingHours}h`;
};

/**
 * Format appointment status for display
 * @param status - Appointment status
 * @returns Formatted status string
 */
export const formatAppointmentStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  
  return statusMap[status.toLowerCase()] || capitalize(status);
};

/**
 * Format prescription status for display
 * @param status - Prescription status
 * @returns Formatted status string
 */
export const formatPrescriptionStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    active: 'Active',
    completed: 'Completed',
    discontinued: 'Discontinued',
  };
  
  return statusMap[status.toLowerCase()] || capitalize(status);
};

/**
 * Format user role for display
 * @param role - User role
 * @returns Formatted role string
 */
export const formatUserRole = (role: string): string => {
  const roleMap: Record<string, string> = {
    patient: 'Patient',
    specialist: 'Specialist',
    doctor: 'Doctor',
    nurse: 'Nurse',
    admin: 'Administrator',
  };
  
  return roleMap[role.toLowerCase()] || capitalize(role);
};

/**
 * Format medical specialty for display
 * @param specialty - Medical specialty
 * @returns Formatted specialty string
 */
export const formatMedicalSpecialty = (specialty: string): string => {
  const specialtyMap: Record<string, string> = {
    'general_practice': 'General Practice',
    'cardiology': 'Cardiology',
    'dermatology': 'Dermatology',
    'neurology': 'Neurology',
    'orthopedics': 'Orthopedics',
    'pediatrics': 'Pediatrics',
    'psychiatry': 'Psychiatry',
    'radiology': 'Radiology',
    'surgery': 'Surgery',
    'emergency_medicine': 'Emergency Medicine',
  };
  
  return specialtyMap[specialty.toLowerCase()] || snakeCaseToTitleCase(specialty);
};

/**
 * Format address for display
 * @param address - Address object or string
 * @returns Formatted address string
 */
export const formatAddress = (address: string | any): string => {
  if (typeof address === 'string') {
    return address;
  }
  
  if (typeof address === 'object' && address !== null) {
    const parts = [
      address.street,
      address.city,
      address.state,
      address.postalCode,
      address.country,
    ].filter(Boolean);
    
    return parts.join(', ');
  }
  
  return '';
};

/**
 * Format emergency contact for display
 * @param contact - Emergency contact object
 * @returns Formatted contact string
 */
export const formatEmergencyContact = (contact: any): string => {
  if (!contact) return 'Not provided';
  
  const parts = [
    contact.name,
    contact.phone ? formatPhoneNumber(contact.phone) : '',
    capitalizeRelationship(contact.relationship),
  ].filter(Boolean);
  
  return parts.join(' • ');
};

/**
 * Format medication dosage for display
 * @param dosage - Dosage information
 * @returns Formatted dosage string
 */
export const formatMedicationDosage = (dosage: string): string => {
  if (!dosage) return 'Dosage not specified';
  return dosage;
};

/**
 * Format medication frequency for display
 * @param frequency - Frequency information
 * @returns Formatted frequency string
 */
export const formatMedicationFrequency = (frequency: string): string => {
  if (!frequency) return 'Frequency not specified';
  return frequency;
};

/**
 * Format patient information for display
 * @param patient - Patient object
 * @returns Formatted patient info string
 */
export const formatPatientInfo = (patient: any): string => {
  if (!patient) return 'Patient information not available';
  
  const parts = [
    patient.name,
    patient.dateOfBirth ? `${getAge(patient.dateOfBirth)} years old` : '',
    patient.gender,
  ].filter(Boolean);
  
  return parts.join(' • ');
};

/**
 * Format doctor information for display
 * @param doctor - Doctor object
 * @returns Formatted doctor info string
 */
export const formatDoctorInfo = (doctor: any): string => {
  if (!doctor) return 'Doctor information not available';
  
  const parts = [
    doctor.title || 'Dr.',
    doctor.firstName,
    doctor.lastName,
    doctor.specialty ? `(${formatMedicalSpecialty(doctor.specialty)})` : '',
  ].filter(Boolean);
  
  return parts.join(' ');
};

/**
 * Format clinic information for display
 * @param clinic - Clinic object
 * @returns Formatted clinic info string
 */
export const formatClinicInfo = (clinic: any): string => {
  if (!clinic) return 'Clinic information not available';
  
  let addressInfo = '';
  
  // Check for new address format (address, city, province)
  if (clinic.address && clinic.city && clinic.province) {
    const parts = [
      clinic.address,
      clinic.city,
      clinic.province,
      clinic.zipCode
    ].filter(Boolean);
    addressInfo = parts.join(', ');
  }
  // Check for old address format (addressLine) as fallback
  else if (clinic.addressLine) {
    addressInfo = clinic.addressLine;
  }
  // Check for single address field
  else if (clinic.address) {
    addressInfo = formatAddress(clinic.address);
  }
  
  const parts = [
    clinic.name,
    addressInfo
  ].filter(Boolean);
  
  return parts.join(' • ');
};

/**
 * Format clinic address with fallback to addressLine
 * @param clinic - Clinic object
 * @returns Formatted address string
 */
export const formatClinicAddress = (clinic: any): string => {
  if (!clinic) return 'Address not available';
  
  // Check for new address format (address, city, province)
  if (clinic.address && clinic.city && clinic.province) {
    const parts = [
      clinic.address,
      clinic.city,
      clinic.province,
      clinic.zipCode
    ].filter(Boolean);
    return parts.join(', ');
  }
  
  // Check for old address format (addressLine) as fallback
  if (clinic.addressLine) {
    return clinic.addressLine;
  }
  
  // Fallback
  return 'Address not available';
};

/**
 * Format medical history entry for display
 * @param history - Medical history object
 * @returns Formatted history string
 */
export const formatMedicalHistory = (history: any): string => {
  if (!history) return 'Medical history not available';
  
  const parts = [
    history.type,
    history.consultationDate ? formatDate(history.consultationDate) : '',
    history.provider ? formatDoctorInfo(history.provider) : '',
  ].filter(Boolean);
  
  return parts.join(' • ');
};

/**
 * Convert snake_case string to title case
 * @param str - Input string
 * @returns Title case string
 */
export const snakeCaseToTitleCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}; 

/**
 * Capitalize emergency contact relationship
 * @param relationship - The relationship string
 * @returns Capitalized relationship string
 */
export const capitalizeRelationship = (relationship: string): string => {
  if (!relationship) return '';
  
  // Handle common relationship formats
  const relationshipLower = relationship.toLowerCase().trim();
  
  // Map common variations to proper capitalized forms
  const relationshipMap: Record<string, string> = {
    'spouse': 'Spouse',
    'husband': 'Husband',
    'wife': 'Wife',
    'parent': 'Parent',
    'father': 'Father',
    'mother': 'Mother',
    'dad': 'Dad',
    'mom': 'Mom',
    'child': 'Child',
    'son': 'Son',
    'daughter': 'Daughter',
    'sibling': 'Sibling',
    'brother': 'Brother',
    'sister': 'Sister',
    'friend': 'Friend',
    'relative': 'Relative',
    'guardian': 'Guardian',
    'other': 'Other',
  };
  
  // Check if it's a known relationship
  if (relationshipMap[relationshipLower]) {
    return relationshipMap[relationshipLower];
  }
  
  // For custom relationships, capitalize first letter of each word
  return relationship
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}; 

// Frequency formatting utility
const FREQUENCY_MAPPING: Record<string, { abbreviation: string; meaning: string }> = {
  'ac': { abbreviation: 'ac', meaning: 'before meals' },
  'pc': { abbreviation: 'pc', meaning: 'after meals' },
  'daily': { abbreviation: 'daily', meaning: 'every day, daily' },
  'bid': { abbreviation: 'bid', meaning: 'twice a day' },
  'tid': { abbreviation: 'tid', meaning: 'three times a day' },
  'qid': { abbreviation: 'qid', meaning: 'four times a day' },
  'qh': { abbreviation: 'qh', meaning: 'every hour' },
  'at bedtime': { abbreviation: 'at bedtime', meaning: 'at bedtime, hour of sleep' },
  'qn': { abbreviation: 'qn', meaning: 'every night' },
  'stat': { abbreviation: 'stat', meaning: 'immediately' },
  'q2h': { abbreviation: 'q2h', meaning: 'Every 2 hours' },
  'q4h': { abbreviation: 'q4h', meaning: 'Every 4 hours' },
  'q6h': { abbreviation: 'q6h', meaning: 'Every 6 hours' },
  'q8h': { abbreviation: 'q8h', meaning: 'Every 8 hours' },
  'q12h': { abbreviation: 'q12h', meaning: 'Every 12 hours' },
  'every other day': { abbreviation: 'every other day', meaning: 'every other day' },
  'prn': { abbreviation: 'prn', meaning: 'as needed' },
  '3 times weekly': { abbreviation: '3 times weekly', meaning: 'three times per week' },
  'biw': { abbreviation: 'biw', meaning: 'twice per week' },
  'qw': { abbreviation: 'qw', meaning: 'once per week' },
};

/**
 * Format frequency for display based on user role
 * @param frequency - The frequency value to format
 * @param userRole - The role of the user ('patient' | 'specialist')
 * @returns Formatted frequency string
 */
export const formatFrequency = (frequency: string, userRole: 'patient' | 'specialist'): string => {
  if (!frequency) return 'N/A';
  
  // Check if the frequency is already in our mapping
  const mapping = FREQUENCY_MAPPING[frequency.toLowerCase()];
  if (mapping) {
    return userRole === 'specialist' ? mapping.abbreviation : mapping.meaning;
  }
  
  // If not in mapping, check if it's a meaning that maps to an abbreviation
  const meaningMapping = Object.values(FREQUENCY_MAPPING).find(item => 
    item.meaning.toLowerCase() === frequency.toLowerCase()
  );
  if (meaningMapping) {
    return userRole === 'specialist' ? meaningMapping.abbreviation : meaningMapping.meaning;
  }
  
  // If not found in mapping, return as is
  return frequency;
}; 

// Route formatting utility
const ROUTE_MAPPING: Record<string, { abbreviation: string; meaning: string }> = {
  'PO': { abbreviation: 'PO', meaning: 'By mouth (oral)' },
  'IV': { abbreviation: 'IV', meaning: 'Intravenous' },
  'IM': { abbreviation: 'IM', meaning: 'Intramuscular' },
  'SC': { abbreviation: 'SC', meaning: 'Subcutaneous' },
  'SL': { abbreviation: 'SL', meaning: 'Sublingual' },
  'INH': { abbreviation: 'INH', meaning: 'Inhalation' },
  'TOP': { abbreviation: 'TOP', meaning: 'Topical' },
  'RECT': { abbreviation: 'RECT', meaning: 'Rectal' },
  'NASAL': { abbreviation: 'NASAL', meaning: 'Nasal' },
  'OPHTH': { abbreviation: 'OPHTH', meaning: 'Ophthalmic' },
  'OTIC': { abbreviation: 'OTIC', meaning: 'Otic (ear)' },
  'VAG': { abbreviation: 'VAG', meaning: 'Vaginal' },
  'BUCCAL': { abbreviation: 'BUCCAL', meaning: 'Buccal' },
  'TRANSDERMAL': { abbreviation: 'TD', meaning: 'Transdermal' },
  'INTRADERMAL': { abbreviation: 'ID', meaning: 'Intradermal' },
  'INTRATHECAL': { abbreviation: 'IT', meaning: 'Intrathecal' },
  'EPIDURAL': { abbreviation: 'EPIDURAL', meaning: 'Epidural' },
  'INTRAARTICULAR': { abbreviation: 'IA', meaning: 'Intra-articular' },
  'INTRAOCULAR': { abbreviation: 'IO', meaning: 'Intraocular' },
  'HHN': { abbreviation: 'HHN', meaning: 'Handheld nebulizer' },
  'IVTT': { abbreviation: 'IVTT', meaning: 'Intravenous therapy technique' },
  'IVP': { abbreviation: 'IVP', meaning: 'Intravenous push' },
  'IVPB': { abbreviation: 'IVPB', meaning: 'Intravenous piggyback' },
  'MDI': { abbreviation: 'MDI', meaning: 'Metered-dose inhaler' },
  'NEB': { abbreviation: 'NEB', meaning: 'Nebulizer' },
  'NGT': { abbreviation: 'NGT', meaning: 'Nasogastric tube' },
  'PR': { abbreviation: 'PR', meaning: 'In the rectum' },
  'S&S': { abbreviation: 'S&S', meaning: 'Swish and swallow' },
  // Specific ear and eye routes (previously "Write out")
  'RIGHT EAR': { abbreviation: 'right ear', meaning: 'right ear' },
  'LEFT EAR': { abbreviation: 'left ear', meaning: 'left ear' },
  'EACH EAR': { abbreviation: 'each ear', meaning: 'each ear' },
  'IN THE RIGHT EYE': { abbreviation: 'in the right eye', meaning: 'in the right eye' },
  'IN THE LEFT EYE': { abbreviation: 'in the left eye', meaning: 'in the left eye' },
  'IN BOTH EYES': { abbreviation: 'in both eyes', meaning: 'in both eyes' },
  'SUBCUTANEOUSLY, SUB Q': { abbreviation: 'subcutaneously, Sub q', meaning: 'subcutaneously, Sub q' },
};

/**
 * Format route for display based on user role
 * @param route - The route value to format
 * @param userRole - The role of the user ('patient' | 'specialist')
 * @returns Formatted route string
 */
export const formatRoute = (route: string | undefined, userRole: 'patient' | 'specialist'): string => {
  if (!route) return '';
  
  const upperRoute = route.toUpperCase();
  const routeInfo = ROUTE_MAPPING[upperRoute];
  
  if (routeInfo) {
    return userRole === 'specialist' ? routeInfo.abbreviation : routeInfo.meaning;
  }
  
  // If not found in map, return as is for specialist, or capitalize for patient
  return userRole === 'specialist' ? route : route.charAt(0).toUpperCase() + route.slice(1).toLowerCase();
};

/**
 * Format prescription duration for display
 * @param duration - The duration string to format
 * @returns Formatted duration string
 */
export const formatPrescriptionDuration = (duration: string): string => {
  if (!duration) return 'Duration not specified';
  
  // Handle special cases
  if (duration.toLowerCase().includes('ongoing') || duration.toLowerCase().includes('continuous')) {
    return 'Ongoing';
  }
  
  // Parse duration string (e.g., "7 days", "2 weeks", "1 month")
  const durationMatch = duration.match(/^(\d+)\s*(day|days|week|weeks|month|months|year|years)$/i);
  
  if (!durationMatch) {
    return duration; // Return as is if we can't parse it
  }
  
  const [, amount, unit] = durationMatch;
  const durationAmount = parseInt(amount, 10);
  const durationUnit = unit.toLowerCase();
  
  // Format based on unit
  switch (durationUnit) {
    case 'day':
    case 'days':
      return `${durationAmount} ${durationAmount === 1 ? 'day' : 'days'}`;
    case 'week':
    case 'weeks':
      return `${durationAmount} ${durationAmount === 1 ? 'week' : 'weeks'}`;
    case 'month':
    case 'months':
      return `${durationAmount} ${durationAmount === 1 ? 'month' : 'months'}`;
    case 'year':
    case 'years':
      return `${durationAmount} ${durationAmount === 1 ? 'year' : 'years'}`;
    default:
      return duration;
  }
};

/**
 * Calculate prescription status based on creation date and duration
 * @param prescribedDate - ISO date string when prescription was created
 * @param duration - Duration string (e.g., "7 days", "2 weeks", "1 month")
 * @returns 'active' | 'completed' | 'discontinued'
 */
export const calculatePrescriptionStatus = (prescribedDate: string, duration: string): 'active' | 'completed' | 'discontinued' => {
  if (!prescribedDate || !duration) {
    return 'active'; // Default to active if missing data
  }
  
  // Handle ongoing/continuous prescriptions
  if (duration.toLowerCase().includes('ongoing') || duration.toLowerCase().includes('continuous')) {
    return 'active';
  }
  
  try {
    const prescriptionDate = new Date(prescribedDate);
    const now = new Date();
    
    // Parse duration string (e.g., "7 days", "2 weeks", "1 month")
    const durationMatch = duration.match(/^(\d+)\s*(day|days|week|weeks|month|months|year|years)$/i);
    
    if (!durationMatch) {
      return 'active'; // Default to active if we can't parse duration
    }
    
    const [, amount, unit] = durationMatch;
    const durationAmount = parseInt(amount, 10);
    const durationUnit = unit.toLowerCase();
    
    // Calculate end date based on duration
    const endDate = new Date(prescriptionDate);
    
    switch (durationUnit) {
      case 'day':
      case 'days':
        endDate.setDate(endDate.getDate() + durationAmount);
        break;
      case 'week':
      case 'weeks':
        endDate.setDate(endDate.getDate() + (durationAmount * 7));
        break;
      case 'month':
      case 'months':
        endDate.setMonth(endDate.getMonth() + durationAmount);
        break;
      case 'year':
      case 'years':
        endDate.setFullYear(endDate.getFullYear() + durationAmount);
        break;
      default:
        return 'active';
    }
    
    // Compare current date with end date
    if (now > endDate) {
      return 'completed';
    } else {
      return 'active';
    }
  } catch (error) {
    console.error('Error calculating prescription status:', error);
    return 'active'; // Default to active on error
  }
};