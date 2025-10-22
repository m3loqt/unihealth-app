# Specialist Schedule Date Comparison Fix

## Problem

When specialists tried to select a date during referral booking, they would get the error "No available schedule for this date" even though the date appeared as available in the calendar.

## Root Cause

There was an **inconsistency in date comparison logic** between two functions:

1. **`loadSpecialistAvailableDays`**: Used `new Date(schedule.validFrom) <= today` to determine which dates to show as available
2. **`loadSpecialistTimeSlots`**: Used `new Date(schedule.validFrom) > selectedDateObj` to validate the selected date

This inconsistency meant:
- Available dates were shown based on schedules valid from "today or earlier"
- But date selection validation checked if schedules were valid from "selected date or earlier"

If a schedule had `validFrom` set to a future date, it would show as available in the calendar but fail when selected.

## Solution

### 1. Consistent Date Comparison

Updated all date comparison logic to use consistent time normalization:

```typescript
// Before (inconsistent)
const today = new Date();
const selectedDateObj = new Date(year, month - 1, day);
new Date(schedule.validFrom) <= today
new Date(schedule.validFrom) > selectedDateObj

// After (consistent)
const today = new Date();
today.setHours(0, 0, 0, 0); // Reset time to start of day

const selectedDateObj = new Date(year, month - 1, day);
selectedDateObj.setHours(0, 0, 0, 0); // Reset time to start of day

const scheduleValidFrom = new Date(schedule.validFrom);
scheduleValidFrom.setHours(0, 0, 0, 0); // Reset time to start of day

scheduleValidFrom <= today
scheduleValidFrom <= selectedDateObj
```

### 2. Files Updated

#### `app/(specialist)/book-visit/select-datetime.tsx`
- **`loadSpecialistAvailableDays`**: Added time normalization for consistent date comparison
- **`loadSpecialistTimeSlots`**: Added time normalization and improved error logging
- **Enhanced Error Messages**: Now shows day of week and detailed debugging info

#### `src/utils/referralUtils.ts`
- **`getReferringSpecialistClinic`**: Added time normalization for date comparison
- **`findRoomFromSchedule`**: Added time normalization for date comparison

### 3. Enhanced Debugging

Added comprehensive logging to help identify schedule matching issues:

```typescript
console.log('❌ No active schedule found for date:', {
  selectedDate,
  dayOfWeek,
  availableSchedulesCount: availableSchedules.length,
  availableSchedules: availableSchedules.map((s: any) => ({
    validFrom: s.validFrom,
    validFromDate: new Date(s.validFrom),
    dayOfWeek: s.recurrence?.dayOfWeek,
    isActive: s.isActive
  }))
});
```

### 4. Better Error Messages

Updated error message to be more informative:

```typescript
// Before
"No available schedule for this date. Please select a different date."

// After  
`No available schedule for ${selectedDate} (${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}). Please select a different date.`
```

## Testing

Created unit tests in `src/utils/__tests__/dateComparison.test.ts` to verify:
- Date comparison logic works correctly
- Time component doesn't affect date comparison
- Day of week calculation is accurate

## Expected Behavior After Fix

1. **Consistent Calendar Display**: Dates shown as available will actually be selectable
2. **Accurate Schedule Matching**: Only schedules valid for the selected date will be considered
3. **Better Error Messages**: Users get more specific feedback about why a date isn't available
4. **Improved Debugging**: Console logs provide detailed information for troubleshooting

## Key Technical Details

- **Time Normalization**: All dates are normalized to start of day (00:00:00) before comparison
- **Schedule Validation**: Schedules are considered valid if `validFrom <= selectedDate`
- **Day of Week Matching**: Uses JavaScript's `getDay()` method (0=Sunday, 1=Monday, etc.)
- **Consistent Logic**: Same validation logic used in calendar display and date selection

This fix ensures that the specialist booking flow works reliably and provides clear feedback when schedule issues occur.
