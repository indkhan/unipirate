import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { UNIVERSITIES, COURSES } from '@/lib/data';
import { RECOGNITION_RULES } from '@/lib/seed-data';
import { mergeRecognitionRules } from '@/lib/nc';
import { mapUniversity, mapCourse } from './map';

const isConfigured = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL;

// Recognition rules (snake_case). Reads Supabase; falls back to the curated
// static set when unconfigured or on error.
export async function getRecognitionRules() {
  if (!isConfigured()) return RECOGNITION_RULES;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('recognition_rules').select('*');
    if (error) throw error;
    return data?.length ? mergeRecognitionRules(data, RECOGNITION_RULES) : RECOGNITION_RULES;
  } catch (e) {
    console.error('[repo] getRecognitionRules fell back to static:', e.message || e);
    return RECOGNITION_RULES;
  }
}

// Universities + courses for the finder. Reads Supabase; falls back to the
// static dataset when Supabase isn't configured yet or a query fails, so the
// page never breaks (anon browsing stays alive).
export async function getFinderData() {
  if (!isConfigured()) {
    return { universities: UNIVERSITIES, courses: COURSES, source: 'static' };
  }

  try {
    const supabase = await createClient();
    const [{ data: unis, error: uErr }, { data: courseRows, error: cErr }] = await Promise.all([
      supabase.from('universities').select('*').eq('is_published', true),
      supabase.from('courses').select('*').eq('is_published', true),
    ]);
    if (uErr) throw uErr;
    if (cErr) throw cErr;
    if (!unis?.length) {
      return { universities: UNIVERSITIES, courses: COURSES, source: 'static-empty' };
    }

    const slugByUniId = Object.fromEntries(unis.map((u) => [u.id, u.slug]));
    return {
      universities: unis.map(mapUniversity),
      courses: (courseRows || []).map((c) => mapCourse(c, slugByUniId)),
      source: 'db',
    };
  } catch (e) {
    console.error('[repo] getFinderData fell back to static:', e.message || e);
    return { universities: UNIVERSITIES, courses: COURSES, source: 'static-error' };
  }
}
