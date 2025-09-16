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
    console.log('🔍 Getting referring specialist clinic for:', referringSpecialistId);
    
    // Get specialist's schedules to find their primary clinic
    const specialistSchedules = await databaseService.getSpecialistSchedules(referringSpecialistId);
    
    if (!specialistSchedules || Object.keys(specialistSchedules).length === 0) {
      console.log('❌ No schedules found for referring specialist');
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
      console.log('❌ No active schedules found for referring specialist');
      return null;
    }

    // Get the most recent schedule (highest validFrom date)
    const mostRecentSchedule = activeSchedules.reduce((latest: any, current: any) => {
      return new Date(current.validFrom) > new Date(latest.validFrom) ? current : latest;
    });

    const clinicId = mostRecentSchedule.practiceLocation?.clinicId;
    if (!clinicId) {
      console.log('❌ No clinic ID found in schedule');
      return null;
    }

    // Get clinic details
    const clinicData = await databaseService.getClinicById(clinicId);
    if (!clinicData) {
      console.log('❌ Clinic data not found for ID:', clinicId);
      return null;
    }

    console.log('✅ Found referring specialist clinic:', clinicData.name);
    return {
      clinicId,
      clinicName: clinicData.name
    };

  } catch (error) {
    console.error('❌ Error getting referring specialist clinic:', error);
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
    console.log('🔍 Finding room from schedule for:', { specialistId, appointmentDate, appointmentTime });
    
    // Get specialist's schedules
    const specialistSchedules = await databaseService.getSpecialistSchedules(specialistId);
    
    if (!specialistSchedules || Object.keys(specialistSchedules).length === 0) {
      console.log('❌ No schedules found for specialist');
      return null;
    }

    // Parse appointment date to get day of week
    const appointmentDateObj = new Date(appointmentDate);
    appointmentDateObj.setHours(0, 0, 0, 0); // Reset time to start of day for consistent comparison
    const dayOfWeek = appointmentDateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    console.log('🔍 Appointment day of week:', dayOfWeek);

    // Find the schedule that matches the date and time
    const matchingSchedule = Object.entries(specialistSchedules).find(([scheduleId, schedule]: [string, any]) => {
      // Use consistent date comparison - schedule is valid if validFrom is appointment date or earlier
      const scheduleValidFrom = new Date(schedule.validFrom);
      scheduleValidFrom.setHours(0, 0, 0, 0); // Reset time to start of day
      
      console.log('🔍 Checking schedule:', {
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
      console.log('❌ No matching schedule found for date and time');
      return null;
    }

    const [scheduleId, schedule] = matchingSchedule;
    const roomOrUnit = schedule.practiceLocation?.roomOrUnit;
    const clinicId = schedule.practiceLocation?.clinicId;

    if (!roomOrUnit || !clinicId) {
      console.log('❌ Room or clinic ID not found in matching schedule');
      return null;
    }

    console.log('✅ Found matching schedule:', {
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
    console.error('❌ Error finding room from schedule:', error);
    return null;
  }
}

/**
 * Get comprehensive referral data with proper clinic and room information
 * @param referringSpecialistId - The ID of the referring specialist
 * @param assignedSpecialistId - The ID of the assigned specialist
 * @param appointmentDate - The appointment date
 * @param appointmentTime - The appointment time
 * @returns Promise with complete referral data
 */
export async function getReferralDataWithClinicAndRoom(
  referringSpecialistId: string,
  assignedSpecialistId: string,
  appointmentDate: string,
  appointmentTime: string
): Promise<{
  referringClinicId: string;
  referringClinicName: string;
  roomOrUnit: string;
  assignedClinicId: string;
  scheduleId: string;
}> {
  try {
    console.log('🔍 Getting comprehensive referral data...');

    // Get referring specialist's clinic
    const referringClinic = await getReferringSpecialistClinic(referringSpecialistId);
    if (!referringClinic) {
      throw new Error('Could not determine referring specialist clinic');
    }

    // Find room from assigned specialist's schedule
    const roomInfo = await findRoomFromSchedule(assignedSpecialistId, appointmentDate, appointmentTime);
    if (!roomInfo) {
      throw new Error('Could not find room from specialist schedule');
    }

    console.log('✅ Comprehensive referral data retrieved:', {
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
    console.error('❌ Error getting comprehensive referral data:', error);
    throw error;
  }
}
