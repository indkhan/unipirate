// Seed public content into Supabase. Run once after the schema migration:
//   node scripts/seed.mjs
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
// (service role bypasses RLS). Idempotent via upsert on slug/natural keys.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { UNIVERSITIES, COURSES } from '../lib/data.js';
import { RECOGNITION_RULES, GRADE_CONVERSION, COUNTRY_PLAYBOOKS } from '../lib/seed-data.js';
import { applyMethod, parseNc } from './transforms.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- minimal .env.local loader ---
function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // rely on already-exported env
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

async function run() {
  // 1) Universities
  const uniRows = UNIVERSITIES.map((u) => ({
    slug: u.id,
    name: u.name,
    short: u.short,
    city: u.city,
    state: u.state,
    apply_method: applyMethod(u.portalType),
    portal_label: u.portalType,
    general_deadlines: u.generalDeadlines,
    semester_contribution: u.semesterContribution,
    blurb: u.blurb,
  }));
  const { error: uErr } = await db.from('universities').upsert(uniRows, { onConflict: 'slug' });
  if (uErr) throw uErr;

  // Map uni slug -> id for course FKs.
  const { data: unis, error: uSelErr } = await db.from('universities').select('id, slug');
  if (uSelErr) throw uSelErr;
  const idBySlug = Object.fromEntries(unis.map((u) => [u.slug, u.id]));

  // 2) Courses
  const courseRows = COURSES.map((c) => {
    const nc = parseNc(c);
    return {
      slug: c.id,
      university_id: idBySlug[c.universityId],
      name: c.name,
      degree: c.degree,
      semester: c.semester,
      language: c.language,
      nc_free: c.ncFree,
      ...nc,
      admission_requirements: c.admissionRequirements,
      language_requirements: c.languageRequirements,
      course_structure: c.courseStructure,
      how_to_apply: c.howToApply,
      application_deadline: c.applicationDeadline,
      keywords: c.keywords || [],
      apply_url: c.applyUrl,
      summary: c.summary,
    };
  });
  const { error: cErr } = await db.from('courses').upsert(courseRows, { onConflict: 'slug' });
  if (cErr) throw cErr;

  // 3) Recognition rules
  const { error: rErr } = await db
    .from('recognition_rules')
    .upsert(RECOGNITION_RULES, { onConflict: 'country,qualification_type' });
  if (rErr) throw rErr;

  // 4) Grade conversion
  const { error: gErr } = await db
    .from('grade_conversion')
    .upsert(GRADE_CONVERSION, { onConflict: 'qualification_type,grading_scale' });
  if (gErr) throw gErr;

  // 5) Country playbooks
  const { error: pErr } = await db
    .from('country_playbooks')
    .upsert(COUNTRY_PLAYBOOKS, { onConflict: 'country' });
  if (pErr) throw pErr;

  console.log(
    `Seeded: ${uniRows.length} universities, ${courseRows.length} courses, ` +
      `${RECOGNITION_RULES.length} recognition rules, ${GRADE_CONVERSION.length} grade rows, ` +
      `${COUNTRY_PLAYBOOKS.length} playbooks.`
  );
}

run().catch((e) => {
  console.error('Seed failed:', e.message || e);
  process.exit(1);
});
