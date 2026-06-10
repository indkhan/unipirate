'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TopNav from '@/components/TopNav';
import {
  Button, Badge, Icon, Field, Select, TextInput, Segmented, Chip, Toggle, Stepper, cx,
} from '@/components/ui';
import {
  COUNTRIES, QUALIFICATIONS_BY_COUNTRY, GRADING_SCALES, LANGUAGE_CERTS,
} from '@/lib/repo';
import {
  loadProfile, saveProfile, loadProfileDb, saveProfileDb, BLANK_PROFILE,
  A_LEVEL_LETTERS, aLevelAverage, parseALevels, serializeALevels,
} from '@/lib/profile';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

function inferSuffix(scale) {
  if (!scale) return '';
  if (scale.startsWith('Percentage')) return '%';
  if (scale.startsWith('CGPA out of 10')) return '/ 10';
  if (scale.startsWith('CGPA out of 4')) return '/ 4';
  if (scale.startsWith('German')) return '/ 6.0';
  if (scale.startsWith('IB')) return '/ 45';
  return '';
}

function scoreHint(cert) {
  if (!cert) return null;
  return (
    {
      IELTS: 'Overall band, e.g. 6.5',
      'TOEFL (iBT)': 'Total score, e.g. 95',
      TestDaF: 'Per section, e.g. 4×4',
      DSH: 'Level, e.g. DSH-2',
      'None / planning to take': 'You can still continue.',
    }[cert] || null
  );
}

function scorePlaceholder(cert) {
  return (
    {
      IELTS: '6.5',
      'TOEFL (iBT)': '95',
      TestDaF: '4×4',
      DSH: 'DSH-2',
      'None / planning to take': '—',
    }[cert] || 'Score'
  );
}

