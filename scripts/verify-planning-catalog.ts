// Read-only live capability check; never selects a paid fallback or writes settings.
import { listFreePlannerModels } from "../lib/ai/planner-catalog";
async function main(){
 const models=await listFreePlannerModels();
 console.log(JSON.stringify(models.map(model=>({id:model.id,name:model.name,context_length:model.context_length})),null,2));
 if(!models.length)throw new Error("No currently available free tool-capable planner model.");
}
void main().catch(()=>{console.error("Free planner catalogue check failed.");process.exitCode=1;});
