// Actual local RLS, authenticated admin shell and owner keep/adopt. No mocked DB/client.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "../database.types";
import { ensureApplication, resolveCourseTaskAssignment } from "../queries";
import { insertAdminCourseTaskDefinition, updateAdminCourseTaskDefinition, syncAdminCourseTaskDefinitions } from "../admin-queries";
import { materializeCourseTasksForApplication } from "@/lib/tasks/materialize";
import {planningLocalConfig} from "./planning-local-config";
const api=process.env.PLANNING_LOCAL_API,publicKey=process.env.PLANNING_LOCAL_PUBLIC_KEY,serviceKey=process.env.PLANNING_LOCAL_SERVICE_KEY;
const {enabled}=planningLocalConfig(api,publicKey,serviceKey);
function must<T extends {data:unknown;error:{message:string}|null}>(result:T):NonNullable<T["data"]> {expect(result.error?.message??null).toBeNull();expect(result.data).not.toBeNull();return result.data as NonNullable<T["data"]>;}
describe.skipIf(!enabled)("shared template reconciliation (actual local owner-only task RLS)",()=>{
 it("admin edits shared templates without reading private copies; students keep/adopt the same completed rows",async()=>{
  // The internally authenticated shell must target this SAME disposable service.
  expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe(api);
  expect(process.env.SUPABASE_SECRET_KEY).toBe(serviceKey);
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const service=createClient<Database>(api!,serviceKey!,options),admin=createClient<Database>(api!,publicKey!,options),alice=createClient<Database>(api!,publicKey!,options),bob=createClient<Database>(api!,publicKey!,options);
  const users:string[]=[];let courseId:string|undefined;
  const prior=must(await service.from("planning_settings").select("*").eq("id",true).single());
  try {
   for(const [client,role] of [[admin,"admin"],[alice,"student"],[bob,"student"]] as const){
    const email=`template-private-${randomUUID()}@example.invalid`,password=randomUUID()+"Aa1!";
    users.push(must(await service.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{role}})).user!.id);
    expect((await client.auth.signInWithPassword({email,password})).error).toBeNull();
   }
   expect((await service.from("planning_settings").update({enabled:false}).eq("id",true)).error).toBeNull();
   const url=`https://example.invalid/template-${randomUUID()}`;
   const course=must(await service.from("courses").insert({source_url:url,normalized_url:url,review_status:"approved",name:"Synthetic shared template",university_name:"Synthetic university",imported_by:users[1]}).select("*").single());courseId=course.id;
   const a=await ensureApplication(alice,users[1],course.id),b=await ensureApplication(bob,users[2],course.id);
   const definition=await insertAdminCourseTaskDefinition(admin,{course_id:course.id,kind:"custom",title_template:"Prepare {{course}} records",description:"Shared original instructions",due_mode:"fixed_date",due_date:"2027-06-01",source_url:url,sort_order:30});
   await materializeCourseTasksForApplication(alice,users[1],a.id);await materializeCourseTasksForApplication(bob,users[2],b.id);
   const taskA=must(await alice.from("tasks").select("*").eq("course_task_definition_id",definition.id).single());
   const taskB=must(await bob.from("tasks").select("*").eq("course_task_definition_id",definition.id).single());
   const personalA={title:"Alice private checklist",description:"Alice private note",due_date:"2027-05-01",done:true,preferred_bucket:"later" as const,has_personal_edits:true};
   const personalB={title:"Bob private checklist",description:"Bob private note",due_date:"2027-05-02",done:true,preferred_bucket:"later" as const,has_personal_edits:true};
   expect((await alice.from("tasks").update(personalA).eq("id",taskA.id)).error).toBeNull();
   expect((await bob.from("tasks").update(personalB).eq("id",taskB.id)).error).toBeNull();
   expect(must(await admin.from("tasks").select("*").in("application_id",[a.id,b.id]))).toEqual([]);
   expect(must(await bob.from("tasks").select("*").eq("id",taskA.id))).toEqual([]);
   await expect(syncAdminCourseTaskDefinitions(alice,course.id)).rejects.toThrow("Administrator required");
   await updateAdminCourseTaskDefinition(admin,definition.id,{title_template:"Review updated source documents",description:"Shared revised instructions",due_date:"2027-07-01"});
   await syncAdminCourseTaskDefinitions(admin,course.id);
   const pendingA=must(await alice.from("tasks").select("*").eq("id",taskA.id).single());
   const pendingB=must(await bob.from("tasks").select("*").eq("id",taskB.id).single());
   expect(pendingA).toMatchObject({...personalA,id:taskA.id,task_key:taskA.task_key,admin_change_state:"update_pending"});
   expect(pendingB).toMatchObject({...personalB,id:taskB.id,task_key:taskB.task_key,admin_change_state:"update_pending"});
   expect(pendingA.admin_snapshot).toMatchObject({title:"Review updated source documents",description:"Shared revised instructions",due_date:"2027-07-01"});
   expect(must(await admin.from("tasks").select("*").in("id",[taskA.id,taskB.id]))).toEqual([]);
   await expect(resolveCourseTaskAssignment(admin,users[1],taskA.id,"adopt")).rejects.toThrow("Course task not found");
   await expect(resolveCourseTaskAssignment(bob,users[1],taskA.id,"adopt")).rejects.toThrow("Course task not found");
   await resolveCourseTaskAssignment(alice,users[1],taskA.id,"keep");
   await resolveCourseTaskAssignment(bob,users[2],taskB.id,"adopt");
   const kept=must(await alice.from("tasks").select("*").eq("id",taskA.id).single());
   const adopted=must(await bob.from("tasks").select("*").eq("id",taskB.id).single());
   expect(kept).toMatchObject({...personalA,id:taskA.id,task_key:taskA.task_key,admin_change_state:"current"});
   expect(adopted).toMatchObject({id:taskB.id,task_key:taskB.task_key,title:"Review updated source documents",description:"Shared revised instructions",due_date:"2027-07-01",done:true,preferred_bucket:"later",has_personal_edits:false,admin_change_state:"current"});
   await syncAdminCourseTaskDefinitions(admin,course.id);
   expect(must(await alice.from("tasks").select("*").eq("id",taskA.id).single())).toMatchObject({...personalA,admin_change_state:"current"});
   expect(must(await alice.from("tasks").select("id").eq("application_id",a.id))).toHaveLength(1);
   expect(must(await bob.from("tasks").select("id").eq("application_id",b.id))).toHaveLength(1);
  } finally {
   await service.from("planning_settings").update(prior).eq("id",true);
   for(const id of users) await service.auth.admin.deleteUser(id);
   if(courseId) await service.from("courses").delete().eq("id",courseId);
  }
 },60000);
});