function SectionHeader({ n, title, subtitle }) {
  return (
    <div className="flex items-baseline gap-4 mb-5">
      <span
        className="text-[12px] uppercase tracking-[0.18em] text-ink-40"
        style={{ fontFeatureSettings: "'tnum'" }}
      >
        {n}
      </span>
      <div>
        <div
          className="text-[20px] text-ink-90 leading-tight"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          {title}
        </div>
        <div className="text-[12.5px] text-ink-50">{subtitle}</div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="my-8 border-t border-line" />;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(BLANK_PROFILE);
  const [userId, setUserId] = useState(null);

  // Load the profile: from the DB when signed in, else from localStorage.
  useEffect(() => {
    let active = true;
    (async () => {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        const uid = data?.user?.id ?? null;
        if (!active) return;
        setUserId(uid);
        if (uid) {
          const dbProfile = await loadProfileDb(supabase, uid);
          if (!active) return;
          if (dbProfile) {
            setProfile(dbProfile);
            return;
          }
        }
      }
      if (active) setProfile(loadProfile());
    })();
    return () => { active = false; };
  }, []);

  // Mirror to localStorage so anon browsing + the result page stay in sync.
  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  const update = (patch) => setProfile((p) => ({ ...p, ...patch }));

  async function handleSubmit() {
    saveProfile(profile);
    if (userId && isSupabaseConfigured()) {
      await saveProfileDb(createClient(), userId, profile);
    }
    router.push('/result');
  }
  const country = profile.country;
  const availableQuals = country ? QUALIFICATIONS_BY_COUNTRY[country] || [] : [];
  const isALevel = profile.qualification === 'GCE A-Levels';
  const isIB = profile.qualification === 'IB Diploma';

  // Switching qualification clears any grade entry tied to the old type.
  const selectQualification = (v) =>
    update({
      qualification: v,
      grade: '',
      gradingScale: v === 'IB Diploma' ? 'IB points (0–45)' : v === 'GCE A-Levels' ? 'A-Level grades' : '',
      aLevelGrades: '',
      ibHlMath: false,
      ibHlScience: false,
    });

  // A-Level: up to 4 { subject, grade } rows backed by the JSON field.
  const aLevelRows = (() => {
    const rows = parseALevels(profile.aLevelGrades);
    while (rows.length < 4) rows.push({ subject: '', grade: '' });
    return rows.slice(0, 4);
  })();
  const setALevelRow = (i, patch) => {
    const rows = aLevelRows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    update({
      aLevelGrades: serializeALevels(rows),
      grade: aLevelAverage(rows),
      gradingScale: 'A-Level grades',
    });
  };

  const canSubmit =
    profile.country &&
    profile.qualification &&
    profile.grade !== '' &&
    profile.gradingScale &&
    profile.languageCert;

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />
      <main className="max-w-[920px] mx-auto px-6 md:px-10 pt-10 pb-24">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              icon={<Icon name="arrowLeft" size={14} />}
            >
              Back
            </Button>
            <h1
              className="text-[40px] md:text-[48px] text-ink-90 leading-[1.05] mt-3"
              style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.02em' }}
            >
              Tell us about your background.
            </h1>
            <p className="text-ink-60 mt-2 max-w-[560px] text-[14.5px] leading-[1.55]">
              We use this to match against curated anabin-based rules. Signed in, it’s saved to your account; otherwise it stays in your browser.
            </p>
          </div>
          <Stepper steps={['Profile', 'Recognition', 'Courses']} current={0} />
        </div>

        <div className="rounded-xl border border-line bg-white p-6 md:p-8">
          <SectionHeader n="01" title="Education" subtitle="Where and what you studied." />
          <div className="grid md:grid-cols-2 gap-5">
            <Field label="Country of education" required hint="Where you earned your most recent qualification.">
              <Select
                value={profile.country}
                onChange={(v) => update({ country: v, qualification: '' })}
                options={COUNTRIES}
                placeholder="Select a country"
              />
            </Field>
            <Field
              label="Qualification type"
              required
              hint={country ? 'A-Levels and IB are available from any country.' : 'Select a country first.'}
            >
              <Select
                value={profile.qualification}
                onChange={selectQualification}
                options={availableQuals}
                placeholder={country ? 'Select a qualification' : '—'}
              />
            </Field>

            {/* A-Levels: per-subject name + grade (best 3–4). */}
            {isALevel && (
              <Field
                label="A-Level subjects & grades"
                required
                hint="Enter your best 3–4 subjects with their grades. We map A*=6 … E=1 to a German equivalent."
                className="md:col-span-2"
              >
                <div className="space-y-2.5">
                  {aLevelRows.map((row, i) => (
                    <div key={i} className="grid grid-cols-[1fr_120px] gap-3">
                      <TextInput
                        value={row.subject}
                        onChange={(v) => setALevelRow(i, { subject: v })}
                        placeholder={`Subject ${i + 1}${i >= 3 ? ' (optional)' : ''} — e.g. Mathematics`}
                      />
                      <Select
                        value={row.grade}
                        onChange={(v) => setALevelRow(i, { grade: v })}
                        options={A_LEVEL_LETTERS}
                        placeholder="Grade"
                      />
                    </div>
                  ))}
                </div>
              </Field>
            )}

            {/* IB: total points + Higher-Level subject flags. */}
            {isIB && (
              <>
                <Field label="IB total points" required hint="Out of 45. Diploma minimum is 24.">
                  <TextInput
                    type="number"
                    value={profile.grade}
                    onChange={(v) => update({ grade: v, gradingScale: 'IB points (0–45)' })}
                    placeholder="e.g. 36"
                    suffix="/ 45"
                  />
                </Field>
                <Field label="Higher-Level subjects" hint="Determines general vs subject-restricted access.">
                  <div className="flex flex-col gap-2.5 pt-2">
                    <Toggle
                      value={profile.ibHlMath}
                      onChange={(v) => update({ ibHlMath: v })}
                      label="HL Mathematics"
                    />
                    <Toggle
                      value={profile.ibHlScience}
                      onChange={(v) => update({ ibHlScience: v })}
                      label="HL natural science (Bio / Chem / Physics)"
                    />
                  </div>
                </Field>
              </>
            )}

            {/* Default: numeric grade + grading scale. */}
            {!isALevel && !isIB && (
              <>
                <Field label="Grade / percentage" required hint="Your overall result, as a number.">
                  <TextInput
                    type="number"
                    value={profile.grade}
                    onChange={(v) => update({ grade: v })}
                    placeholder="e.g. 78"
                    suffix={inferSuffix(profile.gradingScale)}
                  />
                </Field>
                <Field label="Grading scale" required hint="Matches your result to a German equivalent.">
                  <Select
                    value={profile.gradingScale}
                    onChange={(v) => update({ gradingScale: v })}
                    options={GRADING_SCALES}
                    placeholder="Select scale"
                  />
                </Field>
              </>
            )}
          </div>

          <Divider />

          <SectionHeader n="02" title="Language" subtitle="Which tests have you taken, or plan to?" />
          <div className="grid md:grid-cols-2 gap-5">
            <Field label="Primary language certificate" required>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_CERTS.map((c) => (
                  <Chip
                    key={c}
                    active={profile.languageCert === c}
                    onClick={() => update({ languageCert: c })}
                  >
                    {c}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field
              label="Score"
              hint={scoreHint(profile.languageCert)}
              optional={profile.languageCert === 'None / planning to take'}
            >
              <TextInput
                value={profile.languageScore}
                onChange={(v) => update({ languageScore: v })}
                placeholder={scorePlaceholder(profile.languageCert)}
              />
            </Field>
          </div>

          <Divider />

          <SectionHeader n="03" title="Target" subtitle="What you're applying for." />
          <div className="grid md:grid-cols-2 gap-5">
            <Field label="Target degree level" hint="MVP supports bachelor's only.">
              <Segmented
                value="Bachelor's"
                onChange={() => {}}
                options={["Bachelor's", { value: 'ms', label: "Master's (soon)" }]}
              />
            </Field>
            <Field label="Preferred instruction language" hint="We'll emphasize matching programs later.">
              <Segmented
                value={profile.prefLanguage || 'Any'}
                onChange={(v) => update({ prefLanguage: v })}
                options={['Any', 'German', 'English']}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between pt-8 mt-2 border-t border-line">
            <div className="text-[12px] text-ink-50 leading-snug max-w-[360px]">
              Tip: you can come back and adjust your profile anytime — recognition updates live.
            </div>
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={!canSubmit}
              icon={<Icon name="arrowRight" size={16} />}
            >
              Check recognition
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
