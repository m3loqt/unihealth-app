# Date Parsing and Timezone Fix

## Problem

When specialists clicked on a Monday date during referral booking, the system incorrectly calculated the day of week as Sunday (0) instead of Monday (1), causing the error "No available schedule for this date" even though the schedule included Monday.

## Root Cause

The issue was caused by **inconsistent date handling** between date generation and date parsing:

1. **Date Generation**: Used `date.toISOString().split('T')[0]` which creates UTC date strings
2. **Date Parsing**: Used `new Date(year, month - 1, day)` which creates local date objects
3. **Timezone Mismatch**: The UTC date string could represent a different day when parsed as a local date

### Example of the Problem:
- Original date: Monday, September 22, 2025 (local time)
- `toISOString()`: "2025-09-21T16:00:00.000Z" (UTC, which is Sunday)
- `split('T')[0]`: "2025-09-21" (Sunday in UTC)
- When parsed back: Sunday instead of Monday

## Solution

### 1. Consistent Date Generation

Updated the date generation logic to use local date components instead of UTC:

```typescript
// Before (problematic)
const date = new Date();
date.setDate(date.getDate() + i);
return {
  date: date.toISOString().split('T')[0], // UTC date string
  dayOfWeek: date.getDay(),
  // ...
};

// After (fixed)
const date = new Date();
date.setDate(date.getDate() + i);
date.setHours(0, 0, 0, 0); // Ensure consistent time

// Format date as YYYY-MM-DD using local date components
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');
const dateString = `${year}-${month}-${day}`;

return {
  date: dateString, // Local date string
  dayOfWeek: date.getDay(),
  // ...
};
```

### 2. Date Validation and Correction

Added validation to ensure parsed dates match the expected day of week:

```typescript
// Validate that the parsed date matches the expected day of week
const expectedDayOfWeek = AVAILABLE_DATES.find(d => d.date === selectedDate)?.dayOfWeek;
const finalDayOfWeek = (dayOfWeek === expectedDayOfWeek) ? dayOfWeek : expectedDayOfWeek;

// Use the corrected day of week for schedule matching
return schedule.recurrence.dayOfWeek.includes(finalDayOfWeek);
```

### 3. Enhanced Debugging

Added comprehensive logging to identify date parsing issues:

```typescript
console.log('🔍 DEBUG - Selected date string:', selectedDate);
console.log('🔍 DEBUG - Parsed components:', { year, month, day });
console.log('🔍 DEBUG - Day of week (number):', dayOfWeek);
console.log('🔍 DEBUG - Expected day of week:', expectedDayOfWeek);
console.log('🔍 DEBUG - Day of week match:', dayOfWeek === expectedDayOfWeek);
console.log('🔍 DEBUG - Using day of week:', finalDayOfWeek);
```

## Files Updated

### `app/(specialist)/book-visit/select-datetime.tsx`
- **Date Generation**: Fixed to use local date components instead of UTC
- **Date Parsing**: Added validation and correction logic
- **Schedule Matching**: Uses corrected day of week for matching
- **Error Messages**: Shows correct day of week in error messages
- **Debugging**: Enhanced logging for troubleshooting

## Testing

Created unit tests in `src/utils/__tests__/dateParsing.test.ts` to verify:
- Date string parsing produces correct day of week
- Date generation creates consistent date strings
- Round-trip parsing (generate → parse) maintains consistency

## Expected Behavior After Fix

1. **Correct Day Calculation**: Monday dates will correctly calculate as day 1
2. **Schedule Matching**: Schedules with Monday availability will be found
3. **Consistent Dates**: Date generation and parsing use the same timezone
4. **Better Debugging**: Console logs show exactly what's happening with date parsing

## Key Technical Details

- **Local Date Components**: Uses `getFullYear()`, `getMonth()`, `getDate()` instead of UTC methods
- **Consistent Time**: All dates are normalized to start of day (00:00:00)
- **Validation**: Cross-checks parsed day of week against original generation
- **Fallback Logic**: Uses expected day of week if parsing produces incorrect result

## Example Fix

**Before:**
- Click Monday → Parsed as Sunday (0) → No schedule found → Error

**After:**
- Click Monday → Parsed as Monday (1) → Schedule found → Success

This fix ensures that the specialist booking flow works correctly regardless of timezone differences between date generation and parsing.
