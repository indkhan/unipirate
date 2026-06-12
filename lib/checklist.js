// Derives the progress checklist from a profile (+ recognition verdict).
// Pure: no I/O, no React — so the dashboard (server) and result page (client)
// build the exact same items.
//
// Status model ("mix"): Done / Not done are derived from the data; a Not-done
// item can additionally be flagged "In process" by the user (overrides map).
// Country + qualification are the hard requirement to enter the app; everything
// else is progressive and shows up as a to-do until done.

import { A_LEVEL_LETTERS, parseALevels, normalizeLanguageCerts, LANG_STATUS_LABEL } from './profile';

export const STATUS = { DONE: 'done', IN_PROCESS: 'in_process', NOT_DONE: 'not_done' };

const MIN_ALEVEL_SUBJECTS = 3; // anabin: ≥3 subjects at A-Level

function countValidALevels(profile) {
  return parseALevels(profile?.aLevelGrades).filter((r) =>
    A_LEVEL_LETTERS.includes((r.grade || '').trim())
  ).length;
}

// verdict: the resolved recognition object ({ status, headline, ... }) or null.
// overrides: { [itemKey]: 'in_process' } manual flags.
export function buildChecklist(profile, verdict, overrides = {}) {
  const p = profile || {};
  const isALevel = p.qualification === 'GCE A-Levels';
  const isIB = p.qualification === 'IB Diploma';
  const items = [];

  // --- Required foundation ---
  items.push({
    key: 'country',
    label: 'Country of qualification',
    required: true,
    href: '/onboarding',
    base: p.country ? STATUS.DONE : STATUS.NOT_DONE,
    detail: p.country || 'Select the country where you got your qualification.',
    unlocks: 'Needed before we can match any recognition rule.',
  });

  items.push({
    key: 'qualification',
    label: 'Qualification',
    required: true,
    href: '/onboarding',
    base: p.qualification ? STATUS.DONE : STATUS.NOT_DONE,
    detail: p.qualification || 'Pick your school-leaving qualification (A-Levels, IB, or country-specific).',
    unlocks: 'Unlocks your recognition verdict.',
  });

  // --- Grade / A-Level subjects (qualification-specific) ---
  if (isALevel) {
    const n = countValidALevels(p);
    const meetsMin = n >= MIN_ALEVEL_SUBJECTS;
    items.push({
      key: 'alevel',
      label: 'A-Level subjects & grades',
      href: '/onboarding',
      base: meetsMin ? STATUS.DONE : STATUS.NOT_DONE,
      detail: meetsMin
        ? `${n} subjects entered — meets the minimum.`
        : `Enter at least ${MIN_ALEVEL_SUBJECTS} A-Level subjects with grades (you have ${n}).`,
      unlocks: 'Confirms you meet the minimum A-Level subject count for direct access.',
    });
  } else {
    const hasGrade = p.grade !== '' && p.grade != null;
    items.push({
      key: 'grade',
      label: 'Final grade',
      href: '/onboarding',
      base: hasGrade ? STATUS.DONE : STATUS.NOT_DONE,
      detail: hasGrade
        ? `${p.grade}${p.gradingScale ? ` · ${p.gradingScale}` : ''}`
        : 'Add your final grade so we can check thresholds and NC matching.',
      unlocks: 'Sharpens your verdict (some countries gate on a grade threshold).',
    });
  }

  // --- IB Higher-Level subjects ---
  if (isIB) {
    const both = !!p.ibHlMath && !!p.ibHlScience;
    items.push({
      key: 'ib_hl',
      label: 'IB Higher-Level subjects',
      href: '/onboarding',
      base: both ? STATUS.DONE : STATUS.NOT_DONE,
      detail: both
        ? 'HL Maths + HL natural science → general direct access.'
        : 'Without HL Maths and a HL natural science, access is subject-restricted.',
      unlocks: 'Determines general vs subject-restricted access.',
    });
  }

  // --- Language certificates (one or more, each with its own status) ---
  const certs = normalizeLanguageCerts(p.languageCerts);
  let langBase;
  let langDetail;
  if (certs.length) {
    // Done once at least one cert is held; otherwise it's in progress
    // (waiting for results / planning to take).
    langBase = certs.some((c) => c.status === 'done') ? STATUS.DONE : STATUS.IN_PROCESS;
    langDetail = certs
      .map((c) => `${c.cert}${c.score ? ` ${c.score}` : ''} · ${LANG_STATUS_LABEL[c.status] || 'Planning to take'}`)
      .join('  ·  ');
  } else if (p.languageCert && p.languageCert !== 'None / planning to take') {
    langBase = STATUS.DONE;
    langDetail = `${p.languageCert}${p.languageScore ? ` · ${p.languageScore}` : ''}`;
  } else {
    langBase = STATUS.NOT_DONE;
    langDetail = 'Add a language certificate (IELTS, TOEFL, TestDaF, or DSH).';
  }
  items.push({
    key: 'language',
    label: 'Language certificate',
    href: '/onboarding',
    base: langBase,
    detail: langDetail,
    unlocks: 'Required to apply to most programs.',
  });

  // --- Recognition verdict (Done once it resolves; flag = awaiting official
  // anabin / uni-assist confirmation) ---
  items.push({
    key: 'recognition',
    label: 'Recognition verdict',
    href: '/result',
    base: verdict?.status ? STATUS.DONE : STATUS.NOT_DONE,
    detail: verdict?.status
      ? `${verdict.status} — ${verdict.headline}`
      : 'Complete country + qualification to see your verdict.',
    unlocks: 'Then browse matching courses in the finder.',
  });

  // Resolve final status. Country + qualification (the required choices) are
  // derived only. Every other item is flaggable: a manual "in process" override
  // beats the auto state — so even a filled-in (Done) item can be marked in
  // process (e.g. a predicted grade awaiting final results).
  return items.map((it) => {
    const canFlag = !it.required;
    let status = it.base;
    if (canFlag && overrides[it.key] === STATUS.IN_PROCESS) status = STATUS.IN_PROCESS;
    return { ...it, status, canFlag };
  });
}

export function checklistSummary(items) {
  const done = items.filter((i) => i.status === STATUS.DONE).length;
  return { done, total: items.length, complete: done === items.length };
}

// To-dos = everything not yet done (not-done + in-process).
export function checklistTodos(items) {
  return items.filter((i) => i.status !== STATUS.DONE);
}
