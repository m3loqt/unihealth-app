import React, { createContext, useContext, ReactNode } from 'react';
import { useRealtimeNotifications } from '../hooks/data/useRealtimeNotifications';

interface RealtimeNotificationContextType {
  notifications: ReturnType<typeof useRealtimeNotifications>;
}

const RealtimeNotificationContext = createContext<RealtimeNotificationContextType | undefined>(undefined);

interface RealtimeNotificationProviderProps {
  children: ReactNode;
}

export const RealtimeNotificationProvider: React.FC<RealtimeNotificationProviderProps> = ({ children }) => {
  const notifications = useRealtimeNotifications();

  // Ensure notifications is always properly structured
  const safeNotifications = {
    ...notifications,
    notifications: Array.isArray(notifications.notifications) ? notifications.notifications : [],
    unreadCount: typeof notifications.unreadCount === 'number' ? notifications.unreadCount : 0,
  };

  // Debug logging
  console.log('🔔 RealtimeNotificationContext - Provider State:', {
    notificationsCount: safeNotifications.notifications.length,
    unreadCount: safeNotifications.unreadCount,
    loading: safeNotifications.loading,
    error: safeNotifications.error
  });

  return (
    <RealtimeNotificationContext.Provider value={{ notifications: safeNotifications }}>
      {children}
    </RealtimeNotificationContext.Provider>
  );
};

export const useRealtimeNotificationContext = (): RealtimeNotificationContextType => {
  const context = useContext(RealtimeNotificationContext);
  if (context === undefined) {
    throw new Error('useRealtimeNotificationContext must be used within a RealtimeNotificationProvider');
  }
  return context;
};
