"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import type {RailApplication} from "@/lib/tasks/view";
import type {ProcessFact} from "@/lib/tasks/offering-process";
import {selectApplicationOffering} from "./actions";
import styles from "./dashboard.module.css";

function FactEvidence({fact}:{fact:ProcessFact}) {
 return <details><summary>Source evidence</summary><p>{fact.verbatim}</p><p>Applies to: {fact.applicability}</p>{fact.evidence.map((e,i)=><div key={i}><a href={e.source_url} target="_blank" rel="noreferrer">{e.source_url}</a><blockquote>{e.source_quote}</blockquote><p>Retrieved: {e.retrieved_at} · Verified: {e.last_verified_at ?? "Unverified capture"}</p></div>)}</details>;
}
export function OfferingSelection({applicationId,context}:{applicationId:string;context:NonNullable<RailApplication["offeringProcess"]>}) {
 const router=useRouter();const [offeringId,setOfferingId]=useState(context.selection.offering_id ?? "");
 const [confirmed,setConfirmed]=useState(context.selection.applicant_context!==null);const [error,setError]=useState<string|null>(null);const [pending,startTransition]=useTransition();
 const selected=context.offerings.find(o=>o.id===offeringId);const plan=context.plan;
 return <section aria-label="Application procedure">
  <h3>Application procedure</h3>
  <form onSubmit={event=>{event.preventDefault();setError(null);startTransition(async()=>{try {await selectApplicationOffering({id:applicationId,selection:selected?{offering_id:selected.id,applicant_context:{applicant_group:selected.applicant_group,confirmed:true}}:{offering_id:null,applicant_context:null}});router.refresh();} catch {setError("Could not save this selection. Reload and confirm the offering and applicant group.");}});}}>
   <label>Intake and applicant group<select className={styles.statusSelect} value={offeringId} disabled={pending} onChange={e=>{setOfferingId(e.target.value);setConfirmed(false);}}><option value="">Not selected / not sure</option>{context.offerings.map(o=><option key={o.id} value={o.id}>{o.intake_term} {o.intake_year} · {o.applicant_group}</option>)}</select></label>
   {selected?<label><input type="checkbox" checked={confirmed} disabled={pending} onChange={e=>setConfirmed(e.target.checked)}/> I report that “{selected.applicant_group}” applies to me for {selected.intake_term} {selected.intake_year}. This is my report, not an eligibility verification.</label>:null}
   <button className={styles.taskTextButton} type="submit" disabled={pending || !!selected && !confirmed}>{pending?"Saving…":"Save application context"}</button>
   {error?<p role="alert">{error}</p>:null}
  </form>
  {plan.offering?<p>{plan.offering.intake_term} {plan.offering.intake_year} · {plan.offering.applicant_group}</p>:null}
  {plan.reason?<p>{plan.reason}</p>:null}
  {plan.routeFact?<FactEvidence fact={plan.routeFact}/>:null}
  {plan.stages.map(stage=><div key={stage.kind}><h4>{stage.title}</h4>{stage.portal?.verbatim?<><a href={stage.portal.verbatim} target="_blank" rel="noreferrer">Application portal</a><FactEvidence fact={stage.portal}/></>:null}<p>{stage.deadlineLabel}: {stage.deadline?.verbatim ?? "Confirm with the official source"}</p>{stage.deadline?<><p>{stage.deadline.time ? "Source time: "+stage.deadline.time+" · Timezone: "+(stage.deadline.timezone ?? "not specified") : null}</p><FactEvidence fact={stage.deadline}/></>:null}{stage.confirmation?<p>{stage.confirmation}</p>:null}</div>)}
  {plan.route!=="unresolved"&&(plan.route!=="direct"||plan.fees.length>0)?<div><h4>Fee confirmation</h4><p>Confirm the payer, exemptions and applicable fees with the official source. Quoted guidance does not establish your personal amount or a payment instruction.</p>{plan.fees.map(f=><FactEvidence key={f.key} fact={f}/>)}</div>:null}
  {plan.officialSources.map(url=><p key={url}><a href={url} target="_blank" rel="noreferrer">Official source</a></p>)}
 </section>;
}
