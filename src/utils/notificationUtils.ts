import { RealtimeNotification } from '../services/realtimeNotificationService';

/**
 * Safely get notifications array, ensuring it's always an array
 */
export const getSafeNotifications = (notifications: any): RealtimeNotification[] => {
  if (Array.isArray(notifications)) {
    return notifications;
  }
  
  if (notifications && typeof notifications === 'object' && Array.isArray(notifications.notifications)) {
    return notifications.notifications;
  }
  
  return [];
};

/**
 * Safely get unread count, ensuring it's always a number
 */
export const getSafeUnreadCount = (unreadCount: any): number => {
  if (typeof unreadCount === 'number' && !isNaN(unreadCount)) {
    return unreadCount;
  }
  
  if (unreadCount && typeof unreadCount === 'object' && typeof unreadCount.unreadCount === 'number') {
    return unreadCount.unreadCount;
  }
  
  return 0;
};

/**
 * Check if notifications object is valid
 */
export const isValidNotifications = (notifications: any): boolean => {
  return Array.isArray(notifications) || 
         (notifications && typeof notifications === 'object' && Array.isArray(notifications.notifications));
};

/**
 * Safely map over notifications
 */
export const safeMapNotifications = <T>(
  notifications: any, 
  mapper: (notification: RealtimeNotification, index: number) => T
): T[] => {
  const safeNotifications = getSafeNotifications(notifications);
  return safeNotifications.map(mapper);
};
