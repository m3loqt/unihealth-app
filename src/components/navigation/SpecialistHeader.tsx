import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, StatusBar, Modal, Pressable, ScrollView, TextInput, Alert } from 'react-native';
import { Bell, Calendar, User, MessageCircle, Bot, X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../hooks/auth/useAuth';
import { getFirstName } from '../../utils/string';
import { aiService, ChatMessage } from '../../services/aiService';

interface SpecialistHeaderProps {
  title?: string;
  showGreeting?: boolean;
  showNotificationBadge?: boolean;
  notificationCount?: number;
  onNotificationPress?: () => void;
}

export default function SpecialistHeader({ 
  title, 
  showGreeting = false, 
  showNotificationBadge = true,
  notificationCount = 0,
  onNotificationPress
}: SpecialistHeaderProps) {
  const { user } = useAuth();
  
  // Chatbot state
  const [showChatbotModal, setShowChatbotModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatbotLoading, setIsChatbotLoading] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning,';
    if (hour < 18) return 'Good afternoon,';
    return 'Good evening,';
  };

  // Chatbot functions
  const handleOpenChatbot = () => {
    setShowChatbotModal(true);
    // Add welcome message if no messages exist
    if (chatMessages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        text: 'Hello! I\'m your medical assistant. I can help answer general medical questions and provide clinical guidance. Remember to always follow proper medical protocols and consult with colleagues when needed.',
        isUser: false,
        timestamp: new Date(),
      };
      setChatMessages([welcomeMessage]);
    }
  };

  const handleCloseChatbot = () => {
    setShowChatbotModal(false);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatbotLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: chatInput.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatbotLoading(true);

    try {
      const response = await aiService.sendMessage(userMessage.text);
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: response.text,
        isUser: false,
        timestamp: new Date(),
      };

      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: 'I apologize, but I\'m having trouble processing your request right now. Please try again later.',
        isUser: false,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatbotLoading(false);
    }
  };

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {showGreeting ? (
            <>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.userName}>Dr. {user?.firstName || (user as any)?.name || 'Specialist'}</Text>
            </>
          ) : (
            <Text style={styles.headerTitle}>{title}</Text>
          )}
        </View>
        
        <View style={styles.headerIcons}>
          {/* AI Chat Button */}
          <View style={styles.chatbotButtonContainer}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={handleOpenChatbot}
            >
              <Bot size={24} color="#6B7280" />
            </TouchableOpacity>
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => {
              console.log(' SpecialistHeader - Notification button pressed');
              console.log(' SpecialistHeader - onNotificationPress function:', typeof onNotificationPress);
              if (onNotificationPress) {
                console.log(' SpecialistHeader - Calling onNotificationPress');
                onNotificationPress();
              } else {
                console.log(' SpecialistHeader - onNotificationPress is undefined');
              }
            }}
            activeOpacity={0.7}
          >
            <Bell size={24} color="#6B7280" />
            {showNotificationBadge && notificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationText}>
                  {notificationCount > 9 ? '9+' : notificationCount.toString()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => router.push('/(specialist)/tabs/profile')}
          >
            {user?.firstName || (user as any)?.name ? (
              <View style={styles.profileInitials}>
                <Text style={styles.profileInitialsText}>
                  {getFirstName((user as any).name || user.firstName).charAt(0).toUpperCase()}
                </Text>
              </View>
            ) : (
              <Image
                source={{ uri: 'https://via.placeholder.com/36' }}
                style={styles.profileImage}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* === CHATBOT MODAL === */}
    <Modal
      visible={showChatbotModal}
      transparent={true}
      animationType="slide"
      onRequestClose={handleCloseChatbot}
    >
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <Pressable style={chatbotModalStyles.backdrop} onPress={handleCloseChatbot}>
        <BlurView intensity={22} style={chatbotModalStyles.blurView}>
          <View style={chatbotModalStyles.overlay} />
        </BlurView>
      </Pressable>
      <View style={chatbotModalStyles.modalContainer}>
        <SafeAreaView style={chatbotModalStyles.safeArea}>
          <View style={chatbotModalStyles.modalContent}>
            {/* Header */}
            <View style={chatbotModalStyles.header}>
              <View style={chatbotModalStyles.headerLeft}>
                <View style={chatbotModalStyles.botAvatar}>
                  <Bot size={20} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={chatbotModalStyles.headerTitle}>Medical Assistant</Text>
                  <Text style={chatbotModalStyles.headerSubtitle}>Ask me anything about medical practice</Text>
                </View>
              </View>
              <TouchableOpacity style={chatbotModalStyles.closeButton} onPress={handleCloseChatbot}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            {/* Divider */}
            <View style={chatbotModalStyles.divider} />
            
            {/* Messages */}
            <ScrollView 
              style={chatbotModalStyles.messagesContainer}
              contentContainerStyle={chatbotModalStyles.messagesContent}
              showsVerticalScrollIndicator={false}
            >
              {chatMessages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    chatbotModalStyles.messageContainer,
                    message.isUser ? chatbotModalStyles.userMessage : chatbotModalStyles.botMessage
                  ]}
                >
                  <View
                    style={[
                      chatbotModalStyles.messageBubble,
                      message.isUser ? chatbotModalStyles.userBubble : chatbotModalStyles.botBubble
                    ]}
                  >
                    <Text
                      style={[
                        chatbotModalStyles.messageText,
                        message.isUser ? chatbotModalStyles.userText : chatbotModalStyles.botText
                      ]}
                    >
                      {message.text}
                    </Text>
                  </View>
                  <Text style={chatbotModalStyles.messageTime}>
                    {message.timestamp.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>
              ))}
              {isChatbotLoading && (
                <View style={[chatbotModalStyles.messageContainer, chatbotModalStyles.botMessage]}>
                  <View style={[chatbotModalStyles.messageBubble, chatbotModalStyles.botBubble]}>
                    <View style={chatbotModalStyles.typingIndicator}>
                      <View style={chatbotModalStyles.typingDot} />
                      <View style={chatbotModalStyles.typingDot} />
                      <View style={chatbotModalStyles.typingDot} />
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
            
            {/* Input */}
            <View style={chatbotModalStyles.inputContainer}>
              <View style={chatbotModalStyles.inputWrapper}>
                <TextInput
                  style={chatbotModalStyles.textInput}
                  placeholder="Ask a medical question..."
                  placeholderTextColor="#9CA3AF"
                  value={chatInput}
                  onChangeText={setChatInput}
                  multiline
                  maxLength={500}
                  editable={!isChatbotLoading}
                />
                <TouchableOpacity
                  style={[
                    chatbotModalStyles.sendButton,
                    (!chatInput.trim() || isChatbotLoading) && chatbotModalStyles.sendButtonDisabled
                  ]}
                  onPress={handleSendMessage}
                  disabled={!chatInput.trim() || isChatbotLoading}
                >
                  <Bot size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 16,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  userName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    position: 'relative',
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter-Bold',
  },
  profileInitials: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitialsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  chatbotButtonContainer: {
    position: 'relative',
  },
  newBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },
});

// Chatbot Modal Styles
const chatbotModalStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
  },
  blurView: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.34)' },
  modalContainer: {
    flex: 1, justifyContent: 'flex-end', zIndex: 2,
  },
  safeArea: { width: '100%' },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    minHeight: 400,
    maxHeight: 600,
  },
  header: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  botAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18, 
    fontFamily: 'Inter-Bold', 
    color: '#1F2937', 
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13, 
    fontFamily: 'Inter-Regular', 
    color: '#6B7280',
  },
  closeButton: {
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#E5E7EB',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  messagesContainer: {
    flex: 1,
    marginBottom: 16,
  },
  messagesContent: {
    paddingVertical: 8,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  botMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#1E40AF',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  userText: {
    color: '#FFFFFF',
  },
  botText: {
    color: '#1F2937',
  },
  messageTime: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 4,
    marginHorizontal: 16,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
  inputContainer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
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
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
});
