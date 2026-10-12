import {expect,it} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {ProcessGuidanceCard} from "../process-guidance";
import {projectProcess} from "@/lib/engine/process";
const now="2026-10-07T00:00:00Z";
const rule={id:"00000000-0000-4000-8000-000000000001",matched:true,status:"verified",source_url:"https://india.diplo.de/",source_quote:"8300 inr",last_verified_at:now,outcomes:{process:{kind:"visa_fee",fact_key:"fee",jurisdiction:"in",purposes:["study"],age:{min:19,max:null},amounts:[{amount:"8300",currency:"INR",period:"application"}],alternatives:[],additional:[],source_date_annotation:null,effective:{from:null,through:null,intake_indices:null},review_due:now,steps:[{order:44,text:"Pay 8300"}],editorial_advice:[]}}};
it("current evidence displays literal amounts with sources; stale never displays numeric quotes/steps",()=>{
 const p={visaApplicationCountry:"in",processContext:{purpose:"study",missionConfirmed:true,age:19,exception:"none"}};
 const current=renderToStaticMarkup(createElement(ProcessGuidanceCard,{process:projectProcess(p,[rule],now)}));expect(current).toContain("8300");expect(current).toContain("https://india.diplo.de/");
 const stale=renderToStaticMarkup(createElement(ProcessGuidanceCard,{process:projectProcess(p,[rule],"2026-10-07T00:00:00.001Z")}));expect(stale).not.toContain("8300");expect(stale).toContain("review_needed");
});
