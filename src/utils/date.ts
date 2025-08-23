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
 * @param dateOfBirth - Date of birth string
 * @returns Age in years
 */
export const getAge = (dateOfBirth: string): number => {
  try {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  } catch (error) {
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
 * Get current timestamp
 * @returns Current timestamp
 */
export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
}; 