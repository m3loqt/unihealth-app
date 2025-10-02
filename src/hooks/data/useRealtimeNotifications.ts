import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { realtimeNotificationService, RealtimeNotification } from '../../services/realtimeNotificationService';

export interface UseRealtimeNotificationsReturn {
  notifications: RealtimeNotification[];
  loading: boolean;
  error: string | null;
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (notificationId: string) => void;
  refresh: () => void;
  clearNotifications: () => void;
}

export const useRealtimeNotifications = (): UseRealtimeNotificationsReturn => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const userRoleRef = useRef<'patient' | 'specialist' | null>(null);

  // Determine user role based on user data
  const getUserRole = useCallback((): 'patient' | 'specialist' => {
    // Get user role from the user object
    return user?.role || 'patient';
  }, [user?.role]);

  // Mark notification as read (update cache)
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user?.uid) return;
    
    try {
      // Ensure callback is still registered before marking as read
      const userRole = getUserRole();
      realtimeNotificationService.setCallback(user.uid, (notifications) => {
        const safeNotifications = Array.isArray(notifications) ? notifications : [];
        setNotifications(safeNotifications);
        setUnreadCount(safeNotifications.filter(n => !n.read).length);
      });
      
      await realtimeNotificationService.markAsRead(user.uid, notificationId);
      console.log('🔔 Marked notification as read:', notificationId);
    } catch (err) {
      console.error('🔔 Error marking notification as read:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark notification as read');
    }
  }, [user?.uid, getUserRole]);

  // Mark all notifications as read (update cache)
  const markAllAsRead = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      await realtimeNotificationService.markAllAsRead(user.uid);
      console.log('🔔 Marked all notifications as read');
    } catch (err) {
      console.error('🔔 Error marking all notifications as read:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark all notifications as read');
    }
  }, [user?.uid]);

  // Delete notification (update cache)
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user?.uid) return;
    
    try {
      await realtimeNotificationService.deleteNotification(user.uid, notificationId);
      console.log('🔔 Deleted notification:', notificationId);
    } catch (err) {
      console.error('🔔 Error deleting notification:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete notification');
    }
  }, [user?.uid]);

  // Refresh notifications (force reload from cache + check missed)
  const refresh = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      const platform = typeof window !== 'undefined' ? 'web' : 'mobile';
      console.log(`🔔 [${platform}] REFRESH: Starting refresh for user:`, user.uid);
      const userRole = getUserRole();
      
      // Get current notification count before refresh
      const beforeCount = notifications.length;
      console.log(`🔔 [${platform}] REFRESH: Current notifications before refresh:`, beforeCount);
      
      // First check for missed notifications
      console.log(`🔔 [${platform}] REFRESH: Checking for missed notifications...`);
      await realtimeNotificationService.forceCheckMissedNotifications(user.uid, userRole);
      
      // Re-register callback to ensure it's working
      console.log(`🔔 [${platform}] REFRESH: Re-registering callback...`);
      realtimeNotificationService.setCallback(user.uid, (updatedNotifications) => {
        const safeNotifications = Array.isArray(updatedNotifications) ? updatedNotifications : [];
        console.log(`🔔 [${platform}] REFRESH: Callback triggered with ${safeNotifications.length} notifications`);
        setNotifications(safeNotifications);
        setUnreadCount(safeNotifications.filter(n => !n.read).length);
      });
      
      // Then force refresh the UI
      console.log(`🔔 [${platform}] REFRESH: Force refreshing UI...`);
      await realtimeNotificationService.forceRefresh(user.uid);
      
      // Wait a bit for state updates
      setTimeout(() => {
        console.log(`🔔 [${platform}] REFRESH: Notifications after refresh:`, notifications.length);
      }, 1000);
      
      console.log(`🔔 [${platform}] REFRESH: Successfully completed refresh`);
    } catch (err) {
      console.error('🔔 Error refreshing notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh notifications');
    }
  }, [user?.uid, getUserRole, notifications.length]);

  // Clear all notifications (clear cache)
  const clearNotifications = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      await realtimeNotificationService.clearNotifications(user.uid);
      console.log('🔔 Cleared all notifications');
    } catch (err) {
      console.error('🔔 Error clearing notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear notifications');
    }
  }, [user?.uid]);

  // Set up real-time listener
  useEffect(() => {
    console.log('🔔 useRealtimeNotifications useEffect triggered:', {
      hasUser: !!user,
      userId: user?.uid,
      userRole: user?.role,
      timestamp: new Date().toISOString(),
      platform: typeof window !== 'undefined' ? 'web' : 'mobile'
    });

    if (!user?.uid) {
      console.log('🔔 No user UID, clearing notifications');
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const userRole = getUserRole();
    userRoleRef.current = userRole;

    console.log('🔔 Setting up real-time notification listener for user:', user.uid, 'role:', userRole);
    console.log('🔔 User object details:', {
      uid: user.uid,
      role: user.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    });

    try {
      setLoading(true);
      setError(null);

      console.log('🔔 Starting real-time listeners for user:', user.uid, 'role:', userRole);
      
      // Set up callback for real-time updates BEFORE starting listeners
      realtimeNotificationService.setCallback(user.uid, (notifications) => {
        try {
          console.log('🔔 Received real-time notification update:', notifications.length, 'for user:', user.uid);
          console.log('🔔 Hook user details:', { uid: user.uid, role: user.role, email: user.email });
          
          // Ensure we have a valid notifications array
          const safeNotifications = Array.isArray(notifications) ? notifications : [];
          
          // Update state with proper validation
          setNotifications(prevNotifications => {
            // Only update if the notifications have actually changed
            if (JSON.stringify(prevNotifications) !== JSON.stringify(safeNotifications)) {
              console.log('🔔 Updating notifications state from', prevNotifications.length, 'to', safeNotifications.length);
              return safeNotifications;
            }
            return prevNotifications;
          });
          
          // Update unread count
          const newUnreadCount = safeNotifications.filter(n => !n.read).length;
          setUnreadCount(prevCount => {
            if (prevCount !== newUnreadCount) {
              console.log('🔔 Updating unread count from', prevCount, 'to', newUnreadCount);
              return newUnreadCount;
            }
            return prevCount;
          });
        } catch (callbackError) {
          console.error('🔔 Error in notification callback:', callbackError);
          setError(callbackError instanceof Error ? callbackError.message : 'Error processing notifications');
        }
      });

      // Start listening to real-time changes AFTER setting up callback
      const unsubscribe = realtimeNotificationService.startListening(user.uid, userRole);
      unsubscribeRef.current = unsubscribe;

      console.log('🔔 Real-time listeners started successfully');

    } catch (err) {
      console.error('🔔 Error setting up real-time notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to set up real-time notifications');
      setLoading(false);
    }

    return () => {
      console.log('🔔 Cleaning up real-time notification listener for user:', user.uid);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user?.uid, getUserRole]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Ensure we always return safe values
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const safeUnreadCount = typeof unreadCount === 'number' ? unreadCount : 0;

  return {
    notifications: safeNotifications,
    loading,
    error,
    unreadCount: safeUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
    clearNotifications,
  };
};