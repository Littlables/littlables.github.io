import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../services/supabaseService';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<Profile, 'display_name' | 'avatar_url'>>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setLoading(false);
      return;
    }

    // Get initial session
    client.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch profile when user changes
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !session?.user) {
      setProfile(null);
      return;
    }

    client
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as Profile);
      });
  }, [session?.user?.id]);

  const signInWithGoogle = async () => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase not configured');
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signInWithEmail = async (email: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase not configured');
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        // Use 6-digit code instead of magic link (better for mobile)
        shouldCreateUser: true,
      },
    });
    if (error) throw error;
  };

  const verifyEmailOtp = async (email: string, token: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase not configured');
    const { error } = await client.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Pick<Profile, 'display_name' | 'avatar_url'>>) => {
    const client = getSupabaseClient();
    if (!client || !session?.user) throw new Error('Not signed in');
    const { data, error } = await client
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id)
      .select()
      .single();
    if (error) throw error;
    if (data) setProfile(data as Profile);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signInWithGoogle,
        signInWithEmail,
        verifyEmailOtp,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
