import { ref, onValue, off, DataSnapshot, get } from 'firebase/database';
import { database } from '../config/firebase';
import { Appointment, Referral } from './database/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { databaseService } from './database/firebase';
import { getCurrentLocalTimestamp } from '../utils/date';

// Simple interface for displaying notifications in UI
export interface RealtimeNotification {
  id: string;
  type: 'appointment' | 'referral' | 'professional_fee';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
  relatedId: string;
  status: string;
}

class RealtimeNotificationService {
  private appointmentListeners: Map<string, () => void> = new Map();
  private referralListeners: Map<string, () => void> = new Map();
  private doctorListeners: Map<string, () => void> = new Map();
  private callbacks: Map<string, (notifications: RealtimeNotification[]) => void> = new Map();
  private cachedNotifications: Map<string, RealtimeNotification[]> = new Map();
  private previousAppointmentStates: Map<string, Map<string, any>> = new Map();
  private previousReferralStates: Map<string, Map<string, any>> = new Map();
  private previousDoctorStates: Map<string, Map<string, any>> = new Map();
  private notificationDebounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private processedNotifications: Map<string, Set<string>> = new Map();
  private isProcessingNotifications: Map<string, boolean> = new Map();
  private globalNotificationCache: Map<string, { timestamp: number; userId: string }> = new Map();
  private notifiedReferralStatuses: Map<string, Map<string, Set<string>>> = new Map(); // userId -> referralId -> Set<status>
  private callbackDebounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map(); // Debounce UI callback calls

  /**
   * Start listening to appointment and referral changes for a specific user
   */
  startListening(userId: string, userRole: 'patient' | 'specialist'): () => void {
    console.log('🔔 ===== STARTING REAL-TIME LISTENERS =====');
    console.log('🔔 User:', userId, 'Role:', userRole);
    console.log('🔔 Timestamp:', getCurrentLocalTimestamp());
    console.log('🔔 Platform:', typeof window !== 'undefined' ? 'web' : 'mobile');
    console.log('🔔 Firebase database reference:', database);
    
    // Check if listeners already exist for this user
    if (this.appointmentListeners.has(userId)) {
      console.log('🔔 Listeners already exist for user:', userId, '- returning existing cleanup function');
      // Return a no-op cleanup function since listeners already exist
      return () => {
        console.log('🔔 No-op cleanup for user:', userId, '- listeners already managed');
      };
    }
    
    // Load existing cached notifications first
    this.loadCachedNotifications(userId).then(notifications => {
      console.log('🔔 Loaded cached notifications:', notifications.length);
      const callback = this.callbacks.get(userId);
      if (callback) {
        callback(notifications);
      }
    });
    
    // Check for missed notifications first (when user was offline)
    console.log('🔔 Calling checkMissedNotifications on login...');
    
    // Clear status tracking to ensure we catch all missed notifications on login
    console.log('🔔 LOGIN: Clearing status tracking to allow missed notifications');
    this.notifiedReferralStatuses.delete(userId);
    
    this.checkMissedNotifications(userId, userRole);
    
    // Start appointment listener
    const appointmentUnsubscribe = this.startAppointmentListener(userId, userRole);
    this.appointmentListeners.set(userId, appointmentUnsubscribe);
    
    // Start referral listener
    const referralUnsubscribe = this.startReferralListener(userId, userRole);
    this.referralListeners.set(userId, referralUnsubscribe);
    
    // Start doctor listener (only for specialists)
    let doctorUnsubscribe: (() => void) | null = null;
    if (userRole === 'specialist') {
      doctorUnsubscribe = this.startDoctorListener(userId);
      this.doctorListeners.set(userId, doctorUnsubscribe);
    }
    
    // Call debug method to expose global functions
    this.debugNotifications(userId, userRole);
    
    // Return cleanup function
    return () => {
      console.log('🔔 Cleaning up listeners for user:', userId);
      appointmentUnsubscribe();
      referralUnsubscribe();
      if (doctorUnsubscribe) {
        doctorUnsubscribe();
      }
      
      // Clear debounce timer for this user
      const userTimer = this.notificationDebounceTimers.get(userId);
      if (userTimer) {
        clearTimeout(userTimer);
        this.notificationDebounceTimers.delete(userId);
      }
      
      this.appointmentListeners.delete(userId);
      this.referralListeners.delete(userId);
      this.doctorListeners.delete(userId);
      this.callbacks.delete(userId);
      this.processedNotifications.delete(userId);
      this.isProcessingNotifications.delete(userId);
    };
  }

  /**
   * Check for missed notifications when user logs in (was offline)
   */
  private async checkMissedNotifications(userId: string, userRole: 'patient' | 'specialist'): Promise<void> {
    try {
      console.log('🔔 ===== CHECKING MISSED NOTIFICATIONS =====');
      console.log('🔔 User:', userId, 'Role:', userRole);
      
      // Get the user's lastLogin timestamp from database
      let checkFromTime: number;
      try {
        const lastLogin = await databaseService.getLastLogin(userId, userRole);
        if (lastLogin) {
          checkFromTime = new Date(lastLogin).getTime();
          console.log('🔔 Last login time from database:', new Date(lastLogin).toISOString());
        } else {
          // Fallback to 7 days ago if no lastLogin found (show more past notifications)
          checkFromTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
          console.log('🔔 No lastLogin found, using 7 days ago as fallback');
        }
      } catch (error) {
        console.warn('🔔 Error getting lastLogin, using 7 days ago as fallback:', error);
        checkFromTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
      }
      
      console.log('🔔 Checking notifications from:', new Date(checkFromTime).toISOString());
      console.log('🔔 Current time:', getCurrentLocalTimestamp());
      console.log('🔔 Time difference (hours):', (Date.now() - checkFromTime) / (1000 * 60 * 60));
      
      // Check appointments
      console.log('🔔 Checking missed appointments...');
      await this.checkMissedAppointments(userId, userRole, checkFromTime);
      
      // Check referrals
      console.log('🔔 Checking missed referrals...');
      await this.checkMissedReferrals(userId, userRole, checkFromTime);
      
      // Check doctors (only for specialists)
      if (userRole === 'specialist') {
        console.log('🔔 Checking missed doctor updates...');
        await this.checkMissedDoctors(userId, checkFromTime);
      }
      
      console.log('🔔 ===== FINISHED CHECKING MISSED NOTIFICATIONS =====');
      
    } catch (error) {
      console.error('🔔 Error checking missed notifications:', error);
    }
  }

