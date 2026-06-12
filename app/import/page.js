import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TopNav from '@/components/TopNav';
import ImportClient from './ImportClient';

// Import requires sign-in: private imports are owned rows, and tracking
// (the point of importing) needs an account anyway.
export default async function ImportPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <div className="min-h-screen bg-paper">
        <TopNav />
        <main className="max-w-[760px] mx-auto px-6 pt-12 pb-24">
          <p className="text-ink-60">Supabase isn’t configured.</p>
        </main>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: myImports } = await supabase
    .from('imported_programs')
    .select('id, daad_id, course_name, uni_name, status, created_at')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />
      <main className="max-w-[860px] mx-auto px-6 md:px-10 pt-12 pb-24">
        <ImportClient initialImports={myImports || []} />
      </main>
    </div>
  );
}
