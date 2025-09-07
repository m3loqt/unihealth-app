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
  Edit3,
  Check,
  CheckCheck,
} from 'lucide-react-native';
import { router } from 'expo-router';

import { useAuth } from '@/hooks/auth/useAuth';
import LoadingState from '@/components/ui/LoadingState';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

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
}

export default function SpecialistChatsScreen() {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load chat participants from appointments and referrals
  const loadChatParticipants = useCallback(async () => {
    if (!user) return [];

    // Mock data for UI testing
    return [
      {
        uid: 'patient1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        role: 'patient' as const,
        specialty: '',
        avatar: '',
      },
      {
        uid: 'patient2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        role: 'patient' as const,
        specialty: '',
        avatar: '',
      },
      {
        uid: 'patient3',
        firstName: 'Robert',
        lastName: 'Johnson',
        email: 'robert.johnson@example.com',
        role: 'patient' as const,
        specialty: '',
        avatar: '',
      },
    ];
  }, [user]);

  // Load chat threads
  const loadChats = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const participants = await loadChatParticipants();
      const chatList: ChatListItem[] = [];

      // Create mock chat threads
      for (const participant of participants) {
        const mockThread: ChatThread = {
          id: `thread_${user.uid}_${participant.uid}`,
          participants: { [user.uid]: true, [participant.uid]: true },
          type: 'direct',
          lastMessage: {
            text: participant.uid === 'patient1' ? 'Hi, Jimmy! Any update today?' : 
                  participant.uid === 'patient2' ? 'Cool! I have some feedbacks on the "How it work" section. but overall looks good now! 👍' : 
                  'Here\'s the new landing page design! https://www.figma.com/file/EQJUT...',
            at: Date.now() - Math.random() * 86400000, // Random time within last 24 hours
            senderId: Math.random() > 0.5 ? user.uid : participant.uid,
          },
          unread: { [user.uid]: Math.floor(Math.random() * 5) },
          createdAt: Date.now() - Math.random() * 604800000, // Random time within last week
        };

        const lastMessageTime = formatMessageTime(mockThread.lastMessage.at);
        const unreadCount = mockThread.unread?.[user.uid] || 0;

        chatList.push({
          thread: mockThread,
          participant,
          lastMessageTime,
          unreadCount,
        });
      }

      // Sort by last message time
      chatList.sort((a, b) => {
        const timeA = a.thread.lastMessage?.at || 0;
        const timeB = b.thread.lastMessage?.at || 0;
        return timeB - timeA;
      });

      setChats(chatList);
    } catch (error) {
      console.error('Error loading chats:', error);
      setError('Failed to load chats. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, loadChatParticipants]);

  // Listen to real-time chat updates
  useEffect(() => {
    // Mock implementation - no database calls
  }, [user, loadChatParticipants]);

  // Refresh chats
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChats();
    setRefreshing(false);
  }, [loadChats]);

  // Load chats when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [loadChats])
  );

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
    try {
      // Use the thread ID from the chat item
      const threadId = chatItem.thread.id;

      // Navigate to chat screen
      router.push(`/(specialist)/chat/${threadId}`);
    } catch (error) {
      console.error('Error opening chat:', error);
      Alert.alert('Error', 'Failed to open chat. Please try again.');
    }
  };

  // Render chat item
  const renderChatItem = ({ item }: { item: ChatListItem }) => {
    const { thread, participant, lastMessageTime, unreadCount } = item;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => handleChatPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.chatAvatar}>
          {participant.avatar ? (
            <Image source={{ uri: participant.avatar }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {participant.firstName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName}>
              {participant.firstName} {participant.lastName}
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
              {thread.lastMessage ? thread.lastMessage.text : 'No messages yet'}
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
      <Text style={styles.emptyTitle}>No Chats Yet</Text>
      <Text style={styles.emptyDescription}>
        You'll see your patients here once you have appointments or referrals.
      </Text>
    </View>
  );

  if (loading) {
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
        
        {/* Header with Search */}
        <View style={styles.header}>
          <View style={styles.searchContainer}>
            <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search message..."
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <TouchableOpacity style={styles.editButton}>
            <Edit3 size={20} color="#1E40AF" />
          </TouchableOpacity>
        </View>

        {/* Chat List */}
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadChats}>
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
                onRefresh={onRefresh}
                colors={['#1E40AF']}
                tintColor="#1E40AF"
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Floating Action Button */}
        <TouchableOpacity style={styles.fab}>
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  editButton: {
    padding: 8,
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
  chatAvatar: {
    marginRight: 16,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
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
});
