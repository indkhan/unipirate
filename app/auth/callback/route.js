import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// OAuth / email-confirmation callback: exchange the code for a session,
// ensure a profiles row exists, then redirect.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        await supabase
          .from('profiles')
          .upsert({ id: data.user.id }, { onConflict: 'id', ignoreDuplicates: true });
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
