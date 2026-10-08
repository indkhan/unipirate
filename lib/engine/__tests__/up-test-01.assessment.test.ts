import { describe, expect, it } from 'vitest';
import { EngineRuleSchema } from '../evaluate';
import { evaluateAssessment, parseStoredAssessment, compareAssessments } from '@/lib/rules/assessment';
import { RuleVersionSchema, RawRuleSchema } from '@/lib/rules/versioning';
import { RULE_UNIVERSES, REVIEWED_CASES, SOCIAL_CASES, APS_PROFILES, socialEconomics, WINNING_PATH_SOURCES, ROUTE_CERTIFICATE_UNKNOWN, ROUTE_CERTIFICATE_MISSING, ROUTE_CERTIFICATE_HELD, INDIA_FLAGS, APS_INVENTORY, APS_ADDITIONAL, APS_SUPPORT, DMAT_SUPPORT, GCE_SHARED_CONTROLS, PK_PREP_CONTROLS, DIAGNOSTIC_CONTROLS, POSITIVE_FACTS, ROUTE_MEMBERSHIP, NEGATIVE_REPORT_MEMBERSHIP } from './up-test-01.assessment-cases.fixture';
import { simulatedPublication, publicationIdentity, originalIdentity, selectedRule, TEST_CONTEXT, TEST_PUBLICATION_AT, TEST_REVIEWER, FINAL_BASE_SHA } from './up-test-01.publication.fixture';
import { REVIEWED_SOURCES, LOGICAL_SOURCES, UNIVERSE_LOGICAL_IDS, LEGACY_SOURCES, IB_ACADEMIC_CANDIDATES, UNKNOWN_REVIEW_PATH_IDS, UNKNOWN_REVIEW_PATH_SOURCES } from './up-test-01.sources.fixture';
import { indianStudyProfile, historyChange } from './india-study.fixture';
import { currentPakistanProfile } from './pakistan.fixture';
import { ordinaryGce } from './gce.fixture';
import { currentPakistanAnswers } from '@/app/(public)/check/__tests__/pakistan-current.fixture';
import { AnswersSchema, buildProfile } from '@/app/(public)/check/steps';

const ids = (uuids: readonly string[]) => uuids.map(originalIdentity).sort();
const pathIds = (a: ReturnType<typeof evaluateAssessment>) => ids(a.result.citations.filter(c => c.supports.includes('path')).map(c => c.ruleId));
const invalidLegacy = ['1cb0cf24-8f39-44b4-b692-b9cb164e47fd','0e872b82-e7fb-41bb-9a35-53ecbe200df4'];
const currentPkIds = ['pakistan-current-year-science','pakistan-current-brochure-science','pakistan-current-year-commerce','pakistan-current-brochure-commerce','pakistan-current-year-humanities','pakistan-current-brochure-humanities'];
const selectionMissing = new Set(['PK-prep-science','PK-prep-commerce','PK-prep-humanities','PK-prep-boundary-unmet','PK-prep-missing-grade','PK-prep-outside-family','PK-intake-missing']);
for(const c of PK_PREP_CONTROLS)selectionMissing.add(c.id);
for(const group of ['science','commerce','humanities'])selectionMissing.add('PK-prep-'+group+'-alias-fsc');
const selectionOutside = new Set(['PK-intake-historical','PK-intake-outside']);

