import {expect,it,vi} from "vitest";
import {planningLocalConfig} from "./planning-local-config";
it("does not fill missing explicit credentials from application env files",()=>{
 const load=vi.spyOn(process,"loadEnvFile").mockImplementation(()=>{throw new Error("Application env must not be loaded");});
 try {
  expect(planningLocalConfig(undefined,undefined,undefined).enabled).toBe(false);
  expect(()=>planningLocalConfig("https://live.supabase.co","app-public","app-service")).toThrow("dedicated disposable loopback");
  expect(load).not.toHaveBeenCalled();
 } finally {load.mockRestore();}
});
it("requires complete explicit local credentials and never follows linked targets",()=>{
 expect(planningLocalConfig(undefined,undefined,undefined).enabled).toBe(false);
 for(const port of [54321,55321,56321])expect(planningLocalConfig(`http://127.0.0.1:${port}`,"local-public","local-service").enabled).toBe(true);
 for(const url of ["https://live.supabase.co","http://127.0.0.1:5432","https://localhost:56321","http://user:pass@localhost:56321","http://localhost:56321/another","http://localhost:56321/?x=y"])expect(()=>planningLocalConfig(url,"public","service")).toThrow();
 expect(()=>planningLocalConfig("http://127.0.0.1:56321",undefined,"service")).toThrow();
});
