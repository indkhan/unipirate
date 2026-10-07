import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AdminRule } from "@/lib/db/admin-queries";
import { meaningfulRuleDiff, preflightPublication } from "@/lib/rules/versioning";
import { cn } from "@/lib/utils";
import { reverifyRuleAction, updateRuleAction } from "./actions";
import { ActionButton } from "./action-button";
export const ruleStatuses=["draft","beta","verified"] as const;
function ReviewTokens({rule}:{rule:AdminRule}) {
 return <><input type="hidden" name="id" value={rule.id}/><input type="hidden" name="expected_revision" value={rule.draft.revision}/><input type="hidden" name="expected_raw_snapshot" value={JSON.stringify(rule.draft.raw_snapshot)}/><input type="hidden" name="expected_predecessor_id" value={rule.versions[0]?.id??""}/></>;
}
const scopeNames=["effective_from","effective_until","intake_from","intake_until"] as const;
export function RuleEditor({rule}:{rule:AdminRule|undefined;countries:readonly {code:string;name:string}[]}) {
 if(!rule)return <section className="rounded-lg border bg-card p-4"><h2 className="text-sm font-semibold">Rule workspace</h2><p>Select a rule to edit its draft and review immutable history.</p></section>;
 const predecessor=rule.versions[0];
 let validation:string|undefined;
 try{preflightPublication({rule_id:rule.id,revision:rule.draft.revision,raw_snapshot:rule.draft.raw_snapshot,predecessor_id:predecessor?.id??null,approval_status:"beta",confirmed:true});}catch(error){validation=error instanceof Error?error.message:"Invalid saved draft.";}
 return <section className="grid gap-5 rounded-lg border bg-card p-4">
  <div><h2 className="text-sm font-semibold">Rule workspace</h2><p className="font-mono text-xs">{rule.slug??rule.id}</p><p className="text-xs">Draft revision {rule.draft.revision} · Predecessor {predecessor?.id??"none"}</p></div>
  <form action={updateRuleAction} className="grid gap-3"><ReviewTokens rule={rule}/>
   <label className="grid gap-1 text-xs font-medium">Complete raw draft JSON<textarea name="raw_snapshot" required rows={22} defaultValue={JSON.stringify(rule.draft.raw_snapshot,null,2)} className="rounded-md border bg-background p-2 font-mono text-xs"/></label>
   <p className="text-xs text-muted-foreground">Keep status draft. Source verification is last_verified_at in this JSON: enter the actual verification timestamp, or null while unresolved. Preserve literal source URLs, quotes and claim text. Saving never approves or publishes.</p>
   {scopeNames.map(name=><label key={name} className="grid gap-1 text-xs font-medium">{name.startsWith("effective")?"UTC assessment date ":"Target intake index "}{name.endsWith("from")?"from (inclusive)":"until (exclusive)"}<input name={name} type={name.startsWith("effective")?"date":"number"} min={name.startsWith("intake")?2:undefined} max={name==="intake_until"?20000:name==="intake_from"?19999:undefined} step={name.startsWith("intake")?1:undefined} defaultValue={rule.draft[name]??""} className="h-8 rounded-md border bg-background px-2"/></label>)}
   <p className="text-xs">Intake index = year × 2 + summer 0 / winter 1. Empty bounds require explicit review as unbounded at publication. Assessment date is separate from APS submission and dMAT registration or dispatch.</p>
   <ActionButton pendingText="Saving…">Save draft</ActionButton>
  </form>
  <section className="grid gap-3 border-t pt-4"><h3 className="font-semibold">Review saved snapshot</h3>
   <p className="text-xs">Source verification: {rule.last_verified_at??"unverified"}. Publication time and reviewer are recorded by the database when publication succeeds.</p>
   <details><summary>Saved snapshot and literal evidence</summary><pre className="overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(rule.draft.raw_snapshot,null,2)}</pre></details>
   {(["beta","verified"] as const).map(status=>{const diff=meaningfulRuleDiff(predecessor??null,{...rule.draft,status});return <details key={status}><summary>Changes if published as {status} ({diff.length})</summary>{diff.length===0?<p className="text-xs">No content or scope changes; reverification still appends a new version.</p>:<ul className="grid gap-2 text-xs">{diff.map(change=><li key={change.field}><strong>{change.field}</strong><pre className="overflow-auto whitespace-pre-wrap">Before: {JSON.stringify(change.before,null,2)??"absent"}{"\n"}After: {JSON.stringify(change.after,null,2)??"absent"}</pre></li>)}</ul>}</details>;})}
   {validation&&<p className="whitespace-pre-wrap text-xs text-amber-900">Publication blocked until saved schema/evidence errors are fixed: {validation}</p>}
   <form action={reverifyRuleAction} className="grid gap-3"><ReviewTokens rule={rule}/>
    <label className="grid gap-1 text-xs font-medium">Explicit approval status<select name="approval_status" required defaultValue="" className="h-8 rounded-md border bg-background px-2"><option value="" disabled>Choose approval…</option><option value="beta">beta</option><option value="verified">verified</option></select></label>
    <label className="flex gap-2 text-xs"><input name="confirmed" type="checkbox" required/>I reviewed the saved snapshot, source verification, all changes and applicability bounds; empty bounds are explicitly unbounded.</label>
    <ActionButton pendingText="Publishing…" confirm="Append this reviewed snapshot as a new immutable rule version?">Publish reviewed snapshot</ActionButton>
   </form>
  </section>
  <section className="grid gap-3 border-t pt-4"><h3 className="font-semibold">Immutable version history</h3>{rule.versions.length===0&&<p className="text-xs">No published or captured history.</p>}{rule.versions.map(version=><details key={version.id}><summary>Version {version.version_number} · {version.provenance==="legacy_capture"?"Legacy capture — unknown historical scope":version.status}</summary><div className="grid gap-1 text-xs"><p>Version UUID: {version.id}</p><p>Predecessor: {version.supersedes_version_id??"none"}</p>{version.provenance==="legacy_capture"?<p>Captured: {version.captured_at}. Human review and publication history unavailable.</p>:<><p>Reviewer: {version.reviewed_by}</p><p>Reviewed: {version.reviewed_at}</p><p>Publication time: {version.published_at}</p></>}{version.provenance==="legacy_capture"?<p>Assessment and intake scope: unknown historical scope.</p>:<p>Assessment scope: [{version.effective_from??"unbounded"}, {version.effective_until??"unbounded"}) · Intake: [{version.intake_from??"unbounded"}, {version.intake_until??"unbounded"})</p>}<pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(version.raw_snapshot,null,2)}</pre></div></details>)}</section>
 </section>;
}
export function RulesTable({rules,selectedRuleId}:{rules:AdminRule[];selectedRuleId:string|undefined}) {
 return <div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="border-b bg-muted/60 text-xs"><tr>{["Rule / country","Draft revision","History head","Source verification","Action"].map(label=><th key={label} className="px-3 py-2">{label}</th>)}</tr></thead><tbody>{rules.map(rule=><tr key={rule.id} className={cn("border-b",selectedRuleId===rule.id&&"bg-muted/60")}><td className="px-3 py-2">{rule.slug??rule.id}<br/>{rule.country_code??"shared"}</td><td className="px-3 py-2">{rule.draft.revision} · draft</td><td className="px-3 py-2">{rule.versions[0]?.provenance==="legacy_capture"?"Legacy capture":rule.versions[0]?"v"+rule.versions[0].version_number+" · "+rule.versions[0].status:"No history"}</td><td className="px-3 py-2 text-xs">{rule.last_verified_at??"unverified"}</td><td className="px-3 py-2"><Button asChild variant="outline" size="sm"><Link href={"/admin?view=rules&rule="+rule.id}>Edit / review</Link></Button></td></tr>)}</tbody></table>{rules.length===0&&<p className="p-4 text-sm">No workspaces match these filters.</p>}</div>;
}
