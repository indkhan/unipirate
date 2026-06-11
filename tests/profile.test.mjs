import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  profileToRow, profileFromRow, DEMO_PROFILE,
  aLevelAverage, parseALevels, serializeALevels,
} from '../lib/profile.js';

test('profileToRow maps camelCase -> snake_case', () => {
  const row = profileToRow(DEMO_PROFILE);
  assert.equal(row.country, 'India');
  assert.equal(row.grading_scale, 'Percentage (0–100)');
  assert.equal(row.language_cert, 'IELTS');
  assert.equal(row.pref_language, 'English');
});

test('profileToRow defaults pref_language to Any', () => {
  const row = profileToRow({ country: 'X' });
  assert.equal(row.pref_language, 'Any');
  assert.equal(row.qualification, null);
});

test('profileFromRow maps snake_case -> camelCase', () => {
  const p = profileFromRow({
    country: 'China',
    qualification: 'Gaokao',
    grade: '75',
    grading_scale: 'Percentage (0–100)',
    language_cert: 'TestDaF',
    language_score: '4x4',
    pref_language: 'German',
  });
  assert.equal(p.country, 'China');
  assert.equal(p.gradingScale, 'Percentage (0–100)');
  assert.equal(p.languageCert, 'TestDaF');
  assert.equal(p.prefLanguage, 'German');
});

test('profileFromRow returns null for null row', () => {
  assert.equal(profileFromRow(null), null);
});

test('row <-> profile roundtrip preserves values', () => {
  const back = profileFromRow({ id: 'x', ...profileToRow(DEMO_PROFILE) });
  assert.equal(back.country, DEMO_PROFILE.country);
  assert.equal(back.qualification, DEMO_PROFILE.qualification);
  assert.equal(back.gradingScale, DEMO_PROFILE.gradingScale);
  assert.equal(back.prefLanguage, DEMO_PROFILE.prefLanguage);
});

test('DEMO_PROFILE qualification matches a curated India rule string', () => {
  assert.equal(DEMO_PROFILE.qualification, 'Standard 12th (CBSE/ICSE/State Board)');
});

test('profileToRow maps new A-Level / IB fields', () => {
  const row = profileToRow({
    country: 'India',
    qualification: 'IB Diploma',
    aLevelGrades: 'A,A,B',
    ibHlMath: true,
    ibHlScience: false,
  });
  assert.equal(row.a_level_grades, 'A,A,B');
  assert.equal(row.ib_hl_math, true);
  assert.equal(row.ib_hl_science, false);
});

test('profileFromRow maps new A-Level / IB fields with boolean coercion', () => {
  const p = profileFromRow({ a_level_grades: 'A*,A', ib_hl_math: true, ib_hl_science: null });
  assert.equal(p.aLevelGrades, 'A*,A');
  assert.equal(p.ibHlMath, true);
  assert.equal(p.ibHlScience, false);
});

test('aLevelAverage: best subjects map A*=6 … E=1', () => {
  assert.equal(aLevelAverage(['A', 'A', 'B']), '4.67'); // (5+5+4)/3
  assert.equal(aLevelAverage(['A*', 'A*', 'A*']), '6');
  assert.equal(aLevelAverage('A,B,C,'), '4'); // (5+4+3)/3, trailing empty ignored
  assert.equal(aLevelAverage([]), '');
  assert.equal(aLevelAverage(['X']), ''); // invalid letters ignored
});

test('aLevelAverage: works on { subject, grade } rows and JSON strings', () => {
  const rows = [
    { subject: 'Mathematics', grade: 'A' },
    { subject: 'Physics', grade: 'A' },
    { subject: 'Chemistry', grade: 'B' },
  ];
  assert.equal(aLevelAverage(rows), '4.67');
  assert.equal(aLevelAverage(JSON.stringify(rows)), '4.67');
});

test('serializeALevels: keeps any row with a subject OR grade, drops empty rows', () => {
  const json = serializeALevels([
    { subject: 'Mathematics', grade: 'A' },
    { subject: 'Physics', grade: '' }, // kept — subject typed before grade
    { subject: '', grade: 'B' },
    { subject: '', grade: '' }, // dropped — fully empty
  ]);
  const parsed = JSON.parse(json);
  assert.equal(parsed.length, 3);
  assert.deepEqual(parsed[0], { subject: 'Mathematics', grade: 'A' });
  assert.deepEqual(parsed[1], { subject: 'Physics', grade: '' });
  assert.deepEqual(parsed[2], { subject: '', grade: 'B' });
});

test('parseALevels: round-trips JSON and reads the legacy comma format', () => {
  const rows = [{ subject: 'Biology', grade: 'A*' }, { subject: 'Chemistry', grade: 'A' }];
  assert.deepEqual(parseALevels(serializeALevels(rows)), rows);
  // legacy: bare letters, no subject names
  assert.deepEqual(parseALevels('A,B'), [
    { subject: '', grade: 'A' },
    { subject: '', grade: 'B' },
  ]);
  assert.deepEqual(parseALevels(''), []);
});
