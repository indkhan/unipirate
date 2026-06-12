import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Root entry point — pure router, renders nothing itself.
//  - Not signed in (or Supabase not configured) → /overview (the marketing landing).
//  - Signed in, profile not filled yet            → /onboarding (fill it).
//  - Signed in, profile filled                    → /dashboard.
// The top-left logo links straight to /overview so signed-in users still have
// an escape hatch back to the landing page.
export default async function Home() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect('/overview');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/overview');

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('country, qualification')
    .eq('id', user.id)
    .maybeSingle();

  // Minimum to enter the dashboard: country + qualification. Grade, language,
  // etc. are progressive checklist items (done / in-process / not-done) tracked
  // on the dashboard and eligibility page — not hard gates. A freshly created
  // profiles row is all-nulls — treated as "no profile yet".
  const profileStarted = !!(profileRow?.country && profileRow?.qualification);
  redirect(profileStarted ? '/dashboard' : '/onboarding');
}
