const PROFILE_KEY = 'unipirate:profile';

export const BLANK_PROFILE = {
  country: '',
  qualification: '',
  grade: '',
  gradingScale: '',
  languageCert: '',
  languageScore: '',
  prefLanguage: 'Any',
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
