import { database } from '../config/firebase';
import { ref, push, set, get, onValue, off, update, query, orderByChild, equalTo, onChildAdded, onChildChanged, onChildRemoved, serverTimestamp, runTransaction } from 'firebase/database';

export interface ChatThread {
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

export interface ChatMessage {
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

export interface ChatParticipant {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'patient' | 'specialist' | 'generalist';
  specialty?: string;
  avatar?: string;
}

class ChatService {
  private threadsRef = ref(database, 'chatThreads');
  private messagesRef = ref(database, 'messages');

  /**
   * Generate a deterministic thread ID for two participants
   */
  private generateThreadId(participant1: string, participant2: string): string {
    const sorted = [participant1, participant2].sort();
    return `${sorted[0]}_${sorted[1]}`;
  }

  /**
   * Create or get an existing chat thread
   */
  async createOrGetThread(
    participant1: string,
    participant2: string,
    type: 'direct' | 'referral' | 'clinic' = 'direct',
    linked?: { referralId?: string; appointmentId?: string; clinicId?: string }
  ): Promise<string> {
    const threadId = this.generateThreadId(participant1, participant2);
    const threadRef = ref(database, `chatThreads/${threadId}`);

    try {
      const snapshot = await get(threadRef);
      
      if (!snapshot.exists()) {
        // Create new thread with participants in the same sorted order as threadId
        const sortedParticipants = [participant1, participant2].sort();
        const threadData: ChatThread = {
          id: threadId,
          participants: {
            [sortedParticipants[0]]: true,
            [sortedParticipants[1]]: true,
          },
          type,
          unread: {
            [sortedParticipants[0]]: 0,
            [sortedParticipants[1]]: 0,
          },
          createdAt: Date.now(),
          ...(linked && Object.keys(linked).length > 0 && { linked }),
        };

        await set(threadRef, threadData);
      }

      return threadId;
    } catch (error) {
      console.error('Error creating/getting thread:', error);
      throw error;
    }
  }

  /**
   * Get all chat threads for a user
   */
  async getUserThreads(userId: string): Promise<ChatThread[]> {
    // Use client-side filtering to avoid Firebase indexing issues
    try {
      console.log(' Getting user threads for:', userId);
      const snapshot = await get(this.threadsRef);
      const threads: ChatThread[] = [];

      if (snapshot.exists()) {
        console.log(' Found chatThreads in database, processing...');
        snapshot.forEach((childSnapshot) => {
          const threadData = childSnapshot.val();
          const threadId = childSnapshot.key;
          
          if (threadData && threadId && threadData.participants && typeof threadData.participants === 'object' && threadData.participants[userId] === true) {
            console.log(' Found thread for user:', threadId, 'lastMessage:', threadData.lastMessage?.text || 'No last message');
            threads.push({
              id: threadId,
              ...threadData,
            });
          }
        });
      } else {
        console.log(' No chatThreads found in database');
      }
      
      // Also check for threads that might exist only as messages
      console.log(' Checking for reconstructed threads...');
      const reconstructedThreads = await this.findReconstructedThreads(userId);
      console.log(' Found reconstructed threads:', reconstructedThreads.length);
      threads.push(...reconstructedThreads);
      
      // Remove duplicates (in case a thread exists in both places)
      const uniqueThreads = threads.filter((thread, index, self) => 
        index === self.findIndex(t => t.id === thread.id)
      );
      
      // Sort by lastMessage.at descending (most recent first)
      return uniqueThreads.sort((a, b) => {
        const aTime = a.lastMessage?.at || a.createdAt;
        const bTime = b.lastMessage?.at || b.createdAt;
        return bTime - aTime;
      });
    } catch (error) {
      console.error('Error loading threads:', error);
      return []; // Return empty array if loading fails
    }
  }

