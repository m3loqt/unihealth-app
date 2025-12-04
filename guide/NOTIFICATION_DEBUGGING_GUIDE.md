#  Notification System Debugging Guide

## 🚨 **Issue: Notifications Not Appearing After Appointment Status Update**

If you're not seeing notifications after updating appointment status, follow this debugging guide step by step.

## 🔍 **Step 1: Check Console Logs**

First, check your browser/device console for these specific log messages:

### **Expected Console Output:**
```
 Starting updateAppointmentStatus for appointment: [ID] with status: [STATUS]
 Appointment data: { ... }
 Appointment status updated successfully
 Attempting to import notification service...
 Notification service imported successfully
 Creating patient notification for: [USER_ID]
 Patient notification created with ID: [NOTIFICATION_ID]
 Creating doctor notification for: [DOCTOR_ID]
 Doctor notification created with ID: [NOTIFICATION_ID]
```

### **If You See Errors:**
-  **Import errors**: Notification service import failed
-  **Database errors**: Firebase permission issues
-  **Missing data**: Appointment data incomplete

## 🧪 **Step 2: Test Basic Notification Creation**

Add the test button to any screen to verify the basic system works:

```typescript
import TestNotificationButton from '@/components/shared/TestNotificationButton';

// In your component
<TestNotificationButton />
```

### **Test Results:**
-  **Green button works**: Basic notification system is functional
-  **Green button fails**: Database/permission issues
-  **Blue button works**: Full notification system works
-  **Blue button fails**: Notification service import issues

## 🔧 **Step 3: Manual Database Check**

Check if notifications are being created in Firebase:

1. **Go to Firebase Console**
2. **Navigate to Realtime Database**
3. **Look for path**: `notifications/{userId}`
4. **Check if new notifications appear**

### **Expected Database Structure:**
```json
{
  "notifications": {
    "USER_ID": {
      "NOTIFICATION_ID": {
        "id": "NOTIFICATION_ID",
        "userId": "USER_ID",
        "type": "appointment",
        "title": "Appointment Confirmed",
        "message": "Your appointment...",
        "timestamp": 1703123456789,
        "read": false,
        "relatedId": "APPOINTMENT_ID",
        "priority": "high",
        "expiresAt": 1705715456789
      }
    }
  }
}
```

## 🚫 **Step 4: Common Issues & Solutions**

### **Issue 1: Import Path Error**
```
 Error: Cannot resolve module '../notificationService'
```

**Solution:**
- Check file path: `src/services/notificationService.ts`
- Verify import statement in `firebase.ts`
- Ensure file exists and is properly exported

### **Issue 2: Firebase Permission Denied**
```
 Error: permission_denied at /notifications/USER_ID
```

**Solution:**
- Update Firebase security rules (see `firebase-rules.json`)
- Ensure user is authenticated
- Check if `USER_ID` matches authenticated user

### **Issue 3: Missing Appointment Data**
```
 Error: Cannot read property 'patientId' of undefined
```

**Solution:**
- Verify appointment exists in database
- Check appointment data structure
- Ensure all required fields are present

### **Issue 4: Notification Service Not Working**
```
 Error: notificationService.createAppointmentStatusNotification is not a function
```

**Solution:**
- Check `notificationService.ts` file
- Verify class methods are properly defined
- Ensure proper export/import

## 🛠️ **Step 5: Quick Fixes**

### **Fix 1: Use Fallback Method (Immediate)**
The updated code now includes a fallback method that creates notifications directly without the notification service:

```typescript
// This will work even if notification service fails
await databaseService.updateAppointmentStatus(appointmentId, 'confirmed');
```

### **Fix 2: Check File Structure**
Ensure these files exist and are properly structured:
```
src/
├── services/
│   ├── database/
│   │   └── firebase.ts           Contains updateAppointmentStatus
│   └── notificationService.ts     Contains NotificationService class
└── hooks/
    └── data/
        └── useNotifications.ts    Contains useNotifications hook
```

### **Fix 3: Verify Firebase Rules**
Update your Firebase rules to include:
```json
{
  "notifications": {
    "$userId": {
      ".indexOn": ["timestamp"],
      ".read": "$userId === auth.uid",
      ".write": "$userId === auth.uid"
    }
  }
}
```

## 🔍 **Step 6: Debug Commands**

### **Check Notification Count:**
```typescript
const count = await databaseService.getNotificationCount(userId, true);
console.log('Unread notifications:', count);
```

### **Create Test Notification:**
```typescript
const notificationId = await databaseService.createSimpleTestNotification(
  userId, 
  'Test message'
);
console.log('Created notification:', notificationId);
```

### **List All Notifications:**
```typescript
const notifications = await databaseService.getNotifications(userId);
console.log('All notifications:', notifications);
```

##  **Step 7: UI Verification**

### **Check Notification Badge:**
- Look for red badge on profile tab
- Badge should show unread count
- Badge should update immediately

### **Check Notifications Tab:**
- Navigate to notifications screen
- Should show loading spinner initially
- Should display notifications list
- Should show "No Notifications" if empty

## 🎯 **Step 8: Test Specific Scenarios**

### **Test 1: Simple Notification**
```typescript
// Add this to any screen
<TestNotificationButton />
// Click "Create Simple Notification"
// Check console and notifications tab
```

### **Test 2: Appointment Status Update**
```typescript
// Update any appointment status
await databaseService.updateAppointmentStatus(
  appointmentId, 
  'confirmed', 
  'Test update'
);
// Check console logs
// Check notifications tab
```

### **Test 3: Direct Database Check**
```typescript
// Check if notifications exist in database
const notifications = await databaseService.getNotifications(userId);
console.log('Notifications in database:', notifications);
```

## 🚀 **Step 9: Performance Monitoring**

### **Check Load Times:**
- Initial load: < 100ms
- Notification creation: < 50ms
- Badge update: < 100ms

### **Monitor Memory Usage:**
- Should stay under 50MB per user
- No memory leaks from listeners
- Proper cleanup on unmount

## 📞 **Step 10: Get Help**

If you're still having issues:

1. **Check console logs** for specific error messages
2. **Verify file structure** matches the guide
3. **Test with simple notifications** first
4. **Check Firebase rules** and permissions
5. **Share error messages** and console output

## 🎉 **Success Indicators**

You'll know the system is working when you see:

-  Console logs showing notification creation
-  Notifications appearing in Firebase database
-  Badge count updating on profile tab
-  Notifications showing in notifications tab
-  Test buttons working without errors

## 🔄 **Next Steps After Fix**

Once notifications are working:

1. **Test with real appointment data**
2. **Monitor performance and errors**
3. **Add more notification types**
4. **Implement push notifications (FCM)**
5. **Add email notifications**

---

**Remember:** The fallback method ensures notifications will work even if the main service fails. Check the console logs to see exactly where the process is failing.
