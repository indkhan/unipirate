// Current-source retry/status against an explicit disposable local DB; no provider calls.
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {describe,expect,it} from "vitest";
import {buildResearchDraft} from "@/lib/courses/research";
import type {Database,Json} from "../database.types";
import {retryPlanningJob} from "../queries";
import {planningLocalConfig} from "./planning-local-config";
const config=planningLocalConfig(process.env.PLANNING_LOCAL_API,process.env.PLANNING_LOCAL_PUBLIC_KEY,process.env.PLANNING_LOCAL_SERVICE_KEY);
function must<T extends {data:unknown;error:{message:string}|null}>(result:T):NonNullable<T["data"]>{expect(result.error?.message??null).toBeNull();expect(result.data).not.toBeNull();return result.data as NonNullable<T["data"]>;}
describe.skipIf(!config.enabled)("current planning retry/status (real source scope)",()=>{
 it("reuses current committed work, hides obsolete failures and resumes unchanged failed cursor without private exposure",async()=>{
  const options={auth:{persistSession:false,autoRefreshToken:false}},service=createClient<Database>(config.api!,config.serviceKey!,options),owner=createClient<Database>(config.api!,config.publicKey!,options),other=createClient<Database>(config.api!,config.publicKey!,options),admin=createClient<Database>(config.api!,config.publicKey!,options);
  const users:string[]=[];const settings=must(await service.from("planning_settings").select("*").eq("id",true).single());
  try{
   for(const [client,role] of [[owner,"student"],[other,"student"],[admin,"admin"]] as const){const email=`retry-${randomUUID()}@example.invalid`,password=randomUUID()+"Aa1!";users.push(must(await service.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{role}})).user!.id);expect((await client.auth.signInWithPassword({email,password})).error).toBeNull();}
   expect((await service.from("planning_settings").update({enabled:false}).eq("id",true)).error).toBeNull();
   const url=`https://www.daad.de/SYNTHETIC-retry-${randomUUID()}`,name="Synthetic current retry",university="Synthetic university",group="Non-EU applicants",scope="Winter 2027 Non-EU applicants";
   const draft=(route:string)=>{const content=[name,university,scope,route].join("\n\n").padEnd(200," ");return buildResearchDraft({url,name,university,text:content},[{url,content,origin:"web",retrieved_at:"2026-10-07T00:00:00Z"}],{offerings:[{intake_term:"winter",intake_year:2027,applicant_group:group,scope:{source_url:url,source_quote:scope},facts:[{key:"route",kind:"route",verbatim:route,route:"direct",deadline_kind:null,applicability:group,evidence:[{source_url:url,source_quote:route}]}]}]},[]);};
   const initial=draft("Synthetic direct application route one.");
   const course=must(await service.from("courses").insert({imported_by:users[0],source_url:url,normalized_url:url,name,university_name:university,field_extraction:{research:initial} as unknown as Json}).select("*").single());
   const app=must(await owner.from("applications").insert({user_id:users[0],course_id:course.id,status:"planning"}).select("*").single());
   const preliminary=must(await owner.rpc("enqueue_planning_job",{p_event:"preliminary",p_application_id:app.id}));
   const failed=async(id:string,cursor=0)=>{expect((await service.from("planning_jobs").update({state:"failed",attempts:3,error_code:"timeout",cursor,lease_owner:null,lease_until:null}).eq("id",id)).error).toBeNull();};
   await failed(preliminary.id,3);
   for(const client of [other,admin])expect((await client.rpc("retry_planning_job",{p_job_id:preliminary.id})).error).not.toBeNull();
   const anonymous=createClient<Database>(config.api!,config.publicKey!,options);
   expect((await anonymous.rpc("retry_planning_job",{p_job_id:preliminary.id})).error).not.toBeNull();expect((await anonymous.rpc("actionable_planning_jobs")).error).not.toBeNull();
   expect(await retryPlanningJob(owner,users[0],preliminary.id)).toEqual({status:"queued",job_id:preliminary.id});
   expect(must(await service.from("planning_jobs").select("*").eq("id",preliminary.id).single())).toMatchObject({state:"queued",attempts:0,cursor:3,error_code:null});
   await failed(preliminary.id,3);
   const research=must(await owner.rpc("enqueue_planning_job",{p_event:"research",p_application_id:app.id}));await failed(research.id);
   expect(must(await owner.rpc("actionable_planning_jobs"))).toHaveLength(2);
   process.env.NEXT_PUBLIC_SUPABASE_URL=config.api!;process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=config.publicKey!;process.env.SUPABASE_SECRET_KEY=config.serviceKey!;
   const {publishAdminCourseResearch}=await import("../admin-queries");
   const decisions=[{key:"0:route",reason:"Synthetic exact-source reviewed disposable fixture."}];
   await publishAdminCourseResearch(admin,course.id,["0:route"],users[2],decisions);
   const programme=must(await owner.from("programmes").select("id").eq("legacy_course_id",course.id).single());
   const offering=must(await owner.from("course_offerings").select("*").eq("programme_id",programme.id).single());
   const v1=must(await owner.from("course_offering_versions").select("*").eq("offering_id",offering.id).single());
   expect((await owner.from("applications").update({offering_id:offering.id,offering_applicant_context:{applicant_group:group,confirmed:true}}).eq("id",app.id)).error).toBeNull();
   const current=must(await owner.rpc("enqueue_planning_job",{p_event:"verified",p_application_id:app.id,p_source_version_id:v1.id}));
   expect((await service.from("planning_jobs").update({state:"succeeded"}).eq("id",current.id)).error).toBeNull();
   expect(must(await owner.rpc("retry_planning_job",{p_job_id:preliminary.id}))).toMatchObject({status:"existing",job_id:current.id});
   expect(must(await owner.rpc("retry_planning_job",{p_job_id:research.id}))).toMatchObject({status:"obsolete",job_id:null});
   expect(must(await owner.rpc("actionable_planning_jobs"))).toMatchObject([{id:current.id,event:"verified",state:"succeeded"}]);
   expect(must(await owner.from("planning_jobs").select("id").eq("application_id",app.id))).toHaveLength(3); // Historical failures remain; no competing preliminary/research retry.
   await failed(current.id);
   const changed=must(await owner.from("courses").insert({imported_by:users[0],source_url:url,normalized_url:url,conflicts_with:course.id,name,university_name:university,field_extraction:{research:draft("Synthetic direct application route two.")} as unknown as Json}).select("*").single());
   await publishAdminCourseResearch(admin,changed.id,["0:route"],users[2],decisions);
   const v2=must(await owner.from("course_offering_versions").select("*").eq("offering_id",offering.id).order("version",{ascending:false}).limit(1).single());expect(v2.id).not.toBe(v1.id);
   const next=must(await owner.rpc("retry_planning_job",{p_job_id:current.id})) as {status:string;job_id:string};expect(next.status).toBe("queued");
   expect(must(await service.from("planning_jobs").select("*").eq("id",next.job_id).single())).toMatchObject({event:"verified",source_version_id:v2.id,attempts:0,cursor:0});
   expect(must(await owner.rpc("actionable_planning_jobs"))).toMatchObject([{id:next.job_id,event:"verified",source_version_id:v2.id}]);
   const staleWorker=randomUUID();expect((await service.from("planning_jobs").update({state:"running",lease_owner:staleWorker,lease_until:"2099-01-01T00:00:00Z"}).eq("id",preliminary.id)).error).toBeNull();
   expect(must(await service.rpc("refresh_planning_job",{p_id:preliminary.id,p_worker:staleWorker}))).toBe(true);
   const afterRefresh=must(await owner.from("planning_jobs").select("*").eq("application_id",app.id));
   expect(afterRefresh.filter(j=>j.input_fingerprint===afterRefresh.find(j=>j.id===next.job_id)!.input_fingerprint&&j.event==="preliminary")).toHaveLength(0);
   expect(afterRefresh.filter(j=>j.source_version_id===v2.id)).toHaveLength(1);
   const staleResearchWorker=randomUUID();expect((await service.from("planning_jobs").update({state:"running",lease_owner:staleResearchWorker,lease_until:"2099-01-01T00:00:00Z"}).eq("id",research.id)).error).toBeNull();
   expect(must(await service.rpc("refresh_planning_job",{p_id:research.id,p_worker:staleResearchWorker}))).toBe(true);
   expect(must(await owner.from("planning_jobs").select("id").eq("application_id",app.id).eq("event","research"))).toHaveLength(1);
   // Authenticated admin edits SHARED templates only; its current preliminary work must remain retryable.
   expect((await service.from("planning_settings").update({enabled:true}).eq("id",true)).error).toBeNull();
   expect((await admin.from("course_task_definitions").insert([{course_id:course.id,kind:"custom",title_template:"Synthetic shared preparation",description:"Review the official source before preparing",due_mode:"none"},{course_id:course.id,kind:"requirement",source_key:"requirement:Synthetic legacy document",title_template:"Review synthetic legacy document",due_mode:"none"}])).error).toBeNull();
   const templateFingerprint=must(await owner.rpc("get_planning_context_fingerprint",{p_application_id:app.id}));
   const templateJob=must(await owner.from("planning_jobs").select("*").eq("application_id",app.id).eq("input_fingerprint",templateFingerprint).eq("event","preliminary").single());await failed(templateJob.id,2);
   expect(must(await owner.rpc("actionable_planning_jobs"))).toMatchObject([{id:templateJob.id,event:"preliminary",state:"failed"}]);
   expect(await retryPlanningJob(owner,users[0],templateJob.id)).toEqual({status:"queued",job_id:templateJob.id});
   expect(must(await owner.from("planning_jobs").select("*").eq("id",templateJob.id).single())).toMatchObject({event:"preliminary",cursor:2,attempts:0});
   expect((await owner.from("profiles").upsert({user_id:users[0],answers:{country:"Synthetic context change"}})).error).toBeNull();
   const templateWorker=randomUUID();expect((await service.from("planning_jobs").update({state:"running",lease_owner:templateWorker,lease_until:"2099-01-01T00:00:00Z"}).eq("id",templateJob.id)).error).toBeNull();
   expect(must(await service.rpc("refresh_planning_job",{p_id:templateJob.id,p_worker:templateWorker}))).toBe(true);
   const changedFingerprint=must(await owner.rpc("get_planning_context_fingerprint",{p_application_id:app.id}));
   const changedJob=must(await owner.from("planning_jobs").select("*").eq("application_id",app.id).eq("input_fingerprint",changedFingerprint).eq("event","verified").single());
   expect((await service.from("planning_jobs").update({created_at:"1900-01-01T00:00:00Z"}).eq("id",changedJob.id)).error).toBeNull();
   const {executePlanningBatch}=await import("@/lib/planning/worker");
   expect(await executePlanningBatch(service)).toMatchObject([{id:changedJob.id,status:"succeeded"}]);
   const currentProposals=must(await owner.from("task_proposals").select("*").eq("application_id",app.id));
   const definition=must(await admin.from("course_task_definitions").select("id").eq("course_id",course.id).eq("title_template","Synthetic shared preparation").single());
   const custom=currentProposals.filter(p=>p.legacy_task_key?.includes(definition.id));expect(custom).toHaveLength(1);
   expect(custom[0]).toMatchObject({stage:"preliminary",source_version_id:null,due_date:null,verbatim_due:null,evidence:[]});
   expect(currentProposals.some(p=>p.stage==="verified"&&p.source_version_id===v2.id)).toBe(true);
   const legacyDefinition=must(await admin.from("course_task_definitions").select("id").eq("course_id",course.id).eq("source_key","requirement:Synthetic legacy document").single());
   expect(currentProposals.filter(p=>p.legacy_task_key?.includes(legacyDefinition.id))).toHaveLength(1);


   expect(must(await other.rpc("actionable_planning_jobs"))).toHaveLength(0);expect(must(await admin.rpc("actionable_planning_jobs"))).toHaveLength(0);
   expect((await owner.rpc("current_planning_source_version",{p_user:users[0],p_application:app.id})).error).not.toBeNull();
   await failed(next.job_id);expect((await owner.from("applications").update({status:"applied"}).eq("id",app.id)).error).toBeNull();
   expect(must(await owner.rpc("retry_planning_job",{p_job_id:next.job_id}))).toMatchObject({status:"obsolete",job_id:null});expect(must(await owner.rpc("actionable_planning_jobs")).filter(j=>j.application_id===app.id)).toHaveLength(0);
   expect(must(await owner.from("tasks").select("id"))).toHaveLength(0);
   expect(must(await service.from("courses").select("field_extraction").eq("id",course.id).single()).field_extraction).not.toBeNull(); // Retry never rewrites retained research/paste.
  }finally{await service.from("planning_settings").update(settings).eq("id",true);for(const id of users)await service.auth.admin.deleteUser(id);}
 },20000);
});
