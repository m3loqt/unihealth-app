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
   * Safely get user's address
   */
  getUserAddress(user: any, fallback: string = 'Not provided'): string {
    if (!user) return fallback;
    
    if (user.address) return user.address;
    if (user.profile?.address) return user.profile.address;
    
    return fallback;
  },

  /**
   * Safely get appointment patient name
   */
  getAppointmentPatientName(appointment: any, fallback: string = 'Unknown Patient'): string {
    if (!appointment) return fallback;
    
    if (appointment.patientFirstName && appointment.patientLastName) {
      return `${appointment.patientFirstName} ${appointment.patientLastName}`;
    }
    if (appointment.patientFirstName) return appointment.patientFirstName;
    if (appointment.patientLastName) return appointment.patientLastName;
    
    return fallback;
  },

  /**
   * Safely get appointment doctor name
   */
  getAppointmentDoctorName(appointment: any, fallback: string = 'Dr. Unknown'): string {
    if (!appointment) return fallback;
    
    if (appointment.doctorFirstName && appointment.doctorLastName) {
      return `${appointment.doctorFirstName} ${appointment.doctorLastName}`;
    }
    if (appointment.doctorFirstName) return `Dr. ${appointment.doctorFirstName}`;
    if (appointment.doctorLastName) return `Dr. ${appointment.doctorLastName}`;
    
    return fallback;
  },

  /**
   * Safely get appointment clinic name
   * @deprecated Use getAppointmentClinicNameAsync instead to fetch from clinics node
   */
  getAppointmentClinicName(appointment: any, fallback: string = 'Clinic not specified'): string {
    if (!appointment) return fallback;
    
    return appointment.clinicName || fallback;
  },

  /**
   * Safely get appointment clinic name by fetching from clinics node
   * This is the preferred method as it ensures data consistency
   */
  async getAppointmentClinicNameAsync(appointment: any, clinicData: any = null, fallback: string = 'Clinic not specified'): Promise<string> {
    if (!appointment) return fallback;
    
    // If clinicData is provided, use it
    if (clinicData && clinicData.name) {
      return clinicData.name;
    }
    
    // If appointment has clinicId, we should fetch from clinics node
    if (appointment.clinicId) {
      try {
        // Import here to avoid circular dependencies
        const { databaseService } = await import('@/services/database/firebase');
        const clinic = await databaseService.getClinicById(appointment.clinicId);
        return clinic?.name || fallback;
      } catch (error) {
        console.error('Error fetching clinic name:', error);
        // Fallback to clinicName if available
        return appointment.clinicName || fallback;
      }
    }
    
    // Fallback to clinicName if no clinicId
    return appointment.clinicName || fallback;
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
    
    // Check for bloodType in user object
    if (user.bloodType) {
      // Handle "not-known" case from database
      if (user.bloodType === 'not-known') {
        return 'Not known yet';
      }
      return user.bloodType;
    }
    
    // Check for patientBloodType in user object
    if (user.patientBloodType) {
      // Handle "not-known" case from database
      if (user.patientBloodType === 'not-known') {
        return 'Not known yet';
      }
      return user.patientBloodType;
    }
    
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
