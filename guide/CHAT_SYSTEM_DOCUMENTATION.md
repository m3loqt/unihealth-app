# Chat System Documentation

## Overview

The chat system enables real-time messaging between patients and healthcare providers (specialists/generalists) in the UniHealth app. It supports both direct messaging and referral-based conversations with real-time updates, message status tracking, voice messages, typing indicators, and online status monitoring.

## Table of Contents

1. [Data Models](#data-models)
2. [Firebase Database Structure](#firebase-database-structure)
3. [Core Services](#core-services)
4. [Hooks and Data Management](#hooks-and-data-management)
5. [UI Components](#ui-components)
6. [Real-time Updates](#real-time-updates)
7. [Voice Messages](#voice-messages)
8. [Typing Indicators](#typing-indicators)
9. [Online Status System](#online-status-system)
10. [Generalist Chat Support](#generalist-chat-support)
11. [Security Rules](#security-rules)
12. [Usage Examples](#usage-examples)

## Data Models

### ChatParticipant Interface

```typescript
interface ChatParticipant {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'patient' | 'specialist' | 'generalist' | 'admin';
  specialty?: string;
  avatar?: string;
}
```

### ChatThread Interface

```typescript
interface ChatThread {
  id: string;
  participants: { [uid: string]: boolean };
  type: 'direct' | 'referral' | 'clinic';
  lastMessage?: {
    text: string;
    at: number;
    senderId: string;
  };
  unread: { [uid: string]: number };
  createdAt: number;
  linked?: {
    referralId?: string;
    appointmentId?: string;
    clinicId?: string;
  };
}
```

### ChatMessage Interface

```typescript
interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  attachmentUrl?: string;
  at: number;
  seenBy: { [uid: string]: boolean };
  voiceMessage?: {
    audioUrl: string;
    duration: number;
    waveform?: number[];
  };
}
```

### ChatListItem Interface (for UI)

```typescript
interface ChatListItem {
  thread: ChatThread;
  participant: ChatParticipant;
  lastMessageTime: string;
  unreadCount: number;
  doctor: {
    uid: string;
    firstName: string;
    lastName: string;
    email: string;
    role: 'specialist' | 'generalist';
    specialty?: string;
    avatar?: string;
    source: 'appointment' | 'referral';
    sourceId: string;
    lastInteraction?: number;
  };
}
```

## Firebase Database Structure

### Root Structure

```
firebase-realtime-database/
├── chatThreads/
│   └── {threadId}/
│       ├── participants: { [uid: string]: boolean }
│       ├── type: 'direct' | 'referral' | 'clinic'
│       ├── lastMessage: { text, at, senderId }
│       ├── unread: { [uid: string]: number }
│       ├── createdAt: timestamp
│       └── linked: { referralId?, appointmentId?, clinicId? }
├── messages/
│   └── {threadId}/
│       └── {messageId}/
│           ├── senderId: string
│           ├── text: string
│           ├── attachmentUrl?: string
│           ├── at: timestamp
│           ├── seenBy: { [uid: string]: boolean }
│           └── voiceMessage?: { audioUrl, duration, waveform? }
├── typing/
│   └── {threadId}/
│       └── {userId}: boolean
├── status/
│   └── {userId}/
│       ├── online: boolean
│       └── lastSeen: timestamp
└── users/
    └── {uid}/
        ├── firstName: string
        ├── lastName: string
        ├── email: string
        ├── role: 'patient' | 'specialist' | 'generalist' | 'admin'
        └── specialty?: string
```

### Key Database Paths

- **Chat Threads**: `/chatThreads/{threadId}`
- **Messages**: `/messages/{threadId}/{messageId}`
- **Typing Status**: `/typing/{threadId}/{userId}`
- **User Status**: `/status/{userId}`
- **User Data**: `/users/{uid}`

## Core Services

### ChatService (`src/services/chatService.ts`)

#### Main Functions

##### `createOrGetThread(patientId: string, doctorId: string, type: 'direct' | 'referral', linked?: object)`
- Creates a new chat thread or returns existing one
- Links threads to appointments or referrals
- Returns thread ID

##### `sendMessage(threadId: string, senderId: string, text: string, attachmentUrl?: string)`
- Sends a text message to a thread
- Updates thread's lastMessage and unread counts
- Returns message ID

##### `getUserThreads(userId: string)`
- Retrieves all chat threads for a user
- Uses client-side filtering (bypasses Firebase indexing issues)
- Returns array of ChatThread objects

##### `listenToUserThreads(userId: string, callback: (threads: ChatThread[]) => void)`
- Sets up real-time listener for user's threads
- Returns unsubscribe function
- Automatically filters threads by participant

##### `getThreadMessages(threadId: string)`
- Retrieves all messages for a specific thread
- Returns array of ChatMessage objects

##### `listenToThreadMessages(threadId: string, callback: (messages: ChatMessage[]) => void)`
- Sets up real-time listener for thread messages
- Returns unsubscribe function

##### `markThreadAsRead(threadId: string, userId: string)`
- Marks thread as read for specific user
- Resets unread count to 0
- Updates seenBy status for messages

##### `getUserById(userId: string)`
- Retrieves user information by ID
- Returns user data for display

##### `getThreadById(threadId: string)`
- Retrieves specific thread by ID
- Returns thread data

##### `sendVoiceMessage(threadId: string, senderId: string, audioUrl: string, duration: number, waveform?: number[])`
- Sends a voice message to a thread
- Updates thread's lastMessage and unread counts
- Returns message ID

##### `setTypingStatus(threadId: string, userId: string, isTyping: boolean)`
- Sets typing status for a user in a thread
- Auto-clears typing status after 5 seconds
- Used for typing indicators

##### `listenToTypingStatus(threadId: string, callback: (typingUsers: string[]) => void)`
- Listens to typing status changes in a thread
- Returns array of currently typing user IDs
- Returns unsubscribe function

##### `setUserStatus(userId: string, isOnline: boolean)`
- Sets user's online status
- Updates lastSeen timestamp
- Used for online status indicators

##### `listenToUserStatus(userId: string, callback: (isOnline: boolean, lastSeen: number) => void)`
- Listens to user's online status changes
- Returns online status and last seen timestamp
- Returns unsubscribe function

##### `deleteMessage(threadId: string, messageId: string)`
- Deletes a specific message from a thread
- Removes message from Firebase

##### `deleteThread(threadId: string)`
- Deletes entire thread and all messages
- Removes thread and messages from Firebase

## Hooks and Data Management

### usePatientChatDoctors (`src/hooks/data/usePatientChatDoctors.ts`)

```typescript
const { doctors, loading, error, refresh } = usePatientChatDoctors();
```

**Purpose**: Fetches doctors available for chat from patient's appointments and referrals

**Returns**:
- `doctors`: Array of doctor objects with source information
- `loading`: Boolean loading state
- `error`: Error message if any
- `refresh`: Function to refresh data

**Data Sources**:
- Appointments from `appointments` node
- Referrals from `referrals` node
- Deduplicates doctors by UID

### useSpecialistChatPatients (`src/hooks/data/useSpecialistChatPatients.ts`)

```typescript
const { patients, loading, error, refresh } = useSpecialistChatPatients();
```

**Purpose**: Fetches patients available for chat from specialist's appointments and referrals

**Returns**:
- `patients`: Array of patient objects with source information
- `loading`: Boolean loading state
- `error`: Error message if any
- `refresh`: Function to refresh data

**Data Sources**:
- Appointments from `appointments` node
- Referrals from `referrals` node
- Deduplicates patients by UID

## UI Components

### Patient Chat List (`app/(patient)/tabs/chats.tsx`)

**Features**:
- Displays list of doctors available for chat
- Shows last message and timestamp
- Unread message indicators
- Search functionality
- Real-time updates

**Key Functions**:
- `loadChats()`: Loads and processes chat threads
- `handleChatPress()`: Navigates to individual chat
- `handleSearch()`: Filters doctors by name/specialty
- `renderChatItem()`: Renders individual chat items

### Specialist Chat List (`app/(specialist)/tabs/chats.tsx`)

**Features**:
- Displays list of patients available for chat
- Shows last message and timestamp
- Unread message indicators
- Search functionality
- Real-time updates

**Key Functions**:
- `loadChats()`: Loads and processes chat threads
- `handleChatPress()`: Navigates to individual chat
- `handleSearch()`: Filters patients by name
- `renderChatItem()`: Renders individual chat items

### Individual Chat Threads

#### Patient Chat (`app/(patient)/chat/[threadId].tsx`)
#### Specialist Chat (`app/(specialist)/chat/[threadId].tsx`)

**Features**:
- Real-time message display
- Message input and sending
- Typing indicators
- Message status (sent/read)
- Empty state handling
- Keyboard avoidance

**Key Functions**:
- `loadMessages()`: Loads thread messages
- `handleSendMessage()`: Sends new message
- `markThreadAsRead()`: Marks thread as read
- `renderMessage()`: Renders individual messages

## Real-time Updates

### Thread Updates
- Listens to `/chatThreads` for user's threads
- Updates last message, unread counts, timestamps
- Maintains real-time synchronization

### Message Updates
- Listens to `/messages/{threadId}` for thread messages
- Real-time message delivery
- Automatic UI updates

### Unread Count Management
- Tracks unread messages per user per thread
- Updates in real-time
- Resets when thread is marked as read

## Voice Messages

### Overview
The chat system supports voice messages with audio recording, playback, and waveform visualization.

### Voice Message Features
- **Audio Recording**: Record voice messages directly in chat
- **Audio Playback**: Play voice messages with progress controls
- **Waveform Visualization**: Visual representation of audio waveform
- **Duration Display**: Shows message duration
- **Fallback Text**: Displays "🎤 Voice message" as placeholder text

### Implementation
```typescript
// Send voice message
const messageId = await chatService.sendVoiceMessage(
  threadId,
  senderId,
  audioUrl,
  duration,
  waveform
);

// Voice message structure
interface VoiceMessage {
  audioUrl: string;
  duration: number;
  waveform?: number[];
}
```

### Database Structure
Voice messages are stored in the `voiceMessage` field of `ChatMessage`:
```json
{
  "voiceMessage": {
    "audioUrl": "https://storage.url/audio.mp3",
    "duration": 15.5,
    "waveform": [0.1, 0.3, 0.8, 0.5, ...]
  }
}
```

## Typing Indicators

### Overview
Real-time typing indicators show when other participants are typing messages.

### Features
- **Real-time Updates**: Shows typing status instantly
- **Auto-clear**: Automatically clears typing status after 5 seconds
- **Multiple Users**: Supports multiple users typing simultaneously
- **Thread-specific**: Typing status is per thread

### Implementation
```typescript
// Set typing status
await chatService.setTypingStatus(threadId, userId, true);

// Listen to typing status
const unsubscribe = chatService.listenToTypingStatus(
  threadId,
  (typingUsers) => {
    console.log('Users typing:', typingUsers);
  }
);
```

### Database Structure
Typing status is stored in `/typing/{threadId}/{userId}`:
```json
{
  "typing": {
    "threadId": {
      "userId1": true,
      "userId2": false
    }
  }
}
```

## Online Status System

### Overview
Tracks user online/offline status and last seen timestamps for better user experience.

### Features
- **Online Status**: Real-time online/offline indicators
- **Last Seen**: Timestamp of when user was last active
- **Automatic Updates**: Status updates when app state changes
- **Visual Indicators**: Green dots for online users

### Implementation
```typescript
// Set user status
await chatService.setUserStatus(userId, true);

// Listen to user status
const unsubscribe = chatService.listenToUserStatus(
  userId,
  (isOnline, lastSeen) => {
    console.log('User online:', isOnline, 'Last seen:', lastSeen);
  }
);
```

### Database Structure
User status is stored in `/status/{userId}`:
```json
{
  "status": {
    "userId": {
      "online": true,
      "lastSeen": 1703123456789
    }
  }
}
```

## Generalist Chat Support

### Overview
The chat system supports generalist doctors who can communicate with both patients and specialists.

### Generalist Chat Capabilities
- **Patient Communication**: Chat with patients from appointments
- **Specialist Communication**: Chat with specialists from referrals
- **Mixed Contact List**: Single interface showing both patients and specialists
- **Role-based Styling**: Visual distinction between patient and specialist contacts

### Data Sources
- **Patients**: From appointments where generalist is the doctor
- **Specialists**: From referrals where generalist is the referring doctor

### Implementation
```typescript
// Generalist chat hook (similar to existing hooks)
const { contacts, loading, error, refresh } = useGeneralistChatContacts();

// Contact types
interface GeneralistContact {
  uid: string;
  firstName: string;
  lastName: string;
  role: 'patient' | 'specialist';
  source: 'appointment' | 'referral';
  // ... other fields
}
```

### UI Considerations
- **Role Badges**: Display "Patient" or "Specialist" badges
- **Source Indicators**: Show if contact is from appointment or referral
- **Mixed Sorting**: Sort by last interaction regardless of role
- **Unified Interface**: Same chat interface for all contact types

## Security Rules

### Firebase Realtime Database Rules

```json
{
  "rules": {
    "chatThreads": {
      ".read": "auth != null",
      ".write": "auth != null",
      ".indexOn": ["participants"],
      "$threadId": {
        ".read": "auth != null && (data.child('participants').child(auth.uid).exists())",
        ".write": "auth != null && (data.child('participants').child(auth.uid).exists())",
        ".indexOn": ["participants"]
      }
    },
    "messages": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$threadId": {
        ".read": "auth != null && root.child('chatThreads').child($threadId).child('participants').child(auth.uid).exists()",
        ".write": "auth != null && root.child('chatThreads').child($threadId).child('participants').child(auth.uid).exists()"
      }
    },
    "typing": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$threadId": {
        ".read": "auth != null && root.child('chatThreads').child($threadId).child('participants').child(auth.uid).exists()",
        ".write": "auth != null && root.child('chatThreads').child($threadId).child('participants').child(auth.uid).exists()"
      }
    },
    "status": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$userId": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid == $userId"
      }
    }
  }
}
```

## Usage Examples

### Creating a Chat Thread

```typescript
import { chatService } from '@/services/chatService';

// Create thread for appointment
const threadId = await chatService.createOrGetThread(
  patientId,
  doctorId,
  'direct',
  { appointmentId: 'appointment123' }
);

// Create thread for referral
const threadId = await chatService.createOrGetThread(
  patientId,
  doctorId,
  'referral',
  { referralId: 'referral456' }
);
```

### Sending a Message

```typescript
const messageId = await chatService.sendMessage(
  threadId,
  senderId,
  'Hello, how are you?'
);
```

### Listening to Messages

```typescript
const unsubscribe = chatService.listenToThreadMessages(
  threadId,
  (messages) => {
    console.log('New messages:', messages);
    setMessages(messages);
  }
);

// Cleanup
unsubscribe();
```

### Marking Thread as Read

```typescript
await chatService.markThreadAsRead(threadId, userId);
```

### Using Chat Hooks

```typescript
// Patient side
const { doctors, loading, error, refresh } = usePatientChatDoctors();

// Specialist side
const { patients, loading, error, refresh } = useSpecialistChatPatients();

// Generalist side (if implemented)
const { contacts, loading, error, refresh } = useGeneralistChatContacts();
```

### Voice Message Usage

```typescript
// Send voice message
const messageId = await chatService.sendVoiceMessage(
  threadId,
  senderId,
  audioUrl,
  duration,
  waveform
);
```

### Typing Indicators Usage

```typescript
// Set typing status when user starts typing
await chatService.setTypingStatus(threadId, userId, true);

// Clear typing status when user stops typing
await chatService.setTypingStatus(threadId, userId, false);

// Listen to typing status
const unsubscribe = chatService.listenToTypingStatus(
  threadId,
  (typingUsers) => {
    setTypingUsers(typingUsers);
  }
);
```

### Online Status Usage

```typescript
// Set user online when app becomes active
await chatService.setUserStatus(userId, true);

// Set user offline when app becomes inactive
await chatService.setUserStatus(userId, false);

// Listen to user status
const unsubscribe = chatService.listenToUserStatus(
  userId,
  (isOnline, lastSeen) => {
    setUserOnline(isOnline);
    setLastSeen(lastSeen);
  }
);
```

## Error Handling

### Common Error Scenarios

1. **Thread Creation Failures**
   - Network connectivity issues
   - Invalid participant IDs
   - Permission denied

2. **Message Sending Failures**
   - Empty message text
   - Invalid thread ID
   - Network timeouts

3. **Real-time Listener Issues**
   - Firebase connection problems
   - Permission errors
   - Indexing issues (handled with client-side filtering)

### Error Recovery

- Automatic retry mechanisms
- Graceful fallbacks
- User-friendly error messages
- Loading states and indicators

## Performance Considerations

### Optimization Strategies

1. **Client-side Filtering**
   - Bypasses Firebase indexing issues
   - Reduces server load
   - Improves reliability

2. **Efficient Data Loading**
   - Loads only necessary data
   - Implements pagination for large message lists
   - Caches frequently accessed data

3. **Real-time Updates**
   - Selective listening to relevant data
   - Proper cleanup of listeners
   - Debounced updates

## Future Enhancements

### Planned Features

1. **Message Status Indicators**
   - Delivered status
   - Enhanced read receipts
   - Message reactions

2. **Message Types**
   - File attachments
   - Image messages
   - System messages
   - Document sharing

3. **Advanced Features**
   - Message search
   - Thread archiving
   - Message forwarding
   - Chat history export
   - Message encryption

4. **Enhanced Voice Features**
   - Voice message transcription
   - Voice message search
   - Voice message compression

5. **Group Chat Support**
   - Multi-participant threads
   - Group management
   - Broadcast messages

## Troubleshooting

### Common Issues

1. **Messages Not Loading**
   - Check Firebase rules
   - Verify user authentication
   - Check network connectivity

2. **Real-time Updates Not Working**
   - Verify listener setup
   - Check Firebase connection
   - Ensure proper cleanup

3. **Thread Creation Fails**
   - Verify participant IDs
   - Check user permissions
   - Validate data structure

### Debug Tips

- Enable Firebase debug logging
- Check browser console for errors
- Verify data structure in Firebase console
- Test with different user accounts

---

*This documentation covers the complete chat system functionality including voice messages, typing indicators, online status, and generalist support. For detailed generalist implementation, refer to the Generalist Chat System Implementation Guide.*
