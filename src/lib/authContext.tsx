import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  displayName: string;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (data: ProfileData, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

interface ProfileRow {
  first_name: string | null;
  last_name: string | null;
  username: string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function nameFromGoogleMeta(meta: Record<string, unknown>): { first: string; last: string } {
  const full = (meta.full_name as string) ?? (meta.name as string) ?? '';
  if (full.trim()) {
    const parts = full.trim().split(/\s+/);
    const first = parts[0] ?? '';
    const last = parts.slice(1).join(' ');
    return { first, last };
  }
  const given = (meta.given_name as string) ?? '';
  const family = (meta.family_name as string) ?? '';
  return { first: given, last: family };
}

async function ensureProfileRow(user: User): Promise<ProfileRow | null> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('first_name, last_name, username')
    .eq('id', user.id)
    .maybeSingle();

  if (existing) return existing as ProfileRow;

  // No profile row yet — create one from available auth metadata
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  let first = (meta.first_name as string) ?? '';
  let last = (meta.last_name as string) ?? '';

  // For Google users, extract from full_name if first/last not directly present
  if (!first && !last) {
    const extracted = nameFromGoogleMeta(meta);
    first = extracted.first;
    last = extracted.last;
  }

  const row = {
    id: user.id,
    email: user.email ?? '',
    first_name: first,
    last_name: last,
    username: (meta.username as string) ?? (meta.preferred_username as string) ?? null,
  };

  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' });
  if (error) {
    // If upsert fails (e.g. unique username conflict), try without username
    const { error: retryErr } = await supabase.from('profiles').upsert(
      { id: user.id, email: user.email ?? '', first_name: first, last_name: last },
      { onConflict: 'id' },
    );
    if (retryErr) return null;
  }

  return { first_name: first, last_name: last, username: row.username };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        setSession(newSession);
        if (!newSession) {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => { listener.subscription.unsubscribe(); };
  }, []);

  // Fetch or create profile whenever session user changes
  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    (async () => {
      const row = await ensureProfileRow(session.user!);
      if (!cancelled) {
        setProfile(row);
        setProfileLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const displayName = (() => {
    if (!session?.user) return '';
    if (profileLoading) return '';
    const first = (profile?.first_name ?? '').trim();
    const last = (profile?.last_name ?? '').trim();
    const full = `${first} ${last}`.trim();
    if (full) return full;
    // Fallback: try user_metadata (Google may have full_name)
    const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
    const metaName = ((meta.full_name as string) ?? (meta.name as string) ?? '').trim();
    if (metaName) return metaName;
    return 'User';
  })();

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (data: ProfileData, password: string) => {
    const { data: res, error } = await supabase.auth.signUp({
      email: data.email,
      password,
      options: {
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          username: data.username,
        },
      },
    });

    if (error) return { error: error.message };

    // If the user is immediately authenticated (email confirmation off), save profile
    if (res.user) {
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: res.user.id,
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        username: data.username || null,
      }, { onConflict: 'id' });
      if (profileErr) {
        // Profile creation failed but auth succeeded — the profile will be
        // created on first login via ensureProfileRow using user_metadata
      }
    }

    return { error: null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return { error: error?.message ?? null };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, displayName, loading: loading || profileLoading, signIn, signUp, signInWithGoogle, resetPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
