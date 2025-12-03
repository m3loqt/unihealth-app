import { database } from '../config/firebase';
import { ref, set, get, onValue, onDisconnect, serverTimestamp, remove } from 'firebase/database';

export interface UserOnlineStatus {
  online: boolean;
  lastSeen: number;
  status?: 'online' | 'away' | 'busy' | 'offline';
  customStatus?: string;
}

export interface PresenceData {
  online: boolean;
  lastSeen: number;
  status: 'online' | 'away' | 'busy' | 'offline';
  customStatus?: string;
  // Firebase presence fields
  '.sv': string; // Server timestamp placeholder
}

class OnlineStatusService {
  private statusRefs: Map<string, any> = new Map();
  private presenceRefs: Map<string, any> = new Map();
  private heartbeatIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private statusListeners: Map<string, () => void> = new Map();
  
  // Configuration
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly OFFLINE_TIMEOUT = 60000; // 1 minute
  private readonly AWAY_TIMEOUT = 300000; // 5 minutes

  /**
   * Initialize online status for a user
   * This should be called when user logs in
   */
  async initializeUserStatus(userId: string): Promise<void> {
    try {
      console.log('🟢 Initializing online status for user:', userId);
      
      // Set up Firebase presence
      await this.setupFirebasePresence(userId);
      console.log('🟢 Firebase presence set up for user:', userId);
      
      // Set user as online
      await this.setUserOnline(userId);
      console.log('🟢 User set as online:', userId);
      
      // Start heartbeat
      this.startHeartbeat(userId);
      console.log('🟢 Heartbeat started for user:', userId);
      
      console.log(' Online status initialized for user:', userId);
    } catch (error) {
      console.error(' Error initializing online status:', error);
      throw error;
    }
  }

  /**
   * Set up Firebase presence with automatic cleanup
   */
  private async setupFirebasePresence(userId: string): Promise<void> {
    const presenceRef = ref(database, `presence/${userId}`);
    const statusRef = ref(database, `status/${userId}`);
    
    // Store references for cleanup
    this.presenceRefs.set(userId, presenceRef);
    this.statusRefs.set(userId, statusRef);
    
    // Set initial presence data
    const presenceData: PresenceData = {
      online: true,
      lastSeen: serverTimestamp(),
      status: 'online'
    };
    
    await set(presenceRef, presenceData);
    
    // Set up disconnect handler to mark user as offline
    const disconnectRef = onDisconnect(presenceRef);
    await disconnectRef.set({
      online: false,
      lastSeen: serverTimestamp(),
      status: 'offline'
    });
    
    // Also set up disconnect for status
    const statusDisconnectRef = onDisconnect(statusRef);
    await statusDisconnectRef.set({
      online: false,
      lastSeen: serverTimestamp(),
      status: 'offline'
    });
  }

  /**
   * Set user as online
   */
  async setUserOnline(userId: string, customStatus?: string): Promise<void> {
    try {
      const statusData = {
        online: true,
        lastSeen: serverTimestamp(),
        status: 'online',
        ...(customStatus && { customStatus })
      };
      
      const statusRef = ref(database, `status/${userId}`);
      const presenceRef = ref(database, `presence/${userId}`);
      
      await Promise.all([
        set(statusRef, statusData),
        set(presenceRef, statusData)
      ]);
      
      console.log('🟢 User set as online:', userId);
    } catch (error) {
      console.error(' Error setting user online:', error);
    }
  }

  /**
   * Set user as offline
   */
  async setUserOffline(userId: string): Promise<void> {
    try {
      const statusData = {
        online: false,
        lastSeen: serverTimestamp(),
        status: 'offline'
      };
      
      const statusRef = ref(database, `status/${userId}`);
      const presenceRef = ref(database, `presence/${userId}`);
      
      await Promise.all([
        set(statusRef, statusData),
        set(presenceRef, statusData)
      ]);
      
      console.log('🔴 User set as offline:', userId);
    } catch (error) {
      console.error(' Error setting user offline:', error);
    }
  }

  /**
   * Set user status (online, away, busy)
   */
  async setUserStatus(userId: string, status: 'online' | 'away' | 'busy', customStatus?: string): Promise<void> {
    try {
      const statusData = {
        online: status === 'online',
        lastSeen: serverTimestamp(),
        status,
        ...(customStatus && { customStatus })
      };
      
      const statusRef = ref(database, `status/${userId}`);
      const presenceRef = ref(database, `presence/${userId}`);
      
      await Promise.all([
        set(statusRef, statusData),
        set(presenceRef, statusData)
      ]);
      
      console.log(` User status set to ${status}:`, userId);
    } catch (error) {
      console.error(' Error setting user status:', error);
    }
  }

  /**
   * Start heartbeat to maintain online status
   */
  private startHeartbeat(userId: string): void {
    // Clear existing heartbeat if any
    this.stopHeartbeat(userId);
    
    const interval = setInterval(async () => {
      try {
        await this.updateLastSeen(userId);
      } catch (error) {
        console.error(' Heartbeat error:', error);
      }
    }, this.HEARTBEAT_INTERVAL);
    
    this.heartbeatIntervals.set(userId, interval);
    console.log('💓 Heartbeat started for user:', userId);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(userId: string): void {
    const interval = this.heartbeatIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(userId);
      console.log('💔 Heartbeat stopped for user:', userId);
    }
  }

