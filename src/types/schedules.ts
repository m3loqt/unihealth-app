export interface ScheduleSlot {
  time: string;
  defaultStatus: 'available' | 'booked' | 'unavailable';
  durationMinutes: number;
  isBooked?: boolean;
}

export interface ScheduleDay {
  date: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  isPast: boolean;
  slots: ScheduleSlot[];
  hasSchedule: boolean;
}

export interface SpecialistSchedule {
  id: string;
  createdAt: string;
  isActive: boolean;
  lastUpdated: string;
  practiceLocation: {
    clinicId: string;
    roomOrUnit: string;
  };
  recurrence: {
    dayOfWeek: number[];
    type: string;
  };
  scheduleType: string;
  slotTemplate: { [key: string]: { defaultStatus: string; durationMinutes: number } };
  specialistId: string;
  validFrom: string;
}

export interface ScheduleFormData {
  clinicId: string;
  roomOrUnit: string;
  validFrom: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  slotDuration: number;
}

export interface Clinic {
  id: string;
  name: string;
  address?: string;
  phone?: string;
}

export interface Referral {
  id: string;
  assignedSpecialistId: string;
  appointmentDate: string;
  appointmentTime: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
}
