// Pure source identity/evidence restatement. Admission thresholds live in rule data.
import { z } from 'zod';
import annexes from './ib-annexes.json';
export const IB_SOURCE = annexes.sourceUrl;
export const IB_HISTORICAL_SOURCE = 'https://www.kmk.org/zab/fileadmin/Dateien/pdf/ZAB/Hochschulzugang_Beschluesse_der_KMK/283_Vereinb_Anerkenn_Int_Baccalaureate_Diploma-2022-03-24_Liste1-2023-03-01_Liste2-2023-03-01_DE.pdf';
export const IB_GUIDANCE = 'https://www.daad.de/en/studying-in-germany/requirements/ib-diploma/';
export const IB_SUBJECTS = [
 {id:'language_a',label:'Language A: Literature',kind:'language',course:'A'},
 {id:'language_a_language_literature',label:'Language A: Language and Literature',kind:'language',course:'A'},
 {id:'language_b',label:'Language B',kind:'language',course:'B'},
 {id:'german_b',label:'German B',kind:'language',course:'B'},
 {id:'language_ab_initio',label:'Language ab initio (sixth subject only)',kind:'sixth',course:'ab_initio'},
 ...['history','geography','economics','psychology','philosophy','social_anthropology','business_management','global_politics'].map(id=>({id,label:({social_anthropology:'Social and Cultural Anthropology',business_management:'Business and Management',global_politics:'Global Politics'} as Record<string,string>)[id]??id.replaceAll('_',' '),kind:'social',course:''})),
 ...['biology','chemistry','physics'].map(id=>({id,label:id[0].toUpperCase()+id.slice(1),kind:'science',course:''})),
 {id:'math_aa',label:'Mathematics: Analysis and Approaches',kind:'math',course:'AA'},
 {id:'math_ai',label:'Mathematics: Applications and Interpretation',kind:'math',course:'AI'},
 {id:'mathematics',label:'Mathematics (through examination 2020)',kind:'math',course:'legacy'},
 {id:'further_mathematics',label:'Further Mathematics (with Mathematics HL, through 2020)',kind:'math',course:'further'},
 ...['visual_arts','music','theatre','film','literature_performance','latin','classical_greek','general_chemistry','applied_chemistry','environmental_systems','computer_science','design_technology','world_religions','sports_exercise_health','digital_society'].map(id=>({id,label:({visual_arts:'Visual Arts',literature_performance:'Literature and Performance',environmental_systems:'Environmental Systems and Societies',sports_exercise_health:'Sports Exercise and Health Science'} as Record<string,string>)[id]??id.replaceAll('_',' '),kind:'sixth',course:''})),
 {id:'other',label:'Another / cannot identify subject',kind:'unknown',course:''},
] as const;
export const IbSubjectSchema = z.object({
 subjectId:z.string().min(1).max(100).optional(),name:z.string().max(200).optional(),
 level:z.enum(['HL','SL','unknown']),grade:z.number().int().min(1).max(7).nullable(),
 language:z.string().trim().max(100).optional(),continuedForeign:z.enum(['yes','no','unknown']).optional(),
 continuity:z.enum(['two_years','not_two_years','unknown']).optional(),
 independence:z.enum(['independent','dependent','unknown']).optional(),
 // Historical metadata is readable but never trusted for subject recognition.
 group:z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5),z.literal(6)]).optional(),
 category:z.enum(['language','math','biology','chemistry','physics','other']).optional(),
 foreignLanguage:z.boolean().optional(),recognizedForGermany:z.boolean().optional(),
}).strict();
export const IbProfileSchema = z.object({
 version:z.literal(1).optional(),fullDiploma:z.boolean(),documentStatus:z.enum(['awarded','official_results','not_awarded','certificate','unknown']).optional(),
 examYear:z.number().int().min(1990).max(2035).optional(),examSession:z.enum(['may','november','unknown']).optional(),
 schoolYears:z.number().int().min(0).max(50).optional(),schooling:z.enum(['ascending_full_time','other','unknown']).optional(),
 totalPoints:z.number().int().min(0).max(45).optional(),mathLevel:z.enum(['HL','SL']).nullable(),mathCourse:z.enum(['AA','AI','legacy','other']).nullable(),
 programme:z.enum(['ib','gib','unknown']).optional(),school:z.object({name:z.string().trim().max(200).optional(),country:z.string().trim().max(100).optional(),code:z.string().regex(/^\d{6}$/).optional()}).strict().optional(),
 subjects:z.array(IbSubjectSchema).max(20).optional(),
}).strict();
export type IbProfile = z.infer<typeof IbProfileSchema>;
export function ibEntry(id:string|undefined){return IB_SUBJECTS.find(s=>s.id===id);}
export function ibAnnex(ib:IbProfile):{status:string;entry?:typeof annexes.entries[number]} {
 const school=ib.school;
 if(!school?.name||!school.country) return {status:'missing_identity'};
 const byCode=school.code?annexes.entries.filter(e=>e.code===school.code):[];
 // Source contradicts itself for 006880: country selection cannot resolve it.
 if(new Set(byCode.map(e=>e.country)).size>1)return {status:'source_conflict'};
 const exact=annexes.entries.filter(e=>e.name===school.name&&e.country===school.country&&(e.code===null||e.code===school.code));
 if(!exact.length)return {status:byCode.length?'identity_conflict':school.code?'unlisted':'missing_identity'};
 if(!ib.examYear||!ib.examSession||ib.examSession==='unknown')return {status:'missing_session'};
 if(!ib.programme||ib.programme==='unknown')return {status:'missing_programme'};
 const programme=exact.filter(e=>e.programmes.includes(ib.programme!));
 if(!programme.length)return {status:'programme_not_covered'};
 const index=(year:number,session:string)=>year*2+(session==='november'?1:0);
 const entry=programme.find(e=>index(ib.examYear!,ib.examSession!)>=index(e.effective.year,e.effective.session));
 return entry?{status:'applicable',entry}:{status:'not_yet_effective'};
}
export function deriveIbFacts(input:IbProfile):Record<string,string|number|boolean> {
 const parsed=IbProfileSchema.safeParse(input); if(!parsed.success)return {ib_evidence:'invalid'};
 const ib=parsed.data; const raw:Record<string,string|number|boolean|undefined>={
 ib_evidence:ib.version===1?'v1':'legacy',ib_full_diploma:ib.fullDiploma,ib_document_status:((ib.documentStatus==='awarded'||ib.documentStatus==='official_results')&&!ib.fullDiploma)?'unknown':ib.documentStatus,
 ib_exam_year:ib.examYear,ib_exam_session:ib.examSession,ib_school_years:ib.schoolYears,ib_schooling:ib.schooling,ib_total_points:ib.totalPoints,
 ib_annex_status:ibAnnex(ib).status,
 };
 const subjects=ib.subjects;
 if(subjects){
 const entries=subjects.map(s=>ibEntry(s.subjectId));
 const levelsKnown=subjects.every(s=>s.level!=='unknown');
 const gradesKnown=subjects.every(s=>s.grade!==null);
 const languageIdentity=(s:typeof subjects[number])=>s.subjectId==='german_b'?'german':s.language?.trim().toLowerCase() === 'unknown' ? undefined : s.language?.trim().toLowerCase();
 const identityKeys=subjects.map((s,i)=>entries[i]?.kind==='language'||entries[i]?.course==='ab_initio'?languageIdentity(s):entries[i]?.kind==='math'?'mathematics':entries[i]?.id==='general_chemistry'||entries[i]?.id==='applied_chemistry'?'chemistry':entries[i]?.id);
 raw.ib_subject_count=subjects.length;
 raw.ib_independent_subjects=subjects.every(s=>s.independence==='independent')&&identityKeys.every(Boolean)?new Set(identityKeys).size===subjects.length:undefined;
 raw.ib_continuity=subjects.every(s=>s.continuity==='two_years')?true:subjects.some(s=>s.continuity==='not_two_years')?false:undefined;
 raw.ib_all_subjects_recognized=entries.every(e=>e&&e.kind!=='unknown');
 if(levelsKnown){raw.ib_hl_count=subjects.filter(s=>s.level==='HL').length;
 raw.ib_has_2025_eligible_hl=subjects.some((s,i)=>s.level==='HL'&&['language','math','science'].includes(entries[i]?.kind??''));
 raw.ib_has_pre2025_eligible_hl=subjects.some((s,i)=>s.level==='HL'&&['math','science'].includes(entries[i]?.kind??''));}
 if(gradesKnown&&subjects.length){raw.ib_min_subject_grade=Math.min(...subjects.map(s=>s.grade!));raw.ib_grade3_count=subjects.filter(s=>s.grade===3).length;
 const threes=subjects.filter(s=>s.grade===3);if(threes.length===1&&levelsKnown){const low=threes[0]; const compensators=subjects.filter(s=>s!==low&&(low.level==='SL'||s.level==='HL'));raw.ib_compensation_max_grade=compensators.length?Math.max(...compensators.map(s=>s.grade!)):0;}}
 raw.ib_language_count=entries.filter(e=>e?.kind==='language').length;
 const continued=subjects.some((s,i)=>entries[i]?.kind==='language'&&s.continuedForeign==='yes'&&(entries[i]?.course==='A'||(entries[i]?.course==='B'&&s.level==='HL')));
 raw.ib_has_continued_foreign=continued?true:subjects.filter((s,i)=>entries[i]?.kind==='language').every(s=>s.continuedForeign==='yes'||s.continuedForeign==='no')?false:undefined;
 raw.ib_has_social_science=entries.some(e=>e?.kind==='social');raw.ib_has_natural_science=entries.some(e=>e?.kind==='science');
 const math=subjects.filter((s,i)=>entries[i]?.kind==='math');
 if(math.length===1){const row=math[0],course=ibEntry(row.subjectId)!.course; const conflict=(ib.mathLevel!==null&&row.level!=='unknown'&&ib.mathLevel!==row.level)||(ib.mathCourse!==null&&ib.mathCourse!==course);
 raw.ib_math_conflict=conflict;
 if(!conflict&&row.level!=='unknown'){raw.ib_math_level=row.level;raw.ib_math_course=course;}}
 else raw.ib_math_conflict=math.length>1;
 }
 return Object.fromEntries(Object.entries(raw).filter((entry):entry is [string,string|number|boolean]=>entry[1]!==undefined));
}
export const IB_FACT_LABELS:Record<string,string>={
 ib_evidence:'versioned subject identity and evidence',ib_document_status:'awarded Diploma / official IBO results confirming the Diploma',
 ib_exam_year:'examination year',ib_exam_session:'examination session (May or November)',ib_school_years:'actual ascending full-time school years',ib_schooling:'ascending full-time schooling',
 ib_subject_count:'six examination subjects',ib_independent_subjects:'independent subject/language identities',ib_continuity:'two-year subject continuity',ib_all_subjects_recognized:'eligible exact subject identities',
 ib_hl_count:'Higher Level subject count',ib_has_2025_eligible_hl:'eligible language/math/science HL',ib_has_pre2025_eligible_hl:'mathematics or Biology/Chemistry/Physics HL through 2024',
 ib_language_count:'two eligible Language A/B courses',ib_has_continued_foreign:'continued foreign language context (Language A SL/HL or Language B HL)',ib_has_social_science:'required social science',ib_has_natural_science:'required Biology/Chemistry/Physics science',
 ib_math_level:'actual mathematics row level',ib_math_course:'actual mathematics course / conflicting old summary',ib_math_conflict:'conflicting mathematics evidence',
 ib_min_subject_grade:'minimum subject grade',ib_grade3_count:'number of grade 3 subjects',ib_compensation_max_grade:'different same/higher-level compensation grade',ib_total_points:'total Diploma points',
 ib_annex_status:'exact school identity, programme and effective examination session',intake_index:'target intake applicability',target_field:'classified target subject scope',
};
