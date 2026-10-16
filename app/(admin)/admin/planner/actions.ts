"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {requireAdmin} from "@/lib/auth/session";
import {requireFreePlannerModel} from "@/lib/ai/planner-catalog";
import {setAdminPlannerModel} from "@/lib/db/admin-queries";
export async function changePlannerModel(input:unknown){
  const {model}=z.object({model:z.string().min(1).max(200)}).strict().parse(input);
  const {db}=await requireAdmin();const entry=await requireFreePlannerModel(model);
  await setAdminPlannerModel(db,model,entry);revalidatePath("/admin/planner");
}
