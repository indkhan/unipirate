// Real durable research persistence; explicit disposable-loopback credentials only.
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {describe,expect,it} from "vitest";
import {buildResearchDraft,ResearchDraftSchema} from "@/lib/courses/research";
import type {Database,Json} from "../database.types";
import {planningLocalConfig} from "./planning-local-config";
const config=planningLocalConfig(process.env.PLANNING_LOCAL_API,process.env.PLANNING_LOCAL_PUBLIC_KEY,process.env.PLANNING_LOCAL_SERVICE_KEY);
function must<T extends {data:unknown;error:{message:string}|null}>(result:T):NonNullable<T["data"]>{expect(result.error?.message??null).toBeNull();expect(result.data).not.toBeNull();return result.data as NonNullable<T["data"]>;}
describe.skipIf(!config.enabled)("durable research (real local lease and metadata CAS)",()=>{
 it("persists before dispatch, retains original input, rejects unauthorized/stale saves and recovers expired leases without publication",async()=>{
  const options={auth:{persistSession:false,autoRefreshToken:false}},service=createClient<Database>(config.api!,config.serviceKey!,options),owner=createClient<Database>(config.api!,config.publicKey!,options),admin=createClient<Database>(config.api!,config.publicKey!,options);
  const users:string[]=[];let courseId:string|null=null;
  const settings=must(await service.from("planning_settings").select("*").eq("id",true).single());
  try{
   for(const [client,role] of [[owner,"student"],[admin,"admin"]] as const){const email=`research-contract-${randomUUID()}@example.invalid`,password=randomUUID()+"Aa1!";users.push(must(await service.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{role}})).user!.id);expect((await client.auth.signInWithPassword({email,password})).error).toBeNull();}
   const url=`https://www.daad.de/SYNTHETIC-research-${randomUUID()}?literal=1#original`,paste="Original pasted university instructions.\nKeep punctuation, spaces  and exact URL. "+"Synthetic text. ".repeat(20),name="Synthetic research persistence",university="Synthetic university";
   const initial=buildResearchDraft({url,name,university,text:paste},[],{offerings:[]},[]);
   const metadata={research:initial,reviewer_note:"Shared pending draft metadata"} as unknown as Json;
   const course=must(await service.from("courses").insert({imported_by:users[0],source_url:url,normalized_url:url,name,university_name:university,review_status:"pending",field_extraction:metadata}).select("*").single());courseId=course.id;
   const app=must(await owner.from("applications").insert({user_id:users[0],course_id:course.id,status:"planning"}).select("*").single());
   const job=must(await owner.rpc("enqueue_planning_job",{p_event:"research",p_application_id:app.id}));
   expect(job).toMatchObject({event:"research",state:"queued",attempts:0,lease_owner:null});
   expect(must(await owner.rpc("enqueue_planning_job",{p_event:"research",p_application_id:app.id})).id).toBe(job.id);
   const draft=ResearchDraftSchema.parse({...initial,issues:["Synthetic research capture; no provider inference was performed."]});
   const worker=randomUUID(),args={p_job_id:job.id,p_worker:worker,p_expected_metadata:metadata,p_expected_sql_null:false,p_draft:draft as unknown as Json};
   expect((await service.rpc("save_planning_research",args)).error?.message).toContain("Active research lease");
   // Prioritize this isolated fixture without changing any other durable jobs.
   expect((await service.from("planning_jobs").update({created_at:"2000-01-01T00:00:00Z"}).eq("id",job.id)).error).toBeNull();
   expect(must(await service.rpc("lease_planning_jobs",{p_worker:worker,p_limit:1}))[0]).toMatchObject({id:job.id,state:"running",attempts:1});
   for(const client of [owner,admin])expect((await client.rpc("save_planning_research",args)).error).not.toBeNull();
   expect((await service.rpc("save_planning_research",{...args,p_worker:randomUUID()})).error?.message).toContain("Active research lease");
   expect((await service.rpc("save_planning_research",{...args,p_draft:{...draft,format:"invalid"} as unknown as Json})).error?.message).toContain("Invalid research draft");
   expect((await service.rpc("save_planning_research",{...args,p_draft:{...draft,identity:{...draft.identity,source_url:url+"changed"}} as unknown as Json})).error?.message).toContain("Invalid research draft");
   expect((await service.rpc("save_planning_research",{...args,p_draft:{...draft,paste:paste.trim()} as unknown as Json})).error?.message).toContain("Original paste must be retained");
   const concurrent={...metadata as object,reviewer_note:"Concurrent real reviewer metadata"} as Json;
   expect((await service.from("courses").update({field_extraction:concurrent}).eq("id",course.id)).error).toBeNull();
   expect((await service.rpc("save_planning_research",args)).error?.message).toContain("stale_context");
   expect(must(await service.from("courses").select("field_extraction").eq("id",course.id).single()).field_extraction).toEqual(concurrent);
   expect((await service.from("planning_jobs").update({lease_until:"2000-01-01T00:00:00Z"}).eq("id",job.id)).error).toBeNull();
   expect((await service.rpc("save_planning_research",{...args,p_expected_metadata:concurrent})).error?.message).toContain("Active research lease");
   const replacement=randomUUID();expect(must(await service.rpc("lease_planning_jobs",{p_worker:replacement,p_limit:1}))[0]).toMatchObject({id:job.id,attempts:2,lease_owner:replacement});
   expect(must(await service.rpc("finish_planning_job",{p_id:job.id,p_worker:worker,p_success:true}))).toBe(false);
   expect(must(await service.rpc("save_planning_research",{...args,p_worker:replacement,p_expected_metadata:concurrent}))).toBe(true);
   const saved=must(await service.from("courses").select("*").eq("id",course.id).single());
   expect(saved.source_url).toBe(url);expect(saved.review_status).toBe("pending");
   expect(saved.field_extraction).toEqual({...concurrent as object,research:draft});expect(ResearchDraftSchema.parse((saved.field_extraction as {research:unknown}).research).paste).toBe(paste);
   expect(must(await service.rpc("finish_planning_job",{p_id:job.id,p_worker:replacement,p_success:true}))).toBe(true);
   expect(must(await service.from("planning_jobs").select("*").eq("id",job.id).single())).toMatchObject({state:"succeeded",attempts:2,lease_owner:null});
   expect(must(await service.from("planning_jobs").select("id").eq("application_id",app.id).eq("event","verified"))).toHaveLength(0);
   expect(must(await owner.from("task_proposals").select("id").eq("application_id",app.id))).toHaveLength(0);expect(must(await owner.from("tasks").select("id").eq("application_id",app.id))).toHaveLength(0);
   expect(must(await service.from("programmes").select("id").eq("legacy_course_id",course.id))).toHaveLength(0);
   expect(must(await service.from("planning_settings").select("*").eq("id",true).single())).toEqual(settings);
  }finally{for(const id of users)await service.auth.admin.deleteUser(id);if(courseId)await service.from("courses").delete().eq("id",courseId);}
 },20000);
});

