// Application checklist generation for imports. Pure — reuses the existing
// country-playbook step builder and the deadline parser.
//
// Templates own the steps and dates; the LLM (separate module) may only
// rephrase wording, never alter steps or dates.

import { buildApplicationSteps } from '../track-steps.js';
import { dateGate } from './validate.js';

// Free-text deadline ("15 July for the following winter semester") → ISO
// date for due_date columns. Raw text is always preserved elsewhere; only
// the due_date uses this inference. Returns 'YYYY-MM-DD' or null.
export function inferDeadlineISO(deadlineText, today = new Date()) {
  return dateGate(deadlineText, today)?.iso ?? null;
}

// Hand-written portal steps inserted around the playbook's apply step.
const PORTAL_PRE_STEPS = {
  'uni-assist': ['Create a uni-assist account', 'Pay the uni-assist handling fee'],
  direct: ['Register on the university application portal'],
  other: [],
};

const APPLY_STEP_RE = /submit application|apply directly|apply via/i;
const DOCS_READY_LABEL = 'Have all documents ready for submission';
const DOCS_LEAD_DAYS = 14;

const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Attach the application deadline to the submit/apply steps of an existing
// step list. Used by TrackButton for any course (imported or curated) —
// keeps buildApplicationSteps' signature untouched.
export function withDeadline(steps, deadlineISO) {
  if (!deadlineISO) return steps;
  return steps.map((s) => (APPLY_STEP_RE.test(s.label) ? { ...s, due_date: deadlineISO } : s));
}

// Full checklist for an import: playbook steps + portal-specific steps +
// docs-ready step ahead of the deadline, dated where a deadline is known.
export function buildImportChecklist({ country, applyMethod, deadlineText, today = new Date() }) {
  const base = buildApplicationSteps(country, applyMethod);
  const deadlineISO = inferDeadlineISO(deadlineText, today);

  const steps = [];
  for (const step of base) {
    if (APPLY_STEP_RE.test(step.label)) {
      for (const label of PORTAL_PRE_STEPS[applyMethod] || []) {
        steps.push({ label, done: false });
      }
      steps.push({
        label: DOCS_READY_LABEL,
        done: false,
        due_date: deadlineISO ? addDays(deadlineISO, -DOCS_LEAD_DAYS) : null,
      });
      steps.push({ ...step, due_date: deadlineISO });
    } else {
      steps.push({ ...step, due_date: step.due_date ?? null });
    }
  }

  return steps.map((s, i) => ({ ...s, sort_order: i }));
}
