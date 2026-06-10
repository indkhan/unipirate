'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { buildApplicationSteps } from '@/lib/track-steps';
import { Button, Icon } from './ui';

// Track a course as an application. Only works with a live DB (course.dbId)
// and a signed-in user; otherwise it shows a sign-in prompt or hides.
export default function TrackButton({ course, university, profile }) {
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [ready, setReady] = useState(false);
  const [tracked, setTracked] = useState(false);
  const [busy, setBusy] = useState(false);

  const available = isSupabaseConfigured() && !!course?.dbId;

  useEffect(() => {
    if (!available) {
      setReady(true);
      return;
    }
    let active = true;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id ?? null;
      if (!active) return;
      setUserId(uid);
      if (uid) {
        const { data: existing } = await supabase
          .from('tracked_applications')
          .select('id')
          .eq('user_id', uid)
          .eq('course_id', course.dbId)
          .maybeSingle();
        if (active) setTracked(!!existing);
      }
      if (active) setReady(true);
    })();
    return () => { active = false; };
  }, [available, course?.dbId]);

  async function onTrack() {
    if (!userId) {
      router.push('/login');
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: app, error } = await supabase
        .from('tracked_applications')
        .insert({ user_id: userId, course_id: course.dbId })
        .select('id')
        .single();
      if (error) throw error;
      const steps = buildApplicationSteps(profile?.country, university?.applyMethod).map((s) => ({
        ...s,
        tracked_app_id: app.id,
      }));
      if (steps.length) await supabase.from('application_steps').insert(steps);
      setTracked(true);
    } catch (e) {
      console.error('track failed:', e.message || e);
    } finally {
      setBusy(false);
    }
  }

  if (!available || !ready) return null;

  if (tracked) {
    return (
      <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard')} icon={<Icon name="check" size={14} />}>
        Tracking · view
      </Button>
    );
  }

  return (
    <Button variant="secondary" size="sm" onClick={onTrack} disabled={busy} icon={<Icon name="bookmark" size={14} />}>
      {busy ? 'Adding…' : userId ? 'Track application' : 'Sign in to track'}
    </Button>
  );
}
