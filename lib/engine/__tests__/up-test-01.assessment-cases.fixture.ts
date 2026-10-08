// Reviewed case reuse only. References remain synthetic applicant reports.
import type { Profile, Result } from '../evaluate';
import { gceCandidates } from '@/scripts/gce.rules';
import { ibCandidates, ibDocumentCandidates } from '@/scripts/ib.rules';
import { pakistanCandidates } from '@/scripts/pakistan.rules';
import { saudiCandidates } from '@/scripts/saudi.rules';
import { dmatCandidates } from '@/scripts/dmat.rules';
import { ruleData } from '@/scripts/rules.bootstrap';
import { GCE_ACCEPTANCE, ordinaryGce, gceCase, gceSubject } from './gce.fixture';
import { IB_ACCEPTANCE } from './ib.fixture';
import { INDIA_STUDY_ACCEPTANCE, reviewedIndiaStudyRules, indianStudyProfile } from './india-study.fixture';
import { JEE_ACCEPTANCE, jeeProfile } from './jee.fixture';
import { PAKISTAN_CURRENT_ACCEPTANCE, PAKISTAN_PREP_ACCEPTANCE, currentPakistanProfile } from './pakistan.fixture';
import { SAUDI_ACCEPTANCE, completedSaudiProfile, nationalProfile, industrialProfile } from './saudi.fixture';
import { DMAT_ACCEPTANCE, dmatProfile } from './dmat.fixture';
import { officialIndianProfile } from './aps-scopes.fixture';

export const RULE_UNIVERSES = {
  GCE: gceCandidates, IB: [...ibCandidates, ...ibDocumentCandidates],
  India: reviewedIndiaStudyRules(), JEE: ruleData.filter(r => r.id === 'in-jee-qualifying-pass-review'),
  Pakistan: pakistanCandidates, Saudi: saudiCandidates,
  APS: ruleData.filter(r => r.id.startsWith('aps-scoped-')),
  transition: ruleData.filter(r => r.id.startsWith('aps-transition-')),
  dMAT: [...dmatCandidates, ...ruleData.filter(r => r.id === 'dmat-bachelor-not-required')],
};
export type Universe = keyof typeof RULE_UNIVERSES;
export type AssessmentCase = { id: string; universe: Universe; reviewedIn: string; profile: Profile; path?: Result['path']; dMAT?: Result['dMAT']; fh?: boolean; reason?: RegExp };
// Original literal expected paths are reused; no evaluate-generated expectations.
export const REVIEWED_CASES: AssessmentCase[] = [
  ...GCE_ACCEPTANCE.map(c => ({...c, path: c.path as Result['path'], universe: 'GCE' as const, reviewedIn: 'gce.fixture.ts'})),
  ...IB_ACCEPTANCE.map(c => ({...c, universe: 'IB' as const, reviewedIn: 'ib.fixture.ts'})),
  ...INDIA_STUDY_ACCEPTANCE.map(c => ({...c, universe: 'India' as const, reviewedIn: 'india-study.fixture.ts'})),
  ...JEE_ACCEPTANCE.map(c => ({...c, universe: 'JEE' as const, reviewedIn: 'jee.fixture.ts'})),
  ...PAKISTAN_PREP_ACCEPTANCE.map(c => ({...c, path: c.path as Result['path'], universe: 'Pakistan' as const, reviewedIn: 'pakistan.fixture.ts'})),
  ...PAKISTAN_CURRENT_ACCEPTANCE.map(c => ({...c, universe: 'Pakistan' as const, reviewedIn: 'pakistan.fixture.ts'})),
  ...SAUDI_ACCEPTANCE.map(c => ({...c, universe: 'Saudi' as const, reviewedIn: 'saudi.fixture.ts'})),
  ...DMAT_ACCEPTANCE.map(c => ({...c, universe: 'dMAT' as const, reviewedIn: 'dmat.fixture.ts'})),
];
// Root-adopted contract1 supplies this new literal educational expectation.
export const socialEconomics: Profile = gceCase(['economics', 'mathematics', 'history'], 'economics');
export const SOCIAL_CASES: {id: string; kind: string; evidence: string; profile: Profile; path: Result['path']}[] = [
  {id:'social-economics-economics-mathematics-history-C',kind:'positive',evidence:'supported',profile:socialEconomics,path:'subject_restricted'},
  {id:'social-mathematics-D',kind:'negative',evidence:'known-unmet',profile:{...socialEconomics,gce:{...socialEconomics.gce!,subjects:[gceSubject('economics'),gceSubject('mathematics','D'),gceSubject('history')]}},path:'unknown'},
  {id:'social-no-science-math',kind:'negative',evidence:'known-unmet',profile:gceCase(['economics','history','geography'],'economics'),path:'unknown'},
  {id:'social-no-social-economics',kind:'negative',evidence:'known-unmet',profile:{...ordinaryGce,targetField:'economics'},path:'unknown'},
  {id:'social-mathematics-AS',kind:'negative',evidence:'known-unmet',profile:{...socialEconomics,gce:{...socialEconomics.gce!,subjects:[gceSubject('economics'),gceSubject('mathematics','C','AS'),gceSubject('history')]}},path:'unknown'},
  {id:'social-school-years-missing',kind:'missing',evidence:'missing',profile:{...socialEconomics,gce:{...socialEconomics.gce!,schoolYears:undefined}},path:'unknown'},
  {id:'social-context-missing',kind:'missing',evidence:'missing',profile:{...socialEconomics,gce:{...socialEconomics.gce!,qualificationContext:undefined}},path:'unknown'},
  {id:'social-intake-missing',kind:'missing',evidence:'missing',profile:{...socialEconomics,intake:undefined},path:'unknown'},
  {id:'social-eleven-years',kind:'boundary',evidence:'known-unmet',profile:{...socialEconomics,gce:{...socialEconomics.gce!,schoolYears:11}},path:'unknown'},
  {id:'social-national-context',kind:'exception',evidence:'intentional-hold',profile:{...socialEconomics,gce:{...socialEconomics.gce!,qualificationContext:'national'}},path:'unknown'},
  ...(['school','provisional'] as const).map(evidence=>({id:'social-'+evidence,kind:'exception',evidence:'intentional-hold',profile:{...socialEconomics,gce:{...socialEconomics.gce!,evidence}},path:'unknown' as const})),
  ...(['aice','pre_u'] as const).map(qualificationType=>({id:'social-'+qualificationType,kind:'exception',evidence:'intentional-hold',profile:{...socialEconomics,gce:{...socialEconomics.gce!,qualificationType}},path:'unknown' as const})),
  ...(['D','E','U'] as const).map(grade=>({id:'social-extra-'+grade,kind:'exception',evidence:'supported',profile:{...socialEconomics,gce:{...socialEconomics.gce!,subjects:[...socialEconomics.gce!.subjects,{...gceSubject('biology'),grade}]}},path:'subject_restricted' as const})),
];
REVIEWED_CASES.push(...SOCIAL_CASES.map(c=>({...c,universe:'GCE' as const,reviewedIn:'test-results/up-test-01/contracts/up-test-01-gce-social-expected-contract1.md'})));
REVIEWED_CASES.push(
  {id:'humanities-CAIE-marine',universe:'GCE',reviewedIn:'gce.test.ts: issuer-specific Marine Science',profile:gceCase(['history','geography','marine_science'],'humanities'),path:'subject_restricted'},
  {id:'humanities-Pearson-marine',universe:'GCE',reviewedIn:'gce.test.ts: issuer-specific Marine Science',profile:{...gceCase(['history','geography','marine_science'],'humanities'),gce:{...gceCase(['history','geography','marine_science'],'humanities').gce!,awardingBody:'pearson'}},path:'unknown'},
  {id:'JEE-reference-missing',universe:'JEE',reviewedIn:'jee-ordinary.test.ts',profile:{...jeeProfile,jee:{...jeeProfile.jee!,targetFamilyReference:undefined}},path:'unknown'},
);
// Promote the dedicated Pakistan controls, never guess aliases or recognition.
const pkStudy = (change: Partial<NonNullable<NonNullable<Profile['qualificationHistory']>['pakistanStudy']>>): Profile => ({...currentPakistanProfile,qualificationHistory:{...currentPakistanProfile.qualificationHistory!,pakistanStudy:{...currentPakistanProfile.qualificationHistory!.pakistanStudy!,...change}}});
for (const [id, change] of [
  ['part-time',{mode:'part_time'}],['distance',{mode:'distance_online'}],['regulations-missing',{regulations:'unknown'}],['records-missing',{annualRecords:'unknown'}],
  ['success-reference-missing',{successfulYearsReference:undefined}],['success-reference-blank',{successfulYearsReference:' '}],
  ['recognition-rejected',{recognition:'reported_official_rejected'}],['recognition-reference-missing',{recognitionReference:undefined}],
  ['unrelated',{relation:'reported_official_unrelated'}],['relation-reference-missing',{relationReference:undefined}],
  ['contrary-assessment',{assessment:'reported_contrary'}],['assessment-missing',{assessment:'unknown'}],['assessment-reference-missing',{assessmentReference:undefined}],['old-evidence',{evidenceVersion:undefined}],
] as const) REVIEWED_CASES.push({id:'PK-current-'+id,universe:'Pakistan',reviewedIn:'pakistan-current.test.ts',profile:pkStudy(change),path:'unknown'});
for (const [completedYears,path] of [[0,'unknown'],[0.5,'unknown'],[1,'subject_restricted'],[2,'subject_restricted']] as const)
  REVIEWED_CASES.push({id:'PK-current-years-'+completedYears,universe:'Pakistan',reviewedIn:'pakistan-current.test.ts',profile:{...currentPakistanProfile,qualificationHistory:{...currentPakistanProfile.qualificationHistory!,completedYears}},path});
