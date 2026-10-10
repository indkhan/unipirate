import { describe, expect, it } from 'vitest';
import { AnswersSchema, buildProfile, normalizeAnswers, visibleSteps, withAnswer } from '../steps';

const gce = { targetDegree: 'bachelor', nationality: 'pk', certificateCountry: 'sa', visaApplicationCountry: 'other', curriculumType: 'gce', gceVersion: 1, gceQualificationContext: 'british_international', gceQualificationType: 'ial', gceEvidence: 'final', gceAwardingBody: 'caie', gceSubjects: [{ subjectId: 'mathematics', level: 'AL', grade: 'C' }], targetField: 'cs', intake: null } as const;

describe('qualification-based school flow', () => {
  it('accepts new GCE answers without school duration and retains distinct evidence', () => {
    for (const body of ['caie', 'pearson', 'oxford_aqa', 'other']) {
      const answers = AnswersSchema.parse({ ...gce, qualificationGuidanceVersion: 1, gceAwardingBody: body });
      expect(visibleSteps(answers)).not.toContain('gceSchoolYears');
      expect(visibleSteps(answers)).toEqual(expect.arrayContaining(['gceQualificationContext', 'gceQualificationType', 'gceEvidence', 'gceAwardingBody', 'gceSubjects']));
      expect(buildProfile(answers).gce?.schoolYears).toBeUndefined();
      expect(buildProfile(answers).tertiaryQualification).toBeUndefined();
    }
  });
  it('upgrades an explicit edit without rewriting the saved record', () => {
    const saved = AnswersSchema.parse({ ...gce, gceSchoolYears: 11 });
    const original = structuredClone(saved);
    const edit = withAnswer(saved, 'targetField', 'physics');
    expect(edit.qualificationGuidanceVersion).toBe(1);
    expect(edit.gceSchoolYears).toBeUndefined();
    expect(saved).toEqual(original);
    expect(normalizeAnswers(saved)).toEqual(original);
    expect(buildProfile(saved).gce?.schoolYears).toBe(11);
  });
  it('reads old duration-required records without weakening their validation', () => {
    expect(AnswersSchema.safeParse(gce).success).toBe(false);
    expect(AnswersSchema.safeParse({ ...gce, gceSchoolYears: 12 }).success).toBe(true);
  });
  it('keeps IB award evidence and subjects, and hides only the removed duration question', () => {
    const answers = withAnswer({ targetDegree: 'bachelor', certificateCountry: 'sa' }, 'curriculumType', 'ib');
    const steps = visibleSteps({ ...answers, ibDocumentStatus: 'awarded' });
    expect(steps).not.toContain('ibSchoolYears');
    expect(steps).not.toContain('ibFullDiploma');
    expect(steps).toEqual(expect.arrayContaining(['ibDocumentStatus', 'ibExamYear', 'ibExamSession', 'ibSubjects', 'ibTotalPoints']));
  });
  it('retains distinct national certificate, completion, marks and examination evidence', () => {
    const answers = withAnswer({ targetDegree: 'bachelor', certificateCountry: 'pk', apsScopeVersion: 1, schoolQualificationCountry: 'pk', schoolQualificationContext: 'national' }, 'curriculumType', 'national');
    const steps = visibleSteps({ ...answers, pkCertificate: 'hssc', pkSchoolCompletion: 'unknown', schoolQualificationCountry: 'pk', schoolQualificationContext: 'national' });
    expect(steps).toEqual(expect.arrayContaining(['pkCertificate', 'pkSchoolCompletion', 'pkGroup', 'schoolGradePercent']));
    expect(steps).not.toEqual(expect.arrayContaining(['gceSchoolYears', 'ibSchoolYears']));
  });
});
