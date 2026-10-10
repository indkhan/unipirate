import { createHash,timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { createBackgroundWorker } from "@/lib/db/server";
import { executePlanningBatch } from "@/lib/planning/worker";
import { boundedJson } from "@/lib/ai/research-course";
export const runtime="nodejs";
export const maxDuration=120;
export async function POST(request:Request){
 let credential:string|undefined;
 try{credential=getServerEnv().PLANNING_WORKER_SECRET;}catch{return Response.json({error:"Worker unavailable"},{status:503});}
 if(!credential)return Response.json({error:"Worker unavailable"},{status:503});
 const authorization=request.headers.get("authorization")??"";
 const hash=(value:string)=>createHash("sha256").update(value).digest();
 if(authorization.length>600||!timingSafeEqual(hash(authorization),hash(`Bearer ${credential}`)))return Response.json({error:"Unauthorized"},{status:401});
 try{z.object({}).strict().parse(await boundedJson(request,1024));}catch{return Response.json({error:"Invalid request"},{status:400});}
 try{
  const results=await executePlanningBatch(createBackgroundWorker());
  return Response.json({processed:results.length,succeeded:results.filter(result=>result.status==="succeeded").length,retry:results.filter(result=>result.status!=="succeeded").length},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Worker temporarily unavailable; saved jobs remain queued."},{status:503});}
}
