import { beforeEach,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({getServerEnv:vi.fn(),createBackgroundWorker:vi.fn(),executePlanningBatch:vi.fn()}));
vi.mock("@/lib/env",()=>mocks);
vi.mock("@/lib/db/server",()=>mocks);
vi.mock("@/lib/planning/worker",()=>mocks);
import { POST } from "../route";
const credential="local-test-worker-secret-1234567890";
beforeEach(()=>{vi.resetAllMocks();mocks.getServerEnv.mockReturnValue({PLANNING_WORKER_SECRET:credential});mocks.executePlanningBatch.mockResolvedValue([{id:"private-owner-job",status:"retry"}]);});
it("authenticates worker credentials before service escalation",async()=>{
 for(const authorization of [undefined,"Bearer wrong",`Bearer ${credential}x`]){
  const response=await POST(new Request("http://local/api/planning/worker",{method:"POST",headers:authorization?{authorization}:{},body:"{}"}));
  expect(response.status).toBe(401);
 }
 expect(mocks.createBackgroundWorker).not.toHaveBeenCalled();
});
it("fails closed without configured credentials or with unexpected body",async()=>{
 mocks.getServerEnv.mockReturnValue({});expect((await POST(new Request("http://local",{method:"POST"}))).status).toBe(503);
 mocks.getServerEnv.mockReturnValue({PLANNING_WORKER_SECRET:credential});
 expect((await POST(new Request("http://local",{method:"POST",headers:{authorization:`Bearer ${credential}`},body:'{"user_id":"forged"}'}))).status).toBe(400);
 expect(mocks.createBackgroundWorker).not.toHaveBeenCalled();
});
it("returns bounded counts and never private job or provider data",async()=>{
 const response=await POST(new Request("http://local",{method:"POST",headers:{authorization:`Bearer ${credential}`},body:"{}"}));
 expect(response.status).toBe(200);expect(await response.json()).toEqual({processed:1,succeeded:0,retry:1});
 expect(mocks.createBackgroundWorker).toHaveBeenCalledOnce();
});
