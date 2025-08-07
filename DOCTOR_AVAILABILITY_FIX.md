# Doctor Availability Fix

## Problem
The application was throwing a `TypeError: Cannot read property 'lastUpdated' of undefined` error when users selected a clinic and tried to view doctors. This error occurred because some doctors in the database don't have the `availability` field, but the UI components were trying to access `doctor.availability.lastUpdated` without proper null checks.

## Root Cause
1. **Database Inconsistency**: Some doctors in the Firebase database have the `availability` field with `lastUpdated` property, while others don't have the `availability` field at all.
2. **Missing Null Checks**: The UI components in `select-doctor.tsx` and `select-datetime.tsx` were directly accessing `doctor.availability.lastUpdated` without checking if the `availability` property exists.
3. **No Default Values**: The database service methods weren't providing default availability data for doctors that don't have it.

## Solution

### 1. UI Component Fixes
Added null checks with optional chaining in the UI components:

**File: `app/(patient)/book-visit/select-doctor.tsx`**
```typescript
// Before
Last updated: {new Date(doctor.availability.lastUpdated).toLocaleDateString()}

// After
Last updated: {doctor.availability?.lastUpdated ? new Date(doctor.availability.lastUpdated).toLocaleDateString() : 'Not available'}
```

**File: `app/(patient)/book-visit/select-datetime.tsx`**
```typescript
// Before
Last updated: {new Date(doctor?.availability?.lastUpdated || '').toLocaleDateString()}

// After
Last updated: {doctor?.availability?.lastUpdated ? new Date(doctor.availability.lastUpdated).toLocaleDateString() : 'Not available'}
```

### 2. Database Service Fixes
Modified the database service methods to provide default availability data for doctors that don't have it:

**File: `src/services/database/firebase.ts`**

**Method: `getDoctorsByClinic`**
```typescript
// Ensure doctor has proper availability data
const doctorWithDefaults = {
  id: childSnapshot.key!,
  ...doctorData,
  availability: doctorData.availability || {
    lastUpdated: new Date().toISOString(),
    weeklySchedule: {},
    specificDates: {}
  }
};
```

**Method: `getDoctorById`**
```typescript
// Ensure doctor has proper availability data
const doctorWithDefaults = {
  id: snapshot.key!,
  ...doctorData,
  availability: doctorData.availability || {
    lastUpdated: new Date().toISOString(),
    weeklySchedule: {},
    specificDates: {}
  }
};
```

## Benefits
1. **Error Prevention**: The application no longer crashes when encountering doctors without availability data.
2. **Graceful Degradation**: Shows "Not available" instead of crashing when lastUpdated is missing.
3. **Data Consistency**: All doctors returned from the database service now have a consistent availability structure.
4. **Better User Experience**: Users can still view and interact with doctors even if their availability data is incomplete.

## Testing
- ✅ Clinic selection works without errors
- ✅ Doctor list displays properly with availability information
- ✅ "Not available" is shown for doctors without lastUpdated data
- ✅ No more TypeError crashes

## Files Modified
1. `app/(patient)/book-visit/select-doctor.tsx` - Added null checks for availability.lastUpdated
2. `app/(patient)/book-visit/select-datetime.tsx` - Added null checks for availability.lastUpdated
3. `src/services/database/firebase.ts` - Added default availability data in getDoctorsByClinic and getDoctorById methods

## Database Impact
- No changes to the database structure
- Existing doctor records remain unchanged
- New default availability data is only added in memory when fetching doctors
