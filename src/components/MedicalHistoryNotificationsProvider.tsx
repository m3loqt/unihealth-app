import React from 'react';
import { useMedicalHistoryNotifications } from '../hooks/data/useMedicalHistoryNotifications';

export const MedicalHistoryNotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // This hook monitors medical history changes and creates notifications
  useMedicalHistoryNotifications();
  
  return <>{children}</>;
};
