import { useState, useEffect, useCallback } from 'react';
import { databaseService } from '../../services/database/firebase';
import { useAuth } from '../auth/useAuth';

export interface Notification {
  id: string;
  type: 'appointment' | 'referral' | 'prescription' | 'certificate';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  relatedId: string;
  userId: string;
}

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

export const useNotifications = (): UseNotificationsReturn => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useCallback(async (notificationId: string): Promise<void> => {
    try {
      await databaseService.updateDocument(`notifications/${notificationId}`, { read: true });
      // Real-time listener will handle the update
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async (): Promise<void> => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      const updatePromises = unreadNotifications.map(notification =>
        databaseService.updateDocument(`notifications/${notification.id}`, { read: true })
      );
      await Promise.all(updatePromises);
      // Real-time listener will handle the updates
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, [notifications]);

  const deleteNotification = useCallback(async (notificationId: string): Promise<void> => {
    try {
      await databaseService.deleteDocument(`notifications/${notificationId}`);
      // Real-time listener will handle the deletion
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  }, []);

  // Set up real-time listener for notifications
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Subscribe to real-time updates
    const unsubscribe = databaseService.onNotificationsChange(
      user.uid, 
      (updatedNotifications) => {
        setNotifications(updatedNotifications);
        setLoading(false);
        setError(null);
      }
    );

    // Cleanup subscription on unmount or user change
    return () => {
      unsubscribe();
    };
  }, [user]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
};
