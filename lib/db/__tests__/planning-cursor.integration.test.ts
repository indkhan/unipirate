import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const api=process.env.PLANNING_LOCAL_API;
const publicKey=process.env.PLANNING_LOCAL_PUBLIC_KEY;
const serviceKey=process.env.PLANNING_LOCAL_SERVICE_KEY;
if(api){const parsed=new URL(api);if(parsed.protocol!=="http:"||!["localhost","127.0.0.1","[::1]"].includes(parsed.hostname)||!["54321","55321","56321"].includes(parsed.port))throw new Error("Planning cursor tests require a dedicated disposable loopback instance");}
describe.skipIf(!api&&!publicKey&&!serviceKey)("planning cursor real service-only lease/CAS",()=>{
 it("denies browser/admin escalation and checkpoints exactly the active cursor without exposing private jobs",async()=>{
  if(!api||!publicKey||!serviceKey)throw new Error("Supply all PLANNING_LOCAL_* credentials");
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const service=createClient(api,serviceKey,options),owner=createClient(api,publicKey,options),admin=createClient(api,publicKey,options),anon=createClient(api,publicKey,options);
  const users:string[]=[];
  try{
   for(const [client,role] of [[owner,"student"],[admin,"admin"]] as const){
    const email=`cursor-${randomUUID()}@example.com`,password=randomUUID()+"Aa1!";
    const created=await service.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{role}});
    expect(created.error).toBeNull();users.push(created.data.user!.id);
    expect((await client.auth.signInWithPassword({email,password})).error).toBeNull();
   }
   const worker=randomUUID();
   const inserted=await service.from("planning_jobs").insert({user_id:users[0],event:"preliminary",input_fingerprint:"b".repeat(64),state:"running",attempts:2,lease_owner:worker,lease_until:new Date(Date.now()+300000).toISOString()}).select("id").single();
   expect(inserted.error).toBeNull();const id=inserted.data!.id;
   const args={p_id:id,p_worker:worker,p_current_cursor:0,p_next_cursor:5,p_complete:false};
   for(const caller of [owner,admin,anon])expect((await caller.rpc("advance_planning_job",args)).error).not.toBeNull();
   expect((await admin.from("planning_jobs").select("*").eq("id",id)).data).toEqual([]);
   for(const extra of [{p_current_cursor:-1},{p_next_cursor:-1},{p_next_cursor:0},{p_complete:null}])expect((await service.rpc("advance_planning_job",{...args,...extra})).error).not.toBeNull();
   for(const extra of [{p_worker:randomUUID()},{p_current_cursor:1}]){
    const rejected=await service.rpc("advance_planning_job",{...args,...extra});expect(rejected.error).toBeNull();expect(rejected.data).toBe(false);
   }
   const advanced=await service.rpc("advance_planning_job",args);expect(advanced.error).toBeNull();expect(advanced.data).toBe(true);
   expect((await service.from("planning_jobs").select("cursor,state,attempts,lease_owner,lease_until,error_code").eq("id",id).single()).data).toEqual({cursor:5,state:"queued",attempts:0,lease_owner:null,lease_until:null,error_code:null});
   expect((await service.rpc("advance_planning_job",args)).data).toBe(false);
   expect((await service.from("planning_jobs").update({state:"running",attempts:1,lease_owner:worker,lease_until:new Date(Date.now()-1000).toISOString()}).eq("id",id)).error).toBeNull();
   expect((await service.rpc("advance_planning_job",{...args,p_current_cursor:5,p_next_cursor:6})).data).toBe(false);
   expect((await service.from("planning_jobs").update({lease_until:new Date(Date.now()+300000).toISOString()}).eq("id",id)).error).toBeNull();
   const finished=await service.rpc("advance_planning_job",{...args,p_current_cursor:5,p_next_cursor:5,p_complete:true});expect(finished.error).toBeNull();expect(finished.data).toBe(true);
   expect((await service.from("planning_jobs").select("cursor,state,attempts,lease_owner").eq("id",id).single()).data).toEqual({cursor:5,state:"succeeded",attempts:1,lease_owner:null});
  }finally{for(const id of users)expect((await service.auth.admin.deleteUser(id)).error).toBeNull();}
 },60000);
});
