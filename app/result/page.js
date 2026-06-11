'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TopNav from '@/components/TopNav';
import { Button, Badge, Icon, Stepper } from '@/components/ui';
import { RECOGNITION_RULES } from '@/lib/seed-data';
import { matchRecognitionRule, resolveRecognition, mergeRecognitionRules } from '@/lib/nc';
import { loadProfile, loadProfileDb } from '@/lib/profile';
import { useAuth } from '@/lib/auth-context';

const TONE = {
  'H+': 'emerald',
  'H+ (subject-restricted)': 'emerald',
  'H+/-': 'amber',
  'H-': 'coral',
  UNCLEAR: 'slate',
};
const TITLE = {
  'H+': 'Direct access',
  'H+ (subject-restricted)': 'Direct access (subject-restricted)',
  'H+/-': 'Conditional access',
  'H-': 'Not sufficient on its own',
  UNCLEAR: 'Manual check recommended',
};

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function InfoCard({ kicker, title, body }) {
  return (
    <div className="rounded-xl border border-line bg-white p-6 md:p-8 h-full">
      <div className="flex items-baseline gap-4 mb-4">
        <span className="text-[12px] uppercase tracking-[0.18em] text-ink-40">{kicker}</span>
        <div className="text-[22px] text-ink-90" style={{ fontFamily: "'Instrument Serif', serif" }}>
          {title}
        </div>
      </div>
      <div className="text-[14px] text-ink-70 leading-[1.65]">{body}</div>
    </div>
  );
}

function ActionList({ links = [] }) {
  const kindIcon = { aps: 'check', kolleg: 'book', apply: 'external', manual: 'info' };
  const kindLabel = { aps: 'APS info', kolleg: 'Studienkolleg', apply: 'Application portal', manual: 'Reference' };
  return (
    <div className="space-y-2">
      {links.map((l, i) => (
        <a
          key={i}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-md border border-line bg-paper px-4 py-3 hover:border-navy/40 hover:bg-white transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="h-7 w-7 rounded-md bg-navy/8 text-navy inline-flex items-center justify-center">
              <Icon name={kindIcon[l.kind] || 'external'} size={14} />
            </span>
            <div>
              <div className="text-[13.5px] text-ink-90 font-medium">{l.label}</div>
              <div className="text-[11.5px] text-ink-50">{kindLabel[l.kind] || 'External'}</div>
            </div>
          </div>
          <Icon name="external" size={14} className="text-ink-50" />
        </a>
      ))}
    </div>
  );
}

