import { getReferringSpecialistClinic, findRoomFromSchedule, getReferralDataWithClinicAndRoom } from '../referralUtils';
import { databaseService } from '../../services/database/firebase';

// Mock the database service
jest.mock('../../services/database/firebase', () => ({
  databaseService: {
    getSpecialistSchedules: jest.fn(),
    getClinicById: jest.fn(),
  },
}));

const mockDatabaseService = databaseService as jest.Mocked<typeof databaseService>;

describe('referralUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getReferringSpecialistClinic', () => {
    it('should return clinic information for a specialist with active schedules', async () => {
      const mockSchedules = {
        'sched_1': {
          isActive: true,
          validFrom: '2024-01-01',
          practiceLocation: {
            clinicId: 'clinic_123',
            roomOrUnit: 'Room 101'
          }
        }
      };

      const mockClinicData = {
        name: 'Test Clinic',
        addressLine: '123 Test St'
      };

      mockDatabaseService.getSpecialistSchedules.mockResolvedValue(mockSchedules);
      mockDatabaseService.getClinicById.mockResolvedValue(mockClinicData);

      const result = await getReferringSpecialistClinic('specialist_123');

      expect(result).toEqual({
        clinicId: 'clinic_123',
        clinicName: 'Test Clinic'
      });
      expect(mockDatabaseService.getSpecialistSchedules).toHaveBeenCalledWith('specialist_123');
      expect(mockDatabaseService.getClinicById).toHaveBeenCalledWith('clinic_123');
    });

    it('should return null when no schedules are found', async () => {
      mockDatabaseService.getSpecialistSchedules.mockResolvedValue(null);

      const result = await getReferringSpecialistClinic('specialist_123');

      expect(result).toBeNull();
    });
  });

  describe('findRoomFromSchedule', () => {
    it('should find the correct room for a matching schedule', async () => {
      const mockSchedules = {
        'sched_1': {
          isActive: true,
          validFrom: '2024-01-01',
          recurrence: {
            dayOfWeek: [1, 2, 3], // Monday, Tuesday, Wednesday
            type: 'weekly'
          },
          slotTemplate: {
            '02:00 PM': {
              defaultStatus: 'available',
              durationMinutes: 20
            }
          },
          practiceLocation: {
            clinicId: 'clinic_123',
            roomOrUnit: 'Room 201'
          }
        }
      };

      mockDatabaseService.getSpecialistSchedules.mockResolvedValue(mockSchedules);

      // Test with a Monday (dayOfWeek = 1) at 2:00 PM
      const result = await findRoomFromSchedule('specialist_123', '2024-01-01', '02:00 PM');

      expect(result).toEqual({
        roomOrUnit: 'Room 201',
        clinicId: 'clinic_123',
        scheduleId: 'sched_1'
      });
    });

    it('should return null when no matching schedule is found', async () => {
      const mockSchedules = {
        'sched_1': {
          isActive: true,
          validFrom: '2024-01-01',
          recurrence: {
            dayOfWeek: [1, 2, 3], // Monday, Tuesday, Wednesday
            type: 'weekly'
          },
          slotTemplate: {
            '02:00 PM': {
              defaultStatus: 'available',
              durationMinutes: 20
            }
          },
          practiceLocation: {
            clinicId: 'clinic_123',
            roomOrUnit: 'Room 201'
          }
        }
      };

      mockDatabaseService.getSpecialistSchedules.mockResolvedValue(mockSchedules);

      // Test with a Sunday (dayOfWeek = 0) which is not in the schedule
      const result = await findRoomFromSchedule('specialist_123', '2024-01-07', '02:00 PM');

      expect(result).toBeNull();
    });
  });

  describe('getReferralDataWithClinicAndRoom', () => {
    it('should return comprehensive referral data', async () => {
      const mockReferringSchedules = {
        'sched_1': {
          isActive: true,
          validFrom: '2024-01-01',
          practiceLocation: {
            clinicId: 'referring_clinic_123',
            roomOrUnit: 'Room 101'
          }
        }
      };

      const mockAssignedSchedules = {
        'sched_2': {
          isActive: true,
          validFrom: '2024-01-01',
          recurrence: {
            dayOfWeek: [1], // Monday
            type: 'weekly'
          },
          slotTemplate: {
            '02:00 PM': {
              defaultStatus: 'available',
              durationMinutes: 20
            }
          },
          practiceLocation: {
            clinicId: 'assigned_clinic_456',
            roomOrUnit: 'Room 201'
          }
        }
      };

      const mockReferringClinic = { name: 'Referring Clinic' };
      const mockAssignedClinic = { name: 'Assigned Clinic' };

      mockDatabaseService.getSpecialistSchedules
        .mockResolvedValueOnce(mockReferringSchedules) // For referring specialist
        .mockResolvedValueOnce(mockAssignedSchedules); // For assigned specialist
      
      mockDatabaseService.getClinicById
        .mockResolvedValueOnce(mockReferringClinic)
        .mockResolvedValueOnce(mockAssignedClinic);

      const result = await getReferralDataWithClinicAndRoom(
        'referring_specialist_123',
        'assigned_specialist_456',
        '2024-01-01', // Monday
        '02:00 PM'
      );

      expect(result).toEqual({
        referringClinicId: 'referring_clinic_123',
        referringClinicName: 'Referring Clinic',
        roomOrUnit: 'Room 201',
        assignedClinicId: 'assigned_clinic_456',
        scheduleId: 'sched_2'
      });
    });
  });
});
