import { useState, useEffect, createContext, useContext } from 'react';
import { UserProfile, authService } from '@/services/api/auth';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<UserProfile | null>;
  signOut: () => Promise<void>;
  signUp: (signUpData: any) => Promise<{ user: any; userProfile: UserProfile }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const userProfile = await authService.getCompleteUserProfile(firebaseUser.uid);
        setUser(userProfile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    const userProfile = await authService.signIn(email, password);
    
    if (userProfile && !userProfile.uid.startsWith('static-')) {
      const completeProfile = await authService.getCompleteUserProfile(userProfile.uid);
      if (completeProfile) {
        setUser(completeProfile);
        return completeProfile;
      }
    }
    
    setUser(userProfile);
    return userProfile;
  };

  const signOut = async () => {
    await authService.signOut();
    setUser(null);
  };

  const signUp = async (signUpData: any) => {
    const result = await authService.signUp(signUpData);
    setUser(result.userProfile);
    return result;
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, signUp }}>
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