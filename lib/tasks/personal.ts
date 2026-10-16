import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { z } from "zod";
import { createHash } from "node:crypto";
import { createPersonalTaskReceipt } from "@/lib/db/queries";
import { ManualTaskSchema,TaskReceiptSchema,type TaskReceipt } from "./manual";
export function personalTaskOperationId(userId:string,messageId:string):string {
  const hash=createHash("sha256").update(`${userId}:${messageId}`).digest("hex").slice(0,32);
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20)}`;
}
export async function createPersonalTask(db:Pick<SupabaseClient<Database>,"rpc">,userId:string,input:unknown,operation:{operationId:string;instruction:string}):Promise<TaskReceipt>{
  z.string().uuid().parse(userId);
  const task=ManualTaskSchema.parse(input);
  const request=z.object({operationId:z.string().uuid(),instruction:z.string().min(1).max(20000)}).strict().parse(operation);
  try {return TaskReceiptSchema.parse(await createPersonalTaskReceipt(db,request.operationId,request.instruction,task));}
  catch { return {status:"failed",error:"The task was not confirmed. Retry this request to check its saved receipt."}; }
}
