import {expect,it} from "vitest";
import {freePlannerModels} from "../planner-models";
const model={id:"example/plan:free",name:"Free planner",context_length:32768,supported_parameters:["tools","tool_choice"],pricing:{prompt:"0",completion:"0",request:"0",internal_reasoning:"0"}};
it("allows only exact current free native-tool-capable catalogue entries",()=>{
 expect(freePlannerModels([model]).map(m=>m.id)).toEqual([model.id]);
 for(const bad of [{...model,id:"example/paid"},{...model,pricing:{...model.pricing,prompt:"0.00001"}},{...model,pricing:{...model.pricing,request:"unknown"}},{...model,supported_parameters:[]},{...model,context_length:1024}])expect(freePlannerModels([bad])).toEqual([]);
});
