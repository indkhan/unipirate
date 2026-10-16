// Shared manual preparation survives a switch to the verified offering catalogue.
import {generateCourseTasks,type ApplicationForTaskGeneration,type TargetIntake} from "@/lib/tasks/generate";
import {personalPreparationAction,proposalsFromGeneratedTasks,type PersonalPreparationAction} from "./proposals";
export function proposalsFromSharedTemplates(application:ApplicationForTaskGeneration,today:string,intake?:TargetIntake){
 const course=application.course;
 if(!course)return [];
 // Only closed optional actions can retain wording; source claims remain generic verification.
 const task_definitions=course.task_definitions.filter(definition=>definition.kind!=="submission");
 const safeActions=new Map<string,PersonalPreparationAction>();
 for(const definition of task_definitions){
  if(definition.kind!=="custom"||definition.sourceKey!==null||definition.sourceUrl!==null||definition.sourceSnapshot!==null||definition.dueMode!=="none"||definition.dueDate!==null)continue;
  const action=personalPreparationAction(definition.titleTemplate);
  if(action)safeActions.set(`app:${application.id}:course-task:${definition.id}`,action);
 }
 return proposalsFromGeneratedTasks(generateCourseTasks([{...application,course:{...course,task_definitions}}],today,intake),safeActions);
}