for (const [id,change] of [['completed',{completion:'completed'}],['discontinued',{completion:'discontinued'}],['foreign',{country:'in'}],['country-missing',{country:undefined}],['years-missing',{completedYears:undefined}],['master',{qualificationType:'master'}],['institution-missing',{institution:undefined}],['field-missing',{field:undefined}]] as const)
  REVIEWED_CASES.push({id:'PK-history-'+id,universe:'Pakistan',reviewedIn:'pakistan-current.test.ts',profile:{...currentPakistanProfile,qualificationHistory:{...currentPakistanProfile.qualificationHistory!,...change}},path:'unknown'});
for (const [id,intake] of [['missing',undefined],['historical',{term:'summer',year:2026}],['outside',{term:'summer',year:2028}]] as const)
  REVIEWED_CASES.push({id:'PK-intake-'+id,universe:'Pakistan',reviewedIn:'pakistan-current.test.ts',profile:{...currentPakistanProfile,intake},path:'unknown'});
for (const [id,change] of [['alias-fsc',{certificate:'fsc'}],['alias-fa',{certificate:'fa'}],['alias-icom',{certificate:'icom'}],['alias-ics',{certificate:'ics'}],['alias-ssc',{certificate:'ssc'}],['group-mixed',{group:'mixed'}],['incomplete',{completion:'incomplete'}]] as const)
  REVIEWED_CASES.push({id:'PK-school-'+id,universe:'Pakistan',reviewedIn:'pakistan-current.test.ts',profile:{...currentPakistanProfile,pakistan:{...currentPakistanProfile.pakistan!,...change}},path:'unknown'});
// Each documentary group reuses the dedicated literal percentage/history controls.
for (const group of ['science','commerce','humanities'] as const) {
  for (const [label,schoolGradePercent] of [['below',49.99],['missing',undefined]] as const)
    REVIEWED_CASES.push({id:'PK-'+group+'-grade-'+label,universe:'Pakistan',reviewedIn:'pakistan-current.test.ts + diagnostics.test.ts',profile:{...currentPakistanProfile,pakistan:{...currentPakistanProfile.pakistan!,group},schoolGradePercent},path:'unknown'});
}
// National category/completion and independent degree controls from dedicated suite.
for (const stream of ['Literary Section','Science Section','Commercial Section']) {
  for (const [id,change] of [['category-missing',{nationalCategory:undefined}],['completion-missing',{secondaryCompletion:undefined}]] as const) {
    const p=nationalProfile(stream);
    REVIEWED_CASES.push({id:'SA-'+stream+'-'+id,universe:'Saudi',reviewedIn:'saudi-current.test.ts',profile:{...p,saudiCertificate:{...p.saudiCertificate!,...change}},path:'unknown'});
  }
}
for (const [id,change] of [['mode',{priorStudyMode:'distance_online'}],['recognition-reference',{priorStudyRecognitionReference:' '}],['norms-reference',{saudiBachelorEvidence:{...completedSaudiProfile.qualificationHistory!.saudiBachelorEvidence!,reference:' '}}]] as const)
  REVIEWED_CASES.push({id:'SA-degree-'+id,universe:'Saudi',reviewedIn:'saudi-current.test.ts',profile:{...completedSaudiProfile,qualificationHistory:{...completedSaudiProfile.qualificationHistory!,...change}},path:'unknown'});
// APS transition-only universe: supported timing is not an admission positive.
const transition: Profile={targetDegree:'bachelor',curriculumType:'national',board:'cbse',schoolQualification:{country:'in',context:'national'},schoolGradePercent:65,jeeAdvanced:false,intake:{term:'winter',year:2026},hasExistingApsCertificate:false};
for (const [date,path] of [['2026-03-14','unknown'],['2026-03-15','insufficient'],['2026-03-16','insufficient']] as const)
  REVIEWED_CASES.push({id:'APS-submission-'+date,universe:'transition',reviewedIn:'aps-transition.test.ts',profile:{...transition,apsProcedure:{status:'pending',submissionConfirmation:'confirmed',submissionDate:date}},path});
for (const [schoolGradePercent,path] of [[69.99,'insufficient'],[70,'unknown'],[70.01,'unknown']] as const)
  REVIEWED_CASES.push({id:'APS-grade-'+schoolGradePercent,universe:'transition',reviewedIn:'aps-transition.test.ts',profile:{...transition,schoolGradePercent,hasExistingApsCertificate:true,apsProcedure:{status:'pending',submissionConfirmation:'confirmed',submissionDate:'2026-03-16'}},path});
REVIEWED_CASES.push({id:'APS-confirmation-missing',universe:'transition',reviewedIn:'aps-transition.test.ts',profile:transition,path:'unknown'});
// Full process flags remain separately asserted below; no admission fact inferred.
export const APS_PROFILES = [
  {id:'Indian-qualification-Saudi-visa',profile:officialIndianProfile,scopes:{qualification:'required',application:'required',visa:'not_listed'},certificate:'missing'},
  {id:'held',profile:{...officialIndianProfile,hasExistingApsCertificate:true},scopes:{qualification:'required',application:'required',visa:'not_listed'},certificate:'held'},
  {id:'certificate-unknown',profile:{...officialIndianProfile,hasExistingApsCertificate:undefined},scopes:{qualification:'required',application:'required',visa:'not_listed'},certificate:'unknown'},
  {id:'mission-missing',profile:{...officialIndianProfile,visaMissionContext:undefined},scopes:{qualification:'required',application:'required',visa:'unknown'},certificate:'missing'},
  {id:'issuer-missing',profile:{...officialIndianProfile,schoolQualification:undefined},scopes:{qualification:'unknown',application:'unknown',visa:'not_listed'},certificate:'missing'},
  {id:'international',profile:{...officialIndianProfile,schoolQualification:{country:'in',context:'international' as const}},scopes:{qualification:'unknown',application:'unknown',visa:'not_listed'},certificate:'missing'},
] as const;
// dMAT dedicated dates, semesters and exemptions; exact published literals.
for (const event of ['registration','dispatch'] as const) for (const [date,dMAT] of [['2026-06-28','not_required'],['2026-06-29','required'],['2026-06-30','required']] as const)
  REVIEWED_CASES.push({id:'dMAT-'+event+'-'+date,universe:'dMAT',reviewedIn:'dmat.test.ts',profile:{...dmatProfile,dmat:{...dmatProfile.dmat!,[event]:{status:event==='registration'?'completed':'complete',date}}},dMAT});
for (const [degreeYears,completedSemesters,dMAT] of [[3,4,'not_required'],[3,5,'required'],[4,6,'not_required'],[4,7,'required']] as const) {
  const profile:Profile={...dmatProfile,qualificationHistory:{...dmatProfile.qualificationHistory!,completion:'in_progress',degreeYears,completedYears:0},dmat:{...dmatProfile.dmat!,completedSemesters}};
  REVIEWED_CASES.push({id:'dMAT-semesters-'+degreeYears+'-'+completedSemesters,universe:'dMAT',reviewedIn:'dmat.test.ts',profile,dMAT});
  REVIEWED_CASES.push({id:'dMAT-semesters-missing-'+degreeYears+'-'+completedSemesters,universe:'dMAT',reviewedIn:'dmat.test.ts',profile:{...profile,dmat:{...profile.dmat!,completedSemesters:undefined}},dMAT:'unknown'});
}
REVIEWED_CASES.push(
  {id:'dMAT-unaffected',universe:'dMAT',reviewedIn:'dmat.test.ts',profile:{...dmatProfile,dmat:{...dmatProfile.dmat!,field:{basis:'aps_confirmation',classification:'unaffected',reference:'APS response for this official degree and branch'}}},dMAT:'not_required'},
  {id:'dMAT-unaffected-blank',universe:'dMAT',reviewedIn:'dmat.test.ts',profile:{...dmatProfile,dmat:{...dmatProfile.dmat!,field:{basis:'aps_confirmation',classification:'unaffected',reference:' '}}},dMAT:'unknown'},
  {id:'dMAT-partnership',universe:'dMAT',reviewedIn:'dmat.test.ts',profile:{...dmatProfile,dmat:{...dmatProfile.dmat!,partnership:{status:'confirmed',kind:'exchange',issuerRole:'home_institution',issuer:'Example University',groupNumber:'A123',reference:'Official exchange confirmation'}}},dMAT:'not_required'},
  {id:'dMAT-partnership-pending',universe:'dMAT',reviewedIn:'dmat.test.ts',profile:{...dmatProfile,dmat:{...dmatProfile.dmat!,partnership:{status:'pending'}}},dMAT:'unknown'},
  {id:'dMAT-new-procedure-old-certificate',universe:'dMAT',reviewedIn:'dmat.test.ts',profile:{...dmatProfile,hasExistingApsCertificate:true,dmat:{...dmatProfile.dmat!,procedure:'current_new'}},dMAT:'required'},
  {id:'dMAT-intake-before',universe:'dMAT',reviewedIn:'dmat.test.ts',profile:{...dmatProfile,intake:{term:'winter',year:2026}},dMAT:'not_required'},
  {id:'dMAT-intake-missing',universe:'dMAT',reviewedIn:'dmat.test.ts',profile:{...dmatProfile,intake:undefined},dMAT:'unknown'},
);

