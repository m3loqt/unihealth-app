/**
 * Safe Data Access Utilities
 * Prevents crashes when accessing potentially undefined or null data
 */

export const safeDataAccess = {
  /**
   * Safely get user's full name from various data structures
   */
  getUserFullName(user: any, fallback: string = 'Unknown User'): string {
    if (!user) return fallback;
    
    // Try different name field patterns
    if (user.name) return user.name;
    if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
    if (user.patientFirstName && user.patientLastName) return `${user.patientFirstName} ${user.patientLastName}`;
    if (user.firstName) return user.firstName;
    if (user.patientFirstName) return user.patientFirstName;
    
    return fallback;
  },

  /**
   * Safely get user's first name
   */
  getUserFirstName(user: any, fallback: string = ''): string {
    if (!user) return fallback;
    
    if (user.firstName) return user.firstName;
    if (user.patientFirstName) return user.patientFirstName;
    if (user.name) return user.name.split(' ')[0] || '';
    
    return fallback;
  },

  /**
   * Safely get user's last name
   */
  getUserLastName(user: any, fallback: string = ''): string {
    if (!user) return fallback;
    
    if (user.lastName) return user.lastName;
    if (user.patientLastName) return user.patientLastName;
    if (user.name) return user.name.split(' ').slice(1).join(' ') || '';
    
    return fallback;
  },

  /**
   * Safely get user's age
   */
  getUserAge(user: any, fallback: number | null = null): number | null {
    if (!user) return fallback;
    
    if (user.age !== undefined && user.age !== null) return user.age;
    if (user.patientAge !== undefined && user.patientAge !== null) return user.patientAge;
    if (user.profile?.age !== undefined && user.profile?.age !== null) return user.profile.age;
    
    return fallback;
  },

  /**
   * Safely get user's gender
   */
  getUserGender(user: any, fallback: string = 'Not specified'): string {
    if (!user) return fallback;
    
    if (user.gender) return user.gender;
    if (user.patientGender) return user.patientGender;
    if (user.profile?.gender) return user.profile.gender;
    
    return fallback;
  },

  /**
   * Safely get user's phone number
   */
  getUserPhone(user: any, fallback: string = 'Not provided'): string {
    if (!user) return fallback;
    
    if (user.phone) return user.phone;
    if (user.patientPhone) return user.patientPhone;
    if (user.contactNumber) return user.contactNumber;
    if (user.profile?.phone) return user.profile.phone;
    
    return fallback;
  },

  /**
   * Safely get emergency contact phone
   */
  getEmergencyContactPhone(user: any, fallback: string = 'Not provided'): string {
    if (!user) return fallback;
    
    if (user.emergencyContact?.phone) return user.emergencyContact.phone;
    if (user.emergencyPhone) return user.emergencyPhone;
    
    return fallback;
  },

  /**
   * Safely get blood type
   */
  getBloodType(user: any, fallback: string = 'Not specified'): string {
    if (!user) return fallback;
    
    if (user.bloodType) return user.bloodType;
    if (user.patientBloodType) return user.patientBloodType;
    
    return fallback;
  },

  /**
   * Safely get user initials
   */
  getUserInitials(user: any, fallback: string = 'U'): string {
    if (!user) return fallback;
    
    const firstName = this.getUserFirstName(user);
    const lastName = this.getUserLastName(user);
    
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName[0].toUpperCase();
    }
    
    return fallback;
  },

  /**
   * Safely access nested object properties
   */
  getNestedValue(obj: any, path: string, fallback: any = null): any {
    if (!obj || !path) return fallback;
    
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return fallback;
      }
    }
    
    return current !== undefined ? current : fallback;
  }
};

export default safeDataAccess;
