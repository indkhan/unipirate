'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TopNav from '@/components/TopNav';
import {
  Button, Icon, Field, Select, TextInput, Segmented, Toggle, Stepper, cx,
} from '@/components/ui';
import {
  COUNTRIES, QUALIFICATIONS_BY_COUNTRY, GRADING_SCALES, LANGUAGE_TEST_OPTIONS,
} from '@/lib/repo';
import {
  loadProfile, saveProfile, loadProfileDb, saveProfileDb, BLANK_PROFILE,
  A_LEVEL_LETTERS, aLevelAverage, parseALevels, serializeALevels,
  LANG_STATUS_OPTIONS, primaryLanguageCert,
  loadChecklistOverridesDb, loadChecklistOverridesLocal,
  saveChecklistOverridesDb, saveChecklistOverridesLocal,
} from '@/lib/profile';
import { useAuth } from '@/lib/auth-context';

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
  const { userId, loading: authLoading, supabase } = useAuth();
  const [profile, setProfile] = useState(BLANK_PROFILE);
  const initialized = useRef(false);

  // Load the profile. localStorage holds the latest edits from this session, so
  // it wins; the DB copy is only used to restore on a fresh device/session.
  useEffect(() => {
    const local = loadProfile();
    // Show local immediately on mount — reading it before the mirror effect
    // can clobber storage, and so anon users never wait on auth. The init ref
    // keeps a later re-run (when auth resolves) from stomping in-progress edits.
    if (!initialized.current) {
      initialized.current = true;
      setProfile(local);
    }
    if (authLoading) return; // DB restore waits until we know who's signed in
    const hasLocal = !!(local && local.country && local.qualification);
    if (hasLocal || !userId || !supabase) return;
    let active = true;
    (async () => {
      const dbProfile = await loadProfileDb(supabase, userId);
      if (active && dbProfile) setProfile(dbProfile);
    })();
    return () => { active = false; };
  }, [authLoading, userId, supabase]);

  // Mirror to localStorage so anon browsing + the result page stay in sync.
  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  const update = (patch) => setProfile((p) => ({ ...p, ...patch }));

  // Checklist overrides ({ itemKey: 'in_process' }) — lets the user mark grade
  // as "waiting for results" here and have it reflected on the dashboard/result.
  const [overrides, setOverrides] = useState({});
  useEffect(() => {
    if (authLoading) return;
    let active = true;
    (async () => {
      if (userId && supabase) {
        const db = await loadChecklistOverridesDb(supabase, userId);
        if (active && db) setOverrides(db);
      } else if (active) {
        setOverrides(loadChecklistOverridesLocal());
      }
    })();
    return () => { active = false; };
  }, [authLoading, userId, supabase]);

  function persistOverrides(next) {
    if (userId && supabase) saveChecklistOverridesDb(supabase, userId, next);
    else saveChecklistOverridesLocal(next);
  }

  async function persistAll() {
    saveProfile(profile); // always persist locally first — result reads this
    persistOverrides(overrides);
    if (userId && supabase) {
      const { error } = await saveProfileDb(supabase, userId, profile);
      if (error) {
        // Don't strand the user: localStorage already has the latest, and the
        // result page reads from there. Surface for diagnosis (e.g. a missing
        // migration column rejects the whole row).
        console.error('[onboarding] profile DB save failed:', error.message || error);
      }
    }
  }

  async function handleSubmit() {
    await persistAll();
    // ?from=onboarding signals the result page to trust the just-saved local
    // profile; a plain navbar visit to /result reads the DB instead.
    router.push('/result?from=onboarding');
  }
  const country = profile.country;
  const availableQuals = country ? QUALIFICATIONS_BY_COUNTRY[country] || [] : [];
  const isALevel = profile.qualification === 'GCE A-Levels';
  const isIB = profile.qualification === 'IB Diploma';

  // Switching qualification clears any grade entry tied to the old type and
  // pre-selects the natural grading scale for that qualification.
  const SCALE_FOR_QUAL = {
    'IB Diploma': 'IB points (0–45)',
    'GCE A-Levels': 'A-Level grades',
    'Studienkolleg (completed)': 'German scale (1.0–6.0)',
  };
  const selectQualification = (v) =>
    update({
      qualification: v,
      grade: '',
      gradingScale: SCALE_FOR_QUAL[v] || '',
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

  // The only hard requirement to leave onboarding: country + qualification.
  const canContinue = !!(profile.country && profile.qualification);

  // What we call the result for the chosen qualification.
  const gradeNoun = isALevel ? 'A-Level grades' : isIB ? 'IB points' : 'grade';

  // Grade "waiting for results" flag → marks the grade checklist item in-process.
  // A-Levels live under the 'alevel' item; everything else under 'grade'.
  const gradeKey = isALevel ? 'alevel' : 'grade';
  const gradeWaiting = overrides[gradeKey] === 'in_process';
  function setGradeWaiting(waiting) {
    // Waiting and an entered grade are contradictory — clear the grade fields
    // when the user says they don't have results yet.
    if (waiting) update({ grade: '', aLevelGrades: '' });
    setOverrides((prev) => {
      const next = { ...prev };
      if (waiting) next[gradeKey] = 'in_process';
      else delete next[gradeKey];
      persistOverrides(next);
      return next;
    });
  }

  // Language certificates: a list of { cert, score, status }. Mirror the primary
  // one into the legacy single-cert fields so other reads stay correct.
  const languageCerts = profile.languageCerts || [];
  function setLanguageCerts(list) {
    const primary = primaryLanguageCert(list);
    update({ languageCerts: list, languageCert: primary?.cert || '', languageScore: primary?.score || '' });
  }
  const addCert = () => setLanguageCerts([...languageCerts, { cert: '', score: '', status: 'planning' }]);
  const updateCert = (i, patch) => {
    const merged = { ...languageCerts[i], ...patch };
    // A score only makes sense once you actually hold the certificate.
    if (merged.status !== 'done') merged.score = '';
    setLanguageCerts(languageCerts.map((c, idx) => (idx === i ? merged : c)));
  };
  const removeCert = (i) => setLanguageCerts(languageCerts.filter((_, idx) => idx !== i));

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />
      <main className="max-w-[920px] mx-auto px-6 md:px-10 pt-10 pb-24">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/overview')}
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
            {isALevel && !gradeWaiting && (
              <Field
                label="A-Level subjects & grades"
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
                {!gradeWaiting && (
                  <Field label="IB total points" hint="Out of 45. Diploma minimum is 24.">
                    <TextInput
                      type="number"
                      value={profile.grade}
                      onChange={(v) => update({ grade: v, gradingScale: 'IB points (0–45)' })}
                      placeholder="e.g. 36"
                      suffix="/ 45"
                    />
                  </Field>
                )}
                <Field
                  label="Higher-Level subjects"
                  hint="Determines general vs subject-restricted access."
                  className={gradeWaiting ? 'md:col-span-2' : undefined}
                >
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
            {!isALevel && !isIB && !gradeWaiting && (
              <>
                <Field label="Grade / percentage" hint="Your overall result, as a number.">
                  <TextInput
                    type="number"
                    value={profile.grade}
                    onChange={(v) => update({ grade: v })}
                    placeholder="e.g. 78"
                    suffix={inferSuffix(profile.gradingScale)}
                  />
                </Field>
                <Field label="Grading scale" hint="Matches your result to a German equivalent.">
                  <Select
                    value={profile.gradingScale}
                    onChange={(v) => update({ gradingScale: v })}
                    options={GRADING_SCALES}
                    placeholder="Select scale"
                  />
                </Field>
              </>
            )}

            {/* Waiting for results — grade entry hidden. */}
            {gradeWaiting && profile.qualification && (
              <div className="md:col-span-2 rounded-lg border border-line border-dashed bg-paper px-4 py-3 text-[13px] text-ink-60">
                Waiting for your {gradeNoun} — add them later from your dashboard. Recognition still works from your country and qualification.
              </div>
            )}
          </div>

          {/* No final result yet → mark the grade as "in process" and continue. */}
          {profile.qualification && (
            <div className="mt-5">
              <Toggle
                value={gradeWaiting}
                onChange={setGradeWaiting}
                label="I don't have my final result yet — waiting for results"
              />
              {gradeWaiting && (
                <div className="text-[11.5px] text-ink-50 mt-1.5 leading-snug">
                  Your {gradeNoun} will show as “In process” on your dashboard until you add them.
                </div>
              )}
            </div>
          )}

          <Divider />

          <SectionHeader n="02" title="Language" subtitle="Tests you've taken or plan to — add as many as you need." />
          <div className="space-y-3">
            {languageCerts.length === 0 && (
              <div className="text-[13px] text-ink-50">
                No certificates yet — add one now, or come back later.
              </div>
            )}
            {languageCerts.map((c, i) => (
              <div
                key={i}
                className="rounded-lg border border-line bg-paper p-4 grid md:grid-cols-12 gap-3 items-start"
              >
                <div className="md:col-span-4">
                  <Field label="Certificate">
                    <Select
                      value={c.cert}
                      onChange={(v) => updateCert(i, { cert: v })}
                      options={LANGUAGE_TEST_OPTIONS}
                      placeholder="Select test"
                    />
                  </Field>
                </div>
                <div className="md:col-span-3">
                  {c.status === 'done' ? (
                    <Field label="Score" hint={scoreHint(c.cert)}>
                      <TextInput
                        value={c.score}
                        onChange={(v) => updateCert(i, { score: v })}
                        placeholder={scorePlaceholder(c.cert)}
                      />
                    </Field>
                  ) : (
                    <Field label="Score">
                      <div className="h-11 flex items-center text-[12.5px] text-ink-40">
                        Add once you have results
                      </div>
                    </Field>
                  )}
                </div>
                <div className="md:col-span-4">
                  <Field label="Status">
                    <Segmented
                      value={c.status}
                      onChange={(v) => updateCert(i, { status: v })}
                      options={LANG_STATUS_OPTIONS}
                    />
                  </Field>
                </div>
                <div className="md:col-span-1 flex md:justify-end md:pt-7">
                  <button
                    type="button"
                    onClick={() => removeCert(i)}
                    aria-label="Remove certificate"
                    className="h-9 w-9 inline-flex items-center justify-center rounded-md text-ink-40 hover:text-[oklch(0.55_0.17_25)] hover:bg-ink-5"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addCert} icon={<Icon name="arrowRight" size={14} />}>
              Add a certificate
            </Button>
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

          <div className="flex items-center justify-between flex-wrap gap-4 pt-8 mt-2 border-t border-line">
            <div className="text-[12px] text-ink-50 leading-snug max-w-[360px]">
              Tip: country + qualification is enough to continue — add grades and language now or later.
            </div>
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={!canContinue}
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
