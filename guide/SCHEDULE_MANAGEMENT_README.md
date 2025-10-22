# Schedule Management System

This document describes the schedule management functionality implemented for specialists in the UniHealth app.

## Overview

The schedule management system allows specialists to:
- View their current schedules in a calendar format
- Add new schedule blocks with specific time slots
- Edit existing schedules (with restrictions)
- Delete schedules (with restrictions)
- Manage clinic assignments and room/unit locations

## Key Features

### 1. Calendar View
- Monthly calendar display showing schedule availability
- Visual indicators for days with schedules
- Color-coded indicators for booked vs available slots
- Click on dates to view detailed schedule information

### 2. Schedule Management
- **Add New Schedules**: Create new recurring schedule blocks
- **Edit Schedules**: Modify existing schedules (with restrictions)
- **Delete Schedules**: Remove schedules (with restrictions)
- **Validation**: Prevents modification of schedules with confirmed appointments in the past

### 3. Schedule Configuration
- **Clinic Selection**: Choose from available clinics
- **Room/Unit**: Specify location within the clinic
- **Valid From Date**: Set when the schedule becomes active
- **Days of Week**: Select which days the schedule applies
- **Time Range**: Set start and end times
- **Slot Duration**: Configure appointment slot duration (15, 20, 30, 45, or 60 minutes)

## Technical Implementation

### Architecture
The system follows a modular architecture with separation of concerns:

#### 1. Types (`src/types/schedules.ts`)
```typescript
interface SpecialistSchedule {
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
```

#### 2. Custom Hook (`src/hooks/data/useSpecialistSchedules.ts`)
- Manages schedule data loading and CRUD operations
- Handles validation logic for schedule modifications
- Provides error handling and loading states

#### 3. Components
- **ScheduleForm**: Modal form for adding/editing schedules
- **ScheduleList**: Displays existing schedules with edit/delete options
- **TimePicker**: Custom time selection component

#### 4. Database Service (`src/services/database/firebase.ts`)
- `getSpecialistSchedules()`: Retrieve specialist schedules
- `addSpecialistSchedule()`: Create new schedule
- `updateSpecialistSchedule()`: Update existing schedule
- `deleteSpecialistSchedule()`: Delete schedule
- `getAllClinics()`: Get available clinics

### Data Structure

#### Schedule Block Structure
```json
{
  "sched_J0zVFWQlgQcyqkPNBvtVAGOu6U62_1": {
    "createdAt": "2025-08-20T16:50:11.741Z",
    "isActive": true,
    "lastUpdated": "2025-08-20T16:50:11.741Z",
    "practiceLocation": {
      "clinicId": "-OY7AZ7GcLok0yV2u9D9",
      "roomOrUnit": "Rm 51"
    },
    "recurrence": {
      "dayOfWeek": [3, 4, 5],
      "type": "weekly"
    },
    "scheduleType": "Weekly",
    "slotTemplate": {
      "02:00 PM": {
        "defaultStatus": "available",
        "durationMinutes": 20
      },
      "02:20 PM": {
        "defaultStatus": "available",
        "durationMinutes": 20
      }
    },
    "specialistId": "J0zVFWQlgQcyqkPNBvtVAGOu6U62",
    "validFrom": "2025-08-20"
  }
}
```

### Business Rules

#### Schedule Modification Restrictions
1. **Past Appointments**: Schedules cannot be modified if they have confirmed appointments in the past
2. **Valid From Date**: The `validFrom` date must be in the future or today
3. **Time Validation**: End time must be after start time
4. **Required Fields**: All form fields are required for schedule creation

#### Time Slot Generation
- Time slots are automatically generated based on start time, end time, and duration
- Slots are created in chronological order
- Each slot has a default status of "available"

### UI/UX Features

#### Visual Indicators
- **Calendar**: Green dots for available slots, blue for booked appointments
- **Schedule List**: Active/inactive status indicators
- **Form Validation**: Real-time validation with error messages
- **Locked Schedules**: Visual indication when schedules cannot be modified

#### User Experience
- **Modal Forms**: Clean, focused interface for schedule management
- **Time Picker**: Intuitive time selection with hour/minute/period pickers
- **Confirmation Dialogs**: Safe deletion with confirmation prompts
- **Loading States**: Clear feedback during operations
- **Error Handling**: User-friendly error messages

## Usage

### Adding a New Schedule
1. Click the "+" button in the header or "Add Schedule" in the schedule list
2. Select a clinic from the dropdown
3. Enter room/unit information
4. Set the valid from date
5. Select days of the week
6. Set start and end times using the time picker
7. Choose slot duration
8. Submit the form

### Editing a Schedule
1. Click the edit icon on any editable schedule
2. Modify the desired fields
3. Submit the form
4. Note: Some schedules may be locked if they have past appointments

### Deleting a Schedule
1. Click the delete icon on any editable schedule
2. Confirm the deletion in the dialog
3. Note: Schedules with past appointments cannot be deleted

## Future Enhancements

1. **Date Picker**: Implement a proper date picker for the valid from field
2. **Bulk Operations**: Allow multiple schedule modifications
3. **Schedule Templates**: Pre-defined schedule templates for common patterns
4. **Conflict Detection**: Warn about overlapping schedules
5. **Export/Import**: Schedule data export and import functionality
6. **Notifications**: Alerts for schedule conflicts or changes

## Testing

The system includes comprehensive validation and error handling:
- Form validation for all required fields
- Time range validation
- Schedule modification restrictions
- Database operation error handling
- Loading state management

## Dependencies

- React Native
- Firebase Realtime Database
- Lucide React Native (icons)
- Custom UI components (Button, Modal, Input, etc.)
