# Referral Clinic and Room Lookup System

This document explains the enhanced referral creation system that automatically determines the correct clinic and room information when a specialist creates a referral.

## Overview

Previously, the system used hardcoded default values:
- `roomOrUnit`: "Room 117" (default)
- `referringClinicId`: Same as destination clinic

The new system dynamically determines these values based on:
1. **Referring Specialist's Clinic**: Found from their active schedules
2. **Room Assignment**: Found from the assigned specialist's schedule based on appointment date/time

## Implementation

### New Utility Functions (`src/utils/referralUtils.ts`)

#### `getReferringSpecialistClinic(referringSpecialistId: string)`
- Fetches the referring specialist's schedules
- Finds the most recent active schedule
- Returns the clinic ID and name from that schedule

#### `findRoomFromSchedule(specialistId: string, appointmentDate: string, appointmentTime: string)`
- Fetches the assigned specialist's schedules
- Matches appointment date to schedule's `recurrence.dayOfWeek`
- Matches appointment time to schedule's `slotTemplate`
- Returns the room and clinic information from the matching schedule

#### `getReferralDataWithClinicAndRoom(...)`
- Combines both functions above
- Returns comprehensive referral data with proper clinic and room information

### Updated Referral Creation (`app/(specialist)/book-visit/review-confirm.tsx`)

The `handleBookAppointment` function now:
1. Calls `getReferralDataWithClinicAndRoom()` to get proper data
2. Uses the returned values instead of hardcoded defaults
3. Includes better error handling with specific error messages

## Data Flow

```
Specialist clicks "Confirm Referral"
    ↓
getReferralDataWithClinicAndRoom()
    ↓
├── getReferringSpecialistClinic() → referringClinicId, referringClinicName
└── findRoomFromSchedule() → roomOrUnit, assignedClinicId, scheduleId
    ↓
Create referral with proper data
    ↓
Save to database
```

## Schedule Matching Logic

The system matches schedules based on:

1. **Date Matching**:
   - Converts appointment date to day of week (0=Sunday, 1=Monday, etc.)
   - Checks if `schedule.recurrence.dayOfWeek` includes that day

2. **Time Matching**:
   - Checks if `schedule.slotTemplate` contains the appointment time
   - Ensures the time slot exists in the specialist's schedule

3. **Schedule Validity**:
   - Schedule must be active (`isActive: true`)
   - Schedule must be valid for the appointment date (`validFrom <= appointmentDate`)

## Error Handling

The system provides specific error messages for different failure scenarios:

- **Clinic Lookup Failure**: "Unable to determine your clinic information. Please ensure you have an active schedule."
- **Room Lookup Failure**: "Unable to find available room for the selected date and time. Please select a different time slot."

## Database Structure

### specialistSchedules Node
```
specialistSchedules/
  {specialistId}/
    {scheduleId}/
      isActive: boolean
      validFrom: string (YYYY-MM-DD)
      recurrence:
        dayOfWeek: number[] (0-6, where 0=Sunday)
        type: "weekly"
      slotTemplate:
        "02:00 PM": { defaultStatus: "available", durationMinutes: 20 }
      practiceLocation:
        clinicId: string
        roomOrUnit: string
```

### Updated Referral Data
```typescript
{
  // ... existing fields ...
  referringClinicId: string,        // From referring specialist's schedule
  referringClinicName: string,      // From clinic data
  practiceLocation: {
    clinicId: string,               // From assigned specialist's schedule
    roomOrUnit: string              // From assigned specialist's schedule
  },
  specialistScheduleId: string      // ID of the matching schedule
}
```

## Benefits

1. **Accurate Data**: No more hardcoded default values
2. **Cross-Clinic Referrals**: Properly tracks referring vs assigned clinics
3. **Room Management**: Uses actual room assignments from schedules
4. **Better Traceability**: Links referrals to specific schedule entries
5. **Error Prevention**: Validates schedule availability before creating referrals

## Testing

Unit tests are included in `src/utils/__tests__/referralUtils.test.ts` to verify:
- Clinic lookup functionality
- Room finding logic
- Schedule matching algorithms
- Error handling scenarios
