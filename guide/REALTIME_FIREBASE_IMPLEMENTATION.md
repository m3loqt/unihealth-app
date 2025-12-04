# Real-Time Firebase Implementation Guide

## Overview

This implementation provides real-time data synchronization for your unihealth app using Firebase Realtime Database. All data automatically updates when changes occur in the database, eliminating the need for manual refresh calls.

## 🚀 Most Important Real-Time Updates (Priority Order)

### 1. **Appointments** - Critical for both patients and specialists
- Real-time updates when appointments are created, updated, or cancelled
- Automatic notifications for status changes
- Instant UI updates across all connected clients

### 2. **Referrals** - Essential for specialist workflow
- Real-time updates when referrals are received, accepted, or declined
- Automatic notifications for referral status changes
- Instant updates for specialist dashboards

### 3. **Prescriptions** - Important for patient care
- Real-time updates when prescriptions are created or modified
- Automatic notifications for new prescriptions
- Instant updates for patient medication lists

### 4. **Medical History** - Critical for patient records
- Real-time updates when medical records are added or modified
- Instant synchronization across all patient views
- Real-time updates for specialist consultations

### 5. **Notifications** - For status changes and updates
- Automatic creation of notifications for important events
- Real-time delivery of notifications to users
- Mark as read/unread functionality

## 🛠️ Implementation Details

### Real-Time Hooks

#### `useAppointments()`
```typescript
const { appointments, loading, error, createAppointment, updateAppointment, deleteAppointment } = useAppointments();
```
- Automatically subscribes to real-time appointment updates
- No manual refresh needed
- Real-time updates for all appointment operations

#### `useReferrals()`
```typescript
const { referrals, loading, error, updateReferralStatus } = useReferrals();
```
- Real-time updates for referral status changes
- Automatic filtering by specialist ID
- Real-time notifications for referral actions

#### `usePrescriptions()`
```typescript
const { prescriptions, loading, error, refresh } = usePrescriptions();
```
- Real-time updates for prescription changes from medical history
- Automatic filtering by patient ID
- Read-only access to prescriptions (no create/update/delete operations)

#### `useMedicalHistory()`
```typescript
const { medicalHistory, loading, error, getMedicalHistoryByAppointment } = useMedicalHistory();
```
- Real-time updates for medical record changes
- Automatic filtering by patient ID
- Real-time synchronization for consultations

#### `useCertificates()`
```typescript
const { certificates, loading, error, createCertificate, updateCertificate, deleteCertificate } = useCertificates();
```
- Real-time updates for medical certificate changes
- Automatic filtering by patient ID
- Real-time notifications for certificate issuance

#### `useNotifications()`
```typescript
const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
```
- Real-time delivery of notifications
- Unread count tracking
- Mark as read functionality

### Automatic Notifications

The system automatically creates notifications for important events:

- **Appointment Events**: Created, updated, cancelled, confirmed
- **Referral Events**: Received, accepted, declined
- **Prescription Events**: Created, updated
- **Certificate Events**: Issued, updated

### Real-Time Listeners

All hooks use Firebase's `onValue` listener to provide real-time updates:

```typescript
// Example: Appointments real-time listener
const unsubscribe = databaseService.onAppointmentsChange(
  user.uid, 
  'patient', 
  (updatedAppointments) => {
    setAppointments(updatedAppointments);
    setLoading(false);
    setError(null);
  }
);

// Cleanup on unmount
return () => unsubscribe();
```

##  Usage Examples

### Basic Usage in a Component

```typescript
import React from 'react';
import { useAppointments, useNotifications } from '../hooks/data';

export const AppointmentsScreen: React.FC = () => {
  const { appointments, loading, error } = useAppointments();
  const { notifications, unreadCount } = useNotifications();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <View>
      <Text>Appointments ({appointments.length})</Text>
      <Text>Unread Notifications: {unreadCount}</Text>
      
      {appointments.map(appointment => (
        <AppointmentCard key={appointment.id} appointment={appointment} />
      ))}
    </View>
  );
};
```

### Creating Data with Real-Time Updates

```typescript
const { createAppointment } = useAppointments();

const handleBookAppointment = async () => {
  const appointmentData = {
    patientId: user.uid,
    doctorId: selectedDoctor.id,
    appointmentDate: selectedDate,
    appointmentTime: selectedTime,
    // ... other fields
  };

  const appointmentId = await createAppointment(appointmentData);
  // No need to manually refresh - real-time listener handles it!
  
  if (appointmentId) {
    // Show success message
    navigation.navigate('AppointmentConfirmation', { appointmentId });
  }
};
```