// Literal reviewed admission-source membership. Unknown review notes are separate.
export const WINNING_PATH_SOURCES: Partial<Record<Universe, Record<string, string[]>>> = {
  "GCE": {
    "ordinary-trio": [
      "gce-technical-subject-restricted",
      "gce-technical-subject-restricted-cambridge"
    ],
    "extra-D": [
      "gce-technical-subject-restricted",
      "gce-technical-subject-restricted-cambridge"
    ],
    "science": [
      "gce-science-subject-restricted",
      "gce-science-subject-restricted-cambridge"
    ],
    "medicine": [
      "gce-medicine-pharmacy-subject-restricted",
      "gce-medicine-pharmacy-subject-restricted-cambridge"
    ],
    "pharmacy": [
      "gce-medicine-pharmacy-subject-restricted",
      "gce-medicine-pharmacy-subject-restricted-cambridge"
    ],
    "arts": [
      "gce-arts-subject-restricted",
      "gce-arts-subject-restricted-cambridge"
    ],
    "List-B": [
      "gce-technical-subject-restricted",
      "gce-technical-subject-restricted-cambridge"
    ],
    "Pakistan-location": [
      "gce-technical-subject-restricted",
      "gce-technical-subject-restricted-cambridge"
    ],
    "Cambridge-2022": [
      "gce-technical-subject-restricted-cambridge"
    ],
    "unused-List-C": [
      "gce-technical-subject-restricted",
      "gce-technical-subject-restricted-cambridge"
    ],
    "humanities-CAIE-marine": [
      "gce-humanities-subject-restricted",
      "gce-humanities-subject-restricted-cambridge"
    ],
    "social-economics-economics-mathematics-history-C": [
      "gce-social-economics-subject-restricted",
      "gce-social-economics-subject-restricted-cambridge"
    ],
    "social-extra-D": [
      "gce-social-economics-subject-restricted",
      "gce-social-economics-subject-restricted-cambridge"
    ],
    "social-extra-E": [
      "gce-social-economics-subject-restricted",
      "gce-social-economics-subject-restricted-cambridge"
    ],
    "social-extra-U": [
      "gce-social-economics-subject-restricted",
      "gce-social-economics-subject-restricted-cambridge"
    ]
  },
  "IB": {
    "AA-HL-2025": [
      "ib-reviewed-2025-math-hl-ordinary-grades"
    ],
    "AI-HL-2026": [
      "ib-reviewed-2025-math-hl-ordinary-grades"
    ],
    "continued-foreign-A-SL": [
      "ib-reviewed-2025-math-hl-ordinary-grades"
    ],
    "one-SL3-SL5-total24": [
      "ib-reviewed-2025-math-hl-compensated-grade3"
    ],
    "one-SL3-HL5-total24": [
      "ib-reviewed-2025-math-hl-compensated-grade3"
    ],
    "HL-language-2025": [
      "ib-reviewed-2025-math-sl-annex-ordinary-grades"
    ],
    "legacy-MathSL-scienceHL": [
      "ib-reviewed-through2020-legacy-mathematics-ordinary-grades"
    ],
    "2021-SL-humanities": [
      "ib-reviewed-2021-2024-math-sl-subject-scope-ordinary-grades"
    ],
    "2024-HL-general": [
      "ib-reviewed-2021-2024-math-hl-ordinary-grades"
    ],
    "2024-SL-scienceHL": [
      "ib-reviewed-2021-2024-math-sl-subject-scope-ordinary-grades"
    ],
    "exception-May2026": [
      "ib-reviewed-2025-math-sl-annex-ordinary-grades"
    ],
    "Djidda-GIB-May2021": [
      "ib-reviewed-2021-2024-math-sl-annex-ordinary-grades"
    ],
    "official-IBO-paper-pending": [
      "ib-reviewed-2025-math-hl-ordinary-grades"
    ],
    "COVID-2020-may": [
      "ib-reviewed-through2020-legacy-mathematics-ordinary-grades"
    ],
    "COVID-2020-november": [
      "ib-reviewed-through2020-legacy-mathematics-ordinary-grades"
    ],
    "COVID-2021-may": [
      "ib-reviewed-2021-2024-math-hl-ordinary-grades"
    ]
  },
  "India": {
    "FUTURE-India-one-year-route": [
      "india-study-successful-year"
    ],
    "board-cbse": [
      "india-study-successful-year"
    ],
    "board-cisce": [
      "india-study-successful-year"
    ],
    "board-state_board": [
      "india-study-successful-year"
    ],
    "years-1": [
      "india-study-successful-year"
    ],
    "years-1.01": [
      "india-study-successful-year"
    ],
    "years-2": [
      "india-study-successful-year"
    ],
    "grade-70": [
      "india-study-successful-year"
    ],
    "grade-70.01": [
      "india-study-successful-year"
    ],
    "status-completed": [
      "india-study-successful-year"
    ],
    "status-in_progress": [
      "india-study-successful-year"
    ],
    "status-discontinued": [
      "india-study-successful-year"
    ],
    "closely-related": [
      "india-study-successful-year"
    ],
    "summer-2027": [
      "india-study-successful-year"
    ],
    "passport-visa-independent": [
      "india-study-successful-year"
    ],
    "school-only": [
      "india-study-school-only"
    ],
    "summer-2026": [
      "f787cf74-25be-48db-b20f-2382d4baeb83"
    ]
  },
  "JEE": {
    "ordinary-reported-technology": [
      "in-jee-qualifying-pass-review"
    ],
    "ordinary-reported-natural-sciences": [
      "in-jee-qualifying-pass-review"
    ],
    "grade-69.99": [
      "in-jee-qualifying-pass-review"
    ],
    "grade-70": [
      "in-jee-qualifying-pass-review"
    ],
    "grade-70.01": [
      "in-jee-qualifying-pass-review"
    ],
    "grade-undefined": [
      "in-jee-qualifying-pass-review"
    ],
    "covered-winter2026": [
      "in-jee-qualifying-pass-review"
    ],
    "covered-summer2027": [
      "in-jee-qualifying-pass-review"
    ],
    "covered-winter2027": [
      "in-jee-qualifying-pass-review"
    ]
  },
  "Pakistan": {
    "PK-prep-science": [
      "pakistan-prep-science"
    ],
    "PK-prep-commerce": [
      "pakistan-prep-commerce"
    ],
    "PK-prep-humanities": [
      "pakistan-prep-humanities"
    ],
    "PK-current-science-winter-2026": [
      "pakistan-current-year-science"
    ],
    "PK-current-science-summer-2027": [
      "pakistan-current-year-science"
    ],
    "PK-current-science-winter-2027": [
      "pakistan-current-year-science"
    ],
    "PK-current-commerce-winter-2026": [
      "pakistan-current-year-commerce"
    ],
    "PK-current-commerce-summer-2027": [
      "pakistan-current-year-commerce"
    ],
    "PK-current-commerce-winter-2027": [
      "pakistan-current-year-commerce"
    ],
    "PK-current-humanities-winter-2026": [
      "pakistan-current-year-humanities"
    ],
    "PK-current-humanities-summer-2027": [
      "pakistan-current-year-humanities"
    ],
    "PK-current-humanities-winter-2027": [
      "pakistan-current-year-humanities"
    ],
    "PK-current-years-1": [
      "pakistan-current-year-science"
    ],
    "PK-current-years-2": [
      "pakistan-current-year-science"
    ]
  },
  "Saudi": {
    "Literary Section-prep": [
      "sa-reviewed-national-literary-prep"
    ],
    "Literary Section-year": [
      "sa-reviewed-national-literary-year"
    ],
    "completed-with-Literary Section": [
      "sa-reviewed-completed-bachelor"
    ],
    "Science Section-prep": [
      "sa-reviewed-national-science-prep"
    ],
    "Science Section-year": [
      "sa-reviewed-national-science-year"
    ],
    "completed-with-Science Section": [
      "sa-reviewed-completed-bachelor"
    ],
    "Commercial Section-prep": [
      "sa-reviewed-national-commercial-prep"
    ],
    "Commercial Section-year": [
      "sa-reviewed-national-commercial-year"
    ],
    "completed-with-Commercial Section": [
      "sa-reviewed-completed-bachelor"
    ],
    "completed-four-year-general": [
      "sa-reviewed-completed-bachelor"
    ],
    "completed-with-private": [
      "sa-reviewed-completed-bachelor"
    ],
    "completed-with-industrial": [
      "sa-reviewed-completed-bachelor"
    ],
    "private-one": [
      "sa-reviewed-private-one"
    ],
    "status-completed": [
      "sa-reviewed-private-one"
    ],
    "status-in_progress": [
      "sa-reviewed-private-one"
    ],
    "status-discontinued": [
      "sa-reviewed-private-one"
    ],
    "passport-visa": [
      "sa-reviewed-private-one"
    ],
    "foreign-accredited-study": [
      "sa-reviewed-private-one"
    ],
    "private-two": [
      "sa-reviewed-private-two"
    ],
    "industrial-enrollment": [
      "sa-reviewed-industrial-enrollment"
    ],
    "industrial-diploma-enrollment": [
      "sa-reviewed-industrial-enrollment"
    ],
    "industrial-next": [
      "sa-reviewed-industrial-enrollment"
    ],
    "industrial-successful-one": [
      "sa-reviewed-industrial-year"
    ],
    "industrial-no-enrollment-year-two": [
      "sa-reviewed-industrial-year"
    ]
  },
  "transition": {
    "APS-submission-2026-03-15": [
      "aps-transition-current"
    ],
    "APS-submission-2026-03-16": [
      "aps-transition-current"
    ],
    "APS-grade-69.99": [
      "aps-transition-current"
    ]
  }
};

