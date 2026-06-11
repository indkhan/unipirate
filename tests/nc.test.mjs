import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  roundGrade,
  findConversion,
  toGermanGrade,
  ncVerdict,
  resolveRecognition,
  matchRecognitionRule,
  mergeRecognitionRules,
} from '../lib/nc.js';
import { RECOGNITION_RULES, GRADE_CONVERSION } from '../lib/seed-data.js';

test('roundGrade rounds to one decimal', () => {
  assert.equal(roundGrade(2.343), 2.3);
  assert.equal(roundGrade(1.999), 2.0);
});

test('findConversion: exact match wins', () => {
  const row = findConversion('HSSC / Intermediate', 'Percentage (0–100)', GRADE_CONVERSION);
  assert.equal(row.n_max, 100);
  assert.equal(row.n_min, 33);
});

test('findConversion: falls back to generic * row by scale', () => {
  const row = findConversion('Totally Unknown Qual', 'IB points (0–45)', GRADE_CONVERSION);
  assert.equal(row.qualification_type, '*');
  assert.equal(row.n_max, 45);
  assert.equal(row.n_min, 24);
});

test('findConversion: returns null when nothing matches', () => {
  assert.equal(findConversion('X', 'No Such Scale', GRADE_CONVERSION), null);
});

test('toGermanGrade: official example CGPA 8/10 -> 2.0', () => {
  const g = toGermanGrade(
    8,
    { qualificationType: "Indian Bachelor's (recognised university, subject match)", gradingScale: 'CGPA out of 10' },
    GRADE_CONVERSION
  );
  assert.equal(g, 2.0);
});

test('toGermanGrade: India 12th 70% -> 2.3', () => {
  const g = toGermanGrade(
    70,
    { qualificationType: 'Standard 12th (CBSE/ICSE/State Board)', gradingScale: 'Percentage (0–100)' },
    GRADE_CONVERSION
  );
  assert.equal(g, 2.3); // 1 + 3*(100-70)/(100-33) = 2.343 -> 2.3
});

test('toGermanGrade: German scale is identity', () => {
  const g = toGermanGrade(
    2.5,
    { qualificationType: 'anything', gradingScale: 'German scale (1.0–6.0)' },
    GRADE_CONVERSION
  );
  assert.equal(g, 2.5);
});

test('toGermanGrade: clamps a top grade to 1.0 and is never below 1.0', () => {
  const g = toGermanGrade(
    100,
    { qualificationType: 'Standard 12th (CBSE/ICSE/State Board)', gradingScale: 'Percentage (0–100)' },
    GRADE_CONVERSION
  );
  assert.equal(g, 1.0);
});

test('toGermanGrade: clamps a failing grade to 4.0', () => {
  const g = toGermanGrade(
    10,
    { qualificationType: 'Standard 12th (CBSE/ICSE/State Board)', gradingScale: 'Percentage (0–100)' },
    GRADE_CONVERSION
  );
  assert.equal(g, 4.0);
});

test('toGermanGrade: non-numeric -> null', () => {
  assert.equal(
    toGermanGrade('A*', { qualificationType: 'x', gradingScale: 'A-Level grades' }, GRADE_CONVERSION),
    null
  );
});

test('toGermanGrade: no conversion row -> null', () => {
  assert.equal(
    toGermanGrade(80, { qualificationType: 'x', gradingScale: 'No Such Scale' }, GRADE_CONVERSION),
    null
  );
});

test('ncVerdict: NC-free -> open', () => {
  const v = ncVerdict({ course: { nc_free: true }, germanGrade: 3.5 });
  assert.equal(v.tier, 'open');
});

test('ncVerdict: missing NC -> unknown', () => {
  const v = ncVerdict({ course: { nc_free: false, nc_value: null }, germanGrade: 1.5 });
  assert.equal(v.tier, 'unknown');
});

test('ncVerdict: no converted grade -> no_conversion', () => {
  const v = ncVerdict({ course: { nc_free: false, nc_value: 2.0 }, germanGrade: null });
  assert.equal(v.tier, 'no_conversion');
});

test('ncVerdict: well below cutoff -> strong', () => {
  const v = ncVerdict({ course: { nc_free: false, nc_value: 2.0 }, germanGrade: 1.5 });
  assert.equal(v.tier, 'strong');
  assert.equal(v.margin, 0.5);
});

test('ncVerdict: at the line -> borderline', () => {
  const v = ncVerdict({ course: { nc_free: false, nc_value: 2.0 }, germanGrade: 2.0 });
  assert.equal(v.tier, 'borderline');
});

