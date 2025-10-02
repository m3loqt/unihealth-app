import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { Bell, RefreshCw, Check, X, Clock, Calendar, User, FileText, DollarSign } from 'lucide-react-native';
import { useRealtimeNotificationContext } from '../../contexts/RealtimeNotificationContext';
import { RealtimeNotification } from '../../services/realtimeNotificationService';
import { getSafeNotifications, getSafeUnreadCount } from '../../utils/notificationUtils';
import { router } from 'expo-router';

interface RealtimeNotificationModalProps {
  visible: boolean;
  onClose: () => void;
  userRole?: 'patient' | 'specialist';
}

const RealtimeNotificationModal: React.FC<RealtimeNotificationModalProps> = ({
  visible,
  onClose,
  userRole = 'patient',
}) => {
  const { notifications: notificationData } = useRealtimeNotificationContext();
  
  // Safely extract notifications and unread count
  const notifications = getSafeNotifications(notificationData.notifications);
  const unreadCount = getSafeUnreadCount(notificationData.unreadCount);
  const loading = notificationData.loading;
  const markAsRead = notificationData.markAsRead;
  const markAllAsRead = notificationData.markAllAsRead;
  const deleteNotification = notificationData.deleteNotification;
  const refresh = notificationData.refresh;

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const platform = typeof window !== 'undefined' ? 'web' : 'mobile';
      console.log(`🔔 [${platform}] RealtimeModal handleMarkAsRead called for notification:`, notificationId);
      await markAsRead(notificationId);
      console.log(`🔔 [${platform}] RealtimeModal Successfully marked notification as read:`, notificationId);
    } catch (error) {
      console.error(`🔔 [${platform}] RealtimeModal Error marking notification as read:`, error);
      Alert.alert('Error', 'Failed to mark notification as read. Please try again.');
    }
  };

  const handleMarkAllAsRead = () => {
    Alert.alert(
      'Mark All as Read',
      'Are you sure you want to mark all notifications as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Mark All Read', 
          onPress: async () => {
            try {
              console.log('🔔 Marking all notifications as read');
              await markAllAsRead();
              console.log('🔔 Successfully marked all notifications as read');
            } catch (error) {
              console.error('🔔 Error marking all notifications as read:', error);
              Alert.alert('Error', 'Failed to mark all notifications as read. Please try again.');
            }
          }
        },
      ]
    );
  };

  const handleDeleteNotification = (notificationId: string, title: string) => {
    Alert.alert(
      'Delete Notification',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              console.log('🔔 Deleting notification:', notificationId);
              await deleteNotification(notificationId);
              console.log('🔔 Successfully deleted notification:', notificationId);
            } catch (error) {
              console.error('🔔 Error deleting notification:', error);
              Alert.alert('Error', 'Failed to delete notification. Please try again.');
            }
          }
        },
      ]
    );
  };

  const handleRefresh = async () => {
    try {
      console.log('🔔 Refreshing notifications');
      await refresh();
      console.log('🔔 Successfully refreshed notifications');
    } catch (error) {
      console.error('🔔 Error refreshing notifications:', error);
      Alert.alert('Error', 'Failed to refresh notifications. Please try again.');
    }
  };

  // Handle notification press - navigate to appropriate route
  const handleNotificationPress = (notification: RealtimeNotification) => {
    console.log('🔔 Realtime notification pressed:', notification);
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

  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'appointment':
        return <Calendar size={20} color="#1E40AF" />;
      case 'referral':
        return <User size={20} color="#059669" />;
      case 'professional_fee':
        return <DollarSign size={20} color="#059669" />;
      case 'prescription':
        return <FileText size={20} color="#DC2626" />;
      case 'certificate':
        return <FileText size={20} color="#7C3AED" />;
      default:
        return <Bell size={20} color="#6B7280" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#DC2626';
      case 'medium':
        return '#D97706';
      case 'low':
        return '#059669';
      default:
        return '#6B7280';
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
            {/* Header */}
            <View style={styles.modalHeader}>
              <Bell size={32} color="#1E40AF" />
              <Text style={styles.modalTitle}>Real-time Notifications</Text>
              <Text style={styles.modalSubtext}>
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </Text>
            </View>
            
            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={handleRefresh}
                disabled={loading}
              >
                <RefreshCw size={20} color="#1E40AF" />
                <Text style={styles.modalActionButtonText}>Refresh</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={handleMarkAllAsRead}
                disabled={unreadCount === 0}
              >
                <Check size={20} color="#1E40AF" />
                <Text style={styles.modalActionButtonText}>Mark All Read</Text>
              </TouchableOpacity>
            </View>

            {/* Notifications List */}
            <ScrollView
              style={styles.notificationsList}
              refreshControl={
                <RefreshControl refreshing={loading} onRefresh={handleRefresh} />
              }
            >
              {notifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Bell size={48} color="#9CA3AF" />
                  <Text style={styles.emptyText}>No notifications yet</Text>
                  <Text style={styles.emptySubtext}>
                    You'll receive real-time notifications for appointment and referral updates
                  </Text>
                </View>
              ) : (
                notifications.map((notification) => (
                  <TouchableOpacity
                    key={notification.id}
                    style={[
                      styles.notificationItem,
                      !notification.read && styles.unreadNotification,
                    ]}
                    onPress={() => handleNotificationPress(notification)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.notificationHeader}>
                      <View style={styles.notificationIconContainer}>
                        {getNotificationIcon(notification.type)}
                      </View>
                      <View style={styles.notificationContent}>
                        <View style={styles.notificationTitleRow}>
                          <Text style={styles.notificationTitle}>
                            {notification.title}
                          </Text>
                          <View style={styles.notificationActions}>
                            {!notification.read && (
                              <TouchableOpacity
                                style={styles.markReadButton}
                                onPress={() => handleMarkAsRead(notification.id)}
                              >
                                <Check size={16} color="#059669" />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={styles.deleteButton}
                              onPress={() => handleDeleteNotification(notification.id, notification.title)}
                            >
                              <X size={16} color="#DC2626" />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <Text style={styles.notificationMessage}>
                          {notification.message}
                        </Text>
                        <View style={styles.notificationFooter}>
                          <View style={styles.notificationMeta}>
                            <Clock size={14} color="#6B7280" />
                            <Text style={styles.notificationTime}>
                              {formatTimestamp(notification.timestamp)}
                            </Text>
                            <View
                              style={[
                                styles.priorityIndicator,
                                { backgroundColor: getPriorityColor(notification.priority) },
                              ]}
                            />
                            <Text style={styles.priorityText}>
                              {notification.priority.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginTop: 8,
  },
  modalSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalActionButtonText: {
    marginLeft: 8,
    color: '#1E40AF',
    fontWeight: '600',
  },
  notificationsList: {
    flex: 1,
    marginBottom: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  notificationItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#E5E7EB',
  },
  unreadNotification: {
    backgroundColor: '#EFF6FF',
    borderLeftColor: '#1E40AF',
  },
  notificationHeader: {
    flexDirection: 'row',
  },
  notificationIconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  notificationActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markReadButton: {
    padding: 4,
    marginRight: 8,
  },
  deleteButton: {
    padding: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationTime: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  priorityText: {
    fontSize: 10,
    color: '#6B7280',
    marginLeft: 4,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RealtimeNotificationModal;
