import {describe, expect, it} from "vitest";
import {EngineRuleSchema, evaluate} from "@/lib/engine/evaluate";
import {evaluateAssessment, compareAssessments, parseStoredAssessment} from "../assessment";
import {preflightPublication} from "../versioning";
import {projectVersionedKbMatches} from "@/lib/ai/versioned-kb";
import {profile, answers, context, raw, version, ruleId} from "./assessment-fixtures";
const process = {kind:"visa_fee",fact_key:"national_fee",jurisdiction:"in",purposes:["study"],age:{min:19,max:null},amounts:[{amount:"8300",currency:"INR",period:"application"}],alternatives:[],additional:[],source_date_annotation:"01.10.2026",effective:{from:null,through:null,intake_indices:null},review_due:"2026-11-01T00:00:00Z",steps:[{order:44,text:"Confirm the payment instructions with your mission"}],editorial_advice:[]};
const source={...raw,conditions:{},outcomes:{process},last_verified_at:"2026-10-07T00:00:00Z"};
const pv=(n=1,patch={})=>version(n,{raw_snapshot:{...source,...patch}});
const reported={...profile,visaApplicationCountry:"in",processContext:{version:1,purpose:"study",missionConfirmed:true,mission:"new_delhi",ageBracket:"over18",exception:"none"}} as const;
describe("immutable process integration",()=>{
 it("accepts separate process schema but publication rejects mixed new rows",()=>{
  expect(EngineRuleSchema.safeParse(source).success).toBe(true);
  const token={rule_id:ruleId,revision:1,predecessor_id:null,approval_status:"verified",confirmed:true};
  expect(()=>preflightPublication({...token,raw_snapshot:{...source,status:"draft"}})).not.toThrow();
  expect(()=>preflightPublication({...token,raw_snapshot:{...source,status:"draft",outcomes:{process,path:"direct"}}})).toThrow();
 });
 it("selected human version earns authority; client flags do not bypass matching",()=>{
  const a=evaluateAssessment(reported,[pv()],context);
  expect(a.process?.guidance[0]).toMatchObject({status:"current",amounts:process.amounts});
  expect(a.result).toEqual(evaluate(profile,[]));
  const blocked=evaluateAssessment(reported,[pv(1,{matched:true,conditions:{board:{op:"neq",value:"cbse"}}})],context);
  expect(blocked.process?.guidance).toEqual([]);
 });
 it("fee and mission changes leave academic policy separate",()=>{
  const before=evaluateAssessment(reported,[pv()],context);
  const after=evaluateAssessment(reported,[pv(2,{outcomes:{process:{...process,amounts:[{amount:"8400",currency:"INR",period:"application"}]}}})],context);
  expect(compareAssessments(before,after)).toMatchObject({policyChanged:false,newCoverage:false,processChanged:true});
  expect(compareAssessments(before,evaluateAssessment({...reported,visaApplicationCountry:"sa"},[pv()],context))).toMatchObject({policyChanged:false,processChanged:true});
 });
 it("publication microseconds are exact and process deadline adapts conservatively",()=>{
  const before=evaluateAssessment(reported,[pv(),version(2,{raw_snapshot:source,published_at:"2026-10-07T12:00:00.000001Z"})],context);
  expect(before.metadata.selectedVersionIds).toEqual([pv().id]);
  expect(before.process?.guidance[0].status).toBe("current");
 });
 it("never invents originally saved process decisions",()=>{
  const a=evaluateAssessment(reported,[pv()],context);
  const history=parseStoredAssessment({assessment_metadata:a.metadata,result:a.result,answers},[pv()]);
  expect(history.kind).toBe("authoritative");
  expect(history.original?.process).toBeUndefined();
 });
 it("KB fallback and hints withhold amounts and quotes without current context",()=>{
  const hints=[{rule_id:ruleId,content:"8400 INR cached"}];
  const unknown=projectVersionedKbMatches(hints,[pv()],{evaluatedAt:context.evaluatedAt,intake:profile.intake});
  expect(JSON.stringify(unknown)).not.toContain("8300");
  expect(JSON.stringify(unknown)).not.toContain(source.source_quote);
  const current=projectVersionedKbMatches(hints,[pv()],{evaluatedAt:context.evaluatedAt,intake:profile.intake,profile:reported});
  expect(JSON.stringify(current)).toContain("8300");
 });
});

it("quarantines renamed source-only legacy portal identity across immutable history",()=>{
 const old=version(1,{raw_snapshot:{...raw,slug:"blocked-account-open",outcomes:{steps:[{order:41,text:"OLD 11904"}]}}});
 const renamed=version(2,{raw_snapshot:{...raw,slug:"renamed",outcomes:{steps:[{order:41,text:"OLD 11904"}]},source_url:"https://example.invalid/new"}});
 expect(evaluateAssessment(profile,[old,renamed],context).result.stepsDetailed).toEqual([]);
 expect(JSON.stringify(projectVersionedKbMatches([{rule_id:ruleId}],[old,renamed],{evaluatedAt:context.evaluatedAt}))).not.toContain("11904");
});

it("draft process impact is separate and mixed proposals are unavailable",async()=>{
 const {previewDraftImpact}=await import("../consumer-impact");
 const draft={rule_id:ruleId,raw_snapshot:{...source,status:"draft",outcomes:{process:{...process,amounts:[{amount:"8400",currency:"INR",period:"application"}]}}},revision:1,edited_by:null,edited_at:context.evaluatedAt,effective_from:null,effective_until:null,intake_from:null,intake_until:null};
 const result=previewDraftImpact([{answers}], [pv()],draft,"verified",context);expect(result).toMatchObject({policyChanged:0,newCoverage:0,processChanged:1});
 expect(previewDraftImpact([{answers}],[],{...draft,raw_snapshot:{...draft.raw_snapshot,outcomes:{process,path:"direct"}}},"verified",context).invalidProposal).toBe(true);
});

it("keeps process source explanation changes separate from academic explanation",()=>{
 const before=evaluateAssessment(reported,[pv()],context);const after=evaluateAssessment(reported,[pv(2,{source_quote:"Another process quote"})],context);
 expect(compareAssessments(before,after)).toMatchObject({policyChanged:false,explanationChanged:false,processExplanationChanged:true});
});
