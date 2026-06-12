// Pure helpers for promoting an import to the public catalog. The Supabase
// sequencing lives in the admin client; everything here is testable.

export function slugify(s = '') {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics (Eichstätt → eichstatt)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function initials(name = '') {
  const stop = new Set(['of', 'the', 'and', 'für', 'fur', 'der', 'die', 'das', 'und']);
  const words = name.split(/\s+/).filter((w) => w && !stop.has(w.toLowerCase()));
  if (words.length <= 2) return words.join(' ');
  return words.map((w) => w[0].toUpperCase()).join('');
}

// Effective field value: admin overrides beat user edits beat the parse.
export function effectiveFields(imp, adminEdits = {}) {
  const parsed = imp.parsed_json?.fields || {};
  const userEdits = imp.user_edits || {};
  const out = {};
  const keys = new Set([...Object.keys(parsed), ...Object.keys(userEdits), ...Object.keys(adminEdits)]);
  for (const key of keys) {
    out[key] = adminEdits[key] ?? userEdits[key] ?? parsed[key]?.value ?? null;
  }
  return out;
}

// Map effective import fields onto a courses-table row (snake_case).
// university_id and slug are supplied by the promote sequence.
export function toCourseRow(fields, { universityId, slug, rawUrl }) {
  const norm = (k) => fields[k] || null;
  return {
    slug,
    university_id: universityId,
    name: norm('course_name'),
    degree: norm('degree') || 'Unknown',
    semester: norm('semester') || 'Check official page',
    language: norm('language') || 'Check official page',
    nc_free: false,
    admission_requirements: norm('admission_requirements'),
    language_requirements: norm('language_requirements'),
    course_structure: norm('duration'),
    how_to_apply: norm('submit_to'),
    application_deadline: norm('application_deadline'),
    apply_url: rawUrl || null,
    summary: norm('summary'),
    keywords: [],
    is_published: true,
  };
}

// Map effective import fields onto a universities-table row for a brand-new
// university (when no name match exists).
export function toUniversityRow(fields, { slug, applyMethod, rawUrl }) {
  return {
    slug,
    name: fields.uni_name,
    short: initials(fields.uni_name || ''),
    city: fields.city || '',
    state: '',
    apply_method: applyMethod || 'other',
    portal_label: fields.submit_to ? fields.submit_to.slice(0, 120) : null,
    semester_contribution: fields.semester_contribution || null,
    daad_url: rawUrl || null,
    blurb: null,
    is_published: true,
  };
}
