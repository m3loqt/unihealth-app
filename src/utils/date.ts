/**
 * Date utility functions for formatting and manipulating dates
 */

/**
 * Format a date string to a readable format
 * @param dateString - ISO date string
 * @param format - Format type ('short', 'long', 'time', 'relative', 'prescription')
 * @returns Formatted date string
 */
export const formatDate = (
  dateString: string,
  format: 'short' | 'long' | 'time' | 'relative' | 'prescription' = 'short'
): string => {
  try {
    const date = new Date(dateString);
    
    switch (format) {
      case 'short':
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }); 
      case 'long':
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      case 'prescription':
        return date.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      case 'time':
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
      case 'relative':
        return getRelativeTimeString(date);
      default:
        return date.toLocaleDateString();
    }
  } catch (error) {
    return 'Invalid date';
  }
};

/**
 * Get relative time string (e.g., "2 hours ago", "3 days ago")
 * @param date - Date object
 * @returns Relative time string
 */
export const getRelativeTimeString = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Just now';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
  }
  
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
};

/**
 * Check if a date is today
 * @param dateString - ISO date string
 * @returns Boolean indicating if date is today
 */
export const isToday = (dateString: string): boolean => {
  try {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  } catch (error) {
    return false;
  }
};

/**
 * Check if a date is in the future
 * @param dateString - ISO date string
 * @returns Boolean indicating if date is in the future
 */
export const isFuture = (dateString: string): boolean => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    return date > now;
  } catch (error) {
    return false;
  }
};

/**
 * Check if a date is in the past
 * @param dateString - ISO date string
 * @returns Boolean indicating if date is in the past
 */
export const isPast = (dateString: string): boolean => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    return date < now;
  } catch (error) {
    return false;
  }
};

/**
 * Get age from date of birth
 * Supports flexible date formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, and ISO strings
 * @param dateOfBirth - Date of birth string in various formats
 * @returns Age in years, or 0 if invalid
 */
export const getAge = (dateOfBirth: string): number => {
  if (!dateOfBirth) {
    return 0;
  }

  try {
    const birthDate = parseFlexibleDate(dateOfBirth);
    
    if (!birthDate) {
      console.warn('Invalid date of birth for age calculation:', dateOfBirth);
      return 0;
    }
    
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    // Ensure age is reasonable
    if (age < 0 || age > 150) {
      console.warn('Invalid age calculated:', age, 'for date of birth:', dateOfBirth);
      return 0;
    }
    
    return age;
  } catch (error) {
    console.error('Error calculating age:', error, 'for date of birth:', dateOfBirth);
    return 0;
  }
};

/**
 * Format time string to 12-hour format
 * @param timeString - Time string in HH:MM:SS format
 * @returns Formatted time string
 */
export const formatTime = (timeString: string): string => {
  try {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch (error) {
    return 'Invalid time';
  }
};

/**
 * Get current date in ISO format
 * @returns Current date string
 */
export const getCurrentDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Get current timestamp in UTC (for backward compatibility)
 * @returns Current timestamp in UTC
 */
export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

/**
 * Get current timestamp in local time
 * @returns Current timestamp in local time as ISO string
 */
export const getCurrentLocalTimestamp = (): string => {
  const now = new Date();
  // Get timezone offset in minutes and convert to milliseconds
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  // Create local time by subtracting the offset
  const localTime = new Date(now.getTime() - timezoneOffset);
  return localTime.toISOString();
};

/**
 * Convert MM/DD/YYYY format to YYYY-MM-DD format (ISO date format)
 * @param dateString - Date string in MM/DD/YYYY format
 * @returns Date string in YYYY-MM-DD format, or empty string if invalid
 */
export const convertToISOFormat = (dateString: string): string => {
  if (!dateString || typeof dateString !== 'string') {
    return '';
  }

  try {
    // Check if already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) {
      return dateString.trim();
    }

    // Parse MM/DD/YYYY format
    const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/;
    if (!dateRegex.test(dateString.trim())) {
      console.warn('Invalid date format for conversion:', dateString);
      return '';
    }

    const [month, day, year] = dateString.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    
    // Validate the date
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      console.warn('Invalid date:', dateString);
      return '';
    }

    // Format as YYYY-MM-DD
    const yearStr = year.toString();
    const monthStr = month.toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    
    return `${yearStr}-${monthStr}-${dayStr}`;
  } catch (error) {
    console.error('Error converting date format:', error);
    return '';
  }
};

/**
 * Parse a flexible date string into a Date object
 * Supports multiple formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, and ISO strings
 * @param dateString - Date string in various formats
 * @returns Date object or null if invalid
 */
export const parseFlexibleDate = (dateString: string): Date | null => {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  try {
    const str = dateString.trim();
    
    // Handle YYYY-MM-DD format (ISO date format)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const date = new Date(`${str}T00:00:00`);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    // Handle MM/DD/YYYY or DD/MM/YYYY format
    if (str.includes('/')) {
      const parts = str.split('/').map(p => p.trim()).filter(p => p);
      if (parts.length === 3) {
        const part1 = Number(parts[0]);
        const part2 = Number(parts[1]);
        const part3 = Number(parts[2]);
        
        let year: number, month: number, day: number;
        
        // Determine format based on first part
        if (parts[0].length === 4) {
          // YYYY/MM/DD format
          year = part1;
          month = part2;
          day = part3;
        } else if (part1 > 12) {
          // DD/MM/YYYY format (first part > 12 means it's a day)
          day = part1;
          month = part2;
          year = part3;
        } else {
          // MM/DD/YYYY format (US format - most common)
          month = part1;
          day = part2;
          year = part3;
        }
        
        // Validate the parsed values
        if (year && month && day && 
            year >= 1900 && year <= 2100 && 
            month >= 1 && month <= 12 && 
            day >= 1 && day <= 31) {
          const date = new Date(year, month - 1, day);
          
          // Check if the date is valid (handles invalid dates like Feb 30)
          if (date.getFullYear() === year && 
              date.getMonth() === month - 1 && 
              date.getDate() === day) {
            return date;
          }
        }
      }
    }
    
    // Try direct parsing as fallback
    const directParse = new Date(str);
    if (!isNaN(directParse.getTime())) {
      return directParse;
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing flexible date:', error, 'for input:', dateString);
    return null;
  }
}; 