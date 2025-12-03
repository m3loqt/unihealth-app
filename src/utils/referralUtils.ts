import { databaseService } from '../services/database/firebase';

/**
 * Get the referring specialist's clinic information
 * @param referringSpecialistId - The ID of the referring specialist
 * @returns Promise with clinic information or null if not found
 */
export async function getReferringSpecialistClinic(referringSpecialistId: string): Promise<{
  clinicId: string;
  clinicName: string;
} | null> {
  try {
    console.log('Getting referring specialist clinic for:', referringSpecialistId);
    
    // Get specialist's schedules to find their primary clinic
    const specialistSchedules = await databaseService.getSpecialistSchedules(referringSpecialistId);
    
    if (!specialistSchedules || Object.keys(specialistSchedules).length === 0) {
      console.log('No schedules found for referring specialist');
      return null;
    }

    // Find the most recent active schedule to determine primary clinic
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for consistent comparison
    
    const activeSchedules = Object.values(specialistSchedules).filter((schedule: any) => {
      const scheduleValidFrom = new Date(schedule.validFrom);
      scheduleValidFrom.setHours(0, 0, 0, 0); // Reset time to start of day
      return schedule.isActive && scheduleValidFrom <= today;
    });

    if (activeSchedules.length === 0) {
      console.log(' No active schedules found for referring specialist');
      return null;
    }

    // Get the most recent schedule (highest validFrom date)
    const mostRecentSchedule = activeSchedules.reduce((latest: any, current: any) => {
      return new Date(current.validFrom) > new Date(latest.validFrom) ? current : latest;
    }) as any;

    const clinicId = mostRecentSchedule.practiceLocation?.clinicId;
    if (!clinicId) {
      console.log(' No clinic ID found in schedule');
      return null;
    }

    // Get clinic details
    const clinicData = await databaseService.getClinicById(clinicId);
    if (!clinicData) {
      console.log('Clinic data not found for ID:', clinicId);
      return null;
    }

    console.log('Found referring specialist clinic:', clinicData.name);
    return {
      clinicId,
      clinicName: clinicData.name
    };

  } catch (error) {
    console.error('Error getting referring specialist clinic:', error);
    return null;
  }
}

/**
 * Find the correct room from specialist schedule based on appointment date and time
 * @param specialistId - The ID of the specialist
 * @param appointmentDate - The appointment date (YYYY-MM-DD format)
 * @param appointmentTime - The appointment time (e.g., "02:00 PM")
 * @returns Promise with room information or null if not found
 */
export async function findRoomFromSchedule(
  specialistId: string, 
  appointmentDate: string, 
  appointmentTime: string
): Promise<{
  roomOrUnit: string;
  clinicId: string;
  scheduleId: string;
} | null> {
  try {
    console.log(' Finding room from schedule for:', { specialistId, appointmentDate, appointmentTime });
    
    // Get specialist's schedules
    const specialistSchedules = await databaseService.getSpecialistSchedules(specialistId);
    
    if (!specialistSchedules || Object.keys(specialistSchedules).length === 0) {
      console.log('No schedules found for specialist');
      return null;
    }

    // Parse appointment date to get day of week
    const appointmentDateObj = new Date(appointmentDate);
    appointmentDateObj.setHours(0, 0, 0, 0); // Reset time to start of day for consistent comparison
    const dayOfWeek = appointmentDateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    console.log(' Appointment day of week:', dayOfWeek);

    // Find the schedule that matches the date and time
    const matchingSchedule = Object.entries(specialistSchedules).find(([scheduleId, schedule]: [string, any]) => {
      // Use consistent date comparison - schedule is valid if validFrom is appointment date or earlier
      const scheduleValidFrom = new Date(schedule.validFrom);
      scheduleValidFrom.setHours(0, 0, 0, 0); // Reset time to start of day
      
      console.log(' Checking schedule:', {
        scheduleId,
        isActive: schedule.isActive,
        validFrom: schedule.validFrom,
        validFromDate: scheduleValidFrom,
        appointmentDateObj,
        validFromCheck: scheduleValidFrom <= appointmentDateObj,
        dayOfWeek,
        scheduleDaysOfWeek: schedule.recurrence?.dayOfWeek,
        includesDayOfWeek: schedule.recurrence?.dayOfWeek?.includes(dayOfWeek),
        hasTimeSlot: schedule.slotTemplate && schedule.slotTemplate[appointmentTime]
      });

      // Check if schedule is active and valid for the appointment date
      if (!schedule.isActive || scheduleValidFrom > appointmentDateObj) {
        return false;
      }

      // Check if the day of week matches
      if (!schedule.recurrence?.dayOfWeek?.includes(dayOfWeek)) {
        return false;
      }

      // Check if the time slot exists in the schedule
      if (!schedule.slotTemplate || !schedule.slotTemplate[appointmentTime]) {
        return false;
      }

      return true;
    });

    if (!matchingSchedule) {
      console.log(' No matching schedule found for date and time');
      return null;
    }

    const [scheduleId, schedule] = matchingSchedule;
    const scheduleData = schedule as any;
    const roomOrUnit = scheduleData.practiceLocation?.roomOrUnit;
    const clinicId = scheduleData.practiceLocation?.clinicId;

    if (!roomOrUnit || !clinicId) {
      console.log(' Room or clinic ID not found in matching schedule');
      return null;
    }

    console.log(' Found matching schedule:', {
      scheduleId,
      roomOrUnit,
      clinicId
    });

    return {
      roomOrUnit,
      clinicId,
      scheduleId
    };

  } catch (error) {
    console.error(' Error finding room from schedule:', error);
    return null;
  }
}

