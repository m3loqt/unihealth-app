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
    canceled: 'Canceled',
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
    contact.relationship,
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
  // Check for old address format (addressLine)
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