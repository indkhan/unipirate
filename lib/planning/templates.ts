// Shared manual preparation survives a switch to the verified offering catalogue.
import {generateCourseTasks,type ApplicationForTaskGeneration,type TargetIntake} from "@/lib/tasks/generate";
import {proposalsFromGeneratedTasks} from "./proposals";
export function proposalsFromSharedTemplates(application:ApplicationForTaskGeneration,today:string,intake?:TargetIntake){
 const course=application.course;
 if(!course)return [];
 // Match materialize: preserve every non-submission definition as safe preparation.
 const task_definitions=course.task_definitions.filter(definition=>definition.kind!=="submission");
 return proposalsFromGeneratedTasks(generateCourseTasks([{...application,course:{...course,task_definitions}}],today,intake));
}
