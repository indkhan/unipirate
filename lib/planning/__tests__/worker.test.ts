import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { beforeEach, expect, it, vi } from "vitest";
import type { PlanningBatch, PlanningJob } from "../jobs";
const mocks=vi.hoisted(()=>({getPlanningSettings:vi.fn(),getPlanningJobContext:vi.fn(),listRuleVersions:vi.fn(),listActiveCourseTaskDefinitions:vi.fn(),getApplicationOfferingCatalogue:vi.fn(),finishPlanningResearch:vi.fn(),listTaskProposals:vi.fn(),retireMissingPlanningProposals:vi.fn(),resolveOfferingProcess:vi.fn(),proposalsFromGeneratedTasks:vi.fn(),proposalsFromSharedTemplates:vi.fn(),proposalsFromOfferingPlan:vi.fn(),proposalsFromOfferingRequirements:vi.fn(),proposalsForWithdrawnApprovedActions:vi.fn(),planPreparation:vi.fn(),runPlanningJobs:vi.fn()}));
vi.mock("@/lib/db/queries",()=>mocks);
vi.mock("@/lib/tasks/offering-process",()=>({resolveOfferingProcess:mocks.resolveOfferingProcess}));
vi.mock("@/lib/ai/planner",()=>({planPreparation:mocks.planPreparation}));
vi.mock("../proposals",()=>mocks);
vi.mock("../templates",()=>({proposalsFromSharedTemplates:mocks.proposalsFromSharedTemplates}));
vi.mock("../jobs",()=>({runPlanningJobs:mocks.runPlanningJobs}));
import { executePlanningBatch } from "../worker";
const db={} as SupabaseClient<Database>;
const versionId=randomUUID();
const application={id:randomUUID(),status:"planning",offering_id:randomUUID(),offering_applicant_context:null,courses:{id:randomUUID(),name:"Shared programme",university_name:"University",review_status:"approved",created_at:"2026-01-01T00:00:00Z",source_url:"https://example.com"}};
const candidate=(key:string)=>({semantic_action_key:key,stage:"preliminary" as const,title:"Prepare",description:null,reason:"Preparation only",due_date:null,verbatim_due:null,evidence:[],source_version_id:null,legacy_task_key:null});
const job=(event:PlanningJob["event"]="verified",cursor=0):PlanningJob=>({id:randomUUID(),user_id:randomUUID(),application_id:application.id,course_id:application.courses.id,event,input_fingerprint:"a".repeat(64),source_version_id:versionId,state:"running",attempts:1,lease_owner:randomUUID(),lease_until:"2099-01-01T00:00:00Z",cursor});
type Dependencies={plan:(job:PlanningJob)=>Promise<PlanningBatch>;research:(job:PlanningJob)=>Promise<void>;finalize:(job:PlanningJob,worker:string,keys:string[])=>Promise<void>};
async function dependencies():Promise<Dependencies>{await executePlanningBatch(db);return mocks.runPlanningJobs.mock.calls.at(-1)![1];}
beforeEach(()=>{
 vi.resetAllMocks();mocks.getPlanningSettings.mockResolvedValue({planner_model:"synthetic:free"});mocks.getPlanningJobContext.mockResolvedValue({profile:null,application});
 mocks.getApplicationOfferingCatalogue.mockResolvedValue({versions:[{id:versionId,version:1}]});mocks.resolveOfferingProcess.mockReturnValue({});
 mocks.listTaskProposals.mockResolvedValue([]);mocks.listActiveCourseTaskDefinitions.mockResolvedValue([]);
 mocks.proposalsFromOfferingPlan.mockReturnValue([candidate("z"),candidate("a")]);mocks.proposalsFromOfferingRequirements.mockReturnValue([candidate("m")]);mocks.proposalsForWithdrawnApprovedActions.mockReturnValue([]);
 mocks.proposalsFromGeneratedTasks.mockReturnValue([candidate("z"),candidate("a"),candidate("m")]);mocks.proposalsFromSharedTemplates.mockReturnValue([]);
 mocks.planPreparation.mockImplementation(async(_model,candidates,cursor)=>({candidates:candidates.slice(cursor),nextCursor:candidates.length,complete:true}));
});
it("keeps planning read-only and supplies the full sorted catalogue only on its final page",async()=>{
 const deps=await dependencies();const saved=job("verified",1);const batch=await deps.plan(saved);
 expect(batch.candidates.map(candidate=>candidate.semantic_action_key)).toEqual(["m","z"]);
 expect(batch.completedCatalogueKeys).toEqual(["a","m","z"]);
 expect(mocks.retireMissingPlanningProposals).not.toHaveBeenCalled();
 const activeWorker=randomUUID();await deps.finalize(saved,activeWorker,batch.completedCatalogueKeys!);
 expect(mocks.retireMissingPlanningProposals).toHaveBeenCalledWith(db,saved.id,activeWorker,saved.input_fingerprint,["a","m","z"]);
});
it("never supplies retirement keys for an incomplete verified page",async()=>{
 mocks.proposalsFromOfferingPlan.mockReturnValue(Array.from({length:105},(_,index)=>candidate(`action:${String(104-index).padStart(3,"0")}`)));mocks.proposalsFromOfferingRequirements.mockReturnValue([]);
 const deps=await dependencies();const batch=await deps.plan(job());
 expect(batch.complete).toBe(false);expect(batch.nextCursor).toBe(100);expect(batch.completedCatalogueKeys).toBeUndefined();
 expect(batch.candidates[0].semantic_action_key).toBe("action:000");expect(batch.candidates[99].semantic_action_key).toBe("action:099");
 expect(mocks.retireMissingPlanningProposals).not.toHaveBeenCalled();
});
it.each(["general","course"])("sorts %s candidates before provider planning so retries use stable cursor boundaries",async scope=>{
 if(scope==="general")mocks.getPlanningJobContext.mockResolvedValue({profile:null,application:null});
 const deps=await dependencies();await deps.plan(job("preliminary",1));
 expect(mocks.planPreparation).toHaveBeenCalledWith("synthetic:free",[candidate("a"),candidate("m"),candidate("z")],1);
 expect(mocks.retireMissingPlanningProposals).not.toHaveBeenCalled();
});

it("includes safe shared-template candidates in verified catalogue and retirement identity",async()=>{
 mocks.proposalsFromSharedTemplates.mockReturnValue([candidate("shared-template")]);
 const deps=await dependencies();const batch=await deps.plan(job());
 expect(batch.completedCatalogueKeys).toEqual(["a","m","shared-template","z"]);
 expect(batch.candidates.filter(entry=>entry.semantic_action_key==="shared-template")).toEqual([candidate("shared-template")]);
 expect(mocks.proposalsFromSharedTemplates).toHaveBeenCalledWith(expect.objectContaining({id:application.id,course:expect.objectContaining({task_definitions:[]})}),expect.any(String),undefined);
 expect(mocks.planPreparation).not.toHaveBeenCalled();
});