// No test file imports: dedicated approved expectations are fixture data only.
describe('UP-TEST-01 final immutable activation on base53e (TEST ONLY publication)', () => {
  it('fixes identity independently of input order and preserves original draft bytes', () => {
    expect(FINAL_BASE_SHA).toBe('53e75f58242ab7168b7354b375a9116204b29f56');
    const originals = JSON.stringify(RULE_UNIVERSES);
    const sourceRules = Object.values(RULE_UNIVERSES).flat();
    const versions = simulatedPublication(sourceRules);
    const unique = new Map(versions.map(v => [v.rule_id,v.id]));
    expect(new Set(unique.values()).size).toBe(unique.size);
    expect(new Set([...unique.keys(),...unique.values(),TEST_REVIEWER]).size).toBe(unique.size*2+1);
    expect(simulatedPublication([...sourceRules].reverse()).reverse()).toEqual(versions);
    for (const v of versions) {
      expect(RuleVersionSchema.safeParse(v).success).toBe(true);
      expect(RawRuleSchema.safeParse(v.raw_snapshot).success).toBe(true);
      expect(v).toMatchObject({version_number:1,supersedes_version_id:null,status:'verified',provenance:'human_publication',reviewed_by:TEST_REVIEWER,reviewed_at:TEST_PUBLICATION_AT,published_at:TEST_PUBLICATION_AT,captured_at:null,draft_revision:1,effective_from:null,effective_until:null});
      const logical = originalIdentity(v.rule_id);
      const original = sourceRules.find(r => r.id===logical)!;
      const raw = v.raw_snapshot as Record<string,unknown>;
      for (const key of Object.keys(original)) {
        if (key!=='id' && key!=='status') expect(raw[key],logical+': '+key).toEqual((original as unknown as Record<string,unknown>)[key]);
      }
      expect(raw.id).toBe(v.rule_id);
      expect(raw.status).toBe('verified');
    }
    expect(JSON.stringify(RULE_UNIVERSES)).toBe(originals);
    expect(RULE_UNIVERSES.GCE.every(r=>r.status==='draft')).toBe(true);
    expect(() => simulatedPublication([{...RULE_UNIVERSES.GCE[0],id:'unapproved-source'}])).toThrow('Unassigned reviewed source');
  });

  it.each(Object.entries(RULE_UNIVERSES))('freezes literal reviewed source evidence for %s', (family,rules) => {
    expect(rules.map(r=>r.id).sort()).toEqual([...UNIVERSE_LOGICAL_IDS[family as keyof typeof UNIVERSE_LOGICAL_IDS]].sort());
    for (const rule of rules) {
      const source=LEGACY_SOURCES[rule.id] ?? REVIEWED_SOURCES[LOGICAL_SOURCES[rule.id]];
      expect(source,rule.id).toBeDefined();
      expect({url:rule.source_url,quote:rule.source_quote,verifiedAt:rule.last_verified_at}).toEqual({url:source.url,quote:source.quote,verifiedAt:source.verifiedAt});
      if (LOGICAL_SOURCES[rule.id]) expect(REVIEWED_SOURCES[LOGICAL_SOURCES[rule.id]].applicability.length).toBeGreaterThan(0);
      if (family==='IB' && !rule.id.includes('-document-')) {
        expect(rule).toMatchObject({annex_source_url:'https://www.kmk.org/zab/fileadmin/Dateien/pdf/ZAB/Hochschulzugang_Beschluesse_der_KMK/aktuell/283_Vereinb_Anerkenn_Int_Baccalaureate_Diploma-2023-06-15_Liste1__2026-03-26_Liste2-2024-11-19.pdf',annex_version:'kmk-2023/annex1-2026-03-26/annex2-2024-11-19'});
      }
    }
  });

  it.each(REVIEWED_CASES)('$universe / $id — actual strict assessment', c => {
    const rules=RULE_UNIVERSES[c.universe];
    const versions=simulatedPublication(rules);
    const before=JSON.stringify({profile:c.profile,rules,versions});
    const a=evaluateAssessment(c.profile,versions,TEST_CONTEXT);
    const flags=c.universe==='India'?INDIA_FLAGS:c.profile.hasExistingApsCertificate===true?ROUTE_CERTIFICATE_HELD:c.profile.hasExistingApsCertificate===false?ROUTE_CERTIFICATE_MISSING:ROUTE_CERTIFICATE_UNKNOWN;
    expect(a.result,c.id).toMatchObject({...flags,dMAT:c.dMAT??'unknown'});
    expect(a.result.institutionRestriction).toBe(c.fh?'fachhochschule':undefined);
    expect(ids(a.result.apsRuleIds??[])).toEqual(c.universe==='India'?[...APS_INVENTORY].sort():[]);
    if(c.universe==='India') {
      expect(ids(a.result.citations.filter(x=>x.supports.includes('aps:qualification')).map(x=>x.ruleId))).toEqual(['aps-scoped-qualification']);
      expect(a.result.citations.filter(x=>x.supports.includes('aps:application')||x.supports.includes('aps:visa'))).toEqual([]);
      expect(a.result.documents).toContain('APS India certificate');
      expect(a.result.stepsDetailed.some(s=>s.acquisition)).toBe(false);
    }
    if(c.path!==undefined)expect(a.result.path,c.reviewedIn).toBe(c.path);
    if(c.path==='unknown') {
      expect(pathIds(a)).toEqual([...(UNKNOWN_REVIEW_PATH_SOURCES[c.universe]?.[c.id]??[])].sort());
      expect(a.result.diagnostics?.some(d=>d.support==='path'&&d.status==='known_route')).toBe(false);
    }
    if(c.path!==undefined && c.path!=='unknown') {
      const sourceIds=WINNING_PATH_SOURCES[c.universe]?.[c.id];
      expect(sourceIds,c.id+': missing reviewed winning-source membership').toBeDefined();
      expect(pathIds(a)).toEqual([...sourceIds!].sort());
      const d=a.result.diagnostics?.find(d=>d.support==='path'&&d.status===(c.path==='insufficient'?'known_unmet_condition':'known_route'));
      expect(d).toMatchObject({reason:c.path==='insufficient'?'condition_unmet':'route_established'});
      expect(ids(d!.ruleIds)).toEqual([...sourceIds!].sort());
      expect(a.result.diagnostics?.some(d=>d.followUp)).toBe(false);
    }
    if(c.dMAT!==undefined) {
      expect(a.result.dMAT,c.reviewedIn).toBe(c.dMAT);
      const expected=DMAT_SUPPORT[c.id];expect(expected,c.id).toBeDefined();
      expect(ids(a.result.citations.filter(x=>x.supports.includes('dMAT')).map(x=>x.ruleId))).toEqual([...expected].sort());
      expect(a.result.path).toBe('unknown');
      expect(a.result.candidateCitations).toEqual([]);
      expect(a.result.diagnostics).toContainEqual({support:'path',status:'unsupported',reason:'no_supported_rule',ruleIds:[],facts:[]});
      const d=a.result.diagnostics?.find(d=>d.support==='dMAT');
      if(c.dMAT==='unknown')expect(d).toBeUndefined();
      else {expect(d).toMatchObject({status:'known_route',reason:'route_established'});expect(ids(d!.ruleIds)).toEqual([...expected].sort());}
    }
    if(c.universe==='Saudi')expect(a.result.institutionRestriction).toBe(c.fh?'fachhochschule':undefined);
    if(c.reason)expect(a.result.unknowns.join(' '),c.id).toMatch(c.reason);
    const excluded=c.universe==='India'?invalidLegacy:c.universe==='Pakistan'&&(selectionMissing.has(c.id)||selectionOutside.has(c.id))?currentPkIds:[];
    const selected=[...UNIVERSE_LOGICAL_IDS[c.universe]].filter(id=>!excluded.includes(id)).map(id=>publicationIdentity(id)).sort((a,b)=>a.ruleId.localeCompare(b.ruleId));
    const issueIds=c.universe==='India'?invalidLegacy:c.universe==='Pakistan'&&selectionMissing.has(c.id)?currentPkIds:[];
    const selectionIssues=issueIds.map(id=>({...publicationIdentity(id),reason:c.universe==='India'?'invalid_publication':'missing_intake'})).map(({ruleId,versionId,reason})=>({ruleId,versionId,reason})).sort((a,b)=>a.ruleId.localeCompare(b.ruleId));
    expect(a.metadata).toEqual({formatVersion:1,...TEST_CONTEXT,selectedVersionIds:selected.map(i=>i.versionId),selectionIssues});
    expect(a.selectedVersions).toEqual(selected.map(i=>versions.find(v=>v.id===i.versionId)));
    expect(a.selectedVersions.some(v=>(v.raw_snapshot as {outcomes?:{process?:unknown}}).outcomes?.process)).toBe(false);
    const selectedIds=new Set(a.selectedVersions.map(v=>v.rule_id));
    for(const citation of [...a.result.citations,...a.result.candidateCitations??[]]) {
      expect(selectedIds.has(citation.ruleId)).toBe(true);
      const raw=selectedRule(a.selectedVersions.find(v=>v.rule_id===citation.ruleId)!);
      expect(citation).toMatchObject({sourceUrl:raw.source_url,verifiedAt:raw.last_verified_at,status:'verified'});
      const source=REVIEWED_SOURCES[LOGICAL_SOURCES[originalIdentity(citation.ruleId)]];
      if(source)expect({url:citation.sourceUrl,verifiedAt:citation.verifiedAt}).toEqual({url:source.url,verifiedAt:source.verifiedAt});
    }
    for(const citation of a.result.candidateCitations??[]) {
      const allowed=c.universe==='dMAT'||c.universe==='transition'?[]:c.universe==='IB'?IB_ACADEMIC_CANDIDATES:UNIVERSE_LOGICAL_IDS[c.universe];
      expect(allowed).toContain(originalIdentity(citation.ruleId));
      expect(citation.supports).toEqual(['unknowns']);
      expect(citation.claim).toMatch(/^Candidate route only:/);
    }
    for(const diagnostic of a.result.diagnostics??[])for(const id of diagnostic.ruleIds)expect(selectedIds.has(id)).toBe(true);
    expect(JSON.stringify({profile:c.profile,rules,versions})).toBe(before);
  });

  it.each(SOCIAL_CASES)('root-approved GCE social $id [$kind/$evidence]', c => {
    const a=evaluateAssessment(c.profile,simulatedPublication(RULE_UNIVERSES.GCE),TEST_CONTEXT);
    expect(a.result).toMatchObject({path:c.path,aps:'unknown',apsScopes:{qualification:'unknown',application:'unknown',visa:'unknown'},apsCertificate:'unknown',apsRuleIds:[],testAS:'unknown',dMAT:'unknown',documents:[],stepsDetailed:[]});
    expect(a.result.institutionRestriction).toBeUndefined();
    if(c.path==='subject_restricted') {
      expect(pathIds(a)).toEqual(['gce-social-economics-subject-restricted','gce-social-economics-subject-restricted-cambridge']);
      expect(a.metadata.selectedVersionIds).toHaveLength(12);
      expect(a.result.diagnostics).toContainEqual(expect.objectContaining({support:'path',status:'known_route',reason:'route_established',ruleIds:expect.arrayContaining(['gce-social-economics-subject-restricted','gce-social-economics-subject-restricted-cambridge'].map(id=>publicationIdentity(id).ruleId))}));
      expect(a.result.diagnostics?.some(d=>d.followUp)).toBe(false);
    } else expect(a.result.citations.filter(c=>c.supports.includes('path'))).toEqual([]);
  });

  it.each([...APS_PROFILES,...APS_ADDITIONAL])('scoped APS literal $id', c => {
    const a=evaluateAssessment(c.profile,simulatedPublication(RULE_UNIVERSES.APS),TEST_CONTEXT);
    const contract=APS_SUPPORT[c.id];
    expect(a.result.aps).toBe(contract.aps);
    expect(a.result.documents).toEqual(contract.documents);
    expect(ids(a.result.apsRuleIds??[])).toEqual([...APS_INVENTORY].sort());
    const acquisition=a.result.stepsDetailed.filter(s=>s.acquisition);
    expect(acquisition).toHaveLength(contract.acquisition?1:0);
    if(contract.acquisition)expect(acquisition[0]).toMatchObject({ruleId:publicationIdentity('aps-scoped-acquisition').ruleId,order:10});
    for(const scope of ['qualification','application','visa'] as const) {
      const support=('aps:'+scope) as 'aps:qualification'|'aps:application'|'aps:visa';
      expect(ids(a.result.citations.filter(x=>x.supports.includes(support)).map(x=>x.ruleId))).toEqual([...contract[scope]].sort());
      if(contract[scope].length) {
        const d=a.result.diagnostics?.find(d=>d.support===support&&d.status==='known_route');
        expect(d).toMatchObject({reason:'route_established'});
        expect(ids(d!.ruleIds)).toEqual([...contract[scope]].sort());
      }
    }
    expect(a.result.diagnostics).toContainEqual({support:'path',status:'unsupported',reason:'no_supported_rule',ruleIds:[],facts:[]});
    expect(a.result.apsScopes).toEqual(c.scopes);
    expect(a.result.apsCertificate).toBe(c.certificate);
    expect(a.result.path).toBe('unknown');
    expect(a.result.testAS).toBe('unknown');expect(a.result.dMAT).toBe('unknown');
    expect(a.result.institutionRestriction).toBeUndefined();
    if(c.certificate!=='missing')expect(a.result.stepsDetailed.some(s=>s.acquisition)).toBe(false);
    expect(a.metadata.selectionIssues).toEqual([]);
    expect(a.metadata.selectedVersionIds).toEqual(UNIVERSE_LOGICAL_IDS.APS.map(id=>publicationIdentity(id)).sort((a,b)=>a.ruleId.localeCompare(b.ruleId)).map(i=>i.versionId));
  });

  it.each([49.99,undefined])('Pakistan diagnostic literal grade %s stays candidate-only',schoolGradePercent=>{
    const a=evaluateAssessment({...currentPakistanProfile,schoolGradePercent},simulatedPublication(RULE_UNIVERSES.Pakistan),TEST_CONTEXT);
    const d=a.result.diagnostics?.find(d=>d.facts.some(f=>f.key==='pk_grade_percent'));
    expect(d).toMatchObject({support:'path',status:schoolGradePercent===undefined?'targeted_missing_fact':'known_unmet_condition',reason:schoolGradePercent===undefined?'fact_missing':'condition_unmet'});
    expect(d?.facts).toContainEqual(expect.objectContaining({key:'pk_grade_percent',expected:{op:'gte',value:50},...(schoolGradePercent===undefined?{}:{actual:49.99})}));
  });

  it.each([['India',indianStudyProfile],['Pakistan',currentPakistanProfile]] as const)('exact %s prior-study follow-up and bound candidate evidence',(family,profile)=>{
    const a=evaluateAssessment({...profile,qualificationHistory:undefined},simulatedPublication(RULE_UNIVERSES[family]),TEST_CONTEXT);
    expect(a.result.path).toBe('unknown');
    expect(a.result.diagnostics?.filter(d=>d.followUp).map(d=>d.followUp?.question)).toEqual(['Have you previously studied at a university?']);
    expect(a.result.diagnostics).toContainEqual(expect.objectContaining({support:'path',status:'targeted_missing_fact',reason:'fact_missing'}));
  });

  it.each([undefined,0.99])('India successful-year diagnostic literal %s',completedYears=>{
    const a=evaluateAssessment(historyChange({completedYears,degreeYears:4}),simulatedPublication(RULE_UNIVERSES.India),TEST_CONTEXT);
    const d=a.result.diagnostics?.find(d=>d.facts.some(f=>f.key==='in_class12_successful_bachelor_years'));
    expect(d?.status).toBe(completedYears===undefined?'targeted_missing_fact':'known_unmet_condition');
    expect(d?.facts).toContainEqual(expect.objectContaining({key:'in_class12_successful_bachelor_years',expected:{op:'gte',value:1}}));
    if(completedYears===undefined)expect(d?.followUp?.question).toMatch(/successfully completed/);
  });

  it('selection-bound missing intake is separate from GCE condition-bound intake',()=>{
    const p=evaluateAssessment({...currentPakistanProfile,intake:undefined},simulatedPublication(RULE_UNIVERSES.Pakistan),TEST_CONTEXT);
    expect(p.result.path).toBe('unknown');
    expect(p.metadata.selectionIssues.map(x=>x.reason)).toEqual(Array(6).fill('missing_intake'));
    expect(p.result.diagnostics?.find(d=>d.followUp)?.followUp).toEqual({key:'intake_index',question:'Which intake are you applying for?'});
    expect(p.result.diagnostics?.find(d=>d.followUp)?.ruleIds).toEqual([]);
    const g=evaluateAssessment({...ordinaryGce,intake:undefined},simulatedPublication(RULE_UNIVERSES.GCE),TEST_CONTEXT);
    expect(g.result.path).toBe('unknown');expect(g.metadata.selectionIssues).toEqual([]);expect(g.metadata.selectedVersionIds).toHaveLength(12);
  });

  it('candidate references and sources must bind to the exact selected historical versions',()=>{
    const answers=AnswersSchema.parse(currentPakistanAnswers);
    const versions=simulatedPublication(RULE_UNIVERSES.Pakistan);
    const a=evaluateAssessment(buildProfile(answers),versions,TEST_CONTEXT);
    const row={answers,result:a.result,assessment_metadata:a.metadata};
    const original=JSON.stringify(row);
    expect(parseStoredAssessment(row,versions).kind).toBe('authoritative');
    const citation=a.result.citations[0];
    expect(citation).toBeDefined();
    expect(parseStoredAssessment({...row,result:{...a.result,candidateCitations:[{...citation,ruleId:publicationIdentity('gce-technical-subject-restricted').ruleId,supports:['unknowns']}]}},versions).kind).toBe('invalid');
    expect(parseStoredAssessment({...row,result:{...a.result,candidateCitations:[{...citation,sourceUrl:'https://example.invalid/wrong-source',supports:['unknowns']}]}},versions).kind).toBe('invalid');
    expect(parseStoredAssessment(row,versions.filter(v=>v.rule_id!==citation.ruleId)).kind).toBe('invalid');
    expect(JSON.stringify(row)).toBe(original);
  });

  it('bounded valid copied-policy mutation catches exact India one-year boundary',()=>{
    const rules=RULE_UNIVERSES.India.filter(r=>r.id==='india-study-successful-year').map(r=>EngineRuleSchema.parse(structuredClone(r)));
    const rule=rules.find(r=>r.id==='india-study-successful-year')!;
    rule.conditions.in_class12_successful_bachelor_years={op:'gte',value:2};
    expect(EngineRuleSchema.safeParse(rule).success).toBe(true);
    const v=simulatedPublication(rules);
    const a=evaluateAssessment(indianStudyProfile,v,TEST_CONTEXT);
    expect(a.metadata.selectionIssues.filter(i=>i.ruleId===publicationIdentity(rule.id).ruleId)).toEqual([]);
    expect(a.result.path).toBe('unknown');
    expect(()=>expect(a.result.path).toBe('subject_restricted')).toThrow();
    expect(evaluateAssessment(indianStudyProfile,simulatedPublication(RULE_UNIVERSES.India),TEST_CONTEXT).result.path).toBe('subject_restricted');
  });

  it('bounded valid copied GCE medicine count catches decisive target criterion',()=>{
    const profile=REVIEWED_CASES.find(c=>c.universe==='GCE'&&c.id==='medicine')!.profile;
    const rules=structuredClone(RULE_UNIVERSES.GCE);
    for(const r of rules.filter(r=>r.id==='gce-medicine-pharmacy-subject-restricted'||r.id==='gce-medicine-pharmacy-subject-restricted-cambridge'))r.conditions.gce_science_or_math_count={op:'gte',value:4};
    expect(rules.every(r=>EngineRuleSchema.safeParse({...r,status:'verified'}).success)).toBe(true);
    const changed=evaluateAssessment(profile,simulatedPublication(rules),TEST_CONTEXT);
    expect(changed.metadata.selectionIssues).toEqual([]);expect(changed.result.path).toBe('unknown');
    expect(evaluateAssessment(profile,simulatedPublication(RULE_UNIVERSES.GCE),TEST_CONTEXT).result.path).toBe('subject_restricted');
  });

  it('reviewed IB annex conflict is not a synthetic equal-specificity resolver conflict',()=>{
    const profile=REVIEWED_CASES.find(c=>c.universe==='IB'&&c.id==='duplicate006880')!.profile;
    const a=evaluateAssessment(profile,simulatedPublication(RULE_UNIVERSES.IB),TEST_CONTEXT);
    expect(a.result.path).toBe('unknown');
    expect(a.result.diagnostics).toContainEqual(expect.objectContaining({support:'path',status:'source_conflict',reason:'applicability_unsupported',facts:expect.arrayContaining([expect.objectContaining({key:'ib_annex_status',actual:'source_conflict',expected:'applicable'})])}));
    expect(a.result.diagnostics?.some(d=>d.followUp)).toBe(false);
  });
  it('reported contrary Pakistan assessment retains individual confirmation conflict',()=>{
    const profile=REVIEWED_CASES.find(c=>c.universe==='Pakistan'&&c.id==='PK-current-contrary-assessment')!.profile;
    const a=evaluateAssessment(profile,simulatedPublication(RULE_UNIVERSES.Pakistan),TEST_CONTEXT);
    expect(a.result.path).toBe('unknown');
    expect(a.result.diagnostics).toContainEqual(expect.objectContaining({support:'path',status:'source_conflict',reason:'applicability_unsupported',facts:expect.arrayContaining([expect.objectContaining({key:'pk_current_assessment',actual:'reported_contrary',expected:'reported_current_support'})])}));
    expect(a.result.diagnostics?.some(d=>d.followUp)).toBe(false);
  });

  it('source-only change is explanation-only and never new educational coverage',()=>{
    const versions=simulatedPublication(RULE_UNIVERSES.GCE);
    const before=evaluateAssessment(socialEconomics,versions,TEST_CONTEXT);
    const changed=structuredClone(versions);
    const target=changed.find(v=>v.rule_id===publicationIdentity('gce-social-economics-subject-restricted').ruleId)!;
    target.raw_snapshot={...(target.raw_snapshot as Record<string,never>),source_quote:'Synthetic source-only mutation (not official evidence)'};
    const after=evaluateAssessment(socialEconomics,changed,TEST_CONTEXT);
    expect(compareAssessments(before,after)).toMatchObject({policyChanged:false,explanationChanged:true,newCoverage:false});
    expect(versions.find(v=>v.id===target.id)?.raw_snapshot).not.toEqual(target.raw_snapshot);
  });
});

