import {expect,it} from 'vitest';
import {evaluate} from '@/lib/engine/evaluate';
import {indianStudyProfile,reviewedIndiaStudyRules} from '@/lib/engine/__tests__/india-study.fixture';
import {buildVerdicts} from '../result-model';
it('labels the displayed India study verdict as reported rather than independently verified admission',()=>{const r=evaluate(indianStudyProfile,reviewedIndiaStudyRules());const verdict=buildVerdicts(r,indianStudyProfile)[0];expect(verdict.label).toMatch(/reported/);expect(verdict.label).toMatch(/not independently verified/);expect(verdict.label).toMatch(/university.*admission/i);});
