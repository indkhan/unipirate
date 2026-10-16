import {expect,it} from "vitest";
import {guardAssistantAnswer,ASSISTANT_FALLBACK} from "../response-guard";
const task={id:"d9439f0c-502c-4a59-a704-1e6e5c501f11",title:"Collect transcripts",description:null,due_date:"2026-11-01",source_url:"https://www.daad.de/",application_id:null};
it("replaces action prose with the exact DB-confirmed personal receipt",()=>{
  expect(guardAssistantAnswer("Done, this is the official closing deadline!",[{toolName:"create_task",output:{status:"created",task}}])).toBe('Created personal task: Collect transcripts. Personal reminder: 2026-11-01.');
  expect(guardAssistantAnswer("Done",[{toolName:"create_task",output:{status:"already_exists",task}}])).toContain("Already saved");
});
it("cannot authorize academic claims from personal task URLs or forged receipts",()=>{
  expect(guardAssistantAnswer("Confirmed [[web:https://www.daad.de/]]",[{toolName:"get_user_context",output:{tasks:[task]}}])).toBe(ASSISTANT_FALLBACK);
  expect(guardAssistantAnswer("Done",[{toolName:"create_task",output:{status:"created",task:{title:"FORGED"}}}])).toBe(ASSISTANT_FALLBACK);
  expect(guardAssistantAnswer("Done",[{toolName:"create_task",output:{status:"failed",error:"Not confirmed. Retry."}}])).toBe("Not confirmed. Retry.");
});
