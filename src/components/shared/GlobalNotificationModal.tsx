import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { Bell, RefreshCw, Check, Trash2 } from 'lucide-react-native';
import { useRealtimeNotificationContext } from '../../contexts/RealtimeNotificationContext';
import { getSafeNotifications, getSafeUnreadCount } from '../../utils/notificationUtils';
import { router } from 'expo-router';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface GlobalNotificationModalProps {
  visible: boolean;
  onClose: () => void;
  userRole?: 'patient' | 'specialist';
}

const GlobalNotificationModal: React.FC<GlobalNotificationModalProps> = ({
  visible,
  onClose,
  userRole = 'patient',
}) => {
  const { 
    notifications: realtimeNotificationData,
  } = useRealtimeNotificationContext();
  
  // Safely extract notifications and unread count
  const realtimeNotifications = getSafeNotifications(realtimeNotificationData.notifications);
  const realtimeUnreadCount = getSafeUnreadCount(realtimeNotificationData.unreadCount);
  const markRealtimeAsRead = realtimeNotificationData.markAsRead;
  const markAllRealtimeAsRead = realtimeNotificationData.markAllAsRead;
  const deleteRealtimeNotification = realtimeNotificationData.deleteNotification;
  const refreshRealtimeNotifications = realtimeNotificationData.refresh;

  // Handle notification press
  const handleNotificationPress = (notification: any, onClose: () => void) => {
    console.log('🔔 Notification pressed:', notification);
    console.log('🔔 Related ID:', notification.relatedId);
    console.log('🔔 Notification type:', notification.type);
    
    // Mark as read first
    handleMarkAsRead(notification.id);
    
    // Navigate based on notification type and user role
    if (notification.type === 'appointment') {
      console.log('🔔 Navigating to visit overview with ID:', notification.relatedId);
      if (userRole === 'patient') {
        router.push({
          pathname: '/(patient)/visit-overview',
          params: { 
            id: notification.relatedId
          }
        });
      } else {
        // Specialists use the patient's visit-overview since there's no separate specialist version
        router.push({
          pathname: '/(patient)/visit-overview',
          params: { 
            id: notification.relatedId
          }
        });
      }
    } else if (notification.type === 'referral') {
      console.log('🔔 Navigating to referral details with ID:', notification.relatedId);
      if (userRole === 'patient') {
        router.push({
          pathname: '/(patient)/referral-details',
          params: { 
            id: notification.relatedId
          }
        });
      } else {
        router.push({
          pathname: '/(specialist)/referral-details',
          params: { 
            id: notification.relatedId
          }
        });
      }
    }
    
    onClose();
  };
  
  // Handle marking notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markRealtimeAsRead(notificationId);
      console.log('🔔 Marked notification as read:', notificationId);
    } catch (error) {
      console.error('🔔 Error marking notification as read:', error);
    }
  };

  // Handle deleting notification
  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await deleteRealtimeNotification(notificationId);
      console.log('🔔 Deleted notification:', notificationId);
    } catch (error) {
      console.error('🔔 Error deleting notification:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Bell size={32} color="#1E40AF" />
              <Text style={styles.modalTitle}>Notifications</Text>
              <Text style={styles.modalSubtext}>
                {realtimeUnreadCount} unread notification{realtimeUnreadCount !== 1 ? 's' : ''}
              </Text>
            </View>
            
            {/* Action Buttons */}
            <View style={[styles.modalActions, { marginBottom: 12 }]}>
              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={refreshRealtimeNotifications}
              >
                <RefreshCw size={20} color="#1E40AF" />
                <Text style={styles.modalActionButtonText}>Refresh</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={markAllRealtimeAsRead}
              >
                <Check size={20} color="#1E40AF" />
                <Text style={styles.modalActionButtonText}>Mark All Read</Text>
              </TouchableOpacity>
            </View>

            {realtimeNotifications.length === 0 ? (
              <Text style={[styles.emptyNotificationText, { marginBottom: 12, marginTop: 12 }]}>
                No notifications yet
              </Text>
            ) : (
              <ScrollView
                style={styles.notificationScroll}
                contentContainerStyle={styles.notificationListContent}
                showsVerticalScrollIndicator
              >
                {realtimeNotifications.map((notification) => (
                  <TouchableOpacity 
                    key={notification.id} 
                    style={[styles.notificationItem, !notification.read && styles.unreadNotification]}
                    onPress={() => handleNotificationPress(notification, onClose)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.notificationContent}>
                      <Text style={[styles.notificationText, !notification.read && styles.unreadText]}>
                        {notification.message}
                      </Text>
                      <Text style={styles.notificationTime}>
                        {new Date(notification.timestamp).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.notificationActions}>
                      {!notification.read && (
                        <TouchableOpacity
                          style={styles.notificationActionButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification.id);
                          }}
                        >
                          <Check size={16} color="#1E40AF" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.notificationActionButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteNotification(notification.id);
                        }}
                      >
                        <Trash2 size={16} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={onClose}
              >
                <Text style={styles.modalSecondaryButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContainer: {
    width: '100%',
    maxWidth: '100%',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    alignItems: 'center',
    paddingBottom: 24,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtext: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalActionButtonText: {
    color: '#1E40AF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    marginLeft: 8,
  },
  modalSecondaryButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalSecondaryButtonText: {
    color: '#374151',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  notificationScroll: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.55,
    marginBottom: 16,
  },
  notificationListContent: {
    paddingBottom: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#F3F4F6',
  },
  unreadNotification: {
    backgroundColor: '#E0F2FE',
    borderColor: '#1E40AF',
    borderWidth: 1,
  },
  notificationContent: {
    flex: 1,
    marginRight: 10,
    maxWidth: '85%',
  },
  notificationText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
  },
  unreadText: {
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  notificationTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 4,
  },
  notificationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  notificationActionButton: {
    padding: 4,
  },
  emptyNotificationText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default GlobalNotificationModal;
