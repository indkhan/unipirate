import { z } from "zod";

export const PersonalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date=new Date(`${value}T00:00:00Z`);
  return !value.startsWith("0000-") && Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value;
}, "Choose a real calendar date.");
const nullableText=<T extends z.ZodTypeAny>(schema:T)=>z.preprocess(value=>typeof value==="string"&&value.trim()===""?null:value,schema.nullable()).optional().default(null);
export const ManualTaskSchema = z.object({
  title:z.string().trim().min(1).max(240),
  description:nullableText(z.string().trim().max(2000)),
  dueDate:nullableText(PersonalDateSchema),
  sourceUrl:nullableText(z.string().trim().url().max(2048).refine(value=>/^https?:\/\//.test(value)&&!new URL(value).username&&!new URL(value).password,"Use an HTTP(S) link without credentials.")),
  applicationId:nullableText(z.string().uuid()),
}).strict();
export type ManualTaskInput = z.infer<typeof ManualTaskSchema>;
export const TaskReceiptSchema=z.discriminatedUnion("status",[
  z.object({status:z.enum(["created","already_exists"]),task:z.object({id:z.string().uuid(),title:z.string(),description:z.string().nullable(),due_date:PersonalDateSchema.nullable(),source_url:z.string().nullable(),application_id:z.string().uuid().nullable()})}),
  z.object({status:z.literal("failed"),error:z.string()}),
]);
export type TaskReceipt=z.infer<typeof TaskReceiptSchema>;
export type ExplicitTaskInstruction = { title:string; dueDate:string|null; target:string|null; sourceUrl:string|null };
// Trade-off: a deliberately narrow command grammar binds the tool to literal
// student content. Unsupported/ambiguous language asks for clarification rather
// than allowing model interpretation to grant write authority.
export function explicitTaskInstruction(text:string):ExplicitTaskInstruction|null {
  if(text.length>20000 || /[\r\n]/.test(text)) return null;
  const match=text.trim().match(/^(?:please\s+)?(?:(?:create|add)\s+(?:a\s+)?(?:task|reminder)\s*:?\s+|remind\s+me\s+to\s+)(.+)$/i);
  if(!match) return null;
  let rest=match[1].trim(), title:string;
  if(/^["“]/.test(rest)) {
    const quoted=rest.match(/^["“]([^"”]+)["”](.*)$/);
    if(!quoted)return null;
    title=quoted[1].trim();rest=quoted[2].trim();
  } else {
    const split=rest.match(/^(.*?)(\s+(?:by|on)\s+\d{4}-\d{2}-\d{2}|\s+for\s+|\s+source\s+https?:\/\/|$)/i);
    if(!split)return null;
    title=split[1].trim();rest=rest.slice(split[1].length).trim();
  }
  let dueDate:string|null=null,sourceUrl:string|null=null,target:string|null=null;
  const date=rest.match(/(?:^|\s)(?:by|on)\s+(\d{4}-\d{2}-\d{2})(?=\s|$)/i);
  if(date){ if(!PersonalDateSchema.safeParse(date[1]).success)return null;dueDate=date[1];rest=rest.replace(date[0]," ").trim(); }
  const source=rest.match(/(?:^|\s)source\s+(https?:\/\/\S+)$/i);
  if(source){sourceUrl=source[1];rest=rest.replace(source[0],"").trim();}
  if(rest){const forCourse=rest.match(/^for\s+(.+)$/i);if(!forCourse)return null;target=forCourse[1].trim();}
  if(!title || title.length>240 || /[?]/.test(title) || /\[\[|ignore (?:all|previous)|system prompt/i.test(title))return null;
  return {title,dueDate,target,sourceUrl};
}
export function authorizeTaskInput(command:ExplicitTaskInstruction,input:unknown,applications:{id:string;name:string}[]):ManualTaskInput {
  const task=ManualTaskSchema.parse(input);
  if(task.title!==command.title || task.dueDate!==command.dueDate || task.sourceUrl!==command.sourceUrl || task.description!==null)
    throw new Error("The task must match your explicit request. Use a personal task form to add more details.");
  const matches=command.target?applications.filter(a=>a.id===command.target||a.name.toLowerCase()===command.target!.toLowerCase()):[];
  if(command.target && matches.length!==1)throw new Error("Which tracked course? Use its exact unique course name or application ID.");
  const applicationId=matches[0]?.id??null;
  if(task.applicationId!==applicationId)throw new Error("The task's course must match your explicit request.");
  return task;
}
