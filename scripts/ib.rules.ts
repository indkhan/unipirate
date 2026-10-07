// Reviewed candidates only; seed preserves drafts. No runtime bootstrap import.
import { type EngineRule } from '../lib/engine/evaluate';
import { IB_SOURCE, IB_HISTORICAL_SOURCE, IB_GUIDANCE } from '../lib/engine/ib';
const base:EngineRule['conditions']={curriculum:'ib',target_degree:'bachelor',ib_evidence:'v1',ib_document_status:{op:'in',value:['awarded','official_results']},ib_exam_session:{op:'in',value:['may','november']},ib_school_years:{op:'gte',value:12},ib_schooling:'ascending_full_time',ib_subject_count:6,ib_independent_subjects:true,ib_continuity:true,ib_all_subjects_recognized:true,ib_hl_count:{op:'gte',value:3},ib_language_count:{op:'gte',value:2},ib_has_continued_foreign:true,ib_has_social_science:true,ib_has_natural_science:true,ib_math_conflict:false,ib_total_points:{op:'gte',value:24},intake_index:{op:'gte',value:4051}};
// Trade-off: automated intake coverage begins with this checker's 2025 horizon,
// not a claimed KMK effective intake. Older intakes require separate review.
const grades:{id:string;conditions:EngineRule['conditions'];quote:string}[]=[
 {id:'ordinary-grades',conditions:{ib_min_subject_grade:{op:'gte',value:4}},quote:'Die geforderten sechs Fächer müssen mindestens mit der IB-Note 4 benotet sein.'},
 {id:'compensated-grade3',conditions:{ib_min_subject_grade:3,ib_grade3_count:1,ib_compensation_max_grade:{op:'gte',value:5}},quote:'Sofern in nur einem Fach die IB-Note 3 vorliegt, kann diese ausgeglichen werden, wenn in einem weiteren Fach auf mindestens demselben Anspruchsniveau mindestens die IB-Note 5 und insgesamt mindestens 24 Punkte erzielt worden sind.'},
];
const eras:{id:string;conditions:EngineRule['conditions'];source:string}[]=[
 {id:'2025',conditions:{ib_exam_year:{op:'gte',value:2025},ib_has_2025_eligible_hl:true},source:IB_SOURCE},
 {id:'2021-2024',conditions:{ib_exam_year:{op:'in',value:[2021,2022,2023,2024]},ib_has_pre2025_eligible_hl:true},source:IB_HISTORICAL_SOURCE},
 {id:'through2020',conditions:{ib_exam_year:{op:'in',value:[2013,2014,2015,2016,2017,2018,2019,2020]},ib_has_pre2025_eligible_hl:true},source:IB_HISTORICAL_SOURCE},
];
const routes:{id:string;conditions:EngineRule['conditions'];path:'direct'|'subject_restricted';legacy?:boolean;note:string}[]=[
 {id:'math-hl',conditions:{ib_math_course:{op:'in',value:['AA','AI']},ib_math_level:'HL'},path:'direct',note:'Ordinary general university access with Mathematics AA/AI HL; programme admission remains with the university.'},
 {id:'math-sl-annex',conditions:{ib_math_course:{op:'in',value:['AA','AI']},ib_math_level:'SL',ib_annex_status:'applicable'},path:'direct',note:'All ordinary prerequisites and the exact current annex school/programme/effective examination session are established. The annex changes only mathematics scope.'},
 {id:'math-sl-subject-scope',conditions:{ib_math_course:{op:'in',value:['AA','AI']},ib_math_level:'SL',ib_annex_status:{op:'in',value:['unlisted','missing_identity','not_yet_effective','programme_not_covered']},target_field:{op:'in',value:['arts','social_science','business','economics','finance','law','humanities']}},path:'subject_restricted',note:'Subject-restricted university access outside mathematics, natural sciences and technical fields. Medicine/pharmacy and unclassified targets require scope review.'},
 {id:'legacy-mathematics',conditions:{ib_math_course:'legacy',ib_math_level:{op:'in',value:['HL','SL']}},path:'direct',legacy:true,note:'Mathematics SL/HL through examination 2020 uses the historical mathematics requirement, with mathematics or Biology/Chemistry/Physics HL and all other ordinary prerequisites.'},
];
export const ibCandidates = eras.flatMap(era=>grades.flatMap(grade=>routes.filter(route=>!!route.legacy===(era.id==='through2020')).map(route=>({
 id:'ib-reviewed-'+era.id+'-'+route.id+'-'+grade.id,country:null,status:'draft' as const,
 conditions:{...base,...era.conditions,...grade.conditions,...route.conditions},outcomes:{path:route.path,note:route.note},source_url:route.id==='math-sl-annex'?IB_SOURCE:era.source,source_quote:grade.quote,last_verified_at:'2026-10-07T00:00:00Z',publication_metadata:null,
 source_checked_date:'2026-10-07',annex_source_url:IB_SOURCE,annex_version:'kmk-2023/annex1-2026-03-26/annex2-2024-11-19',effective_examination_scope:era.id,
})))) satisfies (EngineRule & {country:null})[];
export const ibDocumentCandidates = ['not_awarded','certificate','unknown'].map(status=>({
 id:'ib-reviewed-document-'+status,country:null,status:'draft' as const,conditions:{curriculum:'ib',target_degree:'bachelor',ib_evidence:'v1',ib_document_status:status,ib_exam_year:{op:'gte' as const,value:1990}},
 outcomes:{path:'unknown' as const,note:status==='certificate'?'An IB Certificate is not an IB Diploma. Confirm any other qualification or alternative pathway with the recognition authority.':status==='not_awarded'?'The Diploma has not been awarded. Official IBO results confirming award differ from a physical paper still pending. Confirm any alternative qualification/pathway.':'Cannot establish Diploma award or official IBO results. Confirm document status and the applicable recognition pathway.'},
 source_url:IB_GUIDANCE,source_quote:'German universities do not accept a so-called IB Certificate.',last_verified_at:'2026-10-07T00:00:00Z',publication_metadata:null,
})) satisfies (EngineRule & {country:null})[];
