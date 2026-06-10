const PROFILE_KEY = 'unipirate:profile';

// A-Level letter grades mapped to a 1–6 point scale (matches the GCE A-Levels
// grade_conversion row: A*=6 … E=1).
export const A_LEVEL_LETTERS = ['A*', 'A', 'B', 'C', 'D', 'E'];
const A_LEVEL_POINTS = { 'A*': 6, A: 5, B: 4, C: 3, D: 2, E: 1 };

// A-Levels are stored in profile.aLevelGrades as a JSON list of
// { subject, grade } so the subject name is captured alongside the grade.
// parseALevels also accepts the legacy comma-string-of-letters format.
export function parseALevels(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) {
      // subject kept raw (don't trim mid-typing — would eat spaces between words)
      return v.map((x) =>
        typeof x === 'string'
          ? { subject: '', grade: x.trim() }
          : { subject: x.subject || '', grade: (x.grade || '').trim() }
      );
    }
  } catch {
    // legacy: comma-separated letters, no subject names
    return String(raw)
      .split(',')
      .map((s) => ({ subject: '', grade: s.trim() }))
      .filter((r) => r.grade);
  }
  return [];
}

// Serialize entered rows back to the stored JSON string. Keeps any row with a
// subject OR a grade (so a subject typed before its grade isn't lost); drops
// only fully-empty rows. Returns '' when nothing usable remains.
export function serializeALevels(rows = []) {
  const clean = rows
    // subject kept raw so spaces between words survive; only the empty-row test trims
    .map((r) => ({ subject: r.subject || '', grade: (r.grade || '').trim() }))
    .filter((r) => r.subject.trim() || r.grade);
  return clean.length ? JSON.stringify(clean) : '';
}

// Average of the entered A-Level grades on the 1–6 scale. Accepts an array of
// { grade } objects or plain letters, a JSON string, or a legacy comma string.
// Returns '' when none are valid (so it slots into profile.grade).
export function aLevelAverage(input) {
  let list;
  if (Array.isArray(input)) {
    list = input;
  } else {
    try {
      const parsed = JSON.parse(input);
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      list = String(input || '').split(',');
    }
  }
  const pts = list
    .map((it) => A_LEVEL_POINTS[((typeof it === 'string' ? it : it?.grade) || '').trim()])
    .filter((n) => typeof n === 'number');
  if (!pts.length) return '';
  const avg = pts.reduce((a, b) => a + b, 0) / pts.length;
  return String(Math.round(avg * 100) / 100);
}

export const BLANK_PROFILE = {
  country: '',
  qualification: '',
  grade: '',
  gradingScale: '',
  languageCert: '',
  languageScore: '',
  prefLanguage: 'Any',
  // A-Levels: comma-separated subject letter grades, e.g. 'A,A,B'.
  aLevelGrades: '',
  // IB: whether the diploma includes a Higher-Level Maths / natural science.
  ibHlMath: false,
  ibHlScience: false,
};

export const DEMO_PROFILE = {
  country: 'India',
  qualification: 'Standard 12th (CBSE/ICSE/State Board)',
  grade: '75',
  gradingScale: 'Percentage (0–100)',
  languageCert: 'IELTS',
  languageScore: '7.0',
  prefLanguage: 'English',
};

export function loadProfile() {
  if (typeof window === 'undefined') return BLANK_PROFILE;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return BLANK_PROFILE;
}

export function saveProfile(profile) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (_) {}
}

// --- DB mapping (camelCase profile <-> snake_case profiles row) ---
export function profileToRow(profile) {
  return {
    country: profile.country || null,
    qualification: profile.qualification || null,
    grade: profile.grade || null,
    grading_scale: profile.gradingScale || null,
    language_cert: profile.languageCert || null,
    language_score: profile.languageScore || null,
    pref_language: profile.prefLanguage || 'Any',
    a_level_grades: profile.aLevelGrades || null,
    ib_hl_math: !!profile.ibHlMath,
    ib_hl_science: !!profile.ibHlScience,
  };
}

export function profileFromRow(row) {
  if (!row) return null;
  return {
    country: row.country || '',
    qualification: row.qualification || '',
    grade: row.grade || '',
    gradingScale: row.grading_scale || '',
    languageCert: row.language_cert || '',
    languageScore: row.language_score || '',
    prefLanguage: row.pref_language || 'Any',
    aLevelGrades: row.a_level_grades || '',
    ibHlMath: !!row.ib_hl_math,
    ibHlScience: !!row.ib_hl_science,
  };
}

// Load the signed-in user's profile from the DB. Returns null if not found.
export async function loadProfileDb(supabase, userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  const mapped = profileFromRow(data);
  // A freshly created profiles row is all-nulls — treat as "no profile yet".
  if (mapped && !mapped.country && !mapped.qualification) return null;
  return mapped;
}

// Upsert the signed-in user's profile.
export async function saveProfileDb(supabase, userId, profile) {
  if (!supabase || !userId) return { error: 'not authenticated' };
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...profileToRow(profile), updated_at: new Date().toISOString() }, { onConflict: 'id' });
  return { error };
}
