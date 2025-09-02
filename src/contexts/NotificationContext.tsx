import React, { createContext, useContext, ReactNode } from 'react';
import { useNotifications } from '../hooks/data/useNotifications';

interface NotificationContextType {
  notifications: ReturnType<typeof useNotifications>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const notifications = useNotifications();

  return (
    <NotificationContext.Provider value={{ notifications }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};
