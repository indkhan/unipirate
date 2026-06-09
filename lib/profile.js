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
  qualification: "Indian Bachelor's (4-year, recognized university)",
  grade: '78',
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