### Real-Time Notifications

```typescript
const { notifications, markAsRead, markAllAsRead } = useNotifications();

const handleNotificationPress = (notification: Notification) => {
  // Mark as read
  markAsRead(notification.id);
  
  // Navigate to related content
  if (notification.type === 'appointment') {
    navigation.navigate('AppointmentDetails', { id: notification.relatedId });
  }
};
```

## 🔧 Configuration

### Firebase Setup

Ensure your Firebase configuration includes the Realtime Database:

```typescript
// src/config/firebase.ts
import { getDatabase } from 'firebase/database';

export const database = getDatabase(app);
```

### Database Rules

Configure your Firebase Realtime Database rules to allow read/write access:

```json
{
  "rules": {
    "appointments": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "referrals": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "prescriptions": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "notifications": {
      ".read": "auth != null && data.child('userId').val() == auth.uid",
      ".write": "auth != null"
    }
  }
}
```

## 🚨 Performance Considerations

### Memory Management
- All hooks automatically clean up listeners on unmount
- Use the `useEffect` cleanup function to prevent memory leaks
- Listeners are automatically filtered by user ID to minimize data transfer

### Network Optimization
- Firebase automatically handles connection management
- Offline support with automatic synchronization when connection is restored
- Efficient data filtering on the client side

### Battery Optimization
- Real-time listeners are optimized for mobile devices
- Automatic reconnection handling
- Minimal battery impact compared to polling

## 🧪 Testing Real-Time Features

### Manual Testing
1. Open the app on multiple devices/simulators
2. Create/update data on one device
3. Verify real-time updates on other devices
4. Test offline scenarios and reconnection

### Debugging
```typescript
// Enable Firebase debug logging
import { getDatabase, ref, onValue } from 'firebase/database';

// Add logging to real-time listeners
const unsubscribe = onValue(ref(database, 'appointments'), (snapshot) => {
  console.log('Real-time update received:', snapshot.val());
  // ... handle update
});
```

## 📚 Best Practices

### 1. **Always Clean Up Listeners**
```typescript
useEffect(() => {
  const unsubscribe = databaseService.onAppointmentsChange(/* ... */);
  return () => unsubscribe(); // Important!
}, [user]);
```

### 2. **Handle Loading States**
```typescript
const { appointments, loading, error } = useAppointments();

if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
```

### 3. **Use Error Boundaries**
```typescript
// Wrap components that use real-time hooks
<ErrorBoundary>
  <AppointmentsScreen />
</ErrorBoundary>
```

### 4. **Optimize Re-renders**
```typescript
// Use useCallback for functions passed to child components
const handleAppointmentUpdate = useCallback((id: string, updates: any) => {
  updateAppointment(id, updates);
}, [updateAppointment]);
```

## 🔄 Migration from Manual Refresh

### Before (Manual Refresh)
```typescript
const [appointments, setAppointments] = useState([]);

const loadAppointments = async () => {
  const data = await databaseService.getAppointments(user.uid);
  setAppointments(data);
};

const createAppointment = async (data) => {
  await databaseService.createAppointment(data);
  await loadAppointments(); // Manual refresh needed
};

useEffect(() => {
  loadAppointments();
}, []);
```

### After (Real-Time)
```typescript
const { appointments, createAppointment } = useAppointments();

const handleCreateAppointment = async (data) => {
  await createAppointment(data);
  // No manual refresh needed - real-time listener handles it!
};
```

## 🎯 Benefits

1. **Instant Updates**: Data changes are reflected immediately across all clients
2. **Better UX**: No loading spinners or manual refresh buttons needed
3. **Reduced Network Calls**: Eliminates unnecessary API requests
4. **Offline Support**: Automatic synchronization when connection is restored
5. **Real-Time Notifications**: Users are immediately informed of important changes
6. **Collaborative Features**: Multiple users can see changes in real-time

## 🚀 Next Steps

1. **Implement in Existing Components**: Replace manual refresh calls with real-time hooks
2. **Add Notification Badges**: Show unread notification counts in navigation
3. **Implement Push Notifications**: Extend real-time features to push notifications
4. **Add Real-Time Chat**: Implement real-time messaging between patients and specialists
5. **Performance Monitoring**: Add analytics to track real-time update performance

## 📞 Support

For questions or issues with the real-time implementation:

1. Check Firebase console for database rules and connection status
2. Verify real-time listener setup in component lifecycle
3. Check network connectivity and Firebase configuration
4. Review console logs for error messages

---

**Note**: This implementation provides a solid foundation for real-time features. All hooks are production-ready and include proper error handling, loading states, and cleanup mechanisms.