  /**
   * Find threads that exist only as messages and need reconstruction
   */
  private async findReconstructedThreads(userId: string): Promise<ChatThread[]> {
    try {
      console.log(' Finding reconstructed threads for user:', userId);
      const messagesSnapshot = await get(this.messagesRef);
      const reconstructedThreads: ChatThread[] = [];

      if (messagesSnapshot.exists()) {
        console.log('📨 Found messages in database, scanning for user threads...');
        console.log('📨 Messages snapshot size:', messagesSnapshot.size);
        const threadIds = new Set<string>();
        
        // Find all thread IDs where the user has messages
        messagesSnapshot.forEach((threadSnapshot) => {
          const threadId = threadSnapshot.key;
          if (!threadId) return;
          
          threadSnapshot.forEach((messageSnapshot) => {
            const message = messageSnapshot.val();
            if (message && message.seenBy && typeof message.seenBy === 'object' && message.seenBy[userId] === true) {
              console.log('📨 Found message for user in thread:', threadId, 'message text:', message.text);
              threadIds.add(threadId);
            }
          });
        });

        console.log('📨 Found thread IDs with messages for user:', Array.from(threadIds));
        
        if (threadIds.size === 0) {
          console.log(' No thread IDs found with messages for user:', userId);
          return [];
        }

        // Check each thread ID to see if it needs reconstruction
        for (const threadId of threadIds) {
          const existingThread = await this.getThreadById(threadId);
          if (existingThread) {
            reconstructedThreads.push(existingThread);
          }
        }
      } else {
        console.log(' No messages section found in database at all');
      }

      return reconstructedThreads;
    } catch (error) {
      console.error('Error finding reconstructed threads:', error);
      return [];
    }
  }

  /**
   * Listen to user's chat threads in real-time
   */
  listenToUserThreads(
    userId: string,
    callback: (threads: ChatThread[]) => void
  ): () => void {
    // Use client-side filtering for real-time updates
    const unsubscribe = onValue(this.threadsRef, (snapshot) => {
      const threads: ChatThread[] = [];

      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const threadData = childSnapshot.val();
          const threadId = childSnapshot.key;
          
          if (threadData && threadId && threadData.participants && typeof threadData.participants === 'object' && threadData.participants[userId] === true) {
            threads.push({
              id: threadId,
              ...threadData,
            });
          }
        });
      }

      // Sort by lastMessage.at descending (most recent first)
      const sortedThreads = threads.sort((a, b) => {
        const aTime = a.lastMessage?.at || a.createdAt;
        const bTime = b.lastMessage?.at || b.createdAt;
        return bTime - aTime;
      });

      callback(sortedThreads);
    }, (error) => {
      console.error('Error in real-time listener:', error);
    });

