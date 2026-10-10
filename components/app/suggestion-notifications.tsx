"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {z} from "zod";
import {TaskProposalSchema,type TaskProposal} from "@/lib/planning/proposals";
import {SuggestionsList,ProposalPopup,type ApproveSelectionItem} from "./task-suggestions";
import {approveSuggestions,rejectSuggestion,retrySuggestionJob} from "@/app/(app)/suggestions/actions";
const Job=z.object({id:z.string().uuid(),application_id:z.string().uuid().nullable(),event:z.enum(["research","preliminary","verified"]),state:z.enum(["queued","running","succeeded","failed"])});
const Envelope=z.object({proposals:z.array(TaskProposalSchema),applicationNames:z.record(z.string()),jobs:z.array(Job).default([])});
export function SuggestionNotifications({full=false,popup=true,initialProposals=[],initialNames={}}:{full?:boolean;popup?:boolean;initialProposals?:TaskProposal[];initialNames?:Record<string,string>}){
  const [proposals,setProposals]=useState(initialProposals),[names,setNames]=useState(initialNames);
  const [closed,setClosed]=useState<string[]>([]),[error,setError]=useState<string|null>(null);
  const [jobs,setJobs]=useState<z.infer<typeof Job>[]>([]),[retrying,setRetrying]=useState<string|null>(null);
  const retryBusy=useRef(false);
  const refreshGeneration=useRef(0);
  const router=useRouter();
  const revisionKey=(p:TaskProposal)=>`${p.id}:${p.revision}`;
  function invalidateRefresh(){refreshGeneration.current++;}
  async function refresh(){
    const generation=++refreshGeneration.current;
    try{
      const response=await fetch("/api/suggestions",{cache:"no-store"});
      if(generation!==refreshGeneration.current)return;
      if(!response.ok)throw new Error("Suggestions are temporarily unavailable. They remain saved.");
      const next=Envelope.parse(await response.json());
      if(generation!==refreshGeneration.current)return;
      setProposals(next.proposals);setNames(next.applicationNames);setJobs(next.jobs);setError(null);
    }catch(error){if(generation===refreshGeneration.current)throw error;}
  }
  useEffect(()=>{
    let active=true;
    const update=()=>{if(document.visibilityState==="visible"&&active)void refresh().catch(e=>{if(active)setError(e instanceof Error?e.message:"Refresh suggestions to try again.");});};
    update();const timer=setInterval(update,10000);document.addEventListener("visibilitychange",update);
    return()=>{active=false;invalidateRefresh();clearInterval(timer);document.removeEventListener("visibilitychange",update);};
  },[]);
  async function approve(selection:ApproveSelectionItem[]){
    // One DB transaction per bounded batch; list is an explicit shown snapshot.
    // The UI retains failures; no new arrival can join this selection.
    let confirmed=0;
    try{for(let start=0;start<selection.length;start+=100){const batch=selection.slice(start,start+100);await approveSuggestions(batch.map(item=>({...item,...(item.edit?{edit:{title:item.edit.title,description:item.edit.description,due_date:item.edit.dueDate}}:{})})));confirmed+=batch.length;}}
    catch(error){await refresh().catch(()=>{});router.refresh();throw new Error(confirmed?`${confirmed} suggestions were confirmed. The remaining suggestions changed or could not be confirmed; review the refreshed list.`:error instanceof Error?error.message:"Approval could not be confirmed. Refresh to check saved results.");}
    await refresh();router.refresh();
  }
  async function reject(id:string,revision:number){await rejectSuggestion({id,revision});await refresh();router.refresh();}
  async function retry(id:string){
    if(retryBusy.current)return;
    retryBusy.current=true;
    setRetrying(id);setError(null);
    try{await retrySuggestionJob({id});await refresh();}
    catch{setError("The retry could not be confirmed. Your saved work remains available.");}
    finally{retryBusy.current=false;setRetrying(null);}
  }
  const pending=proposals.filter(p=>p.status==="pending");
  if(full)return <>{error?<p role="status">{error}</p>:null}
    {jobs.filter(job=>job.state==="failed"&&job.event!=="research").map(job=><p key={job.id} role="status">Suggestions for {job.application_id?names[job.application_id]??"your course":"your application"} could not be prepared. Your tasks stay saved. <button type="button" disabled={retrying!==null} onClick={()=>void retry(job.id)}>{retrying===job.id?"Retrying…":"Retry planning"}</button></p>)}
    <SuggestionsList proposals={proposals} applicationNames={names} approve={approve} reject={reject}/></>;
  const arrivals=pending.filter(p=>!closed.includes(revisionKey(p)));
  return <><Link href="/suggestions">Suggestions{pending.length?` (${pending.length})`:""}</Link>
    {popup&&arrivals.length?<ProposalPopup proposals={arrivals} applicationNames={names} approve={approve} reject={reject} onClose={()=>setClosed(prior=>[...prior,...arrivals.map(revisionKey)])}/>:null}</>;
}
