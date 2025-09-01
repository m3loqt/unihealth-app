/**
 * String utility functions for formatting and manipulating strings
 */

/**
 * Capitalize the first letter of a string
 * @param str - Input string
 * @returns Capitalized string
 */
export const capitalize = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Convert a string to title case
 * @param str - Input string
 * @returns Title case string
 */
export const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Truncate a string to a specified length
 * @param str - Input string
 * @param maxLength - Maximum length
 * @param suffix - Suffix to add if truncated (default: '...')
 * @returns Truncated string
 */
export const truncate = (str: string, maxLength: number, suffix: string = '...'): string => {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength) + suffix;
};

/**
 * Remove extra whitespace from a string
 * @param str - Input string
 * @returns Cleaned string
 */
export const cleanWhitespace = (str: string): string => {
  if (!str) return '';
  return str.replace(/\s+/g, ' ').trim();
};

/**
 * Generate initials from a name
 * @param name - Full name
 * @returns Initials string
 */
export const getInitials = (name: string): string => {
  if (!name) return '';
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2);
};

/**
 * Format a phone number
 * @param phone - Phone number string
 * @returns Formatted phone number
 */
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format based on length
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  return phone;
};

/**
 * Mask sensitive information like email or phone
 * @param value - Value to mask
 * @param type - Type of masking ('email', 'phone', 'name')
 * @returns Masked string
 */
export const maskSensitiveData = (value: string, type: 'email' | 'phone' | 'name'): string => {
  if (!value) return '';
  
  switch (type) {
    case 'email':
      const [local, domain] = value.split('@');
      if (local.length <= 2) return value;
      return `${local.charAt(0)}***@${domain}`;
    
    case 'phone':
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length < 4) return value;
      return `***-***-${cleaned.slice(-4)}`;
    
    case 'name':
      const words = value.split(' ');
      if (words.length === 1) {
        return words[0].length > 2 ? `${words[0].charAt(0)}***` : words[0];
      }
      return `${words[0].charAt(0)}*** ${words[words.length - 1]}`;
    
    default:
      return value;
  }
};

/**
 * Generate a random string
 * @param length - Length of the random string
 * @returns Random string
 */
export const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Check if a string is empty or only whitespace
 * @param str - Input string
 * @returns Boolean indicating if string is empty
 */
export const isEmpty = (str: string): boolean => {
  return !str || str.trim().length === 0;
};

/**
 * Count words in a string
 * @param str - Input string
 * @returns Word count
 */
export const countWords = (str: string): number => {
  if (!str) return 0;
  return str.trim().split(/\s+/).length;
};

/**
 * Convert a string to slug format
 * @param str - Input string
 * @returns Slug string
 */
export const toSlug = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

/**
 * Extract domain from email
 * @param email - Email address
 * @returns Domain string
 */
export const extractDomain = (email: string): string => {
  if (!email || !email.includes('@')) return '';
  return email.split('@')[1];
};

/**
 * Validate if string is a valid email format
 * @param email - Email string
 * @returns Boolean indicating if email is valid
 */
export const isValidEmail = (email: string): boolean => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}; 

/**
 * Extract the first name from a full name string
 * @param fullName - The full name string (e.g., "John Doe")
 * @returns The first name only (e.g., "John")
 */
export function getFirstName(fullName: string): string {
  if (!fullName || typeof fullName !== 'string') {
    return '';
  }
  return fullName.split(' ')[0];
}

/**
 * Clean an optional string field for database storage
 * @param value - The string value to clean
 * @returns The cleaned string or undefined if empty/whitespace only
 */
export const cleanOptionalString = (value: string | undefined): string | undefined => {
  return value && value.trim() ? value.trim() : undefined;
};

/**
 * Process allergies string into array for database storage
 * @param allergies - The allergies string (comma-separated)
 * @returns Array of allergies or undefined if empty/whitespace only
 */
export const processAllergies = (allergies: string | undefined): string[] | undefined => {
  if (!allergies || !allergies.trim()) {
    return undefined;
  }
  
  const processed = allergies
    .split(',')
    .map(allergy => allergy.trim())
    .filter(allergy => allergy.length > 0);
    
  return processed.length > 0 ? processed : undefined;
};

/**
 * Filter out undefined values from an object for Firebase storage
 * @param obj - The object to filter
 * @returns Object with undefined values removed
 */
export const filterUndefinedValues = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const filtered: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      filtered[key as keyof T] = value;
    }
  }
  return filtered;
}; 