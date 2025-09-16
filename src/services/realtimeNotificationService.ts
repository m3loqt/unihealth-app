import { ref, onValue, off, DataSnapshot, get } from 'firebase/database';
import { database } from '../config/firebase';
import { Appointment, Referral } from './database/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { databaseService } from './database/firebase';

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

  /**
   * Start listening to appointment and referral changes for a specific user
   */
  startListening(userId: string, userRole: 'patient' | 'specialist'): () => void {
    console.log('🔔 ===== STARTING REAL-TIME LISTENERS =====');
    console.log('🔔 User:', userId, 'Role:', userRole);
    console.log('🔔 Timestamp:', new Date().toISOString());
    
    // Load existing cached notifications first
    this.loadCachedNotifications(userId).then(notifications => {
      console.log('🔔 Loaded cached notifications:', notifications.length);
      const callback = this.callbacks.get(userId);
      if (callback) {
        callback(notifications);
      }
    });
    
    // Check for missed notifications first (when user was offline)
    console.log('🔔 Calling checkMissedNotifications...');
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
    
    // Return cleanup function
    return () => {
      console.log('🔔 Cleaning up listeners for user:', userId);
      appointmentUnsubscribe();
      referralUnsubscribe();
      if (doctorUnsubscribe) {
        doctorUnsubscribe();
      }
      this.appointmentListeners.delete(userId);
      this.referralListeners.delete(userId);
      this.doctorListeners.delete(userId);
      this.callbacks.delete(userId);
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
      console.log('🔔 Current time:', new Date().toISOString());
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
          return notification;
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
      const notificationPromises = Object.values(referrals).map(async (referral: any) => {
        if (!referral) return null;
        
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
        
        // Skip if both creation and last update are before lastLogin
        if (createdAt < fromTime && lastUpdatedTime < fromTime) {
          console.log('🔔 Skipping old referral:', referral.id, 'created:', new Date(createdAt).toISOString(), 'updated:', new Date(lastUpdatedTime).toISOString(), 'before lastLogin:', new Date(fromTime).toISOString());
          return null;
        }
        
        recentReferrals++;
        console.log('🔔 Checking recent referral:', referral.id, 'status:', referral.status, 'updated:', new Date(referral.lastUpdated).toISOString());
        
        // Check if this referral is relevant to the user
        const isRelevant = userRole === 'patient' 
          ? referral.patientId === userId
          : referral.assignedSpecialistId === userId;
          
        console.log('🔔 Referral relevance check:', {
          referralId: referral.id,
          userRole,
          userId,
          patientId: referral.patientId,
          assignedSpecialistId: referral.assignedSpecialistId,
          isRelevant,
          status: referral.status
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
        
        // Check if we should create a notification for this status
        const shouldNotify = this.shouldCreateReferralNotification(referral, userRole);
        console.log('🔔 Should notify for referral:', referral.id, 'status:', referral.status, 'shouldNotify:', shouldNotify);
        
        if (!shouldNotify) return null;
        
        // Create notification
        const notification = await this.createReferralNotification(userId, userRole, referral);
        if (notification) {
          console.log('🔔 Created notification for referral:', referral.id);
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
    
    const unsubscribe = onValue(appointmentsRef, async (snapshot: DataSnapshot) => {
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
        
        // If there are new notifications, add them to cache and notify
        if (newNotifications.length > 0) {
          console.log(`🔔 Found ${newNotifications.length} new appointment notifications for user ${userId}`);
          this.notifyCallbacks(userId, newNotifications);
        } else {
          // No new notifications, just notify with current cached notifications
          const currentNotifications = this.cachedNotifications.get(userId) || [];
          const callback = this.callbacks.get(userId);
          if (callback) {
            callback(currentNotifications);
          }
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
    
    const unsubscribe = onValue(referralsRef, async (snapshot: DataSnapshot) => {
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
              isRelevant,
              status: referral.status
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
        
        // If there are new notifications, add them to cache and notify
        if (newNotifications.length > 0) {
          console.log(`🔔 Found ${newNotifications.length} new referral notifications for user ${userId}`);
          this.notifyCallbacks(userId, newNotifications);
        } else {
          // No new notifications, just notify with current cached notifications
          const currentNotifications = this.cachedNotifications.get(userId) || [];
          const callback = this.callbacks.get(userId);
          if (callback) {
            callback(currentNotifications);
          }
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
    
    const unsubscribe = onValue(doctorRef, async (snapshot: DataSnapshot) => {
      try {
        if (!snapshot.exists()) {
          console.log('🔔 No doctor data found for user:', userId);
          return;
        }

        const doctorData = snapshot.val();
        console.log('🔔 Real-time: Found doctor data for user:', userId, doctorData);
        
        // Check for changes and create notifications only for changes
        const newNotifications = this.checkForDoctorChanges(userId, doctorData);
        
        // If there are new notifications, add them to cache and notify
        if (newNotifications.length > 0) {
          console.log(`🔔 Found ${newNotifications.length} new doctor notifications for user ${userId}`);
          this.notifyCallbacks(userId, newNotifications);
        } else {
          // No new notifications, just notify with current cached notifications
          const currentNotifications = this.cachedNotifications.get(userId) || [];
          const callback = this.callbacks.get(userId);
          if (callback) {
            callback(currentNotifications);
          }
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
        console.log('🔔 Referral status changed:', referralId, previousState.status, '->', currentState.status);
        const notification = await this.createReferralNotification(userId, userRole, referral);
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
      id: `appointment-${appointment.id}-${status}`,
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
      id: `referral-${referral.id}-${status}`,
      type: 'referral',
      title,
      message,
      timestamp: Date.now(),
      read: false,
      priority,
      relatedId: referral.id,
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
      id: `professional_fee_${userId}_${professionalFeeStatus}`,
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
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const notifications = JSON.parse(cached);
        this.cachedNotifications.set(userId, notifications);
        console.log(`🔔 Loaded ${notifications.length} cached notifications for user ${userId}`);
        return notifications;
      }
    } catch (error) {
      console.error('🔔 Error loading cached notifications:', error);
    }
    return [];
  }

  /**
   * Save notifications to local storage
   */
  private async saveCachedNotifications(userId: string, notifications: RealtimeNotification[]): Promise<void> {
    try {
      const key = `notifications_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(notifications));
      this.cachedNotifications.set(userId, notifications);
      console.log(`🔔 Saved ${notifications.length} notifications to cache for user ${userId}`);
    } catch (error) {
      console.error('🔔 Error saving cached notifications:', error);
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
        // Add new notification
        merged.push(newNotification);
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
      // Load cached notifications
      const cached = await this.loadCachedNotifications(userId);
      
      // Merge with new notifications
      const merged = this.mergeNotifications(cached, notifications);
      
      // Save back to cache
      await this.saveCachedNotifications(userId, merged);
      
      // Notify callback
      const callback = this.callbacks.get(userId);
      if (callback) {
        callback(merged);
      }
    } catch (error) {
      console.error('🔔 Error notifying callbacks:', error);
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
      const notifications = await this.loadCachedNotifications(userId);
      const updated = notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      );
      await this.saveCachedNotifications(userId, updated);
      
      // Notify callback
      const callback = this.callbacks.get(userId);
      if (callback) {
        callback(updated);
      }
      
      console.log('🔔 Marked notification as read:', notificationId);
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
      
      // Notify callback
      const callback = this.callbacks.get(userId);
      if (callback) {
        callback([]);
      }
      
      console.log('🔔 Cleared all notifications');
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
    
    this.appointmentListeners.clear();
    this.referralListeners.clear();
    this.doctorListeners.clear();
    this.callbacks.clear();
  }

  /**
   * Check if we should create a notification for this appointment
   */
  private shouldCreateAppointmentNotification(appointment: any, userRole: 'patient' | 'specialist'): boolean {
    if (!appointment || !appointment.status) return false;
    
    const shouldNotify = userRole === 'patient' 
      ? ['confirmed', 'completed', 'cancelled'].includes(appointment.status)
      : ['pending', 'confirmed', 'completed', 'cancelled'].includes(appointment.status);
    
    console.log('🔔 shouldCreateAppointmentNotification:', {
      appointmentId: appointment.id,
      status: appointment.status,
      userRole,
      shouldNotify,
      allowedStatuses: userRole === 'patient' 
        ? ['confirmed', 'completed', 'cancelled'] 
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
      return ['confirmed', 'completed', 'cancelled'].includes(referral.status);
    } else {
      return ['pending', 'confirmed', 'completed', 'cancelled'].includes(referral.status);
    }
  }

  /**
   * Add notifications to cache and notify callbacks
   */
  private async addNotifications(userId: string, newNotifications: RealtimeNotification[]): Promise<void> {
    try {
      const existingNotifications = await this.loadCachedNotifications(userId);
      const mergedNotifications = this.mergeNotifications(existingNotifications, newNotifications);
      
      await this.saveCachedNotifications(userId, mergedNotifications);
      
      // Notify callbacks
      const callback = this.callbacks.get(userId);
      if (callback) {
        callback(mergedNotifications);
      }
      
    } catch (error) {
      console.error('🔔 Error adding notifications:', error);
    }
  }

  /**
   * Manually trigger missed notification check (for testing)
   */
  async forceCheckMissedNotifications(userId: string, userRole: 'patient' | 'specialist'): Promise<void> {
    console.log('🔔 FORCE CHECK: Starting missed notification check for user:', userId);
    await this.checkMissedNotifications(userId, userRole);
  }
}

export const realtimeNotificationService = new RealtimeNotificationService();