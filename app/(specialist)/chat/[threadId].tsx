import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  FlatList,
  TextInput,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import {
  ArrowLeft,
  MoreVertical,
  Phone,
  Video,
  Send,
  Mic,
} from 'lucide-react-native';

import { useAuth } from '@/hooks/auth/useAuth';
import { chatService } from '@/services/chatService';
import { useVoiceToText } from '@/hooks/useVoiceToText';
import LoadingState from '@/components/ui/LoadingState';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

interface ChatParticipant {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'patient' | 'specialist' | 'generalist';
  specialty?: string;
  avatar?: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  at: number;
  attachmentUrl?: string;
  seenBy: { [uid: string]: boolean };
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: number;
  isOwn: boolean;
  attachmentUrl?: string;
}

export default function SpecialistChatScreen() {
  const { threadId, patientId, patientName, patientSpecialty } = useLocalSearchParams<{ 
    threadId: string; 
    patientId: string; 
    patientName: string; 
    patientSpecialty: string; 
  }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [participant, setParticipant] = useState<ChatParticipant | null>(null);
  const [loading, setLoading] = useState(true);
  const [participantLoading, setParticipantLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(0);
  const [currentThread, setCurrentThread] = useState<any>(null);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Voice to text functionality
  const {
    isRecording,
    isProcessingVoice,
    transcript,
    startRecording,
    stopRecording,
    resetTranscript,
  } = useVoiceToText();

  // Load participant info
  const loadParticipantInfo = useCallback(async () => {
    if (!user || !threadId) return;

    try {
      setParticipantLoading(true);
      
      // First try to get participant info from the thread
      const threadData = await chatService.getThreadById(threadId);
      setCurrentThread(threadData);
      
      if (threadData && threadData.participants) {
        // Find the patient participant (not the current user)
        const participantId = Object.keys(threadData.participants).find(id => id !== user.uid);
        
        if (participantId) {
          // Get patient data from users collection
          const patientData = await chatService.getUserById(participantId);
          
          if (patientData) {
            setParticipant({
              uid: participantId,
              firstName: patientData.firstName || patientData.first_name || 'Unknown',
              lastName: patientData.lastName || patientData.last_name || 'Patient',
              email: patientData.email || '',
              role: 'patient',
              specialty: patientData.specialty || patientSpecialty || 'General Medicine',
              avatar: patientData.avatar || patientData.profilePicture || '',
            });
            return;
          }
        }
      }
      
      // Fallback to URL parameters if thread doesn't exist yet
      if (patientId && patientName) {
        const [firstName, ...lastNameParts] = patientName.split(' ');
        const lastName = lastNameParts.join(' ') || 'Patient';
        
        setParticipant({
          uid: patientId,
          firstName,
          lastName,
          email: '',
          role: 'patient',
          specialty: patientSpecialty || 'General Medicine',
          avatar: '',
        });
      }
    } catch (error) {
      console.error('Error loading participant info:', error);
      
      // Fallback to URL parameters
      if (patientId && patientName) {
        const [firstName, ...lastNameParts] = patientName.split(' ');
        const lastName = lastNameParts.join(' ') || 'Patient';
        
        setParticipant({
          uid: patientId,
          firstName,
          lastName,
          email: '',
          role: 'patient',
          specialty: patientSpecialty || 'General Medicine',
          avatar: '',
        });
      }
    } finally {
      setParticipantLoading(false);
    }
  }, [user, threadId, patientId, patientName, patientSpecialty]);

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!threadId) return;

    try {
      setLoading(true);
      
      // Listen to messages in real-time
      const unsubscribe = chatService.listenToThreadMessages(threadId, (chatMessages) => {
        const formattedMessages: Message[] = chatMessages.map((msg: ChatMessage) => ({
          id: msg.id,
          text: msg.text,
          senderId: msg.senderId,
          timestamp: msg.at,
          isOwn: msg.senderId === user?.uid,
          attachmentUrl: msg.attachmentUrl,
        }));

        setMessages(formattedMessages);
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
      setLoading(false);
    }
  }, [threadId, user]);

  // Mark messages as read when screen focuses
  useFocusEffect(
    useCallback(() => {
      const markAsRead = async () => {
        if (!user || !currentThread) {
          console.log('Cannot mark as read - user or thread not ready');
          return;
        }

        try {
          await chatService.markThreadAsRead(threadId, user.uid);
        } catch (error) {
          console.log('Continuing despite read marking error');
        }
      };

      // Add a delay to ensure thread is fully loaded
      const timeoutId = setTimeout(markAsRead, 1000);
      return () => clearTimeout(timeoutId);
    }, [threadId, user, currentThread])
  );

  // Listen to typing status
  useEffect(() => {
    // Mock implementation - no database calls
  }, [threadId, user, participant]);

  // Listen to participant's online status
  useEffect(() => {
    if (!participant) return;

    // Mock online status for UI testing
    setIsOnline(true);
    setLastSeen(Date.now() - 300000); // 5 minutes ago
  }, [participant]);

  // Set user online status
  useEffect(() => {
    // Mock implementation - no database calls
  }, [user]);

  // Load data
  useEffect(() => {
    loadParticipantInfo();
  }, [loadParticipantInfo]);

  useEffect(() => {
    if (participant) {
      loadMessages();
    }
  }, [participant, loadMessages]);

  // Handle sending messages
  const handleSendMessage = async () => {
    if (!user || !threadId || sending || !messageText.trim()) return;

    try {
      setSending(true);
      const text = messageText.trim();
      setMessageText('');

      await chatService.sendMessage(threadId, user.uid, text);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Handle typing
  const handleTextChange = (text: string) => {
    setMessageText(text);
  };

  // Handle voice recording
  const handleStartVoiceRecording = () => {
    startRecording();
  };

  const handleStopVoiceRecording = () => {
    stopRecording();
  };

  // Update message text when transcript changes
  useEffect(() => {
    if (transcript) {
      setMessageText(transcript);
      resetTranscript();
    }
  }, [transcript, resetTranscript]);

  // Format message time
  const formatMessageTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  };

  // Format last seen time
  const formatLastSeen = (timestamp: number): string => {
    if (!timestamp) return '';

    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Online';
    if (minutes < 60) return `Last seen ${minutes}m ago`;
    if (hours < 24) return `Last seen ${hours}h ago`;
    if (days < 7) return `Last seen ${days}d ago`;
    
    const date = new Date(timestamp);
    return `Last seen ${date.toLocaleDateString()}`;
  };

  // Render message item
  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageContainer,
      item.isOwn ? styles.ownMessage : styles.otherMessage
    ]}>
      <View style={[
        styles.messageBubble,
        item.isOwn ? styles.ownBubble : styles.otherBubble
      ]}>
        <Text style={[
          styles.messageText,
          item.isOwn ? styles.ownMessageText : styles.otherMessageText
        ]}>
          {item.text}
        </Text>
        <Text style={[
          styles.messageTime,
          item.isOwn ? styles.ownMessageTime : styles.otherMessageTime
        ]}>
          {formatMessageTime(item.timestamp)}
        </Text>
      </View>
    </View>
  );

  // Render typing indicator
  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;

    return (
      <View style={styles.typingIndicator}>
        <Text style={styles.typingText}>
          {participant?.firstName} is typing...
        </Text>
      </View>
    );
  };

  if (loading || participantLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <LoadingState message="Loading chat..." variant="fullscreen" size="large" />
      </SafeAreaView>
    );
  }

  if (!participant) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Chat participant not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#1F2937" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <View style={styles.headerAvatar}>
              {participant.avatar ? (
                <Image source={{ uri: participant.avatar }} style={styles.headerAvatarImage} />
              ) : (
                <View style={styles.headerAvatarPlaceholder}>
                  <Text style={styles.headerAvatarText}>
                    {participant.firstName.charAt(0).toUpperCase()}{participant.lastName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerName}>
                {participant.firstName} {participant.lastName}
              </Text>
              <Text style={styles.headerStatus}>
                {isOnline ? 'Online' : formatLastSeen(lastSeen)}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Phone size={20} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Video size={20} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <MoreVertical size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <View style={styles.chatContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={renderTypingIndicator}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
          
          {/* Empty state positioned at bottom */}
          {messages.length === 0 && (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>
                Start a conversation with {participant.firstName}
              </Text>
            </View>
          )}
        </View>

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={messageText}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.voiceButton,
              isRecording && styles.voiceButtonActive,
              isProcessingVoice && styles.voiceButtonDisabled
            ]}
            onPress={isRecording ? handleStopVoiceRecording : handleStartVoiceRecording}
            disabled={isProcessingVoice}
          >
            <Mic size={20} color={isRecording ? "#FFFFFF" : "#6B7280"} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Send size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>

        {/* Voice recording indicator */}
        {isRecording && (
          <View style={styles.voiceRecordingIndicator}>
            <Text style={styles.voiceRecordingText}>Recording... Tap to stop</Text>
          </View>
        )}

        {/* Voice processing indicator */}
        {isProcessingVoice && (
          <View style={styles.voiceProcessingIndicator}>
            <Text style={styles.voiceProcessingText}>Processing voice...</Text>
          </View>
        )}
        </KeyboardAvoidingView>
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
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    marginRight: 12,
  },
  headerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  headerStatus: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  ownBubble: {
    backgroundColor: '#1E40AF',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#1F2937',
  },
  messageTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: '#9CA3AF',
  },
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    minHeight: 60,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sendButton: {
    backgroundColor: '#1E40AF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
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
  },
  emptyStateContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 48,
    paddingBottom: 16,
    paddingTop: 8,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  voiceButton: {
    backgroundColor: '#F3F4F6',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  voiceButtonActive: {
    backgroundColor: '#1E40AF',
  },
  voiceButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  voiceRecordingIndicator: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
  },
  voiceRecordingText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#DC2626',
    textAlign: 'center',
  },
  voiceProcessingIndicator: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#BFDBFE',
  },
  voiceProcessingText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
    textAlign: 'center',
  },
});