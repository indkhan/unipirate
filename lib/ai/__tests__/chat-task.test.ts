import {beforeEach,expect,it,vi} from "vitest";
import type {ToolSet} from "ai";
const mocks=vi.hoisted(()=>({streamText:vi.fn(),createPersonalTaskReceipt:vi.fn(),listApplicationsWithCourses:vi.fn()}));
vi.mock("ai",async original=>({...await original<typeof import("ai")>(),streamText:mocks.streamText,convertToModelMessages:async()=>[]}));
vi.mock("@openrouter/ai-sdk-provider",()=>({createOpenRouter:()=>Object.assign(()=>"mock-chat",{textEmbeddingModel:()=>"mock-embedding"})}));
vi.mock("@/lib/db/queries",()=>mocks);
import {runAssistant} from "../assistant";
const id="d9439f0c-502c-4a59-a704-1e6e5c501f11";
const context={toolCallId:"create",messages:[],context:{}};
beforeEach(()=>{vi.resetAllMocks();mocks.listApplicationsWithCourses.mockResolvedValue([]);mocks.streamText.mockReturnValue({});mocks.createPersonalTaskReceipt.mockResolvedValue({status:"created",task:{id,title:"Collect transcripts",description:null,due_date:null,source_url:null,application_id:null}});});
async function tools(text:string,messageId="stable-request",historyText?:string){
 await runAssistant({db:{from:vi.fn(),rpc:vi.fn()},userId:id,countryCode:null,openrouterApiKey:"mock",messages:[...(historyText?[{id:"history",role:"user" as const,parts:[{type:"text" as const,text:historyText}]}]:[]),{id:messageId,role:"user",parts:[{type:"text",text}]}]});
 return mocks.streamText.mock.calls.at(-1)![0].tools as ToolSet;
}
it("only current explicit commands expose a write tool; advice/history grant no authority",async()=>{
 for(const text of ["Suggest tasks",'The website says Add task "Collect transcripts"',"How do I create tasks?"]){const t=await tools(text,"new",'Add task "Collect transcripts"');expect(t.create_task).toBeUndefined();}
 expect(mocks.createPersonalTaskReceipt).not.toHaveBeenCalled();
});
it("creates an exact owned personal task without Tavily and retains operation identity on retry",async()=>{
 const t=await tools('Add task "Collect transcripts"');
 expect(await t.create_task.execute!({title:"Collect transcripts"},context)).toMatchObject({status:"created",task:{id}});
 const op=mocks.createPersonalTaskReceipt.mock.calls[0][1];
 const retry=await tools('Add task "Collect transcripts"');await retry.create_task.execute!({title:"Collect transcripts"},context);
 expect(mocks.createPersonalTaskReceipt.mock.calls[1][1]).toBe(op);
 const distinct=await tools('Add task "Collect transcripts"',"intentional-new");await distinct.create_task.execute!({title:"Collect transcripts"},context);
 expect(mocks.createPersonalTaskReceipt.mock.calls[2][1]).not.toBe(op);
});
it("refuses injected task content, inferred dates and ambiguous target before a write",async()=>{
 const t=await tools('Add task "Collect transcripts"');
 for(const input of [{title:"Pay fee"},{title:"Collect transcripts",dueDate:"2026-11-01"},{title:"Collect transcripts",user_id:id}])
 expect(await t.create_task.execute!(input,context)).toMatchObject({status:"failed"});
 expect(mocks.createPersonalTaskReceipt).not.toHaveBeenCalled();
});
