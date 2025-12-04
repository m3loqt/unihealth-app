# Real Online Status Implementation

This document describes the comprehensive real-time online status system implemented for the UniHealth chat application.

## Overview

The online status system provides real-time presence indicators showing when users are online, away, busy, or offline. It integrates with Firebase Realtime Database to provide accurate, real-time status updates across all chat participants.

## Architecture

### Core Components

1. **OnlineStatusService** (`src/services/onlineStatusService.ts`)
   - Main service managing user online status
   - Handles Firebase presence detection
   - Manages heartbeat mechanism
   - Provides status cleanup functionality

2. **React Hooks** (`src/hooks/useOnlineStatus.ts`)
   - `useOnlineStatus()` - Manages current user's status
   - `useUserOnlineStatus(userId)` - Checks another user's status
   - `useMultipleUsersOnlineStatus(userIds)` - Checks multiple users' status

3. **UI Components** (`src/components/OnlineStatusIndicator.tsx`)
   - `OnlineStatusIndicator` - Small dot indicator
   - `OnlineStatusBadge` - Text badge with status

4. **App State Management** (`src/hooks/useAppState.ts`)
   - Handles app foreground/background state changes
   - Automatically updates status based on app usage

## Features

### Status Types
- **Online** (Green) - User is actively using the app
- **Away** (Yellow) - User is not actively using the app but app is in background
- **Busy** (Red) - User has manually set status to busy
- **Offline** (Gray) - User is not connected or has been offline for extended period

### Real-time Updates
- Status changes are reflected immediately across all connected clients
- Uses Firebase Realtime Database for instant synchronization
- Automatic cleanup when users disconnect

### Heartbeat Mechanism
- Sends heartbeat every 30 seconds to maintain online status
- Automatically marks users as offline if heartbeat stops
- Handles network interruptions gracefully

### App State Integration
- Automatically sets status to "Away" when app goes to background
- Sets status to "Online" when app comes to foreground
- Handles app termination and reconnection

## Implementation Details

### Firebase Database Structure

```
status/
  {userId}/
    online: boolean
    lastSeen: timestamp
    status: 'online' | 'away' | 'busy' | 'offline'
    customStatus?: string

presence/
  {userId}/
    online: boolean
    lastSeen: timestamp
    status: 'online' | 'away' | 'busy' | 'offline'
    customStatus?: string
    .sv: 'timestamp' (Firebase server timestamp)
```

### Authentication Integration

The online status system is automatically integrated with the authentication lifecycle:

- **Login**: Automatically initializes online status and sets user as online
- **Logout**: Cleans up online status and marks user as offline
- **Auth State Changes**: Handles Firebase auth state changes seamlessly

### Chat Integration

Online status indicators are displayed in:

1. **Chat Lists** (`app/(patient)/tabs/chats.tsx`, `app/(specialist)/tabs/chats.tsx`)
   - Small colored dots next to user avatars
   - Shows real-time status of all chat participants

2. **Individual Chat Screens** (`app/(patient)/chat/[threadId].tsx`, `app/(specialist)/chat/[threadId].tsx`)
   - Status text in chat header
   - Shows "Online" or "Last seen X minutes ago"

## Usage Examples

### Basic Online Status Check

```typescript
import { useUserOnlineStatus } from '@/hooks/useOnlineStatus';

function ChatHeader({ userId }: { userId: string }) {
  const { isOnline, formattedLastSeen } = useUserOnlineStatus(userId);
  
  return (
    <Text>
      {isOnline ? 'Online' : formattedLastSeen}
    </Text>
  );
}
```

### Managing Current User Status

```typescript
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

function StatusSelector() {
  const { status, setStatus } = useOnlineStatus();
  
  return (
    <View>
      <Button onPress={() => setStatus('online')}>Online</Button>
      <Button onPress={() => setStatus('away')}>Away</Button>
      <Button onPress={() => setStatus('busy')}>Busy</Button>
    </View>
  );
}
```

### Online Status Indicator Component

```typescript
import { OnlineStatusIndicator } from '@/components/OnlineStatusIndicator';

function UserAvatar({ userId }: { userId: string }) {
  return (
    <View style={{ position: 'relative' }}>
      <Image source={{ uri: avatarUrl }} />
      <OnlineStatusIndicator 
        userId={userId} 
        size="small" 
        style={{ position: 'absolute', bottom: 0, right: 0 }}
      />
    </View>
  );
}
```

## Configuration

### Heartbeat Settings

```typescript
// In onlineStatusService.ts
private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
private readonly OFFLINE_TIMEOUT = 60000; // 1 minute
private readonly AWAY_TIMEOUT = 300000; // 5 minutes
```

### Status Colors

```typescript
// In OnlineStatusIndicator.tsx
const getStatusColor = () => {
  if (!isOnline) return '#9CA3AF'; // Gray for offline
  
  switch (status) {
    case 'online': return '#10B981'; // Green
    case 'away': return '#F59E0B'; // Yellow
    case 'busy': return '#EF4444'; // Red
    default: return '#9CA3AF'; // Gray
  }
};
```

## Error Handling

The system includes comprehensive error handling:

- **Network Issues**: Gracefully handles network interruptions
- **Firebase Errors**: Logs errors but doesn't break the app
- **Invalid User IDs**: Returns null status for invalid users
- **Service Unavailable**: Falls back to offline status

## Performance Considerations

- **Efficient Listeners**: Uses Firebase's optimized real-time listeners
- **Minimal Re-renders**: Status updates only trigger re-renders when necessary
- **Memory Management**: Properly cleans up listeners and intervals
- **Batched Updates**: Groups multiple status updates when possible

## Security

- **User Isolation**: Users can only see status of users they have chat threads with
- **Firebase Rules**: Database rules ensure users can only read/write their own status
- **Authentication Required**: All status operations require valid authentication

## Testing

To test the online status system:

1. **Multiple Devices**: Open the app on multiple devices with different users
2. **Background/Foreground**: Switch apps to test away/online transitions
3. **Network Interruption**: Test with poor network connectivity
4. **Chat Integration**: Verify status indicators appear in chat lists and headers

## Troubleshooting

### Common Issues

1. **Status Not Updating**
   - Check Firebase connection
   - Verify user authentication
   - Check console for errors

2. **Status Stuck as Online**
   - Check if heartbeat is running
   - Verify app state change handling
   - Check Firebase presence cleanup

3. **Performance Issues**
   - Monitor number of active listeners
   - Check for memory leaks in status listeners
   - Verify proper cleanup on component unmount

### Debug Logging

The system includes comprehensive logging:

```typescript
console.log('🟢 User set as online:', userId);
console.log(' App went to background - setting user away');
console.log('💓 Heartbeat started for user:', userId);
console.log('🧹 Cleaning up online status for user:', userId);
```

## Future Enhancements

Potential improvements for the online status system:

1. **Custom Status Messages**: Allow users to set custom status messages
2. **Status History**: Track status changes over time
3. **Do Not Disturb**: Advanced busy status with time-based rules
4. **Status Scheduling**: Allow users to schedule status changes
5. **Group Status**: Show status for group chats
6. **Status Analytics**: Track user activity patterns

## Conclusion

The real online status system provides a comprehensive, real-time presence solution that enhances the chat experience by showing when users are available for communication. The implementation is robust, performant, and integrates seamlessly with the existing authentication and chat systems.
