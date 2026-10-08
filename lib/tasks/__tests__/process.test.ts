import {expect,it} from "vitest";
import {generateProcessTasks,newGeneratedTaskRows} from "../generate";
import {evaluateAssessment} from "@/lib/rules/assessment";
import {profile,context,raw,version,ruleId} from "@/lib/rules/__tests__/assessment-fixtures";
const process={kind:"appointment",fact_key:"portal",jurisdiction:"in",purposes:["study"],amounts:[],alternatives:[],additional:[],source_date_annotation:null,effective:{from:null,through:null,intake_indices:null},review_due:"2026-11-01T00:00:00Z",steps:[{order:44,text:"Source step"}],editorial_advice:[]};
const v=version(1,{raw_snapshot:{...raw,outcomes:{process},last_verified_at:"2026-10-07T00:00:00Z"}});
const p={...profile,visaApplicationCountry:"in",processContext:{purpose:"study",missionConfirmed:true,exception:"none"}} as const;
it("only current guidance generates logical tasks; inventory is never task authority",()=>{
 const a=evaluateAssessment(p,[v],context);const tasks=generateProcessTasks(a.process);
 expect(tasks).toEqual([expect.objectContaining({key:"rule:"+ruleId+":step:44",title:"Source step",source:{url:raw.source_url,verifiedAt:"2026-10-07T00:00:00Z"}})]);
 expect(generateProcessTasks(evaluateAssessment({...p,visaApplicationCountry:"sa"},[v],context).process)).toEqual([]);
 expect(generateProcessTasks(evaluateAssessment(p,[v],{...context,evaluatedAt:"2026-11-01T00:00:00.001Z"}).process)).toEqual([]);
});
it("IN to SA to IN does not duplicate, rewrite or reactivate retained keys",()=>{
 const row={sort_order:44,source_url:raw.source_url,source_verified_at:null,application_id:null,course_task_definition_id:null,admin_snapshot:null,task_key:"rule:"+ruleId+":step:44",title:"Personal 8400",done:true,generated_active:false,has_personal_edits:true,preferred_bucket:"later",due_date:"2027-01-15",verbatim_due:"My date"};
 const rows=[row];const token=JSON.stringify(rows);
 for(const country of ["in","sa","in"]){const a=evaluateAssessment({...p,visaApplicationCountry:country},[v],context);expect(newGeneratedTaskRows("user",generateProcessTasks(a.process),rows)).toEqual([]);}
 expect(JSON.stringify(rows)).toBe(token);
});
