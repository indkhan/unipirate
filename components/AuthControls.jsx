'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Badge, Icon, Button } from './ui';

export default function AuthControls() {
  const router = useRouter();
  const { user, loading, configured, supabase } = useAuth();

  async function signOut() {
    await supabase.auth.signOut(); // onAuthStateChange clears the shared user
    router.push('/');
    router.refresh();
  }

  // Before Supabase is configured, keep the original demo badge.
  if (!configured) {
    return (
      <Badge tone="neutral">
        <Icon name="sparkle" size={11} /> Demo
      </Badge>
    );
  }

  if (loading) return <div className="h-9 w-20" aria-hidden />;

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
