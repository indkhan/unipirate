// Pure native-tool validation and context budgeting. Zero I/O.
import { z } from "zod";
import type { ProposalCandidate } from "./proposals";
export const PlannerSelectionSchema=z.object({indices:z.array(z.number().int().nonnegative()).max(100)}).strict();
export function plannerBatch(candidates:ProposalCandidate[],cursor:number,contextLength:number){
 z.number().int().min(0).max(candidates.length).parse(cursor);z.number().int().min(8192).parse(contextLength);
 const budget=Math.min(4000,contextLength-2800),batch:ProposalCandidate[]=[];
 for(const candidate of candidates.slice(cursor,cursor+100)){
  const next=[...batch,candidate];
  // UTF-8 bytes conservatively bound multilingual tokens. Reserve room for
  // system/tool definitions and output; private notes are never sent.
  if(new TextEncoder().encode(JSON.stringify(next.map((c,index)=>({index,title:c.title})))).length>budget)break;
  batch.push(candidate);
 }
 if(!batch.length&&cursor<candidates.length)throw Object.assign(new Error("Planner input exceeds context"),{code:"invalid_output"});
 return {candidates:batch,nextCursor:cursor+batch.length,complete:cursor+batch.length===candidates.length};
}
export function validatePlannerSelection(value:unknown,candidates:ProposalCandidate[]):ProposalCandidate[]{
 const {indices}=PlannerSelectionSchema.parse(value);
 if(indices.length!==candidates.length||new Set(indices).size!==indices.length||indices.some(i=>i>=candidates.length))throw Object.assign(new Error("Invalid planner selection"),{code:"invalid_output"});
 return indices.map(i=>candidates[i]);
}
