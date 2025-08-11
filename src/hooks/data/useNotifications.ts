import { useState, useEffect, useCallback, useRef } from 'react';
import { databaseService, Notification } from '../../services/database/firebase';
import { useAuth } from '../auth/useAuth';

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
}

export const useNotifications = (pageSize: number = 20): UseNotificationsReturn => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  const lastTimestamp = useRef<number | null>(null);
  const isLoading = useRef(false);
  const abortController = useRef<AbortController | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (!user || isLoading.current) return;

    try {
      // Cancel any ongoing request
      if (abortController.current) {
        abortController.current.abort();
      }
      abortController.current = new AbortController();

      isLoading.current = true;
      
      if (isRefresh) {
        setLoading(true);
        lastTimestamp.current = null;
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      setError(null);
      
      // Try paginated method first, fallback to simple method
      let newNotifications: Notification[];
      try {
        newNotifications = await databaseService.getNotificationsPaginated(
          user.uid, 
          pageSize, 
          isRefresh ? undefined : lastTimestamp.current
        );
      } catch (paginationError) {
        console.log('Pagination failed, using simple method:', paginationError);
        // Fallback to simple method (no pagination)
        newNotifications = await databaseService.getNotifications(user.uid);
        setHasMore(false); // No pagination with simple method
      }

      // Check if request was cancelled
      if (abortController.current?.signal.aborted) return;

      if (isRefresh) {
        setNotifications(newNotifications);
      } else {
        setNotifications(prev => [...prev, ...newNotifications]);
      }

      // Update pagination state
      if (newNotifications.length < pageSize) {
        setHasMore(false);
      } else if (newNotifications.length > 0) {
        lastTimestamp.current = newNotifications[newNotifications.length - 1].timestamp;
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isLoading.current = false;
    }
  }, [user, pageSize]);

  const refresh = useCallback(async () => {
    await loadNotifications(true);
  }, [loadNotifications]);

  const retry = useCallback(async () => {
    setError(null);
    await loadNotifications(true);
  }, [loadNotifications]);

  const loadMore = useCallback(async () => {
    if (hasMore && !loadingMore && !loading) {
      await loadNotifications(false);
    }
  }, [hasMore, loadingMore, loading, loadNotifications]);

  const markAsRead = useCallback(async (notificationId: string): Promise<void> => {
    if (!user) return;

    try {
      // Optimistic update for better UX
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );

      await databaseService.updateDocument(`notifications/${user.uid}/${notificationId}`, { 
        read: true,
        readAt: Date.now()
      });
    } catch (err) {
      // Revert optimistic update on error
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: false } : n)
      );
      console.error('Error marking notification as read:', err);
    }
  }, [user?.uid]);

  const markAllAsRead = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      const unreadIds = notifications
        .filter(n => !n.read)
        .map(n => n.id);
      
      if (unreadIds.length === 0) return;

      // Optimistic update
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );

      await databaseService.markNotificationsAsRead(user.uid, unreadIds);
    } catch (err) {
      // Revert optimistic update on error
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: false }))
      );
      console.error('Error marking all notifications as read:', err);
    }
  }, [notifications, user?.uid]);

  const deleteNotification = useCallback(async (notificationId: string): Promise<void> => {
    if (!user) return;

    try {
      // Optimistic update
      const deletedNotification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));

      await databaseService.deleteDocument(`notifications/${user.uid}/${notificationId}`);
    } catch (err) {
      // Revert optimistic update on error
      if (deletedNotification) {
        setNotifications(prev => [...prev, deletedNotification]);
      }
      console.error('Error deleting notification:', err);
    }
  }, [user?.uid, notifications]);

  // Initial load
  useEffect(() => {
    if (user) {
      loadNotifications(true);
    } else {
      setNotifications([]);
      setLoading(false);
      setHasMore(true);
      lastTimestamp.current = null;
    }
  }, [user, loadNotifications]);

  // Auto-cleanup old notifications (run once per day)
  useEffect(() => {
    if (user) {
      const cleanup = () => {
        databaseService.cleanupOldNotifications(user.uid, 30);
      };
      
      // Run cleanup once per day
      const interval = setInterval(cleanup, 24 * 60 * 60 * 1000);
      
      // Also run cleanup on mount
      cleanup();
      
      return () => clearInterval(interval);
    }
  }, [user]);

  // Cleanup function
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    error,
    hasMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMore,
    refresh,
    retry,
  };
};
