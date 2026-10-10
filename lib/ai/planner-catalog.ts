import { z } from "zod";
import { boundedJson } from "./research-course";
import { freePlannerModels } from "./planner-models";
export async function listFreePlannerModels(){
  const response=await fetch("https://openrouter.ai/api/v1/models",{cache:"no-store",signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error("The model catalogue is unavailable. Try again.");
  const {data}=z.object({data:z.array(z.unknown())}).parse(await boundedJson(response));
  return freePlannerModels(data).sort((a,b)=>a.name.localeCompare(b.name));
}
export async function requireFreePlannerModel(id:string|null){
  const model=(await listFreePlannerModels()).find(model=>model.id===id);
  if(!model)throw Object.assign(new Error("The selected free planner model is unavailable or unsupported. Choose a currently available free model."),{code:"provider_unavailable"});
  return model;
}
