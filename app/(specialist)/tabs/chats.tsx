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
  ActivityIndicator,
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
} from 'lucide-react-native';
import { router } from 'expo-router';

import { useAuth } from '@/hooks/auth/useAuth';
import { useSpecialistChatContacts } from '@/hooks/data/useSpecialistChatContacts';
import { chatService } from '@/services/chatService';
import LoadingState from '@/components/ui/LoadingState';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { OnlineStatusIndicator } from '@/components/OnlineStatusIndicator';

interface ChatParticipant {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'patient' | 'specialist' | 'generalist' | 'admin';
  specialty?: string;
  avatar?: string;
}

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
}

interface ChatListItem {
  thread: ChatThread;
  participant: ChatParticipant;
  lastMessageTime: string;
  unreadCount: number;
  contact: {
    uid: string;
    firstName: string;
    lastName: string;
    email: string;
    role: 'patient' | 'generalist';
    specialty?: string;
    avatar?: string;
    source: 'appointment' | 'referral';
    sourceId: string;
    lastInteraction?: number;
  };
}

export default function SpecialistChatsScreen() {
  const { user } = useAuth();
  const { contacts, loading: contactsLoading, error: contactsError, loadContacts, refresh: refreshContacts } = useSpecialistChatContacts();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [filteredChats, setFilteredChats] = useState<ChatListItem[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load chat threads
  const loadChats = useCallback(async () => {
    if (!user || contactsLoading) {
      return;
    }

    try {
      setChatsLoading(true);
      setError(null);

      // If no contacts available, set empty chats and finish loading
      if (contacts.length === 0) {
        setChats([]);
        setChatsLoading(false);
        return;
      }

      const chatList: ChatListItem[] = [];

      // Get existing chat threads for this user
      let existingThreads: ChatThread[] = [];
      try {
        existingThreads = await chatService.getUserThreads(user.uid);
      } catch (threadError) {
        console.error('Error loading existing threads:', threadError);
        // Continue without existing threads - we'll create placeholders for all contacts
      }
      
      // Create chat list items from contacts (only generalists - patients are hidden)
      // Filter out patient conversations
      const generalistContacts = contacts.filter(contact => contact.role !== 'patient');
      
      for (const contact of generalistContacts) {
        // Try to find existing thread with this contact
        let thread: ChatThread | undefined;
        
        // First, try to find by checking if both participants exist in any thread
        for (const existingThread of existingThreads) {
          if (existingThread && existingThread.participants) {
            if (existingThread.participants[user.uid] && existingThread.participants[contact.uid]) {
              thread = existingThread;
              break;
            }
          }
        }

        // If no existing thread found, create a placeholder
        if (!thread) {
          // Use the same thread ID generation logic as chatService.generateThreadId()
          const sorted = [user.uid, contact.uid].sort();
          const placeholderThreadId = `${sorted[0]}_${sorted[1]}`;
          thread = {
            id: placeholderThreadId, // Use consistent ID format
            participants: { [sorted[0]]: true, [sorted[1]]: true },
            type: contact.source === 'referral' ? 'referral' : 'direct',
            unread: { [sorted[0]]: 0, [sorted[1]]: 0 },
            createdAt: contact.lastInteraction || Date.now(),
            // No lastMessage - this will show "Start a conversation"
          };
        }

        const lastMessageTime = thread.lastMessage 
          ? formatMessageTime(thread.lastMessage.at)
          : formatMessageTime(thread.createdAt);
        const unreadCount = thread.unread?.[user.uid] || 0;

        // Create participant object
        const participant: ChatParticipant = {
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

      setChats(chatList);
      setFilteredChats(chatList);
    } catch (error) {
      console.error('Error loading chats:', error);
      setError('Failed to load chats. Please try again.');
    } finally {
      setChatsLoading(false);
    }
  }, [user, contacts, contactsLoading]);

  // Load contacts when component mounts
  useEffect(() => {
    if (user?.uid) {
      loadContacts(user.uid);
    }
  }, [user?.uid, loadContacts]);

  // Load chats when contacts change
  useEffect(() => {
    if (!contactsLoading && contacts.length >= 0) {
      loadChats();
    }
  }, [contacts, contactsLoading, loadChats]);

  // Set up real-time listener for chat threads
  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = chatService.listenToUserThreads(user.uid, (threads) => {
        // Update chats with real-time data
        setChats(prevChats => {
          const updatedChats = prevChats.map(chatItem => {
            // Find matching thread in real-time data by checking both participants
            const realTimeThread = threads.find(thread => 
              thread && thread.participants && 
              thread.participants[chatItem.contact.uid] === true && 
              thread.participants[user.uid] === true
            );
            
            if (realTimeThread) {
              // Only update if the real-time thread has a lastMessage, otherwise keep the existing data
              if (realTimeThread.lastMessage) {
                const lastMessageTime = formatMessageTime(realTimeThread.lastMessage.at);
                const unreadCount = realTimeThread.unread?.[user.uid] || 0;
                
                return {
                  ...chatItem,
                  thread: realTimeThread,
                  lastMessageTime,
                  unreadCount,
                };
              } else {
                // Always keep the original data if real-time has no lastMessage
                return chatItem;
              }
            }
            
            return chatItem;
          });
        
        // Sort by last message time or creation time (most recent first)
        const sortedChats = updatedChats.sort((a, b) => {
          const timeA = a.thread.lastMessage?.at || a.thread.createdAt;
          const timeB = b.thread.lastMessage?.at || b.thread.createdAt;
          return timeB - timeA;
        });
        
        setFilteredChats(sortedChats);
        return sortedChats;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Refresh chats
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshContacts(user?.uid || ''), loadChats()]);
    setRefreshing(false);
  }, [refreshContacts, loadChats, user?.uid]);

  // Load chats when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [loadChats])
  );

  // Handle search functionality
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setFilteredChats(chats);
      return;
    }

    const searchWords = query.toLowerCase().trim().split(' ').filter(word => word.length > 0);
    
    const filtered = chats.filter(chatItem => {
      const { participant, contact, thread } = chatItem;
      
      // Searchable fields
      const contactName = `${participant.firstName} ${participant.lastName}`.toLowerCase();
      const contactFirstName = participant.firstName.toLowerCase();
      const contactLastName = participant.lastName.toLowerCase();
      const specialty = (contact.specialty || '').toLowerCase();
      const role = contact.role.toLowerCase();
      const lastMessage = (thread.lastMessage?.text || '').toLowerCase();
      
      const searchableFields = [
        contactName,
        contactFirstName,
        contactLastName,
        specialty,
        role,
        lastMessage
      ];
      
      // Check if ALL search words are found in any field
      return searchWords.every(word => 
        searchableFields.some(field => field.includes(word))
      );
    });
    
    setFilteredChats(filtered);
  }, [chats]);

  // Update filtered chats when chats or search query changes
  useEffect(() => {
    handleSearch(searchQuery);
  }, [chats, handleSearch, searchQuery]);

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
  const handleChatPress = async (chatItem: ChatListItem) => {
    if (!user) return;

    try {
      const { contact, thread } = chatItem;
      
      // Validate required data
      if (!contact.uid) {
        throw new Error('Contact ID is missing');
      }
      
      let threadId = thread.id;
      
       // If this is a placeholder thread (no real thread exists), create one
       // Check if this is a placeholder by looking at the thread ID format and lack of lastMessage
       const sorted = [user.uid, contact.uid].sort();
       const expectedThreadId = `${sorted[0]}_${sorted[1]}`;
       const isPlaceholder = thread.id === expectedThreadId && !thread.lastMessage;
       
       if (isPlaceholder) {
         // Prepare linked object, filtering out undefined values
         const linked: { referralId?: string; appointmentId?: string; clinicId?: string } = {};
         if (contact.source === 'referral' && contact.sourceId) {
           linked.referralId = contact.sourceId;
         } else if (contact.source === 'appointment' && contact.sourceId) {
           linked.appointmentId = contact.sourceId;
         }
         
         try {
           // Create or get existing chat thread
           const actualThreadId = await chatService.createOrGetThread(
             user.uid,
             contact.uid,
             contact.source === 'referral' ? 'referral' : 'direct',
             Object.keys(linked).length > 0 ? linked : undefined
           );
           
           // Update threadId with the actual thread ID returned from createOrGetThread
           threadId = actualThreadId;
           
           // Add a small delay to ensure the thread is fully created in Firebase
           await new Promise(resolve => setTimeout(resolve, 500));
         } catch (error) {
           console.error('Error creating thread:', error);
           // Continue with the placeholder thread ID - the individual chat screen will handle it
         }
       }

      // Navigate to chat screen with contact info as parameters
      const contactName = `${contact.firstName} ${contact.lastName}`;
      const contactRole = contact.role;
      const contactSpecialty = contact.specialty || (contact.role === 'generalist' ? 'General Medicine' : 'Specialist');
      
      router.push(`/(specialist)/chat/${threadId}?contactId=${contact.uid}&contactName=${encodeURIComponent(contactName)}&contactRole=${contactRole}&contactSpecialty=${encodeURIComponent(contactSpecialty)}`);
    } catch (error) {
      console.error('Error opening chat:', error);
      Alert.alert('Error', `Failed to open chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Render chat item
  const renderChatItem = ({ item }: { item: ChatListItem }) => {
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
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {participant.firstName.charAt(0).toUpperCase()}{participant.lastName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <OnlineStatusIndicator 
            userId={participant.uid} 
            size="small" 
            style={styles.onlineStatusIndicator}
          />
        </View>

        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <View style={styles.nameAndSpecialty}>
              <Text style={styles.chatName}>
                {contact.role === 'generalist' ? 'Dr. ' : ''}{participant.firstName} {participant.lastName}
              </Text>
              <Text style={styles.specialtyText}>
                {contact.role === 'generalist' ? contact.specialty : 'Patient'}
              </Text>
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
                : `Start a conversation with ${contact.role === 'generalist' ? 'the generalist' : 'your patient'}`
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
        You'll see your referring generalists here once you have referrals.{'\n'}
      </Text>
    </View>
  );

  // Show loading state only when contacts are loading (initial load)
  if (contactsLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <LoadingState message="Loading contacts..." variant="fullscreen" size="large" />
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
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>
          <View style={styles.divider} />
        </View>

        {/* Chat List */}
        {error || contactsError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error || contactsError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : chatsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1E40AF" />
            <Text style={styles.loadingText}>Loading chat threads...</Text>
          </View>
        ) : filteredChats.length === 0 ? (
          searchQuery.trim() ? (
            <View style={styles.emptyState}>
              <Search size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No Results Found</Text>
              <Text style={styles.emptyDescription}>
                No chats match your search for "{searchQuery}".{'\n'}
                Try searching with different keywords.
              </Text>
            </View>
          ) : (
            renderEmptyState()
          )
        ) : (
          <FlatList
            data={filteredChats}
            keyExtractor={(item) => item.thread.id}
            renderItem={renderChatItem}
            contentContainerStyle={styles.chatList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#1E40AF']}
                tintColor="#1E40AF"
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Floating Action Button */}
        {/* <TouchableOpacity style={styles.fab}>
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity> */}
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
    position: 'relative',
  },
  onlineStatusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
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
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
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
  nameAndSpecialty: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatName: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  specialtyText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
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
  },
  lastMessage: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    flex: 1,
    marginRight: 8,
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
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
});

