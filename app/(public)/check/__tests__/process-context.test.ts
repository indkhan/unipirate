import {expect,it} from "vitest";
import {AnswersSchema,buildProfile,withProcessContext,normalizeAnswers} from "../steps";
import {answers} from "@/lib/rules/__tests__/assessment-fixtures";
it("optional versioned process context preserves academic mapping and rejects forged authority",()=>{
 const report={version:1,purpose:"study",missionConfirmed:true,mission:"new_delhi",kind:"funding",fundingMethod:"loan",exception:"unknown"};
 const a=AnswersSchema.parse({...answers,processContext:report});expect(buildProfile(a).processContext).toEqual(report);
 expect(AnswersSchema.safeParse({...answers,processContext:{...report,matched:true}}).success).toBe(false);
 expect(AnswersSchema.safeParse(answers).success).toBe(true);
});
it("process-only edits prune dependents without upgrading or deleting academic history",()=>{
 const original={...AnswersSchema.parse(answers),processContext:{version:1,purpose:"study",missionConfirmed:true,mission:"new_delhi",kind:"funding",fundingMethod:"loan",exception:"none"}} as const;
 const next=withProcessContext(original,"mission","mumbai");expect(next.processContext?.fundingMethod).toBeUndefined();
 const {processContext,...academic}=next;expect(academic).toEqual(answers);expect(processContext?.missionConfirmed).toBeUndefined();
 expect(normalizeAnswers(original)).toEqual(original);
});
