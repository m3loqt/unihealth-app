import { useState, useEffect, useCallback, useRef } from 'react';
import { onlineStatusService, UserOnlineStatus } from '../services/onlineStatusService';
import { useAuth } from './auth/useAuth';

export interface UseOnlineStatusReturn {
  isOnline: boolean;
  status: 'online' | 'away' | 'busy' | 'offline';
  customStatus?: string;
  lastSeen: number;
  formattedLastSeen: string;
  setStatus: (status: 'online' | 'away' | 'busy', customStatus?: string) => Promise<void>;
  setCustomStatus: (customStatus: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

/**
 * Hook for managing current user's online status
 */
export const useOnlineStatus = (): UseOnlineStatusReturn => {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [status, setStatus] = useState<'online' | 'away' | 'busy' | 'offline'>('offline');
  const [customStatus, setCustomStatus] = useState<string | undefined>();
  const [lastSeen, setLastSeen] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const formattedLastSeen = onlineStatusService.getFormattedLastSeen(lastSeen);

  // Initialize online status when user logs in
  useEffect(() => {
    if (user?.uid && !initialized.current) {
      const initializeStatus = async () => {
        try {
          setLoading(true);
          setError(null);
          
          await onlineStatusService.initializeUserStatus(user.uid);
          initialized.current = true;
          
          // Listen to own status changes
          const unsubscribe = onlineStatusService.listenToUserStatus(user.uid, (statusData) => {
            if (statusData) {
              setIsOnline(statusData.online);
              setStatus(statusData.status || 'offline');
              setCustomStatus(statusData.customStatus);
              setLastSeen(statusData.lastSeen);
            }
          });
          
          setLoading(false);
          
          // Cleanup on unmount
          return unsubscribe;
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to initialize online status');
          setLoading(false);
        }
      };
      
      initializeStatus();
    } else if (!user?.uid && initialized.current) {
      // User logged out, cleanup
      onlineStatusService.cleanupUserStatus(user?.uid || '');
      initialized.current = false;
      setIsOnline(false);
      setStatus('offline');
      setCustomStatus(undefined);
      setLastSeen(0);
      setLoading(false);
    }
  }, [user?.uid]);

  const setUserStatus = useCallback(async (newStatus: 'online' | 'away' | 'busy', newCustomStatus?: string) => {
    if (!user?.uid) return;
    
    try {
      setError(null);
      await onlineStatusService.setUserStatus(user.uid, newStatus, newCustomStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  }, [user?.uid]);

  const setUserCustomStatus = useCallback(async (newCustomStatus: string) => {
    if (!user?.uid) return;
    
    try {
      setError(null);
      const currentStatus = status === 'offline' ? 'online' : status;
      await onlineStatusService.setUserStatus(user.uid, currentStatus, newCustomStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update custom status');
    }
  }, [user?.uid, status]);

  return {
    isOnline,
    status,
    customStatus,
    lastSeen,
    formattedLastSeen,
    setStatus: setUserStatus,
    setCustomStatus: setUserCustomStatus,
    loading,
    error
  };
};

export interface UseUserOnlineStatusReturn {
  status: UserOnlineStatus | null;
  isOnline: boolean;
  formattedLastSeen: string;
  loading: boolean;
  error: string | null;
}

/**
 * Hook for checking another user's online status
 */
export const useUserOnlineStatus = (userId: string): UseUserOnlineStatusReturn => {
  const [status, setStatus] = useState<UserOnlineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Get initial status
    onlineStatusService.getUserStatus(userId)
      .then((initialStatus) => {
        setStatus(initialStatus);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to get user status');
        setLoading(false);
      });

    // Listen to status changes
    const unsubscribe = onlineStatusService.listenToUserStatus(userId, (statusData) => {
      setStatus(statusData);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  const isOnline = status?.online || false;
  const formattedLastSeen = status ? onlineStatusService.getFormattedLastSeen(status.lastSeen) : '';

  return {
    status,
    isOnline,
    formattedLastSeen,
    loading,
    error
  };
};

export interface UseMultipleUsersOnlineStatusReturn {
  statuses: { [userId: string]: UserOnlineStatus | null };
  loading: boolean;
  error: string | null;
}

/**
 * Hook for checking multiple users' online status
 */
export const useMultipleUsersOnlineStatus = (userIds: string[]): UseMultipleUsersOnlineStatusReturn => {
  const [statuses, setStatuses] = useState<{ [userId: string]: UserOnlineStatus | null }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userIds.length) {
      setStatuses({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Listen to status changes for all users
    const unsubscribe = onlineStatusService.listenToMultipleUsersStatus(userIds, (newStatuses) => {
      setStatuses(newStatuses);
      setLoading(false);
    });

    return unsubscribe;
  }, [userIds.join(',')]); // Use join to create a stable dependency

  return {
    statuses,
    loading,
    error
  };
};
