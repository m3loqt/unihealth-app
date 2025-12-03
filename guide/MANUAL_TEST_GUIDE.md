# Manual Test Guide for Booking Functionality

This guide helps you manually test the booking functionality to ensure that booked time slots are properly blocked and displayed.

## Prerequisites

1. Make sure the app is running
2. Have access to the Firebase database
3. Be able to navigate to the booking flow

## Test Scenarios

### Test 1: Basic Booking Flow

**Objective**: Verify that a time slot can be booked successfully

**Steps**:
1. Navigate to the booking flow (`app/(patient)/book-visit/`)
2. Select a clinic and doctor
3. Choose a date and time slot
4. Complete the booking process
5. Verify the appointment is created successfully

**Expected Result**: Appointment is created without errors

### Test 2: Double Booking Prevention

**Objective**: Verify that the same time slot cannot be booked twice

**Steps**:
1. Complete Test 1 to create the first appointment
2. Start a new booking flow for the same doctor
3. Select the same date and time slot that was just booked
4. Try to complete the booking

**Expected Result**: 
- The time slot should appear as "Booked" in the UI
- The booking should be prevented with an error message
- Error message should say "Time slot X on Y is already booked for this doctor"

### Test 3: Visual Feedback for Booked Slots

**Objective**: Verify that booked slots are visually distinct

**Steps**:
1. Navigate to the date/time selection screen
2. Look for time slots that are already booked
3. Try to interact with booked slots

**Expected Result**:
- Booked slots should appear grayed out
- Booked slots should have strikethrough text
- Booked slots should display a "Booked" label
- Booked slots should be disabled (not clickable)

### Test 4: Real-time Updates

**Objective**: Verify that time slots update when returning to the selection screen

**Steps**:
1. Start a booking flow and note available time slots
2. In another session/device, book one of those time slots
3. Return to the first booking flow
4. Navigate back to the date/time selection screen

**Expected Result**: The previously available time slot should now appear as booked

### Test 5: Multiple Bookings on Same Date

**Objective**: Verify that multiple appointments can be booked on the same date

**Steps**:
1. Book an appointment for a specific date and time
2. Book another appointment for the same date but different time
3. Verify both appointments are created successfully

**Expected Result**: Both appointments should be created without conflicts

### Test 6: Different Doctors Same Time

**Objective**: Verify that different doctors can have appointments at the same time

**Steps**:
1. Book an appointment for Doctor A at 10:00 AM
2. Try to book an appointment for Doctor B at 10:00 AM on the same date
3. Complete the booking

**Expected Result**: The second appointment should be created successfully

## Automated Test Suite

You can also run the automated test suite by navigating to `/test-booking` in the app.

The automated tests cover:
- Initial availability checking
- First appointment creation
- Post-booking availability verification
- Double booking prevention
- Booked slots retrieval
- Different time slot booking
- Multiple booked slots checking
- Schedule with bookings functionality

## Troubleshooting

### Common Issues

1. **Time slots not showing as booked**
   - Check if the appointment was actually created in Firebase
   - Verify the doctorId field matches between the appointment and the query
   - Check the appointmentDate format (should be YYYY-MM-DD)

2. **Double booking not prevented**
   - Verify the `isTimeSlotBooked` function is being called in `createAppointment`
   - Check that the error is being thrown correctly
   - Ensure the error handling in the UI is working

3. **Visual feedback not working**
   - Check that `bookedTimeSlots` state is being populated correctly
   - Verify the styling for booked slots is applied
   - Ensure the disabled state is working

### Debug Information

To debug issues, check the console logs for:
- `getBookedTimeSlots` results
- `isTimeSlotBooked` results
- `createAppointment` validation
- Error messages from booking attempts

## Database Verification

You can also verify the data directly in Firebase:

1. Go to Firebase Console
2. Navigate to Realtime Database
3. Check the `appointments` node
4. Verify that appointments have the correct structure:
   ```json
   {
     "appointmentId": {
       "doctorId": "doctor-123",
       "appointmentDate": "2024-01-15",
       "appointmentTime": "10:00",
       "patientId": "patient-456",
       "clinicId": "clinic-789",
       "purpose": "Checkup",
       "createdAt": "2024-01-15T10:00:00.000Z",
       "lastUpdated": "2024-01-15T10:00:00.000Z"
     }
   }
   ```

## Success Criteria

The booking functionality is working correctly if:
-  Time slots can be booked successfully
-  Double booking is prevented
-  Booked slots are visually distinct
-  Real-time updates work
-  Multiple bookings on same date work
-  Different doctors can have same time slots
-  All automated tests pass