// Root-adopted expected contract3; reported possession is independent of requirement.
export const ROUTE_CERTIFICATE_UNKNOWN = {aps:'unknown',apsScopes:{qualification:'unknown',application:'unknown',visa:'unknown'},apsCertificate:'unknown',testAS:'unknown',dMAT:'unknown'} as const;
export const ROUTE_CERTIFICATE_MISSING = {...ROUTE_CERTIFICATE_UNKNOWN,apsCertificate:'missing'} as const;
export const ROUTE_CERTIFICATE_HELD = {...ROUTE_CERTIFICATE_UNKNOWN,apsCertificate:'held'} as const;
export const INDIA_FLAGS = {...ROUTE_CERTIFICATE_MISSING,aps:'required',apsScopes:{qualification:'required',application:'unknown',visa:'unknown'}} as const;
export const APS_INVENTORY = ['aps-scoped-qualification','aps-scoped-application','aps-scoped-visa-sa','aps-scoped-acquisition'];
export const ORIGINAL_REVIEWED_CASE_COUNT = 316;

// Bounded witnesses approved in expected-contract3; never a criteria-derived oracle.
const contract3 = 'test-results/up-test-01/contracts/up-test-01-final-expected-contract3.md';
export const GCE_ROUTE_POSITIVES = [
  ['technical','ordinary-trio'],['science','science'],['medicine-pharmacy','medicine'],
  ['medicine-pharmacy','pharmacy'],['arts','arts'],['humanities','humanities-CAIE-marine'],
  ['social-economics','social-economics-economics-mathematics-history-C'],
] as const;
export const GCE_SHARED_CONTROLS: {id:string;sourceIds:string[];fact: {key:string;actual?:number|string;expected:object};status:string;reason:string}[] = [];
for (const [route,id] of GCE_ROUTE_POSITIVES) {
  const p=REVIEWED_CASES.find(c=>c.universe==='GCE'&&c.id===id)!.profile;
  const sourceIds=['gce-'+route+'-subject-restricted','gce-'+route+'-subject-restricted-cambridge'];
  for(const [label,change,fact,status,reason] of [
    ['years11',{schoolYears:11},{key:'gce_school_years',actual:11,expected:{op:'gte',value:12}},'known_unmet_condition','condition_unmet'],
    ['years-missing',{schoolYears:undefined},{key:'gce_school_years',expected:{op:'gte',value:12}},'targeted_missing_fact','fact_missing'],
    ['national',{qualificationContext:'national' as const},{key:'gce_qualification_context',actual:'national',expected:{op:'in',value:['uk','british_international']}},'unsupported','applicability_unsupported'],
    ['gradeD',{subjects:p.gce!.subjects.map((subject,i)=>i===p.gce!.subjects.length-1?{...subject,grade:'D' as const}:subject)},{key:'gce_min_al_grade',actual:2,expected:{op:'gte',value:3}},'known_unmet_condition','condition_unmet'],
  ] as const) {
    const caseId='GCE-'+id+'-'+label;
    REVIEWED_CASES.push({id:caseId,universe:'GCE',reviewedIn:contract3,profile:{...p,gce:{...p.gce!,...change}},path:'unknown'});
    GCE_SHARED_CONTROLS.push({id:caseId,sourceIds,fact,status,reason});
  }
}
REVIEWED_CASES.push(
 {id:'GCE-pharmacy-shortfall',universe:'GCE',reviewedIn:contract3,profile:{...REVIEWED_CASES.find(c=>c.universe==='GCE'&&c.id==='medicine-shortfall')!.profile,targetField:'pharmacy'},path:'unknown'},
 {id:'GCE-humanities-no-humanities',universe:'GCE',reviewedIn:contract3,profile:{...ordinaryGce,targetField:'humanities'},path:'unknown'},
 {id:'GCE-Pearson-current',universe:'GCE',reviewedIn:'gce.test.ts + '+contract3,profile:{...ordinaryGce,gce:{...ordinaryGce.gce!,awardingBody:'pearson'}},path:'subject_restricted'},
 {id:'India-school-only-low',universe:'India',reviewedIn:contract3,profile:{...indianStudyProfile,schoolGradePercent:69.99,apsProcedure:{status:'pending',submissionConfirmation:'confirmed',submissionDate:'2026-03-16'},qualificationHistory:{hasPriorUniversityStudy:false}},path:'insufficient'},
 {id:'India-school-only-missing',universe:'India',reviewedIn:contract3,profile:{...indianStudyProfile,schoolGradePercent:undefined,qualificationHistory:{hasPriorUniversityStudy:false}},path:'unknown'},
 {id:'IB-SL-school-years11',universe:'IB',reviewedIn:contract3,profile:{...IB_ACCEPTANCE.find(c=>c.id==='2024-SL-scienceHL')!.profile,ib:{...IB_ACCEPTANCE.find(c=>c.id==='2024-SL-scienceHL')!.profile.ib!,schoolYears:11}},path:'unknown'},
);
WINNING_PATH_SOURCES.GCE!['GCE-Pearson-current']=['gce-technical-subject-restricted'];
WINNING_PATH_SOURCES.India!['India-school-only-low']=['aps-transition-current'];
export const PK_PREP_CONTROLS: {id:string;sourceId:string;key:string;actual?:number|string;expected:object;status:string;reason:string}[]=[];
for(const [group,outside,allowed] of [
 ['science','economics',['medicine','natural_sciences','technology']],
 ['commerce','technology',['social_sciences','economics']],
 ['humanities','technology',['humanities']],
] as const) {
 const p=PAKISTAN_PREP_ACCEPTANCE.find(c=>c.id==='PK-prep-'+group)!.profile;
 for(const [label,patch,key,actual,expected,status,reason] of [
  ['below',{schoolGradePercent:49.99},'pk_grade_percent',49.99,{op:'gte',value:50},'known_unmet_condition','condition_unmet'],
  ['missing',{schoolGradePercent:undefined},'pk_grade_percent',undefined,{op:'gte',value:50},'targeted_missing_fact','fact_missing'],
  ['outside',{pakistan:{...p.pakistan!,targetFamily:outside}},'pk_target_family',outside,{op:'in',value:[...allowed]},'known_unmet_condition','condition_unmet'],
 ] as const) {
  const id='PK-prep-'+group+'-'+label;
  REVIEWED_CASES.push({id,universe:'Pakistan',reviewedIn:contract3,profile:{...p,...patch},path:'unknown'});
  PK_PREP_CONTROLS.push({id,sourceId:'pakistan-prep-'+group,key,actual,expected,status,reason});
 }
}
const nationalYear=nationalProfile('Commercial Section',1);
const industrialYear:Profile={...industrialProfile,saudiCertificate:{version:1,subtype:'industrial_diploma'},qualificationHistory:{...industrialProfile.qualificationHistory!,completedYears:1}};
const sciencePrep=nationalProfile('Scientific Track');
REVIEWED_CASES.push(
 {id:'SA-scientific-no-family',universe:'Saudi',reviewedIn:contract3,profile:{...sciencePrep,saudiCertificate:{...sciencePrep.saudiCertificate!,targetFamily:undefined,targetFamilyReference:undefined}},path:'studienkolleg'},
 {id:'SA-commercial-year-outside-prep',universe:'Saudi',reviewedIn:contract3,profile:{...nationalYear,saudiCertificate:{...nationalYear.saudiCertificate!,targetFamily:'reported_official_outside'},qualificationHistory:{...nationalYear.qualificationHistory!,priorStudyTargetRelation:'reported_official_closely_related'}},path:'subject_restricted'},
 {id:'SA-industrial-year-no-enrollment',universe:'Saudi',reviewedIn:contract3,profile:industrialYear,path:'subject_restricted',fh:true},
 {id:'SA-industrial-zero-no-enrollment',universe:'Saudi',reviewedIn:contract3,profile:{...industrialYear,qualificationHistory:{...industrialYear.qualificationHistory!,completedYears:0}},path:'unknown'},
 {id:'SA-industrial-year-intake-missing',universe:'Saudi',reviewedIn:contract3,profile:{...industrialYear,intake:undefined},path:'unknown'},
 {id:'SA-industrial-year-before',universe:'Saudi',reviewedIn:contract3,profile:{...industrialYear,intake:{term:'summer',year:2026}},path:'unknown'},
);
for(const [label,change] of [
 ['recognition-missing',{priorStudyRecognition:'unknown'}],['recognition-rejected',{priorStudyRecognition:'reported_official_rejected'}],
 ['relation-missing',{priorStudyTargetRelationReference:undefined}],['years-missing',{completedYears:undefined}],
] as const) REVIEWED_CASES.push({id:'SA-national-year-'+label,universe:'Saudi',reviewedIn:contract3,profile:{...nationalYear,qualificationHistory:{...nationalYear.qualificationHistory!,...change}},path:'studienkolleg'});
for(const [label,change] of [['reference-missing',{priorStudyRecognitionReference:undefined}],['unrelated',{priorStudyTargetRelation:'reported_official_unrelated'}]] as const)
 REVIEWED_CASES.push({id:'SA-industrial-year-'+label,universe:'Saudi',reviewedIn:contract3,profile:{...industrialYear,qualificationHistory:{...industrialYear.qualificationHistory!,...change}},path:'unknown'});
