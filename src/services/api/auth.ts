import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { ref, set, get, child } from 'firebase/database';
import { auth, database } from '../../config/firebase';

// Static users for testing (keep these)
export const STATIC_USERS = {
  patient: {
    uid: 'static-patient-001',
    email: 'admin',
    password: 'admin',
    role: 'patient' as const,
    name: 'Mel Angelo Cortes',
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
    name: 'Dr. Sarah Johnson',
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
  name: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
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
  lastName: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  contactNumber: string;
  
  // Step 2 data
  emergencyContactName: string;
  relationship: string;
  emergencyContactNumber: string;
  
  // Step 3 data
  password: string;
}

export interface UserNode {
  address?: string;
  contactNumber?: string;
  createdAt: string;
  email: string;
  firstName: string;
  lastName: string;
  patientId?: string;
  role: 'patient' | 'specialist';
}

export interface PatientNode {
  bloodType?: string;
  createdAt: string;
  dateOfBirth?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  firstName: string;
  gender?: string;
  lastName: string;
  lastUpdated?: string;
  userId: string;
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

    // If not static user, try Firebase authentication
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
           name: `${userData.firstName} ${userData.lastName}`,
           phone: userData.contactNumber || undefined,
           address: userData.address || undefined,
           dateOfBirth: patientData?.dateOfBirth || undefined,
           gender: patientData?.gender || undefined,
           emergencyContact: patientData?.emergencyContact || undefined,
         };
         
         console.log('Created user profile from email lookup:', userProfile.name);
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
      
      // Prepare user node data with null safety
      const userNodeData: UserNode = {
        address: signUpData.address || '',
        contactNumber: signUpData.contactNumber || '',
        createdAt: currentTime,
        email: signUpData.email,
        firstName: signUpData.firstName,
        lastName: signUpData.lastName,
        patientId: patientId,
        role: 'patient'
      };
      
      // Prepare patient node data with null safety
      const patientNodeData: PatientNode = {
        createdAt: currentTime,
        dateOfBirth: signUpData.dateOfBirth || '',
        emergencyContact: signUpData.emergencyContactName ? {
          name: signUpData.emergencyContactName,
          phone: signUpData.emergencyContactNumber || '',
          relationship: signUpData.relationship || ''
        } : undefined,
        firstName: signUpData.firstName,
        gender: signUpData.gender || '',
        lastName: signUpData.lastName,
        lastUpdated: currentTime,
        userId: user.uid
      };
      
      // Store data in both nodes
      await Promise.all([
        set(ref(database, `users/${user.uid}`), userNodeData),
        set(ref(database, `patients/${user.uid}`), patientNodeData)
      ]);
      
      // Create user profile for return with null safety
      const userProfile: UserProfile = {
        uid: user.uid,
        email: user.email!,
        role: 'patient',
        name: `${signUpData.firstName} ${signUpData.lastName}`,
        phone: signUpData.contactNumber || undefined,
        dateOfBirth: signUpData.dateOfBirth || undefined,
        gender: signUpData.gender || undefined,
        address: signUpData.address || undefined,
        emergencyContact: signUpData.emergencyContactName ? {
          name: signUpData.emergencyContactName,
          phone: signUpData.emergencyContactNumber || '',
          relationship: signUpData.relationship || ''
        } : undefined
      };
      
      return { user, userProfile };
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
          name: `${userData.firstName} ${userData.lastName}`,
          phone: userData.contactNumber || undefined,
          address: userData.address || undefined,
          // Note: dateOfBirth and emergencyContact are in patients node
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
          name: `${userData.firstName} ${userData.lastName}`,
          phone: userData.contactNumber || undefined,
          address: userData.address || undefined,
          dateOfBirth: patientData?.dateOfBirth || undefined,
          gender: patientData?.gender || undefined,
          emergencyContact: patientData?.emergencyContact || undefined,
        };
        
        console.log('Created complete user profile:', userProfile.name);
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
  }
}; 