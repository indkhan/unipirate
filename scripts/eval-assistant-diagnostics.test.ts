import {resolve,win32} from "node:path";
import {describe,expect,it} from "vitest";
import {normalizeEvalError,buildEvalEvidence,summarizeEvalCases,isOutsideCheckout,type EvalCaseEvidence} from "./eval-assistant-diagnostics";
const passed:EvalCaseEvidence={question:"Synthetic trap",category:"unknown",problems:[],unknown:true,rawCompliant:true,replaced:false,completedAnswers:1,startedSteps:2,answer:"[[unknown]]",guardedSteps:[{rawText:"[[unknown]]",text:"[[unknown]]"}],errors:[]};
describe("private assistant eval diagnostics",()=>{
 it("rejects inside dotdot-prefixed names and accepts only a real parent segment or different drive",()=>{
  const checkout=resolve("checkout");
  expect(isOutsideCheckout(checkout,resolve(checkout,"..eval-evidence.json"))).toBe(false);
  expect(isOutsideCheckout(checkout,resolve(checkout,"..private","evidence.json"))).toBe(false);
  expect(isOutsideCheckout(checkout,checkout)).toBe(false);
  expect(isOutsideCheckout(checkout,"../relative.json")).toBe(false);
  expect(isOutsideCheckout(checkout,resolve(checkout,"..","private-evidence.json"))).toBe(true);
  expect(isOutsideCheckout("C:\\checkout","D:\\private.json",win32)).toBe(true);
  expect(isOutsideCheckout("C:\\checkout","C:\\checkout\\..private.json",win32)).toBe(false);
 });
 it("classifies nested quota and rate errors without copying bodies, prompts, arbitrary names or keys",()=>{
  const error={name:"sk-secret-key",message:"do not log this prompt",cause:{statusCode:429,responseBody:'{"error":{"message":"Rate limit exceeded: free-models-per-day","key":"sk-secret-key"}}'}};
  expect(normalizeEvalError(error)).toEqual({statusCode:429,errorClass:"daily_free_quota"});
  expect(normalizeEvalError({statusCode:429,message:"Too many requests"})).toEqual({statusCode:429,errorClass:"rate_limit"});
  expect(normalizeEvalError({name:"AI_NoOutputGeneratedError",responseBody:"secret"})).toEqual({statusCode:null,errorClass:"no_output"});
  const cyclic:{cause?:unknown}={};cyclic.cause=cyclic;expect(normalizeEvalError(cyclic)).toEqual({statusCode:null,errorClass:"other"});
 });
 it("projects evidence explicitly and never serializes provider errors or tool context",()=>{
  const dirty={...passed,providerError:{apiKey:"sk-secret-key"},toolContext:{private:"profile"},guardedSteps:[{rawText:"synthetic raw",text:"[[unknown]]",toolContext:"secret"}],errors:[{statusCode:429,errorClass:"daily_free_quota",responseBody:"secret"}]} as unknown as EvalCaseEvidence;
  const serialized=JSON.stringify(buildEvalEvidence([dirty],20));expect(serialized).not.toMatch(/sk-secret|toolContext|providerError|responseBody/);expect(serialized).toContain("synthetic raw");
 });
 it("counts each failed case once, rejects incomplete runs and retains all original pass criteria",()=>{
  expect(summarizeEvalCases(Array.from({length:20},()=>({...passed,completed:false})),20).status).toBe("incomplete");
  const failure={...passed,unknown:false,problems:["RAW_UNCITED","GUARDED_FALLBACK"],rawCompliant:false,replaced:true};
  expect(summarizeEvalCases([passed],20)).toMatchObject({status:"incomplete",failures:0,passed:1,attempted:1,unknowns:1});
  expect(summarizeEvalCases([failure,...Array.from({length:19},()=>passed)],20)).toMatchObject({status:"failed",failures:1,passed:19,rawUncited:1,guardedFallbacks:1});
  expect(summarizeEvalCases(Array.from({length:20},()=>({...passed,unknown:false})),20).status).toBe("failed");
  expect(summarizeEvalCases(Array.from({length:20},()=>passed),20).status).toBe("passed");
 });
});
