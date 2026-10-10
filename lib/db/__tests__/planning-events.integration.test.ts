// Transactional relevant-event outbox; no provider calls or shared job leasing.
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {describe,expect,it} from "vitest";
import {buildResearchDraft} from "@/lib/courses/research";
import type {Database,Json} from "../database.types";
import {planningLocalConfig} from "./planning-local-config";
const config=planningLocalConfig(process.env.PLANNING_LOCAL_API,process.env.PLANNING_LOCAL_PUBLIC_KEY,process.env.PLANNING_LOCAL_SERVICE_KEY);
function must<T extends {data:unknown;error:{message:string}|null}>(result:T):NonNullable<T["data"]>{expect(result.error?.message??null).toBeNull();expect(result.data).not.toBeNull();return result.data as NonNullable<T["data"]>;}
describe.skipIf(!config.enabled)("relevant planning events (real transactional outbox)",()=>{
 it("queues only meaningful owner context/progress, selects exact committed scope and never loops approvals",async()=>{
  const options={auth:{persistSession:false,autoRefreshToken:false}},service=createClient<Database>(config.api!,config.serviceKey!,options),owner=createClient<Database>(config.api!,config.publicKey!,options),other=createClient<Database>(config.api!,config.publicKey!,options),admin=createClient<Database>(config.api!,config.publicKey!,options);
  const users:string[]=[];const previous=must(await service.from("planning_settings").select("*").eq("id",true).single());
  try{
   for(const [client,role] of [[owner,"student"],[other,"student"],[admin,"admin"]] as const){const email=`events-${randomUUID()}@example.invalid`,password=randomUUID()+"Aa1!";users.push(must(await service.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{role}})).user!.id);expect((await client.auth.signInWithPassword({email,password})).error).toBeNull();}
   const anonymous=createClient<Database>(config.api!,config.publicKey!,options);
   for(const client of [anonymous,owner,admin]){
    const denied=await client.rpc("enqueue_relevant_planning_scope",{p_user:users[1],p_application:randomUUID()});
    expect(denied.error).not.toBeNull();
   }
   const jobs=async()=>must(await service.from("planning_jobs").select("*").eq("user_id",users[0]));
   expect((await service.from("planning_settings").update({enabled:false}).eq("id",true)).error).toBeNull();
   const url=`https://www.daad.de/SYNTHETIC-events-${randomUUID()}`,name="Synthetic event course",university="Synthetic university",group="Non-EU applicants",content=name+"\n\n"+university+"\n\nWinter 2027 Non-EU applicants\n\nSynthetic direct route. "+"Synthetic source. ".repeat(20);
   const draft=buildResearchDraft({url,name,university,text:content},[{url,content,origin:"web",retrieved_at:"2026-10-07T00:00:00Z"}],{offerings:[{intake_term:"winter",intake_year:2027,applicant_group:group,scope:{source_url:url,source_quote:"Winter 2027 Non-EU applicants"},facts:[{key:"route",kind:"route",verbatim:"Synthetic direct route.",route:"direct",deadline_kind:null,applicability:group,evidence:[{source_url:url,source_quote:"Synthetic direct route."}]}]}]},[]);
   const course=must(await service.from("courses").insert({source_url:url,normalized_url:url,name,university_name:university,imported_by:users[0],field_extraction:{research:draft} as unknown as Json}).select("*").single());
   const app=must(await owner.from("applications").insert({user_id:users[0],course_id:course.id,status:"planning"}).select("*").single());
   const task=must(await owner.from("tasks").insert({user_id:users[0],application_id:app.id,title:"Personal filing",description:"Private notes",source_url:"https://example.invalid/personal",done:false,task_key:null}).select("*").single());
   expect((await owner.from("profiles").upsert({user_id:users[0],answers:{country:"Synthetic A"}})).error).toBeNull();
   expect((await owner.from("tasks").update({done:true}).eq("id",task.id)).error).toBeNull();expect(await jobs()).toHaveLength(0);
   expect((await service.from("planning_settings").update({enabled:true}).eq("id",true)).error).toBeNull();
   expect((await owner.from("profiles").update({answers:{country:"Synthetic B"}}).eq("user_id",users[0])).error).toBeNull();
   expect(await jobs()).toHaveLength(2); // General context and this owned planning application.
   expect((await owner.from("profiles").update({answers:{country:"Synthetic B"}}).eq("user_id",users[0])).error).toBeNull();expect(await jobs()).toHaveLength(2);
   expect((await owner.from("tasks").update({done:false}).eq("id",task.id)).error).toBeNull();expect(await jobs()).toHaveLength(3);
   expect((await owner.from("tasks").update({done:false,title:"Personal renamed filing",due_date:"2027-09-01"}).eq("id",task.id)).error).toBeNull();expect(await jobs()).toHaveLength(3);
   expect((await owner.from("tasks").update({done:true}).eq("id",task.id)).error).toBeNull();expect(await jobs()).toHaveLength(3); // Existing fingerprint coalesces.
   expect(must(await other.from("tasks").update({done:false}).eq("id",task.id).select("id"))).toHaveLength(0);expect(await jobs()).toHaveLength(3);
   expect((await owner.from("applications").update({status:"applied"}).eq("id",app.id)).error).toBeNull();expect(await jobs()).toHaveLength(3);
   expect((await owner.from("applications").update({status:"planning"}).eq("id",app.id)).error).toBeNull();expect(await jobs()).toHaveLength(3);
   const current=must(await owner.rpc("get_planning_context_fingerprint",{p_application_id:app.id})),job=(await jobs()).find(j=>j.application_id===app.id&&j.input_fingerprint===current)!;
   const worker=randomUUID();expect((await service.from("planning_jobs").update({state:"running",lease_owner:worker,lease_until:"2099-01-01T00:00:00Z",attempts:1}).eq("id",job.id)).error).toBeNull();
   const proposals=must(await service.rpc("save_task_proposals",{p_job_id:job.id,p_worker:worker,p_input_fingerprint:current,p_candidates:[{semantic_action_key:`app:${app.id}:safe-review`,stage:"preliminary",title:"Confirm official instructions",description:null,reason:"No selected reviewed scope",due_date:null,verbatim_due:null,evidence:[],source_version_id:null,legacy_task_key:null}]}));
   expect(await jobs()).toHaveLength(3);must(await owner.rpc("approve_task_proposals",{p_selection:[{id:proposals[0].id,revision:proposals[0].revision}]}));expect(await jobs()).toHaveLength(3);
   expect(must(await owner.from("tasks").select("*").eq("id",task.id).single())).toMatchObject({id:task.id,done:true,title:"Personal renamed filing",description:"Private notes",source_url:"https://example.invalid/personal",due_date:"2027-09-01"});
   // Actual protected immutable review; no direct forged version/audit rows.
   process.env.NEXT_PUBLIC_SUPABASE_URL=config.api!;process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=config.publicKey!;process.env.SUPABASE_SECRET_KEY=config.serviceKey!;
   const {publishAdminCourseResearch}=await import("../admin-queries");
   await publishAdminCourseResearch(admin,course.id,["0:route"],users[2],[{key:"0:route",reason:"Synthetic exact-source scoped fixture reviewed on disposable DB."}]);
   const programme=must(await owner.from("programmes").select("id").eq("legacy_course_id",course.id).single());
   const offering=must(await owner.from("course_offerings").select("*").eq("programme_id",programme.id).single());
   const version=must(await owner.from("course_offering_versions").select("id").eq("offering_id",offering.id).single());
   expect((await owner.from("applications").update({offering_id:offering.id,offering_applicant_context:{applicant_group:group,confirmed:true}}).eq("id",app.id)).error).toBeNull();
   const scoped=(await jobs()).filter(j=>j.source_version_id===version.id);expect(scoped).toHaveLength(1);expect(scoped[0].event).toBe("verified");
   expect((await owner.from("tasks").update({done:false}).eq("id",task.id)).error).toBeNull();expect((await jobs()).filter(j=>j.source_version_id===version.id)).toHaveLength(2);
   expect((await owner.from("applications").update({offering_id:null,offering_applicant_context:null}).eq("id",app.id)).error).toBeNull();
   const newest=must(await owner.rpc("get_planning_context_fingerprint",{p_application_id:app.id}));expect((await jobs()).find(j=>j.input_fingerprint===newest)).toMatchObject({event:"preliminary",source_version_id:null});
   expect(must(await admin.from("planning_jobs").select("id"))).toHaveLength(0);expect(must(await other.from("planning_jobs").select("id"))).toHaveLength(0);
   const otherApp=must(await other.from("applications").insert({user_id:users[1],course_id:course.id,status:"planning"}).select("id").single());
   expect(must(await other.from("planning_jobs").select("*").eq("application_id",otherApp.id))).toMatchObject([{user_id:users[1],event:"preliminary",source_version_id:null}]);
   expect(must(await owner.from("planning_jobs").select("id").eq("application_id",otherApp.id))).toHaveLength(0);
  }finally{await service.from("planning_settings").update(previous).eq("id",true);for(const id of users)await service.auth.admin.deleteUser(id);}
 },20000);
});