  /**
   * Update last seen timestamp
   */
  private async updateLastSeen(userId: string): Promise<void> {
    try {
      const statusRef = ref(database, `status/${userId}`);
      const presenceRef = ref(database, `presence/${userId}`);
      
      const updateData = {
        online: true,
        lastSeen: serverTimestamp(),
        status: 'online'
      };
      
      await Promise.all([
        set(statusRef, updateData),
        set(presenceRef, updateData)
      ]);
    } catch (error) {
      console.error(' Error updating last seen:', error);
    }
  }

  /**
   * Listen to user's online status
   */
  listenToUserStatus(
    userId: string,
    callback: (status: UserOnlineStatus | null) => void
  ): () => void {
    const statusRef = ref(database, `status/${userId}`);
    
    const unsubscribe = onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        // Handle Firebase server timestamp
        let lastSeen = data.lastSeen || 0;
        if (lastSeen && typeof lastSeen === 'object' && lastSeen['.sv']) {
          // Convert Firebase server timestamp to milliseconds
          lastSeen = Date.now();
        }
        
        callback({
          online: data.online || false,
          lastSeen: lastSeen,
          status: data.status || 'offline',
          customStatus: data.customStatus
        });
      } else {
        callback(null);
      }
    }, (error) => {
      console.error(' Error listening to user status:', error);
      callback(null);
    });
    
    // Store listener for cleanup
    this.statusListeners.set(userId, unsubscribe);
    
    return unsubscribe;
  }

  /**
   * Listen to multiple users' online status
   */
  listenToMultipleUsersStatus(
    userIds: string[],
    callback: (statuses: { [userId: string]: UserOnlineStatus | null }) => void
  ): () => void {
    const unsubscribes: (() => void)[] = [];
    const statuses: { [userId: string]: UserOnlineStatus | null } = {};
    
    userIds.forEach(userId => {
      const unsubscribe = this.listenToUserStatus(userId, (status) => {
        statuses[userId] = status;
        callback({ ...statuses });
      });
      unsubscribes.push(unsubscribe);
    });
    
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }

  /**
   * Get user's current online status
   */
  async getUserStatus(userId: string): Promise<UserOnlineStatus | null> {
    try {
      console.log(' Getting status for user:', userId);
      const statusRef = ref(database, `status/${userId}`);
      const snapshot = await get(statusRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log(' Status data found:', data);
        
        // Handle Firebase server timestamp
        let lastSeen = data.lastSeen || 0;
        if (lastSeen && typeof lastSeen === 'object' && lastSeen['.sv']) {
          // Convert Firebase server timestamp to milliseconds
          lastSeen = Date.now();
        }
        
        return {
          online: data.online || false,
          lastSeen: lastSeen,
          status: data.status || 'offline',
          customStatus: data.customStatus
        };
      }
      
      console.log(' No status data found for user:', userId);
      return null;
    } catch (error) {
      console.error(' Error getting user status:', error);
      return null;
    }
  }

  /**
   * Check if user is currently online
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const status = await this.getUserStatus(userId);
    return status?.online || false;
  }

  /**
   * Get formatted last seen time
   */
  getFormattedLastSeen(lastSeen: number | any): string {
    // Handle Firebase server timestamp objects
    if (lastSeen && typeof lastSeen === 'object' && lastSeen['.sv']) {
      return 'Just now';
    }
    
    // Handle invalid timestamps
    if (!lastSeen || lastSeen <= 0 || isNaN(lastSeen)) {
      return 'Unknown';
    }
    
    const now = Date.now();
    const diff = now - lastSeen;
    
    // Handle negative differences (future timestamps)
    if (diff < 0) {
      return 'Just now';
    }
    
    if (diff < 60000) { // Less than 1 minute
      return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
      const minutes = Math.floor(diff / 60000);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diff < 86400000) { // Less than 1 day
      const hours = Math.floor(diff / 3600000);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diff / 86400000);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  }

  /**
   * Clean up user status (call when user logs out)
   */
  async cleanupUserStatus(userId: string): Promise<void> {
    try {
      console.log('🧹 Cleaning up online status for user:', userId);
      
      // Stop heartbeat
      this.stopHeartbeat(userId);
      
      // Remove listeners
      const statusListener = this.statusListeners.get(userId);
      if (statusListener) {
        statusListener();
        this.statusListeners.delete(userId);
      }
      
      // Set user as offline
      await this.setUserOffline(userId);
      
      // Clean up references
      this.statusRefs.delete(userId);
      this.presenceRefs.delete(userId);
      
      console.log(' Online status cleaned up for user:', userId);
    } catch (error) {
      console.error(' Error cleaning up user status:', error);
    }
  }

  /**
   * Clean up all status tracking (call when app is closing)
   */
  async cleanupAllStatus(): Promise<void> {
    try {
      console.log('🧹 Cleaning up all online status...');
      
      // Stop all heartbeats
      this.heartbeatIntervals.forEach((interval, userId) => {
        clearInterval(interval);
      });
      this.heartbeatIntervals.clear();
      
      // Remove all listeners
      this.statusListeners.forEach((unsubscribe) => {
        unsubscribe();
      });
      this.statusListeners.clear();
      
      // Clear references
      this.statusRefs.clear();
      this.presenceRefs.clear();
      
      console.log(' All online status cleaned up');
    } catch (error) {
      console.error(' Error cleaning up all status:', error);
    }
  }
}

export const onlineStatusService = new OnlineStatusService();