for(const stream of ['Literary Section','Commercial Section']) {
 const p=nationalProfile(stream);
 REVIEWED_CASES.push({id:'SA-'+stream+'-family-missing',universe:'Saudi',reviewedIn:contract3,profile:{...p,saudiCertificate:{...p.saudiCertificate!,targetFamilyReference:undefined}},path:'unknown'});
}
for(const [label,change] of [
 ['recognition-rejected',{priorStudyRecognition:'reported_official_rejected'}],
 ['norms-unmet',{saudiBachelorEvidence:{...completedSaudiProfile.qualificationHistory!.saudiBachelorEvidence!,assessment:'reported_official_unmet'}}],
] as const) REVIEWED_CASES.push({id:'SA-degree-'+label,universe:'Saudi',reviewedIn:contract3,profile:{...completedSaudiProfile,qualificationHistory:{...completedSaudiProfile.qualificationHistory!,...change}},path:'unknown'});
Object.assign(WINNING_PATH_SOURCES.Saudi!,{
 'SA-scientific-no-family':['sa-reviewed-national-science-prep'],
 'SA-commercial-year-outside-prep':['sa-reviewed-national-commercial-year'],
 'SA-industrial-year-no-enrollment':['sa-reviewed-industrial-year'],
 'SA-national-year-recognition-missing':['sa-reviewed-national-commercial-prep'],
 'SA-national-year-recognition-rejected':['sa-reviewed-national-commercial-prep'],
 'SA-national-year-relation-missing':['sa-reviewed-national-commercial-prep'],
 'SA-national-year-years-missing':['sa-reviewed-national-commercial-prep'],
});
for(const [id,patch] of [
 ['date-missing',{apsProcedure:{status:'pending',submissionConfirmation:'confirmed'}}],
 ['intake-missing',{intake:undefined}],['other-qualification',{targetDegree:'master'}],
] as const) REVIEWED_CASES.push({id:'APS-'+id,universe:'transition',reviewedIn:contract3,profile:{...transition,...patch},path:'unknown'});

// Exact dMAT identities from the adopted table, including review-only support.
export const DMAT_SUPPORT: Record<string,string[]> = {
 'DMAT-positive-affected':['dmat-reviewed-required-0-0-0-0'],
 'DMAT-negative-bachelor':['dmat-bachelor-not-required'],
 'DMAT-boundary-registration-28':['dmat-reviewed-registration-before'],
 'DMAT-boundary-registration-29':['dmat-reviewed-required-1-0-0-0'],
 'DMAT-missing-field':['dmat-reviewed-review'],
 'DMAT-exception-relevant-completed':['dmat-reviewed-completed'],
 'dMAT-registration-2026-06-28':['dmat-reviewed-registration-before'],
 'dMAT-registration-2026-06-29':['dmat-reviewed-required-1-0-0-0'],
 'dMAT-registration-2026-06-30':['dmat-reviewed-required-1-0-0-0'],
 'dMAT-dispatch-2026-06-28':['dmat-reviewed-dispatch-before'],
 'dMAT-dispatch-2026-06-29':['dmat-reviewed-required-0-1-0-0'],
 'dMAT-dispatch-2026-06-30':['dmat-reviewed-required-0-1-0-0'],
 'dMAT-semesters-3-4':['dmat-reviewed-enrolled-3'],
 'dMAT-semesters-3-5':['dmat-reviewed-required-0-0-1-0'],
 'dMAT-semesters-4-6':['dmat-reviewed-enrolled-4'],
 'dMAT-semesters-4-7':['dmat-reviewed-required-0-0-2-0'],
 'dMAT-semesters-missing-3-4':['dmat-reviewed-review'],
 'dMAT-semesters-missing-3-5':['dmat-reviewed-review'],
 'dMAT-semesters-missing-4-6':['dmat-reviewed-review'],
 'dMAT-semesters-missing-4-7':['dmat-reviewed-review'],
 'dMAT-unaffected':['dmat-reviewed-unaffected'],
 'dMAT-unaffected-blank':['dmat-reviewed-review'],
 'dMAT-partnership':['dmat-reviewed-partnership'],
 'dMAT-partnership-pending':['dmat-reviewed-review'],
 'dMAT-new-procedure-old-certificate':['dmat-reviewed-required-0-0-0-0'],
 'dMAT-intake-before':['dmat-reviewed-before-intake'],
 'dMAT-intake-missing':['dmat-reviewed-review'],
 'dMAT-completed-missing-certificate':['dmat-reviewed-review'],
 'dMAT-completed-unknown-certificate':['dmat-reviewed-review'],
 'dMAT-multiple':['dmat-reviewed-multiple-review'],
 'dMAT-qualification-unknown':['dmat-reviewed-multiple-review'],
 'dMAT-master-issuer-missing':[], 'dMAT-master-foreign':[], 'dMAT-master-context-unknown':[],
 'dMAT-unknown-procedure':['dmat-reviewed-review'],
 'dMAT-unknown-procedure-partnership':['dmat-reviewed-partnership'],
 'dMAT-partnership-group-blank':['dmat-reviewed-review'],
 'dMAT-registration-date-missing':['dmat-reviewed-review'],
 'dMAT-dispatch-date-missing':['dmat-reviewed-review'],
 'dMAT-registration-unknown-procedure':['dmat-reviewed-review'],
 'dMAT-dispatch-unknown-procedure':['dmat-reviewed-review'],
};
const partnership=dmatProfile.dmat!;
const confirmedPartnership={status:'confirmed',kind:'exchange',issuerRole:'home_institution',issuer:'Example University',groupNumber:'A123',reference:'Official exchange confirmation'} as const;
const dmatVariants: {id:string;profile:Profile;dMAT:Result['dMAT']}[] = [
 {id:'dMAT-completed-missing-certificate',profile:{...dmatProfile,hasExistingApsCertificate:false,dmat:{qualificationScope:'single',procedure:'relevant_completed'}},dMAT:'unknown'},
 {id:'dMAT-completed-unknown-certificate',profile:{...dmatProfile,hasExistingApsCertificate:undefined,dmat:{qualificationScope:'single',procedure:'relevant_completed'}},dMAT:'unknown'},
 {id:'dMAT-multiple',profile:{...dmatProfile,dmat:{...partnership,qualificationScope:'multiple'}},dMAT:'unknown'},
 {id:'dMAT-qualification-unknown',profile:{...dmatProfile,dmat:{...partnership,qualificationScope:'unknown'}},dMAT:'unknown'},
 {id:'dMAT-master-issuer-missing',profile:{...dmatProfile,tertiaryQualification:{country:'in',context:'national'}},dMAT:'unknown'},
 {id:'dMAT-master-foreign',profile:{...dmatProfile,tertiaryQualification:{issuer:'Saudi University',country:'sa',context:'national'}},dMAT:'unknown'},
 {id:'dMAT-master-context-unknown',profile:{...dmatProfile,tertiaryQualification:{issuer:'Example University',country:'in',context:'unknown'}},dMAT:'unknown'},
 {id:'dMAT-unknown-procedure',profile:{...dmatProfile,dmat:{...partnership,procedure:'unknown'}},dMAT:'unknown'},
 {id:'dMAT-unknown-procedure-partnership',profile:{...dmatProfile,dmat:{...partnership,procedure:'unknown',partnership:confirmedPartnership}},dMAT:'not_required'},
 {id:'dMAT-partnership-group-blank',profile:{...dmatProfile,dmat:{...partnership,partnership:{...confirmedPartnership,groupNumber:''}}},dMAT:'unknown'},
];
for(const event of ['registration','dispatch'] as const) {
 dmatVariants.push({id:'dMAT-'+event+'-date-missing',profile:{...dmatProfile,dmat:{...partnership,[event]:{status:event==='registration'?'completed':'complete'}}},dMAT:'unknown'});
 dmatVariants.push({id:'dMAT-'+event+'-unknown-procedure',profile:{...dmatProfile,dmat:{...partnership,procedure:'unknown',[event]:{status:event==='registration'?'completed':'complete',date:'2026-06-28'}}},dMAT:'unknown'});
}
REVIEWED_CASES.push(...dmatVariants.map(c=>({...c,universe:'dMAT' as const,reviewedIn:'dmat.test.ts + '+contract3})));
export const APS_ADDITIONAL = [
 {id:'master-Indian',profile:{...officialIndianProfile,targetDegree:'master',schoolQualification:undefined,tertiaryQualification:{issuer:'Indian university',country:'in',context:'national'}},scopes:{qualification:'unknown',application:'required',visa:'not_listed'},certificate:'missing',aps:'required'},
 {id:'master-Saudi',profile:{...officialIndianProfile,targetDegree:'master',tertiaryQualification:{issuer:'Saudi university',country:'sa',context:'national'}},scopes:{qualification:'unknown',application:'unknown',visa:'not_listed'},certificate:'missing',aps:'unknown'},
 {id:'school-Saudi',profile:{...officialIndianProfile,nationality:'in',schoolQualification:{country:'sa',context:'national'}},scopes:{qualification:'unknown',application:'unknown',visa:'not_listed'},certificate:'missing',aps:'unknown'},
 {id:'context-unknown',profile:{...officialIndianProfile,schoolQualification:{country:'in',context:'unknown'}},scopes:{qualification:'unknown',application:'unknown',visa:'not_listed'},certificate:'missing',aps:'unknown'},
] as const;
export const APS_SUPPORT: Record<string,{qualification:string[];application:string[];visa:string[];aps:'required'|'unknown';documents:string[];acquisition:boolean}>={
 'Indian-qualification-Saudi-visa':{qualification:['aps-scoped-qualification'],application:['aps-scoped-application','aps-scoped-acquisition'],visa:['aps-scoped-visa-sa'],aps:'required',documents:['APS India certificate'],acquisition:true},
 'held':{qualification:['aps-scoped-qualification'],application:['aps-scoped-application','aps-scoped-acquisition'],visa:['aps-scoped-visa-sa'],aps:'required',documents:['APS India certificate'],acquisition:false},
 'certificate-unknown':{qualification:['aps-scoped-qualification'],application:['aps-scoped-application','aps-scoped-acquisition'],visa:['aps-scoped-visa-sa'],aps:'required',documents:['APS India certificate'],acquisition:false},
 'mission-missing':{qualification:['aps-scoped-qualification'],application:['aps-scoped-application','aps-scoped-acquisition'],visa:[],aps:'required',documents:['APS India certificate'],acquisition:true},
 'issuer-missing':{qualification:[],application:[],visa:['aps-scoped-visa-sa'],aps:'unknown',documents:[],acquisition:false},
 'international':{qualification:[],application:[],visa:['aps-scoped-visa-sa'],aps:'unknown',documents:[],acquisition:false},
 'master-Indian':{qualification:[],application:['aps-scoped-application','aps-scoped-acquisition'],visa:['aps-scoped-visa-sa'],aps:'required',documents:['APS India certificate'],acquisition:true},
 'master-Saudi':{qualification:[],application:[],visa:['aps-scoped-visa-sa'],aps:'unknown',documents:[],acquisition:false},
 'school-Saudi':{qualification:[],application:[],visa:['aps-scoped-visa-sa'],aps:'unknown',documents:[],acquisition:false},
 'context-unknown':{qualification:[],application:[],visa:['aps-scoped-visa-sa'],aps:'unknown',documents:[],acquisition:false},
};

