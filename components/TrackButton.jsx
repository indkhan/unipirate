'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { buildApplicationSteps } from '@/lib/track-steps';
import { Button, Icon } from './ui';

// Track a course as an application. Only works with a live DB (course.dbId)
// and a signed-in user; otherwise it shows a sign-in prompt or hides.
export default function TrackButton({ course, university, profile }) {
  const router = useRouter();
  const { userId, loading: authLoading, configured, supabase } = useAuth();
  const available = configured && !!course?.dbId;

  // Whether this course is already tracked, and which user we resolved it for
  // (so we can show a spinner-free "checking" gate without setState-in-effect).
  const [tracked, setTracked] = useState(false);
  const [checkedFor, setCheckedFor] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!available || authLoading || !userId) return;
    let active = true;
    (async () => {
      const { data: existing } = await supabase
        .from('tracked_applications')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', course.dbId)
        .maybeSingle();
      if (active) {
        setTracked(!!existing);
        setCheckedFor(userId);
      }
    })();
    return () => { active = false; };
  }, [available, authLoading, userId, course?.dbId, supabase]);

  async function onTrack() {
    if (!userId) {
      router.push('/login');
      return;
    }
    setBusy(true);
    try {
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

  // Hide until tracking is possible and (for signed-in users) the lookup is done.
  if (!available || authLoading) return null;
  if (userId && checkedFor !== userId) return null;

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