// Required relevant candidates and literal comparisons; this is not a nearest matcher.
describe('root-adopted contract3 decisive unknown witnesses',()=>{
 it.each(GCE_SHARED_CONTROLS)('GCE actual target control $id',c=>{
  const profile=REVIEWED_CASES.find(row=>row.universe==='GCE'&&row.id===c.id)!.profile;
  const a=evaluateAssessment(profile,simulatedPublication(RULE_UNIVERSES.GCE),TEST_CONTEXT);
  expect(pathIds(a)).toEqual([]);
  expect(ids([...a.result.candidateCitations??[],...a.result.citations.filter(x=>x.supports.includes('unknowns'))].map(x=>x.ruleId))).toEqual([...c.sourceIds].sort());
  for(const sourceId of c.sourceIds) {
   const d=a.result.diagnostics?.find(d=>d.ruleIds.includes(publicationIdentity(sourceId).ruleId));
   expect(d).toMatchObject({support:'path',status:c.status,reason:c.reason});
   expect(d!.facts).toContainEqual(c.fact);
  }
  if(c.id.endsWith('years-missing'))expect(a.result.diagnostics?.filter(d=>d.followUp).map(d=>d.followUp)).toEqual([{key:'gce_school_years',question:'How many ascending school years did you complete?'}]);
 });
 it.each(PK_PREP_CONTROLS)('Pakistan group control $id',c=>{
  const profile=REVIEWED_CASES.find(row=>row.universe==='Pakistan'&&row.id===c.id)!.profile;
  const a=evaluateAssessment(profile,simulatedPublication(RULE_UNIVERSES.Pakistan),TEST_CONTEXT);
  const d=a.result.diagnostics?.find(d=>d.ruleIds.includes(publicationIdentity(c.sourceId).ruleId));
  expect(d).toMatchObject({support:'path',status:c.status,reason:c.reason});
  expect(d!.facts).toContainEqual({key:c.key,...(c.actual===undefined?{}:{actual:c.actual}),expected:c.expected});
  expect(ids([...a.result.candidateCitations??[],...a.result.citations.filter(x=>x.supports.includes('unknowns'))].map(x=>x.ruleId))).toContain(c.sourceId);
  expect(pathIds(a)).toEqual([]);
 });
});