// Literal meaningful diagnostic subsets from contract3. Other independent facts may coexist.
export const DIAGNOSTIC_CONTROLS: {universe:Universe;id:string;sourceId:string;status:string;reason:string;facts:object[];omittedActualKeys?:string[]}[] = [
 ['IB','eleven-school-years','ib-reviewed-2025-math-hl-ordinary-grades','known_unmet_condition','condition_unmet',[{key:'ib_school_years',actual:11,expected:{op:'gte',value:12}}]],
 ['IB','missing-schooling','ib-reviewed-2025-math-hl-ordinary-grades','targeted_missing_fact','fact_missing',[{key:'ib_schooling',expected:'ascending_full_time'}]],
 ['IB','missing-continuity','ib-reviewed-2025-math-hl-ordinary-grades','targeted_missing_fact','fact_missing',[{key:'ib_continuity',expected:true}]],
 ['IB','low-grade-1','ib-reviewed-2025-math-hl-ordinary-grades','known_unmet_condition','condition_unmet',[{key:'ib_min_subject_grade',actual:1,expected:{op:'gte',value:4}}]],
 ['IB','low-grade-2','ib-reviewed-2025-math-hl-ordinary-grades','known_unmet_condition','condition_unmet',[{key:'ib_min_subject_grade',actual:2,expected:{op:'gte',value:4}}]],
 ['IB','compensation-below24','ib-reviewed-2025-math-hl-compensated-grade3','known_unmet_condition','condition_unmet',[{key:'ib_total_points',actual:23,expected:{op:'gte',value:24}}]],
 ['IB','HL3-only-SL5','ib-reviewed-2025-math-hl-compensated-grade3','known_unmet_condition','condition_unmet',[{key:'ib_compensation_max_grade',actual:4,expected:{op:'gte',value:5}}]],
 ['IB','exception-Nov2025-not-yet','ib-reviewed-2025-math-sl-annex-ordinary-grades','unsupported','applicability_unsupported',[{key:'ib_annex_status',actual:'not_yet_effective',expected:'applicable'}]],
 ['IB','listed-missing-exam','ib-reviewed-2025-math-sl-annex-ordinary-grades','targeted_missing_fact','fact_missing',[{key:'ib_exam_session',expected:{op:'in',value:['may','november']}},{key:'ib_annex_status',actual:'missing_session',expected:'applicable'}]],
 ['IB','listed-missing-programme','ib-reviewed-2025-math-sl-annex-ordinary-grades','targeted_missing_fact','fact_missing',[{key:'ib_annex_status',actual:'missing_programme',expected:'applicable'}]],
 ['IB','Djidda-ordinary-IB','ib-reviewed-2021-2024-math-sl-annex-ordinary-grades','unsupported','applicability_unsupported',[{key:'ib_annex_status',actual:'programme_not_covered',expected:'applicable'}]],
 ['IB','duplicate006880','ib-reviewed-2025-math-sl-annex-ordinary-grades','source_conflict','applicability_unsupported',[{key:'ib_annex_status',actual:'source_conflict',expected:'applicable'}]],
 ['India','India-school-only-missing','india-study-school-only','targeted_missing_fact','fact_missing',[{key:'class12_percent',actual:'unknown',expected:{op:'gte',value:70}}]],
 ['India','unmet-years-0','india-study-successful-year','known_unmet_condition','condition_unmet',[{key:'in_class12_successful_bachelor_years',actual:0,expected:{op:'gte',value:1}}]],
 ['India','unmet-years-0.5','india-study-successful-year','known_unmet_condition','condition_unmet',[{key:'in_class12_successful_bachelor_years',actual:0.5,expected:{op:'gte',value:1}}]],
 ['India','unmet-years-0.99','india-study-successful-year','known_unmet_condition','condition_unmet',[{key:'in_class12_successful_bachelor_years',actual:0.99,expected:{op:'gte',value:1}}]],
 ['India','completed-degree-years-missing','india-study-successful-year','targeted_missing_fact','fact_missing',[{key:'in_class12_successful_bachelor_years',actual:'unknown',expected:{op:'gte',value:1}}]],
 ['India','recognition-rejected','india-study-successful-year','known_unmet_condition','condition_unmet',[{key:'in_class12_reported_recognition',actual:'rejected',expected:'confirmed'}]],
 ['India','recognition-reference-missing','india-study-successful-year','targeted_missing_fact','fact_missing',[{key:'in_class12_reported_recognition',actual:'unknown',expected:'confirmed'}]],
 ['India','unrelated-target','india-study-successful-year','known_unmet_condition','condition_unmet',[{key:'in_class12_reported_target_relation',actual:'unrelated',expected:{op:'in',value:['previous','closely_related']}}]],
 ['India','prior-study-missing','india-study-successful-year','targeted_missing_fact','fact_missing',[{key:'in_class12_prior_study_kind',actual:'unknown',expected:'bachelor'}]],
 ['India','mode-distance_online','india-study-successful-year','unsupported','applicability_unsupported',[{key:'in_class12_study_mode',actual:'distance_online',expected:'regular'}]],
 ['India','mode-other','india-study-successful-year','unsupported','applicability_unsupported',[{key:'in_class12_study_mode',actual:'other',expected:'regular'}]],
 ['India','mode-unknown','india-study-successful-year','targeted_missing_fact','fact_missing',[{key:'in_class12_study_mode',actual:'unknown',expected:'regular'}]],
 ['India','country-pk','india-study-successful-year','unsupported','applicability_unsupported',[{key:'in_class12_prior_study_country',actual:'pk',expected:'in'}]],
 ['India','country-undefined','india-study-successful-year','targeted_missing_fact','fact_missing',[{key:'in_class12_prior_study_country',actual:'unknown',expected:'in'}]],
 ['Pakistan','PK-current-recognition-rejected','pakistan-current-year-science','known_unmet_condition','condition_unmet',[{key:'pk_reported_recognition',actual:'reported_official_rejected',expected:'reported_official_confirmed'}]],
 ['Pakistan','PK-current-unrelated','pakistan-current-year-science','known_unmet_condition','condition_unmet',[{key:'pk_reported_target_relation',actual:'reported_official_unrelated',expected:{op:'in',value:['reported_official_previous','reported_official_closely_related']}}]],
 ['Pakistan','PK-current-contrary-assessment','pakistan-current-year-science','source_conflict','applicability_unsupported',[{key:'pk_current_assessment',actual:'reported_contrary',expected:'reported_current_support'}]],
 ['Pakistan','PK-current-assessment-missing','pakistan-current-year-science','targeted_missing_fact','fact_missing',[{key:'pk_current_assessment',actual:'unknown',expected:'reported_current_support'}]],
 ['Pakistan','PK-current-years-0','pakistan-current-year-science','known_unmet_condition','condition_unmet',[{key:'pk_successful_academic_years',actual:0,expected:{op:'gte',value:1}}]],
 ['Pakistan','PK-current-years-0.5','pakistan-current-year-science','known_unmet_condition','condition_unmet',[{key:'pk_successful_academic_years',actual:0.5,expected:{op:'gte',value:1}}]],
 ['Saudi','subject-reported_official_unmet','sa-reviewed-private-one','known_unmet_condition','condition_unmet',[{key:'sa_reported_subject_assessment',actual:'unmet',expected:'met'}]],
 ['Saudi','private-coverage-reported_official_unmet','sa-reviewed-private-one','known_unmet_condition','condition_unmet',[{key:'sa_private_assessment_coverage',actual:'unmet',expected:'met'}]],
 ['Saudi','SA-degree-recognition-rejected','sa-reviewed-completed-bachelor','known_unmet_condition','condition_unmet',[{key:'sa_degree_recognition',actual:'unknown',reported:'reported_official_rejected',expected:'confirmed'}]],
 ['Saudi','SA-degree-norms-unmet','sa-reviewed-completed-bachelor','known_unmet_condition','condition_unmet',[{key:'sa_degree_norms',actual:'unknown',reported:'reported_official_unmet',expected:'met'}]],
 ['transition','APS-submission-2026-03-15','aps-transition-current','known_unmet_condition','condition_unmet',[{key:'class12_percent',actual:65,expected:{op:'lt',value:70}}]],
 ['transition','APS-grade-69.99','aps-transition-current','known_unmet_condition','condition_unmet',[{key:'class12_percent',actual:69.99,expected:{op:'lt',value:70}}]],
] .map(([universe,id,sourceId,status,reason,facts])=>({universe:universe as Universe,id:id as string,sourceId:sourceId as string,status:status as string,reason:reason as string,facts:facts as object[]}));

