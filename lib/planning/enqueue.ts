import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { enqueuePlanningJob, getApplicationWithCourse } from "@/lib/db/queries";
export { listPlanningJobs, retryPlanningJob } from "@/lib/db/queries";
/** #58 saves identity/application first, then calls this durable queue contract. */
export async function enqueueResearch(db:Pick<SupabaseClient<Database>,"from"|"rpc">,userId:string,input:unknown){
 const {applicationId,courseId}=z.object({applicationId:z.string().uuid(),courseId:z.string().uuid()}).strict().parse(input);
 const application=await getApplicationWithCourse(db,z.string().uuid().parse(userId),applicationId);
 if(!application||application.course_id!==courseId)throw new Error("Application not found.");
 return enqueuePlanningJob(db,"research",applicationId);
}
