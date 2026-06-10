'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TopNav from '@/components/TopNav';
import { Button, Icon, Field, TextInput } from '@/components/ui';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const configured = isSupabaseConfigured();

  async function ensureProfile(supabase, userId) {
    if (!userId) return;
    await supabase.from('profiles').upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (data.session) {
          await ensureProfile(supabase, data.user?.id);
          router.push('/dashboard');
          router.refresh();
        } else {
          setMsg('Check your email to confirm your account, then sign in.');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await ensureProfile(supabase, data.user?.id);
        router.push('/dashboard');
        router.refresh();
      }
    } catch (e) {
      setErr(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setErr(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (e) {
      setErr(e.message || 'Google sign-in failed.');
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />
      <main className="max-w-[440px] mx-auto px-6 pt-16 pb-24">
        <h1
          className="text-[40px] text-ink-90 leading-tight"
          style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.02em' }}
        >
          {mode === 'signup' ? 'Create your account.' : 'Welcome back.'}
        </h1>
        <p className="mt-2 text-[14px] text-ink-60">
          Save your profile, track applications, and keep your roadmap in one place.
        </p>

        {!configured && (
          <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-800">
            Authentication isn’t configured yet. Add your Supabase keys to <code>.env.local</code> to enable sign-in.
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field label="Email" required>
            <TextInput value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
          </Field>
          <Field label="Password" required>
            <TextInput value={password} onChange={setPassword} type="password" placeholder="••••••••" />
          </Field>

          {err && <div className="text-[13px] text-red-600">{err}</div>}
          {msg && <div className="text-[13px] text-emerald-700">{msg}</div>}

          <Button type="submit" size="lg" disabled={busy || !configured} className="w-full justify-center">
            {busy ? 'Working…' : mode === 'signup' ? 'Sign up' : 'Sign in'}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-[12px] text-ink-40">
          <div className="h-px flex-1 bg-line" /> or <div className="h-px flex-1 bg-line" />
        </div>

        <Button
          variant="secondary"
          size="lg"
          onClick={onGoogle}
          disabled={!configured}
          className="w-full justify-center"
          icon={<Icon name="globe" size={15} />}
        >
          Continue with Google
        </Button>

        <div className="mt-6 text-center text-[13px] text-ink-60">
          {mode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setErr(null); setMsg(null); }}
            className="text-navy font-medium hover:underline"
          >
            {mode === 'signup' ? 'Sign in' : 'Create an account'}
          </button>
        </div>
      </main>
    </div>
  );
}
