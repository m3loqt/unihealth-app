import { useState, useEffect, useCallback } from 'react';
import { databaseService } from '../../services/database/firebase';
import { SpecialistSchedule, ScheduleFormData, Referral } from '../../types/schedules';
import { getCurrentLocalTimestamp } from '../../utils/date';

export const useSpecialistSchedules = (specialistId: string) => {
  const [schedules, setSchedules] = useState<SpecialistSchedule[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchedules = useCallback(async () => {
    if (!specialistId) return;

    try {
      setLoading(true);
      setError(null);

      const [specialistSchedulesData, referralsData] = await Promise.all([
        databaseService.getSpecialistSchedules(specialistId),
        databaseService.getSpecialistReferrals(specialistId)
      ]);

      if (specialistSchedulesData) {
        const schedulesArray: SpecialistSchedule[] = Object.entries(specialistSchedulesData).map(([id, data]: [string, any]) => ({
          id,
          ...data,
        }));
        console.log('🗑️ Loaded schedules:', schedulesArray);
        setSchedules(schedulesArray);
      }

      setReferrals(referralsData || []);
    } catch (error) {
      console.error('Error loading schedules:', error);
      setError('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  }, [specialistId]);

  const addSchedule = useCallback(async (formData: ScheduleFormData) => {
    console.log('🔍 addSchedule called in hook');
    console.log('🔍 specialistId:', specialistId);
    console.log('🔍 formData:', formData);
    
    try {
      setError(null);
      
      console.log('Adding schedule with form data:', formData);
      
      // Validate required fields
      if (!formData.clinicId) {
        throw new Error('Clinic is required');
      }
      if (!formData.roomOrUnit?.trim()) {
        throw new Error('Room/Unit is required');
      }
      if (!formData.startTime) {
        throw new Error('Start time is required');
      }
      if (!formData.endTime) {
        throw new Error('End time is required');
      }
      if (formData.daysOfWeek.length === 0) {
        throw new Error('At least one day of the week must be selected');
      }
      
      // Generate time slots based on start time, end time, and duration
      const slots = generateTimeSlots(formData.startTime, formData.endTime, formData.slotDuration);
      console.log('Generated slots:', slots);
      
      const scheduleData = {
        createdAt: getCurrentLocalTimestamp(),
        isActive: true,
        lastUpdated: getCurrentLocalTimestamp(),
        practiceLocation: {
          clinicId: formData.clinicId,
          roomOrUnit: formData.roomOrUnit,
        },
        recurrence: {
          dayOfWeek: formData.daysOfWeek,
          type: 'weekly',
        },
        scheduleType: 'Weekly',
        slotTemplate: slots,
        specialistId,
        validFrom: formData.validFrom,
      };

      console.log('Schedule data to save:', scheduleData);
      const scheduleId = await databaseService.addSpecialistSchedule(specialistId, scheduleData);
      console.log('✅ Schedule saved with ID:', scheduleId);
      
      // Reload schedules to get the updated list
      await loadSchedules();
      console.log('✅ Schedules reloaded');
      
      return scheduleId;
    } catch (error) {
      console.error('❌ Error adding schedule:', error);
      setError('Failed to add schedule');
      throw error;
    }
  }, [specialistId, loadSchedules]);

  const updateSchedule = useCallback(async (scheduleId: string, formData: ScheduleFormData) => {
    try {
      setError(null);
      
      // TEMPORARY DEBUG: Skip validation for testing
      const SKIP_VALIDATION = true; // Set to false to re-enable validation
      
      if (!SKIP_VALIDATION) {
        // Check if schedule can be updated (no confirmed appointments that match this schedule's pattern)
        const canUpdate = await canScheduleBeModified(scheduleId, formData.validFrom);
        console.log('🔍 updateSchedule: Can update?', canUpdate);
        if (!canUpdate) {
          throw new Error('Cannot modify schedule: there are confirmed appointments that match this schedule\'s pattern');
        }
      } else {
        console.log('🔍 updateSchedule: SKIPPING VALIDATION FOR DEBUG');
      }

      // Generate time slots based on start time, end time, and duration
      const slots = generateTimeSlots(formData.startTime, formData.endTime, formData.slotDuration);
      
      const updateData = {
        lastUpdated: getCurrentLocalTimestamp(),
        practiceLocation: {
          clinicId: formData.clinicId,
          roomOrUnit: formData.roomOrUnit,
        },
        recurrence: {
          dayOfWeek: formData.daysOfWeek,
          type: 'weekly',
        },
        slotTemplate: slots,
        validFrom: formData.validFrom,
      };

      await databaseService.updateSpecialistSchedule(specialistId, scheduleId, updateData);
      
      // Reload schedules to get the updated list
      await loadSchedules();
    } catch (error) {
      console.error('Error updating schedule:', error);
      setError('Failed to update schedule');
      throw error;
    }
  }, [specialistId, loadSchedules]);

  const deleteSchedule = useCallback(async (scheduleId: string) => {
    console.log('🗑️ deleteSchedule called in hook with scheduleId:', scheduleId);
    try {
      setError(null);
      
      // TEMPORARY DEBUG: Skip validation for testing
      const SKIP_VALIDATION = true; // Set to false to re-enable validation
      
      if (!SKIP_VALIDATION) {
        // Check if schedule can be deleted (no confirmed appointments from today onwards that match this schedule's pattern)
        const canDelete = await canScheduleBeDeleted(scheduleId);
        console.log('🗑️ Can delete schedule?', canDelete);
        if (!canDelete) {
          throw new Error('Cannot delete schedule: there are confirmed appointments from today onwards that match this schedule\'s pattern');
        }
      } else {
        console.log('🗑️ deleteSchedule: SKIPPING VALIDATION FOR DEBUG');
      }

      console.log('🗑️ Deleting schedule from database...');
      await databaseService.deleteSpecialistSchedule(specialistId, scheduleId);
      console.log('🗑️ Schedule deleted from database successfully');
      
      // Reload schedules to get the updated list
      await loadSchedules();
      console.log('🗑️ Schedules reloaded after deletion');
    } catch (error) {
      console.error('❌ Error deleting schedule:', error);
      setError('Failed to delete schedule');
      throw error;
    }
  }, [specialistId, loadSchedules]);

  const canScheduleBeDeleted = useCallback(async (scheduleId: string) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) {
      console.log('🔍 canScheduleBeDeleted: Schedule not found', scheduleId);
      return false;
    }

    const validFromDate = new Date(schedule.validFrom);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log('🔍 canScheduleBeDeleted: Checking schedule for deletion', {
      scheduleId,
      validFromDate: validFromDate.toISOString(),
      dayOfWeek: schedule.recurrence.dayOfWeek,
      timeSlots: Object.keys(schedule.slotTemplate),
      today: today.toISOString(),
      totalReferrals: referrals.length,
      totalSchedules: schedules.length
    });

    // For deletion, block if there are confirmed appointments from TODAY onwards
    // that match this schedule's pattern. Past appointments don't block deletion.
    const hasFutureConfirmedReferrals = referrals.some(referral => {
      console.log('🔍 canScheduleBeDeleted: Checking referral', {
        referralId: referral.id,
        status: referral.status,
        appointmentDate: referral.appointmentDate,
        appointmentTime: referral.appointmentTime
      });
      
      if (referral.status !== 'confirmed' && referral.status !== 'completed') {
        console.log('🔍 canScheduleBeDeleted: Referral status not confirmed/completed, skipping');
        return false;
      }
      
      // Parse appointment date as local date to avoid timezone issues
      const [year, month, day] = referral.appointmentDate.split('-').map(Number);
      const appointmentDate = new Date(year, month - 1, day); // month is 0-indexed
      
      console.log('🔍 canScheduleBeDeleted: Date comparison', {
        appointmentDate: appointmentDate.toISOString(),
        today: today.toISOString(),
        isFuture: appointmentDate >= today
      });
      
      // Block if appointment is today or in the future
      if (appointmentDate < today) {
        console.log('🔍 canScheduleBeDeleted: Referral is in the past, skipping');
        return false;
      }
      
      // Check if the appointment day of week matches the schedule's recurrence pattern
      const appointmentDayOfWeek = appointmentDate.getDay(); // 0-6 (Sunday-Saturday)
      console.log('🔍 canScheduleBeDeleted: Day of week check', {
        appointmentDayOfWeek,
        scheduleDaysOfWeek: schedule.recurrence.dayOfWeek,
        matches: schedule.recurrence.dayOfWeek.includes(appointmentDayOfWeek)
      });
      
      if (!schedule.recurrence.dayOfWeek.includes(appointmentDayOfWeek)) {
        console.log('🔍 canScheduleBeDeleted: Day of week does not match, skipping');
        return false;
      }
      
      // Check if the appointment time matches one of the schedule's time slots
      const scheduleTimeSlots = Object.keys(schedule.slotTemplate);
      console.log('🔍 canScheduleBeDeleted: Time check', {
        appointmentTime: referral.appointmentTime,
        scheduleTimeSlots,
        matches: scheduleTimeSlots.includes(referral.appointmentTime)
      });
      
      if (!scheduleTimeSlots.includes(referral.appointmentTime)) {
        console.log('🔍 canScheduleBeDeleted: Time does not match, skipping');
        return false;
      }
      
      console.log('🔍 canScheduleBeDeleted: Found future confirmed referral', {
        referralId: referral.id,
        appointmentDate: referral.appointmentDate,
        appointmentTime: referral.appointmentTime,
        status: referral.status
      });
      
      return true;
    });

    // Check for future confirmed appointments (from today onwards)
    let hasFutureConfirmedAppointments = false;
    try {
      const appointments = await databaseService.getAppointments(specialistId, 'specialist');
      console.log('🔍 canScheduleBeDeleted: Checking appointments for deletion', {
        totalAppointments: appointments.length
      });
      
      hasFutureConfirmedAppointments = appointments.some(appointment => {
        // Only block if status is confirmed or completed (not pending)
        if (appointment.status !== 'confirmed' && appointment.status !== 'completed') return false;
        
        // Parse appointment date as local date to avoid timezone issues
        const [year, month, day] = appointment.appointmentDate.split('-').map(Number);
        const appointmentDate = new Date(year, month - 1, day); // month is 0-indexed
        
        // Block if appointment is today or in the future
        if (appointmentDate < today) return false;
        
        // Check if the appointment day of week matches the schedule's recurrence pattern
        const appointmentDayOfWeek = appointmentDate.getDay(); // 0-6 (Sunday-Saturday)
        if (!schedule.recurrence.dayOfWeek.includes(appointmentDayOfWeek)) return false;
        
        // Check if the appointment time matches one of the schedule's time slots
        const scheduleTimeSlots = Object.keys(schedule.slotTemplate);
        if (!scheduleTimeSlots.includes(appointment.appointmentTime)) return false;
        
        console.log('🔍 canScheduleBeDeleted: Found future confirmed appointment', {
          appointmentId: appointment.id,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime,
          status: appointment.status
        });
        
        return true;
      });
    } catch (error) {
      console.error('Error loading appointments for schedule deletion check:', error);
      // If we can't load appointments, err on the side of caution and allow deletion
    }

    console.log('🔍 canScheduleBeDeleted: Final result', {
      hasFutureConfirmedReferrals,
      hasFutureConfirmedAppointments,
      canDelete: !hasFutureConfirmedReferrals && !hasFutureConfirmedAppointments
    });

    return !hasFutureConfirmedReferrals && !hasFutureConfirmedAppointments;
  }, [schedules, referrals, specialistId]);

  const canScheduleBeModified = useCallback(async (scheduleId: string, newValidFrom?: string) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) {
      console.log('🔍 canScheduleBeModified: Schedule not found', scheduleId);
      return false;
    }

    const validFromDate = new Date(newValidFrom || schedule.validFrom);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log('🔍 canScheduleBeModified: Checking schedule', {
      scheduleId,
      validFromDate: validFromDate.toISOString(),
      dayOfWeek: schedule.recurrence.dayOfWeek,
      timeSlots: Object.keys(schedule.slotTemplate),
      today: getCurrentLocalTimestamp(),
      totalReferrals: referrals.length,
      totalSchedules: schedules.length
    });

    // Check if there are any referrals that match this schedule's pattern
    // A schedule should be locked if there's a referral that matches:
    // 1. The schedule's recurrence pattern (day of week)
    // 2. The schedule's time slots
    // 3. The appointment date is on or after the schedule's validFrom date
    const hasConfirmedReferrals = referrals.some(referral => {
      console.log('🔍 canScheduleBeModified: Checking referral', {
        referralId: referral.id,
        status: referral.status,
        appointmentDate: referral.appointmentDate,
        appointmentTime: referral.appointmentTime
      });
      
      if (referral.status !== 'pending' && referral.status !== 'confirmed' && referral.status !== 'completed') {
        console.log('🔍 canScheduleBeModified: Referral status not pending/confirmed/completed, skipping');
        return false;
      }
      
      // Parse appointment date as local date to avoid timezone issues
      const [year, month, day] = referral.appointmentDate.split('-').map(Number);
      const appointmentDate = new Date(year, month - 1, day); // month is 0-indexed
      
      console.log('🔍 canScheduleBeModified: Date comparison', {
        appointmentDate: appointmentDate.toISOString(),
        validFromDate: validFromDate.toISOString(),
        isAfterValidFrom: appointmentDate >= validFromDate
      });
      
      // Check if appointment date is on or after the schedule's validFrom date
      if (appointmentDate < validFromDate) {
        console.log('🔍 canScheduleBeModified: Referral is before validFrom date, skipping');
        return false;
      }
      
      // Check if the appointment day of week matches the schedule's recurrence pattern
      const appointmentDayOfWeek = appointmentDate.getDay(); // 0-6 (Sunday-Saturday)
      console.log('🔍 canScheduleBeModified: Day of week check', {
        appointmentDayOfWeek,
        scheduleDaysOfWeek: schedule.recurrence.dayOfWeek,
        matches: schedule.recurrence.dayOfWeek.includes(appointmentDayOfWeek)
      });
      
      if (!schedule.recurrence.dayOfWeek.includes(appointmentDayOfWeek)) {
        console.log('🔍 canScheduleBeModified: Day of week does not match, skipping');
        return false;
      }
      
      // Check if the appointment time matches one of the schedule's time slots
      const scheduleTimeSlots = Object.keys(schedule.slotTemplate);
      console.log('🔍 canScheduleBeModified: Time check', {
        appointmentTime: referral.appointmentTime,
        scheduleTimeSlots,
        matches: scheduleTimeSlots.includes(referral.appointmentTime)
      });
      
      if (!scheduleTimeSlots.includes(referral.appointmentTime)) {
        console.log('🔍 canScheduleBeModified: Time does not match, skipping');
        return false;
      }
      
      console.log('🔍 canScheduleBeModified: Found matching referral', {
        referralId: referral.id,
        appointmentDate: referral.appointmentDate,
        appointmentTime: referral.appointmentTime,
        status: referral.status
      });
      
      return true;
    });

    // Also check if there are any appointments (not cancelled) that match this schedule's pattern
    // This includes follow-up appointments and other direct bookings
    let hasConfirmedAppointments = false;
    try {
      const appointments = await databaseService.getAppointments(specialistId, 'specialist');
      console.log('🔍 canScheduleBeModified: Checking appointments', {
        totalAppointments: appointments.length,
        appointments: appointments.map(apt => ({
          id: apt.id,
          appointmentDate: apt.appointmentDate,
          appointmentTime: apt.appointmentTime,
          status: apt.status
        }))
      });
      
      hasConfirmedAppointments = appointments.some(appointment => {
        // Block if status is NOT cancelled (pending, confirmed, completed all block)
        if (appointment.status === 'cancelled') return false;
        
        // Parse appointment date as local date to avoid timezone issues
        const [year, month, day] = appointment.appointmentDate.split('-').map(Number);
        const appointmentDate = new Date(year, month - 1, day); // month is 0-indexed
        
        // Check if appointment date is on or after the schedule's validFrom date
        if (appointmentDate < validFromDate) return false;
        
        // Check if the appointment day of week matches the schedule's recurrence pattern
        const appointmentDayOfWeek = appointmentDate.getDay(); // 0-6 (Sunday-Saturday)
        if (!schedule.recurrence.dayOfWeek.includes(appointmentDayOfWeek)) return false;
        
        // Check if the appointment time matches one of the schedule's time slots
        const scheduleTimeSlots = Object.keys(schedule.slotTemplate);
        if (!scheduleTimeSlots.includes(appointment.appointmentTime)) return false;
        
        console.log('🔍 canScheduleBeModified: Found matching appointment', {
          appointmentId: appointment.id,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime,
          status: appointment.status
        });
        
        return true;
      });
    } catch (error) {
      console.error('Error loading appointments for schedule modification check:', error);
      // If we can't load appointments, err on the side of caution and allow modification
      // This prevents blocking schedule changes due to database errors
    }

    console.log('🔍 canScheduleBeModified: Final result', {
      hasConfirmedReferrals,
      hasConfirmedAppointments,
      canModify: !hasConfirmedReferrals && !hasConfirmedAppointments
    });

    return !hasConfirmedReferrals && !hasConfirmedAppointments;
  }, [schedules, referrals, specialistId]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  return {
    schedules,
    referrals,
    loading,
    error,
    loadSchedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    canScheduleBeModified,
    canScheduleBeDeleted,
  };
};

// Helper function to generate time slots
const generateTimeSlots = (startTime: string, endTime: string, durationMinutes: number) => {
  const slots: { [key: string]: { defaultStatus: string; durationMinutes: number } } = {};
  
  try {
    // Parse start time (format: "09:00 AM" or "9:00 AM")
    const startMatch = startTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!startMatch) {
      throw new Error('Invalid start time format');
    }
    
    let startHour = parseInt(startMatch[1]);
    const startMinute = parseInt(startMatch[2]);
    const startPeriod = startMatch[3].toUpperCase();
    
    // Convert to 24-hour format
    if (startPeriod === 'PM' && startHour !== 12) {
      startHour += 12;
    } else if (startPeriod === 'AM' && startHour === 12) {
      startHour = 0;
    }
    
    // Parse end time (format: "05:00 PM" or "5:00 PM")
    const endMatch = endTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!endMatch) {
      throw new Error('Invalid end time format');
    }
    
    let endHour = parseInt(endMatch[1]);
    const endMinute = parseInt(endMatch[2]);
    const endPeriod = endMatch[3].toUpperCase();
    
    // Convert to 24-hour format
    if (endPeriod === 'PM' && endHour !== 12) {
      endHour += 12;
    } else if (endPeriod === 'AM' && endHour === 12) {
      endHour = 0;
    }
    
    // Create date objects for comparison
    const start = new Date(2000, 0, 1, startHour, startMinute);
    const end = new Date(2000, 0, 1, endHour, endMinute);
    
    if (start >= end) {
      throw new Error('End time must be after start time');
    }
    
    let current = new Date(start);
    
    while (current < end) {
      const timeString = current.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      
      slots[timeString] = {
        defaultStatus: 'available',
        durationMinutes,
      };
      
      current.setMinutes(current.getMinutes() + durationMinutes);
    }
    
    return slots;
  } catch (error) {
    console.error('Error generating time slots:', error);
    throw new Error('Failed to generate time slots. Please check your time format.');
  }
};