  /**
   * Check for missed appointment notifications
   */
  private async checkMissedAppointments(userId: string, userRole: 'patient' | 'specialist', fromTime: number): Promise<void> {
    try {
      console.log('🔔 --- CHECKING MISSED APPOINTMENTS ---');
      console.log('🔔 User:', userId, 'Role:', userRole, 'From time:', new Date(fromTime).toISOString());
      
      const appointmentsRef = ref(database, 'appointments');
      const snapshot = await get(appointmentsRef);
      
      if (!snapshot.exists()) {
        console.log('🔔 No appointments found in database');
        return;
      }
      
      const appointments = snapshot.val();
      console.log('🔔 Found', Object.keys(appointments).length, 'appointments in database');
      
      const newNotifications: RealtimeNotification[] = [];
      let relevantAppointments = 0;
      let recentAppointments = 0;
      
      // Get cached notifications to avoid duplicates
      const cachedNotifications = await this.loadCachedNotifications(userId);
      const existingNotificationIds = new Set(cachedNotifications.map(n => n.relatedId));
      
      // Process appointments and enrich with patient/doctor names
      const appointmentPromises = Object.values(appointments).map(async (appointment: any) => {
        if (!appointment) return null;
        
        // Check if appointment was created or updated after lastLogin
        const createdAt = new Date(appointment.createdAt).getTime();
        const lastUpdatedTime = new Date(appointment.lastUpdated).getTime();
        
        console.log('🔔 Processing appointment:', {
          id: appointment.id,
          status: appointment.status,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime,
          createdAt: new Date(appointment.createdAt).toISOString(),
          lastUpdated: new Date(appointment.lastUpdated).toISOString(),
          fromTime: new Date(fromTime).toISOString(),
          isRecentCreation: createdAt >= fromTime,
          isRecentUpdate: lastUpdatedTime >= fromTime
        });
        
        // Skip if both creation and last update are before lastLogin
        if (createdAt < fromTime && lastUpdatedTime < fromTime) {
          console.log('🔔 Skipping old appointment:', appointment.id, 'created:', new Date(createdAt).toISOString(), 'updated:', new Date(lastUpdatedTime).toISOString(), 'before lastLogin:', new Date(fromTime).toISOString());
          return null;
        }
        
        recentAppointments++;
        console.log('🔔 Checking recent appointment:', appointment.id, 'status:', appointment.status, 'updated:', new Date(appointment.lastUpdated).toISOString());
        
        // Check if this appointment is relevant to the user
        const isRelevant = userRole === 'patient' 
          ? appointment.patientId === userId
          : appointment.doctorId === userId;
          
        if (!isRelevant) {
          console.log('🔔 Appointment not relevant to user:', appointment.id, 'patientId:', appointment.patientId, 'doctorId:', appointment.doctorId);
          return null;
        }
        
        relevantAppointments++;
        console.log('🔔 Found relevant appointment:', appointment.id, 'status:', appointment.status);
        
        // Check if we already have a notification for this appointment
        if (existingNotificationIds.has(appointment.id)) {
          console.log('🔔 Notification already exists for appointment:', appointment.id);
          return null;
        }
        
        // Enrich appointment data with patient and doctor names
        const enrichedAppointment = await this.enrichAppointmentData(appointment);
        
        // Check if we should create a notification for this status
        const shouldNotify = this.shouldCreateAppointmentNotification(enrichedAppointment, userRole);
        console.log('🔔 Should notify for appointment:', appointment.id, 'status:', appointment.status, 'shouldNotify:', shouldNotify);
        
        if (!shouldNotify) return null;
        
        // Create notification
        const notification = this.createAppointmentNotification(userId, userRole, enrichedAppointment);
        if (notification) {
          console.log('🔔 Created notification for appointment:', appointment.id);
          console.log('🔔 Notification details:', {
            id: notification.id,
            title: notification.title,
            type: notification.type,
            status: notification.status
          });
          return notification;
        } else {
          console.log('🔔 Failed to create notification for appointment:', appointment.id);
        }
        
        return null;
      });

      // Wait for all appointments to be processed
      const results = await Promise.all(appointmentPromises);
      newNotifications.push(...results.filter(notification => notification !== null));
      
      console.log('🔔 Appointment check summary:');
      console.log('  - Total appointments:', Object.keys(appointments).length);
      console.log('  - Recent appointments:', recentAppointments);
      console.log('  - Relevant appointments:', relevantAppointments);
      console.log('  - New notifications:', newNotifications.length);
      
      if (newNotifications.length > 0) {
        console.log('🔔 Found', newNotifications.length, 'missed appointment notifications');
        await this.addNotifications(userId, newNotifications);
      }
      
    } catch (error) {
      console.error('🔔 Error checking missed appointments:', error);
    }
  }

  /**
   * Check for missed referral notifications
   */
  private async checkMissedReferrals(userId: string, userRole: 'patient' | 'specialist', fromTime: number): Promise<void> {
    try {
      console.log('🔔 Checking missed referrals for user:', userId, 'role:', userRole);
      
      const referralsRef = ref(database, 'referrals');
      const snapshot = await get(referralsRef);
      
      if (!snapshot.exists()) {
        console.log('🔔 No referrals found in database');
        return;
      }
      
        const referrals = snapshot.val();
        console.log('🔔 Found', Object.keys(referrals).length, 'referrals in database');
        console.log('🔔 Sample referral data:', Object.values(referrals).slice(0, 2));
        console.log('🔔 Current user ID:', userId, 'Role:', userRole);
      
      const newNotifications: RealtimeNotification[] = [];
      let relevantReferrals = 0;
      let recentReferrals = 0;
      
      // Get cached notifications to avoid duplicates
      const cachedNotifications = await this.loadCachedNotifications(userId);
      const existingNotificationIds = new Set(cachedNotifications.map(n => n.relatedId));
      
      // Process referrals in parallel
      const notificationPromises = Object.keys(referrals).map(async (referralId) => {
        const referral = referrals[referralId];
        if (!referral) return null;
        
        // Ensure referral has an ID
        referral.id = referralId;
        
        // Check if referral was created or updated after lastLogin
        const createdAt = new Date(referral.createdAt || referral.referralTimestamp).getTime();
        const lastUpdatedTime = new Date(referral.lastUpdated).getTime();
        
        console.log('🔔 Processing referral:', {
          id: referral.id,
          status: referral.status,
          appointmentDate: referral.appointmentDate,
          appointmentTime: referral.appointmentTime,
          createdAt: new Date(referral.createdAt || referral.referralTimestamp).toISOString(),
          lastUpdated: new Date(referral.lastUpdated).toISOString(),
          fromTime: new Date(fromTime).toISOString(),
          isRecentCreation: createdAt >= fromTime,
          isRecentUpdate: lastUpdatedTime >= fromTime
        });
        
        // More flexible time window: Include referrals from the last 24 hours regardless of login time
        const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
        const isWithin24Hours = createdAt >= twentyFourHoursAgo || lastUpdatedTime >= twentyFourHoursAgo;
        
        // Skip if both creation and last update are before lastLogin AND not within 24 hours
        if (createdAt < fromTime && lastUpdatedTime < fromTime && !isWithin24Hours) {
          console.log('🔔 Skipping old referral:', referral.id, 'created:', new Date(createdAt).toISOString(), 'updated:', new Date(lastUpdatedTime).toISOString(), 'before lastLogin:', new Date(fromTime).toISOString());
          return null;
        }
        
        if (isWithin24Hours) {
          console.log('🔔 Including recent referral within 24 hours:', referral.id, 'created:', new Date(createdAt).toISOString());
        }
        
        recentReferrals++;
        console.log('🔔 Checking recent referral:', referral.id, 'status:', referral.status, 'updated:', new Date(referral.lastUpdated).toISOString());
        
        // Check if this referral is relevant to the user
        const isRelevant = userRole === 'patient' 
          ? referral.patientId === userId
          : referral.assignedSpecialistId === userId;
          
        console.log('🔔 Missed referral relevance check:', {
          referralId: referral.id,
          userRole,
          userId,
          patientId: referral.patientId,
          assignedSpecialistId: referral.assignedSpecialistId,
          referringSpecialistId: referral.referringSpecialistId,
          isRelevant,
          status: referral.status,
          appointmentDate: referral.appointmentDate,
          appointmentTime: referral.appointmentTime
        });
          
        if (!isRelevant) {
          console.log('🔔 Referral not relevant to user:', referral.id, 'patientId:', referral.patientId, 'assignedSpecialistId:', referral.assignedSpecialistId);
          return null;
        }
        
        relevantReferrals++;
        console.log('🔔 Found relevant referral:', referral.id, 'status:', referral.status);
        
        // Check if we already have a notification for this referral
        if (existingNotificationIds.has(referral.id)) {
          console.log('🔔 Notification already exists for referral:', referral.id);
          return null;
        }
        
        // Enhanced deduplication: Check for duplicate content
        const duplicateExists = cachedNotifications.some(existing => 
          existing.type === 'referral' && 
          existing.relatedId === referral.id && 
          existing.status === referral.status
        );
        
        if (duplicateExists) {
          console.log('🔔 Duplicate referral notification content exists for:', referral.id, 'status:', referral.status);
          return null;
        }
        
        // Status-based deduplication: Check if we've already notified about this referral status
        const userStatusMap = this.notifiedReferralStatuses.get(userId) || new Map();
        const referralStatusSet = userStatusMap.get(referral.id) || new Set();
        
        if (referralStatusSet.has(referral.status)) {
          console.log('🔔 Already notified about referral:', referral.id, 'status:', referral.status);
          return null;
        }
        
        // Check if we should create a notification for this status
        const shouldNotify = this.shouldCreateReferralNotification(referral, userRole);
        console.log('🔔 Should notify for referral:', referral.id, 'status:', referral.status, 'shouldNotify:', shouldNotify);
        
        if (!shouldNotify) return null;
        
        // Create notification
        const notification = await this.createReferralNotification(userId, userRole, referral);
        if (notification) {
          console.log('🔔 Created notification for referral:', referral.id);
          
          // Track that we've notified about this referral status
          const userStatusMap = this.notifiedReferralStatuses.get(userId) || new Map();
          const referralStatusSet = userStatusMap.get(referral.id) || new Set();
          referralStatusSet.add(referral.status);
          userStatusMap.set(referral.id, referralStatusSet);
          this.notifiedReferralStatuses.set(userId, userStatusMap);
          
          return notification;
        }
        return null;
      });
      
      // Wait for all notifications to be created
      const notifications = await Promise.all(notificationPromises);
      newNotifications.push(...notifications.filter(n => n !== null));
      
      console.log('🔔 Referral check summary:');
      console.log('  - Total referrals:', Object.keys(referrals).length);
      console.log('  - Recent referrals:', recentReferrals);
      console.log('  - Relevant referrals:', relevantReferrals);
      console.log('  - New notifications:', newNotifications.length);
      
      if (newNotifications.length > 0) {
        console.log('🔔 Found', newNotifications.length, 'missed referral notifications');
        await this.addNotifications(userId, newNotifications);
      }
      
    } catch (error) {
      console.error('🔔 Error checking missed referrals:', error);
    }
  }

