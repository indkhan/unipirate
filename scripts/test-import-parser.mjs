// Quick manual test for the DAAD import parser. No framework — run with:
//   npm run test:parser
// Swap scripts/fixtures/daad-sample.txt with your own paste to try it live.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { extractDaadId, extractLabeledFields, ALL_FIELD_KEYS } from '../lib/import/parse.js';
import { validateImport, dateGate } from '../lib/import/validate.js';
import { detectApplyMethod } from '../lib/import/portal.js';
import { sha256Hex } from '../lib/import/hash.js';

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(here, 'fixtures', 'daad-sample.txt'), 'utf8');

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!cond) failures += 1;
};

console.log('=== extractDaadId ===');
check(
  'en detail url',
  extractDaadId('https://www2.daad.de/deutschland/studienangebote/international-programmes/en/detail/10360/') === '10360'
);
check(
  'de detail url',
  extractDaadId('https://www2.daad.de/deutschland/studienangebote/international-programmes/de/detail/4722/') === '4722'
);
check('bare detail url', extractDaadId('https://example.com/detail/99/') === '99');
check('no id', extractDaadId('https://www2.daad.de/deutschland/') === null);

console.log('\n=== extractLabeledFields (fixture) ===');
const { fields, germanPage } = extractLabeledFields(raw);
check('not flagged german', germanPage === false);

const expected = {
  course_name: 'Data Science',
  uni_name: 'Catholic University of Eichstätt-Ingolstadt',
  city: 'Ingolstadt',
  degree: 'Master of Science in Data Science',
  language: 'English',
  fulltime: 'full-time',
  duration: '4 semesters',
  semester: 'Winter semester',
  application_deadline: '15 July for the following winter semester',
  tuition: 'None',
  semester_contribution: '78 EUR per semester',
  language_requirements: 'English B2 (CEFR)',
  submit_to: 'Online application via https://bewerbung.ku.de',
};
for (const [key, want] of Object.entries(expected)) {
  const got = fields[key]?.value;
  check(`field ${key}`, got === want, got !== want ? `got: ${JSON.stringify(got)}` : '');
}
check(
  'admission_requirements captured',
  (fields.admission_requirements?.value || '').includes('GRE Subject Test in Mathematics')
);
check(
  'summary captured, stops at next section',
  (fields.summary?.value || '').includes('machine learning methods') &&
    !(fields.summary?.value || '').includes('Course organisation')
);

console.log('\n=== validateImport ===');
const today = new Date(Date.UTC(2026, 5, 12)); // 2026-06-12
const v = validateImport(fields, raw, today);
check('ok', v.ok === true, v.errors.join('; '));
check('deadline iso inferred', v.fields.application_deadline?.iso === '2026-07-15',
  `got: ${v.fields.application_deadline?.iso}`);
check('degree normalized', v.fields.degree?.normalized === 'Master');
check('language normalized', v.fields.language?.normalized === 'English');
check('semester normalized', v.fields.semester?.normalized === 'Winter');

// Hallucination defense: a value not present in the paste must be dropped.
const poisoned = { ...fields, tuition: { value: '5000 EUR per semester', source: 'llm' } };
const v2 = validateImport(poisoned, raw, today);
check('substring gate drops hallucinated value', v2.fields.tuition?.source === 'not_found');

// Missing required field → reject.
const noName = { ...fields };
delete noName.course_name;
const v3 = validateImport(noName, raw, today);
check('missing course_name rejects', v3.ok === false);

console.log('\n=== dateGate ===');
check('15 July → next occurrence', dateGate('15 July', today)?.iso === '2026-07-15');
check('15 May → rolls to next year', dateGate('15 May', today)?.iso === '2027-05-15');
check('explicit year kept', dateGate('15 July 2026', today)?.iso === '2026-07-15');
check('US order', dateGate('July 15, 2026', today)?.iso === '2026-07-15');
check('range takes end date', dateGate('1 June – 15 July', today)?.iso === '2026-07-15');
check('31 February invalid', dateGate('31 February', today) === null);
check('no date → null', dateGate('rolling admission', today) === null);

console.log('\n=== detectApplyMethod ===');
check('uni-assist', detectApplyMethod('Application via uni-assist') === 'uni-assist');
check('direct via url', detectApplyMethod('Online application via https://bewerbung.ku.de') === 'direct');
check('direct via portal word', detectApplyMethod('University application portal') === 'direct');
check('other', detectApplyMethod('By post to the registrar') === 'other');
check('empty → null', detectApplyMethod('') === null);

console.log('\n=== german page detection ===');
const deText = ['Abschluss', 'Master of Science', 'Studienort', 'Ingolstadt', 'Unterrichtssprache', 'Englisch', 'Bewerbungsfrist', '15. Juli'].join('\n');
check('german paste flagged', extractLabeledFields(deText).germanPage === true);

console.log('\n=== hash ===');
check('sha256 stable', sha256Hex('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

console.log('\n=== field table ===');
for (const key of ALL_FIELD_KEYS) {
  const f = v.fields[key];
  const val = f?.value ? (f.value.length > 60 ? f.value.slice(0, 57) + '…' : f.value) : '—';
  console.log(`${key.padEnd(24)} ${String(f?.source).padEnd(16)} ${val.replace(/\n/g, ' ⏎ ')}`);
}
if (v.warnings.length) console.log('\nwarnings:', v.warnings);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
