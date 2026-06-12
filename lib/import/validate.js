// Validation gates for parsed import fields. Pure — no DB, no network.
//
// The substring gate is the anti-hallucination contract: every fact value
// must literally appear in the user's pasted text (whitespace-collapsed),
// whether it came from regex or the LLM. Values that fail are dropped to
// not_found rather than stored.

import { ALL_FIELD_KEYS } from './parse.js';

const normWs = (s = '') => s.replace(/\s+/g, ' ').trim().toLowerCase();

export function substringGate(value, rawText) {
  if (!value) return false;
  return normWs(rawText).includes(normWs(value));
}

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};
const MONTH_RE = new RegExp(
  `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${Object.keys(MONTHS).join('|')})(?:\\s+(\\d{4}))?\\b|\\b(${Object.keys(MONTHS).join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`,
  'gi'
);

// Parse a free-text deadline ("15 July", "July 15, 2026", "1 June – 15 July
// for the winter semester") to an ISO date. Ranges take the END date (the
// binding deadline). No year → next future occurrence relative to `today`.
// Returns { iso, raw } or null. The raw string is always preserved upstream;
// only checklist due_dates use the inferred ISO.
export function dateGate(str, today = new Date()) {
  if (!str) return null;
  const matches = [...str.matchAll(MONTH_RE)];
  if (!matches.length) return null;
  const last = matches[matches.length - 1]; // range → end date
  const day = parseInt(last[1] ?? last[5], 10);
  const monthName = (last[2] ?? last[4] ?? '').toLowerCase();
  const year = last[3] ?? last[6] ?? null;
  const month = MONTHS[monthName];
  if (!Number.isInteger(day) || day < 1 || day > 31 || month == null) return null;

  let y = year ? parseInt(year, 10) : today.getUTCFullYear();
  let d = new Date(Date.UTC(y, month, day));
  if (d.getUTCMonth() !== month || d.getUTCDate() !== day) return null; // e.g. 31 February
  if (!year && d < today) {
    y += 1;
    d = new Date(Date.UTC(y, month, day));
    if (d.getUTCMonth() !== month) return null;
  }
  return { iso: d.toISOString().slice(0, 10), raw: str };
}

// Enum normalization. Runs AFTER the substring gate: the gate checks the raw
// extracted span; the normalized value is stored alongside it. Failure to map
// is a warning, never an error — the raw value is kept.
export const ENUMS = {
  language: [
    { value: 'English', re: /english only|^english\b(?!.*german)/i },
    { value: 'German', re: /german only|^german\b(?!.*english)/i },
    { value: 'English/German', re: /english.*german|german.*english|mixed/i },
  ],
  degree: [
    { value: 'Bachelor', re: /bachelor/i },
    { value: 'Master', re: /master/i },
    { value: 'PhD', re: /phd|doctor/i },
  ],
  semester: [
    { value: 'Winter/Summer', re: /winter.*summer|summer.*winter|both/i },
    { value: 'Winter', re: /winter/i },
    { value: 'Summer', re: /summer/i },
  ],
};

export function normalizeEnum(kind, raw) {
  const defs = ENUMS[kind];
  if (!defs || !raw) return null;
  for (const def of defs) {
    if (def.re.test(raw)) return def.value;
  }
  return null;
}

// Hard-required fields: without these the import is not displayable or
// dedup-able. daad_id is checked before parsing (from the URL).
const REQUIRED = ['course_name', 'uni_name'];

// Full validation pass. Input fields: {key: {value, source}}. Output keeps
// the same shape, adds normalized values where applicable, marks every known
// key (missing → source 'not_found'), and reports errors (reject import) vs
// warnings (store anyway).
export function validateImport(fields, rawText, today = new Date()) {
  const out = {};
  const errors = [];
  const warnings = [];

  for (const key of ALL_FIELD_KEYS) {
    const f = fields[key];
    if (!f || !f.value) {
      out[key] = { source: 'not_found' };
      continue;
    }
    if (!substringGate(f.value, rawText)) {
      warnings.push(`${key}: value failed substring gate, dropped`);
      out[key] = { source: 'not_found' };
      continue;
    }
    const entry = { value: f.value, source: f.source };
    if (key === 'application_deadline') {
      const d = dateGate(f.value, today);
      if (d) entry.iso = d.iso;
      else warnings.push('application_deadline: no parseable date found, raw text kept');
    }
    if (key === 'degree' || key === 'language' || key === 'semester') {
      const n = normalizeEnum(key, f.value);
      if (n) entry.normalized = n;
      else warnings.push(`${key}: could not map to known set, raw kept`);
    }
    out[key] = entry;
  }

  for (const key of REQUIRED) {
    if (out[key].source === 'not_found') {
      errors.push(`${key} is required and could not be extracted`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, fields: out };
}
