import { expect, it } from 'vitest';
import { deriveFacts, evaluate, type Profile } from '../evaluate';
import { ordinaryGce, gceSubject } from './gce.fixture';
import { ordinaryIb } from './ib.fixture';
import { gceCandidates } from '../../../scripts/gce.rules';
import { ibCandidates } from '../../../scripts/ib.rules';

// Test-only published copies; these candidates are not verified production rules.
const rules = [...gceCandidates, ...ibCandidates].map(r => ({ ...r, status: 'verified' as const }));
const current = (profile: Profile): Profile => ({ ...structuredClone(profile), qualificationGuidanceVersion: 1 });

// A published GCE rule that still conditions on the removed school-years fact.
// Legacy database rows keep this shape; the guidance diagnostic must still
// assess every other check instead of a bare unknown, but never invent years.
const legacySchoolYearsRule = {
  ...gceCandidates.find(r => r.id === 'gce-technical-subject-restricted')!,
  status: 'verified' as const,
  conditions: { ...gceCandidates[0]!.conditions, gce_school_years: { op: 'gte' as const, value: 12 } },
};

it.each(['caie', 'pearson'] as const)('resolves a complete %s certificate identically with or without the removed school-years question', body => {
  const profile = current(ordinaryGce);
  profile.gce!.awardingBody = body;
  const result = evaluate(profile, rules);
  // Parity: dropping the school-years question never changes the academic path.
  const unversioned = evaluate({ ...structuredClone(ordinaryGce), gce: { ...ordinaryGce.gce!, awardingBody: body } }, rules);
  expect(result.path).toBe(unversioned.path);
  expect(result.path).toBe('subject_restricted');
  expect(result.citations.some(c => c.supports.includes('path'))).toBe(true);
  // The removed attendance fact is not derived and is never a follow-up.
  expect(deriveFacts(profile).gce_school_years).toBeUndefined();
  expect(result.diagnostics?.some(d => d.followUp?.key === 'gce_school_years')).toBe(false);
  expect(result.unknowns.join(' ')).not.toMatch(/requires.*12|how many|actual ascending school years/i);
  expect(profile.gce?.schoolYears).toBe(12); // Evaluation never mutates legacy input.
});
it('still assesses every non-duration check for a legacy published rule that conditions on school years', () => {
  const profile = current(ordinaryGce);
  const result = evaluate(profile, [legacySchoolYearsRule]);
  // The full route is not established without the duration fact, but the
  // surviving checks are reported rather than a bare unknown.
  expect(result.path).toBe('unknown');
  const diagnostic = result.diagnostics?.find(d => d.status === 'qualification_guidance');
  expect(diagnostic?.assessedChecks?.find(c => c.key === 'gce_min_al_grade')?.met).toBe(true);
  expect(diagnostic?.facts).toEqual([]);
  expect(result.unknowns.join(' ')).not.toMatch(/requires.*12|how many|actual ascending school years/i);
});
it('never promotes a mixed or low-grade trio even with every other check met', () => {
  const profile = current(ordinaryGce);
  profile.gce!.subjects = [gceSubject('mathematics'), gceSubject('physics'), gceSubject('chemistry', 'D')];
  const result = evaluate(profile, rules);
  expect(result.path).toBe('unknown');
  expect(result.diagnostics?.some(d => d.facts.some(f => f.key === 'gce_min_al_grade'))).toBe(true);
  expect(result.diagnostics?.flatMap(d => d.facts).some(f => f.key === 'gce_school_years')).toBe(false);
});
it('keeps national-system and provisional GCE applicability limitations', () => {
  for (const patch of [{ qualificationContext: 'national' as const }, { evidence: 'provisional' as const }, { qualificationType: 'pre_u' as const }]) {
    const profile = current(ordinaryGce);
    Object.assign(profile.gce!, patch);
    expect(evaluate(profile, rules).path).toBe('unknown');
  }
});
it('resolves a complete IB diploma identically with or without the removed school-years question', () => {
  const profile = current(ordinaryIb);
  const result = evaluate(profile, rules);
  const unversioned = evaluate(structuredClone(ordinaryIb), rules);
  expect(result.path).toBe(unversioned.path);
  expect(result.path).toBe('direct');
  expect(deriveFacts(profile).ib_school_years).toBeUndefined();
  expect(result.unknowns.join(' ')).not.toMatch(/years|Feststellungsprüfung/);
});
it('never derives qualification guidance from draft candidates or absent rules', () => {
  for (const candidates of [gceCandidates, []]) {
    expect(evaluate(current(ordinaryGce), candidates).diagnostics?.some(d => d.status === 'qualification_guidance')).toBe(false);
  }
});
it('takes every subject and grade threshold from the selected rule conditions', () => {
  const profile = current(ordinaryGce);
  const changed = rules.filter(r => r.conditions.curriculum === 'gce').map(r => ({ ...r, conditions: { ...r.conditions, gce_min_al_grade: { op: 'gte' as const, value: 5 } } }));
  const result = evaluate(profile, changed);
  expect(result.path).toBe('unknown');
  expect(result.diagnostics?.some(d => d.facts.some(f => f.key === 'gce_min_al_grade' && typeof f.expected === 'object' && f.expected.value === 5))).toBe(true);
});
it('uses the same full-AL witness for a complete GCE with extra low or dependent subjects', () => {
  const profile = current(ordinaryGce);
  profile.gce!.subjects.push(gceSubject('biology', 'D'), gceSubject('further_mathematics'));
  expect(evaluate(profile, rules).path).toBe('subject_restricted');
  profile.gce!.subjects = [gceSubject('mathematics'), gceSubject('further_mathematics'), gceSubject('physics')];
  expect(evaluate(profile, rules).path).toBe('unknown');
});
