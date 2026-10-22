import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../services/supabaseService';

export interface SocialLinks {
  twitter?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  website?: string;
}

export interface PillConfig {
  id: string;
  type: 'category' | 'custom';
  label?: string;      // for custom pills
  keywords?: string;   // for custom pills (search keywords)
}

export interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  social_links: SocialLinks;
  avatar_url: string | null;
  avatar_type: 'initial' | 'character' | 'upload';
  avatar_character: string | null;
  theme: string | null;
  background_color: string | null;
  pills: PillConfig[] | null;
  use_viewer_theme_for_boards: boolean;
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
  updateProfile: (updates: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string>;
  uploadAvatarFile: (file: File) => Promise<string>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
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

  // Fetch profile when user changes (create one if the signup trigger missed it)
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !session?.user) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    const userId = session.user.id;
    client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(async ({ data }) => {
        if (cancelled) return;
        const meta = session.user.user_metadata || {};
        const oauthAvatar = meta.avatar_url || meta.picture || null;
        if (data) {
          setProfile(data as Profile);
          return;
        }
        // No row (e.g. signed up before the trigger existed) — create it
        const displayName =
          meta.full_name || meta.name || (session.user.email || '').split('@')[0] || null;
        const { data: created } = await client
          .from('profiles')
          .upsert(
            {
              id: userId,
              display_name: displayName,
              avatar_url: oauthAvatar,
            },
            { onConflict: 'id' }
          )
          .select()
          .single();
        if (!cancelled && created) setProfile(created as Profile);
      });
    return () => {
      cancelled = true;
    };
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

  const updateProfile = async (updates: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>) => {
    const client = getSupabaseClient();
    if (!client || !session?.user) throw new Error('Not signed in');
    // Upsert so saving works even if the profile row is missing
    const { data, error } = await client
      .from('profiles')
      .upsert({ id: session.user.id, ...updates }, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    if (data) setProfile(data as Profile);
  };

  // Uploads the file to storage and returns the public URL (does NOT save to profile)
  const uploadAvatarFile = async (file: File): Promise<string> => {
    const client = getSupabaseClient();
    if (!client || !session?.user) throw new Error('Not signed in');

    // Validate file type and size (max 2MB)
    if (!file.type.startsWith('image/')) throw new Error('Please choose an image file');
    if (file.size > 2 * 1024 * 1024) throw new Error('Image must be under 2MB');

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${session.user.id}/avatar.${ext}`;

    const { error: uploadError } = await client.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) throw uploadError;

    const { data } = client.storage.from('avatars').getPublicUrl(path);
    // Cache-bust with timestamp
    return `${data.publicUrl}?t=${Date.now()}`;
  };

  const uploadAvatar = async (file: File): Promise<string> => {
    const url = await uploadAvatarFile(file);
    await updateProfile({ avatar_url: url, avatar_type: 'upload' });
    return url;
  };

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase not configured');
    const normalized = username.toLowerCase().trim();
    if (!/^[a-z0-9_]{3,30}$/.test(normalized)) return false;

    const { data, error } = await client
      .from('profiles')
      .select('id')
      .eq('username', normalized)
      .neq('id', session?.user?.id || '')
      .limit(1);
    if (error) throw error;
    return !data || data.length === 0;
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
        uploadAvatar,
        uploadAvatarFile,
        checkUsernameAvailable,
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
