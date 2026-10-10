import { expect, it } from 'vitest';
import { deriveFacts, evaluate, type Profile } from '../evaluate';
import { ordinaryGce, gceSubject } from './gce.fixture';
import { ordinaryIb } from './ib.fixture';
import { gceCandidates } from '../../../scripts/gce.rules';
import { ibCandidates } from '../../../scripts/ib.rules';

// Test-only published copies; these candidates are not verified production rules.
const rules = [...gceCandidates, ...ibCandidates].map(r => ({ ...r, status: 'verified' as const }));
const current = (profile: Profile): Profile => ({ ...structuredClone(profile), qualificationGuidanceVersion: 1 });

it.each(['caie', 'pearson'] as const)('shows useful %s checks without a false full recognition match', body => {
  const profile = current(ordinaryGce);
  profile.gce!.awardingBody = body;
  const result = evaluate(profile, rules);
  expect(deriveFacts(profile).gce_school_years).toBeUndefined();
  expect(result.path).toBe('unknown');
  expect(result.citations.some(c => c.supports.includes('path'))).toBe(false);
  const diagnostic = result.diagnostics?.find(d => d.status === 'qualification_guidance');
  expect(diagnostic?.assessedChecks?.find(c => c.key === 'gce_min_al_grade')?.met).toBe(true);
  expect(diagnostic?.facts).toEqual([]);
  expect(result.diagnostics?.some(d => d.followUp?.key === 'gce_school_years')).toBe(false);
  expect(result.unknowns.join(' ')).not.toMatch(/requires.*12|how many|actual ascending school years/i);
  expect(profile.gce?.schoolYears).toBe(12); // Evaluation never mutates legacy input.
});
it('checks one complete GCE witness and never promotes a mixed or low-grade trio', () => {
  const profile = current(ordinaryGce);
  profile.gce!.subjects = [gceSubject('mathematics'), gceSubject('physics'), gceSubject('chemistry', 'D')];
  const result = evaluate(profile, rules);
  expect(result.path).toBe('unknown');
  expect(result.diagnostics?.some(d => d.status === 'qualification_guidance')).toBe(false);
  expect(result.diagnostics?.some(d => d.facts.some(f => f.key === 'gce_min_al_grade'))).toBe(true);
  expect(result.diagnostics?.flatMap(d => d.facts).some(f => f.key === 'gce_school_years')).toBe(false);
});
it('keeps national-system and provisional GCE applicability limitations', () => {
  for (const patch of [{ qualificationContext: 'national' as const }, { evidence: 'provisional' as const }, { qualificationType: 'pre_u' as const }]) {
    const profile = current(ordinaryGce);
    Object.assign(profile.gce!, patch);
    expect(evaluate(profile, rules).diagnostics?.some(d => d.status === 'qualification_guidance')).toBe(false);
  }
});
it('assesses IB evidence without substituting an attendance fact or a Studienkolleg route', () => {
  const profile = current(ordinaryIb);
  const result = evaluate(profile, rules);
  expect(deriveFacts(profile).ib_school_years).toBeUndefined();
  expect(result.path).toBe('unknown');
  expect(result.diagnostics?.some(d => d.status === 'qualification_guidance' && d.assessedChecks?.some(c => c.key === 'ib_min_subject_grade' && c.met))).toBe(true);
  expect(result.unknowns.join(' ')).not.toMatch(/years|Feststellungsprüfung/);
});
it('never derives qualification guidance from draft candidates or absent rules', () => {
  for (const candidates of [gceCandidates, []]) {
    expect(evaluate(current(ordinaryGce), candidates).diagnostics?.some(d => d.status === 'qualification_guidance')).toBe(false);
  }
});
it('takes every subject and grade threshold from the selected rule conditions', () => {
  const profile=current(ordinaryGce);
  const changed=rules.filter(r=>r.conditions.curriculum==='gce').map(r=>({...r,conditions:{...r.conditions,gce_min_al_grade:{op:'gte' as const,value:5}}}));
  const result=evaluate(profile,changed);
  expect(result.diagnostics?.some(d=>d.status==='qualification_guidance')).toBe(false);
  expect(result.diagnostics?.some(d=>d.facts.some(f=>f.key==='gce_min_al_grade' && typeof f.expected==='object' && f.expected.value===5))).toBe(true);
});
it('uses the same full-AL witness for useful checks with extra low or dependent subjects', () => {
  const profile=current(ordinaryGce);
  profile.gce!.subjects.push(gceSubject('biology','D'),gceSubject('further_mathematics'));
  expect(evaluate(profile,rules).diagnostics?.some(d=>d.status==='qualification_guidance')).toBe(true);
  profile.gce!.subjects=[gceSubject('mathematics'),gceSubject('further_mathematics'),gceSubject('physics')];
  expect(evaluate(profile,rules).diagnostics?.some(d=>d.status==='qualification_guidance')).toBe(false);
});