  /**
   * Check for missed doctor notifications (professional fee status changes)
   */
  private async checkMissedDoctors(userId: string, fromTime: number): Promise<void> {
    try {
      console.log('🔔 --- CHECKING MISSED DOCTOR UPDATES ---');
      console.log('🔔 User:', userId, 'From time:', new Date(fromTime).toISOString());
      
      const doctorRef = ref(database, `doctors/${userId}`);
      const snapshot = await get(doctorRef);
      
      if (!snapshot.exists()) {
        console.log('🔔 No doctor data found for user:', userId);
        return;
      }
      
      const doctorData = snapshot.val();
      console.log('🔔 Found doctor data:', doctorData);
      
      // Check if professionalFeeStatus was updated after lastLogin
      const lastUpdatedTime = new Date(doctorData.lastUpdated || doctorData.createdAt).getTime();
      
      console.log('🔔 Processing doctor data:', {
        userId,
        professionalFeeStatus: doctorData.professionalFeeStatus,
        lastUpdated: new Date(lastUpdatedTime).toISOString(),
        fromTime: new Date(fromTime).toISOString(),
        isRecentUpdate: lastUpdatedTime >= fromTime
      });
      
      // Skip if last update is before lastLogin
      if (lastUpdatedTime < fromTime) {
        console.log('🔔 Skipping old doctor update:', userId, 'last updated:', new Date(lastUpdatedTime).toISOString(), 'before lastLogin:', new Date(fromTime).toISOString());
        return;
      }
      
      // Get cached notifications to avoid duplicates
      const cachedNotifications = await this.loadCachedNotifications(userId);
      const existingNotificationIds = new Set(cachedNotifications.map(n => n.relatedId));
      
      // Check if we should create a notification for professional fee status
      if ((doctorData.professionalFeeStatus === 'approved' || doctorData.professionalFeeStatus === 'rejected') && 
          !existingNotificationIds.has(`professional_fee_${userId}_${doctorData.professionalFeeStatus}`)) {
        console.log('🔔 Creating notification for professional fee status:', doctorData.professionalFeeStatus);
        const notification = this.createProfessionalFeeNotification(userId, doctorData);
        if (notification) {
          console.log('🔔 Created notification for professional fee status:', notification.id);
          await this.addNotifications(userId, [notification]);
        }
      }
      
    } catch (error) {
      console.error('🔔 Error checking missed doctors:', error);
    }
  }

  /**
   * Start listening to appointment changes
   */
  private startAppointmentListener(userId: string, userRole: 'patient' | 'specialist'): () => void {
    const appointmentsRef = ref(database, 'appointments');
    
    console.log('🔔 Setting up appointment listener for user:', userId, 'role:', userRole);
    
    const unsubscribe = onValue(appointmentsRef, async (snapshot: DataSnapshot) => {
      console.log('🔔 Appointment listener triggered for user:', userId, 'at:', getCurrentLocalTimestamp());
      console.log('🔔 Platform:', typeof window !== 'undefined' ? 'web' : 'mobile');
      console.log('🔔 Snapshot exists:', snapshot.exists());
      console.log('🔔 Snapshot has children:', snapshot.hasChildren());
      try {
        if (!snapshot.exists()) {
          console.log('🔔 No appointments data found');
          this.notifyCallbacks(userId, []);
          return;
        }

        const appointments = snapshot.val();
        const userAppointments: Appointment[] = [];
        
        // Filter appointments for this user and enrich with patient/doctor names
        const appointmentPromises = Object.keys(appointments).map(async (appointmentId) => {
          try {
            const appointment = appointments[appointmentId];
            
            // Check if this appointment is relevant to the user
            const isRelevant = userRole === 'patient' 
              ? appointment.patientId === userId
              : appointment.doctorId === userId;
            
            if (isRelevant) {
              // Enrich appointment data with patient and doctor names
              const enrichedAppointment = await this.enrichAppointmentData({
                id: appointmentId,
                ...appointment
              });
              
              return enrichedAppointment;
            }
            return null;
          } catch (appointmentError) {
            console.error('🔔 Error processing appointment:', appointmentId, appointmentError);
            return null;
          }
        });

        // Wait for all appointments to be processed
        const enrichedAppointments = await Promise.all(appointmentPromises);
        userAppointments.push(...enrichedAppointments.filter(appointment => appointment !== null));

        console.log(`🔔 Found ${userAppointments.length} appointments for user ${userId}`);
        
        // Check for changes and create notifications only for changes
        const newNotifications = this.checkForAppointmentChanges(userId, userRole, userAppointments);
        
        // Always use notifyCallbacks to ensure proper loading and merging
        if (newNotifications.length > 0) {
          console.log(`🔔 Found ${newNotifications.length} new appointment notifications for user ${userId}`);
          this.notifyCallbacks(userId, newNotifications);
        } else {
          // No new notifications, but still need to ensure UI has latest cached data
          console.log(`🔔 No new appointment notifications, refreshing UI with cached data for user ${userId}`);
          this.notifyCallbacks(userId, []);
        }
      } catch (error) {
        console.error('🔔 Error processing appointments snapshot:', error);
        this.notifyCallbacks(userId, []);
      }
    }, (error) => {
      console.error('🔔 Error listening to appointments:', error);
      this.notifyCallbacks(userId, []);
    });

    return unsubscribe;
  }

  /**
   * Start listening to referral changes
   */
  private startReferralListener(userId: string, userRole: 'patient' | 'specialist'): () => void {
    const referralsRef = ref(database, 'referrals');
    
    console.log('🔔 Setting up referral listener for user:', userId, 'role:', userRole);
    
    const unsubscribe = onValue(referralsRef, async (snapshot: DataSnapshot) => {
      console.log('🔔 Referral listener triggered for user:', userId, 'at:', getCurrentLocalTimestamp());
      try {
        if (!snapshot.exists()) {
          console.log('🔔 No referrals data found');
          this.notifyCallbacks(userId, []);
          return;
        }

        const referrals = snapshot.val();
        console.log('🔔 Real-time: Found', Object.keys(referrals).length, 'referrals in database');
        console.log('🔔 Real-time: Sample referral data:', Object.values(referrals).slice(0, 2));
        console.log('🔔 Real-time: Current user ID:', userId, 'Role:', userRole);
        
        const userReferrals: Referral[] = [];
        
        // Filter referrals for this user
        Object.keys(referrals).forEach(referralId => {
          try {
            const referral = referrals[referralId];
            
        // Check if this referral is relevant to the user
        const isRelevant = userRole === 'patient' 
          ? referral.patientId === userId
          : referral.assignedSpecialistId === userId;
          
        console.log('🔔 Real-time referral relevance check:', {
          referralId,
          userRole,
          userId,
          patientId: referral.patientId,
          assignedSpecialistId: referral.assignedSpecialistId,
          referringSpecialistId: referral.referringSpecialistId,
          isRelevant,
          status: referral.status,
          appointmentDate: referral.appointmentDate,
          appointmentTime: referral.appointmentTime
        });
              
            if (isRelevant) {
              console.log('🔔 Adding relevant referral to userReferrals:', referralId);
              userReferrals.push({
                id: referralId,
                ...referral
              });
            } else {
              console.log('🔔 Referral not relevant, skipping:', referralId);
            }
          } catch (referralError) {
            console.error('🔔 Error processing referral:', referralId, referralError);
          }
        });

        console.log(`🔔 Found ${userReferrals.length} referrals for user ${userId}`);
        
        // Check for changes and create notifications only for changes
        const newNotifications = await this.checkForReferralChanges(userId, userRole, userReferrals);
        
        // Always use notifyCallbacks to ensure proper loading and merging
        if (newNotifications.length > 0) {
          console.log(`🔔 Found ${newNotifications.length} new referral notifications for user ${userId}`);
          this.notifyCallbacks(userId, newNotifications);
        } else {
          // No new notifications, but still need to ensure UI has latest cached data
          console.log(`🔔 No new referral notifications, refreshing UI with cached data for user ${userId}`);
          this.notifyCallbacks(userId, []);
        }
      } catch (error) {
        console.error('🔔 Error processing referrals snapshot:', error);
        this.notifyCallbacks(userId, []);
      }
    }, (error) => {
      console.error('🔔 Error listening to referrals:', error);
      this.notifyCallbacks(userId, []);
    });

    return unsubscribe;
  }

