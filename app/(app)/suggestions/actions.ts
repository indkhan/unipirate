"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {requireUser} from "@/lib/auth/session";
import {approveTaskProposals,dismissTaskProposal,retryPlanningJob} from "@/lib/db/queries";
export async function approveSuggestions(input:unknown){
  const {db}=await requireUser();
  try{const result=await approveTaskProposals(db,input);revalidatePath("/suggestions");revalidatePath("/dashboard");revalidatePath("/courses","layout");return result;}
  catch{throw new Error("These suggestions changed or could not be confirmed. Refresh the list and review them again.");}
}
export async function rejectSuggestion(input:unknown){
  const {id,revision}=z.object({id:z.string().uuid(),revision:z.number().int().positive()}).strict().parse(input);
  const {db}=await requireUser();await dismissTaskProposal(db,id,revision);revalidatePath("/suggestions");
}
export async function retrySuggestionJob(input:unknown){
  const {id}=z.object({id:z.string().uuid()}).strict().parse(input);const {db,user}=await requireUser();
  await retryPlanningJob(db,user.id,id);revalidatePath("/dashboard");revalidatePath("/suggestions");
}
