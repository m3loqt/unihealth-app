# Generalist Chat System Implementation Guide

## Overview

This guide provides comprehensive documentation for implementing a chat system for **generalist doctors** in the UniHealth app. The generalist chat system allows generalist doctors to communicate with:
1. **Patients** who have appointments with them
2. **Specialists** to whom they have referred patients

This documentation is based on the existing patient-specialist chat system implementation and provides specific guidance for adapting it to generalist doctors.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Data Models & Interfaces](#data-models--interfaces)
3. [Database Structure](#database-structure)
4. [Core Services Implementation](#core-services-implementation)
5. [Hooks & Data Management](#hooks--data-management)
6. [UI Components](#ui-components)
7. [Real-time Features](#real-time-features)
8. [Voice Messages](#voice-messages)
9. [Security & Permissions](#security--permissions)
10. [Implementation Steps](#implementation-steps)
11. [Testing & Debugging](#testing--debugging)
12. [Troubleshooting](#troubleshooting)

## System Architecture

### Chat Flow for Generalist Doctors

```
Generalist Doctor
├── Chat with Patients (from appointments)
│   ├── Direct appointments
│   └── Follow-up appointments
└── Chat with Specialists (from referrals)
    ├── Referral discussions
    └── Follow-up consultations
```

### Key Differences from Patient-Specialist System

1. **Generalist doctors can chat with TWO types of users:**
   - Patients (similar to specialist-patient relationship)
   - Specialists (new relationship type)

2. **Data Sources:**
   - **Patients**: From appointments where generalist is the doctor
   - **Specialists**: From referrals where generalist is the referring doctor

3. **Chat Thread Types:**
   - `direct`: For patient appointments
   - `referral`: For specialist communications

## Data Models & Interfaces

### Core Interfaces (Reuse Existing)

```typescript
// Reuse these interfaces from the existing system
interface ChatThread {
  id: string;
  participants: { [uid: string]: boolean };
  type: 'direct' | 'referral' | 'clinic';
  linked?: {
    referralId?: string;
    appointmentId?: string;
    clinicId?: string;
  };
  lastMessage?: {
    text: string;
    at: number;
    senderId: string;
  };
  unread: { [uid: string]: number };
  createdAt: number;
}

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

interface ChatParticipant {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'patient' | 'specialist' | 'generalist';
  specialty?: string;
  avatar?: string;
}
```

### New Interfaces for Generalist System

```typescript
// For generalist chat list items
interface GeneralistChatListItem {
  thread: ChatThread;
  participant: ChatParticipant;
  lastMessageTime: string;
  unreadCount: number;
  // Can be either patient or specialist
  contact: {
    uid: string;
    firstName: string;
    lastName: string;
    email: string;
    role: 'patient' | 'specialist';
    specialty?: string;
    avatar?: string;
    source: 'appointment' | 'referral';
    sourceId: string;
    lastInteraction?: number;
  };
}

// For generalist chat patients (from appointments)
interface GeneralistChatPatient {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'patient';
  specialty?: string;
  avatar?: string;
  source: 'appointment';
  sourceId: string; // appointmentId
  lastInteraction?: number;
}

// For generalist chat specialists (from referrals)
interface GeneralistChatSpecialist {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'specialist';
  specialty?: string;
  avatar?: string;
  source: 'referral';
  sourceId: string; // referralId
  lastInteraction?: number;
}
```

## Database Structure

### Firebase Database Structure (Reuse Existing)

The existing Firebase structure supports generalist chats without modification:

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
│           └── voiceMessage?: { audioUrl, duration, waveform }
└── users/
    └── {uid}/
        ├── firstName: string
        ├── lastName: string
        ├── email: string
        ├── role: 'patient' | 'specialist' | 'generalist'
        └── specialty?: string
```

### Thread ID Generation

The existing deterministic thread ID generation works for generalist chats:

```typescript
// Example thread IDs for generalist
"generalist123_patient456"     // Generalist ↔ Patient
"generalist123_specialist789"  // Generalist ↔ Specialist
```

## Core Services Implementation

### Reuse Existing ChatService

The existing `ChatService` (`src/services/chatService.ts`) supports generalist chats without modification. Key methods:

```typescript
// These methods work for generalist chats
await chatService.createOrGetThread(
  generalistId,
  patientId, // or specialistId
  'direct', // or 'referral'
  { appointmentId: 'appointment123' } // or { referralId: 'referral456' }
);

await chatService.sendMessage(threadId, senderId, text);
await chatService.sendVoiceMessage(threadId, senderId, audioUrl, duration);
await chatService.markThreadAsRead(threadId, userId);
```

### Database Service Extensions

You'll need to add these methods to your database service:

```typescript
// Add to your database service
export class DatabaseService {
  // Get appointments where generalist is the doctor
  async getAppointmentsByGeneralist(generalistId: string): Promise<Appointment[]> {
    const appointmentsRef = ref(database, 'appointments');
    const snapshot = await get(appointmentsRef);
    const appointments: Appointment[] = [];
    
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        const appointment = childSnapshot.val();
        if (appointment.doctorId === generalistId) {
          appointments.push({
            id: childSnapshot.key,
            ...appointment
          });
        }
      });
    }
    
    return appointments;
  }

  // Get referrals where generalist is the referring doctor
  async getReferralsByGeneralist(generalistId: string): Promise<Referral[]> {
    const referralsRef = ref(database, 'referrals');
    const snapshot = await get(referralsRef);
    const referrals: Referral[] = [];
    
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        const referral = childSnapshot.val();
        if (referral.referringGeneralistId === generalistId) {
          referrals.push({
            id: childSnapshot.key,
            ...referral
          });
        }
      });
    }
    
    return referrals;
  }
}
```

## Hooks & Data Management

### Create New Hook: `useGeneralistChatContacts`

```typescript
// src/hooks/data/useGeneralistChatContacts.ts
import { useState, useEffect, useCallback } from 'react';
import { databaseService } from '@/services/database/firebase';
import { useAuth } from '../auth/useAuth';

export interface GeneralistChatContact {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'patient' | 'specialist';
  specialty?: string;
  avatar?: string;
  source: 'appointment' | 'referral';
  sourceId: string;
  lastInteraction?: number;
}

export interface UseGeneralistChatContactsReturn {
  contacts: GeneralistChatContact[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useGeneralistChatContacts = (): UseGeneralistChatContactsReturn => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<GeneralistChatContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    if (!user || user.role !== 'generalist') {
      setContacts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const contactsMap = new Map<string, GeneralistChatContact>();

      // Load patients from appointments
      const appointments = await databaseService.getAppointmentsByGeneralist(user.uid);
      console.log('📋 Loaded appointments for generalist:', appointments.length);

      for (const appointment of appointments) {
        if (appointment.patientId && appointment.patientId !== user.uid) {
          try {
            const patientData = await databaseService.getDocument(`users/${appointment.patientId}`);
            
            if (patientData) {
              const patientKey = appointment.patientId;
              
              if (!contactsMap.has(patientKey) || 
                  (appointment.appointmentDate && 
                   (!contactsMap.get(patientKey)?.lastInteraction || 
                    new Date(appointment.appointmentDate).getTime() > (contactsMap.get(patientKey)?.lastInteraction || 0)))) {
                
                contactsMap.set(patientKey, {
                  uid: appointment.patientId,
                  firstName: patientData.firstName || patientData.first_name || 'Unknown',
                  lastName: patientData.lastName || patientData.last_name || 'Patient',
                  email: patientData.email || '',
                  role: 'patient',
                  specialty: appointment.specialty || 'General Medicine',
                  avatar: patientData.avatar || patientData.profilePicture || '',
                  source: 'appointment',
                  sourceId: appointment.id || appointment.patientId,
                  lastInteraction: appointment.appointmentDate ? new Date(appointment.appointmentDate).getTime() : Date.now(),
                });
              }
            }
          } catch (patientError) {
            console.error('Error loading patient data for appointment:', appointment.id, patientError);
          }
        }
      }

      // Load specialists from referrals
      const referrals = await databaseService.getReferralsByGeneralist(user.uid);
      console.log('📋 Loaded referrals for generalist:', referrals.length);

      for (const referral of referrals) {
        if (referral.assignedSpecialistId && referral.assignedSpecialistId !== user.uid) {
          try {
            const specialistData = await databaseService.getDocument(`users/${referral.assignedSpecialistId}`);
            
            if (specialistData) {
              const specialistKey = referral.assignedSpecialistId;
              
              if (!contactsMap.has(specialistKey) || 
                  (referral.referralTimestamp && 
                   (!contactsMap.get(specialistKey)?.lastInteraction || 
                    new Date(referral.referralTimestamp).getTime() > (contactsMap.get(specialistKey)?.lastInteraction || 0)))) {
                
                contactsMap.set(specialistKey, {
                  uid: referral.assignedSpecialistId,
                  firstName: specialistData.firstName || specialistData.first_name || 'Unknown',
                  lastName: specialistData.lastName || specialistData.last_name || 'Specialist',
                  email: specialistData.email || '',
                  role: 'specialist',
                  specialty: referral.specialty || specialistData.specialty || 'Specialist',
                  avatar: specialistData.avatar || specialistData.profilePicture || '',
                  source: 'referral',
                  sourceId: referral.id || referral.assignedSpecialistId,
                  lastInteraction: referral.referralTimestamp ? new Date(referral.referralTimestamp).getTime() : Date.now(),
                });
              }
            }
          } catch (specialistError) {
            console.error('Error loading specialist data for referral:', referral.id, specialistError);
          }
        }
      }

      // Convert map to array and sort by last interaction
      const contactsArray = Array.from(contactsMap.values()).sort((a, b) => {
        const timeA = a.lastInteraction || 0;
        const timeB = b.lastInteraction || 0;
        return timeB - timeA; // Most recent first
      });

      console.log('📋 Final contacts for generalist:', contactsArray.length);
      setContacts(contactsArray);
    } catch (error) {
      console.error('Error loading generalist contacts:', error);
      setError('Failed to load contacts. Please try again.');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    await loadContacts();
  }, [loadContacts]);

  // Load contacts when user changes
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  return {
    contacts,
    loading,
    error,
    refresh,
  };
};
```

## UI Components

### Generalist Chat List Screen

Create `app/(generalist)/tabs/chats.tsx`:

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  MessageCircle,
  Clock,
  User,
  Calendar,
  FileText,
  ChevronRight,
  Plus,
  Search,
  Check,
  CheckCheck,
  Stethoscope,
} from 'lucide-react-native';
import { router } from 'expo-router';

import { useAuth } from '@/hooks/auth/useAuth';
import { useGeneralistChatContacts } from '@/hooks/data/useGeneralistChatContacts';
import { chatService } from '@/services/chatService';
import LoadingState from '@/components/ui/LoadingState';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

interface GeneralistChatListItem {
  thread: any; // ChatThread
  participant: any; // ChatParticipant
  lastMessageTime: string;
  unreadCount: number;
  contact: {
    uid: string;
    firstName: string;
    lastName: string;
    email: string;
    role: 'patient' | 'specialist';
    specialty?: string;
    avatar?: string;
    source: 'appointment' | 'referral';
    sourceId: string;
    lastInteraction?: number;
  };
}

export default function GeneralistChatsScreen() {
  const { user } = useAuth();
  const { contacts, loading: contactsLoading, error: contactsError, refresh: refreshContacts } = useGeneralistChatContacts();
  const [chats, setChats] = useState<GeneralistChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load chat threads
  const loadChats = useCallback(async () => {
    if (!user || contactsLoading || contacts.length === 0) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const chatList: GeneralistChatListItem[] = [];

      // Get existing chat threads for this user
      let existingThreads: any[] = [];
      try {
        existingThreads = await chatService.getUserThreads(user.uid);
        console.log('📋 Loaded existing threads:', existingThreads.length);
      } catch (threadError) {
        console.error('Error loading existing threads:', threadError);
      }
      
      // Create chat list items from contacts
      console.log('👥 Processing contacts:', contacts.length);
      for (const contact of contacts) {
        console.log('👥 Processing contact:', contact.firstName, contact.lastName, 'UID:', contact.uid, 'Role:', contact.role);
        
        // Try to find existing thread with this contact
        let thread: any | undefined;
        
        for (const existingThread of existingThreads) {
          if (existingThread.participants[user.uid] && existingThread.participants[contact.uid]) {
            console.log('✅ Found existing thread for contact:', contact.firstName, contact.lastName);
            thread = existingThread;
            break;
          }
        }

        // If no existing thread found, create a placeholder
        if (!thread) {
          console.log('📝 Creating placeholder for contact:', contact.firstName, contact.lastName);
          thread = {
            id: `${user.uid}_${contact.uid}`,
            participants: { [user.uid]: true, [contact.uid]: true },
            type: contact.source === 'referral' ? 'referral' : 'direct',
            unread: { [user.uid]: 0, [contact.uid]: 0 },
            createdAt: contact.lastInteraction || Date.now(),
          };
        }

        const lastMessageTime = thread.lastMessage 
          ? formatMessageTime(thread.lastMessage.at)
          : formatMessageTime(thread.createdAt);
        const unreadCount = thread.unread?.[user.uid] || 0;

        // Create participant object
        const participant: any = {
          uid: contact.uid,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          role: contact.role,
          specialty: contact.specialty,
          avatar: contact.avatar,
        };

        chatList.push({
          thread,
          participant,
          lastMessageTime,
          unreadCount,
          contact,
        });
      }

      // Sort by last message time or creation time (most recent first)
      chatList.sort((a, b) => {
        const timeA = a.thread.lastMessage?.at || a.thread.createdAt;
        const timeB = b.thread.lastMessage?.at || b.thread.createdAt;
        return timeB - timeA;
      });

      console.log('📋 Final chat list:', chatList.length, 'items');
      setChats(chatList);
    } catch (error) {
      console.error('Error loading chats:', error);
      setError('Failed to load chats. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, contacts, contactsLoading]);

  // Listen to real-time chat updates
  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Set up real-time listener for chat threads
  useEffect(() => {
    if (!user) return;

    console.log('👂 Setting up real-time listener for generalist:', user.uid);
    
    const unsubscribe = chatService.listenToUserThreads(user.uid, (threads) => {
      console.log('📨 Real-time update received:', threads.length, 'threads');
      
      // Update chats with real-time data
      setChats(prevChats => {
        const updatedChats = prevChats.map(chatItem => {
          const realTimeThread = threads.find(thread => 
            thread.participants[chatItem.contact.uid] === true && 
            thread.participants[user.uid] === true
          );
          
          if (realTimeThread) {
            console.log('🔄 Updating chat with real-time data for contact:', chatItem.contact.firstName);
            
            const lastMessageTime = realTimeThread.lastMessage 
              ? formatMessageTime(realTimeThread.lastMessage.at)
              : formatMessageTime(realTimeThread.createdAt);
            const unreadCount = realTimeThread.unread?.[user.uid] || 0;
            
            return {
              ...chatItem,
              thread: realTimeThread,
              lastMessageTime,
              unreadCount,
            };
          }
          
          return chatItem;
        });
        
        return updatedChats.sort((a, b) => {
          const timeA = a.thread.lastMessage?.at || a.thread.createdAt;
          const timeB = b.thread.lastMessage?.at || b.thread.createdAt;
          return timeB - timeA;
        });
      });
    });

    return () => {
      console.log('🔇 Unsubscribing from real-time updates');
      unsubscribe();
    };
  }, [user]);

  // Format message time
  const formatMessageTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  // Handle chat press
  const handleChatPress = async (chatItem: GeneralistChatListItem) => {
    if (!user) return;

    try {
      const { contact, thread } = chatItem;
      
      let threadId = thread.id;
      
      // If this is a placeholder thread, create one
      const isPlaceholder = thread.id.startsWith(`${user.uid}_${contact.uid}`) && !thread.lastMessage;
      
      if (isPlaceholder) {
        console.log('📝 Creating new thread for contact:', contact.firstName, contact.lastName);
        
        const linked: { referralId?: string; appointmentId?: string; clinicId?: string } = {};
        if (contact.source === 'referral' && contact.sourceId) {
          linked.referralId = contact.sourceId;
        } else if (contact.source === 'appointment' && contact.sourceId) {
          linked.appointmentId = contact.sourceId;
        }
        
        try {
          threadId = await chatService.createOrGetThread(
            user.uid,
            contact.uid,
            contact.source === 'referral' ? 'referral' : 'direct',
            Object.keys(linked).length > 0 ? linked : undefined
          );
          
          console.log('✅ Successfully created new thread:', threadId);
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error('Error creating thread:', error);
        }
      }

      // Navigate to chat screen
      const contactName = `${contact.firstName} ${contact.lastName}`;
      const contactType = contact.role === 'patient' ? 'patient' : 'specialist';
      
      router.push(`/(generalist)/chat/${threadId}?${contactType}Id=${contact.uid}&${contactType}Name=${encodeURIComponent(contactName)}&${contactType}Specialty=${encodeURIComponent(contact.specialty || 'General Medicine')}`);
    } catch (error) {
      console.error('Error opening chat:', error);
      Alert.alert('Error', `Failed to open chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Render chat item
  const renderChatItem = ({ item }: { item: GeneralistChatListItem }) => {
    const { thread, participant, lastMessageTime, unreadCount, contact } = item;
    const hasUnreadMessages = unreadCount > 0;

    return (
      <TouchableOpacity
        style={[
          styles.chatItem,
          hasUnreadMessages && styles.chatItemUnread
        ]}
        onPress={() => handleChatPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.chatAvatar}>
          {participant.avatar ? (
            <Image source={{ uri: participant.avatar }} style={styles.avatarImage} />
          ) : (
            <View style={[
              styles.avatarPlaceholder,
              contact.role === 'specialist' ? styles.specialistAvatar : styles.patientAvatar
            ]}>
              <Text style={styles.avatarText}>
                {participant.firstName.charAt(0).toUpperCase()}{participant.lastName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <View style={styles.nameContainer}>
              <Text style={styles.chatName}>
                {contact.role === 'specialist' ? 'Dr. ' : ''}{participant.firstName} {participant.lastName}
              </Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>
                  {contact.role === 'specialist' ? 'Specialist' : 'Patient'}
                </Text>
              </View>
            </View>
            <View style={styles.chatTimeContainer}>
              <Text style={styles.chatTime}>{lastMessageTime}</Text>
              {thread.lastMessage && (
                <View style={styles.messageStatus}>
                  {thread.lastMessage.senderId === user?.uid ? (
                    <CheckCheck size={16} color="#1E40AF" />
                  ) : (
                    <Check size={16} color="#9CA3AF" />
                  )}
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.chatFooter}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {thread.lastMessage 
                ? thread.lastMessage.text 
                : `Start a conversation with ${contact.role === 'specialist' ? 'the specialist' : 'your patient'}`
              }
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {unreadCount > 9 ? '9+' : unreadCount.toString()}
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.sourceInfo}>
            <Text style={styles.sourceText}>
              {contact.specialty} • {contact.source === 'referral' ? 'Referral' : 'Appointment'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MessageCircle size={64} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>No Contacts Available</Text>
      <Text style={styles.emptyDescription}>
        You'll see your patients and specialists here once you have appointments or referrals.{'\n'}
        Book appointments or make referrals to start chatting.
      </Text>
    </View>
  );

  if (loading || contactsLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <LoadingState message="Loading chats..." variant="fullscreen" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chats</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Search size={18} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search chats..."
              placeholderTextColor="#9CA3AF"
              returnKeyType="search"
              blurOnSubmit={true}
            />
          </View>
          <View style={styles.divider} />
        </View>

        {/* Chat List */}
        {error || contactsError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error || contactsError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadChats()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : chats.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={chats}
            keyExtractor={(item) => item.thread.id}
            renderItem={renderChatItem}
            contentContainerStyle={styles.chatList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  Promise.all([refreshContacts(), loadChats()]).finally(() => setRefreshing(false));
                }}
                colors={['#1E40AF']}
                tintColor="#1E40AF"
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 24,
    color: '#1F2937',
  },
  searchSection: {
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 64,
    marginHorizontal: 24,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    paddingVertical: 0,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 16,
  },
  chatList: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  chatItemUnread: {
    backgroundColor: '#F8FAFC',
  },
  chatAvatar: {
    marginRight: 16,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientAvatar: {
    backgroundColor: '#10B981', // Green for patients
  },
  specialistAvatar: {
    backgroundColor: '#3B82F6', // Blue for specialists
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginRight: 8,
  },
  roleBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  chatTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginRight: 4,
  },
  messageStatus: {
    marginLeft: 4,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    flex: 1,
    marginRight: 8,
  },
  sourceInfo: {
    marginTop: 2,
  },
  sourceText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  unreadBadge: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});
```

### Individual Chat Screen

Create `app/(generalist)/chat/[threadId].tsx` (similar to existing patient/specialist chat screens):

```typescript
// Reuse the existing chat screen implementation from:
// app/(patient)/chat/[threadId].tsx or app/(specialist)/chat/[threadId].tsx
// 
// Key modifications needed:
// 1. Update the header to show contact type (Patient/Specialist)
// 2. Update the contact info display
// 3. Ensure proper navigation parameters

// Example modifications:
const { threadId, patientId, patientName, patientSpecialty, specialistId, specialistName, specialistSpecialty } = useLocalSearchParams();

// Determine if this is a patient or specialist chat
const isPatientChat = !!patientId;
const contactId = isPatientChat ? patientId : specialistId;
const contactName = isPatientChat ? patientName : specialistName;
const contactSpecialty = isPatientChat ? patientSpecialty : specialistSpecialty;
const contactRole = isPatientChat ? 'patient' : 'specialist';

// Update header title
<Text style={styles.headerTitle}>
  {isPatientChat ? 'Patient Chat' : 'Specialist Chat'}
</Text>

// Update contact info
<Text style={styles.contactName}>
  {isPatientChat ? '' : 'Dr. '}{contactName}
</Text>
<Text style={styles.contactSpecialty}>
  {contactSpecialty} • {contactRole === 'patient' ? 'Patient' : 'Specialist'}
</Text>
```

## Real-time Features

### Reuse Existing Real-time System

The existing real-time notification system works for generalist chats:

```typescript
// Real-time thread updates
const unsubscribe = chatService.listenToUserThreads(user.uid, (threads) => {
  // Update chat list with real-time data
});

// Real-time message updates
const unsubscribe = chatService.listenToThreadMessages(threadId, (messages) => {
  // Update messages in real-time
});

// Typing indicators
await chatService.setTypingStatus(threadId, userId, isTyping);
const unsubscribe = chatService.listenToTypingStatus(threadId, (typingUsers) => {
  // Show typing indicators
});
```

## Voice Messages

### Reuse Existing Voice Message System

The existing voice message system works for generalist chats:

```typescript
// Voice recording
await voiceMessageService.startRecording();
const { uri, duration, waveform } = await voiceMessageService.stopRecording();

// Upload and send voice message
const audioUrl = await voiceMessageService.uploadVoiceMessage(uri, threadId, 'temp', user.uid);
await chatService.sendVoiceMessage(threadId, user.uid, audioUrl, duration, waveform);

// Play voice messages
const sound = await voiceMessageService.playVoiceMessage(audioUrl);
```

## Security & Permissions

### Firebase Rules (Reuse Existing)

The existing Firebase rules support generalist chats:

```json
{
  "rules": {
    "chatThreads": {
      "$threadId": {
        ".read": "auth != null && data.child('participants').child(auth.uid).val() === true",
        ".write": "auth != null && data.child('participants').child(auth.uid).val() === true"
      }
    },
    "messages": {
      "$threadId": {
        ".read": "auth != null && root.child('chatThreads').child($threadId).child('participants').child(auth.uid).val() === true",
        ".write": "auth != null && root.child('chatThreads').child($threadId).child('participants').child(auth.uid).val() === true"
      }
    }
  }
}
```

### User Role Validation

Ensure generalist users can only access their own chats:

```typescript
// In your authentication hook
const { user } = useAuth();

if (!user || user.role !== 'generalist') {
  // Redirect or show error
  return;
}
```

## Implementation Steps

### Step 1: Database Service Extensions

1. Add the new methods to your database service:
   - `getAppointmentsByGeneralist()`
   - `getReferralsByGeneralist()`

### Step 2: Create Generalist Chat Hook

1. Create `src/hooks/data/useGeneralistChatContacts.ts`
2. Implement the hook to load both patients and specialists

### Step 3: Create UI Components

1. Create `app/(generalist)/tabs/chats.tsx`
2. Create `app/(generalist)/chat/[threadId].tsx`
3. Update navigation to include generalist routes

### Step 4: Update Authentication

1. Ensure generalist users have `role: 'generalist'` in their user data
2. Update authentication checks to include generalist role

### Step 5: Test Implementation

1. Test with generalist user account
2. Verify patient chats work
3. Verify specialist chats work
4. Test real-time updates
5. Test voice messages

## Testing & Debugging

### Debug Logging

Add comprehensive logging to track chat system behavior:

```typescript
console.log('📋 Loaded contacts for generalist:', contacts.length);
console.log('👥 Processing contact:', contact.firstName, contact.lastName, 'Role:', contact.role);
console.log('✅ Found existing thread for contact:', contact.firstName);
console.log('📝 Creating placeholder for contact:', contact.firstName);
```

### Common Test Scenarios

1. **Generalist with Patients:**
   - Create appointments with generalist as doctor
   - Verify patients appear in chat list
   - Test sending/receiving messages

2. **Generalist with Specialists:**
   - Create referrals from generalist to specialist
   - Verify specialists appear in chat list
   - Test sending/receiving messages

3. **Mixed Chat List:**
   - Verify both patients and specialists appear
   - Verify proper sorting by last interaction
   - Verify role badges display correctly

## Troubleshooting

### Common Issues

1. **Contacts Not Loading:**
   - Check if generalist has appointments/referrals
   - Verify database service methods work
   - Check user role is 'generalist'

2. **Chat Threads Not Creating:**
   - Verify Firebase rules allow generalist access
   - Check thread ID generation
   - Verify participant IDs are correct

3. **Real-time Updates Not Working:**
   - Check Firebase connection
   - Verify listener setup
   - Check for proper cleanup

### Debug Checklist

- [ ] Generalist user has correct role
- [ ] Database service methods return data
- [ ] Chat hook loads contacts correctly
- [ ] UI displays contacts with proper roles
- [ ] Chat threads create successfully
- [ ] Messages send/receive properly
- [ ] Real-time updates work
- [ ] Voice messages work
- [ ] Firebase rules allow access

## Key Differences Summary

| Aspect | Patient-Specialist | Generalist System |
|--------|-------------------|-------------------|
| **Chat Partners** | Patients ↔ Specialists | Generalists ↔ Patients + Specialists |
| **Data Sources** | Appointments + Referrals | Appointments (as doctor) + Referrals (as referrer) |
| **UI Complexity** | Single role type | Mixed role types (patients + specialists) |
| **Thread Types** | `direct`, `referral` | `direct`, `referral` (same) |
| **Real-time** | Same system | Same system |
| **Voice Messages** | Same system | Same system |

## Conclusion

The generalist chat system builds upon the existing patient-specialist chat infrastructure with minimal modifications. The key additions are:

1. **New data hook** to load both patients and specialists
2. **Enhanced UI** to handle mixed contact types
3. **Database service extensions** for generalist-specific queries
4. **Role-based styling** to distinguish between patients and specialists

The existing chat service, real-time system, voice messages, and security rules work without modification, making this implementation efficient and maintainable.

---

*This guide provides a complete implementation path for generalist chat functionality. Follow the steps sequentially and test thoroughly at each stage.*

