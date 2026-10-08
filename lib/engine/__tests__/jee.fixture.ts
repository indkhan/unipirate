// Source-backed ordinary acceptance, verified 2026-10-08. Applicant facts are reports.
// Publication is simulated on disposable copies of the actual DRAFT candidate only.
import type { Profile, Result } from '../evaluate';
import { ruleData } from '@/scripts/rules.bootstrap';
export const reviewedJeeRules = () => ruleData.filter(r => r.id === "in-jee-qualifying-pass-review").map(r => ({...r,status:"verified" as const}));
export const jeeProfile: Profile = {
 targetDegree:'bachelor',curriculumType:'national',certificateCountry:'in',schoolQualification:{country:'in',context:'national'},
 board:'cbse',schoolGradePercent:82,targetField:'mechanical_engineering',intake:{term:'winter',year:2026},
 jee:{main:'passed',advanced:'passed',context:'ordinary',schoolCertificate:'completed_12_year_secondary',
 targetFamily:'reported_official_technology',targetFamilyReference:'University assessment for this intended target: technology.'},
};
export const JEE_ACCEPTANCE = [
 {id:'ordinary-reported-technology',kind:'positive',profile:jeeProfile,path:'subject_restricted'},
 {id:'ordinary-reported-natural-sciences',kind:'positive',profile:{...jeeProfile,targetField:'biology',jee:{...jeeProfile.jee!,targetFamily:'reported_official_natural_sciences'}},path:'subject_restricted'},
 {id:'advanced-failed',kind:'negative',profile:{...jeeProfile,jee:{...jeeProfile.jee!,advanced:'not_passed'}},path:'unknown',reason:/Advanced.*not satisfied/i},
 {id:'main-missing',kind:'missing',profile:{...jeeProfile,jee:{...jeeProfile.jee!,main:undefined}},path:'unknown',reason:/Main.*qualifying passage/i},
 {id:'legacy-boolean',kind:'missing',profile:{...jeeProfile,jee:undefined,jeeAdvanced:true},path:'unknown',reason:/Main.*Advanced.*qualifying/i},
 {id:'certificate-missing',kind:'missing',profile:{...jeeProfile,jee:{...jeeProfile.jee!,schoolCertificate:undefined}},path:'unknown',reason:/12-year/},
 {id:'classification-missing',kind:'missing',profile:{...jeeProfile,jee:{...jeeProfile.jee!,targetFamily:undefined}},path:'unknown',reason:/target field/},
 {id:'classification-outside',kind:'negative',profile:{...jeeProfile,targetField:'law',jee:{...jeeProfile.jee!,targetFamily:'reported_official_outside'}},path:'unknown',reason:/target field/},
 ...(['main_exemption','preparatory_rank','cross_year','unclear'] as const).map(context=>({id:context,kind:'exception',profile:{...jeeProfile,jee:{...jeeProfile.jee!,context}},path:'unknown' as const,reason:/individual assessment/i})),
 ...[69.99,70,70.01,undefined].map(schoolGradePercent=>({id:'grade-'+schoolGradePercent,kind:'boundary',profile:{...jeeProfile,schoolGradePercent},path:'subject_restricted' as const})),
 ...([{term:'winter',year:2026},{term:'summer',year:2027},{term:'winter',year:2027}] as const).map(intake=>({id:'covered-'+intake.term+intake.year,kind:'boundary',profile:{...jeeProfile,intake},path:'subject_restricted' as const})),
 ...([{term:'summer',year:2026},{term:'summer',year:2028},undefined] as const).map(intake=>({id:'noncovered-'+(intake?.term??'missing')+(intake?.year??''),kind:'boundary',profile:{...jeeProfile,intake},path:'unknown' as const,reason:/intake/})),
] satisfies {id:string;kind:string;profile:Profile;path:Result['path'];reason?:RegExp}[];
