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
        // Create new thread
        const threadData: ChatThread = {
          id: threadId,
          participants: {
            [participant1]: true,
            [participant2]: true,
          },
          type,
          unread: {
            [participant1]: 0,
            [participant2]: 0,
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
      const snapshot = await get(this.threadsRef);
      const threads: ChatThread[] = [];

      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const threadData = childSnapshot.val();
          if (threadData.participants && threadData.participants[userId] === true) {
            threads.push({
              id: childSnapshot.key!,
              ...threadData,
            });
          }
        });
      }
      
      // Sort by lastMessage.at descending (most recent first)
      return threads.sort((a, b) => {
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
          if (threadData.participants && threadData.participants[userId] === true) {
            threads.push({
              id: childSnapshot.key!,
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
        const updates: { [key: string]: any } = {};
        
        snapshot.forEach((childSnapshot) => {
          const messageData = childSnapshot.val();
          if (messageData && messageData.seenBy && !messageData.seenBy[userId]) {
            updates[`${childSnapshot.key}/seenBy/${userId}`] = true;
          }
        });

        if (Object.keys(updates).length > 0) {
          await update(ref(database), updates);
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
      const threadRef = ref(database, `chatThreads/${threadId}`);
      const snapshot = await get(threadRef);
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error('Error getting thread by ID:', error);
      return null;
    }
  }
}

export const chatService = new ChatService();
