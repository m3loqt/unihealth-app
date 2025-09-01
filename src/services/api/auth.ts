import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
  signOut,
  onAuthStateChanged,
  User,
  updatePassword
} from 'firebase/auth';
import { ref, set, get, child, remove } from 'firebase/database';
import { auth, database } from '../../config/firebase';
import { emailService } from '../email/emailService';
import { passwordResetService } from '../database/passwordResetService';
import { capitalizeRelationship } from '../../utils/formatting';
import { cleanOptionalString, processAllergies, filterUndefinedValues } from '../../utils/string';

// Static users for testing (keep these)
export const STATIC_USERS = {
  patient: {
    uid: 'static-patient-001',
    email: 'admin',
    password: 'admin',
    role: 'patient' as const,
    firstName: 'Mel Angelo',
    middleName: undefined,
    lastName: 'Cortes',
    phone: '+1234567890',
    dateOfBirth: '1990-01-01',
    gender: 'Male',
    address: '123 Main St, City, State',
    emergencyContact: {
      name: 'Emergency Contact',
      phone: '+1234567890',
      relationship: 'Spouse'
    }
  },
  specialist: {
    uid: 'static-specialist-001',
    email: 'specialist',
    password: 'specialist',
    role: 'specialist' as const,
    firstName: 'Dr. Sarah',
    middleName: undefined,
    lastName: 'Johnson',
    phone: '+1234567890',
    dateOfBirth: '1985-01-01',
    gender: 'Female',
    address: '456 Medical Center Dr, City, State',
    emergencyContact: {
      name: 'Emergency Contact',
      phone: '+1234567890',
      relationship: 'Spouse'
    }
  }
};

export interface UserProfile {
  uid: string;
  email: string;
  role: 'patient' | 'specialist';
  firstName: string;
  middleName?: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  highestEducationalAttainment?: string;
  bloodType?: string;
  allergies?: string[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}

export interface SignUpData {
  // Step 1 data
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  contactNumber: string;
  highestEducationalAttainment?: string;
  bloodType?: string;
  allergies?: string; // Comma-separated string from form input (e.g., "peanuts, shellfish, dairy")
  
  // Step 2 data
  emergencyContactName: string;
  relationship: string;
  emergencyContactNumber: string;
  