test('ncVerdict: above cutoff -> unlikely', () => {
  const v = ncVerdict({ course: { nc_free: false, nc_value: 2.0 }, germanGrade: 2.5 });
  assert.equal(v.tier, 'unlikely');
});

// --- recognition threshold gating ---
const chinaGaokao = RECOGNITION_RULES.find(
  (r) => r.country === 'China' && r.qualification_type === 'Gaokao'
);

test('resolveRecognition: China Gaokao >=70% -> subject-restricted', () => {
  const r = resolveRecognition(chinaGaokao, { grade: '75', grading_scale: 'Percentage (0–100)' });
  assert.equal(r.status, 'H+ (subject-restricted)');
  assert.equal(r.below, false);
  assert.equal(r.needs_aps, true);
});

test('resolveRecognition: China Gaokao <70% -> H- below variant', () => {
  const r = resolveRecognition(chinaGaokao, { grade: '65', grading_scale: 'Percentage (0–100)' });
  assert.equal(r.status, 'H-');
  assert.equal(r.below, true);
});

test('resolveRecognition: non-percentage grade cannot be downgraded', () => {
  const r = resolveRecognition(chinaGaokao, { grade: '2.0', grading_scale: 'German scale (1.0–6.0)' });
  assert.equal(r.below, false); // threshold not evaluable -> keep base status
});

test('resolveRecognition: rule without threshold passes through', () => {
  const malaysiaStpm = RECOGNITION_RULES.find(
    (r) => r.country === 'Malaysia' && r.qualification_type === 'STPM (with SPM)'
  );
  const r = resolveRecognition(malaysiaStpm, { grade: '3.5', grading_scale: 'CGPA out of 4' });
  assert.equal(r.status, 'H+');
  assert.equal(r.below, false);
});

// --- rule matching ---
test('matchRecognitionRule: exact India 12th match', () => {
  const m = matchRecognitionRule(
    { country: 'India', qualification: 'Standard 12th (CBSE/ICSE/State Board)' },
    RECOGNITION_RULES
  );
  assert.equal(m.country, 'India');
  assert.equal(m.needs_aps, true);
});

test('matchRecognitionRule: unknown country -> Other/Not listed', () => {
  const m = matchRecognitionRule(
    { country: 'Narnia', qualification: 'Wizardry' },
    RECOGNITION_RULES
  );
  assert.equal(m.country, 'Other / Not listed');
  assert.equal(m.status, 'UNCLEAR');
});

test('matchRecognitionRule: incomplete profile -> null', () => {
  assert.equal(matchRecognitionRule({ country: 'India' }, RECOGNITION_RULES), null);
});

// --- merge: stale DB + static fallback (fixes Saudi+A-Level showing UNCLEAR) ---
test('mergeRecognitionRules: stale DB without universal rules still resolves A-Levels', () => {
  // Simulate a DB seeded before A-Levels/IB existed (only the old country rows).
  const staleDb = RECOGNITION_RULES.filter((r) => r.country !== 'Any');
  const merged = mergeRecognitionRules(staleDb, RECOGNITION_RULES);
  const m = matchRecognitionRule({ country: 'Saudi Arabia', qualification: 'GCE A-Levels' }, merged);
  assert.equal(m.country, 'Any');
  assert.equal(m.status, 'H+ (subject-restricted)');
  assert.equal(m.needs_aps, false);
});

test('mergeRecognitionRules: DB row wins over static for the same key', () => {
  const db = [
    { country: 'India', qualification_type: 'Standard 12th (CBSE/ICSE/State Board)', status: 'H+' },
  ];
  const merged = mergeRecognitionRules(db, RECOGNITION_RULES);
  const india12 = merged.filter(
    (r) => r.country === 'India' && r.qualification_type === 'Standard 12th (CBSE/ICSE/State Board)'
  );
  assert.equal(india12.length, 1); // not duplicated
  assert.equal(india12[0].status, 'H+'); // DB override kept
});

test('mergeRecognitionRules: empty DB falls back to static', () => {
  assert.equal(mergeRecognitionRules([], RECOGNITION_RULES), RECOGNITION_RULES);
});

test('match + resolve: India 12th >=70% stays H- but uses base messaging', () => {
  const m = matchRecognitionRule(
    { country: 'India', qualification: 'Standard 12th (CBSE/ICSE/State Board)' },
    RECOGNITION_RULES
  );
  const r = resolveRecognition(m, { grade: '75', grading_scale: 'Percentage (0–100)' });
  assert.equal(r.below, false);
  assert.match(r.explanation, /70%/);
});

