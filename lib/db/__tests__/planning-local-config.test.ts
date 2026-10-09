import {expect,it} from "vitest";
import {planningLocalConfig} from "./planning-local-config";
it("requires complete explicit local credentials and never follows linked targets",()=>{
 expect(planningLocalConfig(undefined,undefined,undefined).enabled).toBe(false);
 for(const port of [54321,55321,56321])expect(planningLocalConfig(`http://127.0.0.1:${port}`,"local-public","local-service").enabled).toBe(true);
 for(const url of ["https://live.supabase.co","http://127.0.0.1:5432","https://localhost:56321","http://user:pass@localhost:56321","http://localhost:56321/another","http://localhost:56321/?x=y"])expect(()=>planningLocalConfig(url,"public","service")).toThrow();
 expect(()=>planningLocalConfig("http://127.0.0.1:56321",undefined,"service")).toThrow();
});
