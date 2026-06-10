'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { Badge, Icon, Button } from './ui';

export default function AuthControls() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setReady(true);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
    router.refresh();
  }

  // Before Supabase is configured, keep the original demo badge.
  if (!isSupabaseConfigured()) {
    return (
      <Badge tone="neutral">
        <Icon name="sparkle" size={11} /> Demo
      </Badge>
    );
  }

  if (!ready) return <div className="h-9 w-20" aria-hidden />;

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-line bg-paper hover:border-navy/40 text-[12.5px] text-ink-70"
        >
          <Icon name="user" size={13} />
          <span className="max-w-[140px] truncate">{user.email}</span>
        </Link>
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={() => router.push('/login')} icon={<Icon name="user" size={13} />}>
      Sign in
    </Button>
  );
}