export const POSITIVE_FACTS: {universe:Universe;id:string;facts:object[]}[] = [
 {universe:'GCE',id:'ordinary-trio',facts:[{key:'gce_school_years',actual:12,expected:{op:'gte',value:12}},{key:'gce_distinct_al_count',actual:3,expected:{op:'gte',value:3}},{key:'gce_general_al_count',actual:3,expected:{op:'gte',value:3}},{key:'gce_min_al_grade',actual:3,expected:{op:'gte',value:3}},{key:'gce_list_a_count',actual:3,expected:{op:'gte',value:2}},{key:'gce_has_math_al',actual:true,expected:true},{key:'gce_has_technical_support_al',actual:true,expected:true}]},
 {universe:'GCE',id:'science',facts:[{key:'gce_science_or_math_count',actual:2,expected:{op:'gte',value:2}}]},
 {universe:'GCE',id:'medicine',facts:[{key:'gce_science_or_math_count',actual:3,expected:{op:'gte',value:3}}]},
 {universe:'GCE',id:'humanities-CAIE-marine',facts:[{key:'gce_has_humanities_al',actual:true,expected:true}]},
 {universe:'GCE',id:'social-economics-economics-mathematics-history-C',facts:[{key:'gce_has_social_economics_al',actual:true,expected:true},{key:'gce_has_science_or_math_al',actual:true,expected:true}]},
 {universe:'GCE',id:'social-extra-U',facts:[{key:'gce_min_al_grade',actual:3,expected:{op:'gte',value:3}}]},
 {universe:'IB',id:'AA-HL-2025',facts:[{key:'ib_subject_count',actual:6,expected:6},{key:'ib_min_subject_grade',actual:4,expected:{op:'gte',value:4}},{key:'ib_hl_count',actual:3,expected:{op:'gte',value:3}},{key:'ib_continuity',actual:true,expected:true},{key:'ib_has_natural_science',actual:true,expected:true},{key:'ib_math_conflict',actual:false,expected:false}]},
 {universe:'IB',id:'one-SL3-SL5-total24',facts:[{key:'ib_min_subject_grade',actual:3,expected:3},{key:'ib_grade3_count',actual:1,expected:1},{key:'ib_compensation_max_grade',actual:5,expected:{op:'gte',value:5}},{key:'ib_total_points',actual:24,expected:{op:'gte',value:24}}]},
 {universe:'India',id:'FUTURE-India-one-year-route',facts:[{key:'in_class12_successful_bachelor_years',actual:1,expected:{op:'gte',value:1}},{key:'class12_percent',actual:70,expected:{op:'gte',value:70}},{key:'in_class12_reported_recognition',actual:'confirmed',expected:'confirmed'},{key:'in_class12_reported_target_relation',actual:'previous',expected:{op:'in',value:['previous','closely_related']}}]},
 {universe:'India',id:'school-only',facts:[{key:'in_class12_prior_study_kind',actual:'none',expected:'none'},{key:'class12_percent',actual:70,expected:{op:'gte',value:70}}]},
 {universe:'Pakistan',id:'PK-prep-science',facts:[{key:'pk_grade_percent',actual:50,expected:{op:'gte',value:50}},{key:'pk_prior_study_kind',actual:'none',expected:'none'},{key:'pk_documentary_group',actual:'science',expected:'science'},{key:'pk_target_family',actual:'technology',expected:{op:'in',value:['medicine','natural_sciences','technology']}}]},
 {universe:'Pakistan',id:'PK-current-science-winter-2026',facts:[{key:'pk_grade_percent',actual:50,expected:{op:'gte',value:50}},{key:'pk_successful_academic_years',actual:1,expected:{op:'gte',value:1}},{key:'pk_current_assessment',actual:'reported_current_support',expected:'reported_current_support'},{key:'pk_reported_recognition',actual:'reported_official_confirmed',expected:'reported_official_confirmed'},{key:'pk_documentary_group',actual:'science',expected:'science'}]},
 {universe:'Saudi',id:'Commercial Section-year',facts:[{key:'sa_successful_bachelor_years',actual:1,expected:{op:'gte',value:1}}]},
 {universe:'Saudi',id:'private-one',facts:[{key:'sa_successful_bachelor_years',actual:1,expected:1}]},
 {universe:'Saudi',id:'private-two',facts:[{key:'sa_successful_bachelor_years',actual:2,expected:{op:'gte',value:2}}]},
 {universe:'Saudi',id:'industrial-successful-one',facts:[{key:'sa_successful_bachelor_years',actual:1,expected:{op:'gte',value:1}}]},
 {universe:'Saudi',id:'completed-four-year-general',facts:[{key:'sa_degree_nominal_years',actual:4,expected:{op:'gte',value:4}},{key:'sa_degree_completion',actual:'completed',expected:'completed'},{key:'sa_degree_mode',actual:'regular',expected:'regular'},{key:'sa_degree_norms',actual:'met',expected:'met'},{key:'sa_degree_recognition',actual:'confirmed',expected:'confirmed'}]},
];
// New manifest classification fixes only these two reviewed negative reports.
export const NEGATIVE_REPORT_MEMBERSHIP = [
 {universe:'Saudi',id:'subject-reported_official_unmet',kind:'negative',evidence:'known-unmet'},
 {universe:'Saudi',id:'private-coverage-reported_official_unmet',kind:'negative',evidence:'known-unmet'},
] as const;
export type RouteMembership = {universe:Universe;route:string;positive:string[];negative:string[];boundary:string[];missing:string[];exception:string[]};
export const ROUTE_MEMBERSHIP: RouteMembership[] = [
 ...GCE_ROUTE_POSITIVES.map(([route,id])=>({universe:'GCE' as const,route:route+'/'+id,positive:[id],negative:['GCE-'+id+'-gradeD'],boundary:[id,'GCE-'+id+'-years11'],missing:['GCE-'+id+'-years-missing'],exception:['GCE-'+id+'-national']})),
 {universe:'GCE',route:'Cambridge-history/current-body',positive:['Cambridge-2022','GCE-Pearson-current'],negative:['Cambridge-before-2022'],boundary:['Cambridge-2022','Cambridge-before-2022'],missing:['missing-intake'],exception:['Pearson-history']},
 {universe:'IB',route:'HL-general',positive:['AA-HL-2025','2024-HL-general'],negative:['low-grade-1','low-grade-2'],boundary:['eleven-school-years','AA-HL-2025'],missing:['missing-schooling','missing-continuity'],exception:['official-IBO-paper-pending']},
 {universe:'IB',route:'SL-annex-general',positive:['exception-May2026','Djidda-GIB-May2021'],negative:['exception-failing-grade'],boundary:['exception-May2026','exception-Nov2025-not-yet'],missing:['listed-missing-exam','listed-missing-programme'],exception:['duplicate006880','Djidda-ordinary-IB']},
 {universe:'IB',route:'SL-subject-scope',positive:['2021-SL-humanities','2024-SL-scienceHL'],negative:['IB-SL-school-years11','SL-STEM-no-automatic-FSP'],boundary:['2024-SL-scienceHL','IB-SL-school-years11'],missing:['missing-schooling','missing-continuity'],exception:['HL-language-2024']},
 {universe:'IB',route:'grade3-compensation',positive:['one-SL3-SL5-total24','one-SL3-HL5-total24'],negative:['HL3-only-SL5','two-grade3'],boundary:['one-SL3-SL5-total24','compensation-below24'],missing:['missing-grade'],exception:['duplicate-language']},
 {universe:'IB',route:'historical-mathematics',positive:['legacy-MathSL-scienceHL'],negative:['IB-SL-school-years11'],boundary:['legacy-MathSL-scienceHL','2021-SL-humanities'],missing:['missing-schooling','missing-continuity'],exception:['COVID-2020-may','COVID-2020-november']},
 {universe:'India',route:'school-only',positive:['school-only'],negative:['India-school-only-low'],boundary:['school-only','summer-2026'],missing:['India-school-only-missing'],exception:['India-school-timing-hold']},
 {universe:'India',route:'successful-year',positive:['FUTURE-India-one-year-route'],negative:['unmet-years-0','recognition-rejected','unrelated-target'],boundary:['years-1','grade-70'],missing:['completed-degree-years-missing','prior-study-missing'],exception:['mode-distance_online','country-pk','status-discontinued']},
 ...['technology','natural-sciences'].map(family=>({universe:'JEE' as const,route:family,positive:['ordinary-reported-'+family],negative:['advanced-failed'],boundary:['grade-69.99','grade-70','grade-70.01','grade-undefined','noncovered-summer2026'],missing:['main-missing','certificate-missing','classification-missing','JEE-reference-missing'],exception:['main_exemption','preparatory_rank','cross_year','unclear']})),
 ...['science','commerce','humanities'].map(group=>({universe:'Pakistan' as const,route:'prep-'+group,positive:['PK-prep-'+group],negative:['PK-prep-'+group+'-below','PK-prep-'+group+'-outside'],boundary:['PK-prep-'+group,'PK-prep-'+group+'-below'],missing:['PK-prep-'+group+'-missing'],exception:['PK-prep-'+group+'-alias-fsc','PK-prep-'+group+'-passport-visa-intake']})),
 ...['science','commerce','humanities'].map(group=>({universe:'Pakistan' as const,route:'current-'+group,positive:['PK-current-'+group+'-winter-2026'],negative:['PK-'+group+'-grade-below','PK-current-years-0'],boundary:['PK-current-'+group+'-winter-2026','PK-current-years-0.5'],missing:['PK-'+group+'-grade-missing','PK-history-years-missing','PK-intake-missing'],exception:['PK-current-distance','PK-history-completed','PK-current-contrary-assessment']})),
 ...['Literary Section','Science Section','Commercial Section'].flatMap(stream=>[
  {universe:'Saudi' as const,route:stream+'/prep',positive:[stream+'-prep'],negative:stream==='Science Section'?['SA-science-prep-before-intake']:['literary-outside-prep','commercial-outside-prep'],boundary:[stream+'-prep',...(stream==='Science Section'?['SA-science-prep-before-intake']:['industrial-before'])],missing:['SA-'+stream+'-category-missing','SA-'+stream+'-completion-missing'],exception:['completed-with-'+stream,'SA-scientific-no-family']},
  {universe:'Saudi' as const,route:stream+'/year',positive:[stream+'-year'],negative:['SA-national-year-recognition-rejected'],boundary:[stream+'-year',stream+'-prep'],missing:['SA-national-year-years-missing','SA-national-year-relation-missing'],exception:['completed-with-'+stream,'SA-commercial-year-outside-prep']},
 ]),
 {universe:'Saudi',route:'private-one',positive:['private-one'],negative:['subject-reported_official_unmet','private-coverage-reported_official_unmet','private-zero'],boundary:['private-one','fraction-0.99'],missing:['private-years-missing','subject-reference'],exception:['private-one-neighbour-not-prior','status-discontinued','foreign-accredited-study']},
 {universe:'Saudi',route:'private-two',positive:['private-two'],negative:['private-zero','recognition-rejected'],boundary:['private-two','fraction-1.99','fraction-2.01'],missing:['private-years-missing','target-reference'],exception:['status-discontinued','foreign-accredited-study']},
 {universe:'Saudi',route:'industrial-prep',positive:['industrial-enrollment'],negative:['industrial-enrollment-target-unrelated'],boundary:['industrial-before','industrial-next'],missing:['industrial-enrollment-reference'],exception:['industrial-diploma-enrollment','completed-with-industrial']},
 {universe:'Saudi',route:'industrial-year',positive:['industrial-successful-one','SA-industrial-year-no-enrollment'],negative:['SA-industrial-zero-no-enrollment','SA-industrial-year-unrelated'],boundary:['SA-industrial-year-before','industrial-successful-one'],missing:['SA-industrial-year-reference-missing','SA-industrial-year-intake-missing'],exception:['industrial-no-enrollment-year-two','completed-with-industrial']},
 {universe:'Saudi',route:'completed-Bachelor',positive:['completed-four-year-general'],negative:['SA-degree-recognition-rejected','SA-degree-norms-unmet'],boundary:['nominal-3.99','completed-four-year-general'],missing:['SA-degree-recognition-reference','SA-degree-norms-reference'],exception:['completed-with-industrial','master-degree','SA-degree-mode']},
 {universe:'transition',route:'confirmed-submission',positive:['APS-submission-2026-03-15'],negative:['APS-grade-69.99'],boundary:['APS-submission-2026-03-14','APS-submission-2026-03-15','APS-submission-2026-03-16'],missing:['APS-confirmation-missing','APS-date-missing','APS-intake-missing'],exception:['APS-other-qualification','APS-grade-70','APS-grade-70.01']},
 ...[
 ['completed',['DMAT-exception-relevant-completed'],['dMAT-completed-missing-certificate'],['dMAT-new-procedure-old-certificate'],['dMAT-completed-unknown-certificate'],['dMAT-new-procedure-old-certificate']],
 ['registration',['dMAT-registration-2026-06-28'],['dMAT-registration-2026-06-29'],['dMAT-registration-2026-06-28','dMAT-registration-2026-06-29'],['dMAT-registration-date-missing'],['dMAT-registration-unknown-procedure']],
 ['dispatch',['dMAT-dispatch-2026-06-28'],['dMAT-dispatch-2026-06-29'],['dMAT-dispatch-2026-06-28','dMAT-dispatch-2026-06-29'],['dMAT-dispatch-date-missing'],['dMAT-dispatch-unknown-procedure']],
 ['semester3',['dMAT-semesters-3-4'],['dMAT-semesters-3-5'],['dMAT-semesters-3-4','dMAT-semesters-3-5'],['dMAT-semesters-missing-3-4'],['dMAT-qualification-unknown']],
 ['semester4',['dMAT-semesters-4-6'],['dMAT-semesters-4-7'],['dMAT-semesters-4-6','dMAT-semesters-4-7'],['dMAT-semesters-missing-4-6'],['dMAT-multiple']],
 ['partnership',['dMAT-partnership'],['dMAT-partnership-pending'],['dMAT-partnership','dMAT-partnership-pending'],['dMAT-partnership-group-blank'],['dMAT-unknown-procedure-partnership']],
 ['unaffected',['dMAT-unaffected'],['DMAT-positive-affected'],['dMAT-unaffected','DMAT-positive-affected'],['dMAT-unaffected-blank'],['DMAT-missing-field']],
 ['intake',['dMAT-intake-before'],['DMAT-positive-affected'],['dMAT-intake-before','DMAT-positive-affected'],['dMAT-intake-missing'],['dMAT-multiple']],
 ['Bachelor',['DMAT-negative-bachelor'],['DMAT-positive-affected'],['DMAT-negative-bachelor','DMAT-positive-affected'],['dMAT-master-issuer-missing'],['dMAT-master-foreign','dMAT-master-context-unknown']],
 ] .map(([route,positive,negative,boundary,missing,exception])=>({universe:'dMAT' as const,route:route as string,positive:positive as string[],negative:negative as string[],boundary:boundary as string[],missing:missing as string[],exception:exception as string[]})),
];