    return unsubscribe;
  }

  /**
   * Send a message to a thread
   */
  async sendMessage(
    threadId: string,
    senderId: string,
    text: string,
    attachmentUrl?: string
  ): Promise<string> {
    try {
      // Validate that the thread exists and has valid participants
      const thread = await this.getThreadById(threadId);
      if (!thread) {
        throw new Error(`Thread ${threadId} does not exist. Please refresh and try again.`);
      }
      
      console.log(' Thread validation for sendMessage:', {
        threadId,
        senderId,
        participants: thread.participants,
        isParticipant: thread.participants?.[senderId]
      });
      
      if (!thread.participants || !thread.participants[senderId]) {
        console.error(' Participant validation failed:', {
          threadId,
          senderId,
          participants: thread.participants,
          expectedParticipants: threadId.split('_')
        });
        throw new Error(`User ${senderId} is not a participant in thread ${threadId}. Thread participants: ${JSON.stringify(thread.participants)}`);
      }

      // Create message
      const messageRef = ref(database, `messages/${threadId}`);
      const newMessageRef = push(messageRef);
      const messageId = newMessageRef.key!;

      const message: ChatMessage = {
        id: messageId,
        senderId,
        text,
        at: Date.now(),
        seenBy: {
          [senderId]: true,
        },
        ...(attachmentUrl && { attachmentUrl }),
      };

      await set(newMessageRef, message);

      // Update thread with last message and unread counts
      const threadRef = ref(database, `chatThreads/${threadId}`);
      
      await runTransaction(threadRef, (currentData) => {
        if (currentData) {
          // Ensure unread object exists
          if (!currentData.unread) {
            currentData.unread = {};
          }

          // Ensure participants object exists and is valid
          if (!currentData.participants || typeof currentData.participants !== 'object') {
            console.error('Thread participants is missing or invalid:', currentData.participants);
            throw new Error('Thread participants data is corrupted');
          }

          // Update last message
          currentData.lastMessage = {
            text,
            at: message.at,
            senderId,
          };

          // Reset sender's unread count and increment others
          Object.keys(currentData.participants).forEach((participantId) => {
            if (participantId === senderId) {
              currentData.unread[participantId] = 0;
            } else {
              currentData.unread[participantId] = (currentData.unread[participantId] || 0) + 1;
            }
          });
        } else {
          // If thread doesn't exist, this is a critical error
          console.error('Thread does not exist:', threadId);
          throw new Error(`Thread ${threadId} does not exist. Cannot send message.`);
        }
        return currentData;
      });

      return messageId;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Send a voice message
   */
  async sendVoiceMessage(
    threadId: string,
    senderId: string,
    audioUrl: string,
    duration: number,
    waveform?: number[]
  ): Promise<string> {
    try {
      // Validate that the thread exists and has valid participants
      const thread = await this.getThreadById(threadId);
      if (!thread) {
        throw new Error(`Thread ${threadId} does not exist. Please refresh and try again.`);
      }
      
      if (!thread.participants || !thread.participants[senderId]) {
        throw new Error(`User ${senderId} is not a participant in thread ${threadId}.`);
      }

      // Create message
      const messageRef = ref(database, `messages/${threadId}`);
      const newMessageRef = push(messageRef);
      const messageId = newMessageRef.key!;

      const message: ChatMessage = {
        id: messageId,
        senderId,
        text: '🎤 Voice message', // Placeholder text for display
        at: Date.now(),
        seenBy: {
          [senderId]: true,
        },
        voiceMessage: {
          audioUrl,
          duration,
          waveform,
        },
      };

      await set(newMessageRef, message);

      // Update thread with last message and unread counts
      const threadRef = ref(database, `chatThreads/${threadId}`);
      
      await runTransaction(threadRef, (currentData) => {
        if (currentData) {
          // Ensure unread object exists
          if (!currentData.unread) {
            currentData.unread = {};
          }

          // Ensure participants object exists and is valid
          if (!currentData.participants || typeof currentData.participants !== 'object') {
            console.error('Thread participants is missing or invalid:', currentData.participants);
            throw new Error('Thread participants data is corrupted');
          }

          // Update last message
          currentData.lastMessage = {
            text: '🎤 Voice message',
            at: message.at,
            senderId,
          };

          // Reset sender's unread count and increment others
          Object.keys(currentData.participants).forEach((participantId) => {
            if (participantId === senderId) {
              currentData.unread[participantId] = 0;
            } else {
              currentData.unread[participantId] = (currentData.unread[participantId] || 0) + 1;
            }
          });
        } else {
          // If thread doesn't exist, this is a critical error
          console.error('Thread does not exist:', threadId);
          throw new Error(`Thread ${threadId} does not exist. Cannot send voice message.`);
        }
        return currentData;
      });

      return messageId;
    } catch (error) {
      console.error('Error sending voice message:', error);
      throw error;
    }
  }

  /**
   * Listen to messages in a thread
   */
  listenToThreadMessages(
    threadId: string,
    callback: (messages: ChatMessage[]) => void
  ): () => void {
    const messagesRef = ref(database, `messages/${threadId}`);
    const messagesQuery = query(messagesRef, orderByChild('at'));

    const messages: ChatMessage[] = [];

    const unsubscribe = onValue(messagesQuery, (snapshot) => {
      messages.length = 0; // Clear array

      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          messages.push({
            id: childSnapshot.key!,
            ...childSnapshot.val(),
          });
        });
      }

      // Sort by timestamp ascending (oldest first)
      const sortedMessages = messages.sort((a, b) => a.at - b.at);
      callback(sortedMessages);
    }, (error) => {
      console.error('Error listening to messages:', error);
    });

    return unsubscribe;
  }

  /**
   * Mark messages as read for a user
   */
  async markThreadAsRead(threadId: string, userId: string): Promise<void> {
    try {
      const threadRef = ref(database, `chatThreads/${threadId}`);
      
      // First check if the thread exists
      const threadSnapshot = await get(threadRef);
      if (!threadSnapshot.exists()) {
        console.log('Thread does not exist, skipping read marking:', threadId);
        return;
      }

      await runTransaction(threadRef, (currentData) => {
        if (currentData) {
          // Ensure unread object exists
          if (!currentData.unread) {
            currentData.unread = {};
          }
          // Reset user's unread count
          currentData.unread[userId] = 0;
        }
        return currentData;
      });

      // Mark latest messages as seen by user
      const messagesRef = ref(database, `messages/${threadId}`);
      const messagesQuery = query(messagesRef, orderByChild('at'));

      const snapshot = await get(messagesQuery);
      if (snapshot.exists()) {
        const updatePromises: Promise<void>[] = [];
        
        snapshot.forEach((childSnapshot) => {
          const messageData = childSnapshot.val();
          if (messageData && messageData.seenBy && !messageData.seenBy[userId]) {
            const messageId = childSnapshot.key;
            const seenByPath = `messages/${threadId}/${messageId}/seenBy/${userId}`;
            console.log(` Marking message as seen: ${seenByPath}`);
            
            const seenByRef = ref(database, seenByPath);
            updatePromises.push(set(seenByRef, true));
          }
        });

        if (updatePromises.length > 0) {
          console.log(`📝 Updating ${updatePromises.length} messages as seen by user ${userId}`);
          await Promise.all(updatePromises);
          console.log(` Successfully marked messages as seen`);
        }
      }
    } catch (error) {
      console.error('Error marking thread as read:', error);
      // Don't throw the error - just log it since this is not critical
      console.log('Continuing despite read marking error');
    }
  }

  /**
   * Get participant information
   */
  async getParticipantInfo(userId: string): Promise<ChatParticipant | null> {
    try {
      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        return {
          uid: userId,
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || '',
          role: userData.role || 'patient',
          specialty: userData.specialty || userData.department || '',
          avatar: userData.avatar || userData.profileImage || '',
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting participant info:', error);
      return null;
    }
  }

  /**
   * Get participants for multiple user IDs
   */
  async getParticipantsInfo(userIds: string[]): Promise<{ [uid: string]: ChatParticipant }> {
    const participants: { [uid: string]: ChatParticipant } = {};

    try {
      const promises = userIds.map(async (userId) => {
        const participant = await this.getParticipantInfo(userId);
        if (participant) {
          participants[userId] = participant;
        }
      });

      await Promise.all(promises);
      return participants;
    } catch (error) {
      console.error('Error getting participants info:', error);
      return participants;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(threadId: string, messageId: string): Promise<void> {
    try {
      const messageRef = ref(database, `messages/${threadId}/${messageId}`);
      await set(messageRef, null);
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  /**
   * Delete a thread
   */
  async deleteThread(threadId: string): Promise<void> {
    try {
      const threadRef = ref(database, `chatThreads/${threadId}`);
      const messagesRef = ref(database, `messages/${threadId}`);

      // Delete thread and all messages
      await Promise.all([
        set(threadRef, null),
        set(messagesRef, null),
      ]);
    } catch (error) {
      console.error('Error deleting thread:', error);
      throw error;
    }
  }

  /**
   * Set typing status
   */
  async setTypingStatus(threadId: string, userId: string, isTyping: boolean): Promise<void> {
    try {
      const typingRef = ref(database, `typing/${threadId}/${userId}`);
      if (isTyping) {
        await set(typingRef, true);
        // Auto-clear typing status after 5 seconds
        setTimeout(() => {
          set(typingRef, false);
        }, 5000);
      } else {
        await set(typingRef, false);
      }
    } catch (error) {
      console.error('Error setting typing status:', error);
    }
  }

  /**
   * Listen to typing status
   */
  listenToTypingStatus(
    threadId: string,
    callback: (typingUsers: string[]) => void
  ): () => void {
    const typingRef = ref(database, `typing/${threadId}`);

    const unsubscribe = onValue(typingRef, (snapshot) => {
      const typingUsers: string[] = [];

      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          if (childSnapshot.val() === true) {
            typingUsers.push(childSnapshot.key!);
          }
        });
      }

      callback(typingUsers);
    });

    return unsubscribe;
  }

  /**
   * Set user online status
   */
  async setUserStatus(userId: string, isOnline: boolean): Promise<void> {
    try {
      const statusRef = ref(database, `status/${userId}`);
      const statusData = {
        online: isOnline,
        lastSeen: Date.now(),
      };
      await set(statusRef, statusData);
    } catch (error) {
      console.error('Error setting user status:', error);
    }
  }

  /**
   * Listen to user status
   */
  listenToUserStatus(
    userId: string,
    callback: (isOnline: boolean, lastSeen: number) => void
  ): () => void {
    const statusRef = ref(database, `status/${userId}`);

    const unsubscribe = onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        callback(data.online || false, data.lastSeen || 0);
      } else {
        callback(false, 0);
      }
    });

    return unsubscribe;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<any> {
    try {
      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }

  /**
   * Get thread by ID
   */
  async getThreadById(threadId: string): Promise<ChatThread | null> {
    try {
      console.log(' Getting thread by ID:', threadId);
      const threadRef = ref(database, `chatThreads/${threadId}`);
      const snapshot = await get(threadRef);
      
      if (snapshot.exists()) {
        const thread = snapshot.val();
        console.log(' Found existing thread in chatThreads:', threadId, 'lastMessage:', thread.lastMessage?.text || 'No last message');
        
        // Fix thread participants if they don't match the thread ID
        const fixedThread = await this.fixThreadParticipants(threadId, thread);
        
        // If thread exists but has no lastMessage, try to reconstruct it
        if (!fixedThread.lastMessage) {
          console.log(' Thread exists but has no lastMessage, attempting to reconstruct...');
          const reconstructedThread = await this.reconstructThreadFromMessages(threadId);
          if (reconstructedThread && reconstructedThread.lastMessage) {
            console.log(' Successfully reconstructed lastMessage for existing thread');
            // Update the existing thread with the reconstructed lastMessage
            const updatedThread = { ...fixedThread, lastMessage: reconstructedThread.lastMessage };
            await this.saveReconstructedThread(updatedThread);
            return updatedThread;
          }
        }
        
        return fixedThread;
      }
      
      console.log(' Thread not found in chatThreads, attempting reconstruction:', threadId);
      // If thread doesn't exist but messages might exist, try to reconstruct from messages
      return await this.reconstructThreadFromMessages(threadId);
    } catch (error) {
      console.error('Error getting thread by ID:', error);
      return null;
    }
  }

  /**
   * Reconstruct thread metadata from existing messages
   */
  private async reconstructThreadFromMessages(threadId: string): Promise<ChatThread | null> {
    try {
      console.log('🔧 Reconstructing thread from messages:', threadId);
      const messagesRef = ref(database, `messages/${threadId}`);
      const snapshot = await get(messagesRef);
      
      if (!snapshot.exists()) {
        console.log(' No messages found for thread:', threadId);
        return null;
      }

      console.log('📨 Found messages for thread:', threadId, 'message count:', snapshot.size);
      
      if (snapshot.size === 0) {
        console.log(' No messages found in thread:', threadId);
        return null;
      }
      const messages: ChatMessage[] = [];
      let participants: { [uid: string]: boolean } = {};
      let lastMessage: { text: string; at: number; senderId: string } | undefined;
      let earliestTimestamp = Date.now();

      snapshot.forEach((childSnapshot) => {
        const message = childSnapshot.val();
        const messageId = childSnapshot.key;
        
        // Skip if message is null or undefined
        if (!message || !messageId) {
          return;
        }
        
        // Messages should already have an id field, but verify it matches the key
        if (message.id !== messageId) {
          console.log(' Message ID mismatch:', message.id, 'vs key:', messageId);
          // Fix the id field if it's missing or incorrect
          message.id = messageId;
        }
        
        console.log('📨 Processing message:', messageId, 'text:', message.text, 'at:', message.at, 'senderId:', message.senderId, 'hasId:', !!message.id);
        messages.push(message);
        
        // Collect participants from seenBy
        if (message.seenBy && typeof message.seenBy === 'object') {
          Object.keys(message.seenBy).forEach(uid => {
            if (uid) {
              participants[uid] = true;
            }
          });
        }
        
        // Find the latest message
        if (message.at && typeof message.at === 'number' && (!lastMessage || message.at > lastMessage.at)) {
          lastMessage = {
            text: message.text || '🎤 Voice message',
            at: message.at,
            senderId: message.senderId || 'unknown'
          };
          console.log('📝 Found latest message:', lastMessage.text, 'at:', new Date(lastMessage.at).toISOString(), 'senderId:', lastMessage.senderId);
        }
        
        // Find the earliest timestamp for createdAt
        if (message.at && typeof message.at === 'number' && message.at < earliestTimestamp) {
          earliestTimestamp = message.at;
        }
      });

      if (!participants || Object.keys(participants).length === 0) {
        return null;
      }

      // Create reconstructed thread
      const reconstructedThread: ChatThread = {
        id: threadId,
        participants,
        type: 'direct', // Default type, could be enhanced to detect from context
        unread: participants ? Object.keys(participants).reduce((acc, uid) => {
          acc[uid] = 0; // Default unread count
          return acc;
        }, {} as { [uid: string]: number }) : {},
        createdAt: earliestTimestamp,
        ...(lastMessage && { lastMessage })
      };

      console.log('🔧 Reconstructed thread:', {
        id: threadId,
        participants: Object.keys(participants),
        lastMessage: lastMessage ? { text: lastMessage.text, at: new Date(lastMessage.at).toISOString() } : 'No last message',
        createdAt: new Date(earliestTimestamp).toISOString()
      });

      // Save the reconstructed thread to avoid future reconstruction
      await this.saveReconstructedThread(reconstructedThread);
      
      return reconstructedThread;
    } catch (error) {
      console.error('Error reconstructing thread from messages:', error);
      return null;
    }
  }

  /**
   * Save reconstructed thread to database
   */
  private async saveReconstructedThread(thread: ChatThread): Promise<void> {
    try {
      const threadRef = ref(database, `chatThreads/${thread.id}`);
      await set(threadRef, thread);
      console.log(' Reconstructed and saved thread:', thread.id);
    } catch (error) {
      console.error('Error saving reconstructed thread:', error);
    }
  }

  /**
   * Fix thread participants if they don't match the thread ID
   */
  private async fixThreadParticipants(threadId: string, thread: ChatThread): Promise<ChatThread> {
    try {
      const expectedParticipants = threadId.split('_');
      if (expectedParticipants.length !== 2) {
        console.error('Invalid thread ID format:', threadId);
        return thread;
      }

      const [participant1, participant2] = expectedParticipants;
      const currentParticipants = thread.participants || {};
      
      // Check if participants match the thread ID
      const hasParticipant1 = currentParticipants[participant1];
      const hasParticipant2 = currentParticipants[participant2];
      
      if (!hasParticipant1 || !hasParticipant2) {
        console.log('🔧 Fixing thread participants for thread:', threadId);
        
        // Fix the participants
        const fixedThread = {
          ...thread,
          participants: {
            [participant1]: true,
            [participant2]: true,
          },
          unread: {
            [participant1]: currentParticipants[participant1] ? (thread.unread?.[participant1] || 0) : 0,
            [participant2]: currentParticipants[participant2] ? (thread.unread?.[participant2] || 0) : 0,
          }
        };
        
        // Save the fixed thread
        const threadRef = ref(database, `chatThreads/${threadId}`);
        await set(threadRef, fixedThread);
        
        console.log(' Fixed thread participants:', threadId);
        return fixedThread;
      }
      
      return thread;
    } catch (error) {
      console.error('Error fixing thread participants:', error);
      return thread;
    }
  }
}

export const chatService = new ChatService();
