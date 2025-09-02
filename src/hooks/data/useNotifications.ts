import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { databaseService } from '../../services/database/firebase';
import { useAuth } from '../auth/useAuth';

export interface Notification {
  id: string;
  userId: string;
  type: 'appointment' | 'referral' | 'prescription' | 'certificate';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  relatedId: string;
  priority: 'low' | 'medium' | 'high';
  expiresAt?: number;
  route?: string;
  routeParams?: Record<string, string>;
}

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
  handleNotificationPress: (notification: Notification, onModalClose?: () => void) => void;
}

// Utility function to process notification messages and replace clinicId with clinic names
const processNotificationMessage = async (message: string): Promise<string> => {
  // Check if the message contains a clinicId pattern (e.g., "clinic-123", "clinic_123", or similar)
  // This pattern looks for clinic IDs that might appear in existing notifications
  const clinicIdPatterns = [
    /(?:at|with|to)\s+(clinic-[a-zA-Z0-9-_]+)/gi,
    /(?:at|with|to)\s+(clinic_[a-zA-Z0-9-_]+)/gi,
    /(?:at|with|to)\s+([a-zA-Z0-9-_]+clinic)/gi,
    /(?:at|with|to)\s+([a-zA-Z0-9-_]+)/gi  // More general pattern for any ID-like string
  ];
  
  let processedMessage = message;
  let hasChanges = false;
  
  for (const pattern of clinicIdPatterns) {
    const matches = processedMessage.match(pattern);
    
    if (matches) {
      for (const match of matches) {
        const clinicId = match.replace(/(?:at|with|to)\s+/i, '').trim();
        
        // Skip if it's already a readable clinic name
        if (clinicId.toLowerCase().includes('clinic') && clinicId.length > 10) {
          continue;
        }
        
        // Skip if it's clearly not a clinic ID (contains spaces, is too short, etc.)
        if (clinicId.length < 3 || clinicId.includes(' ')) {
          continue;
        }
        
        try {
          const clinicData = await databaseService.getClinicById(clinicId);
          if (clinicData?.name) {
            // Replace the clinicId with the clinic name
            processedMessage = processedMessage.replace(clinicId, clinicData.name);
            hasChanges = true;
            console.log(`🔔 Replaced clinicId "${clinicId}" with clinic name "${clinicData.name}"`);
          }
        } catch (error) {
          console.error('Error fetching clinic name for ID:', clinicId, error);
          // Keep the original clinicId if we can't fetch the name
        }
      }
    }
  }
  
  return processedMessage;
};