REVIEWED_CASES.push({id:'India-school-timing-hold',universe:'India',reviewedIn:contract3,profile:{...indianStudyProfile,schoolGradePercent:69.99,qualificationHistory:{hasPriorUniversityStudy:false},apsProcedure:{status:'pending',submissionConfirmation:'confirmed',submissionDate:'2026-03-14'}},path:'unknown'});

REVIEWED_CASES.push(
 {id:'JEE-wrong-issuer',universe:'JEE',reviewedIn:'jee-ordinary.test.ts + '+contract3,profile:{...jeeProfile,schoolQualification:{country:'sa',context:'national'}},path:'unknown'},
 {id:'JEE-international-context',universe:'JEE',reviewedIn:'jee-ordinary.test.ts + '+contract3,profile:{...jeeProfile,schoolQualification:{country:'in',context:'international'}},path:'unknown'},
);
DIAGNOSTIC_CONTROLS.push(
 {universe:'JEE',id:'advanced-failed',sourceId:'in-jee-qualifying-pass-review',status:'known_unmet_condition',reason:'condition_unmet',facts:[{key:'jee_advanced_status',actual:'not_passed',expected:'passed'}]},
 {universe:'JEE',id:'main-missing',sourceId:'in-jee-qualifying-pass-review',status:'targeted_missing_fact',reason:'fact_missing',facts:[{key:'jee_main_status',expected:'passed'}],omittedActualKeys:['jee_main_status']},
 {universe:'JEE',id:'classification-outside',sourceId:'in-jee-qualifying-pass-review',status:'unsupported',reason:'applicability_unsupported',facts:[{key:'jee_reported_target_family',actual:'reported_official_outside',expected:{op:'in',value:['reported_official_technology','reported_official_natural_sciences']}}]},
 {universe:'JEE',id:'noncovered-summer2026',sourceId:'in-jee-qualifying-pass-review',status:'unsupported',reason:'applicability_unsupported',facts:[{key:'intake_index',actual:4052,expected:{op:'in',value:[4053,4054,4055]}}]},
);

REVIEWED_CASES.push({id:'SA-science-prep-before-intake',universe:'Saudi',reviewedIn:contract3,profile:{...nationalProfile('Science Section'),intake:{term:'summer',year:2026}},path:'unknown'});
for(const group of ['science','commerce','humanities']) {
 const p=PAKISTAN_PREP_ACCEPTANCE.find(c=>c.id==='PK-prep-'+group)!.profile;
 REVIEWED_CASES.push({id:'PK-prep-'+group+'-alias-fsc',universe:'Pakistan',reviewedIn:contract3,profile:{...p,pakistan:{...p.pakistan!,certificate:'fsc'}},path:'unknown'});
 REVIEWED_CASES.push({id:'PK-prep-'+group+'-passport-visa-intake',universe:'Pakistan',reviewedIn:contract3,profile:{...p,nationality:'in',visaApplicationCountry:'sa',intake:{term:'winter',year:2026}},path:'studienkolleg'});
 WINNING_PATH_SOURCES.Pakistan!['PK-prep-'+group+'-passport-visa-intake']=['pakistan-prep-'+group];
}
