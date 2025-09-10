# Real-time Notification System

## Overview

This implementation provides a comprehensive real-time notification system that listens to Firebase Realtime Database changes for appointments and referrals, creating notifications without saving them to the database. The system automatically detects status changes and creates appropriate notifications for both patients and specialists.

## Features

### ✅ **Real-time Listening**
- Listens to Firebase Realtime Database changes for appointments and referrals
- Automatically detects status changes (pending, confirmed, completed, cancelled)
- Creates notifications in real-time without database storage
- Supports both patient and specialist user roles

### ✅ **Smart Notification Logic**
- **For Patients**: Notifications for appointment/referral status changes
- **For Specialists**: Notifications for new appointments/referrals and status updates
- **Status-based**: Different messages for pending, confirmed, completed, and cancelled states
- **Priority System**: High, medium, and low priority notifications

### ✅ **In-Memory Storage**
- Notifications stored in memory (not persisted to database)
- Automatic cleanup of old notifications (30+ days)
- Efficient memory management with notification limits
- Real-time updates without database writes

### ✅ **User Interface**
- Toggle between real-time and database notifications
- Real-time notification modal with full functionality
- Mark as read/unread functionality
- Delete notifications
- Refresh and bulk operations
- Visual indicators for unread count

## Architecture

### Core Components

1. **RealtimeNotificationService** (`src/services/realtimeNotificationService.ts`)
   - Main service for managing real-time notifications
   - Firebase Realtime Database listeners
   - Notification creation and management logic
   - In-memory storage and cleanup

2. **useRealtimeNotifications Hook** (`src/hooks/data/useRealtimeNotifications.ts`)
   - React hook for consuming real-time notifications
   - State management and UI integration
   - Automatic cleanup and error handling

3. **RealtimeNotificationContext** (`src/contexts/RealtimeNotificationContext.tsx`)
   - React context for global notification state
   - Provider component for app-wide access

4. **RealtimeNotificationModal** (`src/components/shared/RealtimeNotificationModal.tsx`)
   - UI component for displaying notifications
   - Full notification management interface
   - Responsive design with proper styling

5. **RealtimeNotificationTest** (`src/components/shared/RealtimeNotificationTest.tsx`)
   - Test component for creating sample notifications
   - Development and debugging tool

## Database Structure

### Appointments
```javascript
appointments/
  {appointmentId}/
    - appointmentDate: string
    - appointmentTime: string
    - patientId: string
    - doctorId: string
    - clinicId: string
    - status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
    - type: string
    - patientFirstName: string
    - patientLastName: string
    - doctorFirstName: string
    - doctorLastName: string
    - clinicName: string
    - createdAt: string
    - lastUpdated: string
```

### Referrals
```javascript
referrals/
  {referralId}/
    - appointmentDate: string
    - appointmentTime: string
    - patientId: string
    - assignedSpecialistId: string
    - patientFirstName: string
    - patientLastName: string
    - assignedSpecialistFirstName: string
    - assignedSpecialistLastName: string
    - status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
    - referralTimestamp: string
    - lastUpdated: string
```

## Notification Types

### Patient Notifications

| Status | Title | Message | Priority |
|--------|-------|---------|----------|
| pending | Appointment Booked | Your appointment with Dr. [Name] on [Date] at [Time] has been successfully booked and is pending confirmation. | medium |
| confirmed | Appointment Confirmed! | Your appointment with Dr. [Name] on [Date] at [Time] has been confirmed. | high |
| completed | Appointment Completed | Your appointment with Dr. [Name] has been completed. Please check your medical history for prescriptions, certificates, and consultation details. | high |
| cancelled | Appointment Cancelled | Your appointment with Dr. [Name] on [Date] has been cancelled. | high |

### Specialist Notifications

| Status | Title | Message | Priority |
|--------|-------|---------|----------|
| pending | New Appointment Booked | New appointment with [Patient] on [Date] at [Time] has been booked and is pending confirmation. | high |
| confirmed | Appointment Confirmed | Appointment with [Patient] on [Date] at [Time] has been confirmed. | high |
| completed | Appointment Completed | Appointment with [Patient] has been completed. Medical history has been updated with consultation details. | medium |
| cancelled | Appointment Cancelled | Appointment with [Patient] on [Date] has been cancelled. | high |

### Referral Notifications

#### For Patients
| Status | Title | Message | Priority |
|--------|-------|---------|----------|
| pending | Referral Sent | Your referral to Dr. [Specialist] has been sent and is pending acceptance. | medium |
| confirmed | Referral Confirmed | Your referral to Dr. [Specialist] has been confirmed. | high |
| cancelled | Referral Declined | Your referral to Dr. [Specialist] has been declined. | high |
| completed | Referral Completed | Your referral to Dr. [Specialist] has been completed. Please check your medical history for consultation details and any prescriptions or certificates. | high |

