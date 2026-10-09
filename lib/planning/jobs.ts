// Service worker shell. All database I/O lives in query helpers; no profiles are logged.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { leasePlanningJobs, finishPlanningJob, saveTaskProposals, refreshPlanningJob, advancePlanningJob } from "@/lib/db/queries";
import { ProposalCandidateSchema, type ProposalCandidate } from "./proposals";
export const PlanningJobSchema = z.object({
 id:z.string().uuid(),user_id:z.string().uuid(),application_id:z.string().uuid().nullable(),course_id:z.string().uuid().nullable(),
 event:z.enum(["research","preliminary","verified"]),input_fingerprint:z.string().regex(/^[0-9a-f]{64}$/),source_version_id:z.string().uuid().nullable(),
 state:z.enum(["queued","running","succeeded","failed"]),attempts:z.number().int().min(0).max(3),lease_owner:z.string().uuid().nullable(),lease_until:z.string().nullable(),
 cursor:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0),
}).passthrough();
export type PlanningJob=z.infer<typeof PlanningJobSchema>;
const codes = ["provider_unavailable","quota","timeout","invalid_output","stale_context","persistence_failed"] as const;
export type PlanningFailureCode=typeof codes[number];
export function planningFailureCode(error:unknown):PlanningFailureCode {
 if (error && typeof error==="object") {
   const record=error as {code?:unknown;message?:unknown;name?:unknown};
   if (typeof record.code==="string" && (codes as readonly string[]).includes(record.code)) return record.code as PlanningFailureCode;
   if (record.message==="stale_context") return "stale_context";
   if (record.name==="AbortError" || record.name==="TimeoutError") return "timeout";
   if (error instanceof z.ZodError) return "invalid_output";
 }
 return "provider_unavailable";
}
export async function runPlanningJobs(db:SupabaseClient<Database>, dependencies:{
 plan:(job:PlanningJob)=>Promise<{candidates:ProposalCandidate[];nextCursor:number;complete:boolean}>;
 research:(job:PlanningJob)=>Promise<void>;
}, limit=1) {
 const worker=randomUUID();
 const jobs=z.array(PlanningJobSchema).parse(await leasePlanningJobs(db,worker,limit));
 const result:{id:string;status:"succeeded"|"retry"|"lease_lost"}[]=[];
 for (const job of jobs) {
   try {
     if (job.event==="research") await dependencies.research(job);
     else {
       const batch=z.object({candidates:z.array(ProposalCandidateSchema).max(100),nextCursor:z.number().int().min(job.cursor).max(Number.MAX_SAFE_INTEGER),complete:z.boolean()}).strict()
         .refine(value=>value.complete||value.nextCursor>job.cursor,"Incomplete batches must make progress")
         .parse(await dependencies.plan(job));
       // A crash before the checkpoint safely replays this idempotent batch.
       // A committed checkpoint resumes at the next cursor on a fresh lease.
       await saveTaskProposals(db,job.id,worker,job.input_fingerprint,batch.candidates);
       const advanced=await advancePlanningJob(db,job.id,worker,job.cursor,batch.nextCursor,batch.complete);
       result.push({id:job.id,status:advanced?(batch.complete?"succeeded":"retry"):"lease_lost"});
       continue;
     }
     const finished=await finishPlanningJob(db,job.id,worker,true,null);
     result.push({id:job.id,status:finished?"succeeded":"lease_lost"});
   } catch (error) {
     const code=planningFailureCode(error);
     const finished=code==="stale_context" ? await refreshPlanningJob(db,job.id,worker) : await finishPlanningJob(db,job.id,worker,false,code);
     result.push({id:job.id,status:finished?"retry":"lease_lost"});
   }
 }
 return result;
}
