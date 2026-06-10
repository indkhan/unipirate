'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cx } from './ui';

// Per-application checklist with persisting checkboxes.
export default function StepChecklist({ steps: initial = [] }) {
  const [steps, setSteps] = useState(
    [...initial].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  );

  async function toggle(step) {
    const next = !step.done;
    setSteps((s) => s.map((x) => (x.id === step.id ? { ...x, done: next } : x)));
    try {
      const supabase = createClient();
      await supabase.from('application_steps').update({ done: next }).eq('id', step.id);
    } catch (e) {
      // revert on failure
      setSteps((s) => s.map((x) => (x.id === step.id ? { ...x, done: !next } : x)));
      console.error('step toggle failed:', e.message || e);
    }
  }

  const done = steps.filter((s) => s.done).length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-1.5 flex-1 rounded-full bg-ink-5 overflow-hidden">
          <div
            className="h-full bg-navy transition-all"
            style={{ width: steps.length ? `${(done / steps.length) * 100}%` : '0%' }}
          />
        </div>
        <span className="text-[11.5px] text-ink-50 tabular-nums">{done}/{steps.length}</span>
      </div>
      <ul className="space-y-1.5">
        {steps.map((step) => (
          <li key={step.id}>
            <button
              onClick={() => toggle(step)}
              className="w-full flex items-start gap-3 text-left rounded-md px-2 py-1.5 hover:bg-ink-5/60"
            >
              <span
                className={cx(
                  'mt-0.5 h-5 w-5 shrink-0 rounded-[6px] border inline-flex items-center justify-center transition-colors',
                  step.done ? 'bg-navy border-navy text-paper' : 'border-line bg-paper'
                )}
              >
                {step.done && (
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M4 10l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className={cx('text-[13.5px] leading-[1.5]', step.done ? 'text-ink-40 line-through' : 'text-ink-80')}>
                {step.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
