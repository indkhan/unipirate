import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { enqueuePlanningJob, getApplicationWithCourse, getApplicationOfferingCatalogue, type ApplicationWithCourse } from "@/lib/db/queries";
import { resolveOfferingProcess } from "@/lib/tasks/offering-process";
export { listPlanningJobs, retryPlanningJob } from "@/lib/db/queries";
export async function enqueueApplicationPlanning(db:Pick<SupabaseClient<Database>,"from"|"rpc">,application:ApplicationWithCourse){
 if(application.courses?.review_status==="approved"){
  const catalogue=await getApplicationOfferingCatalogue(db,application.course_id,application.offering_id??null);
  const plan=resolveOfferingProcess({...catalogue,courseId:application.course_id,selection:{offering_id:application.offering_id??null,applicant_context:application.offering_applicant_context??null}});
  if(plan.route!=="unresolved"&&plan.version)return enqueuePlanningJob(db,"verified",application.id,plan.version.id);
 }
 return enqueuePlanningJob(db,"preliminary",application.id);
}
/** #58 saves identity/application first, then calls this durable queue contract. */
export async function enqueueResearch(db:Pick<SupabaseClient<Database>,"from"|"rpc">,userId:string,input:unknown){
 const {applicationId,courseId}=z.object({applicationId:z.string().uuid(),courseId:z.string().uuid()}).strict().parse(input);
 const application=await getApplicationWithCourse(db,z.string().uuid().parse(userId),applicationId);
 if(!application||application.course_id!==courseId)throw new Error("Application not found.");
 if(application.courses?.review_status==="approved")return enqueueApplicationPlanning(db,application);
 return enqueuePlanningJob(db,"research",applicationId);
}