export default function ResultPage() {
  const router = useRouter();
  const { userId, loading: authLoading, supabase } = useAuth();
  const [profile, setProfile] = useState(null);
  const [rules, setRules] = useState(RECOGNITION_RULES);

  // Recognition rules are public — fetch them independently of auth.
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase
      .from('recognition_rules')
      .select('*')
      .then(({ data }) => {
        if (active && data?.length) setRules(mergeRecognitionRules(data, RECOGNITION_RULES));
      });
    return () => { active = false; };
  }, [supabase]);

  // Resolve which profile to display once we know who's signed in.
  // Arriving from a profile edit (?from=onboarding) → trust the just-saved
  // localStorage copy. A plain navbar/direct visit → read the DB as the source
  // of truth (falling back to localStorage only when there's none).
  useEffect(() => {
    if (authLoading) return;
    let active = true;
    (async () => {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const fromProfile = params?.get('from') === 'onboarding';
      const local = loadProfile();
      const hasLocal = !!(local && local.country && local.qualification);

      if (userId && supabase && (!fromProfile || !hasLocal)) {
        const dbProfile = await loadProfileDb(supabase, userId);
        if (active && dbProfile) {
          setProfile(dbProfile);
          return;
        }
      }
      if (active) setProfile(local);
    })();
    return () => { active = false; };
  }, [authLoading, userId, supabase]);

  if (!profile) return null;

  const matched = matchRecognitionRule(profile, rules);
  const rule = matched ? resolveRecognition(matched, profile) : null;

  if (!rule) {
    return (
      <div className="min-h-screen bg-paper">
        <TopNav />
        <main className="max-w-[920px] mx-auto px-6 py-16 text-center text-ink-60">
          Please complete your profile first.
          <div className="mt-4">
            <Button onClick={() => router.push('/onboarding')}>Go to profile</Button>
          </div>
        </main>
      </div>
    );
  }

  const tone = TONE[rule.status] || 'slate';
  const statusTitle = TITLE[rule.status] || rule.status;

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />
      <main className="max-w-[1040px] mx-auto px-6 md:px-10 pt-10 pb-24">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/onboarding')}
              icon={<Icon name="arrowLeft" size={14} />}
            >
              Edit profile
            </Button>
            <h1
              className="text-[40px] md:text-[48px] text-ink-90 leading-[1.05] mt-3"
              style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.02em' }}
            >
              Your recognition result.
            </h1>
          </div>
          <Stepper steps={['Profile', 'Recognition', 'Courses']} current={1} />
        </div>

        {/* Summary card */}
        <div className="rounded-xl border border-line bg-white overflow-hidden">
          <div className="p-6 md:p-8 grid md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-8">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <Badge tone={tone}>{statusTitle}</Badge>
                <Badge tone="neutral">
                  <Icon name="globe" size={11} /> {profile.country}
                </Badge>
                <Badge tone="neutral">
                  <Icon name="book" size={11} /> {truncate(profile.qualification, 40)}
                </Badge>
                {rule.needs_aps && <Badge tone="navy">APS required</Badge>}
              </div>
              <div
                className="text-[30px] md:text-[36px] text-ink-90 leading-[1.1]"
                style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.015em' }}
              >
                {rule.headline}
              </div>
              <p className="mt-4 text-[14.5px] leading-[1.65] text-ink-70 max-w-[640px]">
                {rule.explanation}
              </p>
            </div>
            <div className="md:col-span-4 flex md:justify-end">
              <div className="inline-flex flex-col items-center gap-3 p-5 rounded-lg border border-line bg-paper min-w-[180px]">
                <div className="text-[10.5px] uppercase tracking-[0.18em] text-ink-40">Status code</div>
                <div className="text-[26px] text-ink-90" style={{ fontFamily: "'Instrument Serif', serif" }}>
                  {rule.status}
                </div>
                {rule.anabin_url && (
                  <a
                    href={rule.anabin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-navy font-medium inline-flex items-center gap-1 hover:underline"
                  >
                    Verify on anabin <Icon name="external" size={11} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* APS callout */}
        {rule.needs_aps && (
          <div className="mt-4 rounded-xl border border-navy/15 bg-navy/[0.035] p-5 flex items-start gap-3">
            <span className="h-7 w-7 shrink-0 rounded-md bg-navy/10 text-navy inline-flex items-center justify-center">
              <Icon name="check" size={14} />
            </span>
            <div className="text-[13.5px] text-ink-75 leading-[1.6]">
              <b className="text-ink-90">APS certificate is mandatory</b> for applicants from your country — start
              this early, it’s required before you can apply to universities or a Studienkolleg.
            </div>
          </div>
        )}

        {/* Info cards */}
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <InfoCard
            kicker="01"
            title="What this means"
            body={rule.explanation}
          />
          <InfoCard
            kicker="02"
            title="Recommended actions"
            body={<ActionList links={rule.action_links} />}
          />
        </div>

        {/* Next steps */}
        <div className="rounded-xl border border-line bg-white p-6 md:p-8 mt-4">
          <div className="flex items-baseline gap-4 mb-5">
            <span className="text-[12px] uppercase tracking-[0.18em] text-ink-40">03</span>
            <div className="text-[22px] text-ink-90" style={{ fontFamily: "'Instrument Serif', serif" }}>
              Next steps
            </div>
          </div>
          <ol className="space-y-3">
            {(rule.next_steps || []).map((s, i) => (
              <li key={i} className="flex gap-4 items-start">
                <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full border border-line bg-paper inline-flex items-center justify-center text-[11px] text-ink-60">
                  {i + 1}
                </span>
                <span className="text-[14px] text-ink-80 leading-[1.6]">{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-8 flex items-center justify-between flex-wrap gap-3">
          <div className="text-[12px] text-ink-50 max-w-[560px] leading-snug">
            This is guidance based on curated anabin-based rules — not an official decision. Only the university,
            uni-assist, or anabin can confirm your case. Always verify on the
            {' '}
            <a href={rule.anabin_url || 'https://anabin.kmk.org/anabin.html'} target="_blank" rel="noopener noreferrer" className="text-navy hover:underline">
              official anabin database
            </a>{' '}
            before applying.
          </div>
          <Button size="lg" onClick={() => router.push('/finder')} icon={<Icon name="arrowRight" size={16} />}>
            Continue to course finder
          </Button>
        </div>
      </main>
    </div>
  );
}
