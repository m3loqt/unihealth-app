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
  Send,
  Mic,
  Play,
  Pause,
} from 'lucide-react-native';

import { useAuth } from '@/hooks/auth/useAuth';
import { chatService, ChatMessage } from '@/services/chatService';
import { voiceMessageService } from '@/services/voiceMessageService';
import LoadingState from '@/components/ui/LoadingState';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { Audio } from 'expo-av';
import { testSupabaseConnection } from '@/utils/testSupabase';
import { useUserOnlineStatus } from '@/hooks/useOnlineStatus';

interface ChatParticipant {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'patient' | 'specialist' | 'generalist';
  specialty?: string;
  avatar?: string;
}


interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: number;
  isOwn: boolean;
  attachmentUrl?: string;
  voiceMessage?: {
    audioUrl: string;
    duration: number;
    waveform?: number[];
  };
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
  // Get online status for the participant
  const { isOnline, formattedLastSeen, loading: statusLoading, error: statusError } = useUserOnlineStatus(participant?.uid || '');
  
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [voiceProgress, setVoiceProgress] = useState<{ [messageId: string]: { current: number; total: number } }>({});

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const currentSoundRef = useRef<Audio.Sound | null>(null);


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
          console.log('🔍 Loading participant from database:', otherParticipantId);
          // Get participant info from the database
          const participantInfo = await chatService.getParticipantInfo(otherParticipantId);
          if (participantInfo) {
            console.log('🔍 Participant loaded from database:', participantInfo);
            setParticipant(participantInfo);
          } else {
            console.log('🔍 No participant info found in database for:', otherParticipantId);
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
          console.log('🔍 Using fallback participant data:', fallbackParticipant);
          setParticipant(fallbackParticipant);
        } else {
          console.log('🔍 Thread not found and no fallback data available');
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
          voiceMessage: msg.voiceMessage,
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

  // Online status is now handled by useUserOnlineStatus hook

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
    try {
      setIsRecording(true);
      await voiceMessageService.startRecording();
    } catch (error) {
      console.error('Error starting voice recording:', error);
      setIsRecording(false);
      Alert.alert('Error', 'Failed to start voice recording. Please try again.');
    }
  };

  const handleStopVoiceRecording = async () => {
    try {
      setIsProcessingVoice(true);
      const { uri, duration, waveform } = await voiceMessageService.stopRecording();
      
      // Upload voice message to Supabase
      const audioUrl = await voiceMessageService.uploadVoiceMessage(uri, threadId, 'temp', user!.uid);
      
      // Send voice message to chat with waveform data
      await chatService.sendVoiceMessage(threadId, user!.uid, audioUrl, duration, waveform);
      
      setIsProcessingVoice(false);
    } catch (error) {
      console.error('Error stopping voice recording:', error);
      setIsProcessingVoice(false);
      Alert.alert('Error', 'Failed to send voice message. Please try again.');
    } finally {
      setIsRecording(false);
    }
  };

  // Handle playing voice messages
  const handlePlayVoiceMessage = async (messageId: string, audioUrl: string) => {
    try {
      // Stop current sound if playing
      if (currentSoundRef.current) {
        await currentSoundRef.current.unloadAsync();
        currentSoundRef.current = null;
      }

      setPlayingVoiceId(messageId);
      const sound = await voiceMessageService.playVoiceMessage(audioUrl);
      currentSoundRef.current = sound;

      // Set up progress tracking
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          const currentTime = status.positionMillis || 0;
          const totalTime = status.durationMillis || 0;
          
          setVoiceProgress(prev => ({
            ...prev,
            [messageId]: { current: currentTime, total: totalTime }
          }));

          if (status.didJustFinish) {
            setPlayingVoiceId(null);
            currentSoundRef.current = null;
            setVoiceProgress(prev => {
              const newProgress = { ...prev };
              delete newProgress[messageId];
              return newProgress;
            });
          }
        }
      });
    } catch (error) {
      console.error('Error playing voice message:', error);
      setPlayingVoiceId(null);
      Alert.alert('Error', 'Failed to play voice message.');
    }
  };

  const handleStopVoiceMessage = async () => {
    try {
      if (currentSoundRef.current) {
        await currentSoundRef.current.unloadAsync();
        currentSoundRef.current = null;
      }
      setPlayingVoiceId(null);
      setVoiceProgress(prev => {
        const newProgress = { ...prev };
        // Clear all progress when stopping
        Object.keys(newProgress).forEach(key => delete newProgress[key]);
        return newProgress;
      });
    } catch (error) {
      console.error('Error stopping voice message:', error);
    }
  };

  // Test Supabase connection
  const testSupabase = async () => {
    try {
      const result = await testSupabaseConnection();
      if (result.success) {
        Alert.alert('Success', 'Supabase connection is working!');
      } else {
        Alert.alert('Error', `Supabase test failed: ${result.error}`);
      }
    } catch (error) {
      Alert.alert('Error', `Test failed: ${error}`);
    }
  };


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
  const renderMessage = ({ item }: { item: Message }) => {
    const isPlaying = playingVoiceId === item.id;
    
    return (
      <View style={[
        styles.messageContainer,
        item.isOwn ? styles.ownMessage : styles.otherMessage
      ]}>
        <View style={[
          styles.messageBubble,
          item.isOwn ? styles.ownBubble : styles.otherBubble
        ]}>
          {item.voiceMessage ? (
            <View style={[
              styles.voiceMessageContainer,
              item.isOwn ? styles.ownVoiceContainer : styles.otherVoiceContainer
            ]}>
              <TouchableOpacity
                style={[
                  styles.voicePlayButton,
                  item.isOwn ? styles.ownVoiceButton : styles.otherVoiceButton
                ]}
                onPress={() => {
                  if (isPlaying) {
                    handleStopVoiceMessage();
                  } else {
                    handlePlayVoiceMessage(item.id, item.voiceMessage!.audioUrl);
                  }
                }}
              >
                {isPlaying ? (
                  <Pause size={16} color={item.isOwn ? "#FFFFFF" : "#1E40AF"} />
                ) : (
                  <Play size={16} color={item.isOwn ? "#FFFFFF" : "#1E40AF"} />
                )}
              </TouchableOpacity>
              <View style={styles.voiceWaveform}>
                {(item.voiceMessage.waveform || Array.from({ length: 20 }, () => Math.random())).map((height, i) => {
                  const progress = voiceProgress[item.id];
                  const progressRatio = progress ? progress.current / progress.total : 0;
                  const totalBars = item.voiceMessage.waveform?.length || 20;
                  const currentBar = Math.floor(progressRatio * totalBars);
                  
                  // Determine if this bar should be highlighted (played portion)
                  const isPlayed = i <= currentBar;
                  
                  return (
                    <View
                      key={i}
                      style={[
                        styles.waveformBar,
                        {
                          height: (height * 20) + 4, // Scale height (0-1 to 4-24px)
                          backgroundColor: isPlayed 
                            ? (item.isOwn ? "#FFFFFF" : "#1E40AF") // Played portion - full color
                            : (item.isOwn ? "rgba(255, 255, 255, 0.3)" : "rgba(30, 64, 175, 0.3)"), // Unplayed portion - faded
                        }
                      ]}
                    />
                  );
                })}
              </View>
              <Text style={[
                styles.voiceDuration,
                item.isOwn ? styles.ownVoiceDuration : styles.otherVoiceDuration
              ]}>
                {voiceProgress[item.id] 
                  ? (() => {
                      const remaining = voiceProgress[item.id].total - voiceProgress[item.id].current;
                      const totalSeconds = Math.floor(remaining / 1000);
                      const minutes = Math.floor(totalSeconds / 60);
                      const seconds = totalSeconds % 60;
                      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    })()
                  : (() => {
                      const totalSeconds = Math.floor(item.voiceMessage.duration / 1000);
                      const minutes = Math.floor(totalSeconds / 60);
                      const seconds = totalSeconds % 60;
                      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    })()
                }
              </Text>
            </View>
          ) : (
            <Text style={[
              styles.messageText,
              item.isOwn ? styles.ownMessageText : styles.otherMessageText
            ]}>
              {item.text}
            </Text>
          )}
          <Text style={[
            styles.messageTime,
            item.isOwn ? styles.ownMessageTime : styles.otherMessageTime
          ]}>
            {formatMessageTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

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
                {statusLoading ? 'Loading...' : statusError ? 'Status unavailable' : (isOnline ? 'Online' : formattedLastSeen || 'Offline')}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
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
                  isRecording && styles.voiceButtonActive
                ]}
                onPress={isRecording ? handleStopVoiceRecording : handleStartVoiceRecording}
                disabled={isProcessingVoice}
              >
                <Mic 
                  size={20} 
                  color={isRecording ? "#FFFFFF" : "#6B7280"} 
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
                🎤 Recording... Tap microphone to stop
              </Text>
            </View>
          )}
          
          {/* Voice processing indicator */}
          {isProcessingVoice && (
            <View style={styles.voiceProcessingIndicator}>
              <Text style={styles.voiceProcessingText}>Processing voice message...</Text>
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
  voiceMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
    minHeight: 40,
    alignSelf: 'flex-start',
  },
  ownVoiceContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  otherVoiceContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  voicePlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ownVoiceButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  otherVoiceButton: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#1E40AF',
  },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    paddingHorizontal: 2,
  },
  waveformBar: {
    width: 2,
    marginRight: 2,
    borderRadius: 1,
    minHeight: 4,
  },
  voiceDuration: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginLeft: 5,
    minWidth: 40,
  },
  ownVoiceDuration: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherVoiceDuration: {
    color: '#6B7280',
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