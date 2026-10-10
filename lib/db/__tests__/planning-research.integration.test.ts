// Real durable research persistence; explicit disposable-loopback credentials only.
import {randomUUID} from "node:crypto";
import {spawn,execFileSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
import {describe,expect,it} from "vitest";
import {buildResearchDraft,ResearchDraftSchema} from "@/lib/courses/research";
import type {Database,Json} from "../database.types";
import {planningLocalConfig} from "./planning-local-config";
const config=planningLocalConfig(process.env.PLANNING_LOCAL_API,process.env.PLANNING_LOCAL_PUBLIC_KEY,process.env.PLANNING_LOCAL_SERVICE_KEY);
function must<T extends {data:unknown;error:{message:string}|null}>(result:T):NonNullable<T["data"]>{expect(result.error?.message??null).toBeNull();expect(result.data).not.toBeNull();return result.data as NonNullable<T["data"]>;}
// A real psql transaction coordinates the owner retry with the HTTP service writer.
function lockSession(container:string){
 const child=spawn("docker",["exec","-i",container,"psql","-X","-q","-t","-A","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],{stdio:["pipe","pipe","pipe"]});
 let buffer="",stderr="";const waiters=new Map<string,{resolve:()=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 child.stdout.on("data",chunk=>{buffer+=chunk.toString();let newline:number;while((newline=buffer.indexOf("\n"))>=0){const line=buffer.slice(0,newline).trim();buffer=buffer.slice(newline+1);const waiter=waiters.get(line);if(waiter){clearTimeout(waiter.timer);waiters.delete(line);waiter.resolve();}}});
 child.stderr.on("data",chunk=>{stderr+=chunk.toString();});
 const exited=new Promise<{code:number|null;stderr:string}>(resolve=>child.on("close",code=>{for(const waiter of waiters.values()){clearTimeout(waiter.timer);waiter.reject(new Error(stderr));}resolve({code,stderr});}));
 const send=(sql:string,marker:string)=>new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{waiters.delete(marker);reject(new Error("Timed out waiting for real SQL lock coordination"));},8000);waiters.set(marker,{resolve,reject,timer});child.stdin.write(sql+"\nselect '"+marker+"';\n");});
 return {send,exited,write:(sql:string)=>child.stdin.write(sql+"\n"),stop:()=>child.kill()};
}
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
 it("keeps service draft persistence alive when owner retry meets an already-running research lease",async()=>{
  const dbPort=Number(new URL(config.api!).port)+1;
  const container=execFileSync("docker",["ps","--filter",`publish=${dbPort}`,"--format","{{.Names}}"],{encoding:"utf8"}).trim();expect(container.split("\n")).toHaveLength(1);expect(container).not.toBe("");
  const options={auth:{persistSession:false,autoRefreshToken:false}},service=createClient<Database>(config.api!,config.serviceKey!,options),owner=createClient<Database>(config.api!,config.publicKey!,options);
  const email=`research-lock-${randomUUID()}@example.invalid`,password=randomUUID()+"Aa1!";const user=must(await service.auth.admin.createUser({email,password,email_confirm:true})).user!.id;
  const session=lockSession(container);let expiredSession:ReturnType<typeof lockSession>|null=null;let jobSession:ReturnType<typeof lockSession>|null=null;let courseId:string|null=null;
  try{
   expect((await owner.auth.signInWithPassword({email,password})).error).toBeNull();
   const url=`https://www.daad.de/SYNTHETIC-research-lock-${randomUUID()}`,name="Synthetic concurrent research",university="Synthetic university",paste="Exact synthetic original paste. ".repeat(10);
   const draft=buildResearchDraft({url,name,university,text:paste},[],{offerings:[]},[]),metadata={research:draft} as unknown as Json;
   const course=must(await service.from("courses").insert({imported_by:user,source_url:url,normalized_url:url,name,university_name:university,field_extraction:metadata}).select("*").single());courseId=course.id;
   const app=must(await owner.from("applications").insert({user_id:user,course_id:course.id,status:"planning"}).select("id").single());
   const job=must(await owner.rpc("enqueue_planning_job",{p_event:"research",p_application_id:app.id})),worker=randomUUID();
   expect((await service.from("planning_jobs").update({state:"running",lease_owner:worker,lease_until:"2099-01-01T00:00:00Z",attempts:1}).eq("id",job.id)).error).toBeNull();
   await session.send(`begin; select id from public.courses where id='${course.id}' for share;`,"CONTEXT_LOCKED");
   let savingDone=false;const saving=service.rpc("save_planning_research",{p_job_id:job.id,p_worker:worker,p_expected_metadata:metadata,p_expected_sql_null:false,p_draft:draft as unknown as Json}).then(result=>{savingDone=true;return result;});
   // Wait for an observed lock waiter, rather than relying on a scheduling sleep.
   await session.send("select pg_catalog.pg_sleep(0.05);", "SERVICE_STARTED");
   await session.send("do $$begin for attempt in 1..100 loop perform pg_catalog.pg_stat_clear_snapshot();if exists(select 1 from pg_catalog.pg_stat_activity where pid<>pg_catalog.pg_backend_pid() and wait_event_type='Lock' and query like '%save_planning_research%') then return;end if;perform pg_catalog.pg_sleep(0.02);end loop;raise exception 'No research lock waiter observed';end$$;", "WRITER_BLOCKED");
   expect(savingDone).toBe(false);
   await session.send(`select id from public.planning_jobs where id='${job.id}' for update nowait;`,"JOB_LOCK_ORDER_SAFE");
   session.write(`set local role authenticated; select set_config('request.jwt.claims','{"sub":"${user}","role":"authenticated"}',true); select public.retry_planning_job('${job.id}');`);
   const retry=await session.exited;expect(retry.code).not.toBe(0);expect(retry.stderr).toContain("Only a failed saved job can be retried");expect(retry.stderr).not.toContain("deadlock detected");
   expect(must(await saving)).toBe(true);
   expect(must(await service.from("courses").select("field_extraction").eq("id",course.id).single()).field_extraction).toEqual(metadata);
   expiredSession=lockSession(container);
   await expiredSession.send(`begin; select id from public.courses where id='${course.id}' for share;`,"SECOND_CONTEXT_LOCKED");
   const rejectedSave=service.rpc("save_planning_research",{p_job_id:job.id,p_worker:worker,p_expected_metadata:metadata,p_expected_sql_null:false,p_draft:{...draft,issues:["Must not persist after expired lease"]} as unknown as Json}).then(result=>result);
   await expiredSession.send("do $$begin for attempt in 1..100 loop perform pg_catalog.pg_stat_clear_snapshot();if exists(select 1 from pg_catalog.pg_stat_activity where pid<>pg_catalog.pg_backend_pid() and wait_event_type='Lock' and query like '%save_planning_research%') then return;end if;perform pg_catalog.pg_sleep(0.02);end loop;raise exception 'No second research lock waiter observed';end$$;", "SECOND_WRITER_BLOCKED");
   expect((await service.from("planning_jobs").update({lease_until:"2000-01-01T00:00:00Z"}).eq("id",job.id).abortSignal(AbortSignal.timeout(5000))).error).toBeNull();
   expiredSession.write("rollback;\n\\q");await expiredSession.exited;
   expect((await rejectedSave).error?.message).toContain("Active research lease required");
   expect(must(await service.from("courses").select("field_extraction").eq("id",course.id).single()).field_extraction).toEqual(metadata);

   // Holding only the job lock does not change its row and therefore need not trigger an EPQ recheck.
   const expiry=new Date(Date.now()+3000).toISOString();
   expect((await service.from("planning_jobs").update({lease_until:expiry}).eq("id",job.id)).error).toBeNull();
   jobSession=lockSession(container);await jobSession.send(`begin; select id from public.planning_jobs where id='${job.id}' for update;`,"JOB_ONLY_LOCKED");
   const expiredDuringJobWait=service.rpc("save_planning_research",{p_job_id:job.id,p_worker:worker,p_expected_metadata:metadata,p_expected_sql_null:false,p_draft:{...draft,issues:["Must not persist after waiting on job lock"]} as unknown as Json}).then(result=>result);
   await jobSession.send("do $$begin for attempt in 1..100 loop perform pg_catalog.pg_stat_clear_snapshot();if exists(select 1 from pg_catalog.pg_stat_activity where pid<>pg_catalog.pg_backend_pid() and wait_event_type='Lock' and query like '%save_planning_research%') then return;end if;perform pg_catalog.pg_sleep(0.02);end loop;raise exception 'No job lock waiter observed';end$$;", "JOB_WRITER_BLOCKED");
   expect(Date.now()).toBeLessThan(Date.parse(expiry));
   await jobSession.send(`select pg_catalog.pg_sleep(greatest(0,extract(epoch from '${expiry}'::timestamptz-pg_catalog.clock_timestamp()))+0.1);`,"LEASE_CLOCK_EXPIRED");
   jobSession.write("rollback;\n\\q");await jobSession.exited;
   expect((await expiredDuringJobWait).error?.message).toContain("Active research lease required");
   expect(must(await service.from("courses").select("field_extraction").eq("id",course.id).single()).field_extraction).toEqual(metadata);

  }finally{session.stop();expiredSession?.stop();jobSession?.stop();await service.auth.admin.deleteUser(user);if(courseId)await service.from("courses").delete().eq("id",courseId);}
 },20000);

});

