"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {changePlannerModel} from "./actions";
import styles from "./planner.module.css";
export function PlannerModelForm({models,current}:{models:{id:string;name:string}[];current:string|null}){
  const [model,setModel]=useState(current??""),[error,setError]=useState<string|null>(null),[pending,start]=useTransition();const router=useRouter();
  return <form className={styles.form} onSubmit={event=>{event.preventDefault();start(async()=>{setError(null);try{await changePlannerModel({model});router.refresh();}catch(e){setError(e instanceof Error?e.message:"The model was not saved. Try again.");}});}}>
    <label>Free planner model <select aria-label="Free planner model" value={model} onChange={event=>setModel(event.target.value)} required>
      <option value="">Choose a model</option>{models.map(entry=><option key={entry.id} value={entry.id}>{entry.name}</option>)}
    </select></label> <button type="submit" disabled={pending||!model}>{pending?"Saving…":"Save planner model"}</button>
    {error?<p role="alert">{error}</p>:null}
  </form>;
}
