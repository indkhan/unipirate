import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import { listRuleVersions } from "../queries";
import type { Database } from "../database.types";
import { getAdminRule, listAdminRules, updateAdminRule, publishAdminRuleVersion } from "../admin-queries";
const id="00000000-0000-4000-8000-000000000001";
const time="2026-01-01T00:00:00Z";
const raw={id,conditions:{},outcomes:{path:"direct"},status:"draft",source_url:"https://example.invalid/",source_quote:" Literal quote ",last_verified_at:time,notes:null,slug:"synthetic",country_code:null,created_at:time,updated_at:time,extra_stored_token:{literal:[" b ","a"]}};
const draft={rule_id:id,raw_snapshot:raw,revision:3,edited_by:null,edited_at:time,effective_from:null,effective_until:null,intake_from:null,intake_until:null};
const token={rule_id:id,revision:3,raw_snapshot:raw,predecessor_id:null};
function client(options:{draft?:unknown;history?:unknown;error?:string;emptySave?:boolean}={}){
 const requests:{url:string;method:string;body:unknown}[]=[];
 const db=createClient<Database>("http://127.0.0.1:54321","synthetic-key",{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,init)=>{
  const method=init?.method??"GET";requests.push({url:String(url),method,body:init?.body?JSON.parse(String(init.body)):null});
  const rpc=String(url).includes("/rpc/");
  let body:unknown=String(url).includes("rule_versions")?options.history??[]:options.draft??draft;
  if(method==="PATCH"&&options.emptySave)body=null;
  if(rpc)body={...draft,id,version_number:1,supersedes_version_id:null,status:"verified",provenance:"human_publication",reviewed_by:id,reviewed_at:time,published_at:time,captured_at:null,draft_revision:3,raw_snapshot:{...raw,status:"verified"}};
  if(options.error&&rpc)return new Response(JSON.stringify({message:options.error}),{status:400,headers:{"Content-Type":"application/json"}});
  if(String(url).includes("rule_drafts")&&String(url).includes("order="))body=[options.draft??draft];
  return new Response(JSON.stringify(body),{status:200,headers:{"Content-Type":"application/json"}});
 }}});return{db,requests};
}
it("lists and reads the actual draft plus immutable history, never the compatibility mirror",async()=>{
 const {db,requests}=client(); const row=await getAdminRule(db,id);
 expect(row.draft.raw_snapshot).toEqual(raw);expect(row.status).toBe("draft");
 expect(await listAdminRules(db,{})).toHaveLength(1);
 expect(requests.every(r=>!r.url.includes("/rules?"))).toBe(true);
});
it("saves only raw draft and scope with CAS revision and raw token",async()=>{
 const {db,requests}=client();await updateAdminRule(db,{rule_id:id,revision:3,raw_snapshot:raw,next_snapshot:{...raw,source_quote:" New literal "},effective_from:null,effective_until:null,intake_from:4053,intake_until:null});
 const patch=requests.find(r=>r.method==="PATCH")!;expect(patch.url).toContain("rule_drafts");expect(patch.url).toContain("revision=eq.3");expect(patch.url).toContain("raw_snapshot=eq.");
 expect(patch.body).toEqual({raw_snapshot:{...raw,source_quote:" New literal "},effective_from:null,effective_until:null,intake_from:4053,intake_until:null});
 expect(requests.some(r=>r.url.includes("/rpc/")||r.url.includes("/tasks")||r.url.includes("/applications"))).toBe(false);
});
it.each(["beta","verified"])("cannot save status %s as a draft",async status=>{
 const {db,requests}=client();await expect(updateAdminRule(db,{rule_id:id,revision:3,raw_snapshot:raw,next_snapshot:{...raw,status},effective_from:null,effective_until:null,intake_from:null,intake_until:null})).rejects.toThrow();expect(requests).toEqual([]);
});
it("friendly stale save failure does not overwrite",async()=>{
 const {db}=client({emptySave:true});await expect(updateAdminRule(db,{rule_id:id,revision:3,raw_snapshot:raw,next_snapshot:raw,effective_from:null,effective_until:null,intake_from:null,intake_until:null})).rejects.toThrow(/reload and review/i);
});
it.each(["beta","verified"])("publishes explicit %s with exact full raw token and database actor/time",async approval_status=>{
 const {db,requests}=client();await publishAdminRuleVersion(db,{...token,approval_status,confirmed:true});
 const rpc=requests.find(r=>r.url.includes("/rpc/"))!;expect(rpc.body).toEqual({p_rule_id:id,p_expected_draft_revision:3,p_expected_raw_snapshot:raw,p_expected_predecessor_id:null,p_approval_status:approval_status});
 expect(requests.filter(r=>r.method!=="GET")).toHaveLength(1);
});
it.each([{conditions:{invented_fact:true}},{outcomes:{}},{last_verified_at:null},{source_url:"bad"}])("rejects invalid raw RuleSchema before RPC: %j",extra=>{
 const {db,requests}=client();return expect(publishAdminRuleVersion(db,{...token,raw_snapshot:{...raw,...extra},approval_status:"verified",confirmed:true})).rejects.toThrow().then(()=>expect(requests.some(r=>r.url.includes("/rpc/"))).toBe(false));
});
it.each([{revision:2},{raw_snapshot:{...raw,source_quote:"Old"}},{predecessor_id:id}])("rejects stale review before RPC: %j",extra=>{
 const {db,requests}=client();return expect(publishAdminRuleVersion(db,{...token,...extra,approval_status:"verified",confirmed:true})).rejects.toThrow(/reload and review/i).then(()=>expect(requests.some(r=>r.url.includes("/rpc/"))).toBe(false));
});
it("handles a race rejected by the RPC without replacing expectations",async()=>{
 const {db}=client({error:"rule predecessor changed; reload and review again"});await expect(publishAdminRuleVersion(db,{...token,approval_status:"verified",confirmed:true})).rejects.toThrow(/reload and review/);
});
it.each([{confirmed:false},{approval_status:"draft"},{reviewed_by:id},{published_at:time}])("rejects missing approval or spoofed metadata %j",async extra=>{
 const {db,requests}=client();await expect(publishAdminRuleVersion(db,{...token,approval_status:"verified",confirmed:true,...extra})).rejects.toThrow();expect(requests).toEqual([]);
});

