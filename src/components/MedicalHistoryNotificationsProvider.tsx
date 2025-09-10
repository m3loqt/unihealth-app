import React from 'react';
import { useMedicalHistoryNotifications } from '../hooks/data/useMedicalHistoryNotifications';

export const MedicalHistoryNotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Medical history notifications disabled - using real-time listeners instead
  // useMedicalHistoryNotifications();
  
  return <>{children}</>;
};
