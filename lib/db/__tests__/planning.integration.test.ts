// Real disposable-local RLS and concurrency checks. Never targets a linked project.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database, Json } from "../database.types";
import { insertCourse, ensureApplication, getApplicationOfferingCatalogue, setApplicationOfferingSelection, listTaskProposals } from "../queries";
import { publishAdminCourseResearch } from "../admin-queries";
import { buildResearchDraft } from "@/lib/courses/research";
import { resolveOfferingProcess } from "@/lib/tasks/offering-process";
import { proposalsFromOfferingPlan, proposalsForWithdrawnApprovedActions } from "@/lib/planning/proposals";
import {planningLocalConfig} from "./planning-local-config";
const api=process.env.PLANNING_LOCAL_API;
const publicKey=process.env.PLANNING_LOCAL_PUBLIC_KEY;
const serviceKey=process.env.PLANNING_LOCAL_SERVICE_KEY;
const {enabled}=planningLocalConfig(api,publicKey,serviceKey);
const candidate=(key:string)=>({semantic_action_key:key,stage:"preliminary",title:"Confirm the application procedure",description:null,reason:"No applicable reviewed procedure",due_date:null,verbatim_due:null,evidence:[],source_version_id:null,legacy_task_key:null});
function must<T extends {data:unknown;error:{message:string}|null}>(result:T):NonNullable<T["data"]> { expect(result.error?.message??null).toBeNull();expect(result.data).not.toBeNull();return result.data as NonNullable<T["data"]>; }
describe.skipIf(!enabled)("durable planning (real local owner RLS and races)",()=>{
 it.each([false,true])("actual publication preserves personal edits and reconciles official source metadata (personal source: %s)",async(personalSource)=>{
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const service=createClient<Database>(api!,serviceKey!,options),owner=createClient<Database>(api!,publicKey!,options),admin=createClient<Database>(api!,publicKey!,options),other=createClient<Database>(api!,publicKey!,options);
  const users:string[]=[];
  const previous=must(await service.from("planning_settings").select("*").eq("id",true).single());
  try {
   for(const [client,role] of [[owner,"student"],[admin,"admin"],[other,"student"]] as const) {
    const email=`planning-publication-${randomUUID()}@example.invalid`,password=randomUUID()+"Aa1!";
    users.push(must(await service.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{role}})).user!.id);
    expect((await client.auth.signInWithPassword({email,password})).error).toBeNull();
   }
   expect((await service.from("planning_settings").update({enabled:true}).eq("id",true)).error).toBeNull();
   const url=`https://www.daad.de/SYNTHETIC-planning-${randomUUID()}`,name="Synthetic planning publication",university="Synthetic university",group="Non-EU applicants",scope="Winter 2027 Non-EU applicants";
   const nextUrl=url+"/reviewed-v2",personalUrl="https://example.invalid/my-personal-source";
   const draft=(day:string,sourceUrl=url)=>{
    const entries=[{key:"route",kind:"route",verbatim:"Synthetic direct application route.",route:"direct",deadline_kind:null},{key:"deadline:university:application_closing",kind:"deadline",verbatim:`University application closes ${day}.`,route:null,deadline_kind:"application_closing"}];
    const content=[name,university,scope,...entries.map(e=>e.verbatim)].join("\n\n");
    return buildResearchDraft({url:sourceUrl,name,university,text:content.padEnd(200," ")},[{url:sourceUrl,content,origin:"web",retrieved_at:"2026-10-07T00:00:00Z"}],{offerings:[{intake_term:"winter",intake_year:2027,applicant_group:group,scope:{source_url:sourceUrl,source_quote:scope},facts:entries.map(e=>({...e,applicability:group,evidence:[{source_url:sourceUrl,source_quote:e.verbatim}]}))}]},[]);
   };
   const initialDraft=draft("15 July 2027");
   const course=await insertCourse(owner,{imported_by:users[0],source_url:url,normalized_url:url,name,university_name:university,field_extraction:{research:initialDraft} as unknown as Json});
   const app=await ensureApplication(owner,users[0],course.id);
   const accepted=["0:route","0:deadline:university:application_closing"];
   const decisions=accepted.map(key=>({key,reason:"Synthetic disposable fixture: compared complete literal source, exact intake and applicant group."}));
   await publishAdminCourseResearch(admin,course.id,accepted,users[1],decisions);
   const catalogue=await getApplicationOfferingCatalogue(owner,course.id,null),offering=catalogue.offerings[0];
   await setApplicationOfferingSelection(owner,users[0],{id:app.id,selection:{offering_id:offering.id,applicant_context:{applicant_group:group,confirmed:true}}});
   const wrongScope=await ensureApplication(other,users[2],course.id);
   // Owning the same public course without selected intake/group must not receive verified publication tasks.
   const firstCatalogue=await getApplicationOfferingCatalogue(owner,course.id,offering.id);
   const firstPlan=resolveOfferingProcess({...firstCatalogue,courseId:course.id,selection:{offering_id:offering.id,applicant_context:{applicant_group:group,confirmed:true}}});
   const firstJob=must(await owner.rpc("enqueue_planning_job",{p_event:"verified",p_application_id:app.id,p_source_version_id:firstPlan.version!.id}));
   const worker=randomUUID();must(await service.rpc("lease_planning_jobs",{p_worker:worker,p_limit:20}));
   const firstCandidates=proposalsFromOfferingPlan(app.id,"planning",firstPlan,"2026-10-10");
   const proposals=must(await service.rpc("save_task_proposals",{p_job_id:firstJob.id,p_worker:worker,p_input_fingerprint:firstJob.input_fingerprint,p_candidates:firstCandidates as unknown as Json}));
   const proposal=proposals[0];expect(proposal.stage).toBe("verified");expect(proposal.due_date).toBe("2027-07-15");
   expect((await service.from("task_proposals").update({due_date:"2000-01-01"}).eq("id",proposal.id)).error).toBeNull();
   const agedApproval=await owner.rpc("approve_task_proposals",{p_selection:[{id:proposal.id,revision:proposal.revision}]});
   expect(agedApproval.error).not.toBeNull();expect(agedApproval.error?.message).toContain("Official deadline passed");
   expect(must(await owner.from("tasks").select("id").eq("application_id",app.id))).toHaveLength(0);
   expect((await service.from("task_proposals").update({due_date:proposal.due_date}).eq("id",proposal.id)).error).toBeNull();
   must(await owner.rpc("approve_task_proposals",{p_selection:[{id:proposal.id,revision:proposal.revision}]}));
   const approved=must(await owner.from("task_proposals").select("*").eq("id",proposal.id).single());
   const taskId=approved.approved_task_id!;
   const shown=(await listTaskProposals(owner,users[0])).find(row=>row.id===proposal.id)!;
   expect(shown).not.toHaveProperty("approved_source_url");expect(shown).not.toHaveProperty("source_baseline_known");
   expect(must(await owner.from("tasks").select("source_url").eq("id",taskId).single()).source_url).toBe(url);
   if(personalSource) expect((await owner.from("tasks").update({source_url:personalUrl}).eq("id",taskId)).error).toBeNull();
   expect((await owner.from("tasks").update({title:"My personal completed filing",description:"Private personal note",done:true,preferred_bucket:"later",has_personal_edits:true}).eq("id",taskId)).error).toBeNull();
   must(await service.rpc("finish_planning_job",{p_id:firstJob.id,p_worker:worker,p_success:true}));
   const changed=await insertCourse(owner,{imported_by:users[0],source_url:url,normalized_url:url,conflicts_with:course.id,name,university_name:university,field_extraction:{research:draft("1 August 2027",nextUrl)} as unknown as Json});
   await publishAdminCourseResearch(admin,changed.id,accepted,users[1],decisions);
   const nextCatalogue=await getApplicationOfferingCatalogue(owner,course.id,offering.id);
   const nextPlan=resolveOfferingProcess({...nextCatalogue,courseId:course.id,selection:{offering_id:offering.id,applicant_context:{applicant_group:group,confirmed:true}}});
   const outbox=must(await service.from("planning_jobs").select("*").eq("event","verified").eq("source_version_id",nextPlan.version!.id));
   expect(outbox.some(j=>j.application_id===app.id)).toBe(true);expect(outbox.some(j=>j.application_id===wrongScope.id)).toBe(false);
   expect(must(await other.from("task_proposals").select("*"))).toHaveLength(0);expect(must(await admin.from("task_proposals").select("*"))).toHaveLength(0);
   const nextWorker=randomUUID(),leased=must(await service.rpc("lease_planning_jobs",{p_worker:nextWorker,p_limit:20}));
   const nextJob=leased.find(j=>j.application_id===app.id && j.source_version_id===nextPlan.version!.id)!;expect(nextJob).toBeDefined();
   const candidates=proposalsFromOfferingPlan(app.id,"planning",nextPlan,"2026-10-10");
   const updates=must(await service.rpc("save_task_proposals",{p_job_id:nextJob.id,p_worker:nextWorker,p_input_fingerprint:nextJob.input_fingerprint,p_candidates:candidates as unknown as Json}));
   const update=updates[0];expect(update.id).toBe(proposal.id);expect(update.approved_task_id).toBe(taskId);expect(update.before_task).toMatchObject({title:"My personal completed filing",done:true,due_date:"2027-07-15"});
   expect(must(await owner.from("tasks").select("*").eq("id",taskId).single()).due_date).toBe("2027-07-15");
   // A task edit after the popup arrived must invalidate its exact reviewed snapshot.
   expect((await owner.from("tasks").update({title:"My newer personal filing"}).eq("id",taskId)).error).toBeNull();
   expect((await owner.rpc("approve_task_proposals",{p_selection:[{id:update.id,revision:update.revision}]})).error?.message).toContain("Task changed");
   const refreshed=must(await service.rpc("save_task_proposals",{p_job_id:nextJob.id,p_worker:nextWorker,p_input_fingerprint:nextJob.input_fingerprint,p_candidates:candidates as unknown as Json}))[0];
   expect(refreshed.revision).toBeGreaterThan(update.revision);
   must(await owner.rpc("approve_task_proposals",{p_selection:[{id:refreshed.id,revision:refreshed.revision}]}));
   const saved=must(await owner.from("tasks").select("*").eq("id",taskId).single());expect(saved).toMatchObject({title:"My newer personal filing",description:"Private personal note",done:true,preferred_bucket:"later",due_date:"2027-08-01",task_key:null,source_url:personalSource?personalUrl:nextUrl});
   expect(must(await owner.from("tasks").select("id").eq("application_id",app.id))).toHaveLength(1);
   const omittedKey=`app:${app.id}:offering:${offering.id}:verify:unsupported`,otherIntakeKey=`app:${app.id}:offering:${randomUUID()}:verify:unsupported`;
   const omitted=must(await service.rpc("save_task_proposals",{p_job_id:nextJob.id,p_worker:nextWorker,p_input_fingerprint:nextJob.input_fingerprint,p_candidates:[candidate(omittedKey),candidate(otherIntakeKey)] as Json}));
   expect((await owner.rpc("retire_missing_planning_proposals",{p_job_id:nextJob.id,p_worker:nextWorker,p_input_fingerprint:nextJob.input_fingerprint,p_supported_action_keys:candidates.map(p=>p.semantic_action_key)})).error).not.toBeNull();
   expect(must(await service.rpc("retire_missing_planning_proposals",{p_job_id:nextJob.id,p_worker:nextWorker,p_input_fingerprint:nextJob.input_fingerprint,p_supported_action_keys:candidates.map(p=>p.semantic_action_key)}))).toBe(1);
   expect(must(await owner.from("task_proposals").select("status").eq("id",omitted[0].id).single()).status).toBe("needs_recheck");
   expect(must(await owner.from("task_proposals").select("status").eq("id",omitted[1].id).single()).status).toBe("pending");
   must(await service.rpc("finish_planning_job",{p_id:nextJob.id,p_worker:nextWorker,p_success:true}));
   // Withholding previously accepted fields is a REAL immutable publication, not a forged service version.
   const withdrawnSubmission=await insertCourse(owner,{imported_by:users[0],source_url:url,normalized_url:url,conflicts_with:course.id,name,university_name:university,field_extraction:{research:draft("1 August 2027",nextUrl)} as unknown as Json});
   await publishAdminCourseResearch(admin,withdrawnSubmission.id,[],users[1],[]);
   const withdrawnCatalogue=await getApplicationOfferingCatalogue(owner,course.id,offering.id);
   const withdrawnPlan=resolveOfferingProcess({...withdrawnCatalogue,courseId:course.id,selection:{offering_id:offering.id,applicant_context:{applicant_group:group,confirmed:true}}});
   expect(withdrawnPlan.route).toBe("unresolved");
   const withdrawnWorker=randomUUID(),withdrawnLeases=must(await service.rpc("lease_planning_jobs",{p_worker:withdrawnWorker,p_limit:20}));
   const withdrawnJob=withdrawnLeases.find(j=>j.application_id===app.id && j.source_version_id===withdrawnPlan.version!.id)!;expect(withdrawnJob).toBeDefined();
   const withdrawalCandidates=proposalsForWithdrawnApprovedActions(await listTaskProposals(owner,users[0]),[],app.id,offering.id);
   expect(withdrawalCandidates).toHaveLength(1);
   const withdrawal=must(await service.rpc("save_task_proposals",{p_job_id:withdrawnJob.id,p_worker:withdrawnWorker,p_input_fingerprint:withdrawnJob.input_fingerprint,p_candidates:withdrawalCandidates as unknown as Json}))[0];
   expect(withdrawal).toMatchObject({id:proposal.id,approved_task_id:taskId,stage:"preliminary",due_date:null,verbatim_due:null});
   expect(must(await owner.from("tasks").select("due_date").eq("id",taskId).single()).due_date).toBe("2027-08-01");
   must(await owner.rpc("approve_task_proposals",{p_selection:[{id:withdrawal.id,revision:withdrawal.revision}]}));
   expect(must(await owner.from("tasks").select("*").eq("id",taskId).single())).toMatchObject({title:"My newer personal filing",description:"Private personal note",done:true,preferred_bucket:"later",due_date:null,verbatim_due:null,source_url:personalSource?personalUrl:null});
   // Deleting an approved task retains proposal linkage and cannot recreate it on retry.
   expect((await owner.from("tasks").delete().eq("id",taskId)).error).toBeNull();
   const retry=must(await owner.rpc("approve_task_proposals",{p_selection:[{id:withdrawal.id,revision:withdrawal.revision}]}));expect(retry).toMatchObject([{status:"deleted",task_id:taskId}]);
   expect(must(await owner.from("tasks").select("id").eq("application_id",app.id))).toHaveLength(0);
  } finally {
   await service.from("planning_settings").update(previous).eq("id",true);
   for(const id of users) await service.auth.admin.deleteUser(id);
   // Immutable catalogue/audit fixture history is deliberately retained on this disposable DB.
  }
 },60000);
 it("coalesces queue events, leases once, enforces private proposals and creates only selected editable tasks",async()=>{
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const service=createClient<Database>(api!,serviceKey!,options);
  const alice=createClient<Database>(api!,publicKey!,options),bob=createClient<Database>(api!,publicKey!,options),admin=createClient<Database>(api!,publicKey!,options);
  const users:string[]=[];let courseId:string|undefined;
  const previous=must(await service.from("planning_settings").select("*").eq("id",true).single());
  try {
   for (const [client,role] of [[alice,"student"],[bob,"student"],[admin,"admin"]] as const) {
    const email=`planning-${randomUUID()}@example.invalid`,password=randomUUID()+"Aa1!";
    const user=must(await service.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{role}})).user!;users.push(user.id);
    expect((await client.auth.signInWithPassword({email,password})).error).toBeNull();
   }
   expect((await service.from("planning_settings").update({enabled:true}).eq("id",true)).error).toBeNull();
   const url=`https://example.invalid/planning-${randomUUID()}`;
   const course=must(await service.from("courses").insert({source_url:url,normalized_url:url,review_status:"approved",imported_by:users[0],name:"Synthetic planning course",university_name:"Synthetic university"}).select("*").single());courseId=course.id;
   const a=must(await alice.from("applications").insert({course_id:course.id,user_id:users[0]}).select("*").single());
   const b=must(await bob.from("applications").insert({course_id:course.id,user_id:users[1]}).select("*").single());
   expect((await bob.rpc("enqueue_planning_job",{p_event:"preliminary",p_application_id:a.id})).error).not.toBeNull();
   const duplicate=await Promise.all([alice.rpc("enqueue_planning_job",{p_event:"preliminary",p_application_id:a.id}),alice.rpc("enqueue_planning_job",{p_event:"preliminary",p_application_id:a.id})]);
   const job=must(duplicate[0]);expect(must(duplicate[1]).id).toBe(job.id);
   must(await bob.rpc("enqueue_planning_job",{p_event:"preliminary",p_application_id:b.id}));
   expect((await alice.rpc("lease_planning_jobs",{p_worker:randomUUID(),p_limit:1})).error).not.toBeNull();
   const w1=randomUUID(),w2=randomUUID();
   const leased=await Promise.all([service.rpc("lease_planning_jobs",{p_worker:w1,p_limit:1}),service.rpc("lease_planning_jobs",{p_worker:w2,p_limit:1})]);
   const leases=leased.flatMap(must);expect(new Set(leases.map(j=>j.id)).size).toBe(leases.length);
   expect(leases.some(j=>j.id===job.id)).toBe(true);
   const acquired=leases.find(j=>j.id===job.id)!;
   const worker=acquired.lease_owner!;
   expect((await alice.rpc("save_task_proposals",{p_job_id:job.id,p_worker:worker,p_input_fingerprint:job.input_fingerprint,p_candidates:[candidate("verify:procedure")] as Json})).error).not.toBeNull();
   expect((await service.rpc("save_task_proposals",{p_job_id:job.id,p_worker:worker,p_input_fingerprint:job.input_fingerprint,p_candidates:[{...candidate("forged"),due_date:"2027-07-15"}] as Json})).error).not.toBeNull();
   const proposals=must(await service.rpc("save_task_proposals",{p_job_id:job.id,p_worker:worker,p_input_fingerprint:job.input_fingerprint,p_candidates:[candidate("verify:procedure"),candidate("prepare:records")] as Json}));
   expect(proposals).toHaveLength(2);
   expect(must(await alice.from("tasks").select("id").eq("application_id",a.id))).toHaveLength(0);
   expect(must(await bob.from("task_proposals").select("*"))).toHaveLength(0);
   expect(must(await admin.from("task_proposals").select("*"))).toHaveLength(0);
   expect(must(await admin.from("planning_jobs").select("*"))).toHaveLength(0);
   expect((await alice.from("task_proposals").insert({...proposals[0],id:randomUUID()})).error).not.toBeNull();
   const selected=[{id:proposals[0].id,revision:proposals[0].revision}];
   for (const malformed of [{id:proposals[0].id,revision:null},{id:proposals[0].id},{id:proposals[0].id,revision:"1"},{id:proposals[0].id,revision:0},{id:proposals[0].id,revision:1.5}]) {
    expect((await alice.rpc("approve_task_proposals",{p_selection:[malformed] as Json})).error).not.toBeNull();
    expect(must(await alice.from("tasks").select("id").eq("application_id",a.id))).toHaveLength(0);
   }
   expect((await alice.rpc("dismiss_task_proposal",{p_id:proposals[0].id,p_revision:null as unknown as number})).error).not.toBeNull();
   expect((await bob.rpc("approve_task_proposals",{p_selection:selected})).error).not.toBeNull();
   expect((await admin.rpc("approve_task_proposals",{p_selection:selected})).error).not.toBeNull();
   const approvals=await Promise.all([alice.rpc("approve_task_proposals",{p_selection:selected}),alice.rpc("approve_task_proposals",{p_selection:selected})]);
   approvals.forEach(must);
   const tasks=must(await alice.from("tasks").select("*").eq("application_id",a.id));
   expect(tasks).toHaveLength(1);expect(tasks[0].task_key).toBeNull();
   expect(must(await alice.from("task_proposals").select("status").eq("id",proposals[1].id).single()).status).toBe("pending");
   expect(must(await alice.rpc("dismiss_task_proposal",{p_id:proposals[1].id,p_revision:proposals[1].revision}))).toBe(true);
   const again=must(await service.rpc("save_task_proposals",{p_job_id:job.id,p_worker:worker,p_input_fingerprint:job.input_fingerprint,p_candidates:[{...candidate("prepare:records"),title:"Prepare records with changed wording"}] as Json}));
   expect(again[0].status).toBe("dismissed");
   // Closing a notification makes no request; persisted pending/dismissed state is unchanged.
   expect(must(await alice.from("task_proposals").select("*").eq("application_id",a.id))).toHaveLength(2);
   expect(must(await service.rpc("finish_planning_job",{p_id:job.id,p_worker:worker,p_success:true}))).toBe(true);
   expect(must(await service.rpc("finish_planning_job",{p_id:job.id,p_worker:worker,p_success:true}))).toBe(false);
  } finally {
   await service.from("planning_settings").update(previous).eq("id",true);
   for(const id of users) await service.auth.admin.deleteUser(id);
   if(courseId) await service.from("courses").delete().eq("id",courseId);
  }
 },60000);
 it("persists provider failures, recovers expired leases and rejects stale input/selected revisions atomically",async()=>{
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const service=createClient<Database>(api!,serviceKey!,options),owner=createClient<Database>(api!,publicKey!,options);
  const previous=must(await service.from("planning_settings").select("*").eq("id",true).single());
  let userId:string|undefined;
  try {
   const email=`planning-recovery-${randomUUID()}@example.invalid`,password=randomUUID()+"Aa1!";
   userId=must(await service.auth.admin.createUser({email,password,email_confirm:true})).user!.id;
   expect((await owner.auth.signInWithPassword({email,password})).error).toBeNull();
   expect((await service.from("planning_settings").update({enabled:true}).eq("id",true)).error).toBeNull();
   const job=must(await owner.rpc("enqueue_planning_job",{p_event:"preliminary"}));
   const worker=randomUUID();must(await service.rpc("lease_planning_jobs",{p_worker:worker,p_limit:20}));
   const proposals=must(await service.rpc("save_task_proposals",{p_job_id:job.id,p_worker:worker,p_input_fingerprint:job.input_fingerprint,p_candidates:[candidate("verify:a"),candidate("verify:b")] as Json}));
   const staleSelection=[{id:proposals[0].id,revision:proposals[0].revision},{id:proposals[1].id,revision:proposals[1].revision+1}];
   expect((await owner.rpc("approve_task_proposals",{p_selection:staleSelection})).error).not.toBeNull();
   expect(must(await owner.from("tasks").select("id"))).toHaveLength(0);
   expect(must(await service.rpc("finish_planning_job",{p_id:job.id,p_worker:worker,p_success:false,p_error_code:"quota"}))).toBe(true);
   const failed=must(await owner.from("planning_jobs").select("*").eq("id",job.id).single());expect(failed.state).toBe("queued");expect(failed.error_code).toBe("quota");
   // Simulate a crashed process with a database lease that has actually expired.
   expect((await service.from("planning_jobs").update({state:"running",lease_owner:worker,lease_until:"2000-01-01T00:00:00Z",attempts:1}).eq("id",job.id)).error).toBeNull();
   const replacement=randomUUID();const recovered=must(await service.rpc("lease_planning_jobs",{p_worker:replacement,p_limit:20}));expect(recovered.find(j=>j.id===job.id)?.attempts).toBe(2);
   expect((await owner.from("profiles").upsert({user_id:userId,answers:{synthetic_context:"changed"}})).error).toBeNull();
   expect((await owner.rpc("approve_task_proposals",{p_selection:[{id:proposals[0].id,revision:proposals[0].revision}]})).error?.message).toContain("stale_context");
   expect((await service.rpc("save_task_proposals",{p_job_id:job.id,p_worker:replacement,p_input_fingerprint:job.input_fingerprint,p_candidates:[candidate("verify:c")] as Json})).error?.message).toContain("stale_context");
   expect(must(await service.rpc("refresh_planning_job",{p_id:job.id,p_worker:replacement}))).toBe(true);
   const queued=must(await owner.from("planning_jobs").select("*").eq("state","queued"));expect(queued.some(j=>j.input_fingerprint!==job.input_fingerprint)).toBe(true);
   const exhausted=queued.find(j=>j.input_fingerprint!==job.input_fingerprint)!;
   expect((await service.from("planning_jobs").update({state:"running",lease_owner:replacement,lease_until:"2000-01-01T00:00:00Z",attempts:3}).eq("id",exhausted.id)).error).toBeNull();
   must(await service.rpc("lease_planning_jobs",{p_worker:randomUUID(),p_limit:20}));
   expect(must(await owner.from("planning_jobs").select("*").eq("id",exhausted.id).single())).toMatchObject({state:"failed",error_code:"lease_expired",lease_owner:null,lease_until:null});
   expect(must(await owner.rpc("enqueue_planning_job",{p_event:"preliminary"}))).toMatchObject({id:exhausted.id,state:"queued",attempts:0,error_code:null});
  } finally {
   await service.from("planning_settings").update(previous).eq("id",true);
   if(userId) await service.auth.admin.deleteUser(userId);
  }
 },60000);
});