it('immutable synthetic APS same-scope conflict suppresses requirement documents and acquisition',()=>{
 const application=RULE_UNIVERSES.APS.find(r=>r.id==='aps-scoped-application')!;
 const conflict={...application,id:'up-test-01-synthetic-aps-application-conflict',source_quote:'Synthetic opposing APS application resolver control; not official evidence',outcomes:{aps_scopes:{application:{value:'not_required'}}}};
 const a=evaluateAssessment(APS_PROFILES[0].profile,simulatedPublication([application,conflict]),TEST_CONTEXT);
 const sourceIds=['aps-scoped-application','up-test-01-synthetic-aps-application-conflict'];
 expect(a.result).toMatchObject({path:'unknown',aps:'unknown',apsScopes:{qualification:'unknown',application:'unknown',visa:'unknown'},documents:[],stepsDetailed:[]});
 expect(ids(a.result.citations.filter(c=>c.supports.includes('aps:application')).map(c=>c.ruleId))).toEqual([...sourceIds].sort());
 const d=a.result.diagnostics?.find(d=>d.support==='aps:application');
 expect(d).toMatchObject({status:'source_conflict',reason:'equal_specificity_conflict',facts:[]});
 expect(ids(d!.ruleIds)).toEqual([...sourceIds].sort());
 expect(a.result.diagnostics?.some(d=>d.followUp)).toBe(false);
});

