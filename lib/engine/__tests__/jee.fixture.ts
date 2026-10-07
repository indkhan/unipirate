// UP-ELIG-04: official expected facts only; certificate/intake coverage remains unverified.
import type { Profile } from '../evaluate';
export const jeeProfile: Profile = {
  targetDegree: 'bachelor', curriculumType: 'national', certificateCountry: 'in',
  schoolQualification: {country:'in',context:'national'}, board:'cbse', schoolGradePercent:82,
  targetField:'mechanical_engineering', intake:{term:'winter',year:2026},
  jee:{main:'passed',advanced:'passed',context:'ordinary'},
};
export const JEE_ACCEPTANCE = [
  {id:'both-reported-passes-applicability-unresolved',kind:'positive',profile:jeeProfile,reason:/qualification.*intake/i},
  {id:'advanced-failed',kind:'negative',profile:{...jeeProfile,jee:{main:'passed',advanced:'not_passed',context:'ordinary'}},reason:/Advanced.*not satisfied/i},
  {id:'main-missing',kind:'missing',profile:{...jeeProfile,jee:{advanced:'passed',context:'ordinary'}},reason:/Main.*qualifying passage/i},
  {id:'legacy-boolean',kind:'missing',profile:{...jeeProfile,jee:undefined,jeeAdvanced:true},reason:/Main.*Advanced.*qualifying/i},
  ...(['main_exemption','preparatory_rank','cross_year','unclear'] as const).map(context=>({id:context,kind:'exception',profile:{...jeeProfile,jee:{main:'passed' as const,advanced:'passed' as const,context}},reason:/individual assessment/i})),
  ...[69.99,70,70.01].map(schoolGradePercent=>({id:'grade-'+schoolGradePercent,kind:'boundary',profile:{...jeeProfile,schoolGradePercent},reason:/qualification.*intake/i})),
] satisfies {id:string;kind:string;profile:Profile;reason:RegExp}[];
