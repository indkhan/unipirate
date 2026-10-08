import {createClient} from "@supabase/supabase-js";
import {expect,it} from "vitest";
import type {Database} from "../database.types";
import {setApplicationOfferingSelection,listApplicationsWithCourses,getApplicationOfferingCatalogue} from "../queries";
import {uuid,programme,offering,selection,created_at} from "@/lib/tasks/__tests__/offering-process.fixtures";
const application={id:uuid(5),user_id:uuid(7),course_id:uuid(2),created_at,updated_at:created_at,status:'applied',offering_id:null,offering_applicant_context:null,courses:null};
function client(options: {otherOwner?:boolean;wrongCourse?:boolean;extra?:boolean}={}) {
 const requests:{url:string;method:string;body:unknown}[]=[];
 const db=createClient<Database>('http://127.0.0.1:54321','synthetic-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,init)=>{
  const u=String(url);const method=init?.method??'GET';const body=init?.body?JSON.parse(String(init.body)):null;requests.push({url:u,method,body});
  const data=u.includes('/applications')?(method==='PATCH'?{...application,...body}:u.includes('&id=eq.')?(options.otherOwner?null:application):[{...application,...(options.extra?{offering_applicant_context:{applicant_group:offering.applicant_group,confirmed:true,payer:true},offering_id:offering.id}:{})}]):u.includes('/programmes')?{...programme,legacy_course_id:options.wrongCourse?uuid(22):programme.legacy_course_id}:u.includes('/course_offerings')?[offering]:[];
  return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
 }}});return {db,requests};
}
it('updates only selection on the existing owner application, preserving UUID/status',async()=>{
 const {db,requests}=client();const saved=await setApplicationOfferingSelection(db,uuid(7),{id:application.id,selection});
 const patch=requests.find(r=>r.method==='PATCH')!;expect(patch.url).toContain('user_id=eq.'+uuid(7));expect(patch.url).toContain('id=eq.'+application.id);expect(patch.body).toEqual({offering_id:offering.id,offering_applicant_context:selection.applicant_context});expect(saved.id).toBe(application.id);expect(saved.status).toBe('applied');
});
it.each([{id:'bad',selection},{id:application.id,selection:{...selection,extra:true}},{id:application.id,selection:{...selection,applicant_context:{...selection.applicant_context,payer:true}}}])('rejects forged boundary before I/O %j',async input=>{
 const {db,requests}=client();await expect(setApplicationOfferingSelection(db,uuid(7),input)).rejects.toThrow();expect(requests).toEqual([]);
});
it.each([{otherOwner:true},{wrongCourse:true}])('rejects unavailable owner or programme mismatch %j',async options=>{
 const {db,requests}=client(options);await expect(setApplicationOfferingSelection(db,uuid(7),{id:application.id,selection})).rejects.toThrow();expect(requests.some(r=>r.method==='PATCH')).toBe(false);
});
it('does not certify an arbitrary reported group',async()=>{
 const {db,requests}=client();await expect(setApplicationOfferingSelection(db,uuid(7),{id:application.id,selection:{...selection,applicant_context:{applicant_group:'Other',confirmed:true}}})).rejects.toThrow();expect(requests.some(r=>r.method==='PATCH')).toBe(false);
});
it('nullable clear keeps original UUID/status',async()=>{const {db}=client();expect(await setApplicationOfferingSelection(db,uuid(7),{id:application.id,selection:{offering_id:null,applicant_context:null}})).toMatchObject({id:application.id,status:'applied',offering_id:null});});
it('strict stored context rejects unknown payer authority',async()=>{await expect(listApplicationsWithCourses(client({extra:true}).db,uuid(7))).rejects.toThrow();});
it('loads only selected offering reviewed history and rejects bad IDs before I/O',async()=>{
 const {db,requests}=client();await getApplicationOfferingCatalogue(db,uuid(2),offering.id);expect(requests.at(-1)?.url).toContain('offering_id=eq.'+offering.id);expect(requests.at(-1)?.url).toContain('review_status=eq.verified');
 const bad=client();await expect(getApplicationOfferingCatalogue(bad.db,'bad',null)).rejects.toThrow();expect(bad.requests).toEqual([]);
});
