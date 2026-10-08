import {expect,it} from 'vitest';
import {ENGINE_REVISION} from '../current';
import {evaluateAssessment,parseStoredAssessment} from '../assessment';
import {pakistanProfile,reviewedPakistanRules} from '@/lib/engine/__tests__/pakistan.fixture';
import {version,context,answers as oldAnswers,profile as oldProfile} from './assessment-fixtures';

it('records explicit Pakistan integration revision with immutable source-backed UUID envelopes and retains protected old revision',()=>{
 expect(ENGINE_REVISION).toContain('pakistan-current-v2');
 const raw={...reviewedPakistanRules()[0],id:'00000000-0000-4000-8000-000000000081'};
 const envelope=version(1,{rule_id:raw.id,raw_snapshot:raw,reviewed_at:'2026-10-08T00:00:00Z',published_at:'2026-10-08T00:00:00Z'});
 const assessment=evaluateAssessment(pakistanProfile,[envelope],{evaluatedAt:'2026-10-08T01:00:00Z',engineRevision:ENGINE_REVISION});
 expect(assessment.result.path).toBe('studienkolleg');expect(assessment.metadata.engineRevision).toBe(ENGINE_REVISION);
 expect(assessment.metadata.selectedVersionIds).toEqual([envelope.id]);expect(assessment.result.citations[0].sourceUrl).toBe(raw.source_url);
 const prior=evaluateAssessment(oldProfile,[version(1)],context);
 const frozen=JSON.stringify(prior.metadata);
 const stored=parseStoredAssessment({assessment_metadata:prior.metadata,result:prior.result,answers:oldAnswers},[version(1)]);
 expect(stored.kind).toBe('authoritative');if(stored.kind==='authoritative')expect(stored.original.metadata.engineRevision).toBe(context.engineRevision);
 expect(JSON.stringify(prior.metadata)).toBe(frozen);
});
