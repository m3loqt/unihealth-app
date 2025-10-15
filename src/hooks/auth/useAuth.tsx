import { useState, useEffect, createContext, useContext } from 'react';
import { UserProfile, authService } from '@/services/api/auth';
import { onlineStatusService } from '@/services/onlineStatusService';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  emailVerified: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; userProfile?: UserProfile; error?: { type: string; message: string; suggestion?: string } }>;
  signOut: () => Promise<void>;
  signUp: (signUpData: any) => Promise<{ user: any; userProfile: UserProfile }>;
  checkEmailVerification: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const userProfile = await authService.getCompleteUserProfile(firebaseUser.uid);
        setUser(userProfile);
        setEmailVerified(firebaseUser.emailVerified);
        
        // Initialize online status when user logs in
        try {
          await onlineStatusService.initializeUserStatus(firebaseUser.uid);
          console.log('✅ Online status initialized for user:', firebaseUser.uid);
        } catch (error) {
          console.error('❌ Failed to initialize online status:', error);
        }
      } else {
        // Clean up online status when user logs out
        if (user?.uid) {
          try {
            await onlineStatusService.cleanupUserStatus(user.uid);
            console.log('✅ Online status cleaned up for user:', user.uid);
          } catch (error) {
            console.error('❌ Failed to cleanup online status:', error);
          }
        }
        
        setUser(null);
        setEmailVerified(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.uid]);

  const signIn = async (email: string, password: string) => {
    const result = await authService.signIn(email, password);
    
    if (result.success && result.userProfile) {
      if (!result.userProfile.uid.startsWith('static-')) {
        const completeProfile = await authService.getCompleteUserProfile(result.userProfile.uid);
        if (completeProfile) {
          setUser(completeProfile);
          return { success: true, userProfile: completeProfile };
        }
      }
      
      setUser(result.userProfile);
      return { success: true, userProfile: result.userProfile };
    }
    
    // Return the error result
    return result;
  };

  const signOut = async () => {
    // Clean up online status before signing out
    if (user?.uid) {
      try {
        await onlineStatusService.cleanupUserStatus(user.uid);
        console.log('✅ Online status cleaned up during sign out for user:', user.uid);
      } catch (error) {
        console.error('❌ Failed to cleanup online status during sign out:', error);
      }
    }
    
    await authService.signOut();
    setUser(null);
  };

  const signUp = async (signUpData: any) => {
    const result = await authService.signUp(signUpData);
    setUser(result.userProfile);
    return result;
  };

  const checkEmailVerification = async (): Promise<boolean> => {
    try {
      const { auth } = await import('../../config/firebase');
      if (auth.currentUser) {
        const isVerified = await authService.checkEmailVerificationStatus(auth.currentUser);
        setEmailVerified(isVerified);
        return isVerified;
      }
      return false;
    } catch (error) {
      console.error('Check email verification error:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, emailVerified, signIn, signOut, signUp, checkEmailVerification }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 