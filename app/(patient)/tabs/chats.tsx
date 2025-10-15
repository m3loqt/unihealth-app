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
} from 'lucide-react-native';
import { router } from 'expo-router';

import { useAuth } from '@/hooks/auth/useAuth';
import { usePatientChatDoctors } from '@/hooks/data/usePatientChatDoctors';
import { chatService } from '@/services/chatService';
import LoadingState from '@/components/ui/LoadingState';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { OnlineStatusIndicator } from '@/components/OnlineStatusIndicator';

interface ChatParticipant {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'patient' | 'specialist' | 'admin';
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

export default function PatientChatsScreen() {
  const { user } = useAuth();
  const { doctors, loading: doctorsLoading, error: doctorsError, refresh: refreshDoctors } = usePatientChatDoctors();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [filteredChats, setFilteredChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load chat threads
  const loadChats = useCallback(async () => {
    if (!user || doctorsLoading) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // If no doctors available, set empty chats and finish loading
      if (doctors.length === 0) {
        setChats([]);
        setLoading(false);
        return;
      }

      const chatList: ChatListItem[] = [];

      // Get existing chat threads for this user
      let existingThreads: ChatThread[] = [];
      try {
        existingThreads = await chatService.getUserThreads(user.uid);
        console.log('📋 Loaded existing threads:', existingThreads.length);
        existingThreads.forEach(thread => {
          console.log('📋 Thread:', thread.id, 'participants:', Object.keys(thread.participants), 'lastMessage:', thread.lastMessage?.text);
        });
      } catch (threadError) {
        console.error('Error loading existing threads:', threadError);
        // Continue without existing threads - we'll create placeholders for all doctors
      }
      
      // Create a map of existing threads by participant IDs for quick lookup
      const threadMap = new Map<string, ChatThread>();
      existingThreads.forEach(thread => {
        const participants = Object.keys(thread.participants);
        if (participants.length === 2) {
          // Create keys for both possible participant combinations (sorted alphabetically)
          const sorted = participants.sort();
          const key1 = `${sorted[0]}_${sorted[1]}`;
          const key2 = `${sorted[1]}_${sorted[0]}`;
          threadMap.set(key1, thread);
          threadMap.set(key2, thread);
          
          // Also store by individual participant IDs for easier lookup
          participants.forEach(participantId => {
            threadMap.set(participantId, thread);
          });
        }
      });

      // Create chat list items from doctors
      console.log('👨‍⚕️ Processing doctors:', doctors.length);
      for (const doctor of doctors) {
        console.log('👨‍⚕️ Processing doctor:', doctor.firstName, doctor.lastName, 'UID:', doctor.uid);
        
        // Try to find existing thread with this doctor
        let thread: ChatThread | undefined;
        
        // First, try to find by checking if both participants exist in any thread
        for (const existingThread of existingThreads) {
          console.log('🔍 Checking thread:', existingThread.id, 'participants:', Object.keys(existingThread.participants), 'looking for user:', user.uid, 'doctor:', doctor.uid);
          
          if (existingThread.participants[user.uid] && existingThread.participants[doctor.uid]) {
            console.log('✅ Found existing thread for doctor:', doctor.firstName, doctor.lastName, 'thread ID:', existingThread.id, 'last message:', existingThread.lastMessage?.text || 'No last message');
            thread = existingThread;
            break;
          }
        }

        // If no existing thread found, create a placeholder
        if (!thread) {
          console.log('📝 Creating placeholder for doctor:', doctor.firstName, doctor.lastName);
          thread = {
            id: `${user.uid}_${doctor.uid}`, // Use consistent ID format
            participants: { [user.uid]: true, [doctor.uid]: true },
            type: doctor.source === 'referral' ? 'referral' : 'direct',
            unread: { [user.uid]: 0, [doctor.uid]: 0 },
            createdAt: doctor.lastInteraction || Date.now(),
            // No lastMessage - this will show "Start a conversation with your doctor"
          };
        } else {
          console.log('✅ Found existing thread for doctor:', doctor.firstName, doctor.lastName, 'thread ID:', thread.id, 'with last message:', thread.lastMessage?.text || 'No last message');
        }

        const lastMessageTime = thread.lastMessage 
          ? formatMessageTime(thread.lastMessage.at)
          : formatMessageTime(thread.createdAt);
        const unreadCount = thread.unread?.[user.uid] || 0;

        // Create participant object
        const participant: ChatParticipant = {
          uid: doctor.uid,
          firstName: doctor.firstName,
          lastName: doctor.lastName,
          email: doctor.email,
          role: doctor.role === 'generalist' ? 'specialist' : 'specialist', // Map generalist to specialist for UI
          specialty: doctor.specialty,
          avatar: doctor.avatar,
        };

        chatList.push({
          thread,
          participant,
          lastMessageTime,
          unreadCount,
          doctor,
        });
      }

      // Sort by last message time or creation time (most recent first)
      chatList.sort((a, b) => {
        const timeA = a.thread.lastMessage?.at || a.thread.createdAt;
        const timeB = b.thread.lastMessage?.at || b.thread.createdAt;
        return timeB - timeA;
      });

      console.log('📋 Final chat list:', chatList.length, 'items');
      chatList.forEach(chat => {
        console.log('📋 Chat item:', chat.doctor.firstName, chat.doctor.lastName, 'has lastMessage:', !!chat.thread.lastMessage, 'text:', chat.thread.lastMessage?.text || 'N/A');
      });
      setChats(chatList);
      setFilteredChats(chatList);
    } catch (error) {
      console.error('Error loading chats:', error);
      setError('Failed to load chats. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, doctors, doctorsLoading]);

  // Listen to real-time chat updates
  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Set up real-time listener for chat threads
  useEffect(() => {
    if (!user) return;

    console.log('👂 Setting up real-time listener for user:', user.uid);
    
    const unsubscribe = chatService.listenToUserThreads(user.uid, (threads) => {
      console.log('📨 Real-time update received:', threads.length, 'threads');
      
      // Update chats with real-time data
      setChats(prevChats => {
        const updatedChats = prevChats.map(chatItem => {
          // Find matching thread in real-time data by checking both participants
          const realTimeThread = threads.find(thread => 
            thread.participants[chatItem.doctor.uid] === true && 
            thread.participants[user.uid] === true
          );
          
          if (realTimeThread) {
            console.log('🔄 Updating chat with real-time data for doctor:', chatItem.doctor.firstName, 'last message:', realTimeThread.lastMessage?.text);
            
            // Update with real-time thread data
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
      console.log('🔇 Unsubscribing from real-time updates');
      unsubscribe();
    };
  }, [user]);

  // Refresh chats
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshDoctors(), loadChats()]);
    setRefreshing(false);
  }, [refreshDoctors, loadChats]);

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
      const { participant, doctor, thread } = chatItem;
      
      // Searchable fields
      const doctorName = `${participant.firstName} ${participant.lastName}`.toLowerCase();
      const doctorFirstName = participant.firstName.toLowerCase();
      const doctorLastName = participant.lastName.toLowerCase();
      const specialty = (doctor.specialty || '').toLowerCase();
      const lastMessage = (thread.lastMessage?.text || '').toLowerCase();
      
      const searchableFields = [
        doctorName,
        doctorFirstName,
        doctorLastName,
        specialty,
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
      const { doctor, thread } = chatItem;
      
      // Debug logging
      console.log('Opening chat with doctor:', {
        doctorId: doctor.uid,
        doctorName: `${doctor.firstName} ${doctor.lastName}`,
        source: doctor.source,
        sourceId: doctor.sourceId,
        userId: user.uid,
        existingThreadId: thread.id
      });
      
      // Validate required data
      if (!doctor.uid) {
        throw new Error('Doctor ID is missing');
      }
      
      let threadId = thread.id;
      
       // If this is a placeholder thread (no real thread exists), create one
       // Check if this is a placeholder by looking at the thread ID format and lack of lastMessage
       const isPlaceholder = thread.id.startsWith(`${user.uid}_${doctor.uid}`) && !thread.lastMessage;
       
       if (isPlaceholder) {
         console.log('📝 Creating new thread for doctor:', doctor.firstName, doctor.lastName, 'placeholder detected');
         
         // Prepare linked object, filtering out undefined values
         const linked: { referralId?: string; appointmentId?: string; clinicId?: string } = {};
         if (doctor.source === 'referral' && doctor.sourceId) {
           linked.referralId = doctor.sourceId;
         } else if (doctor.source === 'appointment' && doctor.sourceId) {
           linked.appointmentId = doctor.sourceId;
         }
         
         try {
           // Create or get existing chat thread
           threadId = await chatService.createOrGetThread(
             user.uid,
             doctor.uid,
             doctor.source === 'referral' ? 'referral' : 'direct',
             Object.keys(linked).length > 0 ? linked : undefined
           );
           
           console.log('✅ Successfully created new thread:', threadId);
           
           // Add a small delay to ensure the thread is fully created in Firebase
           await new Promise(resolve => setTimeout(resolve, 500));
         } catch (error) {
           console.error('Error creating thread:', error);
           // Continue with the placeholder thread ID - the individual chat screen will handle it
           console.log('Continuing with placeholder thread ID');
         }
       } else {
         console.log('Using existing thread:', threadId);
       }

      // Navigate to chat screen with doctor info as parameters
      const doctorName = `${doctor.firstName} ${doctor.lastName}`;
      router.push(`/(patient)/chat/${threadId}?doctorId=${doctor.uid}&doctorName=${encodeURIComponent(doctorName)}&doctorSpecialty=${encodeURIComponent(doctor.specialty || 'General Medicine')}`);
    } catch (error) {
      console.error('Error opening chat:', error);
      Alert.alert('Error', `Failed to open chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Render chat item
  const renderChatItem = ({ item }: { item: ChatListItem }) => {
    const { thread, participant, lastMessageTime, unreadCount, doctor } = item;
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
            <Text style={styles.chatName}>
              Dr. {participant.firstName} {participant.lastName}
            </Text>
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
                : 'Start a conversation with your doctor'
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
          
          {/* Show specialty info */}
          <View style={styles.sourceInfo}>
            <Text style={styles.sourceText}>
              {doctor.specialty}
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
      <Text style={styles.emptyTitle}>No Doctors Available</Text>
      <Text style={styles.emptyDescription}>
        You'll see your doctors here once you have appointments or referrals.{'\n'}
      </Text>
    </View>
  );

  if (loading || doctorsLoading) {
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
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>
          <View style={styles.divider} />
        </View>

        {/* Chat List */}
        {error || doctorsError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error || doctorsError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
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
  chatName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    flex: 1,
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
});
