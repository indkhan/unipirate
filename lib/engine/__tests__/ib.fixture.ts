import type { Profile, Result } from '../evaluate';
// Official KMK contract checked 2026-10-07. Disposable fixtures, not publication.
export const ordinaryIb: Profile = {
 targetDegree:'bachelor',curriculumType:'ib',targetField:'cs',intake:{term:'winter',year:2026},
 ib:{version:1,fullDiploma:true,documentStatus:'awarded',examYear:2026,examSession:'may',schoolYears:12,schooling:'ascending_full_time',totalPoints:30,mathLevel:'HL',mathCourse:'AA',programme:'ib',
 subjects:[
 {subjectId:'language_a',language:'English',continuedForeign:'no',level:'SL',grade:4},
 {subjectId:'language_b',language:'German',continuedForeign:'yes',level:'HL',grade:5},
 {subjectId:'history',level:'HL',grade:5},
 {subjectId:'physics',level:'SL',grade:5},
 {subjectId:'math_aa',level:'HL',grade:5},
 {subjectId:'visual_arts',level:'SL',grade:4},
 ].map(s=>({...s,continuity:'two_years',independence:'independent',group:1,category:'other',recognizedForGermany:true})) as NonNullable<Profile['ib']>['subjects']}
};
export function ibCase(change: Partial<NonNullable<Profile['ib']>>={}, targetField='cs'): Profile {
 return {...ordinaryIb,targetField,ib:{...structuredClone(ordinaryIb.ib!),...change}};
}
export function ibRows(patches: Record<number,object>): NonNullable<Profile['ib']>['subjects'] {
 return ordinaryIb.ib!.subjects!.map((s,i)=>({...s,...patches[i]}));
}
const sl = {mathLevel:'SL' as const,subjects:ibRows({3:{level:'HL'},4:{level:'SL'}})};
const school = {name:'SIS Swiss International School Stuttgart-Fellbach',country:'DEUTSCHLAND',code:'049128'};
const djidda = {name:'DS Djidda',country:'Saudi Arabien'};
const languageHl = ibRows({0:{level:'HL'},3:{subjectId:'physics',level:'SL'},4:{level:'SL'}});
export const IB_ACCEPTANCE: {id:string;profile:Profile;path:Result['path'];reason?:RegExp}[] = [
 {id:'AA-HL-2025',profile:ibCase({examYear:2025}),path:'direct'},
 {id:'AI-HL-2026',profile:ibCase({mathCourse:'AI',subjects:ibRows({4:{subjectId:'math_ai'}})}),path:'direct'},
 {id:'continued-foreign-A-SL',profile:ibCase({subjects:ibRows({0:{continuedForeign:'yes'},1:{continuedForeign:'no'}})}),path:'direct'},
 {id:'one-SL3-SL5-total24',profile:ibCase({totalPoints:24,subjects:ibRows({0:{grade:3},1:{grade:4},2:{grade:4},4:{grade:4}})}),path:'direct'},
 {id:'one-SL3-HL5-total24',profile:ibCase({totalPoints:24,subjects:ibRows({0:{grade:3},3:{grade:4}})}),path:'direct'},
 {id:'HL3-only-SL5',profile:ibCase({totalPoints:24,subjects:ibRows({1:{grade:3},2:{grade:4},4:{grade:4}})}),path:'unknown',reason:/grade|compensat/i},
 {id:'two-grade3',profile:ibCase({subjects:ibRows({0:{grade:3},5:{grade:3}})}),path:'unknown',reason:/grade/i},
 ...[1,2].map(grade=>({id:'low-grade-'+grade,profile:ibCase({subjects:ibRows({0:{grade}})}),path:'unknown' as const,reason:/grade/i})),
 {id:'compensation-below24',profile:ibCase({totalPoints:23,subjects:ibRows({0:{grade:3}})}),path:'unknown',reason:/points|grade/i},
 {id:'HL-language-2025',profile:ibCase({...sl,examYear:2025,subjects:languageHl}),path:'direct' /* annex below supplied separately */},
 {id:'HL-language-2024',profile:ibCase({...sl,examYear:2024,subjects:languageHl},'humanities'),path:'unknown',reason:/Higher|HL/i},
 {id:'legacy-MathSL-scienceHL',profile:ibCase({...sl,examYear:2020,mathCourse:'legacy',subjects:ibRows({3:{level:'HL'},4:{subjectId:'mathematics',level:'SL'}})}),path:'direct'},
 {id:'2021-SL-humanities',profile:ibCase({...sl,examYear:2021},'humanities'),path:'subject_restricted'},
 {id:'2024-HL-general',profile:ibCase({examYear:2024}),path:'direct'},
 {id:'2024-SL-scienceHL',profile:ibCase({...sl,examYear:2024},'humanities'),path:'subject_restricted'},
 {id:'SL-STEM-no-automatic-FSP',profile:ibCase(sl),path:'unknown',reason:/mathemat|scope|annex/i},
 {id:'SL-medicine',profile:ibCase(sl,'medicine'),path:'unknown'},
 {id:'SL-other',profile:ibCase(sl,'other'),path:'unknown',reason:/target|scope/i},
 {id:'exception-May2026',profile:ibCase({...sl,school}),path:'direct'},
 {id:'exception-Nov2025-not-yet',profile:ibCase({...sl,school,examYear:2025,examSession:'november'}),path:'unknown',reason:/effective|session|mathemat/i},
 {id:'listed-missing-exam',profile:ibCase({...sl,school,examSession:undefined}),path:'unknown',reason:/session/i},
 {id:'listed-missing-programme',profile:ibCase({...sl,school,programme:undefined}),path:'unknown',reason:/programme/i},
 {id:'Djidda-GIB-May2021',profile:ibCase({...sl,school:djidda,programme:'gib',examYear:2021}),path:'direct'},
 {id:'Djidda-ordinary-IB',profile:ibCase({...sl,school:djidda,examYear:2021}),path:'unknown',reason:/programme|GIB/i},
 {id:'duplicate006880',profile:ibCase({...sl,school:{name:'Sinarmas World Academy',country:'INDIEN',code:'006880'}}),path:'unknown',reason:/conflict|006880/i},
 {id:'exception-missing-science',profile:ibCase({...sl,school,subjects:ibRows({3:{subjectId:'computer_science',level:'HL'},4:{level:'SL'}})}),path:'unknown',reason:/science/i},
 {id:'exception-failing-grade',profile:ibCase({...sl,school,subjects:ibRows({0:{grade:2},3:{level:'HL'},4:{level:'SL'}})}),path:'unknown',reason:/grade/i},
 {id:'official-IBO-paper-pending',profile:ibCase({documentStatus:'official_results'}),path:'direct'},
 ...(['not_awarded','certificate','unknown'] as const).map(documentStatus=>({id:documentStatus,profile:ibCase({documentStatus,fullDiploma:false}),path:'unknown' as const,reason:/Diploma|document|award|Certificate/i})),
 {id:'missing-continuity',profile:ibCase({subjects:ibRows({0:{continuity:'unknown'}})}),path:'unknown',reason:/continuity|two.year/i},
 {id:'missing-language-context',profile:ibCase({subjects:ibRows({1:{continuedForeign:'unknown'}})}),path:'unknown',reason:/foreign|language/i},
 {id:'ComputerScience-not-required-science',profile:ibCase({subjects:ibRows({3:{subjectId:'computer_science'}})}),path:'unknown',reason:/science/i},
 {id:'missing-math',profile:ibCase({subjects:ibRows({4:{subjectId:'music'}})}),path:'unknown',reason:/mathemat/i},
 {id:'conflicting-math-summary',profile:ibCase({mathLevel:'SL'}),path:'unknown',reason:/conflict|mathemat/i},
 {id:'missing-schooling',profile:ibCase({schooling:undefined}),path:'unknown',reason:/school/i},
 {id:'eleven-school-years',profile:ibCase({schoolYears:11}),path:'unknown',reason:/school/i},
 {id:'missing-intake',profile:{...ibCase(),intake:undefined},path:'unknown',reason:/intake/i},
 {id:'missing-exam-year',profile:ibCase({examYear:undefined}),path:'unknown',reason:/exam/i},
 {id:'missing-level',profile:ibCase({subjects:ibRows({4:{level:'unknown'}})}),path:'unknown'},
 {id:'missing-grade',profile:ibCase({subjects:ibRows({4:{grade:null}})}),path:'unknown'},
 {id:'independence-unknown',profile:ibCase({subjects:ibRows({4:{independence:'unknown'}})}),path:'unknown',reason:/independent/i},
 {id:'duplicate-language',profile:ibCase({subjects:ibRows({1:{language:'English'}})}),path:'unknown',reason:/independent/i},
];
// SL humanities is restricted regardless of missing school identity. General SL
// access requires exact reviewed identity; no absence-from-partial-index inference.
IB_ACCEPTANCE.find(c=>c.id==='HL-language-2025')!.profile.ib!.school={name:'International School of Braunschweig-Wolfsburg',country:'DEUTSCHLAND',code:'007026'};
for(const [examYear,examSession] of [[2020,'may'],[2020,'november'],[2021,'may']] as const){
 IB_ACCEPTANCE.push({id:'COVID-'+examYear+'-'+examSession,profile:ibCase({examYear,examSession,subjects:ibRows({3:{level:'HL'},4:{subjectId:examYear===2020?'mathematics':'math_aa',level:'HL'}}),mathCourse:examYear===2020?'legacy':'AA',documentStatus:'official_results'}),path:'direct'});
}