it("rejects a reserved key rather than silently dropping part of the raw token",async()=>{const {db,requests}=client();const snapshot=JSON.parse(JSON.stringify(raw).replace('"conditions":{}','"conditions":{"__proto__":true}'));await expect(publishAdminRuleVersion(db,{...token,raw_snapshot:snapshot,approval_status:"beta",confirmed:true})).rejects.toThrow();expect(requests).toEqual([]);});

it("isolated user history reader does not prefilter publication status or applicability",async()=>{const {db,requests}=client();expect(await listRuleVersions(db,id)).toEqual([]);expect(requests[0].url).toContain("rule_id=eq."+id);expect(requests[0].url).toContain("version_number.desc");expect(requests[0].url).not.toContain("status=eq");});
it("invalid history identity causes no I/O",async()=>{const {db,requests}=client();await expect(listRuleVersions(db,"bad")).rejects.toThrow();expect(requests).toEqual([]);});
it("reverification uses prior immutable head and appends without editing old history",async()=>{
 const old={id,rule_id:id,version_number:1,supersedes_version_id:null,raw_snapshot:{...raw,status:"verified"},status:"verified",effective_from:null,effective_until:null,intake_from:null,intake_until:null,provenance:"human_publication",reviewed_by:id,reviewed_at:time,published_at:time,captured_at:null,draft_revision:1};
 const before=JSON.stringify(old);const {db,requests}=client({history:[old]});await publishAdminRuleVersion(db,{...token,predecessor_id:id,approval_status:"verified",confirmed:true});
 expect(requests.find(r=>r.url.includes("/rpc/"))!.body).toEqual(expect.objectContaining({p_expected_predecessor_id:id,p_expected_raw_snapshot:raw}));expect(requests.some(r=>r.method==="PATCH"||r.method==="DELETE")).toBe(false);expect(JSON.stringify(old)).toBe(before);
});
