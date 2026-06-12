'use client';

import { useState } from 'react';
import { Button, Badge, Icon, Field, TextInput, cx } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

// Field metadata for the review screen. Keys match parsed_json.fields.
const FIELD_META = [
  { key: 'course_name', label: 'Course name', headline: true },
  { key: 'uni_name', label: 'University', headline: true },
  { key: 'city', label: 'City', headline: true },
  { key: 'degree', label: 'Degree' },
  { key: 'language', label: 'Teaching language' },
  { key: 'semester', label: 'Beginning (semester)' },
  { key: 'application_deadline', label: 'Application deadline' },
  { key: 'duration', label: 'Programme duration' },
  { key: 'fulltime', label: 'Full-time / part-time' },
  { key: 'tuition', label: 'Tuition fees / semester' },
  { key: 'semester_contribution', label: 'Semester contribution' },
  { key: 'admission_requirements', label: 'Admission requirements', long: true },
  { key: 'language_requirements', label: 'Language requirements', long: true },
  { key: 'summary', label: 'Description', long: true },
  { key: 'submit_to', label: 'Submit application to', long: true },
];

function SourceBadge({ source }) {
  if (source === 'llm') return <Badge tone="navy">AI</Badge>;
  if (source === 'not_found') return <Badge tone="amber">not found</Badge>;
  if (source === 'regex-heuristic') return <Badge tone="neutral">detected · check</Badge>;
  return <Badge tone="emerald">extracted</Badge>;
}

