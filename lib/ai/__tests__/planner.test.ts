import { expect, it } from "vitest";
import { validatePlannerSelection,plannerBatch } from "@/lib/planning/order";
const candidates=[{semantic_action_key:"prepare:documents",stage:"preliminary" as const,title:"Review document availability",description:null,reason:"Optional preparation; confirm applicable requirements.",due_date:null,verbatim_due:null,evidence:[],source_version_id:null,legacy_task_key:null}];
it("accepts only a complete selection of the supplied preparation catalogue",()=>{
 expect(validatePlannerSelection({indices:[0]},candidates)).toEqual(candidates);
 for(const output of [{indices:[]},{indices:[0,0]},{indices:[1]},{indices:[0],title:"Invented admission deadline"}])expect(()=>validatePlannerSelection(output,candidates)).toThrow();
});
it("bounds a batch by model context bytes and resumes all remaining suggestions",()=>{
 const many=Array.from({length:330},(_,index)=>({...candidates[0],semantic_action_key:`action:${index}`,title:"文".repeat(200),description:"very long data".repeat(150)}));
 let cursor=0;const visited:string[]=[];
 while(cursor<many.length){const batch=plannerBatch(many,cursor,8192);expect(batch.candidates.length).toBeGreaterThan(0);expect(Buffer.byteLength(JSON.stringify(batch.candidates.map((candidate,index)=>({index,title:candidate.title}))))).toBeLessThanOrEqual(4000);visited.push(...batch.candidates.map(c=>c.semantic_action_key));cursor=batch.nextCursor;}
 expect(visited).toEqual(many.map(c=>c.semantic_action_key));
 expect(()=>plannerBatch(many,-1,8192)).toThrow();
});
