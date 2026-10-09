// Internal service shell. Credentials are checked by the worker route before
// entering here; context never leaves this module except bounded safe candidates.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { getPlanningSettings,getPlanningJobContext,listRuleVersions,listActiveCourseTaskDefinitions,getApplicationOfferingCatalogue,finishPlanningResearch,listTaskProposals,retireMissingPlanningProposals } from "@/lib/db/queries";
import { profileFromAnswers } from "@/lib/tasks/profile";
import { generateGlobalTasks,generateProcessTasks,generateCourseTasks } from "@/lib/tasks/generate";
import { evaluateAssessment } from "@/lib/rules/assessment";
import { currentAssessmentContext } from "@/lib/rules/current";
import { resolveOfferingProcess } from "@/lib/tasks/offering-process";
import { todayIsoBerlin } from "@/lib/tasks/dates";
import { readResearch,ResearchSeedSchema } from "@/lib/courses/research";
import { researchCourse,COURSE_EXTRACTION_MODEL } from "@/lib/ai/research-course";
import { requireFreePlannerModel } from "@/lib/ai/planner-catalog";
import { planPreparation } from "@/lib/ai/planner";
import { proposalsFromGeneratedTasks,proposalsFromOfferingPlan,proposalsFromOfferingRequirements,proposalsForWithdrawnApprovedActions } from "./proposals";
import { runPlanningJobs,type PlanningJob } from "./jobs";
import type { ProposalCandidate } from "./proposals";

function orderedCatalogue(candidates:ProposalCandidate[]):ProposalCandidate[]{
 return [...candidates].sort((a,b)=>a.semantic_action_key<b.semantic_action_key?-1:a.semantic_action_key>b.semantic_action_key?1:0);
}

export async function executePlanningBatch(db:SupabaseClient<Database>){
 const settings=await getPlanningSettings(db);
 const plan=async(job:PlanningJob)=>{
  const {profile:saved,application}=await getPlanningJobContext(db,job);
  const profile=profileFromAnswers(saved).profile;
  if(!application){
   const assessment=profile?evaluateAssessment(profile,await listRuleVersions(db),currentAssessmentContext()):null;
   const proposals=proposalsFromGeneratedTasks([...generateGlobalTasks(assessment?.result??null),...generateProcessTasks(assessment?.process)]);
   return planPreparation(settings.planner_model,orderedCatalogue(proposals),job.cursor);
  }
  const course=application.courses;
  if(!course)throw Object.assign(new Error("stale_context"),{code:"stale_context"});
  if(job.event==="verified"){
   const catalogue=await getApplicationOfferingCatalogue(db,course.id,application.offering_id);
   const offering=resolveOfferingProcess({...catalogue,courseId:course.id,selection:{offering_id:application.offering_id,applicant_context:application.offering_applicant_context}});
   const latest=[...catalogue.versions].sort((a,b)=>b.version-a.version)[0];
   // An unresolved applicability condition may stop the pure resolver before
   // assigning its version. Still consume this exact committed event safely:
   // no authoritative candidates, and prior actions receive recheck updates.
   if(latest?.id!==job.source_version_id)throw Object.assign(new Error("stale_context"),{code:"stale_context"});
   const candidates=[...proposalsFromOfferingPlan(application.id,application.status,offering,todayIsoBerlin()),...proposalsFromOfferingRequirements(application.id,application.status,offering)];
   const prior=await listTaskProposals(db,job.user_id);
   candidates.push(...proposalsForWithdrawnApprovedActions(prior,candidates.map(c=>c.semantic_action_key),application.id,application.offering_id));
   const ordered=orderedCatalogue(candidates);
   const complete=job.cursor+100>=ordered.length;
   return {candidates:ordered.slice(job.cursor,job.cursor+100),nextCursor:Math.min(ordered.length,job.cursor+100),complete,
     ...(complete?{completedCatalogueKeys:ordered.map(candidate=>candidate.semantic_action_key)}:{})};
  }
  const definitions=await listActiveCourseTaskDefinitions(db,course.id);
  const generated=generateCourseTasks([{id:application.id,status:application.status,course:{...course,task_definitions:definitions}}],todayIsoBerlin(),profile?.intake);
  const proposals=proposalsFromGeneratedTasks(generated);
  if(!proposals.length&&application.status==="planning")proposals.push({semantic_action_key:`app:${application.id}:prepare:requirements`,stage:"preliminary",title:"Prepare to verify this programme's application requirements",description:"Review the official programme page and list questions about the applicable intake, documents and application route.",reason:"Optional preparation while source research awaits review. No admission decision or official requirement is implied.",due_date:null,verbatim_due:null,evidence:[],source_version_id:null,legacy_task_key:null});
  return planPreparation(settings.planner_model,orderedCatalogue(proposals),job.cursor);
 };
 const research=async(job:PlanningJob)=>{
  const {application}=await getPlanningJobContext(db,job);
  const course=application?.courses;
  if(!course||course.review_status!=="pending"||!job.lease_owner)throw Object.assign(new Error("stale_context"),{code:"stale_context"});
  const previous=readResearch(course.field_extraction);
  const seed=ResearchSeedSchema.parse({name:course.name,university:course.university_name,url:course.source_url,text:previous?.paste??""});
  // Research uses the existing free extraction workflow; no paid fallback.
  await requireFreePlannerModel(COURSE_EXTRACTION_MODEL);
  const draft=await researchCourse(seed);
  await finishPlanningResearch(db,job.id,job.lease_owner,course.field_extraction,draft);
 };
 const finalize=async(job:PlanningJob,worker:string,keys:string[])=>{
  await retireMissingPlanningProposals(db,job.id,worker,job.input_fingerprint,keys);
 };
 return runPlanningJobs(db,{plan,research,finalize});
}
