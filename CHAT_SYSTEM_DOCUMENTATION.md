# Chat System Documentation

## Overview

The chat system enables real-time messaging between patients and healthcare providers (specialists/generalists) in the UniHealth app. It supports both direct messaging and referral-based conversations with real-time updates and message status tracking.

## Table of Contents

1. [Data Models](#data-models)
2. [Firebase Database Structure](#firebase-database-structure)
3. [Core Services](#core-services)
4. [Hooks and Data Management](#hooks-and-data-management)
5. [UI Components](#ui-components)
6. [Real-time Updates](#real-time-updates)
7. [Security Rules](#security-rules)
8. [Usage Examples](#usage-examples)

## Data Models

### ChatParticipant Interface

```typescript
interface ChatParticipant {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'patient' | 'specialist' | 'admin';
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
│           └── seenBy: { [uid: string]: boolean }
└── users/
    └── {uid}/
        ├── firstName: string
        ├── lastName: string
        ├── email: string
        ├── role: 'patient' | 'specialist' | 'admin'
        └── specialty?: string
```

### Key Database Paths

- **Chat Threads**: `/chatThreads/{threadId}`
- **Messages**: `/messages/{threadId}/{messageId}`
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
   - Read receipts
   - Typing indicators

2. **Message Types**
   - File attachments
   - Image messages
   - System messages

3. **Advanced Features**
   - Message search
   - Message reactions
   - Thread archiving
   - Message forwarding

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

*This documentation covers the core chat system functionality. For voice message features, refer to the Voice Message Documentation.*