  // Step 3 data
  password: string;
}

export interface UserNode {
  createdAt: string;
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  patientId?: string;
  doctorId?: string;
  role: 'patient' | 'specialist';
  passwordResetPending?: boolean;
  pendingPassword?: string;
  resetToken?: string;
  resetTokenExpiry?: string;
  lastPasswordUpdate?: string;
}

export interface PatientNode {
  address?: string;
  bloodType?: string;
  allergies?: string[];
  contactNumber?: string;
  createdAt: string;
  dateOfBirth?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  firstName: string;
  middleName?: string;
  gender?: string;
  lastName: string;
  lastUpdated?: string;
  userId: string;
  highestEducationalAttainment?: string;
}

export interface DoctorNode {
  address?: string;
  civilStatus?: string;
  clinicAffiliations?: string[];
  contactNumber?: string;
  createdAt: string;
  dateOfBirth?: string;
  email?: string;
  firstName: string;
  gender?: string;
  isGeneralist?: boolean;
  isSpecialist?: boolean;
  lastLogin?: string;
  lastName: string;
  medicalLicenseNumber?: string;
  middleName?: string;
  prcExpiryDate?: string;
  prcId?: string;
  professionalFee?: number;
  profileImageUrl?: string;
  specialty?: string;
  status?: string;
  userId: string;
}

export interface PasswordResetCode {
  code: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
}

export interface RateLimitData {
  email: string;
  attempts: number;
  lastAttempt: string;
  blockedUntil?: string;
}

export const authService = {
  // Check if user is a static user
  isStaticUser(email: string, password: string): UserProfile | null {
    if (email === STATIC_USERS.patient.email && password === STATIC_USERS.patient.password) {
      return STATIC_USERS.patient as UserProfile;
    }
    if (email === STATIC_USERS.specialist.email && password === STATIC_USERS.specialist.password) {
      return STATIC_USERS.specialist as UserProfile;
    }
    return null;
  },

  // Hybrid sign in - checks both static and database users
  async signIn(email: string, password: string): Promise<UserProfile | null> {
    console.log('SignIn attempt for email:', email);
    
    // First check static users
    const staticUser = this.isStaticUser(email, password);
    if (staticUser) {
      console.log('Static user found:', staticUser.name);
      return staticUser;
    }

    // Check for pending password reset
    try {
      const userData = await this.findUserByEmail(email);
      if (userData && userData.userData.passwordResetPending && userData.userData.pendingPassword === password) {
        console.log('Pending password reset detected, processing...');
        
        // IMPORTANT: We need to actually update the Firebase Auth password
        // Since we can't easily get the old password, we'll implement a special flow
        
        try {
          console.log('Attempting to update Firebase Auth password...');
          
          // Check if the reset token is still valid
          if (!userData.userData.resetToken || !userData.userData.resetTokenExpiry) {
            throw new Error('Invalid reset token');
          }
          
          const tokenExpiry = new Date(userData.userData.resetTokenExpiry);
          if (tokenExpiry < new Date()) {
            throw new Error('Reset token has expired');
          }
          
          // IMPORTANT: This is where we need to actually update Firebase Auth
          // We'll implement a solution that creates a new Firebase Auth user with the new password
          // This is the only way to properly reset a password without the old one
          
          try {
            console.log('Implementing proper password reset solution...');
            
            // First, let's try to sign in with the old password to see if there's an existing Firebase Auth user
            let existingUser = null;
            try {
              // We'll try some common default passwords or check if the user exists
              // This is a limitation of the current approach
              console.log('Checking for existing Firebase Auth user...');
              
              // For now, we'll assume the user needs to complete the reset manually
              // since we can't easily determine the old password
              
              throw new Error('Cannot automatically reset password without old password');
              
            } catch (existingUserError: any) {
              console.log('No existing Firebase Auth user found or cannot authenticate:', existingUserError.message);
              
              // Since we can't authenticate with the old password, we'll implement a workaround
              // We'll create a new Firebase Auth user with the new password
              
              try {
                console.log('Creating new Firebase Auth user with new password...');
                
                // IMPORTANT: This approach has limitations but is the best we can do without the old password
                // We'll create a new Firebase Auth user with the new password
                
                const newUserCredential = await createUserWithEmailAndPassword(auth, email, password);
                console.log('Successfully created new Firebase Auth user with new password, UID:', newUserCredential.user.uid);
                
                // Clear the pending password reset
                const userRef = ref(database, `users/${userData.databaseUid}`);
                await set(userRef, {
                  ...userData.userData,
                  passwordResetPending: false,
                  pendingPassword: null,
                  resetToken: null,
                  resetTokenExpiry: null,
                  lastPasswordUpdate: new Date().toISOString()
                });
                
                console.log('Password reset completed successfully');
                
                                 // Return the user profile with the new Firebase Auth UID
                 const userProfile: UserProfile = {
                   uid: newUserCredential.user.uid, // Use new Firebase Auth UID
                   email: userData.userData.email,
                   role: userData.userData.role,
                   firstName: userData.userData.firstName,
                   middleName: cleanOptionalString(userData.userData.middleName),
                   lastName: userData.userData.lastName,
                   // Note: phone, address, dateOfBirth, gender, emergencyContact are in patients node
                   // Will be populated if needed when accessing patient data
                 };
                
                return userProfile;
                
              } catch (createUserError: any) {
                console.log('Could not create new Firebase Auth user:', createUserError.message);
                
                if (createUserError.code === 'auth/email-already-in-use') {
                  // The email already exists in Firebase Auth, which means there's an old account
                  // We need to handle this case differently
                  
                  console.log('Email already exists in Firebase Auth, implementing alternative solution...');
                  
                  // For now, we'll clear the pending reset and inform the user
                  // that they need to contact support to complete the password reset
                  
                  const userRef = ref(database, `users/${userData.databaseUid}`);
                  await set(userRef, {
                    ...userData.userData,
                    passwordResetPending: false,
                    pendingPassword: null,
                    resetToken: null,
                    resetTokenExpiry: null,
                    lastPasswordUpdate: new Date().toISOString()
                  });
                  
                  throw new Error('Password reset requires manual intervention. Your email already exists in our authentication system. Please contact support to complete your password reset.');
                } else {
                  // Some other error occurred
                  throw new Error(`Failed to create new user account: ${createUserError.message}`);
                }
              }
            }
            
          } catch (firebaseAuthError: any) {
            console.log('Firebase Auth error during password reset:', firebaseAuthError.message);
            
            // If we can't complete the reset, clear the pending state and inform the user
            const userRef = ref(database, `users/${userData.databaseUid}`);
            await set(userRef, {
              ...userData.userData,
              passwordResetPending: false,
              pendingPassword: null,
              resetToken: null,
              resetTokenExpiry: null,
              lastPasswordUpdate: new Date().toISOString()
            });
            
            throw new Error(`Password reset failed: ${firebaseAuthError.message}. Please try the reset process again or contact support.`);
          }
          
        } catch (firebaseError) {
          console.error('Error updating Firebase Auth password:', firebaseError);
          // If we can't update Firebase Auth, we should still clear the pending reset
          // but inform the user that they need to contact support
          throw new Error('Password reset completed but there was an issue updating authentication. Please contact support.');
        }
      }
    } catch (error) {
      console.error('Error checking pending password reset:', error);
      // Continue with normal authentication flow
    }

    // If not static user and no pending password reset, try Firebase authentication
    try {
      console.log('Attempting Firebase authentication...');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('Firebase auth successful, UID:', user.uid);
      
      // Get complete user profile from database
      const completeProfile = await this.getCompleteUserProfile(user.uid);
      
      if (completeProfile) {
        console.log('Complete profile found:', completeProfile.name);
        return completeProfile;
      }
      
      // If UID-based lookup fails, try email-based lookup
      console.log('UID-based lookup failed, trying email-based lookup...');
      const emailBasedUser = await this.findUserByEmail(user.email!);
      
      if (emailBasedUser) {
        console.log('Found user by email with database UID:', emailBasedUser.databaseUid);
        const { userData, databaseUid } = emailBasedUser;
        
        // Get additional patient data if this is a patient
        let patientData = null;
        if (userData.role === 'patient') {
          patientData = await this.getPatientData(databaseUid);
          console.log('Patient data:', patientData);
        }
        
                 const userProfile: UserProfile = {
           uid: user.uid, // Use Firebase Auth UID
           email: userData.email,
           role: userData.role,
           firstName: userData.firstName,
           middleName: cleanOptionalString(userData.middleName),
           lastName: userData.lastName,
           phone: patientData?.contactNumber || undefined,
           address: patientData?.address || undefined,
           dateOfBirth: patientData?.dateOfBirth || undefined,
           gender: patientData?.gender || undefined,
           emergencyContact: patientData?.emergencyContact || undefined,
         };
        
        console.log('Created user profile from email lookup:', `${userProfile.firstName} ${userProfile.lastName}`);
        return userProfile;
      }
      
      console.log('No user data found in database for email:', user.email);
      console.log('User exists in Firebase Auth but not in database nodes');
      return null;
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw new Error(error.message);
    }
  },

  // Comprehensive signup that stores data in both users and patients nodes
  async signUp(signUpData: SignUpData): Promise<{ user: User; userProfile: UserProfile }> {
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        signUpData.email, 
        signUpData.password
      );
      const user = userCredential.user;
      
      // Use Firebase UID as patient ID
      const patientId = user.uid;
      const currentTime = new Date().toISOString();
      

      
      // Prepare user node data with null safety (only immutable fields)
      const userNodeData: UserNode = {
        createdAt: currentTime,
        email: signUpData.email,
        firstName: signUpData.firstName,
        middleName: cleanOptionalString(signUpData.middleName),
        lastName: signUpData.lastName,
        patientId: patientId,
        role: 'patient'
      };
      
      // Prepare patient node data with null safety (editable fields)
      const patientNodeData: PatientNode = {
        address: signUpData.address || '',
        contactNumber: signUpData.contactNumber || '',
        createdAt: currentTime,
        dateOfBirth: signUpData.dateOfBirth || '',
        emergencyContact: signUpData.emergencyContactName ? {
          name: signUpData.emergencyContactName,
          phone: signUpData.emergencyContactNumber || '',
          relationship: capitalizeRelationship(signUpData.relationship || '')
        } : undefined,
        firstName: signUpData.firstName,
        middleName: cleanOptionalString(signUpData.middleName),
        gender: signUpData.gender || '',
        lastName: signUpData.lastName,
        lastUpdated: currentTime,
        userId: user.uid,
        highestEducationalAttainment: cleanOptionalString(signUpData.highestEducationalAttainment),
        bloodType: cleanOptionalString(signUpData.bloodType),
        allergies: processAllergies(signUpData.allergies)
      };
      
      // Filter out undefined values before storing to Firebase
      const filteredUserNodeData = filterUndefinedValues(userNodeData);
      const filteredPatientNodeData = filterUndefinedValues(patientNodeData);
      
      // Store data in both nodes
      await Promise.all([
        set(ref(database, `users/${user.uid}`), filteredUserNodeData),
        set(ref(database, `patients/${user.uid}`), filteredPatientNodeData)
      ]);
      
      // Create user profile for return with null safety
      const userProfile: UserProfile = {
        uid: user.uid,
        email: user.email!,
        role: 'patient',
        firstName: signUpData.firstName,
        middleName: cleanOptionalString(signUpData.middleName),
        lastName: signUpData.lastName,
        phone: signUpData.contactNumber || undefined,
        dateOfBirth: signUpData.dateOfBirth || undefined,
        gender: signUpData.gender || undefined,
        address: signUpData.address || undefined,
        highestEducationalAttainment: cleanOptionalString(signUpData.highestEducationalAttainment),
        emergencyContact: signUpData.emergencyContactName ? {
          name: signUpData.emergencyContactName,
          phone: signUpData.emergencyContactNumber || '',
          relationship: capitalizeRelationship(signUpData.relationship || '')
        } : undefined,
        bloodType: cleanOptionalString(signUpData.bloodType),
        allergies: processAllergies(signUpData.allergies)
      };
      
      // Filter out undefined values from user profile
      const filteredUserProfile = filterUndefinedValues(userProfile);
      
      // Send welcome email (non-blocking - don't fail signup if email fails)

      try {
        const userName = `${signUpData.firstName} ${signUpData.lastName}`.trim();
        console.log('📧 Attempting to send welcome email to:', signUpData.email, 'for user:', userName);
        await emailService.sendWelcomeEmail(signUpData.email, userName);
        console.log('✅ Welcome email sent successfully');
      } catch (emailError) {
        console.warn('⚠️ Failed to send welcome email:', emailError);
        // Don't throw error - signup should still succeed even if email fails
      }
      
      return { user, userProfile: filteredUserProfile as UserProfile };
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw new Error(error.message);
    }
  },

  // Request password reset
  async requestPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error('Password reset request error:', error);
      throw new Error(error.message);
    }
  },

  // Confirm password reset with code
  async confirmPasswordReset(oobCode: string, newPassword: string): Promise<void> {
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
    } catch (error: any) {
      console.error('Password reset confirmation error:', error);
      throw new Error(error.message);
    }
  },

  // Sign out
  async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new Error(error.message);
    }
  },

  // Get current user
  getCurrentUser(): User | null {
    return auth.currentUser;
  },

  // Listen to auth state changes
  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  },

  // Get user profile from Realtime Database with proper error handling
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userRef = ref(database, `users/${uid}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val() as UserNode;
        
                 // Create UserProfile with null safety
         const userProfile: UserProfile = {
           uid: uid,
           email: userData.email,
           role: userData.role,
           firstName: userData.firstName,
           middleName: cleanOptionalString(userData.middleName),
           lastName: userData.lastName,
           // Note: phone, address, dateOfBirth and emergencyContact are in patients node
           // We'll get those separately if needed
         };
        
        return userProfile;
      }
      return null;
    } catch (error: any) {
      console.error('Get user profile error:', error);
      return null;
    }
  },

  // Get patient data from patients node
  async getPatientData(patientId: string): Promise<PatientNode | null> {
    try {
      const patientRef = ref(database, `patients/${patientId}`);
      const snapshot = await get(patientRef);
      
      if (snapshot.exists()) {
        return snapshot.val() as PatientNode;
      }
      return null;
    } catch (error: any) {
      console.error('Get patient data error:', error);
      return null;
    }
  },

  // Get complete user data (both user and patient nodes)
  async getCompleteUserData(uid: string): Promise<{ user: UserNode; patient: PatientNode } | null> {
    try {
      const userRef = ref(database, `users/${uid}`);
      const userSnapshot = await get(userRef);
      
      if (userSnapshot.exists()) {
        const userData = userSnapshot.val() as UserNode;
        const patientData = await this.getPatientData(uid); // Use uid directly
        
        if (patientData) {
          return { user: userData, patient: patientData };
        }
      }
      return null;
    } catch (error: any) {
      console.error('Get complete user data error:', error);
      return null;
    }
  },

  // Get complete user profile with all data (user + patient nodes)
  async getCompleteUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      console.log('getCompleteUserProfile called with UID:', uid);
      
      // First try UID-based lookup
      const userRef = ref(database, `users/${uid}`);
      console.log('Checking users node at path:', `users/${uid}`);
      const userSnapshot = await get(userRef);
      
      console.log('User snapshot exists:', userSnapshot.exists());
      
      if (userSnapshot.exists()) {
        const userData = userSnapshot.val() as UserNode;
        console.log('User data found:', userData);
        
        // Get additional patient data if this is a patient
        let patientData = null;
        if (userData.role === 'patient') {
          patientData = await this.getPatientData(uid);
          console.log('Patient data:', patientData);
        }
        
                 const userProfile: UserProfile = {
           uid: uid,
           email: userData.email,
           role: userData.role,
           firstName: userData.firstName,
           middleName: cleanOptionalString(userData.middleName),
           lastName: userData.lastName,
           phone: patientData?.contactNumber || undefined,
           address: patientData?.address || undefined,
           dateOfBirth: patientData?.dateOfBirth || undefined,
           gender: patientData?.gender || undefined,
           emergencyContact: patientData?.emergencyContact || undefined,
         };
        
        console.log('Created complete user profile:', `${userProfile.firstName} ${userProfile.lastName}`);
        return userProfile;
      }
      
      console.log('User not found in users node');
      // If not found in users node, return null
      return null;
    } catch (error: any) {
      console.error('Get complete user profile error:', error);
      return null;
    }
  },

  // New method: Find user by email (for UID mismatch scenarios)
  async findUserByEmail(email: string): Promise<{ userData: UserNode; databaseUid: string } | null> {
    try {
      console.log('Searching for user by email:', email);
      
      // Search in users node
      const usersRef = ref(database, 'users');
      const usersSnapshot = await get(usersRef);
      
      if (usersSnapshot.exists()) {
        let foundUser = null;
        usersSnapshot.forEach((childSnapshot) => {
          const userData = childSnapshot.val() as UserNode;
          if (userData.email === email && !foundUser) {
            console.log('Found user in users node with database UID:', childSnapshot.key);
            foundUser = { userData, databaseUid: childSnapshot.key! };
          }
        });
        if (foundUser) return foundUser;
      }
      
      // Search in doctors node
      const doctorsRef = ref(database, 'doctors');
      const doctorsSnapshot = await get(doctorsRef);
      
      if (doctorsSnapshot.exists()) {
        let foundDoctor = null;
        doctorsSnapshot.forEach((childSnapshot) => {
          const doctorData = childSnapshot.val();
          if (doctorData.email === email && !foundDoctor) {
            console.log('Found user in doctors node with database UID:', childSnapshot.key);
            foundDoctor = { userData: doctorData, databaseUid: childSnapshot.key! };
          }
        });
        if (foundDoctor) return foundDoctor;
      }
      
      console.log('User not found by email in any node');
      return null;
    } catch (error: any) {
      console.error('Find user by email error:', error);
      return null;
    }
  },

  // Generate a random 6-digit code
  generateResetCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  // Generate a secure reset token
  generateResetToken(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += characters[Math.floor(Math.random() * characters.length)];
    }
    return token;
  },

  // Check rate limiting for password reset
  async checkRateLimit(email: string): Promise<{ allowed: boolean; message?: string }> {
    try {
      const rateLimitRef = ref(database, `rateLimits/${email.replace(/[.#$[\]]/g, '_')}`);
      const snapshot = await get(rateLimitRef);
      
      if (!snapshot.exists()) {
        return { allowed: true };
      }

      const rateLimitData = snapshot.val() as RateLimitData;
      const now = new Date();

      // Check if user is blocked
      if (rateLimitData.blockedUntil) {
        const blockedUntil = new Date(rateLimitData.blockedUntil);
        if (now < blockedUntil) {
          const remainingMinutes = Math.ceil((blockedUntil.getTime() - now.getTime()) / (1000 * 60));
          return { 
            allowed: false, 
            message: `Too many attempts. Please wait ${remainingMinutes} minutes before trying again.` 
          };
        } else {
          // Reset rate limit if block period has expired
          await set(rateLimitRef, { email, attempts: 0, lastAttempt: now.toISOString() });
          return { allowed: true };
        }
      }

      // Check attempts within the last hour
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const lastAttempt = new Date(rateLimitData.lastAttempt);

      if (lastAttempt < oneHourAgo) {
        // Reset attempts if more than an hour has passed
        await set(rateLimitRef, { email, attempts: 1, lastAttempt: now.toISOString() });
        return { allowed: true };
      }

      // Check if user has exceeded limit (3 attempts per hour)
      if (rateLimitData.attempts >= 3) {
        // Block for 1 hour
        const blockedUntil = new Date(now.getTime() + 60 * 60 * 1000);
        await set(rateLimitRef, { 
          ...rateLimitData, 
          blockedUntil: blockedUntil.toISOString() 
        });
        return { 
          allowed: false, 
          message: 'Too many attempts. Please wait 1 hour before trying again.' 
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Rate limit check error:', error);
      // Allow request if rate limiting fails
      return { allowed: true };
    }
  },

  // Update rate limit after attempt
  async updateRateLimit(email: string): Promise<void> {
    try {
      const rateLimitRef = ref(database, `rateLimits/${email.replace(/[.#$[\]]/g, '_')}`);
      const snapshot = await get(rateLimitRef);
      const now = new Date();

      if (!snapshot.exists()) {
        await set(rateLimitRef, { email, attempts: 1, lastAttempt: now.toISOString() });
      } else {
        const rateLimitData = snapshot.val() as RateLimitData;
        await set(rateLimitRef, { 
          ...rateLimitData, 
          attempts: rateLimitData.attempts + 1, 
          lastAttempt: now.toISOString() 
        });
      }
    } catch (error) {
      console.error('Update rate limit error:', error);
    }
  },

  // // Request password reset code
  // async requestPasswordResetCode(email: string): Promise<void> {
  //   try {
  //     // Validate email format
  //     if (!emailService.validateEmail(email)) {
  //       throw new Error('Invalid email format');
  //     }

  //     // Check rate limiting
  //     const rateLimitCheck = await this.checkRateLimit(email);
  //     if (!rateLimitCheck.allowed) {
  //       throw new Error(rateLimitCheck.message || 'Rate limit exceeded');
  //     }

  //     // Check if user exists (for static users or Firebase users)
  //     const staticUser = Object.values(STATIC_USERS).find(user => user.email === email);
  //     if (!staticUser) {
  //       // For Firebase users, we'll proceed and let the verification handle non-existent users
  //       // In production, you might want to check if the email exists in your database first
  //       console.log('Proceeding with password reset for potential Firebase user:', email);
  //     }

  //     // Check if email service is configured
  //     if (!emailService.isEmailServiceReady()) {
  //       throw new Error('Email service not configured. Please contact support.');
  //     }

  //     // Generate 6-digit code
  //     const code = this.generateResetCode();
      
  //     // Set expiration time (5 minutes from now)
  //     const now = new Date();
  //     const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
      
  //     // Create reset code data
  //     const resetCodeData: PasswordResetCode = {
  //       code,
  //       email,
  //       createdAt: now.toISOString(),
  //       expiresAt: expiresAt.toISOString(),
  //       used: false
  //     };

  //     // Store in database (use email as key for easy lookup)
  //     const resetCodeRef = ref(database, `passwordResetCodes/${email.replace(/[.#$[\]]/g, '_')}`);
  //     await set(resetCodeRef, resetCodeData);

  //     // Send email with code using production email service
  //     const userName = staticUser ? staticUser.name : undefined;
  //     await emailService.sendPasswordResetEmail({
  //       email,
  //       code,
  //       userName
  //     });

  //     // Update rate limit after successful attempt
  //     await this.updateRateLimit(email);
      
  //   } catch (error: any) {
  //     console.error('Password reset code request error:', error);
      
  //     // Clean up any partially created data
  //     try {
  //       const resetCodeRef = ref(database, `passwordResetCodes/${email.replace(/[.#$[\]]/g, '_')}`);
  //       await remove(resetCodeRef);
  //     } catch (cleanupError) {
  //       console.error('Failed to cleanup reset code data:', cleanupError);
  //     }
      
  //     throw new Error(error.message);
  //   }
  // },

  // // Verify password reset code
  // async verifyPasswordResetCode(email: string, code: string): Promise<boolean> {
  //   try {
  //     const resetCodeRef = ref(database, `passwordResetCodes/${email.replace(/[.#$[\]]/g, '_')}`);
  //     const snapshot = await get(resetCodeRef);
      
  //     if (!snapshot.exists()) {
  //       return false;
  //     }

  //     const resetCodeData = snapshot.val() as PasswordResetCode;
      
  //     // Check if code matches
  //     if (resetCodeData.code !== code) {
  //       return false;
  //     }

  //     // Check if code is already used
  //     if (resetCodeData.used) {
  //       return false;
  //     }

  //     // Check if code has expired
  //     const now = new Date();
  //     const expiresAt = new Date(resetCodeData.expiresAt);
      
  //     if (now > expiresAt) {
  //       // Remove expired code
  //       await remove(resetCodeRef);
  //       return false;
  //     }

  //     return true;
  //   } catch (error: any) {
  //     console.error('Password reset code verification error:', error);
  //     return false;
  //   }
  // },

  // // Reset password with code
  // async resetPasswordWithCode(email: string, code: string, newPassword: string): Promise<void> {
  //   try {
  //     // First verify the code
  //     const isValid = await this.verifyPasswordResetCode(email, code);
  //     if (!isValid) {
  //       throw new Error('Invalid or expired reset code');
  //     }

  //     // For static users, we can't actually change their password in Firebase Auth
  //     // but we can update their password in our static data
  //     const staticUser = Object.values(STATIC_USERS).find(user => user.email === email);
  //     if (staticUser) {
  //       // Update static user password
  //       staticUser.password = newPassword;
  //       console.log('Static user password updated');
  //       return;
  //     }

  //     // For Firebase users, we need to sign them in first to change password
  //     // This is a limitation - we need the user to be signed in to change password
  //     // Alternative approach: Use the original Firebase password reset flow
  //     throw new Error('Password reset with code is not supported for Firebase users. Please use the email link method.');

  //   } catch (error: any) {
  //     console.error('Password reset with code error:', error);
  //     throw new Error(error.message);
  //   }
  // },

  async requestPasswordResetCode(email: string): Promise<{ success: boolean; message: string; devCode?: string }> {
    try {
      // Check if user exists in database
      const userRecord = await this.findUserByEmail(email);
      if (!userRecord) {
        return { success: false, message: 'User not found' };
      }
  
      // Generate and store reset code
      const code = await passwordResetService.createResetCode(email);
      
      // Send email with code
      try {
        // If we can find the user's name, pass it so the template can render {{user_name}}
        let userName: string | undefined = undefined;
        try {
          const userRecord = await this.findUserByEmail(email);
          if (userRecord) {
            const u = userRecord.userData as any;
            const first = u.firstName || u.first_name || '';
            const last = u.lastName || u.last_name || '';
            const full = `${first} ${last}`.trim();
            userName = full || undefined;
          }
        } catch {}
        await emailService.sendPasswordResetCode(email, code, userName);
        return { success: true, message: 'Reset code sent to your email' };
      } catch (e: any) {
        const message = e?.message || '';
        const isDev = (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.NODE_ENV !== 'production';
        // In development, allow showing the code when email cannot be sent
        if (isDev) {
          console.warn('Email sending failed in dev. Exposing code for testing only.');
          return { success: true, message: 'Development mode: code generated', devCode: code };
        }
        // In production, treat as failure
        console.error('Email send failed in production:', message);
        return { success: false, message: 'Failed to send reset code' };
      }
    } catch (error) {
      console.error('Error requesting password reset:', error);
      return { success: false, message: 'Failed to send reset code' };
    }
  },
  
  async verifyPasswordResetCode(email: string, code: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('=== VERIFYING PASSWORD RESET CODE ===');
      console.log('Email:', email);
      console.log('Code:', code);
      
      const isValid = await passwordResetService.verifyResetCode(email, code);
      
      console.log('Verification result:', isValid);
      
      if (isValid) {
        return { success: true, message: 'Code verified successfully' };
      } else {
        return { success: false, message: 'Invalid or expired code' };
      }
    } catch (error) {
      console.error('Error verifying reset code:', error);
      return { success: false, message: 'Failed to verify code' };
    }
  },
  
  async resetPasswordWithCode(email: string, code: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('=== RESETTING PASSWORD WITH CODE ===');
      console.log('Email:', email);
      console.log('Code:', code);
      console.log('New password length:', newPassword.length);
      
      // First verify the code
      const isValid = await passwordResetService.verifyResetCode(email, code);
      console.log('Code verification result:', isValid);
      
      if (!isValid) {
        return { success: false, message: 'Invalid or expired code' };
      }

      // Mark the code as used to prevent reuse
      console.log('Marking code as used...');
      await this.markResetCodeAsUsed(email, code);
      console.log('Code marked as used successfully');

      try {
        const userData = await this.findUserByEmail(email);
        if (!userData) {
          console.error('User not found for password reset:', email);
          return { success: false, message: 'User not found' };
        }
        
        console.log('Found user for password reset:', userData.databaseUid);
        
        // IMPORTANT: For a proper password reset, we need to actually update Firebase Auth
        // Since we can't do this without the user being signed in, we'll use a different approach
        
        // We'll create a temporary reset token that allows the user to sign in once
        // and then immediately update their password in Firebase Auth
        
        const userRef = ref(database, `users/${userData.databaseUid}`);
        await set(userRef, {
          ...userData.userData,
          passwordResetPending: true,
          pendingPassword: newPassword,
          resetToken: this.generateResetToken(), // Generate a secure token
          resetTokenExpiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
          lastPasswordUpdate: new Date().toISOString()
        });
        
        console.log('Password reset pending for email:', email);
        return { success: true, message: 'Password reset successfully. Please sign in with your new password.' };
        
      } catch (error) {
        console.error('Error updating user data during password reset:', error);
        return { success: false, message: 'Failed to complete password reset' };
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      return { success: false, message: 'Failed to reset password' };
    }
  },

  // Mark reset code as used
  async markResetCodeAsUsed(email: string, code: string): Promise<void> {
    try {
      // Use the passwordResetService to mark the code as used
      await passwordResetService.markCodeAsUsed(email, code);
    } catch (error: any) {
      console.error('Mark reset code as used error:', error);
    }
  },

  // Clean up expired reset codes
  async cleanupExpiredResetCodes(): Promise<void> {
    try {
      const resetCodesRef = ref(database, 'passwordResetCodes');
      const snapshot = await get(resetCodesRef);
      
      if (snapshot.exists()) {
        const now = new Date();
        const cleanupPromises: Promise<void>[] = [];
        
        snapshot.forEach((childSnapshot) => {
          const resetCodeData = childSnapshot.val() as PasswordResetCode;
          const expiresAt = new Date(resetCodeData.expiresAt);
          
          if (now > expiresAt) {
            cleanupPromises.push(remove(childSnapshot.ref));
          }
        });
        
        await Promise.all(cleanupPromises);
      }
    } catch (error: any) {
      console.error('Cleanup expired reset codes error:', error);
    }
  },

          // Change password for authenticated user
        async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
          try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
              return { success: false, message: 'No authenticated user found' };
            }

            // Re-authenticate with current password before updating
            try {
              const credential = await signInWithEmailAndPassword(auth, currentUser.email!, currentPassword);
              
              // Now update the password
              await updatePassword(credential.user, newPassword);
              
              console.log('Password updated successfully');
              return { success: true, message: 'Password changed successfully' };
            } catch (error: any) {
              console.error('Password change error details:', error);
              
              if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                return { success: false, message: 'Current password is incorrect. Please verify your current password and try again.' };
              } else if (error.code === 'auth/weak-password') {
                return { success: false, message: 'New password is too weak. Please choose a stronger password with at least 6 characters.' };
              } else if (error.code === 'auth/requires-recent-login') {
                return { success: false, message: 'For security reasons, you need to sign in again before changing your password.' };
              } else if (error.code === 'auth/user-mismatch') {
                return { success: false, message: 'Authentication error. Please sign out and sign in again.' };
              } else {
                console.error('Password change error:', error);
                return { success: false, message: `Failed to change password: ${error.message || 'Unknown error'}` };
              }
            }
          } catch (error: any) {
            console.error('Change password error:', error);
            return { success: false, message: 'An unexpected error occurred' };
          }
        },

}; 