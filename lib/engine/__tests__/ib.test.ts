import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { p13IbInIndia } from './personas';
import { fixtureRules } from './rules.fixture';

describe('UP-ELIG-02 IB source regressions', () => {
  it('does not turn Math SL STEM restriction or missing decisive legacy evidence into Studienkolleg', () => {
    const result = evaluate(p13IbInIndia, fixtureRules);
    expect(result.path).toBe('unknown');
    expect(result.unknowns.join(' ')).toMatch(/continuity|two.year|identity/i);
  });
  it('caller recognition flags and group numbers cannot forge an IB admission path', () => {
    const profile = structuredClone(p13IbInIndia);
    profile.targetField = 'humanities';
    profile.ib!.mathLevel = 'HL';
    profile.ib!.subjects![4].level = 'HL';
    profile.ib!.subjects![2] = {group:3,level:'HL',grade:5,category:'other',recognizedForGermany:true};
    expect(evaluate(profile, fixtureRules).path).toBe('unknown');
  });
});

import { IB_ACCEPTANCE } from './ib.fixture';
describe('official IB acceptance',()=>{it.each(IB_ACCEPTANCE)('$id',c=>{const r=evaluate(c.profile,fixtureRules);expect(r.path).toBe(c.path);if(c.reason)expect(r.unknowns.join(' ')).toMatch(c.reason);});});

import { deriveFacts,EngineRuleSchema } from '../evaluate';
import { ibCase,ibRows } from './ib.fixture';
import { ibAnnex } from '../ib';
import { ibCandidates } from '../../../scripts/ib.rules';
import annexes from '../ib-annexes.json';
describe('IB decisive evidence boundaries',()=>{
 it('unknown language identity is not a second distinct recognised language',()=>{expect(evaluate(ibCase({subjects:ibRows({1:{language:'unknown'}})}),fixtureRules).path).toBe('unknown');});
 it('conflicting legacy award boolean cannot manufacture a Diploma',()=>{expect(evaluate(ibCase({fullDiploma:false}),fixtureRules).path).toBe('unknown');});
 it('an applicable annex cannot conflict with ordinary non-STEM scope',()=>{expect(evaluate(ibCase({mathLevel:'SL',school:{name:'SIS Swiss International School Stuttgart-Fellbach',country:'DEUTSCHLAND',code:'049128'},subjects:ibRows({3:{level:'HL'},4:{level:'SL'}})},'humanities'),fixtureRules).path).toBe('direct');});
 it('preserves every reviewed annex row/effective session and programme scope',()=>{expect(annexes.entries.filter(e=>e.annex===1)).toHaveLength(316);expect(annexes.entries.filter(e=>e.annex===2)).toHaveLength(35);for(const e of annexes.entries){const report=ibCase({mathLevel:'SL',examYear:e.effective.year,examSession:e.effective.session as 'may'|'november',programme:e.programmes[0] as 'ib'|'gib',school:{name:e.name,country:e.country,code:e.code??undefined},subjects:ibRows({3:{level:'HL'},4:{level:'SL'}})});expect(ibAnnex(report.ib!).status,e.name).toBe(e.code==='006880'?'source_conflict':'applicable');expect(e.sourceQuote).toContain(String(e.effective.year));}});
 it('draft candidates alone never activate admission',()=>{expect(evaluate(ibCase(),ibCandidates).path).toBe('unknown');for(const r of ibCandidates){expect(r.status).toBe('draft');expect(r.publication_metadata).toBeNull();expect(EngineRuleSchema.safeParse(r).success).toBe(true);}});
 it('derives compensation from a different subject at the same or higher level',()=>{const f=deriveFacts(ibCase({subjects:ibRows({1:{grade:3},2:{grade:4},4:{grade:4}})}));expect(f.ib_grade3_count).toBe(1);expect(f.ib_compensation_max_grade).toBe(4);});
});

it('uses the current annex source for a historical examination exception',()=>{const p=ibCase({examYear:2024,mathLevel:'SL',school:{name:'International School of Braunschweig-Wolfsburg',country:'DEUTSCHLAND',code:'007026'},subjects:ibRows({3:{level:'HL'},4:{level:'SL'}})});const result=evaluate(p,fixtureRules);expect(result.path).toBe('direct');expect(result.citations.find(c=>c.supports.includes('path'))?.sourceUrl).toBe(annexes.sourceUrl);});