export const useNotifications = (): UseNotificationsReturn => {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const pageSize = 20;
  const lastTimestamp = useRef<number | undefined>(undefined);
  const abortController = useRef<AbortController | null>(null);

  // Process notifications to replace clinicId with clinic names
  const processNotifications = useCallback(async (notifications: Notification[]): Promise<Notification[]> => {
    console.log('🔔 Processing notifications for clinic name replacement...');
    const processedNotifications = await Promise.all(
      notifications.map(async (notification) => {
        const originalMessage = notification.message;
        const processedMessage = await processNotificationMessage(notification.message);
        
        if (originalMessage !== processedMessage) {
          console.log('🔔 Notification message processed:');
          console.log('  Original:', originalMessage);
          console.log('  Processed:', processedMessage);
        }
        
        return {
          ...notification,
          message: processedMessage
        };
      })
    );
    console.log('🔔 Finished processing notifications');
    return processedNotifications;
  }, []);

  // Load notifications with real-time updates
  const loadNotifications = useCallback(async () => {
    if (!user?.uid) {
      console.log('🔔 No user ID available for notifications');
      return;
    }

    try {
      console.log('🔔 Loading notifications for user:', user.uid);
      setError(null);
      
      // Get initial notifications
      const initialNotifications = await databaseService.getNotificationsPaginated(user.uid, pageSize);
      console.log('🔔 Initial notifications loaded:', initialNotifications.length);
      
      // Process notifications to replace clinicId with clinic names
      const processedNotifications = await processNotifications(initialNotifications);
      setNotifications(processedNotifications);
      
      // Set last timestamp for pagination
      if (initialNotifications.length > 0) {
        lastTimestamp.current = initialNotifications[initialNotifications.length - 1].timestamp;
      }
      
      // Get unread count
      const count = await databaseService.getNotificationCount(user.uid, true);
      console.log('🔔 Unread count:', count);
      setUnreadCount(count);
      
      // Set up real-time listener
      console.log('🔔 Setting up real-time listener...');
      const unsubscribe = databaseService.onNotificationsChange(user.uid, async (updatedNotifications) => {
        console.log('🔔 Real-time update received:', updatedNotifications.length, 'notifications');
        
        // Process notifications to replace clinicId with clinic names
        const processedNotifications = await processNotifications(updatedNotifications);
        setNotifications(processedNotifications);
        
        // Update unread count
        const unread = updatedNotifications.filter(n => !n.read).length;
        console.log('🔔 Updated unread count:', unread);
        setUnreadCount(unread);
      });

      // Cleanup function
      return unsubscribe;
    } catch (err) {
      console.error('❌ Error loading notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, processNotifications]);

  // Load more notifications (pagination)
  const loadMore = useCallback(async () => {
    if (!user?.uid || loadingMore || !hasMore || !lastTimestamp.current) return;

    try {
      setLoadingMore(true);
      
      const moreNotifications = await databaseService.getNotificationsPaginated(
        user.uid, 
        pageSize, 
        lastTimestamp.current
      );
      
      if (moreNotifications.length > 0) {
        // Process notifications to replace clinicId with clinic names
        const processedNotifications = await processNotifications(moreNotifications);
        setNotifications(prev => [...prev, ...processedNotifications]);
        lastTimestamp.current = moreNotifications[moreNotifications.length - 1].timestamp;
        setHasMore(moreNotifications.length === pageSize);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more notifications');
    } finally {
      setLoadingMore(false);
    }
  }, [user?.uid, loadingMore, hasMore, processNotifications]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user?.uid) return;

    try {
      await databaseService.markNotificationsAsRead(user.uid, [notificationId]);
      
      // Update local state optimistically
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
      // Revert optimistic update on error
      await loadNotifications();
    }
  }, [user?.uid, loadNotifications]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length === 0) return;

      await databaseService.markNotificationsAsRead(user.uid, unreadIds);
      
      // Update local state optimistically
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
      
      // Update unread count
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      // Revert optimistic update on error
      await loadNotifications();
    }
  }, [user?.uid, notifications, loadNotifications]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user?.uid) return;

    try {
      // Remove from local state optimistically
      const notification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Update unread count if notification was unread
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      // Delete from database
      await databaseService.deleteDocument(`notifications/${user.uid}/${notificationId}`);
    } catch (err) {
      console.error('Error deleting notification:', err);
      // Revert optimistic update on error
      await loadNotifications();
    }
  }, [user?.uid, notifications, loadNotifications]);

  // Refresh notifications
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    lastTimestamp.current = undefined;
    setHasMore(true);
    await loadNotifications();
  }, [loadNotifications]);

  // Retry loading
  const retry = useCallback(async () => {
    setError(null);
    await loadNotifications();
  }, [loadNotifications]);

  // Initialize notifications
  useEffect(() => {
    console.log('🔔 useNotifications effect triggered, user:', user?.uid);
    if (!user?.uid) {
      console.log('🔔 No user ID, skipping initialization');
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const initialize = async () => {
      try {
        console.log('🔔 Initializing notifications for user:', user.uid);
        unsubscribe = await loadNotifications();
        console.log('🔔 Notifications initialized successfully');
      } catch (err) {
        console.error('❌ Error initializing notifications:', err);
      }
    };

    initialize();

    // Cleanup function
    return () => {
      console.log('🔔 Cleaning up notifications listener');
      if (unsubscribe) {
        unsubscribe();
      }
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [user?.uid, loadNotifications]);

  // Cleanup old notifications periodically
  useEffect(() => {
    if (!user?.uid) return;

    const cleanup = async () => {
      try {
        await databaseService.cleanupOldNotifications(user.uid, 30);
      } catch (err) {
        console.error('Error cleaning up old notifications:', err);
      }
    };

    // Cleanup every 24 hours
    const interval = setInterval(cleanup, 24 * 60 * 60 * 1000);
    
    // Initial cleanup
    cleanup();

    return () => clearInterval(interval);
  }, [user?.uid]);

  // Handle notification press - navigate to appropriate route
  const handleNotificationPress = useCallback((notification: Notification, onModalClose?: () => void) => {
    console.log('🔔 handleNotificationPress called:', {
      notificationId: notification.id,
      notificationType: notification.type,
      hasRoute: !!notification.route,
      hasRelatedId: !!notification.relatedId,
      hasOnModalClose: !!onModalClose
    });
    
    try {
      let routeToNavigate = notification.route;
      let routeParams = notification.routeParams;

      // Determine if user is patient or specialist based on current route
      const currentPath = pathname || '';

      // For appointment notifications, always route to visit-overview regardless of existing route
      if (notification.type === 'appointment' && notification.relatedId) {
        if (currentPath.includes('(patient)')) {
          routeToNavigate = '/(patient)/visit-overview';
        } else if (currentPath.includes('(specialist)')) {
          routeToNavigate = '/visit-overview';
        } else {
          // Default to specialist route if we can't determine
          routeToNavigate = '/visit-overview';
        }
        routeParams = { id: notification.relatedId };
      }
      // For other notification types, use fallback logic if no route is set
      else if (!routeToNavigate && notification.relatedId) {
        switch (notification.type) {
          case 'referral':
            if (currentPath.includes('(patient)')) {
              routeToNavigate = '/(patient)/referral-details';
            } else if (currentPath.includes('(specialist)')) {
              routeToNavigate = '/(specialist)/referral-details';
            } else {
              // Default to specialist route if we can't determine
              routeToNavigate = '/(specialist)/referral-details';
            }
            routeParams = { id: notification.relatedId };
            break;
          case 'prescription':
            // For prescriptions, route to prescription details
            if (currentPath.includes('(patient)')) {
              routeToNavigate = '/(patient)/prescription-details';
            } else {
              routeToNavigate = '/(specialist)/prescription-details';
            }
            routeParams = { id: notification.relatedId };
            break;
          case 'certificate':
            // For certificates, route to certificate details
            if (currentPath.includes('(patient)')) {
              routeToNavigate = '/(patient)/certificate-details';
            } else {
              routeToNavigate = '/(specialist)/certificate-details';
            }
            routeParams = { id: notification.relatedId };
            break;
        }
      }

      if (routeToNavigate) {
        console.log('🔔 Navigating to route:', routeToNavigate, 'with params:', routeParams);
        
        // Navigate to the route first
        if (routeParams && Object.keys(routeParams).length > 0) {
          // Navigate with parameters
          const queryString = new URLSearchParams(routeParams).toString();
          console.log('🔔 Navigating with query string:', `${routeToNavigate}?${queryString}`);
          router.push(`${routeToNavigate}?${queryString}` as any);
        } else {
          // Navigate without parameters
          console.log('🔔 Navigating without params:', routeToNavigate);
          router.push(routeToNavigate as any);
        }
        
        // Close modal after navigation starts
        if (onModalClose) {
          console.log('🔔 Closing modal via callback');
          // Use setTimeout to ensure the navigation starts before closing the modal
          setTimeout(() => {
            onModalClose();
          }, 100);
        } else {
          console.log('🔔 No modal close callback provided');
        }
        
        // Mark notification as read when navigated
        if (!notification.read) {
          console.log('🔔 Marking notification as read:', notification.id);
          markAsRead(notification.id);
        }
      } else {
        console.warn('🔔 No route available for notification:', notification);
      }
    } catch (error) {
      console.error('Error navigating from notification:', error);
    }
  }, [router, markAsRead]);

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
    handleNotificationPress,
  };
};