it.each(DIAGNOSTIC_CONTROLS)('$universe / $id literal diagnostic and relevant source',c=>{
 const row=REVIEWED_CASES.find(row=>row.universe===c.universe&&row.id===c.id)!;
 expect(row,c.id).toBeDefined();
 const a=evaluateAssessment(row.profile,simulatedPublication(RULE_UNIVERSES[c.universe]),TEST_CONTEXT);
 const d=a.result.diagnostics?.find(d=>d.ruleIds.includes(publicationIdentity(c.sourceId).ruleId));
 expect(d,c.sourceId).toMatchObject({support:'path',status:c.status,reason:c.reason});
 expect(ids(d!.ruleIds)).toEqual([c.sourceId]);
 for(const fact of c.facts)expect(d!.facts).toContainEqual(expect.objectContaining(fact));
 for(const key of c.omittedActualKeys??[]) {
  const fact=d!.facts.find(f=>f.key===key);expect(fact).toBeDefined();expect(fact).not.toHaveProperty('actual');
 }
 if(row.path==='unknown') {
  expect(pathIds(a)).toEqual([...(UNKNOWN_REVIEW_PATH_SOURCES[c.universe]?.[c.id]??[])].sort());
  for(const sourceId of pathIds(a))expect(UNKNOWN_REVIEW_PATH_IDS).toContain(sourceId);
  expect(a.result.diagnostics?.some(d=>d.support==='path'&&d.status==='known_route')).toBe(false);
  expect(ids([...a.result.candidateCitations??[],...a.result.citations.filter(c=>c.supports.includes('unknowns'))].map(c=>c.ruleId))).toContain(c.sourceId);
 }
 if(c.status==='source_conflict')expect(a.result.diagnostics?.some(d=>d.followUp)).toBe(false);
});

