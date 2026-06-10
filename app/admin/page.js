import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TopNav from '@/components/TopNav';
import AdminClient from '@/components/AdminClient';

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-paper">
      <TopNav />
      <main className="max-w-[1040px] mx-auto px-6 md:px-10 pt-10 pb-24">{children}</main>
    </div>
  );
}

export default async function AdminPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <Shell><p className="text-ink-60">Supabase isn’t configured.</p></Shell>;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!profile?.is_admin) {
    return (
      <Shell>
        <h1 className="text-[28px] text-ink-90" style={{ fontFamily: "'Instrument Serif', serif" }}>
          Not authorized
        </h1>
        <p className="mt-2 text-[14px] text-ink-60">This page is for administrators only.</p>
      </Shell>
    );
  }

  const [{ data: requests }, { data: universities }] = await Promise.all([
    supabase.from('uni_requests').select('*').eq('status', 'pending').order('created_at', { ascending: true }),
    supabase.from('universities').select('id, slug, name').order('name'),
  ]);

  return (
    <Shell>
      <h1
        className="text-[40px] text-ink-90 leading-tight"
        style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.02em' }}
      >
        Admin · moderation.
      </h1>
      <AdminClient initialRequests={requests || []} universities={universities || []} />
    </Shell>
  );
}
