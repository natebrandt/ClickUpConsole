"use client";
import {useState} from "react";
import {Button} from "@/components/ui/button";
import type {ControlState} from "@/lib/control-room/types";
export const readableTime=(s:string|null|undefined)=>s?new Date(s).toLocaleString("en-US",{timeZone:"America/New_York",dateStyle:"medium",timeStyle:"short"}):"Not yet";
export default function SyncWorkspace({state,onRefresh}:{state:ControlState|null;onRefresh:()=>Promise<void>}){
 const [sending,setSending]=useState(false),[message,setMessage]=useState("");
 const active=state?.jobs.find(j=>j.status==="queued"||j.status==="running");
 async function action(path:string,body:unknown={}){
  setSending(true);setMessage("");
  try{const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error||"Request failed");await onRefresh();setMessage(path.endsWith("cancel")?"Cancellation recorded. Previous saved data is unchanged.":"Sync is running in the background. You can close this browser.");}
  catch(e){setMessage(e instanceof Error?e.message:"Request failed");}
  finally{setSending(false);}
 }
 const ready=state?.storage==="ready"&&state.tokenConfigured;
 return <section className="panel mb-5" aria-label="Workspace connection"><div className="topline"><div><strong>Workspace connection</strong><p className="subtle">{!state?"Checking connection…":state.storage==="missing"?"Connect a Postgres database to save reviews and run background sync.":state.storage==="error"?"Database connection needs attention. Existing data remains visible.":!state.tokenConfigured?"Database connected. Add the ClickUp API token to enable sync.":"Database connected · ClickUp reads only"}</p><p className="subtle">Last saved sync: {readableTime(state?.lastSuccessfulSync)}{state?.lastSuccessfulSync?" ET":" · using the deployed starting snapshot"}</p></div><div className="flex flex-wrap gap-2"><Button disabled={!ready||sending||!!active} onClick={()=>action("/api/sync")}>{sending?"Working…":active?"Sync in progress":"Sync workspace"}</Button>{active&&<><Button variant="outline" disabled={sending} onClick={()=>action("/api/sync/cancel",{jobId:active.id})}>Cancel sync</Button>{Date.now()-Date.parse(active.updatedAt)>120000&&<Button variant="outline" disabled={sending} onClick={()=>action("/api/sync/resume",{jobId:active.id})}>Resume sync</Button>}</>}</div></div>
 {active&&<p className="sync-progress" role="status">{active.progress} · continues when you close the browser</p>}
 {message&&<p className="subtle mt-3" role="status">{message}</p>}
 {state?.error&&<p className="error" role="alert">{state.error}</p>}
 {!!state?.jobs.length&&<details className="sync-history"><summary>Recent syncs</summary>{state.jobs.map(j=><div key={j.id} className="sync-history-row"><span className={"state "+(j.status==="completed"?"pass":j.status==="failed"?"critical":"unknown")}>{j.status}</span><span>{readableTime(j.createdAt)} ET</span><span>{j.error||j.progress}</span></div>)}</details>}
 </section>;
}
