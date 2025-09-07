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

export default function PatientChatScreen() {
  const { threadId, doctorId, doctorName, doctorSpecialty } = useLocalSearchParams<{ 
    threadId: string;
    doctorId?: string;
    doctorName?: string;
    doctorSpecialty?: string;
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
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Voice-to-text hook
  const {
    isRecording: voiceIsRecording,
    error: voiceError,
    startRecording,
    stopRecording,
    transcript,
    resetTranscript,
  } = useVoiceToText();

  // Voice availability - always true since we have fallbacks
  const isVoiceAvailable = true;

  // Load participant info
  const loadParticipantInfo = useCallback(async () => {
    if (!user || !threadId) return;

    try {
      setParticipantLoading(true);
      
      // Get the thread to find the other participant
      const threads = await chatService.getUserThreads(user.uid);
      const currentThread = threads.find(thread => thread.id === threadId);
      
      if (currentThread) {
        // Find the other participant (not the current user)
        const otherParticipantId = Object.keys(currentThread.participants).find(
          participantId => participantId !== user.uid
        );
        
        if (otherParticipantId) {
          // Get participant info from the database
          const participantInfo = await chatService.getParticipantInfo(otherParticipantId);
          if (participantInfo) {
            setParticipant(participantInfo);
          }
        }
      } else {
        // Thread doesn't exist yet, use fallback data from URL params
        if (doctorId && doctorName) {
          const [firstName, lastName] = doctorName.split(' ');
          const fallbackParticipant: ChatParticipant = {
            uid: doctorId,
            firstName: firstName || 'Doctor',
            lastName: lastName || '',
            email: '',
            role: 'specialist',
            specialty: doctorSpecialty || 'General Medicine',
            avatar: '',
          };
          setParticipant(fallbackParticipant);
          console.log('Using fallback participant data for new chat');
        } else {
          console.log('Thread not found and no fallback data available');
        }
      }
    } catch (error) {
      console.error('Error loading participant info:', error);
      // Use fallback data if available
      if (doctorId && doctorName) {
        const [firstName, lastName] = doctorName.split(' ');
        const fallbackParticipant: ChatParticipant = {
          uid: doctorId,
          firstName: firstName || 'Doctor',
          lastName: lastName || '',
          email: '',
          role: 'specialist',
          specialty: doctorSpecialty || 'General Medicine',
          avatar: '',
        };
        setParticipant(fallbackParticipant);
      }
    } finally {
      setParticipantLoading(false);
    }
  }, [user, threadId, doctorId, doctorName, doctorSpecialty]);

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
      // If thread doesn't exist yet, show empty state
      setMessages([]);
      setLoading(false);
    }
  }, [threadId, user]);

  // Mark messages as read when screen focuses
  useFocusEffect(
    useCallback(() => {
      if (threadId && user) {
        // Only mark as read if the thread exists and has messages
        const markAsRead = async () => {
          try {
            // Check if thread exists first
            const threads = await chatService.getUserThreads(user.uid);
            const currentThread = threads.find(thread => thread.id === threadId);
            
            if (currentThread) {
              console.log('Marking thread as read:', threadId);
              await chatService.markThreadAsRead(threadId, user.uid);
              console.log('Successfully marked thread as read');
            } else {
              console.log('Thread not found in user threads, skipping read marking:', threadId);
            }
          } catch (error) {
            // Silently handle error - thread might not exist yet or other issues
            console.log('Error marking thread as read (this is normal for new threads):', error instanceof Error ? error.message : 'Unknown error');
          }
        };
        
        // Add a small delay to allow the thread to be created if it's new
        setTimeout(() => {
          markAsRead();
        }, 1000);
      }
    }, [threadId, user])
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

      // Send message to the database
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
    
    // Set typing status
    if (text.trim() && threadId && user) {
      chatService.setTypingStatus(threadId, user.uid, true);
    }
  };

  // Handle voice recording
  const handleStartVoiceRecording = async () => {
    if (!isVoiceAvailable) {
      Alert.alert(
        'Voice Recognition Unavailable', 
        voiceError || 'Voice recognition is not available on this device.'
      );
      return;
    }

    if (voiceIsRecording) {
      await handleStopVoiceRecording();
      return;
    }

    try {
      setIsRecording(true);
      await startRecording();
    } catch (error) {
      console.error('Start recording error:', error);
      setIsRecording(false);
      Alert.alert('Error', 'Failed to start voice recording. Please try again.');
    }
  };

  const handleStopVoiceRecording = async () => {
    try {
      setIsProcessingVoice(true);
      await stopRecording();
    } catch (error) {
      console.error('Stop recording error:', error);
      setIsProcessingVoice(false);
      setIsRecording(false);
    }
  };

  // Handle transcript updates
  useEffect(() => {
    if (transcript && transcript.trim()) {
      setMessageText(transcript);
      setIsProcessingVoice(false);
      setIsRecording(false);
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

  // Render empty state when no messages
  const renderEmptyState = () => {
    if (messages.length > 0) return null;

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>
          Start a conversation with Dr. {participant?.firstName} {participant?.lastName}
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
                Dr. {participant.firstName} {participant.lastName}
              </Text>
              <Text style={styles.headerStatus}>
                {isOnline ? 'Online' : formatLastSeen(lastSeen)}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Video size={20} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Phone size={20} color="#6B7280" />
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
          
          {/* Empty state - positioned at bottom above input */}
          {messages.length === 0 && (
            <View style={styles.emptyStateContainer}>
              {renderEmptyState()}
            </View>
          )}
        </View>

        {/* Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={messageText}
              onChangeText={handleTextChange}
              placeholder="Type here..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={1000}
            />
            <View style={styles.inputActions}>
              <TouchableOpacity 
                style={[
                  styles.voiceButton,
                  isRecording && styles.voiceButtonActive,
                  !isVoiceAvailable && styles.voiceButtonDisabled
                ]}
                onPress={handleStartVoiceRecording}
                disabled={!isVoiceAvailable}
              >
                <Mic 
                  size={20} 
                  color={
                    !isVoiceAvailable 
                      ? "#9CA3AF" 
                      : isRecording 
                        ? "#FFFFFF" 
                        : "#6B7280"
                  } 
                />
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
          </View>
          
          {/* Voice recording indicator */}
          {isRecording && (
            <View style={styles.voiceRecordingIndicator}>
              <Text style={styles.voiceRecordingText}>
                🎤 Recording... Speak now! Tap microphone to stop
              </Text>
            </View>
          )}
          
          {/* Voice processing indicator */}
          {isProcessingVoice && (
            <View style={styles.voiceProcessingIndicator}>
              <Text style={styles.voiceProcessingText}>Processing speech...</Text>
            </View>
          )}
        </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    minHeight: 60,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    maxHeight: 100,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  voiceButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    padding: 8,
    marginLeft: 4,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  voiceButtonActive: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  voiceButtonDisabled: {
    opacity: 0.5,
  },
  sendButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 20,
    padding: 8,
    marginLeft: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  voiceRecordingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  voiceRecordingText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#1E40AF',
    textAlign: 'center',
  },
  voiceProcessingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  voiceProcessingText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
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
  emptyState: {
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
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
});