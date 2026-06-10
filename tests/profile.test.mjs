import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileToRow, profileFromRow, DEMO_PROFILE } from '../lib/profile.js';

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
