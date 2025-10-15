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
import { Bell, RefreshCw, Check, Trash2, Info } from 'lucide-react-native';
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
    const platform = typeof window !== 'undefined' ? 'web' : 'mobile';
    console.log(`🔔 [${platform}] Notification pressed:`, notification);
    console.log(`🔔 [${platform}] Related ID:`, notification.relatedId);
    console.log(`🔔 [${platform}] Notification type:`, notification.type);
    
    // Mark as read first
    console.log(`🔔 [${platform}] About to call handleMarkAsRead for:`, notification.id);
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
      const platform = typeof window !== 'undefined' ? 'web' : 'mobile';
      console.log(`🔔 [${platform}] UI handleMarkAsRead called for notification:`, notificationId);
      await markRealtimeAsRead(notificationId);
      console.log(`🔔 [${platform}] UI Successfully marked notification as read:`, notificationId);
    } catch (error) {
      console.error(`🔔 [${platform}] UI Error marking notification as read:`, error);
      Alert.alert('Error', 'Failed to mark notification as read. Please try again.');
    }
  };

  // Handle deleting notification
  const handleDeleteNotification = async (notificationId: string) => {
    try {
      console.log('🔔 Deleting notification:', notificationId);
      await deleteRealtimeNotification(notificationId);
      console.log('🔔 Successfully deleted notification:', notificationId);
    } catch (error) {
      console.error('🔔 Error deleting notification:', error);
      Alert.alert('Error', 'Failed to delete notification. Please try again.');
    }
  };

  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      console.log('🔔 Marking all notifications as read');
      await markAllRealtimeAsRead();
      console.log('🔔 Successfully marked all notifications as read');
    } catch (error) {
      console.error('🔔 Error marking all notifications as read:', error);
      Alert.alert('Error', 'Failed to mark all notifications as read. Please try again.');
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    try {
      console.log('🔔 Refreshing notifications');
      await refreshRealtimeNotifications();
      console.log('🔔 Successfully refreshed notifications');
    } catch (error) {
      console.error('🔔 Error refreshing notifications:', error);
      Alert.alert('Error', 'Failed to refresh notifications. Please try again.');
    }
  };

  // Format notification time to show relative time (X days ago)
  const formatNotificationTime = (timestamp: number): string => {
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

  // Generate logical title for notification based on type and content
  const getNotificationTitle = (notification: any): string => {
    const type = notification.type?.toLowerCase();
    const message = notification.message?.toLowerCase() || '';
    
    // Appointment related notifications
    if (type === 'appointment') {
      if (message.includes('scheduled') || message.includes('booked')) {
        return 'Appointment Scheduled';
      } else if (message.includes('cancelled') || message.includes('canceled')) {
        return 'Appointment Cancelled';
      } else if (message.includes('rescheduled') || message.includes('reschedule')) {
        return 'Appointment Rescheduled';
      } else if (message.includes('reminder')) {
        return 'Appointment Reminder';
      } else if (message.includes('completed') || message.includes('finished')) {
        return 'Appointment Completed';
      } else {
        return 'Appointment Update';
      }
    }
    
    // Prescription related notifications
    if (type === 'prescription') {
      if (message.includes('prescribed') || message.includes('new prescription')) {
        return 'New Prescription';
      } else if (message.includes('refill') || message.includes('renew')) {
        return 'Prescription Refill';
      } else if (message.includes('expired') || message.includes('expire')) {
        return 'Prescription Expired';
      } else if (message.includes('ready') || message.includes('pickup')) {
        return 'Prescription Ready';
      } else {
        return 'Prescription Update';
      }
    }
    
    // Referral related notifications
    if (type === 'referral') {
      if (message.includes('referred') || message.includes('referral')) {
        return 'New Referral';
      } else if (message.includes('accepted') || message.includes('accept')) {
        return 'Referral Accepted';
      } else if (message.includes('rejected') || message.includes('reject')) {
        return 'Referral Rejected';
      } else {
        return 'Referral Update';
      }
    }
    
    // Chat/Message related notifications
    if (type === 'message' || type === 'chat') {
      return 'New Message';
    }
    
    // System/General notifications
    if (message.includes('welcome') || message.includes('account')) {
      return 'Account Update';
    } else if (message.includes('payment') || message.includes('billing')) {
      return 'Payment Update';
    } else if (message.includes('security') || message.includes('login')) {
      return 'Security Alert';
    } else if (message.includes('maintenance') || message.includes('system')) {
      return 'System Update';
    } else if (message.includes('verification') || message.includes('verify')) {
      return 'Verification Required';
    } else if (message.includes('error') || message.includes('failed')) {
      return 'Action Failed';
    } else if (message.includes('success') || message.includes('completed')) {
      return 'Action Completed';
    }
    
    // Default fallback
    return 'Notification';
  };

  // Handle clear all notifications
  const handleClearAll = async () => {
    try {
      console.log('🔔 Clearing all notifications');
      // Delete all notifications
      for (const notification of realtimeNotifications) {
        await deleteRealtimeNotification(notification.id);
      }
      console.log('🔔 Successfully cleared all notifications');
    } catch (error) {
      console.error('🔔 Error clearing all notifications:', error);
      Alert.alert('Error', 'Failed to clear all notifications. Please try again.');
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
                onPress={handleRefresh}
              >
                <RefreshCw size={20} color="#1E40AF" />
                <Text style={styles.modalActionButtonText}>Refresh</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={handleMarkAllAsRead}
              >
                <Check size={20} color="#1E40AF" />
                <Text style={styles.modalActionButtonText}>Mark All Read</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.clearAllButton}
                onPress={handleClearAll}
              >
                <Trash2 size={20} color="#DC2626" />
                <Text style={styles.clearAllButtonText}>Clear</Text>
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
                    {/* Notification Icon */}
                    <View style={styles.notificationIconContainer}>
                      <Info size={20} color="#9CA3AF" />
                    </View>
                    
                    <View style={styles.notificationContent}>
                      <View style={styles.notificationHeader}>
                        <Text style={[styles.notificationTitle, !notification.read && styles.unreadTitle]}>
                          {getNotificationTitle(notification)}
                        </Text>
                        <Text style={styles.notificationTime}>
                          {formatNotificationTime(notification.timestamp)}
                        </Text>
                      </View>
                      <Text style={[styles.notificationText, !notification.read && styles.unreadText]}>
                        {notification.message}
                      </Text>
                    </View>
                    
                    {/* Mark as read button for unread notifications */}
                    {!notification.read && (
                      <TouchableOpacity
                        style={styles.markReadButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(notification.id);
                        }}
                      >
                        <Check size={16} color="#1E40AF" />
                      </TouchableOpacity>
                    )}
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
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  clearAllButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    marginLeft: 8,
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
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  unreadNotification: {
    backgroundColor: '#F8FAFC',
    borderColor: '#1E40AF',
    borderWidth: 1.5,
  },
  notificationIconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  notificationContent: {
    flex: 1,
    marginRight: 8,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    flex: 1,
  },
  unreadTitle: {
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  notificationText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  unreadText: {
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  notificationTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  markReadButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
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