test('match + resolve: India 12th <70% uses below variant', () => {
  const m = matchRecognitionRule(
    { country: 'India', qualification: 'Standard 12th (CBSE/ICSE/State Board)' },
    RECOGNITION_RULES
  );
  const r = resolveRecognition(m, { grade: '60', grading_scale: 'Percentage (0–100)' });
  assert.equal(r.below, true);
  assert.match(r.headline, /Studienkolleg/i);
});

// --- universal qualifications (A-Levels / IB, country-agnostic) ---
test('matchRecognitionRule: A-Levels match the country-agnostic rule regardless of country', () => {
  const m = matchRecognitionRule(
    { country: 'Pakistan', qualification: 'GCE A-Levels' },
    RECOGNITION_RULES
  );
  assert.equal(m.country, 'Any');
  assert.equal(m.qualification_type, 'GCE A-Levels');
  assert.equal(m.needs_aps, false); // A-Level holders skip APS even from APS countries
  assert.equal(m.status, 'H+ (subject-restricted)');
});

test('matchRecognitionRule: exact country rule still wins over universal', () => {
  const m = matchRecognitionRule(
    { country: 'India', qualification: 'Standard 12th (CBSE/ICSE/State Board)' },
    RECOGNITION_RULES
  );
  assert.equal(m.country, 'India');
});

test('matchRecognitionRule: India JEE Advanced exact match needs APS', () => {
  const m = matchRecognitionRule(
    { country: 'India', qualification: 'JEE Advanced (qualified)' },
    RECOGNITION_RULES
  );
  assert.equal(m.country, 'India');
  assert.equal(m.needs_aps, true);
  assert.equal(m.status, 'H+ (subject-restricted)');
});

test('matchRecognitionRule: Saudi A-Levels -> universal rule, direct, no APS', () => {
  const m = matchRecognitionRule(
    { country: 'Saudi Arabia', qualification: 'GCE A-Levels' },
    RECOGNITION_RULES
  );
  assert.equal(m.country, 'Any');
  assert.equal(m.needs_aps, false);
  assert.equal(m.status, 'H+ (subject-restricted)');
});

test('matchRecognitionRule: Studienkolleg is universal H+ for any country, no APS', () => {
  for (const country of ['India', 'Saudi Arabia', 'Pakistan', 'China']) {
    const m = matchRecognitionRule(
      { country, qualification: 'Studienkolleg (completed)' },
      RECOGNITION_RULES
    );
    assert.equal(m.qualification_type, 'Studienkolleg (completed)', country);
    assert.equal(m.status, 'H+', country);
    assert.equal(m.needs_aps, false, country);
  }
});

test('APS is required only for India and China qualifications', () => {
  const apsCountries = new Set(
    RECOGNITION_RULES.filter((r) => r.needs_aps).map((r) => r.country)
  );
  assert.deepEqual([...apsCountries].sort(), ['China', 'India']);
});

// --- IB Higher-Level subject gating ---
const ibRule = RECOGNITION_RULES.find(
  (r) => r.country === 'Any' && r.qualification_type === 'IB Diploma'
);

test('resolveRecognition: IB with HL Maths + HL science -> general H+', () => {
  const r = resolveRecognition(ibRule, { ibHlMath: true, ibHlScience: true });
  assert.equal(r.status, 'H+');
  assert.equal(r.below, false);
});

test('resolveRecognition: IB missing a HL science -> subject-restricted', () => {
  const r = resolveRecognition(ibRule, { ibHlMath: true, ibHlScience: false });
  assert.equal(r.status, 'H+ (subject-restricted)');
  assert.equal(r.below, true);
});

test('resolveRecognition: IB also reads snake_case profile flags', () => {
  const r = resolveRecognition(ibRule, { ib_hl_math: true, ib_hl_science: true });
  assert.equal(r.status, 'H+');
});

// --- A-Level grade conversion ---
test('toGermanGrade: A-Level average 5.0 (AAA) -> 1.6', () => {
  const g = toGermanGrade(
    5,
    { qualificationType: 'GCE A-Levels', gradingScale: 'A-Level grades' },
    GRADE_CONVERSION
  );
  assert.equal(g, 1.6); // 1 + 3*(6-5)/(6-1) = 1.6
});

test('toGermanGrade: A-Level all A* (6.0) clamps to 1.0', () => {
  const g = toGermanGrade(
    6,
    { qualificationType: 'GCE A-Levels', gradingScale: 'A-Level grades' },
    GRADE_CONVERSION
  );
  assert.equal(g, 1.0);
});
