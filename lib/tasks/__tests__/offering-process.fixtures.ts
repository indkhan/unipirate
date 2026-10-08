import type { OfferingVersion, CourseOffering } from "@/lib/courses/offerings";
export const uuid = (n: number) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
export const created_at = "2026-10-08T00:00:00Z";
export const group = "Synthetic applicant group";
export const programme = {id: uuid(1), legacy_course_id: uuid(2), name: "Synthetic programme", university_name: "Synthetic university", degree: null, source_url: "https://example.invalid/course", created_at};
export const offering: CourseOffering & {id:string;created_at:string} = {id:uuid(3),programme_id:programme.id,intake_term:"winter",intake_year:2027,applicant_group:group,applicability:{},created_at};
export const selection = {offering_id:offering.id, applicant_context:{applicant_group:group,confirmed:true as const}};
export function fact(key: string, kind: OfferingVersion["facts"][number]["kind"], verbatim: string, changes: Partial<OfferingVersion["facts"][number]> = {}): OfferingVersion["facts"][number] {
 return {key,kind,status:"verified",verbatim,applicability:group,evidence:[{source_url:"https://example.invalid/source?year=2027#proof",source_quote:"Synthetic evidence: "+verbatim,retrieved_at:"2026-10-07T00:00:00Z",last_verified_at:created_at,verified_by:uuid(9),source_hash:null}],route:null,deadline_kind:null,date:null,time:null,timezone:null,...changes};
}
export function version(route: "direct"|"uni_assist"|"vpd_then_university"|"unresolved" = "vpd_then_university", facts: OfferingVersion["facts"] = []) {
 return {id:uuid(4),created_at,offering_id:offering.id,version:1,review_status:"verified" as const,reviewed_at:created_at,reviewed_by:uuid(9),facts:[fact("route","route","Synthetic route: "+route,route === "unresolved" ? {route,status:"unresolved",verbatim:null,evidence:[]} : {route}),...facts]};
}
export const stages = [fact("process.uni_assist.portal","description","https://example.invalid/assist"),fact("process.university.portal","description","https://example.invalid/university"),fact("process.uni_assist.closing","deadline","Synthetic assist closing 15 July 2027",{deadline_kind:"application_closing",date:"2027-07-15",time:"12:00:00"}),fact("process.university.closing","deadline","Synthetic university closing 1 August 2027",{deadline_kind:"application_closing",date:"2027-08-01"}),fact("process.vpd.preparation","deadline","Synthetic preparation target 1 June 2027",{deadline_kind:"vpd_preparation_target",date:"2027-06-01"})];
export const input = (route: Parameters<typeof version>[0] = "vpd_then_university") => ({courseId:uuid(2),programme,selection,offerings:[offering],versions:[version(route,stages)]});
