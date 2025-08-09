import { Appointment, Prescription, Certificate, Patient } from '@/services/database/firebase';
import { UserProfile } from '@/types/auth';

// Type guards for core entities
export const isValidUser = (user: any): user is UserProfile => {
  return (
    user &&
    typeof user === 'object' &&
    typeof user.uid === 'string' &&
    user.uid.length > 0
  );
};

export const isValidPatient = (patient: any): patient is Patient => {
  return (
    patient &&
    typeof patient === 'object' &&
    typeof patient.id === 'string' &&
    patient.id.length > 0 &&
    typeof patient.patientFirstName === 'string' &&
    typeof patient.patientLastName === 'string'
  );
};

export const isValidAppointment = (appointment: any): appointment is Appointment => {
  return (
    appointment &&
    typeof appointment === 'object' &&
    typeof appointment.id === 'string' &&
    appointment.id.length > 0
  );
};

export const isValidPrescription = (prescription: any): prescription is Prescription => {
  return (
    prescription &&
    typeof prescription === 'object' &&
    typeof prescription.id === 'string' &&
    prescription.id.length > 0
  );
};

export const isValidCertificate = (certificate: any): certificate is Certificate => {
  return (
    certificate &&
    typeof certificate === 'object' &&
    typeof certificate.id === 'string' &&
    certificate.id.length > 0
  );
};

// Validation functions for specific fields
export const validateEmail = (email: any): string | null => {
  if (!email || typeof email !== 'string') return null;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) ? email : null;
};

export const validatePhone = (phone: any): string | null => {
  if (!phone || typeof phone !== 'string') return null;
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Check if it's a valid phone number (7-15 digits)
  return cleaned.length >= 7 && cleaned.length <= 15 ? phone : null;
};

export const validateDate = (date: any): Date | null => {
  if (!date) return null;
  
  try {
    const parsedDate = new Date(date);
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
  } catch {
    return null;
  }
};

export const validateTime = (time: any): string | null => {
  if (!time || typeof time !== 'string') return null;
  
  // Check if time is in HH:MM format
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time) ? time : null;
};

// Array validation
export const validateArray = <T>(
  array: any,
  validator: (item: any) => item is T
): T[] => {
  if (!Array.isArray(array)) return [];
  
  return array.filter(validator);
};

// Safe object access with validation
export const safeGet = <T>(
  obj: any,
  key: string,
  validator: (value: any) => value is T,
  fallback: T
): T => {
  const value = obj?.[key];
  return validator(value) ? value : fallback;
};

// Data sanitization
export const sanitizeString = (str: any): string => {
  if (!str || typeof str !== 'string') return '';
  
  // Remove potentially dangerous characters and trim
  return str.trim().replace(/[<>]/g, '');
};

export const sanitizeObject = <T extends Record<string, any>>(
  obj: T,
  sanitizers: Partial<Record<keyof T, (value: any) => any>>
): T => {
  const sanitized = { ...obj };
  
  Object.keys(sanitizers).forEach(key => {
    if (key in sanitized && sanitizers[key as keyof T]) {
      const sanitizer = sanitizers[key as keyof T]!;
      sanitized[key as keyof T] = sanitizer(sanitized[key as keyof T]);
    }
  });
  
  return sanitized;
};

// Export validation utilities
export const dataValidation = {
  isValidUser,
  isValidAppointment,
  isValidPrescription,
  isValidCertificate,
  validateEmail,
  validatePhone,
  validateDate,
  validateTime,
  validateArray,
  safeGet,
  sanitizeString,
  sanitizeObject,
};

export default dataValidation;
