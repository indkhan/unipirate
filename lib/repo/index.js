// Data access layer. Currently re-exports static data from lib/data.js.
// Commit 5+ swaps individual readers to Supabase without touching page imports.
export { UNIVERSITIES } from './universities';
export { COURSES } from './courses';

// Static dropdown/reference constants pass through unchanged.
export {
  COUNTRIES,
  QUALIFICATIONS_BY_COUNTRY,
  GRADING_SCALES,
  LANGUAGE_CERTS,
} from '@/lib/data';
