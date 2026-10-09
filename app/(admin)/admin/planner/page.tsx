import Link from "next/link";
import {requireAdmin} from "@/lib/auth/session";
import {getAdminPlannerSettings} from "@/lib/db/admin-queries";
import {listFreePlannerModels} from "@/lib/ai/planner-catalog";
import {PlannerModelForm} from "./model-form";
import styles from "../../../(app)/dashboard/dashboard.module.css";
export const dynamic="force-dynamic";
export default async function PlannerSettingsPage(){
  const {db}=await requireAdmin();const settings=await getAdminPlannerSettings(db);
  const models=await listFreePlannerModels().catch(()=>null);
  return <main className={styles.container} style={{paddingBlock:48}}><Link href="/admin">← Admin workspace</Link>
    <h1>Planner model</h1><p>The planner uses free inference only. If a model becomes unavailable or exhausts its quota, work stays saved for retry.</p>
    <p>Current selection: {settings.planner_model??"None"}</p>
    {models?<PlannerModelForm models={models} current={settings.planner_model}/>:<p role="status">The catalogue is unavailable. Refresh to try again; your selection stays saved.</p>}
    <p>Automatic planning: {settings.enabled?"Enabled":"Awaiting rollout"}</p>
    <p>Students review every automatic suggestion. Shared course research and templates stay in the admin workspace; students’ personal tasks, edits and suggestions stay private.</p>
  </main>;
}
