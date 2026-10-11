import { expect, it } from 'vitest';
import { AnswersSchema, buildProfile } from '@/app/(public)/check/steps';
import { gceCandidates } from '@/scripts/gce.rules';
import { evaluateAssessment, parseStoredAssessment } from '../assessment';
import { version, raw, ruleId, context } from './assessment-fixtures';
const source = gceCandidates[0];
const published = version(1,{raw_snapshot:{...raw,...source,id:ruleId,status:'verified'}});
const answers = {targetDegree:'bachelor',nationality:'pk',certificateCountry:'sa',visaApplicationCountry:'other',curriculumType:'gce',gceVersion:1,gceQualificationContext:'british_international',gceQualificationType:'ial',gceEvidence:'final',gceAwardingBody:'caie',gceSchoolYears:12,gceSubjects:['mathematics','physics','chemistry'].map(subjectId=>({subjectId,level:'AL',grade:'C'})),targetField:'cs',intake:{term:'winter',year:2026}};
it('keeps the same academic path after the school-years question is removed, and preserves old records', () => {
  const oldAnswers = AnswersSchema.parse(answers);
  const old = evaluateAssessment(buildProfile(oldAnswers),[published],context);
  expect(old.result.path).toBe('subject_restricted');
  const stored = {answers:oldAnswers,result:old.result,assessment_metadata:old.metadata};
  const original = structuredClone(stored);
  expect(parseStoredAssessment(stored,[published]).kind).toBe('authoritative');
  // Removing the school-years question must not change the evaluation: the
  // reviewed rule no longer conditions on that fact, so a complete certificate
  // resolves to the same path whether or not the question was answered.
  const editedAnswers=AnswersSchema.parse({...answers,qualificationGuidanceVersion:1});
  const current=evaluateAssessment(buildProfile(editedAnswers),[published],context);
  expect(current.result.path).toBe('subject_restricted');
  expect(parseStoredAssessment({answers:editedAnswers,result:current.result,assessment_metadata:current.metadata},[published]).kind).toBe('authoritative');
  expect(stored).toEqual(original);
});