export default function ImportClient({ initialImports }) {
  const { userId, supabase } = useAuth();
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null); // { id, fields, warnings, applyMethod }
  const [already, setAlready] = useState(null);
  const [myImports, setMyImports] = useState(initialImports);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setAlready(null);
    setBusy(true);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.message || data.details?.join('; ') || data.error || 'Import failed.');
        return;
      }
      if (data.already) {
        setAlready(data.existing);
        return;
      }
      setResult(data);
      setMyImports((prev) => [
        {
          id: data.id,
          daad_id: data.daadId,
          course_name: data.fields.course_name?.value,
          uni_name: data.fields.uni_name?.value,
          status: 'private',
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (e) {
      setErr(e.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <ReviewScreen
        result={result}
        supabase={supabase}
        onBack={() => {
          setResult(null);
          setUrl('');
          setText('');
        }}
      />
    );
  }

  return (
    <div>
      <h1
        className="text-[36px] text-ink-90 leading-tight"
        style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.02em' }}
      >
        Import a course from DAAD.
      </h1>
      <p className="mt-2 text-[14px] text-ink-60 leading-[1.6] max-w-[640px]">
        Open the program on{' '}
        <a
          href="https://www2.daad.de/deutschland/studienangebote/international-programmes/en/"
          target="_blank"
          rel="noreferrer"
          className="text-navy hover:underline"
        >
          DAAD International Programmes
        </a>
        , copy the page URL and the full page text (Ctrl+A, Ctrl+C), and paste both below. We extract
        the details, you review them, and our team verifies before it joins the catalog.
      </p>

      {already && (
        <div className="mt-6 rounded-xl border border-navy/20 bg-navy/[0.04] p-5 text-[14px] text-ink-80">
          <div className="flex items-center gap-2 font-medium text-navy">
            <Icon name="check" size={15} /> Already in our catalog
          </div>
          <p className="mt-1 text-[13px] text-ink-60">
            {already.course_name} · {already.uni_name} has been verified already — no need to import it again.
          </p>
          <a href="/finder" className="mt-3 inline-flex items-center gap-1 text-[13px] text-navy font-medium hover:underline">
            Find it in the course finder <Icon name="arrowRight" size={12} />
          </a>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label="DAAD program page URL" required hint="Use the English page: …/international-programmes/en/detail/…">
          <TextInput value={url} onChange={setUrl} type="url" placeholder="https://www2.daad.de/…/en/detail/10360/" />
        </Field>
        <Field label="Full page text" required hint="Select all on the DAAD page (Ctrl+A), copy, paste here.">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder="Paste the entire page text here…"
            className="w-full rounded-md border border-line bg-paper text-[13.5px] text-ink-90 p-3.5 outline-none hover:border-ink-30 focus:border-navy focus:ring-2 focus:ring-navy/15 leading-[1.55] font-mono"
          />
        </Field>

        {err && <div className="rounded-md border border-red-200 bg-red-50 p-3.5 text-[13px] text-red-700">{err}</div>}

        <Button type="submit" size="lg" disabled={busy || !url.trim() || !text.trim()}>
          {busy ? 'Extracting…' : 'Extract course details'}
        </Button>
      </form>

      {myImports.length > 0 && (
        <section className="mt-12">
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink-40 mb-3">My imports</div>
          <ul className="space-y-2">
            {myImports.map((imp) => (
              <li
                key={imp.id}
                className="rounded-lg border border-line bg-white p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-[14px] text-ink-90">{imp.course_name || 'Untitled import'}</div>
                  <div className="text-[12px] text-ink-50 mt-0.5">
                    {imp.uni_name} · DAAD #{imp.daad_id}
                  </div>
                </div>
                <Badge tone={imp.status === 'public' ? 'emerald' : 'neutral'}>
                  {imp.status === 'public' ? 'In catalog' : 'Awaiting review'}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ReviewScreen({ result, supabase, onBack }) {
  const parsedValue = (key) => result.fields[key]?.value ?? '';
  const [values, setValues] = useState(() =>
    Object.fromEntries(FIELD_META.map((m) => [m.key, parsedValue(m.key)]))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);

  const dirty = FIELD_META.some((m) => values[m.key] !== parsedValue(m.key));

  async function onSave() {
    setSaving(true);
    setErr(null);
    try {
      // user_edits = only fields the user actually changed vs the parse.
      const edits = {};
      for (const m of FIELD_META) {
        if (values[m.key] !== parsedValue(m.key)) edits[m.key] = values[m.key];
      }
      const { error } = await supabase
        .from('imported_programs')
        .update({
          user_edits: edits,
          course_name: values.course_name || null,
          uni_name: values.uni_name || null,
          city: values.city || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', result.id);
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setErr(e.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button onClick={onBack} className="text-[13px] text-ink-50 hover:text-ink-90 inline-flex items-center gap-1">
        ← Import another
      </button>
      <h1
        className="mt-3 text-[32px] text-ink-90 leading-tight"
        style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.02em' }}
      >
        Review what we extracted.
      </h1>
      <p className="mt-2 text-[14px] text-ink-60 leading-[1.6] max-w-[640px]">
        Fix anything that looks off — especially the course and university name. Your import is saved
        privately; our team verifies it before it appears in the public catalog.
      </p>

      {result.warnings?.length > 0 && (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3.5 text-[12.5px] text-amber-800">
          {result.warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELD_META.map((m) => {
          const source = result.fields[m.key]?.source ?? 'not_found';
          return (
            <div key={m.key} className={cx(m.long && 'md:col-span-2')}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[12px] text-ink-60 font-medium">{m.label}</label>
                <SourceBadge source={source} />
              </div>
              {m.long ? (
                <textarea
                  value={values[m.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [m.key]: e.target.value }))}
                  rows={3}
                  className="w-full rounded-md border border-line bg-paper text-[13.5px] text-ink-90 p-3 outline-none hover:border-ink-30 focus:border-navy focus:ring-2 focus:ring-navy/15 leading-[1.5]"
                />
              ) : (
                <TextInput value={values[m.key]} onChange={(val) => setValues((v) => ({ ...v, [m.key]: val }))} />
              )}
            </div>
          );
        })}
      </div>

      {result.checklist?.length > 0 && (
        <section className="mt-8 rounded-xl border border-line bg-white p-6">
          <h2 className="text-[19px] text-ink-90 mb-1" style={{ fontFamily: "'Instrument Serif', serif" }}>
            Your application plan
          </h2>
          <p className="text-[12.5px] text-ink-50 mb-4">
            Generated from the application method and deadline. Added to your dashboard when you track this course.
          </p>
          <ol className="space-y-2">
            {result.checklist.map((step, i) => (
              <li key={i} className="flex items-start justify-between gap-3 text-[13.5px] text-ink-80">
                <span className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-5 text-[11px] text-ink-60">
                    {i + 1}
                  </span>
                  {step.label}
                </span>
                {step.due_date && (
                  <Badge tone="amber" className="shrink-0">
                    due {step.due_date}
                  </Badge>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {err && <div className="mt-4 text-[13px] text-red-600">{err}</div>}

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={onSave} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save corrections'}
        </Button>
        {saved && (
          <span className="text-[13px] text-emerald-700 inline-flex items-center gap-1">
            <Icon name="check" size={14} /> Saved
          </span>
        )}
        {!dirty && !saved && <span className="text-[12.5px] text-ink-45">Everything matches the parse.</span>}
      </div>
    </div>
  );
}
