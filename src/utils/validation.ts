/**
 * Validation utility functions for form validation
 */

import { VALIDATION_RULES, VALIDATION_MESSAGES } from '../constants/validation';

/**
 * Validate email format
 * @param email - Email string to validate
 * @returns Validation result
 */
export const validateEmail = (email: string): { isValid: boolean; message: string } => {
  if (!email) {
    return { isValid: false, message: VALIDATION_MESSAGES.REQUIRED };
  }
  
  if (!VALIDATION_RULES.EMAIL.PATTERN.test(email)) {
    return { isValid: false, message: VALIDATION_MESSAGES.INVALID_EMAIL };
  }
  
  return { isValid: true, message: '' };
};

/**
 * Validate password strength
 * @param password - Password string to validate
 * @returns Validation result
 */
export const validatePassword = (password: string): { isValid: boolean; message: string } => {
  if (!password) {
    return { isValid: false, message: VALIDATION_MESSAGES.REQUIRED };
  }
  
  if (password.length < VALIDATION_RULES.PASSWORD.MIN_LENGTH) {
    return { isValid: false, message: VALIDATION_MESSAGES.INVALID_PASSWORD };
  }
  
  if (!VALIDATION_RULES.PASSWORD.PATTERN.test(password)) {
    return { isValid: false, message: VALIDATION_MESSAGES.INVALID_PASSWORD };
  }
  
  return { isValid: true, message: '' };
};

/**
 * Validate phone number format
 * @param phone - Phone string to validate
 * @returns Validation result
 */
export const validatePhone = (phone: string): { isValid: boolean; message: string } => {
  if (!phone) {
    return { isValid: false, message: VALIDATION_MESSAGES.REQUIRED };
  }
  
  if (!VALIDATION_RULES.PHONE.PATTERN.test(phone)) {
    return { isValid: false, message: VALIDATION_MESSAGES.INVALID_PHONE };
  }
  
  return { isValid: true, message: '' };
};

/**
 * Validate name format
 * @param name - Name string to validate
 * @returns Validation result
 */
export const validateName = (name: string): { isValid: boolean; message: string } => {
  if (!name) {
    return { isValid: false, message: VALIDATION_MESSAGES.REQUIRED };
  }
  
  if (name.length < VALIDATION_RULES.NAME.MIN_LENGTH) {
    return { isValid: false, message: VALIDATION_MESSAGES.TOO_SHORT('Name', VALIDATION_RULES.NAME.MIN_LENGTH) };
  }
  
  if (name.length > VALIDATION_RULES.NAME.MAX_LENGTH) {
    return { isValid: false, message: VALIDATION_MESSAGES.TOO_LONG('Name', VALIDATION_RULES.NAME.MAX_LENGTH) };
  }
  
  if (!VALIDATION_RULES.NAME.PATTERN.test(name)) {
    return { isValid: false, message: VALIDATION_MESSAGES.INVALID_NAME };
  }
  
  return { isValid: true, message: '' };
};

/**
 * Validate required field
 * @param value - Value to validate
 * @param fieldName - Name of the field for error message
 * @returns Validation result
 */
export const validateRequired = (value: string, fieldName: string = 'Field'): { isValid: boolean; message: string } => {
  if (!value || value.trim().length === 0) {
    return { isValid: false, message: `${fieldName} is required` };
  }
  
  return { isValid: true, message: '' };
};

/**
 * Validate date format
 * @param date - Date string to validate
 * @returns Validation result
 */
export const validateDate = (date: string): { isValid: boolean; message: string } => {
  if (!date) {
    return { isValid: false, message: VALIDATION_MESSAGES.REQUIRED };
  }
  
  if (!VALIDATION_RULES.DATE.PATTERN.test(date)) {
    return { isValid: false, message: VALIDATION_MESSAGES.INVALID_DATE };
  }
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return { isValid: false, message: VALIDATION_MESSAGES.INVALID_DATE };
  }
  
  return { isValid: true, message: '' };
};

/**
 * Validate number format
 * @param number - Number string to validate
 * @returns Validation result
 */
export const validateNumber = (number: string): { isValid: boolean; message: string } => {
  if (!number) {
    return { isValid: false, message: VALIDATION_MESSAGES.REQUIRED };
  }
  
  if (!VALIDATION_RULES.NUMBER.PATTERN.test(number)) {
    return { isValid: false, message: VALIDATION_MESSAGES.INVALID_NUMBER };
  }
  
  return { isValid: true, message: '' };
};

/**
 * Validate URL format
 * @param url - URL string to validate
 * @returns Validation result
 */
export const validateUrl = (url: string): { isValid: boolean; message: string } => {
  if (!url) {
    return { isValid: false, message: VALIDATION_MESSAGES.REQUIRED };
  }
  
  if (!VALIDATION_RULES.URL.PATTERN.test(url)) {
    return { isValid: false, message: VALIDATION_MESSAGES.INVALID_URL };
  }
  
  return { isValid: true, message: '' };
};

/**
 * Validate password confirmation
 * @param password - Original password
 * @param confirmPassword - Confirmation password
 * @returns Validation result
 */
export const validatePasswordConfirmation = (password: string, confirmPassword: string): { isValid: boolean; message: string } => {
  if (!confirmPassword) {
    return { isValid: false, message: VALIDATION_MESSAGES.REQUIRED };
  }
  
  if (password !== confirmPassword) {
    return { isValid: false, message: VALIDATION_MESSAGES.PASSWORD_MISMATCH };
  }
  
  return { isValid: true, message: '' };
};

/**
 * Validate form data object
 * @param formData - Object containing form data
 * @param validationRules - Object containing validation rules for each field
 * @returns Validation result with errors for each field
 */
export const validateForm = (
  formData: Record<string, any>,
  validationRules: Record<string, (value: any) => { isValid: boolean; message: string }>
): { isValid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};
  let isValid = true;
  
  for (const [field, value] of Object.entries(formData)) {
    if (validationRules[field]) {
      const validation = validationRules[field](value);
      if (!validation.isValid) {
        errors[field] = validation.message;
        isValid = false;
      }
    }
  }
  
  return { isValid, errors };
};

/**
 * Get validation error message for a field
 * @param fieldName - Name of the field
 * @param value - Value to validate
 * @param validationType - Type of validation to perform
 * @returns Error message or empty string
 */
export const getValidationError = (
  fieldName: string,
  value: string,
  validationType: 'required' | 'email' | 'password' | 'phone' | 'name' | 'date' | 'number' | 'url'
): string => {
  let validation: { isValid: boolean; message: string };
  
  switch (validationType) {
    case 'required':
      validation = validateRequired(value, fieldName);
      break;
    case 'email':
      validation = validateEmail(value);
      break;
    case 'password':
      validation = validatePassword(value);
      break;
    case 'phone':
      validation = validatePhone(value);
      break;
    case 'name':
      validation = validateName(value);
      break;
    case 'date':
      validation = validateDate(value);
      break;
    case 'number':
      validation = validateNumber(value);
      break;
    case 'url':
      validation = validateUrl(value);
      break;
    default:
      return '';
  }
  
  return validation.isValid ? '' : validation.message;
}; 