it.each(POSITIVE_FACTS)('$universe / $id decisive positive facts',c=>{
 const row=REVIEWED_CASES.find(row=>row.universe===c.universe&&row.id===c.id)!;
 const a=evaluateAssessment(row.profile,simulatedPublication(RULE_UNIVERSES[c.universe]),TEST_CONTEXT);
 const d=a.result.diagnostics?.find(d=>d.support==='path'&&d.status==='known_route');
 expect(d).toBeDefined();
 for(const fact of c.facts)expect(d!.facts).toContainEqual(fact);
 if(c.id==='school-only')expect(d!.facts.some(f=>f.key==='in_class12_successful_bachelor_years')).toBe(false);
});
it('retains the original316 rows and explicit reviewed route-kind references',()=>{
 expect(REVIEWED_CASES.slice(0,316)).toHaveLength(316);
 expect(new Set(REVIEWED_CASES.map(c=>c.universe+'/'+c.id)).size).toBe(REVIEWED_CASES.length);
 for(const route of ROUTE_MEMBERSHIP)for(const kind of ['positive','negative','boundary','missing','exception'] as const) {
  expect(route[kind].length,route.route+'/'+kind).toBeGreaterThan(0);
  for(const id of route[kind])expect(REVIEWED_CASES.some(c=>c.universe===route.universe&&c.id===id),route.route+'/'+kind+'/'+id).toBe(true);
 }
 expect(NEGATIVE_REPORT_MEMBERSHIP.every(c=>c.kind==='negative'&&c.evidence==='known-unmet')).toBe(true);
});

