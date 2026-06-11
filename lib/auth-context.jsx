'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

// Single source of truth for the signed-in user on the client. Without this,
// every auth-aware component (nav, track button, onboarding, result) spun up
// its own browser client and called supabase.auth.getUser() on mount — one
// network round-trip each. The provider does it once and shares the result.
const AuthContext = createContext({
  user: null,
  userId: null,
  loading: true,
  configured: false,
  supabase: null,
});

export function AuthProvider({ children }) {
  const configured = isSupabaseConfigured();
  // One browser client for the whole tree; null when Supabase isn't set up.
  const [supabase] = useState(() => (configured ? createClient() : null));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data?.user ?? null);
      setLoading(false);
    });
    // Keep the shared user in sync on sign-in / sign-out across the app.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo(
    () => ({ user, userId: user?.id ?? null, loading, configured, supabase }),
    [user, loading, configured, supabase]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
