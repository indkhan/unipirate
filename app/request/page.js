'use client';

import { useState } from 'react';
import TopNav from '@/components/TopNav';
import { Button, Icon, Field, TextInput } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

export default function RequestPage() {
  const { userId, configured, supabase } = useAuth();
  const [uniName, setUniName] = useState('');
  const [daadUrl, setDaadUrl] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabase.from('uni_requests').insert({
        uni_name: uniName,
        daad_url: daadUrl || null,
        pasted_text: text || null,
        user_id: userId,
      });
      if (error) throw error;
      setDone(true);
    } catch (e) {
      setErr(e.message || 'Could not submit your request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <TopNav />
      <main className="max-w-[640px] mx-auto px-6 pt-12 pb-24">
        <h1
          className="text-[36px] text-ink-90 leading-tight"
          style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.02em' }}
        >
          Request a university.
        </h1>
        <p className="mt-2 text-[14px] text-ink-60 leading-[1.6]">
          Can’t find a university? Paste its name and the DAAD course page (URL + the page text). Our team
          reviews submissions and adds verified programs.
        </p>

        {!configured && (
          <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-800">
            Submissions need Supabase configured. Add your keys to <code>.env.local</code>.
          </div>
        )}

        {done ? (
          <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-[14px] text-emerald-800">
            <div className="flex items-center gap-2 font-medium">
              <Icon name="check" size={16} /> Thanks — your request is in the queue.
            </div>
            <p className="mt-1 text-[13px]">We’ll review and add it. You can submit another anytime.</p>
            <div className="mt-4">
              <Button variant="secondary" size="sm" onClick={() => { setDone(false); setUniName(''); setDaadUrl(''); setText(''); }}>
                Submit another
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <Field label="University name" required>
              <TextInput value={uniName} onChange={setUniName} placeholder="e.g. University of Mannheim" />
            </Field>
            <Field label="DAAD course page URL" hint="From daad.de — the program page.">
              <TextInput value={daadUrl} onChange={setDaadUrl} type="url" placeholder="https://www.daad.de/…" />
            </Field>
            <Field label="Pasted page text" hint="Copy the course details from the page and paste here.">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder="Paste the course / admission details…"
                className="w-full rounded-md border border-line bg-paper text-[14px] text-ink-90 p-3.5 outline-none hover:border-ink-30 focus:border-navy focus:ring-2 focus:ring-navy/15 leading-[1.55]"
              />
            </Field>

            {err && <div className="text-[13px] text-red-600">{err}</div>}

            <Button type="submit" size="lg" disabled={busy || !configured || !uniName.trim()}>
              {busy ? 'Submitting…' : 'Submit request'}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
