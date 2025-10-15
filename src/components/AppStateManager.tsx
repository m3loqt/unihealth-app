import React from 'react';
import { useAppState } from '../hooks/useAppState';

/**
 * Component that manages app state changes for online status
 * Must be placed inside AuthProvider to access user context
 */
export const AppStateManager: React.FC = () => {
  useAppState();
  return null; // This component doesn't render anything
};
