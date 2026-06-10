'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Badge, Icon, Field, TextInput, Select } from './ui';

function Section({ title, children }) {
  return (
    <section className="mt-8 rounded-xl border border-line bg-white p-6">
      <h2 className="text-[20px] text-ink-90 mb-4" style={{ fontFamily: "'Instrument Serif', serif" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function AdminClient({ initialRequests, universities }) {
  const [requests, setRequests] = useState(initialRequests);
  const [unis, setUnis] = useState(universities);
  const supabase = createClient();

  async function setStatus(id, status) {
    const { error } = await supabase.from('uni_requests').update({ status }).eq('id', id);
    if (!error) setRequests((r) => r.filter((x) => x.id !== id));
  }

  return (
    <div>
      {/* Request triage */}
      <Section title={`Pending requests · ${requests.length}`}>
        {requests.length === 0 ? (
          <p className="text-[14px] text-ink-50">No pending requests.</p>
        ) : (
          <ul className="space-y-3">
            {requests.map((req) => (
              <li key={req.id} className="rounded-lg border border-line bg-paper p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[15px] text-ink-90 font-medium">{req.uni_name}</div>
                    {req.daad_url && (
                      <a href={req.daad_url} target="_blank" rel="noopener noreferrer" className="text-[12.5px] text-navy hover:underline inline-flex items-center gap-1 mt-0.5">
                        {req.daad_url} <Icon name="external" size={11} />
                      </a>
                    )}
                    {req.pasted_text && (
                      <details className="mt-2">
                        <summary className="text-[12.5px] text-ink-50 cursor-pointer">Pasted text</summary>
                        <pre className="mt-2 whitespace-pre-wrap text-[12px] text-ink-70 max-h-48 overflow-auto bg-white border border-line rounded p-3">
                          {req.pasted_text}
                        </pre>
                      </details>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" onClick={() => setStatus(req.id, 'approved')} icon={<Icon name="check" size={13} />}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus(req.id, 'rejected')}>
                      Reject
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <AddUniversity supabase={supabase} onAdded={(u) => setUnis((list) => [...list, u].sort((a, b) => a.name.localeCompare(b.name)))} />
      <AddCourse supabase={supabase} universities={unis} />
    </div>
  );
}

const APPLY_METHODS = ['direct', 'uni-assist', 'other'];

function AddUniversity({ supabase, onAdded }) {
  const [f, setF] = useState({ slug: '', name: '', short: '', city: '', state: '', apply_method: 'uni-assist', portal_label: '', general_deadlines: '', semester_contribution: '', daad_url: '', blurb: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const up = (patch) => setF((p) => ({ ...p, ...patch }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.from('universities').insert(f).select('id, slug, name').single();
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg(`Added ${data.name}.`);
    onAdded?.(data);
    setF((p) => ({ ...p, slug: '', name: '', short: '', city: '', blurb: '' }));
  }

  return (
    <Section title="Add a university">
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-4">
        <Field label="Slug" required><TextInput value={f.slug} onChange={(v) => up({ slug: v })} placeholder="uni-mannheim" /></Field>
        <Field label="Name" required><TextInput value={f.name} onChange={(v) => up({ name: v })} /></Field>
        <Field label="Short"><TextInput value={f.short} onChange={(v) => up({ short: v })} /></Field>
        <Field label="City"><TextInput value={f.city} onChange={(v) => up({ city: v })} /></Field>
        <Field label="State"><TextInput value={f.state} onChange={(v) => up({ state: v })} /></Field>
        <Field label="Apply method"><Select value={f.apply_method} onChange={(v) => up({ apply_method: v })} options={APPLY_METHODS} /></Field>
        <Field label="Portal label"><TextInput value={f.portal_label} onChange={(v) => up({ portal_label: v })} placeholder="uni-assist" /></Field>
        <Field label="Deadlines"><TextInput value={f.general_deadlines} onChange={(v) => up({ general_deadlines: v })} placeholder="Winter: 15 Jul" /></Field>
        <Field label="Semester fee"><TextInput value={f.semester_contribution} onChange={(v) => up({ semester_contribution: v })} placeholder="€ 180 / semester" /></Field>
        <Field label="DAAD URL"><TextInput value={f.daad_url} onChange={(v) => up({ daad_url: v })} type="url" /></Field>
        <div className="md:col-span-2"><Field label="Blurb"><TextInput value={f.blurb} onChange={(v) => up({ blurb: v })} /></Field></div>
        <div className="md:col-span-2 flex items-center gap-3">
          <Button type="submit" disabled={busy || !f.slug || !f.name}>{busy ? 'Saving…' : 'Add university'}</Button>
          {msg && <span className="text-[13px] text-ink-60">{msg}</span>}
        </div>
      </form>
    </Section>
  );
}

const BLANK_COURSE = {
  slug: '', university_id: '', name: '', degree: 'B.Sc.', semester: 'Winter only', language: 'German',
  nc_free: false, nc_value: '', nc_value_label: '', nc_year: '', admission_requirements: '', language_requirements: '',
  course_structure: '', how_to_apply: '', application_deadline: '', keywords: '', apply_url: '', summary: '',
};

function AddCourse({ supabase, universities }) {
  const [f, setF] = useState(BLANK_COURSE);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const up = (patch) => setF((p) => ({ ...p, ...patch }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const row = {
      ...f,
      nc_value: f.nc_value === '' ? null : Number(f.nc_value),
      keywords: f.keywords ? f.keywords.split(',').map((s) => s.trim()).filter(Boolean) : [],
    };
    const { error } = await supabase.from('courses').insert(row);
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg(`Added ${f.name}.`);
    setF((p) => ({ ...BLANK_COURSE, university_id: p.university_id }));
  }

  return (
    <Section title="Add a course">
      {universities.length === 0 ? (
        <p className="text-[13px] text-ink-50">Add a university first.</p>
      ) : (
        <form onSubmit={submit} className="grid md:grid-cols-2 gap-4">
          <Field label="University" required>
            <Select
              value={f.university_id}
              onChange={(v) => up({ university_id: v })}
              options={universities.map((u) => ({ value: u.id, label: u.name }))}
              placeholder="Select a university"
            />
          </Field>
          <Field label="Slug" required><TextInput value={f.slug} onChange={(v) => up({ slug: v })} placeholder="uni-cs" /></Field>
          <Field label="Course name" required><TextInput value={f.name} onChange={(v) => up({ name: v })} /></Field>
          <Field label="Degree"><TextInput value={f.degree} onChange={(v) => up({ degree: v })} /></Field>
          <Field label="Semester"><TextInput value={f.semester} onChange={(v) => up({ semester: v })} /></Field>
          <Field label="Language"><TextInput value={f.language} onChange={(v) => up({ language: v })} /></Field>
          <Field label="NC value (blank = none)"><TextInput value={f.nc_value} onChange={(v) => up({ nc_value: v })} placeholder="1.8" /></Field>
          <Field label="NC label"><TextInput value={f.nc_value_label} onChange={(v) => up({ nc_value_label: v })} placeholder="1.8 (WS 2024/25)" /></Field>
          <Field label="Application deadline"><TextInput value={f.application_deadline} onChange={(v) => up({ application_deadline: v })} /></Field>
          <Field label="Keywords (comma-sep)"><TextInput value={f.keywords} onChange={(v) => up({ keywords: v })} placeholder="cs, informatics" /></Field>
          <div className="md:col-span-2"><Field label="Summary"><TextInput value={f.summary} onChange={(v) => up({ summary: v })} /></Field></div>
          <div className="md:col-span-2"><Field label="Admission requirements"><TextInput value={f.admission_requirements} onChange={(v) => up({ admission_requirements: v })} /></Field></div>
          <div className="md:col-span-2"><Field label="Language requirements"><TextInput value={f.language_requirements} onChange={(v) => up({ language_requirements: v })} /></Field></div>
          <div className="md:col-span-2"><Field label="Course structure"><TextInput value={f.course_structure} onChange={(v) => up({ course_structure: v })} /></Field></div>
          <div className="md:col-span-2"><Field label="How to apply"><TextInput value={f.how_to_apply} onChange={(v) => up({ how_to_apply: v })} /></Field></div>
          <div className="md:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={busy || !f.slug || !f.name || !f.university_id}>{busy ? 'Saving…' : 'Add course'}</Button>
            {msg && <span className="text-[13px] text-ink-60">{msg}</span>}
          </div>
        </form>
      )}
    </Section>
  );
}
