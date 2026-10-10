import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
const queries=vi.hoisted(()=>({leasePlanningJobs:vi.fn(),finishPlanningJob:vi.fn(),saveTaskProposals:vi.fn(),refreshPlanningJob:vi.fn(),advancePlanningJob:vi.fn()}));
vi.mock("@/lib/db/queries",()=>queries);
import { planningFailureCode,runPlanningJobs } from "../jobs";
const db={} as SupabaseClient<Database>;
const candidate={semantic_action_key:"prepare:documents",stage:"preliminary" as const,title:"Review document availability",description:null,reason:"Optional preparation.",due_date:null,verbatim_due:null,evidence:[],source_version_id:null,legacy_task_key:null};
const job=(cursor=0)=>({id:randomUUID(),user_id:randomUUID(),application_id:null,course_id:null,event:"preliminary",input_fingerprint:"a".repeat(64),source_version_id:null,state:"running",attempts:1,lease_owner:randomUUID(),lease_until:"2099-01-01T00:00:00Z",cursor});
beforeEach(()=>{vi.resetAllMocks();queries.finishPlanningJob.mockResolvedValue(true);queries.advancePlanningJob.mockResolvedValue(true);queries.saveTaskProposals.mockResolvedValue([]);});
it("saves the complete batch before retiring missing actions and checkpointing",async()=>{
 const saved=job(6);queries.leasePlanningJobs.mockResolvedValue([saved]);const finalize=vi.fn();
 expect(await runPlanningJobs(db,{plan:async()=>({candidates:[candidate],nextCursor:7,complete:true,completedCatalogueKeys:[candidate.semantic_action_key]}),research:vi.fn(),finalize})).toEqual([{id:saved.id,status:"succeeded"}]);
 expect(finalize).toHaveBeenCalledWith(expect.objectContaining({id:saved.id,input_fingerprint:saved.input_fingerprint}),expect.any(String),[candidate.semantic_action_key]);
 expect(queries.saveTaskProposals.mock.invocationCallOrder[0]).toBeLessThan(finalize.mock.invocationCallOrder[0]);
 expect(finalize.mock.invocationCallOrder[0]).toBeLessThan(queries.advancePlanningJob.mock.invocationCallOrder[0]);
});
it("never retires missing actions when saving the final batch fails",async()=>{
 const saved=job();queries.leasePlanningJobs.mockResolvedValue([saved]);queries.saveTaskProposals.mockRejectedValue(new Error("persistence failed"));const finalize=vi.fn();
 await runPlanningJobs(db,{plan:async()=>({candidates:[candidate],nextCursor:1,complete:true,completedCatalogueKeys:[candidate.semantic_action_key]}),research:vi.fn(),finalize});
 expect(finalize).not.toHaveBeenCalled();expect(queries.advancePlanningJob).not.toHaveBeenCalled();
});
it("does not retire incomplete catalogues and retries without a checkpoint if finalization fails",async()=>{
 const saved=job();queries.leasePlanningJobs.mockResolvedValue([saved]);const finalize=vi.fn().mockRejectedValue(Object.assign(new Error("stale_context"),{code:"stale_context"}));queries.refreshPlanningJob.mockResolvedValue(true);
 await runPlanningJobs(db,{plan:async()=>({candidates:[candidate],nextCursor:1,complete:false}),research:vi.fn(),finalize});
 expect(finalize).not.toHaveBeenCalled();queries.advancePlanningJob.mockClear();
 await runPlanningJobs(db,{plan:async()=>({candidates:[candidate],nextCursor:1,complete:true,completedCatalogueKeys:[candidate.semantic_action_key]}),research:vi.fn(),finalize});
 expect(finalize).toHaveBeenCalledOnce();expect(queries.advancePlanningJob).not.toHaveBeenCalled();expect(queries.refreshPlanningJob).toHaveBeenCalled();
});
it.each([{keys:[]},{keys:["wrong"]},{keys:[candidate.semantic_action_key,candidate.semantic_action_key]},{keys:Array.from({length:10001},(_,index)=>`action:${index}`)}])("rejects inconsistent or oversized final catalogue keys before persistence",async ({keys})=>{
 const saved=job();queries.leasePlanningJobs.mockResolvedValue([saved]);const finalize=vi.fn();
 await runPlanningJobs(db,{plan:async()=>({candidates:[candidate],nextCursor:1,complete:true,completedCatalogueKeys:keys}),research:vi.fn(),finalize});
 expect(queries.saveTaskProposals).not.toHaveBeenCalled();expect(finalize).not.toHaveBeenCalled();expect(queries.advancePlanningJob).not.toHaveBeenCalled();
 expect(queries.finishPlanningJob).toHaveBeenCalledWith(db,saved.id,expect.any(String),false,"invalid_output");
});
it("persists one bounded batch before atomically checkpointing an incomplete lease",async()=>{
 const saved=job(5);queries.leasePlanningJobs.mockResolvedValue([saved]);
 const plan=vi.fn().mockResolvedValue({candidates:[candidate],nextCursor:6,complete:false});
 expect(await runPlanningJobs(db,{plan,research:vi.fn()})).toEqual([{id:saved.id,status:"retry"}]);
 expect(plan).toHaveBeenCalledWith(expect.objectContaining({cursor:5}));
 expect(queries.saveTaskProposals).toHaveBeenCalledWith(db,saved.id,expect.any(String),saved.input_fingerprint,[candidate]);
 expect(queries.advancePlanningJob).toHaveBeenCalledWith(db,saved.id,expect.any(String),5,6,false);
 expect(queries.saveTaskProposals.mock.invocationCallOrder[0]).toBeLessThan(queries.advancePlanningJob.mock.invocationCallOrder[0]);
 expect(queries.finishPlanningJob).not.toHaveBeenCalled();
});
it("replays an uncheckpointed batch after persistence failure, preserving its cursor",async()=>{
 const saved=job(5);queries.leasePlanningJobs.mockResolvedValue([saved]);
 queries.saveTaskProposals.mockRejectedValueOnce(Object.assign(new Error("private provider body"),{code:"persistence_failed"}));
 const plan=vi.fn().mockResolvedValue({candidates:[candidate],nextCursor:6,complete:false});
 await runPlanningJobs(db,{plan,research:vi.fn()});
 expect(queries.advancePlanningJob).not.toHaveBeenCalled();
 expect(queries.finishPlanningJob).toHaveBeenCalledWith(db,saved.id,expect.any(String),false,"persistence_failed");
 await runPlanningJobs(db,{plan,research:vi.fn()});
 expect(plan.mock.calls.map(([value])=>value.cursor)).toEqual([5,5]);
 expect(queries.advancePlanningJob).toHaveBeenCalledOnce();
});
it("records empty completed batches and reports lost checkpoint leases without claiming success",async()=>{
 const saved=job(6);queries.leasePlanningJobs.mockResolvedValue([saved]);queries.advancePlanningJob.mockResolvedValue(false);
 expect(await runPlanningJobs(db,{plan:async()=>({candidates:[],nextCursor:6,complete:true}),research:vi.fn()})).toEqual([{id:saved.id,status:"lease_lost"}]);
 expect(queries.saveTaskProposals).toHaveBeenCalledWith(db,saved.id,expect.any(String),saved.input_fingerprint,[]);
 expect(queries.advancePlanningJob).toHaveBeenCalledWith(db,saved.id,expect.any(String),6,6,true);
});
it("marks a final persisted batch complete without resetting or replaying its cursor",async()=>{
 const saved=job(6);queries.leasePlanningJobs.mockResolvedValue([saved]);
 expect(await runPlanningJobs(db,{plan:async()=>({candidates:[candidate],nextCursor:7,complete:true}),research:vi.fn()})).toEqual([{id:saved.id,status:"succeeded"}]);
 expect(queries.advancePlanningJob).toHaveBeenCalledWith(db,saved.id,expect.any(String),6,7,true);
 expect(queries.finishPlanningJob).not.toHaveBeenCalled();
});
it("keeps research completion separate from proposal cursor checkpoints",async()=>{
 const saved={...job(),event:"research"};queries.leasePlanningJobs.mockResolvedValue([saved]);const research=vi.fn();const plan=vi.fn();
 expect(await runPlanningJobs(db,{plan,research})).toEqual([{id:saved.id,status:"succeeded"}]);
 expect(research).toHaveBeenCalledWith(expect.objectContaining({id:saved.id}));expect(plan).not.toHaveBeenCalled();
 expect(queries.advancePlanningJob).not.toHaveBeenCalled();expect(queries.saveTaskProposals).not.toHaveBeenCalled();
 expect(queries.finishPlanningJob).toHaveBeenCalledWith(db,saved.id,expect.any(String),true,null);
});
it.each([{candidates:[candidate],nextCursor:4,complete:false},{candidates:[candidate],nextCursor:5,complete:false},{candidates:Array.from({length:101},()=>candidate),nextCursor:106,complete:true}])("rejects invalid progress/batch bounds before writes",async output=>{
 const saved=job(5);queries.leasePlanningJobs.mockResolvedValue([saved]);
 await runPlanningJobs(db,{plan:async()=>output,research:vi.fn()});
 expect(queries.saveTaskProposals).not.toHaveBeenCalled();expect(queries.advancePlanningJob).not.toHaveBeenCalled();
 expect(queries.finishPlanningJob).toHaveBeenCalledWith(db,saved.id,expect.any(String),false,"invalid_output");
});
describe("worker failure privacy",()=>{
 it("persists bounded safe codes instead of provider bodies or private inputs",()=>{
  expect(planningFailureCode(new Error("SECRET profile provider quota"))).toBe("provider_unavailable");
  expect(planningFailureCode({code:"quota"})).toBe("quota");
  expect(planningFailureCode({message:"stale_context"})).toBe("stale_context");
 });
});
