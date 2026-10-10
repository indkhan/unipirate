import {isAbsolute,relative,sep} from "node:path";
// Pure, bounded diagnostics. Provider payloads are inspected only for classification and never copied.
export function isOutsideCheckout(checkout:string,target:string,pathApi:{isAbsolute:(value:string)=>boolean;relative:(from:string,to:string)=>string;sep:string}={isAbsolute,relative,sep}){
 if(!pathApi.isAbsolute(target))return false;
 const location=pathApi.relative(checkout,target);
 return location===".."||location.startsWith(".."+pathApi.sep)||pathApi.isAbsolute(location);
}
export type EvalError={statusCode:number|null;errorClass:"daily_free_quota"|"rate_limit"|"no_output"|"other"};
export type EvalCaseEvidence={question:string;category:string;completed?:boolean;problems:string[];unknown:boolean;rawCompliant:boolean;replaced:boolean;completedAnswers:number;startedSteps:number;answer:string|null;guardedSteps:{rawText:string;text:string}[];errors:EvalError[]};
export function normalizeEvalError(error:unknown):EvalError{
 const seen=new Set<unknown>();let statusCode:number|null=null,daily=false,rate=false,noOutput=false;
 function visit(value:unknown,depth:number){
  if(depth>4||!value||typeof value!=="object"||seen.has(value)||seen.size>=16)return;seen.add(value);
  const item=value as Record<string,unknown>;
  if(typeof item.statusCode==="number"&&Number.isInteger(item.statusCode)&&item.statusCode>=100&&item.statusCode<=599)statusCode??=item.statusCode;
  const message=[item.name,item.message,item.responseBody].filter(value=>typeof value==="string").map(value=>(value as string).slice(0,8192)).join(" ");
  daily||=/free[-_ ]models[-_ ]per[-_ ]day|daily.{0,40}(?:free|quota)|(?:free|quota).{0,40}(?:daily|per.day)/i.test(message);
  rate||=/rate.?limit|too many requests/i.test(message);noOutput||=/AI_NoOutputGeneratedError|NoOutputGeneratedError/.test(message);
  visit(item.cause,depth+1);visit(item.error,depth+1);if(Array.isArray(item.errors))for(const nested of item.errors.slice(0,4))visit(nested,depth+1);
 }
 visit(error,0);return {statusCode,errorClass:daily?"daily_free_quota":statusCode===429||rate?"rate_limit":noOutput?"no_output":"other"};
}
export function summarizeEvalCases(cases:EvalCaseEvidence[],total:number){
 const complete=cases.filter(row=>row.completed!==false),failures=complete.filter(row=>row.problems.length>0).length;
 const unknowns=complete.filter(row=>!row.problems.includes("ERROR")&&row.unknown&&!row.replaced).length;
 const rawUncited=complete.filter(row=>!row.problems.includes("ERROR")&&!row.rawCompliant).length;
 const guardedFallbacks=complete.filter(row=>!row.problems.includes("ERROR")&&row.replaced).length;
 return {status:cases.length!==total||complete.length!==total?"incomplete" as const:failures||unknowns<3?"failed" as const:"passed" as const,total,attempted:cases.length,completed:complete.length,failures,passed:complete.length-failures,unknowns,rawUncited,guardedFallbacks,startedSteps:cases.reduce((sum,row)=>sum+row.startedSteps,0)};
}
export function buildEvalEvidence(cases:EvalCaseEvidence[],total:number){
 const bound=(value:string)=>value.slice(0,24000);
 return {format:"unipirate-assistant-eval/v1",...summarizeEvalCases(cases,total),startedStepsMeaning:"Observed SDK start-step events; not an exact provider request count",cases:cases.map(row=>({question:bound(row.question),category:row.category.slice(0,100),completed:row.completed!==false,problems:row.problems.map(value=>value.slice(0,80)),unknown:row.unknown,rawCompliant:row.rawCompliant,replaced:row.replaced,completedAnswers:row.completedAnswers,startedSteps:row.startedSteps,answer:row.answer===null?null:bound(row.answer),guardedSteps:row.guardedSteps.slice(0,20).map(step=>({rawText:bound(step.rawText),text:bound(step.text)})),errors:row.errors.slice(0,20).map(error=>({statusCode:typeof error.statusCode==="number"&&Number.isInteger(error.statusCode)&&error.statusCode>=100&&error.statusCode<=599?error.statusCode:null,errorClass:(["daily_free_quota","rate_limit","no_output","other"] as string[]).includes(error.errorClass)?error.errorClass:"other"}))}))};
}