/**
 * Get comprehensive referral data with proper clinic and room information
 * @param referringSpecialistId - The ID of the referring specialist
 * @param assignedSpecialistId - The ID of the assigned doctor (specialist or generalist)
 * @param appointmentDate - The appointment date
 * @param appointmentTime - The appointment time
 * @param isGeneralistReferral - Optional flag to indicate if this is a generalist referral (skips room lookup)
 * @returns Promise with complete referral data
 */
export async function getReferralDataWithClinicAndRoom(
  referringSpecialistId: string,
  assignedSpecialistId: string,
  appointmentDate: string,
  appointmentTime: string,
  isGeneralistReferral?: boolean
): Promise<{
  referringClinicId: string;
  referringClinicName: string;
  roomOrUnit?: string; // Optional - only present for specialist referrals
  assignedClinicId: string;
  scheduleId?: string; // Optional - only present for specialist referrals
}> {
  try {
    console.log(' Getting comprehensive referral data...');
    
    if (isGeneralistReferral) {
      console.log(' GENERALIST referral detected - skipping room lookup (rooms not required for generalists)');
      
      // For generalist referrals, we don't need room information
      // Just get the referring specialist's clinic if possible (optional)
      let referringClinic = null;
      try {
        referringClinic = await getReferringSpecialistClinic(referringSpecialistId);
      } catch (error) {
        console.warn(' Could not get referring specialist clinic (optional for generalist referrals):', error);
      }
      
      // Get assigned doctor's clinic from doctor data (generalists don't have schedules)
      let assignedClinicId = '';
      try {
        const doctorData = await databaseService.getDoctorById(assignedSpecialistId);
        if (doctorData?.clinicAffiliations && doctorData.clinicAffiliations.length > 0) {
          // Use the first clinic affiliation
          assignedClinicId = doctorData.clinicAffiliations[0];
        }
      } catch (error) {
        console.warn(' Could not get assigned doctor clinic:', error);
      }
      
      console.log(' Generalist referral data retrieved (no room required):', {
        referringClinicId: referringClinic?.clinicId || '',
        referringClinicName: referringClinic?.clinicName || '',
        assignedClinicId,
        roomOrUnit: undefined, // Explicitly not included for generalists
      });
      
      return {
        referringClinicId: referringClinic?.clinicId || '',
        referringClinicName: referringClinic?.clinicName || '',
        // roomOrUnit is intentionally omitted for generalist referrals
        assignedClinicId,
        // scheduleId is intentionally omitted for generalist referrals
      };
    }

    // For specialist referrals, perform full room lookup
    console.log(' SPECIALIST referral - performing room lookup...');

    // Get referring specialist's clinic
    const referringClinic = await getReferringSpecialistClinic(referringSpecialistId);
    if (!referringClinic) {
      throw new Error('Could not determine referring specialist clinic');
    }

    // Find room from assigned specialist's schedule
    const roomInfo = await findRoomFromSchedule(assignedSpecialistId, appointmentDate, appointmentTime);
    if (!roomInfo) {
      // Provide a more descriptive error that will be caught and filtered appropriately
      throw new Error('Unable to find available room from specialist schedule for the selected date and time. Please select a different time slot.');
    }

    console.log(' Comprehensive referral data retrieved:', {
      referringClinicId: referringClinic.clinicId,
      referringClinicName: referringClinic.clinicName,
      roomOrUnit: roomInfo.roomOrUnit,
      assignedClinicId: roomInfo.clinicId,
      scheduleId: roomInfo.scheduleId
    });

    return {
      referringClinicId: referringClinic.clinicId,
      referringClinicName: referringClinic.clinicName,
      roomOrUnit: roomInfo.roomOrUnit,
      assignedClinicId: roomInfo.clinicId,
      scheduleId: roomInfo.scheduleId
    };

  } catch (error) {
    console.error(' Error getting comprehensive referral data:', error);
    // Re-throw with clear context that this is a specialist referral error
    if (error instanceof Error) {
      // Ensure error message clearly indicates it's a specialist/room-related error
      const errorMessage = error.message.toLowerCase();
      if (!errorMessage.includes('specialist') && !errorMessage.includes('room') && !errorMessage.includes('schedule')) {
        // Wrap non-room errors to maintain context
        throw new Error(`Specialist referral error: ${error.message}`);
      }
    }
    throw error;
  }
}
