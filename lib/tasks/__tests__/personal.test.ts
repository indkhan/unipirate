import { expect,it,vi } from "vitest";
import { createPersonalTask } from "../personal";
const id="d9439f0c-502c-4a59-a704-1e6e5c501f11";
it("returns actual stored data and never manufactures a success on denial",async()=>{
  const rpc=vi.fn().mockResolvedValue({data:{status:"created",task:{id,title:"Stored title",description:null,due_date:null,source_url:null,application_id:null}},error:null});
  expect(await createPersonalTask({rpc} as never,id,{title:"Requested title"},{operationId:id,instruction:"Add task Requested title"})).toMatchObject({status:"created",task:{title:"Stored title"}});
  rpc.mockResolvedValue({data:null,error:{message:"DENIED SECRET DETAILS"}});
  expect(await createPersonalTask({rpc} as never,id,{title:"Requested title"},{operationId:id,instruction:"Add task Requested title"})).toEqual({status:"failed",error:"The task was not confirmed. Retry this request to check its saved receipt."});
});
it("rejects malformed inputs and owner IDs before DB access",async()=>{
  const rpc=vi.fn();
  await expect(createPersonalTask({rpc} as never,"foreign",{title:"T"},{operationId:id,instruction:"Add task T"})).rejects.toThrow();
  await expect(createPersonalTask({rpc} as never,id,{title:"T",dueDate:"2026-02-30"},{operationId:id,instruction:"Add task T"})).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
