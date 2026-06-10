// Throwaway end-to-end verification against the live project.
// Creates two test users, exercises profile + tracking + RLS isolation,
// then deletes them. Run: node scripts/verify.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(URL, SVC, { auth: { persistSession: false } });
const pass = 'Test!2345';
const ok = (m) => console.log('  ✓', m);
const bad = (m) => { console.log('  ✗', m); process.exitCode = 1; };

async function mkUser(email) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: pass, email_confirm: true });
  if (error) throw error;
  return data.user.id;
}
async function userClient(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: pass });
  if (error) throw error;
  return c;
}

async function run() {
  const e1 = `verify1_${Date.now()}@example.com`;
  const e2 = `verify2_${Date.now()}@example.com`;
  let u1, u2;
  try {
    u1 = await mkUser(e1);
    u2 = await mkUser(e2);
    ok('created two test users');

    const c1 = await userClient(e1);
    const c2 = await userClient(e2);
    ok('both signed in (email/password)');

    // profile upsert as user1
    await c1.from('profiles').upsert({ id: u1, country: 'India', qualification: 'Standard 12th (CBSE/ICSE/State Board)', grade: '75', grading_scale: 'Percentage (0–100)' });
    const { data: p1 } = await c1.from('profiles').select('country').eq('id', u1).single();
    p1?.country === 'India' ? ok('user1 profile saved + read back') : bad('profile read');

    // user2 cannot read user1 profile
    const { data: leak } = await c2.from('profiles').select('*').eq('id', u1);
    (leak?.length ?? 0) === 0 ? ok('RLS: user2 cannot read user1 profile') : bad('RLS profile leak!');

    // track a real course as user1
    const { data: course } = await admin.from('courses').select('id, name').limit(1).single();
    const { data: app, error: tErr } = await c1.from('tracked_applications').insert({ user_id: u1, course_id: course.id }).select('id').single();
    if (tErr) bad('track insert: ' + tErr.message); else ok(`user1 tracked "${course.name}"`);
    await c1.from('application_steps').insert([{ tracked_app_id: app.id, label: 'Step A', sort_order: 0 }, { tracked_app_id: app.id, label: 'Step B', sort_order: 1 }]);

    // dashboard query shape as user1
    const { data: dash } = await c1.from('tracked_applications')
      .select('id, course:courses(name, university:universities(name)), steps:application_steps(*)')
      .eq('user_id', u1);
    (dash?.[0]?.steps?.length === 2 && dash[0].course?.university?.name)
      ? ok('dashboard query returns course + university + 2 steps')
      : bad('dashboard query shape');

    // user2 cannot see user1 tracked app
    const { data: leak2 } = await c2.from('tracked_applications').select('*').eq('user_id', u1);
    (leak2?.length ?? 0) === 0 ? ok('RLS: user2 cannot read user1 applications') : bad('RLS tracked leak!');

    // non-admin cannot read uni_requests
    await c1.from('uni_requests').insert({ uni_name: 'Test Uni' });
    const { data: reqLeak } = await c1.from('uni_requests').select('*');
    (reqLeak?.length ?? 0) === 0 ? ok('RLS: non-admin cannot read uni_requests') : bad('RLS uni_requests leak!');

    // non-admin cannot write content
    const { error: wErr } = await c1.from('universities').insert({ slug: 'hack', name: 'x', short: 'x', city: 'x', state: 'x' });
    wErr ? ok('RLS: non-admin blocked from writing universities') : bad('RLS content write leak!');
  } finally {
    if (u1) await admin.auth.admin.deleteUser(u1);
    if (u2) await admin.auth.admin.deleteUser(u2);
    await admin.from('uni_requests').delete().eq('uni_name', 'Test Uni');
    ok('cleaned up test users + data');
  }
}
run().catch((e) => { bad('threw: ' + (e.message || e)); process.exit(1); });