  /**
   * Start listening to doctor changes (for specialists)
   */
  private startDoctorListener(userId: string): () => void {
    const doctorRef = ref(database, `doctors/${userId}`);
    
    console.log('🔔 Setting up doctor listener for user:', userId);
    
    const unsubscribe = onValue(doctorRef, async (snapshot: DataSnapshot) => {
      console.log('🔔 Doctor listener triggered for user:', userId, 'at:', getCurrentLocalTimestamp());
      try {
        if (!snapshot.exists()) {
          console.log('🔔 No doctor data found for user:', userId);
          return;
        }

        const doctorData = snapshot.val();
        console.log('🔔 Real-time: Found doctor data for user:', userId, doctorData);
        
        // Check for changes and create notifications only for changes
        const newNotifications = this.checkForDoctorChanges(userId, doctorData);
        
        // Always use notifyCallbacks to ensure proper loading and merging
        if (newNotifications.length > 0) {
          console.log(`🔔 Found ${newNotifications.length} new doctor notifications for user ${userId}`);
          this.notifyCallbacks(userId, newNotifications);
        } else {
          // No new notifications, but still need to ensure UI has latest cached data
          console.log(`🔔 No new doctor notifications, refreshing UI with cached data for user ${userId}`);
          this.notifyCallbacks(userId, []);
        }
      } catch (error) {
        console.error('🔔 Error processing doctor snapshot:', error);
        this.notifyCallbacks(userId, []);
      }
    }, (error) => {
      console.error('🔔 Error listening to doctor data:', error);
      this.notifyCallbacks(userId, []);
    });

    return unsubscribe;
  }

  /**
   * Check for appointment changes and create notifications only for changes
   */
  private checkForAppointmentChanges(userId: string, userRole: 'patient' | 'specialist', appointments: Appointment[]): RealtimeNotification[] {
    const newNotifications: RealtimeNotification[] = [];
    const previousStates = this.previousAppointmentStates.get(userId) || new Map();
    const currentStates = new Map();
    
    // Check if this is the first time we're loading data for this user
    const isFirstLoad = previousStates.size === 0;
    
    console.log('🔔 checkForAppointmentChanges:', {
      userId,
      userRole,
      appointmentCount: appointments.length,
      previousStatesCount: previousStates.size,
      isFirstLoad,
      previousStatesKeys: Array.from(previousStates.keys())
    });
    
    appointments.forEach(appointment => {
      const appointmentId = appointment.id;
      const currentState = {
        status: appointment.status,
        lastUpdated: appointment.lastUpdated
      };
      
      // Store current state
      currentStates.set(appointmentId, currentState);
      
      // Check if this is a new appointment or status change
      const previousState = previousStates.get(appointmentId);
      
      console.log('🔔 Processing appointment:', {
        appointmentId,
        currentStatus: currentState.status,
        previousStatus: previousState?.status,
        hasPreviousState: !!previousState,
        isFirstLoad,
        userRole,
        createdAt: appointment.createdAt,
        lastUpdated: appointment.lastUpdated
      });
      
      if (!previousState && !isFirstLoad) {
        // New appointment - create notification (but not on first load)
        console.log('🔔 New appointment detected:', appointmentId, 'userRole:', userRole);
        const notification = this.createAppointmentNotification(userId, userRole, appointment);
        if (notification) {
          console.log('🔔 Created notification for new appointment:', notification.id, 'userRole:', userRole);
          newNotifications.push(notification);
        }
      } else if (previousState && previousState.status !== currentState.status) {
        // Status changed - create notification
        console.log('🔔 Appointment status changed:', appointmentId, previousState.status, '->', currentState.status, 'userRole:', userRole);
        const notification = this.createAppointmentNotification(userId, userRole, appointment);
        if (notification) {
          console.log('🔔 Created notification for status change:', notification.id, 'userRole:', userRole);
          newNotifications.push(notification);
        }
      } else if (previousState && previousState.lastUpdated !== currentState.lastUpdated) {
        // LastUpdated changed but status is the same - check if it's a meaningful change
        console.log('🔔 Appointment updated (lastUpdated changed but status same):', appointmentId, 'userRole:', userRole);
        
        // Only create notification for meaningful changes, not minor field updates
        // For now, we'll skip notifications for non-status changes to avoid spam
        console.log('🔔 Skipping notification for non-status appointment update to avoid spam');
      }
    });
    
    // Update previous states
    this.previousAppointmentStates.set(userId, currentStates);
    
    if (isFirstLoad) {
      console.log('🔔 First load detected - not creating notifications for existing appointments');
    }
    
    return newNotifications;
  }

  /**
   * Check for doctor changes and create notifications only for changes
   */
  private checkForDoctorChanges(userId: string, doctorData: any): RealtimeNotification[] {
    const newNotifications: RealtimeNotification[] = [];
    const previousStates = this.previousDoctorStates.get(userId) || new Map();
    const currentStates = new Map();
    
    // Check if this is the first time we're loading data for this user
    const isFirstLoad = previousStates.size === 0;
    
    const currentState = {
      professionalFeeStatus: doctorData.professionalFeeStatus,
      lastUpdated: doctorData.lastUpdated || doctorData.createdAt
    };
    
    // Store current state
    currentStates.set(userId, currentState);
    
    // Check if this is a new doctor or status change
    const previousState = previousStates.get(userId);
    
    console.log('🔔 Processing doctor data:', {
      userId,
      currentStatus: currentState.professionalFeeStatus,
      previousStatus: previousState?.professionalFeeStatus,
      hasPreviousState: !!previousState,
      isFirstLoad,
      lastUpdated: currentState.lastUpdated
    });
    
    if (!previousState && !isFirstLoad) {
      // New doctor data - create notification (but not on first load)
      console.log('🔔 New doctor data detected:', userId);
      if (doctorData.professionalFeeStatus === 'approved' || doctorData.professionalFeeStatus === 'rejected') {
        const notification = this.createProfessionalFeeNotification(userId, doctorData);
        if (notification) {
          newNotifications.push(notification);
        }
      }
    } else if (previousState && previousState.professionalFeeStatus !== currentState.professionalFeeStatus) {
      // Status changed - create notification
      console.log('🔔 Professional fee status changed:', userId, previousState.professionalFeeStatus, '->', currentState.professionalFeeStatus);
      if (currentState.professionalFeeStatus === 'approved' || currentState.professionalFeeStatus === 'rejected') {
        const notification = this.createProfessionalFeeNotification(userId, doctorData);
        if (notification) {
          newNotifications.push(notification);
        }
      }
    }
    
    // Update previous states
    this.previousDoctorStates.set(userId, currentStates);
    
    if (isFirstLoad) {
      console.log('🔔 First load detected - not creating notifications for existing doctor data');
    }
    
    return newNotifications;
  }

  /**
   * Convert appointments to notifications for display (legacy method - not used)
   */
  private convertAppointmentsToNotifications(userId: string, userRole: 'patient' | 'specialist', appointments: Appointment[]): RealtimeNotification[] {
    const notifications: RealtimeNotification[] = [];
    
    appointments.forEach(appointment => {
      const notification = this.createAppointmentNotification(userId, userRole, appointment);
      if (notification) {
        notifications.push(notification);
      }
    });

    return notifications;
  }

  /**
   * Check for referral changes and create notifications only for changes
   */
  private async checkForReferralChanges(userId: string, userRole: 'patient' | 'specialist', referrals: Referral[]): Promise<RealtimeNotification[]> {
    const newNotifications: RealtimeNotification[] = [];
    const previousStates = this.previousReferralStates.get(userId) || new Map();
    const currentStates = new Map();
    
    // Check if this is the first time we're loading data for this user
    const isFirstLoad = previousStates.size === 0;
    
    // Process referrals in parallel
    const notificationPromises = referrals.map(async (referral) => {
      const referralId = referral.id;
      const currentState = {
        status: referral.status,
        lastUpdated: referral.lastUpdated
      };
      
      // Store current state
      currentStates.set(referralId, currentState);
      
      // Check if this is a new referral or status change
      const previousState = previousStates.get(referralId);
      
      console.log('🔔 Processing referral:', {
        referralId,
        currentStatus: currentState.status,
        previousStatus: previousState?.status,
        hasPreviousState: !!previousState,
        isFirstLoad,
        userRole,
        createdAt: referral.referralTimestamp,
        lastUpdated: referral.lastUpdated
      });
      
      if (!previousState && !isFirstLoad) {
        // New referral - create notification (but not on first load)
        console.log('🔔 New referral detected:', referralId);
        const notification = await this.createReferralNotification(userId, userRole, referral);
        return notification;
      } else if (previousState && previousState.status !== currentState.status) {
        // Status changed - create notification
        console.log('🔔 Referral status changed:', referralId, previousState.status, '->', currentState.status, 'for user:', userId, 'role:', userRole);
        const notification = await this.createReferralNotification(userId, userRole, referral);
        if (notification) {
          console.log('🔔 Created referral status change notification:', notification.id, 'for', userRole, userId);
        } else {
          console.log('🔔 No notification created for referral status change');
        }
        return notification;
      } else if (previousState && previousState.lastUpdated !== currentState.lastUpdated) {
        // LastUpdated changed but status is the same - check if it's a meaningful change
        console.log('🔔 Referral updated (lastUpdated changed but status same):', referralId);
        
        // Only create notification for meaningful changes, not minor field updates
        // For now, we'll skip notifications for non-status changes to avoid spam
        console.log('🔔 Skipping notification for non-status referral update to avoid spam');
      }
      return null;
    });
    
    // Wait for all notifications to be created
    const notifications = await Promise.all(notificationPromises);
    newNotifications.push(...notifications.filter(n => n !== null));
    
    // Update previous states
    this.previousReferralStates.set(userId, currentStates);
    
    if (isFirstLoad) {
      console.log('🔔 First load detected - not creating notifications for existing referrals');
    }
    
    return newNotifications;
  }