#### For Specialists
| Status | Title | Message | Priority |
|--------|-------|---------|----------|
| pending | New Referral Received | You have received a new referral for [Patient]. | high |
| confirmed | Referral Confirmed | Referral for [Patient] has been confirmed. | high |
| cancelled | Referral Declined | Referral for [Patient] has been declined. | high |
| completed | Referral Completed | Referral for [Patient] has been completed. Medical history has been updated with consultation details. | medium |

## Usage

### 1. Setup Provider

Add the `RealtimeNotificationProvider` to your app layout:

```tsx
import { RealtimeNotificationProvider } from '../src/contexts/RealtimeNotificationContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <RealtimeNotificationProvider>
          {/* Your app content */}
        </RealtimeNotificationProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
```

### 2. Use in Components

```tsx
import { useRealtimeNotificationContext } from '../contexts/RealtimeNotificationContext';

function MyComponent() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    refresh 
  } = useRealtimeNotificationContext();

  return (
    <View>
      <Text>Unread: {unreadCount}</Text>
      {notifications.map(notification => (
        <View key={notification.id}>
          <Text>{notification.title}</Text>
          <Text>{notification.message}</Text>
        </View>
      ))}
    </View>
  );
}
```

### 3. Display Notifications

```tsx
import RealtimeNotificationModal from '../components/shared/RealtimeNotificationModal';

function MyScreen() {
  const [showModal, setShowModal] = useState(false);

  return (
    <View>
      <TouchableOpacity onPress={() => setShowModal(true)}>
        <Text>Show Notifications</Text>
      </TouchableOpacity>
      
      <RealtimeNotificationModal
        visible={showModal}
        onClose={() => setShowModal(false)}
      />
    </View>
  );
}
```

## Testing

### Test Component

Use the `RealtimeNotificationTest` component to create test notifications:

```tsx
import RealtimeNotificationTest from '../components/shared/RealtimeNotificationTest';

function TestScreen() {
  return (
    <View>
      <RealtimeNotificationTest />
    </View>
  );
}
```

### Manual Testing

1. **Create Test Appointment**:
   - Click "Test Appointment" button
   - Watch for real-time notifications as status changes
   - Verify notifications appear for both patient and specialist

2. **Create Test Referral**:
   - Click "Test Referral" button
   - Watch for real-time notifications as status changes
   - Verify notifications appear for both patient and specialist

3. **Toggle Notification Mode**:
   - Use the "RT/DB" toggle button
   - Switch between real-time and database notifications
   - Verify correct notification system is active

## Configuration

### User Role Detection

The system automatically detects user roles based on email patterns:

```typescript
const getUserRole = (): 'patient' | 'specialist' => {
  if (user?.email?.includes('specialist') || user?.email?.includes('doctor')) {
    return 'specialist';
  }
  return 'patient';
};
```

### Notification Limits

- Maximum 50 notifications per user in memory
- Automatic cleanup of notifications older than 30 days
- Periodic refresh every 5 seconds to catch missed updates

### Memory Management

- Notifications stored in `Map<string, RealtimeNotification[]>`
- Automatic cleanup on component unmount
- Efficient memory usage with notification limits

## Performance Considerations

### Optimizations

1. **Efficient Listening**: Only listens to relevant data based on user role
2. **Memory Management**: Automatic cleanup and notification limits
3. **Debounced Updates**: Prevents excessive re-renders
4. **Lazy Loading**: Notifications loaded only when needed

### Monitoring

- Console logging for debugging
- Error handling for failed operations
- Performance metrics for notification processing

## Troubleshooting

### Common Issues

1. **No Notifications Appearing**:
   - Check Firebase connection
   - Verify user authentication
   - Check console for errors

2. **Duplicate Notifications**:
   - System includes duplicate prevention
   - Check notification key generation
   - Verify status change detection

3. **Memory Issues**:
   - Check notification limits
   - Verify cleanup functions
   - Monitor memory usage

### Debug Mode

Enable debug logging by checking console output:

```typescript
console.log('🔔 Real-time notification:', notification.title, 'for user:', userId);
```

## Future Enhancements

### Planned Features

1. **Push Notifications**: Integration with device push notifications
2. **Notification Categories**: Group notifications by type
3. **Advanced Filtering**: Filter by date, type, priority
4. **Notification Templates**: Customizable notification messages
5. **Analytics**: Track notification engagement and effectiveness

### Extensibility

The system is designed to be easily extensible:

- Add new notification types by extending the service
- Customize notification messages per user preferences
- Integrate with external notification services
- Add notification scheduling and reminders

## Conclusion

The real-time notification system provides a robust, efficient, and user-friendly way to keep users informed about appointment and referral status changes. It operates entirely in memory for optimal performance while providing a seamless user experience with real-time updates.

The system is production-ready and includes comprehensive error handling, memory management, and user interface components for immediate integration into the UniHealth application.
