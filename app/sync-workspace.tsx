"use client";
import {useEffect,useRef,useState} from "react";
import {Button} from "@/components/ui/button";
import type {Snapshot} from "@/lib/governance/types";
import type {ActivityReport} from "@/lib/governance/staleness";
type Location={id:string;name:string};
export default function SyncWorkspace({onComplete}:{onComplete:(s:Snapshot,a:ActivityReport)=>void}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[configured,setConfigured]=useState<boolean|null>(null);
 const abort=useRef<AbortController|null>(null);
 useEffect(()=>{const a=new AbortController();fetch("/api/sync",{signal:a.signal}).then(async r=>await r.json() as {configured?:boolean}).then(d=>setConfigured(d.configured===true)).catch(()=>{});return()=>{a.abort();abort.current?.abort();};},[]);
 async function sync(){
  const controller=new AbortController();abort.current=controller;setBusy(true);setMessage("Connecting to ClickUp…");
  async function step(kind:string,extra:Record<string,unknown>={}){
   const r=await fetch("/api/sync",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,...extra}),signal:controller.signal});const d=await r.json() as Record<string, any>;if(!r.ok)throw Error(d.error||"Sync failed");return d;
  }
  try{
   const h=await step("hierarchy");const snapshot:Snapshot={schemaVersion:1,workspaceId:h.workspaceId,capturedAt:"",source:"ClickUp API · manual dashboard sync",spaces:h.spaces,folders:[],lists:[],workspaceFields:h.workspaceFields};
   const add=(l:Location,s:Location,f:Location|null)=>snapshot.lists.push({...l,spaceId:s.id,spaceName:s.name,folderId:f?.id??null,folderName:f?.name??null,statuses:null,fields:null,content:null,settings:{statusInheritance:"unknown",views:"not collected",nativeAutomations:"unavailable",clickApps:"See exported Space settings"}});
   for(const [index,s] of snapshot.spaces.entries()){
    setMessage("Reading Space "+(index+1)+"/"+snapshot.spaces.length+": "+s.name);
    const d=await step("space",{id:s.id});s.fields=d.fields;
    for(const l of d.lists as Location[])add(l,s,null);
    for(const f of d.folders as Location[]){
     const fd=await step("folder",{id:f.id});snapshot.folders.push({...f,spaceId:s.id,fields:fd.fields});
     for(const l of fd.lists as Location[])add(l,s,f);
    }
   }
   snapshot.lists=[...new Map(snapshot.lists.map(l=>[l.id,l])).values()];
   for(const [i,l]of snapshot.lists.entries()){setMessage("Reading List "+(i+1)+"/"+snapshot.lists.length+": "+l.name);Object.assign(l,await step("list",{id:l.id}));}
   const report:ActivityReport={checkedAt:null,pages:0,total:0,activity:{},complete:false,scope:"Accessible home-List tasks including closed tasks and subtasks. Task update timestamps only; List-only edits, deleted/archived tasks, and tasks linked from other home Lists may be excluded."};
   for(let page=0;;page++){
    setMessage("Reading activity: "+report.total.toLocaleString()+" tasks scanned…");
    const d=await step("tasks",{page});report.pages++;
    for(const t of d.tasks as {listId?:string;dateUpdated:string|null}[]){
     if(!t.listId)throw Error("Task missing List identity; sync not applied.");
     const id=String(t.listId);const a=report.activity[id]??={lastActivityAt:null,tasksScanned:0,missingDates:0};a.tasksScanned++;report.total++;
     const n=Number(t.dateUpdated);if(t.dateUpdated&&n>0&&Number.isFinite(new Date(n).getTime())){const iso=new Date(n).toISOString();if(!a.lastActivityAt||iso>a.lastActivityAt)a.lastActivityAt=iso;}else a.missingDates++;
    }
    if(d.done)break;
   }
   if(controller.signal.aborted)throw new DOMException("Cancelled","AbortError");
   snapshot.capturedAt=new Date().toISOString();report.checkedAt=snapshot.capturedAt;report.complete=true;
   onComplete(snapshot,report);setConfigured(true);setMessage("Synced "+snapshot.lists.length+" Lists. Updated this session only; export before reloading.");
  }catch(e){setMessage(e instanceof Error&&e.name==="AbortError"?"Sync cancelled. Previous data retained.":(e instanceof Error?e.message.replace(/\.$/,""):"Sync failed")+". Previous data retained.");}
  finally{setBusy(false);abort.current=null;}
 }
 return <div className="panel mb-5"><div className="topline"><div><strong>Workspace connection</strong><p className="subtle">{configured===false?"ClickUp API token required in Vercel to enable refresh.":"Refresh hierarchy, standards data, and task activity. Large workspaces can take several minutes."}</p></div><div className="flex gap-2"><Button onClick={sync} disabled={busy}>{busy?"Syncing…":"Sync workspace"}</Button>{busy&&<Button variant="outline" onClick={()=>abort.current?.abort()}>Cancel</Button>}</div></div>{message&&<p className="subtle mt-3" role="status" aria-live="polite">{message}</p>}</div>;
}