  /**
   * Convert referrals to notifications for display (legacy method - not used)
   */
  private async convertReferralsToNotifications(userId: string, userRole: 'patient' | 'specialist', referrals: Referral[]): Promise<RealtimeNotification[]> {
    const notificationPromises = referrals.map(async (referral) => {
      const notification = await this.createReferralNotification(userId, userRole, referral);
      return notification;
    });

    const notifications = await Promise.all(notificationPromises);
    return notifications.filter(n => n !== null);
  }

  /**
   * Format date to readable format (Aug 9, 2027)
   */
  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString; // Return original if formatting fails
    }
  }

  /**
   * Enrich appointment data with patient and doctor names
   */
  private async enrichAppointmentData(appointmentData: any): Promise<any> {
    return await databaseService.enrichAppointmentData(appointmentData);
  }

  /**
   * Create notification from appointment data
   */
  private createAppointmentNotification(userId: string, userRole: 'patient' | 'specialist', appointment: Appointment): RealtimeNotification | null {
    const { status, patientFirstName, patientLastName, doctorFirstName, doctorLastName, appointmentDate, appointmentTime, clinicName } = appointment;
    const formattedDate = this.formatDate(appointmentDate);
    
    console.log('🔔 createAppointmentNotification called:', {
      userId,
      userRole,
      appointmentId: appointment.id,
      status,
      patientName: `${patientFirstName} ${patientLastName}`,
      doctorName: `${doctorFirstName} ${doctorLastName}`
    });
    
    let title = '';
    let message = '';
    let priority: 'low' | 'medium' | 'high' = 'medium';

    if (userRole === 'patient') {
      // Patient notifications
      switch (status) {
        case 'pending':
          title = 'Appointment Booked';
          message = `Your appointment with Dr. ${doctorFirstName} ${doctorLastName} on ${formattedDate} at ${appointmentTime} has been successfully booked and is pending confirmation.`;
          priority = 'medium';
          break;
        case 'confirmed':
          title = 'Appointment Confirmed';
          message = `Your appointment with Dr. ${doctorFirstName} ${doctorLastName} on ${formattedDate} at ${appointmentTime} has been confirmed.`;
          priority = 'high';
          break;
        case 'completed':
          title = 'Appointment Completed';
          message = `Your appointment with Dr. ${doctorFirstName} ${doctorLastName} on ${formattedDate} has been completed. Consultation details has been added.`;
          priority = 'medium';
          break;
        case 'cancelled':
          title = 'Appointment Cancelled';
          message = `Your appointment with Dr. ${doctorFirstName} ${doctorLastName} on ${formattedDate} at ${appointmentTime} has been cancelled.`;
          priority = 'high';
          break;
        default:
          return null;
      }
    } else {
      // Specialist notifications
      switch (status) {
        case 'pending':
          title = 'New Appointment Request';
          message = `You have a new appointment request from ${patientFirstName} ${patientLastName} on ${formattedDate} at ${appointmentTime}.`;
          priority = 'high';
          break;
        case 'confirmed':
          title = 'Appointment Confirmed';
          message = `Appointment with ${patientFirstName} ${patientLastName} on ${formattedDate} at ${appointmentTime} has been confirmed.`;
          priority = 'medium';
          break;
        case 'completed':
          title = 'Appointment Completed';
          message = `Appointment with ${patientFirstName} ${patientLastName} on ${formattedDate} has been completed. Consultation details has been added.`;
          priority = 'low';
          break;
        case 'cancelled':
          title = 'Appointment Cancelled';
          message = `Appointment with ${patientFirstName} ${patientLastName} on ${formattedDate} at ${appointmentTime} has been cancelled.`;
          priority = 'medium';
          break;
        default:
          return null;
      }
    }

    const notification: RealtimeNotification = {
      id: `appointment-${appointment.id}-${status}-${userId}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'appointment' as const,
      title,
      message,
      timestamp: Date.now(),
      read: false,
      priority,
      relatedId: appointment.id,
      status
    };
    
    console.log('🔔 Created notification object:', notification);
    
    return notification;
  }

  /**
   * Create notification from referral data
   */
  private async createReferralNotification(userId: string, userRole: 'patient' | 'specialist', referral: Referral): Promise<RealtimeNotification | null> {
    const { status, appointmentDate, appointmentTime } = referral;
    const formattedDate = this.formatDate(appointmentDate);
    
    // Resolve names from users node if not already present
    let patientFirstName = referral.patientFirstName;
    let patientLastName = referral.patientLastName;
    let assignedSpecialistFirstName = referral.assignedSpecialistFirstName;
    let assignedSpecialistLastName = referral.assignedSpecialistLastName;
    let referringGeneralistFirstName = referral.referringGeneralistFirstName;
    let referringGeneralistLastName = referral.referringGeneralistLastName;
    let referringSpecialistFirstName = referral.referringSpecialistFirstName;
    let referringSpecialistLastName = referral.referringSpecialistLastName;
    
    // If names are missing or undefined, fetch from users node
    if ((!patientFirstName || !patientLastName) && referral.patientId) {
      try {
        const patientData = await databaseService.getUserById(referral.patientId);
        if (patientData) {
          patientFirstName = patientData.firstName || patientData.first_name;
          patientLastName = patientData.lastName || patientData.last_name;
          console.log(`🔔 Resolved patient name from users node: ${patientFirstName} ${patientLastName}`);
        }
      } catch (error) {
        console.error('🔔 Error fetching patient name:', error);
      }
    }
    
    if ((!assignedSpecialistFirstName || !assignedSpecialistLastName) && referral.assignedSpecialistId) {
      try {
        const specialistData = await databaseService.getUserById(referral.assignedSpecialistId);
        if (specialistData) {
          assignedSpecialistFirstName = specialistData.firstName || specialistData.first_name;
          assignedSpecialistLastName = specialistData.lastName || specialistData.last_name;
          console.log(`🔔 Resolved specialist name from users node: ${assignedSpecialistFirstName} ${assignedSpecialistLastName}`);
        }
      } catch (error) {
        console.error('🔔 Error fetching specialist name:', error);
      }
    }
    
    // Resolve referring generalist names from users node
    if ((!referringGeneralistFirstName || !referringGeneralistLastName) && referral.referringGeneralistId) {
      try {
        const referringGeneralistData = await databaseService.getUserById(referral.referringGeneralistId);
        if (referringGeneralistData) {
          referringGeneralistFirstName = referringGeneralistData.firstName || referringGeneralistData.first_name;
          referringGeneralistLastName = referringGeneralistData.lastName || referringGeneralistData.last_name;
          console.log(`🔔 Resolved referring generalist name from users node: ${referringGeneralistFirstName} ${referringGeneralistLastName}`);
        }
      } catch (error) {
        console.error('🔔 Error fetching referring generalist name:', error);
      }
    }
    
    // Resolve referring specialist names from users node
    if ((!referringSpecialistFirstName || !referringSpecialistLastName) && referral.referringSpecialistId) {
      try {
        const referringSpecialistData = await databaseService.getUserById(referral.referringSpecialistId);
        if (referringSpecialistData) {
          referringSpecialistFirstName = referringSpecialistData.firstName || referringSpecialistData.first_name;
          referringSpecialistLastName = referringSpecialistData.lastName || referringSpecialistData.last_name;
          console.log(`🔔 Resolved referring specialist name from users node: ${referringSpecialistFirstName} ${referringSpecialistLastName}`);
        }
      } catch (error) {
        console.error('🔔 Error fetching referring specialist name:', error);
      }
    }
    
    // Fallback to "Unknown" if names are still missing
    const specialistName = `${assignedSpecialistFirstName || 'Unknown'} ${assignedSpecialistLastName || 'Specialist'}`.trim();
    const patientName = `${patientFirstName || 'Unknown'} ${patientLastName || 'Patient'}`.trim();
    const referringDoctorName = (() => {
      if (referringSpecialistFirstName && referringSpecialistLastName) {
        return `${referringSpecialistFirstName} ${referringSpecialistLastName}`.trim();
      } else if (referringGeneralistFirstName && referringGeneralistLastName) {
        return `${referringGeneralistFirstName} ${referringGeneralistLastName}`.trim();
      } else {
        return 'Unknown Doctor';
      }
    })();
    
    let title = '';
    let message = '';
    let priority: 'low' | 'medium' | 'high' = 'medium';

    if (userRole === 'patient') {
      // Patient notifications
      switch (status) {
        case 'pending':
          title = 'Referral Received';
          message = `You have been referred to ${specialistName} for your appointment on ${formattedDate} at ${appointmentTime}.`;
          priority = 'high';
          break;
        case 'confirmed':
          title = 'Referral Confirmed';
          message = `Your referral to ${specialistName} on ${formattedDate} at ${appointmentTime} has been confirmed.`;
          priority = 'high';
          break;
        case 'cancelled':
          title = 'Referral Declined';
          message = `Your referral to ${specialistName} on ${formattedDate} has been declined.`;
          priority = 'high';
          break;
        case 'completed':
          title = 'Referral Completed';
          message = `Your referral to ${specialistName} on ${formattedDate} has been completed. Medical history has been updated with consultation details.`;
          priority = 'medium';
          break;
        default:
          return null;
      }
    } else {
      // Specialist notifications
      switch (status) {
        case 'pending':
          title = 'New Referral Received';
          message = `You have received a new referral for ${patientName} on ${formattedDate} at ${appointmentTime}.`;
          priority = 'high';
          break;
        case 'confirmed':
          title = 'Referral Confirmed';
          message = `Referral for ${patientName} on ${formattedDate} at ${appointmentTime} has been confirmed.`;
          priority = 'high';
          break;
        case 'cancelled':
          title = 'Referral Declined';
          message = `Referral for ${patientName} on ${formattedDate} has been declined.`;
          priority = 'medium';
          break;
        case 'completed':
          title = 'Referral Completed';
          message = `Referral for ${patientName} on ${formattedDate} has been completed. Medical history has been updated with consultation details.`;
          priority = 'low';
          break;
        default:
          return null;
      }
    }

    return {
      id: `referral-${referral.id}-${status}-${userId}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'referral',
      title,
      message,
      timestamp: Date.now(),
      read: false,
      priority,
      relatedId: referral.id || `referral-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status
    };
  }

  /**
   * Create notification from professional fee status data
   */
  private createProfessionalFeeNotification(userId: string, doctorData: any): RealtimeNotification | null {
    const { professionalFeeStatus, professionalFee, firstName, lastName } = doctorData;
    
    console.log('🔔 createProfessionalFeeNotification called:', {
      userId,
      professionalFeeStatus,
      professionalFee,
      doctorName: `${firstName} ${lastName}`
    });
    
    let title = '';
    let message = '';
    let priority: 'low' | 'medium' | 'high' = 'high';
    
    if (professionalFeeStatus === 'approved') {
      title = 'Professional Fee Approved';
      message = `Congratulations! Your professional fee of ₱${professionalFee || 'N/A'} has been approved. You can now start accepting appointments.`;
      priority = 'high';
    } else if (professionalFeeStatus === 'rejected') {
      title = 'Professional Fee Rejected';
      message = `Your professional fee of ₱${professionalFee || 'N/A'} has been rejected. Please contact support or resubmit with a different amount.`;
      priority = 'high';
    } else {
      // Don't notify for other statuses (pending, confirmed, etc.)
      return null;
    }

    const notification: RealtimeNotification = {
      id: `professional_fee_${userId}_${professionalFeeStatus}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'professional_fee' as const,
      title,
      message,
      timestamp: Date.now(),
      read: false,
      priority,
      relatedId: `professional_fee_${userId}`,
      status: professionalFeeStatus
    };
    
    console.log('🔔 Created professional fee notification:', notification);
    
    return notification;
  }

  /**
   * Load notifications from local storage
   */
  private async loadCachedNotifications(userId: string): Promise<RealtimeNotification[]> {
    try {
      const key = `notifications_${userId}`;
      const platform = typeof window !== 'undefined' ? 'web' : 'mobile';
      console.log(`🔔 [${platform}] Attempting to load cached notifications for user ${userId} with key: ${key}`);
      const cached = await AsyncStorage.getItem(key);
      console.log(`🔔 [${platform}] AsyncStorage.getItem result:`, cached ? 'Found data' : 'No data found');
      
      if (cached) {
        const notifications = JSON.parse(cached);
        
        // Remove duplicates based on content (message + type + timestamp proximity)
        const uniqueNotifications = notifications.filter((notification, index, self) => {
          const firstIndex = self.findIndex(n => {
            // Same message and type
            const sameContent = n.message === notification.message && n.type === notification.type;
            
            // Within 5 minutes of each other (likely duplicates)
            const timeDiff = Math.abs(n.timestamp - notification.timestamp);
            const withinTimeWindow = timeDiff < 5 * 60 * 1000; // 5 minutes
            
            return sameContent && withinTimeWindow;
          });
          
          return index === firstIndex;
        });
        
        // If duplicates were found, save the cleaned version back to cache
        if (uniqueNotifications.length !== notifications.length) {
          console.log(`🔔 [${platform}] Found ${notifications.length - uniqueNotifications.length} duplicate notifications, cleaning cache`);
          await this.saveCachedNotifications(userId, uniqueNotifications);
        }
        
        this.cachedNotifications.set(userId, uniqueNotifications);
        console.log(`🔔 [${platform}] Loaded ${uniqueNotifications.length} cached notifications for user ${userId}`);
        console.log(`🔔 [${platform}] Notification IDs:`, uniqueNotifications.map(n => n.id));
        console.log(`🔔 [${platform}] Notification messages:`, uniqueNotifications.map(n => n.message.substring(0, 50) + '...'));
        return uniqueNotifications;
      } else {
        console.log(`🔔 [${platform}] No cached notifications found for user ${userId}`);
      }
    } catch (error) {
      console.error('🔔 Error loading cached notifications:', error);
      console.error('🔔 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        platform: typeof window !== 'undefined' ? 'web' : 'mobile'
      });
    }
    return [];
  }

  /**
   * Save notifications to local storage
   */
  private async saveCachedNotifications(userId: string, notifications: RealtimeNotification[]): Promise<void> {
    try {
      const key = `notifications_${userId}`;
      console.log(`🔔 Attempting to save ${notifications.length} notifications for user ${userId} with key: ${key}`);
      console.log(`🔔 Notifications to save:`, notifications.map(n => ({ id: n.id, title: n.title, type: n.type })));
      
      const jsonString = JSON.stringify(notifications);
      console.log(`🔔 JSON string length:`, jsonString.length);
      
      await AsyncStorage.setItem(key, jsonString);
      this.cachedNotifications.set(userId, notifications);
      console.log(`🔔 Successfully saved ${notifications.length} notifications to cache for user ${userId}`);
      
      // Verify the save worked
      const verification = await AsyncStorage.getItem(key);
      if (verification) {
        const parsed = JSON.parse(verification);
        console.log(`🔔 Verification: Saved ${parsed.length} notifications, retrieved ${parsed.length}`);
      } else {
        console.log(`🔔 Verification: Failed to retrieve saved notifications`);
      }
    } catch (error) {
      console.error('🔔 Error saving cached notifications:', error);
      console.error('🔔 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        notificationCount: notifications.length,
        platform: typeof window !== 'undefined' ? 'web' : 'mobile'
      });
    }
  }

  /**
   * Merge new notifications with cached ones
   */
  private mergeNotifications(cached: RealtimeNotification[], newNotifications: RealtimeNotification[]): RealtimeNotification[] {
    const merged = [...cached];
    
    newNotifications.forEach(newNotification => {
      // Check if this notification already exists (by id)
      const existingIndex = merged.findIndex(n => n.id === newNotification.id);
      
      if (existingIndex >= 0) {
        // Update existing notification
        merged[existingIndex] = newNotification;
      } else {
        // Check for duplicate content - more comprehensive check
        const isDuplicate = merged.some(existing => {
          // Same message and title
          const sameContent = existing.message === newNotification.message && 
                             existing.title === newNotification.title;
          
          // Same related ID (same appointment/referral)
          const sameRelatedId = existing.relatedId === newNotification.relatedId;
          
          // Same type
          const sameType = existing.type === newNotification.type;
          
          // Within reasonable time window (30 seconds) OR same status
          const withinTimeWindow = Math.abs(existing.timestamp - newNotification.timestamp) < 30000;
          const sameStatus = existing.status === newNotification.status;
          
          // Consider it a duplicate if:
          // 1. Same content AND same related ID AND same type AND (within time window OR same status)
          return sameContent && sameRelatedId && sameType && (withinTimeWindow || sameStatus);
        });
        
        if (!isDuplicate) {
          // Add new notification
          merged.push(newNotification);
        } else {
          console.log('🔔 Skipping duplicate notification:', newNotification.id, 'message:', newNotification.message);
        }
      }
    });

    // Sort by timestamp (newest first) and limit to last 100 notifications
    return merged
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100);
  }

  /**
   * Notify callbacks with current notifications
   */
  private async notifyCallbacks(userId: string, notifications: RealtimeNotification[]): Promise<void> {
    try {
      console.log('🔔 notifyCallbacks called for user:', userId, 'with', notifications.length, 'new notifications');
      
      // Clear any existing debounce timer for this user
      const existingTimer = this.callbackDebounceTimers.get(userId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // Debounce the callback to prevent rapid multiple calls
      const debounceTimer = setTimeout(async () => {
        try {
          // Load cached notifications
          const cached = await this.loadCachedNotifications(userId);
          console.log('🔔 [Debounced] Loaded', cached.length, 'cached notifications for user:', userId);
          
          // Merge with new notifications
          const merged = this.mergeNotifications(cached, notifications);
          console.log('🔔 [Debounced] Merged to', merged.length, 'total notifications for user:', userId);
          
          // Save back to cache
          await this.saveCachedNotifications(userId, merged);
          
          // Notify callback with the merged notifications
          const callback = this.callbacks.get(userId);
          if (callback) {
            console.log('🔔 [Debounced] Notifying callback with', merged.length, 'notifications for user', userId);
            callback(merged);
          } else {
            console.warn('🔔 [Debounced] No callback found for user:', userId);
          }
          
          // Clean up the timer
          this.callbackDebounceTimers.delete(userId);
        } catch (error) {
          console.error('🔔 Error in debounced callback:', error);
          this.callbackDebounceTimers.delete(userId);
        }
      }, 100); // 100ms debounce delay
      
      // Store the timer
      this.callbackDebounceTimers.set(userId, debounceTimer);
      
    } catch (error) {
      console.error('🔔 Error setting up debounced callback:', error);
    }
  }

  /**
   * Force refresh notifications for a user (reload from cache and notify)
   */
  async forceRefresh(userId: string): Promise<void> {
    try {
      const notifications = await this.loadCachedNotifications(userId);
      const callback = this.callbacks.get(userId);
      if (callback) {
        console.log('🔔 Force refreshing notifications for user', userId, 'with', notifications.length, 'notifications');
        callback(notifications);
      }
    } catch (error) {
      console.error('🔔 Error force refreshing notifications:', error);
    }
  }

  /**
   * Register callback for notification updates
   */
  setCallback(userId: string, callback: (notifications: RealtimeNotification[]) => void): void {
    this.callbacks.set(userId, callback);
  }

  /**
   * Get current notifications (from cache)
   */
  async getNotifications(userId: string): Promise<RealtimeNotification[]> {
    try {
      return await this.loadCachedNotifications(userId);
    } catch (error) {
      console.error('🔔 Error getting notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read (update cache)
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      const platform = typeof window !== 'undefined' ? 'web' : 'mobile';
      console.log(`🔔 [${platform}] markAsRead called for user ${userId}, notification ${notificationId}`);
      
      const notifications = await this.loadCachedNotifications(userId);
      console.log(`🔔 [${platform}] Loaded ${notifications.length} notifications for markAsRead`);
      
      const updated = notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      );
      
      const foundNotification = updated.find(n => n.id === notificationId);
      console.log(`🔔 [${platform}] Found notification to mark as read:`, foundNotification ? 'Yes' : 'No');
      
      await this.saveCachedNotifications(userId, updated);
      console.log(`🔔 [${platform}] Saved updated notifications to cache`);
      
      // Notify callback
      const callback = this.callbacks.get(userId);
      if (callback) {
        console.log(`🔔 [${platform}] Calling UI callback with ${updated.length} notifications`);
        callback(updated);
      } else {
        console.warn(`🔔 [${platform}] No callback found for user ${userId}`);
      }
      
      console.log(`🔔 [${platform}] Marked notification as read:`, notificationId);
    } catch (error) {
      console.error('🔔 Error marking notification as read:', error);
    }
  }

  /**
   * Mark all notifications as read (update cache)
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const notifications = await this.loadCachedNotifications(userId);
      const updated = notifications.map(n => ({ ...n, read: true }));
      await this.saveCachedNotifications(userId, updated);
      
      // Notify callback
      const callback = this.callbacks.get(userId);
      if (callback) {
        callback(updated);
      }
      
      console.log('🔔 Marked all notifications as read');
    } catch (error) {
      console.error('🔔 Error marking all notifications as read:', error);
    }
  }

  /**
   * Delete notification (update cache)
   */
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    try {
      const notifications = await this.loadCachedNotifications(userId);
      const updated = notifications.filter(n => n.id !== notificationId);
      await this.saveCachedNotifications(userId, updated);
      
      // Notify callback
      const callback = this.callbacks.get(userId);
      if (callback) {
        callback(updated);
      }
      
      console.log('🔔 Deleted notification:', notificationId);
    } catch (error) {
      console.error('🔔 Error deleting notification:', error);
    }
  }

  /**
   * Get unread count (from cache)
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const notifications = await this.loadCachedNotifications(userId);
      return notifications.filter(n => !n.read).length;
    } catch (error) {
      console.error('🔔 Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Clear all notifications (clear cache)
   */
  async clearNotifications(userId: string): Promise<void> {
    try {
      const key = `notifications_${userId}`;
      await AsyncStorage.removeItem(key);
      this.cachedNotifications.delete(userId);
      
      // Clear in-memory deduplication tracking
      this.notifiedReferralStatuses.delete(userId);
      this.processedNotifications.delete(userId);
      this.previousAppointmentStates.delete(userId);
      this.previousReferralStates.delete(userId);
      this.previousDoctorStates.delete(userId);
      
      // Clear callback debounce timer
      const existingTimer = this.callbackDebounceTimers.get(userId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.callbackDebounceTimers.delete(userId);
      }
      
      // Notify callback
      const callback = this.callbacks.get(userId);
      if (callback) {
        callback([]);
      }
      
      console.log('🔔 Cleared all notifications and deduplication tracking for user:', userId);
    } catch (error) {
      console.error('🔔 Error clearing notifications:', error);
    }
  }

  /**
   * Stop all listeners
   */
  stopListening(): void {
    console.log('🔔 Stopping all real-time listeners');
    
    this.appointmentListeners.forEach(unsubscribe => unsubscribe());
    this.referralListeners.forEach(unsubscribe => unsubscribe());
    this.doctorListeners.forEach(unsubscribe => unsubscribe());
    
    // Clear debounce timers
    this.notificationDebounceTimers.forEach(timer => clearTimeout(timer));
    
    this.appointmentListeners.clear();
    this.referralListeners.clear();
    this.doctorListeners.clear();
    this.callbacks.clear();
    this.notificationDebounceTimers.clear();
    this.processedNotifications.clear();
    this.isProcessingNotifications.clear();
    
    // Clear all callback debounce timers
    this.callbackDebounceTimers.forEach(timer => clearTimeout(timer));
    this.callbackDebounceTimers.clear();
    this.globalNotificationCache.clear();
  }

  /**
   * Check if we should create a notification for this appointment
   */
  private shouldCreateAppointmentNotification(appointment: any, userRole: 'patient' | 'specialist'): boolean {
    if (!appointment || !appointment.status) return false;
    
    const shouldNotify = userRole === 'patient' 
      ? ['pending', 'confirmed', 'completed', 'cancelled'].includes(appointment.status)
      : ['pending', 'confirmed', 'completed', 'cancelled'].includes(appointment.status);
    
    console.log('🔔 shouldCreateAppointmentNotification:', {
      appointmentId: appointment.id,
      status: appointment.status,
      userRole,
      shouldNotify,
      allowedStatuses: userRole === 'patient' 
        ? ['pending', 'confirmed', 'completed', 'cancelled'] 
        : ['pending', 'confirmed', 'completed', 'cancelled']
    });
    
    return shouldNotify;
  }

  /**
   * Check if we should create a notification for this referral
   */
  private shouldCreateReferralNotification(referral: any, userRole: 'patient' | 'specialist'): boolean {
    if (!referral || !referral.status) return false;
    
    if (userRole === 'patient') {
      return ['pending', 'confirmed', 'completed', 'cancelled'].includes(referral.status);
    } else {
      return ['pending', 'confirmed', 'completed', 'cancelled'].includes(referral.status);
    }
  }

  /**
   * Add notifications to cache and notify callbacks with debouncing
   */
  private async addNotifications(userId: string, newNotifications: RealtimeNotification[]): Promise<void> {
    try {
      // Clear any existing debounce timer for this user
      const existingTimer = this.notificationDebounceTimers.get(userId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // Set a new debounce timer with longer delay to prevent rapid-fire notifications
      const debounceTimer = setTimeout(async () => {
        await this.processNotifications(userId, newNotifications);
        this.notificationDebounceTimers.delete(userId);
      }, 2000); // 2 second debounce to prevent rapid-fire notifications
      
      this.notificationDebounceTimers.set(userId, debounceTimer);
      
    } catch (error) {
      console.error('🔔 Error adding notifications:', error);
    }
  }

  /**
   * Process notifications after debounce period
   */
  private async processNotifications(userId: string, newNotifications: RealtimeNotification[]): Promise<void> {
    try {
      // Check if we're already processing notifications for this user
      if (this.isProcessingNotifications.get(userId)) {
        console.log('🔔 Already processing notifications for user:', userId, '- skipping');
        return;
      }
      
      // Set processing flag
      this.isProcessingNotifications.set(userId, true);
      
      const existingNotifications = await this.loadCachedNotifications(userId);
      
      // Filter out potential duplicates before merging
      const filteredNotifications = this.filterDuplicateNotifications(existingNotifications, newNotifications);
      
      const mergedNotifications = this.mergeNotifications(existingNotifications, filteredNotifications);
      
      await this.saveCachedNotifications(userId, mergedNotifications);
      
      // Notify callbacks
      const callback = this.callbacks.get(userId);
      if (callback) {
        callback(mergedNotifications);
      }
      
    } catch (error) {
      console.error('🔔 Error processing notifications:', error);
    } finally {
      // Clear processing flag
      this.isProcessingNotifications.delete(userId);
    }
  }

  /**
   * Filter out duplicate notifications before adding them
   */
  private filterDuplicateNotifications(existing: RealtimeNotification[], newNotifications: RealtimeNotification[]): RealtimeNotification[] {
    return newNotifications.filter(newNotification => {
      // Create a unique key for this notification based on content, related ID, and type
      const notificationKey = `${newNotification.message}-${newNotification.title}-${newNotification.relatedId}-${newNotification.type}-${newNotification.status}`;
      
      // Check if we already have a notification with the same content and related ID
      const isDuplicate = existing.some(existingNotification => {
        const sameContent = existingNotification.message === newNotification.message &&
                           existingNotification.title === newNotification.title;
        const sameRelatedId = existingNotification.relatedId === newNotification.relatedId;
        const sameType = existingNotification.type === newNotification.type;
        const sameStatus = existingNotification.status === newNotification.status;
        
        // Consider it a duplicate if same content, related ID, type, and status
        // OR if same content, related ID, type and within 30 seconds
        const withinTimeWindow = Math.abs(existingNotification.timestamp - newNotification.timestamp) < 30000;
        
        return sameContent && sameRelatedId && sameType && (sameStatus || withinTimeWindow);
      });
      
      if (isDuplicate) {
        console.log('🔔 Filtering out duplicate notification before adding:', newNotification.id, 'message:', newNotification.message);
        return false;
      }
      
      // Check global notification cache for duplicates across all users
      const globalKey = `${newNotification.message}-${newNotification.title}-${newNotification.relatedId}-${newNotification.type}-${newNotification.status}`;
      const globalEntry = this.globalNotificationCache.get(globalKey);
      if (globalEntry && Math.abs(globalEntry.timestamp - newNotification.timestamp) < 30000) {
        console.log('🔔 Filtering out global duplicate notification:', newNotification.id, 'message:', newNotification.message);
        return false;
      }
      
      // Add to global cache
      this.globalNotificationCache.set(globalKey, {
        timestamp: newNotification.timestamp,
        userId: newNotification.relatedId // Use relatedId as a proxy for user context
      });
      
      // Clean up global cache after 60 seconds
      setTimeout(() => {
        this.globalNotificationCache.delete(globalKey);
      }, 60000);
      
      // Also check against recently processed notifications
      const userId = this.getUserIdFromNotification(newNotification);
      if (userId) {
        const processedSet = this.processedNotifications.get(userId) || new Set();
        if (processedSet.has(notificationKey)) {
          console.log('🔔 Filtering out recently processed notification:', newNotification.id, 'message:', newNotification.message);
          return false;
        }
        
        // Add to processed set
        processedSet.add(notificationKey);
        this.processedNotifications.set(userId, processedSet);
        
        // Clean up old entries after 60 seconds
        const cleanupTimer = setTimeout(() => {
          const currentSet = this.processedNotifications.get(userId);
          if (currentSet) {
            currentSet.delete(notificationKey);
            if (currentSet.size === 0) {
              this.processedNotifications.delete(userId);
            }
          }
        }, 60000);
      }
      
      return true;
    });
  }

  /**
   * Extract user ID from notification (helper method)
   */
  private getUserIdFromNotification(notification: RealtimeNotification): string | null {
    // This is a simplified approach - in a real implementation, you might need to
    // track which user the notification belongs to differently
    return null; // For now, we'll rely on the existing deduplication logic
  }

  /**
   * Manually trigger missed notification check (for testing)
   */
  async forceCheckMissedNotifications(userId: string, userRole: 'patient' | 'specialist'): Promise<void> {
    console.log('🔔 FORCE CHECK: Starting missed notification check for user:', userId);
    
    // Clear status tracking to allow re-checking of all statuses
    console.log('🔔 FORCE CHECK: Clearing status tracking to allow missed notifications');
    this.notifiedReferralStatuses.delete(userId);
    
    await this.checkMissedNotifications(userId, userRole);
  }

  /**
   * Debug method - expose to global scope for testing
   */
  debugNotifications(userId: string, userRole: 'patient' | 'specialist'): void {
    console.log('🔔 ===== NOTIFICATION DEBUG INFO =====');
    console.log('🔔 User ID:', userId);
    console.log('🔔 User Role:', userRole);
    console.log('🔔 Platform:', typeof window !== 'undefined' ? 'web' : 'mobile');
    console.log('🔔 Firebase Database:', database);
    console.log('🔔 Active Listeners:', {
      appointments: this.appointmentListeners.has(userId),
      referrals: this.referralListeners.has(userId),
      doctors: this.doctorListeners.has(userId)
    });
    console.log('🔔 Cached Notifications:', this.cachedNotifications.get(userId)?.length || 0);
    console.log('🔔 Callbacks:', this.callbacks.has(userId));
    console.log('🔔 ===== END DEBUG INFO =====');
    
    // Make this available globally for easy testing
    if (typeof window !== 'undefined') {
      (window as any).debugNotifications = () => this.debugNotifications(userId, userRole);
      (window as any).forceCheckNotifications = () => this.forceCheckMissedNotifications(userId, userRole);
      (window as any).clearNotificationCache = () => this.clearNotifications(userId);
      console.log('🔔 Debug functions available globally: debugNotifications(), forceCheckNotifications(), clearNotificationCache()');
    }
  }

  /**
   * Remove duplicate notifications from cache (cleanup method)
   */
  async removeDuplicateNotifications(userId: string): Promise<void> {
    try {
      const notifications = await this.loadCachedNotifications(userId);
      const uniqueNotifications: RealtimeNotification[] = [];
      const seenKeys = new Set<string>();
      
      // Sort by timestamp (newest first) to keep the most recent version of duplicates
      const sortedNotifications = notifications.sort((a, b) => b.timestamp - a.timestamp);
      
      sortedNotifications.forEach(notification => {
        const key = `${notification.message}-${notification.title}-${notification.relatedId}-${notification.type}-${notification.status}`;
        
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueNotifications.push(notification);
        } else {
          console.log('🔔 Removing duplicate notification:', notification.id, 'message:', notification.message);
        }
      });
      
      if (uniqueNotifications.length !== notifications.length) {
        console.log(`🔔 Removed ${notifications.length - uniqueNotifications.length} duplicate notifications for user ${userId}`);
        await this.saveCachedNotifications(userId, uniqueNotifications);
        
        // Notify callback with cleaned notifications
        const callback = this.callbacks.get(userId);
        if (callback) {
          callback(uniqueNotifications);
        }
      }
    } catch (error) {
      console.error('🔔 Error removing duplicate notifications:', error);
    }
  }
}

export const realtimeNotificationService = new RealtimeNotificationService();