it.each([
 ['science-shortfall','gce-science-subject-restricted','gce_science_or_math_count',1,{op:'gte',value:2}],
 ['medicine-shortfall','gce-medicine-pharmacy-subject-restricted','gce_science_or_math_count',2,{op:'gte',value:3}],
 ['GCE-pharmacy-shortfall','gce-medicine-pharmacy-subject-restricted','gce_science_or_math_count',2,{op:'gte',value:3}],
 ['GCE-humanities-no-humanities','gce-humanities-subject-restricted','gce_has_humanities_al',false,true],
 ['social-no-science-math','gce-social-economics-subject-restricted','gce_has_science_or_math_al',false,true],
 ['social-no-social-economics','gce-social-economics-subject-restricted','gce_has_social_economics_al',false,true],
] as const)('GCE %s actual target criterion',(id,sourceId,key,actual,expected)=>{
 const c=REVIEWED_CASES.find(c=>c.universe==='GCE'&&c.id===id)!;
 const a=evaluateAssessment(c.profile,simulatedPublication(RULE_UNIVERSES.GCE),TEST_CONTEXT);
 expect(a.result.path).toBe('unknown');expect(pathIds(a)).toEqual([]);
 const d=a.result.diagnostics?.find(d=>d.ruleIds.includes(publicationIdentity(sourceId).ruleId));
 expect(d).toMatchObject({status:'known_unmet_condition',reason:'condition_unmet'});
 expect(d!.facts).toContainEqual({key,actual,expected});
});
it.each(['not_awarded','certificate','unknown'])('IB document hold %s has exact review source',status=>{
 const c=REVIEWED_CASES.find(c=>c.universe==='IB'&&c.id===status)!;
 const a=evaluateAssessment(c.profile,simulatedPublication(RULE_UNIVERSES.IB),TEST_CONTEXT);
 expect(a.result.path).toBe('unknown');expect(pathIds(a)).toEqual(['ib-reviewed-document-'+status]);
 expect(a.result.diagnostics?.some(d=>d.support==='path'&&d.status==='known_route')).toBe(false);
});
it.each([
 ['APS-submission-2026-03-14',['aps-transition-before']],
 ['APS-confirmation-missing',['aps-transition-unconfirmed']],
 ['APS-date-missing',['aps-transition-unconfirmed']],
 ['APS-intake-missing',[]],['APS-other-qualification',[]],['APS-grade-70',[]],['APS-grade-70.01',[]],
] as const)('transition-only unknown %s is no admission route',(id,sourceIds)=>{
 const c=REVIEWED_CASES.find(c=>c.universe==='transition'&&c.id===id)!;
 const a=evaluateAssessment(c.profile,simulatedPublication(RULE_UNIVERSES.transition),TEST_CONTEXT);
 expect(a.result.path).toBe('unknown');expect(pathIds(a)).toEqual([...sourceIds].sort());
 expect(a.result.diagnostics).toContainEqual({support:'path',status:'unsupported',reason:'no_supported_rule',ruleIds:[],facts:[]});
 expect(a.result.candidateCitations).toEqual([]);
});
