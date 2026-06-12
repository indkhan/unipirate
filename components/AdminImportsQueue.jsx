'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Badge, Icon, Select, cx } from './ui';
import { slugify, effectiveFields, toCourseRow, toUniversityRow } from '@/lib/import/promote';

// Admin review queue for DAAD imports: raw paste vs parsed (with provenance)
// vs user edits, admin-editable effective values, and promote-to-public.
// Promote materializes the import into universities/courses so the finder,
// TrackButton, and dashboard pick it up with zero changes.

const FIELD_LABELS = {
  course_name: 'Course name',
  uni_name: 'University',
  city: 'City',
  degree: 'Degree',
  language: 'Language',
  semester: 'Semester',
  application_deadline: 'Deadline',
  duration: 'Duration',
  fulltime: 'Full/part-time',
  tuition: 'Tuition',
  semester_contribution: 'Semester contribution',
  admission_requirements: 'Admission requirements',
  language_requirements: 'Language requirements',
  summary: 'Description',
  submit_to: 'Submit to',
};

export default function AdminImportsQueue({ initialImports, universities, adminId }) {
  const [imports, setImports] = useState(initialImports);

  if (!imports.length) {
    return (
      <section className="mt-8 rounded-xl border border-line bg-white p-6">
        <h2 className="text-[20px] text-ink-90 mb-2" style={{ fontFamily: "'Instrument Serif', serif" }}>
          DAAD imports
        </h2>
        <p className="text-[14px] text-ink-50">No imports awaiting review.</p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-xl border border-line bg-white p-6">
      <h2 className="text-[20px] text-ink-90 mb-4" style={{ fontFamily: "'Instrument Serif', serif" }}>
        DAAD imports · {imports.length}
      </h2>
      <ul className="space-y-4">
        {imports.map((imp) => (
          <ImportCard
            key={imp.id}
            imp={imp}
            universities={universities}
            adminId={adminId}
            onDone={(id) => setImports((list) => list.filter((x) => x.id !== id))}
          />
        ))}
      </ul>
    </section>
  );
}

function ImportCard({ imp, universities, adminId, onDone }) {
  const [open, setOpen] = useState(false);
  const [edits, setEdits] = useState({});
  const [applyMethod, setApplyMethod] = useState(imp.apply_method || '');
  const [uniChoice, setUniChoice] = useState('auto'); // 'auto' | existing uni id
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const fields = effectiveFields(imp, edits);
  const parsed = imp.parsed_json?.fields || {};
  const userEdits = imp.user_edits || {};
  const canPromote = !!(fields.course_name && fields.uni_name && applyMethod);

  async function promote(supabase) {
    setBusy(true);
    setErr(null);
    try {
      // 1. Race check: someone may have promoted this daad_id meanwhile.
      const { data: existing } = await supabase
        .from('imported_programs')
        .select('id')
        .eq('daad_id', imp.daad_id)
        .eq('status', 'public')
        .maybeSingle();
      if (existing) throw new Error('A public import for this DAAD id already exists.');

      // 2. University: picked / name match / create.
      let universityId = uniChoice !== 'auto' ? uniChoice : null;
      if (!universityId) {
        const { data: match } = await supabase
          .from('universities')
          .select('id')
          .ilike('name', fields.uni_name)
          .maybeSingle();
        universityId = match?.id ?? null;
      }
      if (!universityId) {
        const row = toUniversityRow(fields, {
          slug: slugify(fields.uni_name),
          applyMethod,
          rawUrl: imp.raw_url,
        });
        universityId = await insertWithSlugRetry(supabase, 'universities', row);
      }

      // 3. Course.
      const courseRow = toCourseRow(fields, {
        universityId,
        slug: slugify(`${fields.course_name} ${fields.uni_name}`),
        rawUrl: imp.raw_url,
      });
      const courseId = await insertWithSlugRetry(supabase, 'courses', courseRow);

      // 4. Flip the import public. The partial unique index is the final
      // referee — if it fires, the uni/course rows are still valid catalog
      // content, only the import stays pending.
      const { error } = await supabase
        .from('imported_programs')
        .update({
          status: 'public',
          reviewed_by: adminId,
          course_id: courseId,
          course_name: fields.course_name,
          uni_name: fields.uni_name,
          city: fields.city,
          apply_method: applyMethod,
          updated_at: new Date().toISOString(),
        })
        .eq('id', imp.id);
      if (error) throw error;
      onDone(imp.id);
    } catch (e) {
      setErr(e.message || 'Promote failed.');
    } finally {
      setBusy(false);
    }
  }

  async function reject(supabase) {
    setBusy(true);
    const { error } = await supabase.from('imported_programs').delete().eq('id', imp.id);
    if (error) setErr(error.message);
    else onDone(imp.id);
    setBusy(false);
  }

  return (
    <li className="rounded-lg border border-line bg-paper p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[15px] text-ink-90 font-medium">
            {fields.course_name || 'Untitled'} <span className="text-ink-40">·</span> {fields.uni_name || '?'}
          </div>
          <div className="mt-0.5 flex items-center gap-2 flex-wrap text-[12px] text-ink-50">
            <span>DAAD #{imp.daad_id}</span>
            <span>parser v{imp.parser_version}</span>
            <Badge tone={imp.status === 'public' ? 'emerald' : 'neutral'}>{imp.status}</Badge>
            {Object.keys(userEdits).length > 0 && <Badge tone="navy">user-edited</Badge>}
          </div>
          <a
            href={imp.raw_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12.5px] text-navy hover:underline inline-flex items-center gap-1 mt-1"
          >
            {imp.raw_url} <Icon name="external" size={11} />
          </a>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>
          {open ? 'Collapse' : 'Review'}
        </Button>
      </div>

      {open && (
        <ReviewBody
          imp={imp}
          parsed={parsed}
          userEdits={userEdits}
          fields={fields}
          edits={edits}
          setEdits={setEdits}
          applyMethod={applyMethod}
          setApplyMethod={setApplyMethod}
          uniChoice={uniChoice}
          setUniChoice={setUniChoice}
          universities={universities}
          canPromote={canPromote}
          busy={busy}
          err={err}
          onPromote={promote}
          onReject={reject}
        />
      )}
    </li>
  );
}

function ReviewBody({
  imp, parsed, userEdits, fields, edits, setEdits,
  applyMethod, setApplyMethod, uniChoice, setUniChoice, universities,
  canPromote, busy, err, onPromote, onReject,
}) {
  const supabase = createClient();

  return (
    <div className="mt-4 border-t border-line pt-4">
      <details className="mb-4">
        <summary className="text-[12.5px] text-ink-50 cursor-pointer">Raw pasted text</summary>
        <pre className="mt-2 whitespace-pre-wrap text-[12px] text-ink-70 max-h-64 overflow-auto bg-white border border-line rounded p-3">
          {imp.raw_text}
        </pre>
      </details>

      <div className="space-y-2">
        {Object.entries(FIELD_LABELS).map(([key, label]) => {
          const p = parsed[key];
          const hasUserEdit = key in userEdits;
          const hasAdminEdit = key in edits;
          return (
            <div key={key} className="grid grid-cols-12 gap-2 items-start text-[12.5px]">
              <div className="col-span-2 text-ink-50 pt-1.5">{label}</div>
              <div className="col-span-3 pt-1.5 text-ink-60">
                <SourceTag source={p?.source} /> {truncate(p?.value)}
              </div>
              <div className={cx('col-span-3 pt-1.5', hasUserEdit ? 'text-navy' : 'text-ink-35')}>
                {hasUserEdit ? truncate(userEdits[key]) : '—'}
              </div>
              <div className="col-span-4">
                <input
                  value={fields[key] ?? ''}
                  onChange={(e) => setEdits((x) => ({ ...x, [key]: e.target.value }))}
                  className={cx(
                    'w-full rounded border bg-white px-2 py-1.5 text-[12.5px] text-ink-90 outline-none focus:border-navy',
                    hasAdminEdit ? 'border-navy/50' : 'border-line'
                  )}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid grid-cols-12 gap-2 text-[11px] text-ink-40">
        <div className="col-span-2" />
        <div className="col-span-3">parsed</div>
        <div className="col-span-3">user edit</div>
        <div className="col-span-4">effective (admin editable)</div>
      </div>

      {imp.llm_extra && (
        <details className="mt-3">
          <summary className="text-[12.5px] text-ink-50 cursor-pointer">AI notes — unverified</summary>
          <pre className="mt-2 whitespace-pre-wrap text-[12px] text-ink-70 max-h-40 overflow-auto bg-white border border-line rounded p-3">
            {JSON.stringify(imp.llm_extra, null, 2)}
          </pre>
        </details>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-44">
          <div className="text-[11.5px] text-ink-50 mb-1">Apply method {!applyMethod && <span className="text-amber-600">· required</span>}</div>
          <Select
            value={applyMethod}
            onChange={setApplyMethod}
            options={['direct', 'uni-assist', 'other']}
            placeholder="Select method…"
          />
        </div>
        <div className="w-72">
          <div className="text-[11.5px] text-ink-50 mb-1">University</div>
          <select
            value={uniChoice}
            onChange={(e) => setUniChoice(e.target.value)}
            className="w-full h-9 rounded-md border border-line bg-white px-2 text-[13px] text-ink-90 outline-none focus:border-navy"
          >
            <option value="auto">Auto (match by name or create)</option>
            {universities.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onReject(supabase)}>
            Delete
          </Button>
          <Button size="sm" disabled={busy || !canPromote} onClick={() => onPromote(supabase)} icon={<Icon name="check" size={13} />}>
            {busy ? 'Promoting…' : 'Promote to catalog'}
          </Button>
        </div>
      </div>
      {!canPromote && (
        <div className="mt-2 text-[12px] text-amber-700">
          Course name, university name, and apply method are required before promoting.
        </div>
      )}
      {err && <div className="mt-2 text-[12.5px] text-red-600">{err}</div>}
    </div>
  );
}

function SourceTag({ source }) {
  if (!source || source === 'not_found') return <span className="text-amber-600">[missing]</span>;
  if (source === 'llm') return <span className="text-navy">[AI]</span>;
  if (source === 'regex-heuristic') return <span className="text-ink-40">[guess]</span>;
  return <span className="text-emerald-700">[regex]</span>;
}

const truncate = (s) => (s && s.length > 80 ? s.slice(0, 77) + '…' : s || '—');

// Insert with slug-collision retry (-2, -3 …) on the unique violation.
async function insertWithSlugRetry(supabase, table, row, maxTries = 4) {
  let slug = row.slug;
  for (let i = 1; i <= maxTries; i++) {
    const { data, error } = await supabase
      .from(table)
      .insert({ ...row, slug })
      .select('id')
      .single();
    if (!error) return data.id;
    if (error.code !== '23505') throw error;
    slug = `${row.slug}-${i + 1}`;
  }
  throw new Error(`Could not find a free slug for ${table} "${row.slug}".`);
}
