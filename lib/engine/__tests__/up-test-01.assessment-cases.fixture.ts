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
import { INDIA_STUDY_ACCEPTANCE, reviewedIndiaStudyRules } from './india-study.fixture';
import { JEE_ACCEPTANCE, jeeProfile } from './jee.fixture';
import { PAKISTAN_CURRENT_ACCEPTANCE, PAKISTAN_PREP_ACCEPTANCE, currentPakistanProfile } from './pakistan.fixture';
import { SAUDI_ACCEPTANCE, completedSaudiProfile, nationalProfile } from './saudi.fixture';
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
