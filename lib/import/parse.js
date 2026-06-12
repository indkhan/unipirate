// Pure DAAD page-text parser. No DB, no network — testable via node.
//
// DAAD International Programmes detail pages render as labeled key-value
// pairs ("Degree" / "Teaching language" / "Application deadline" …), so a
// deterministic label scan extracts most fields. The LLM fallback (separate
// module) only ever sees fields this pass missed.

export const PARSER_VERSION = 1;

// .../international-programmes/en/detail/10360/  (also /de/ or no lang segment)
const DAAD_ID_RES = [
  /international-programmes\/(?:en|de)\/detail\/(\d+)/i,
  /\/detail\/(\d+)/i,
];

export function extractDaadId(url = '') {
  for (const re of DAAD_ID_RES) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

// Labels we extract. `match` strings are lowercase, colon-stripped prefixes;
// longest first wins so "tuition fees per semester in eur" beats "tuition fees".
// DE aliases are for *detecting* a German paste only — DE values are rejected
// upstream with a "paste the English version" hint.
const FIELD_LABELS = [
  { key: 'degree', match: ['degree'], de: ['abschluss'] },
  { key: 'city', match: ['course location'], de: ['studienort'] },
  { key: 'language', match: ['teaching language'], de: ['unterrichtssprache'] },
  { key: 'fulltime', match: ['full-time / part-time', 'full-time/part-time'], de: ['vollzeit / teilzeit'] },
  { key: 'duration', match: ['programme duration', 'program duration'], de: ['regelstudienzeit'] },
  { key: 'semester', match: ['beginning'], de: ['beginn'] },
  { key: 'application_deadline', match: ['application deadline', 'application deadlines'], de: ['bewerbungsfrist'] },
  { key: 'tuition', match: ['tuition fees per semester in eur', 'tuition fees'], de: ['studiengebühren'] },
  { key: 'semester_contribution', match: ['semester contribution'], de: ['semesterbeitrag'] },
  { key: 'summary', match: ['description/content', 'description / content'], de: ['inhalt'] },
  { key: 'admission_requirements', match: ['academic admission requirements'], de: ['akademische zulassungsvoraussetzungen'] },
  { key: 'language_requirements', match: ['language requirements'], de: ['sprachliche zulassungsvoraussetzungen'] },
  { key: 'submit_to', match: ['submit application to'], de: ['bewerbung einreichen an'] },
];

// Headings/labels that end a multiline value but aren't extracted themselves.
// Without these, a long capture would swallow the next section into a value.
const BOUNDARY_LABELS = [
  'overview',
  'languages',
  'combined master’s degree / phd programme',
  "combined master's degree / phd programme",
  'joint degree / double degree programme',
  'a diploma supplement will be issued',
  'course organisation',
  'costs / funding',
  'costs of living',
  'funding opportunities within the university',
  'requirements / registration',
  'application deadline',
  'services',
  'contact',
  'about the university',
  'accreditation',
];

const MAX_VALUE_CHARS = 2000;

const norm = (line) => line.trim().toLowerCase().replace(/:$/, '').trim();

function matchLabel(line) {
  const n = norm(line);
  if (!n) return null;
  // Longest match first across all field labels so overlapping prefixes
  // ("tuition fees…") resolve deterministically.
  let best = null;
  for (const def of FIELD_LABELS) {
    for (const m of def.match) {
      if ((n === m || n.startsWith(m)) && (!best || m.length > best.matchLen)) {
        best = { key: def.key, matchLen: m.length, rest: line.trim().slice(line.trim().toLowerCase().indexOf(m) + m.length).replace(/^[:\s]+/, '') };
      }
    }
  }
  return best;
}

function isBoundary(line) {
  const n = norm(line);
  if (!n) return false;
  return BOUNDARY_LABELS.some((b) => n === b || n.startsWith(b));
}

function countGermanLabels(lines) {
  let de = 0;
  for (const line of lines) {
    const n = norm(line);
    if (!n) continue;
    for (const def of FIELD_LABELS) {
      if ((def.de || []).some((m) => n === m || n.startsWith(m))) de += 1;
    }
  }
  return de;
}

// Course/university heuristic: DAAD renders "<Course name>" then
// "<University> • <City>" right above the "Overview" heading (or above the
// first labeled field). Weakest output of the regex pass — marked
// 'regex-heuristic' so the UI flags it and the LLM fallback targets it.
function extractTitleBlock(lines, firstLabelIdx) {
  let anchor = lines.findIndex((l) => norm(l) === 'overview');
  if (anchor === -1) anchor = firstLabelIdx;
  if (anchor <= 0) return {};
  const above = [];
  for (let i = anchor - 1; i >= 0 && above.length < 4; i--) {
    const t = lines[i].trim();
    if (t) above.push(t);
  }
  if (!above.length) return {};
  // above[0] = closest line above the anchor. Pattern: uni line contains a
  // "•" (or "·") separator with the city; course name sits above it.
  const sepRe = /\s[•·]\s/;
  let uniLine = above.find((l) => sepRe.test(l));
  let courseName = null;
  let uniName = null;
  let city = null;
  if (uniLine) {
    const parts = uniLine.split(sepRe).map((s) => s.trim()).filter(Boolean);
    uniName = parts[0] || null;
    city = parts[1] || null;
    const idx = above.indexOf(uniLine);
    courseName = above[idx + 1] || null; // next line further up
  } else {
    // No separator line: closest line above is usually the uni, the one
    // above that the course title.
    uniName = above[0] || null;
    courseName = above[1] || null;
  }
  return { courseName, uniName, city };
}

// Main extraction: line-scan for label lines; a field's value is the remainder
// of its label line plus following lines until the next field label or
// boundary heading, capped at MAX_VALUE_CHARS.
export function extractLabeledFields(rawText = '') {
  const lines = rawText.split(/\r?\n/);
  const fields = {};
  let firstLabelIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const hit = matchLabel(lines[i]);
    if (!hit) continue;
    if (firstLabelIdx === -1) firstLabelIdx = i;
    if (fields[hit.key]) continue; // first occurrence wins

    const parts = [];
    if (hit.rest) parts.push(hit.rest);
    for (let j = i + 1; j < lines.length; j++) {
      if (matchLabel(lines[j]) || isBoundary(lines[j])) break;
      const t = lines[j].trim();
      if (t) parts.push(t);
      else if (parts.length) break; // blank line after content ends the value
    }
    const value = parts.join('\n').slice(0, MAX_VALUE_CHARS).trim();
    if (value) fields[hit.key] = { value, source: 'regex' };
  }

  const title = extractTitleBlock(lines, firstLabelIdx);
  if (title.courseName && !fields.course_name) {
    fields.course_name = { value: title.courseName, source: 'regex-heuristic' };
  }
  if (title.uniName && !fields.uni_name) {
    fields.uni_name = { value: title.uniName, source: 'regex-heuristic' };
  }
  if (title.city && !fields.city) {
    fields.city = { value: title.city, source: 'regex-heuristic' };
  }

  const enCount = Object.values(fields).filter((f) => f.source === 'regex').length;
  const deCount = countGermanLabels(lines);
  const germanPage = deCount >= 3 && enCount < 3;

  return { fields, germanPage };
}

// Every key the pipeline knows about — used to mark not_found + drive the
// per-field LLM fallback list.
export const ALL_FIELD_KEYS = [
  'course_name',
  'uni_name',
  'city',
  'degree',
  'language',
  'fulltime',
  'duration',
  'semester',
  'application_deadline',
  'admission_requirements',
  'language_requirements',
  'submit_to',
  'tuition',
  'semester_contribution',
  'summary',
];
