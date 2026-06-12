import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RECOGNITION_RULES } from '@/lib/seed-data';
import { matchRecognitionRule, resolveRecognition } from '@/lib/nc';
import { profileFromRow } from '@/lib/profile';
import TopNav from '@/components/TopNav';
import StepChecklist from '@/components/StepChecklist';
import ProgressChecklist from '@/components/ProgressChecklist';
import { Button, Badge, Icon } from '@/components/ui';

const TONE = {
  'H+': 'emerald',
  'H+ (subject-restricted)': 'emerald',
  'H+/-': 'amber',
  'H-': 'coral',
  UNCLEAR: 'slate',
};

function NotConfigured() {
  return (
    <div className="min-h-screen bg-paper">
      <TopNav />
      <main className="max-w-[640px] mx-auto px-6 pt-20 text-center text-ink-60">
        The dashboard needs Supabase configured. Add your keys to <code>.env.local</code> and sign in.
      </main>
    </div>
  );
}

export default async function DashboardPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return <NotConfigured />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profileRow }, { data: ruleRows }, { data: apps }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('recognition_rules').select('*'),
    supabase
      .from('tracked_applications')
      .select(
        'id, status, created_at, course:courses(*, university:universities(*)), steps:application_steps(*)'
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  const profile = profileFromRow(profileRow);
  const rules = ruleRows?.length ? ruleRows : RECOGNITION_RULES;
  const matched = profile ? matchRecognitionRule(profile, rules) : null;
  const verdict = matched ? resolveRecognition(matched, profile) : null;
  const applications = apps || [];

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />
      <main className="max-w-[1040px] mx-auto px-6 md:px-10 pt-10 pb-24">
        <h1
          className="text-[40px] md:text-[48px] text-ink-90 leading-[1.05]"
          style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.02em' }}
        >
          Your dashboard.
        </h1>

        {/* Recognition summary */}
        <div className="mt-6 rounded-xl border border-line bg-white p-6 md:p-7">
          {verdict ? (
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge tone={TONE[verdict.status] || 'slate'}>{verdict.status}</Badge>
                  <Badge tone="neutral">
                    <Icon name="globe" size={11} /> {profile.country}
                  </Badge>
                  {verdict.needs_aps && <Badge tone="navy">APS required</Badge>}
                </div>
                <div className="text-[22px] text-ink-90" style={{ fontFamily: "'Instrument Serif', serif" }}>
                  {verdict.headline}
                </div>
              </div>
              <Link href="/result">
                <Button variant="secondary" size="sm" icon={<Icon name="arrowRight" size={14} />}>
                  View recognition
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="text-[14px] text-ink-60">Complete your profile to see your recognition verdict.</div>
              <Link href="/onboarding">
                <Button size="sm" icon={<Icon name="arrowRight" size={14} />}>Complete profile</Button>
              </Link>
            </div>
          )}
        </div>

        {/* Progress / to-do checklist */}
        <div className="mt-8">
          <ProgressChecklist
            profile={profile}
            verdict={verdict}
            initialOverrides={profileRow?.checklist_overrides || {}}
            variant="dashboard"
          />
        </div>

        {/* Tracked applications */}
        <div className="mt-8 flex items-baseline justify-between">
          <h2 className="text-[20px] text-ink-90" style={{ fontFamily: "'Instrument Serif', serif" }}>
            Tracked applications · {applications.length}
          </h2>
          <Link href="/finder" className="text-[13px] text-navy font-medium hover:underline inline-flex items-center gap-1">
            Browse courses <Icon name="arrowRight" size={12} />
          </Link>
        </div>

        {applications.length === 0 ? (
          <div className="mt-4 rounded-xl border border-line border-dashed bg-paper p-10 text-center">
            <div className="text-[15px] text-ink-70">No applications tracked yet.</div>
            <p className="text-[13px] text-ink-50 mt-1">
              Open a course in the finder and hit “Track application” to build your roadmap here.
            </p>
            <div className="mt-4">
              <Link href="/finder">
                <Button icon={<Icon name="arrowRight" size={14} />}>Find courses</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {applications.map((app) => {
              const course = app.course;
              const uni = course?.university;
              return (
                <div key={app.id} className="rounded-xl border border-line bg-white p-6 grid md:grid-cols-12 gap-6">
                  <div className="md:col-span-7">
                    <div className="text-[12px] uppercase tracking-[0.16em] text-ink-40 mb-1">
                      {uni?.name} · {uni?.city}
                    </div>
                    <div className="text-[22px] text-ink-90 leading-tight" style={{ fontFamily: "'Instrument Serif', serif" }}>
                      {course?.name}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge tone="navy">{course?.degree}</Badge>
                      <Badge tone="neutral">
                        <Icon name="globe" size={11} /> {course?.language}
                      </Badge>
                      {course?.nc_free ? <Badge tone="emerald">NC-free</Badge> : course?.nc_value_label && (
                        <Badge tone="amber">NC · {course.nc_value_label}</Badge>
                      )}
                    </div>
                    <div className="mt-4 rounded-lg border border-navy/15 bg-navy/[0.035] px-4 py-3 inline-flex items-center gap-2">
                      <Icon name="calendar" size={13} className="text-navy" />
                      <span className="text-[13px] text-ink-80">
                        Deadline · {course?.application_deadline || 'see university page'}
                      </span>
                    </div>
                  </div>
                  <div className="md:col-span-5">
                    <div className="text-[12px] uppercase tracking-[0.16em] text-ink-40 mb-3">Your roadmap</div>
                    <StepChecklist steps={app.steps || []} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
