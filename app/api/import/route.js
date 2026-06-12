import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractDaadId, extractLabeledFields, ALL_FIELD_KEYS, PARSER_VERSION } from '@/lib/import/parse';
import { validateImport, substringGate } from '@/lib/import/validate';
import { extractFieldsLLM, rephraseChecklist } from '@/lib/import/gemini';
import { detectApplyMethod } from '@/lib/import/portal';
import { sha256Hex } from '@/lib/import/hash';
import { buildImportChecklist } from '@/lib/import/checklist';
import { mapCourse, mapUniversity } from '@/lib/repo/map';

// POST /api/import — parse a pasted DAAD detail page and store it as the
// user's private import. Uses the cookie-bound anon client so RLS owns
// authorization: created_by can't be forged, public rows are readable for
// the dedup check, and only admins can ever promote.

const MAX_TEXT_CHARS = 300_000;

const json = (body, status = 200) => NextResponse.json(body, { status });

const effectiveValue = (fields, key) => fields[key]?.value ?? null;

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } = {} } = await supabase.auth.getUser();
  if (!user) return json({ error: 'auth', message: 'Sign in to import a course.' }, 401);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const url = (body?.url || '').trim();
  const text = body?.text || '';
  if (!text.trim()) return json({ error: 'no_text', message: 'Paste the full page text.' }, 400);
  if (text.length > MAX_TEXT_CHARS) {
    return json({ error: 'text_too_long', message: 'Paste is too large — copy the main page content only.' }, 400);
  }

  const daadId = extractDaadId(url);
  if (!daadId) {
    return json(
      { error: 'no_daad_id', message: 'URL must be a DAAD International Programmes detail page (…/detail/<id>/).' },
      400
    );
  }

  // Dedup: an admin-approved public import for this program already exists →
  // zero parsing, point the user at the catalog entry.
  const { data: pub, error: pubErr } = await supabase
    .from('imported_programs')
    .select('id, course_id, course_name, uni_name')
    .eq('daad_id', daadId)
    .eq('status', 'public')
    .maybeSingle();
  if (pubErr) return json({ error: pubErr.message }, 500);
  if (pub) {
    // Hand back the catalog entry (mapped to the UI course/university shape)
    // so the client can render it with a working TrackButton.
    let course = null;
    let university = null;
    if (pub.course_id) {
      const { data: courseRow } = await supabase
        .from('courses')
        .select('*')
        .eq('id', pub.course_id)
        .maybeSingle();
      if (courseRow) {
        const { data: uniRow } = await supabase
          .from('universities')
          .select('*')
          .eq('id', courseRow.university_id)
          .maybeSingle();
        university = uniRow ? mapUniversity(uniRow) : null;
        course = mapCourse(courseRow, uniRow ? { [uniRow.id]: uniRow.slug } : {});
      }
    }
    return json({
      already: true,
      existing: { ...pub, courseSlug: course?.id ?? null },
      course,
      university,
    });
  }

  const { fields: rawFields, germanPage } = extractLabeledFields(text);
  if (germanPage) {
    return json(
      { error: 'german_page', message: 'This looks like the German page. Open the English version (…/en/detail/…) and paste that.' },
      422
    );
  }

  // Per-field LLM fallback: only fields the regex pass missed, plus the
  // low-confidence title heuristics. Every LLM value re-runs the substring
  // gate — a value not literally present in the paste is dropped.
  let llmExtra = null;
  const llmTargets = ALL_FIELD_KEYS.filter((k) => {
    const src = rawFields[k]?.source;
    return !src || src === 'regex-heuristic';
  });
  if (llmTargets.length) {
    const llm = await extractFieldsLLM(text, llmTargets);
    if (llm) {
      for (const [key, value] of Object.entries(llm.fields)) {
        if (value && substringGate(value, text)) {
          rawFields[key] = { value, source: 'llm' };
        }
      }
      llmExtra = llm.extra ? { notes: llm.extra } : null;
    }
  }

  const v = validateImport(rawFields, text);
  if (!v.ok) {
    return json({ error: 'validation', details: v.errors, warnings: v.warnings }, 422);
  }

  const applyMethod = detectApplyMethod(effectiveValue(v.fields, 'submit_to') || '');

  // Checklist preview: templates own steps + dates; personalized with the
  // user's country playbook when their profile has one.
  const { data: profile } = await supabase
    .from('profiles')
    .select('country')
    .eq('id', user.id)
    .maybeSingle();
  const checklist = await rephraseChecklist(
    buildImportChecklist({
      country: profile?.country,
      applyMethod: applyMethod || 'other',
      deadlineText: effectiveValue(v.fields, 'application_deadline'),
    })
  );

  const row = {
    daad_id: daadId,
    raw_url: url,
    raw_text: text,
    raw_text_hash: sha256Hex(text),
    course_name: effectiveValue(v.fields, 'course_name'),
    uni_name: effectiveValue(v.fields, 'uni_name'),
    city: effectiveValue(v.fields, 'city'),
    apply_method: applyMethod,
    parsed_json: { fields: v.fields, warnings: v.warnings },
    llm_extra: llmExtra,
    checklist_json: checklist,
    parser_version: PARSER_VERSION,
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from('imported_programs')
    .insert(row)
    .select('id')
    .single();
  if (error) return json({ error: error.message }, 500);

  return json({
    id: data.id,
    daadId,
    fields: v.fields,
    warnings: v.warnings,
    applyMethod: row.apply_method,
    checklist,
    llmExtra,
  });
}
