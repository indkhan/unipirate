'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  loadChecklistOverridesLocal,
  saveChecklistOverridesLocal,
  loadChecklistOverridesDb,
  saveChecklistOverridesDb,
} from '@/lib/profile';
import { buildChecklist, checklistSummary, STATUS } from '@/lib/checklist';
import { Badge, Icon, cx } from './ui';

const VIS = {
  [STATUS.DONE]: { tone: 'emerald', icon: 'check', label: 'Done' },
  [STATUS.IN_PROCESS]: { tone: 'amber', icon: 'info', label: 'In process' },
  [STATUS.NOT_DONE]: { tone: 'slate', icon: null, label: 'Not done' },
};

// variant: 'dashboard' (full to-do checklist) | 'eligibility' (gated next steps).
// initialOverrides: seed from the server (dashboard) to avoid a flash; when
// omitted the component loads them itself (DB if signed in, else localStorage).
export default function ProgressChecklist({ profile, verdict, initialOverrides, variant = 'dashboard' }) {
  const { userId, loading: authLoading, supabase } = useAuth();
  const [overrides, setOverrides] = useState(initialOverrides || {});

  useEffect(() => {
    if (initialOverrides) return; // already seeded
    if (authLoading) return;
    let active = true;
    (async () => {
      if (userId && supabase) {
        const db = await loadChecklistOverridesDb(supabase, userId);
        if (active && db) setOverrides(db);
      } else if (active) {
        setOverrides(loadChecklistOverridesLocal());
      }
    })();
    return () => { active = false; };
  }, [authLoading, userId, supabase, initialOverrides]);

  function persist(next) {
    if (userId && supabase) saveChecklistOverridesDb(supabase, userId, next);
    else saveChecklistOverridesLocal(next);
  }

  function setOverride(key, value) {
    setOverrides((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      persist(next);
      return next;
    });
  }

  const items = buildChecklist(profile, verdict, overrides);
  const { done, total } = checklistSummary(items);

  return (
    <div className="rounded-xl border border-line bg-white p-6 md:p-7">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-5">
        <div className="flex items-baseline gap-4">
          <span className="text-[12px] uppercase tracking-[0.18em] text-ink-40">
            {variant === 'eligibility' ? 'Before you apply' : 'Your progress'}
          </span>
          <div className="text-[22px] text-ink-90" style={{ fontFamily: "'Instrument Serif', serif" }}>
            {variant === 'eligibility' ? 'What unlocks next' : 'To-do checklist'}
          </div>
        </div>
        <div className="text-[12.5px] text-ink-50" style={{ fontFeatureSettings: "'tnum'" }}>
          {done} / {total} done
        </div>
      </div>

      {/* progress bar */}
      <div className="h-1.5 rounded-full bg-ink-5 overflow-hidden mb-5">
        <div
          className="h-full bg-navy/70 rounded-full transition-[width]"
          style={{ width: total ? `${(done / total) * 100}%` : '0%' }}
        />
      </div>

      <ol className="divide-y divide-line">
        {items.map((it) => {
          const vis = VIS[it.status];
          const isDone = it.status === STATUS.DONE;
          return (
            <li key={it.key} className="py-3.5 flex items-start gap-4">
              <span
                className={cx(
                  'mt-0.5 h-6 w-6 shrink-0 rounded-full inline-flex items-center justify-center border',
                  isDone
                    ? 'bg-[oklch(0.96_0.04_150)] border-[oklch(0.85_0.06_150)] text-[oklch(0.38_0.1_150)]'
                    : it.status === STATUS.IN_PROCESS
                    ? 'bg-[oklch(0.96_0.05_80)] border-[oklch(0.86_0.08_75)] text-[oklch(0.42_0.12_70)]'
                    : 'border-line text-ink-40'
                )}
              >
                {vis.icon ? <Icon name={vis.icon} size={13} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] text-ink-90 font-medium">{it.label}</span>
                  {it.required && <Badge tone="navy">Required</Badge>}
                  <Badge tone={vis.tone}>{vis.label}</Badge>
                </div>
                <div className="text-[12.5px] text-ink-60 mt-1 leading-[1.55]">{it.detail}</div>

                {/* Gating: what finishing this unlocks (eligibility, non-done only). */}
                {variant === 'eligibility' && !isDone && it.unlocks && (
                  <div className="text-[12px] text-navy/80 mt-1.5 inline-flex items-center gap-1.5">
                    <Icon name="arrowRight" size={12} /> {it.unlocks}
                  </div>
                )}

                {(!isDone || it.canFlag) && (
                  <div className="mt-2 flex items-center gap-3 text-[12px]">
                    {!isDone && (
                      <Link href={it.href} className="text-navy font-medium hover:underline inline-flex items-center gap-1">
                        {it.href === '/result' ? 'Open' : 'Add / edit'} <Icon name="arrowRight" size={11} />
                      </Link>
                    )}
                    {it.canFlag && it.status !== STATUS.IN_PROCESS && (
                      <button
                        type="button"
                        onClick={() => setOverride(it.key, STATUS.IN_PROCESS)}
                        className="text-ink-50 hover:text-ink-90"
                      >
                        Mark in process
                      </button>
                    )}
                    {overrides[it.key] === STATUS.IN_PROCESS && (
                      <button
                        type="button"
                        onClick={() => setOverride(it.key, null)}
                        className="text-ink-50 hover:text-ink-90"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
