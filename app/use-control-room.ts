"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {Bundle,ControlState} from "@/lib/control-room/types";
export function useControlRoom(initialId:string|null,onBundle:(bundle:Bundle)=>void){
 const [state,setState]=useState<ControlState|null>(null);
 const id=useRef(initialId),sequence=useRef(0),active=useRef(false),callback=useRef(onBundle);
 useEffect(()=>{callback.current=onBundle;},[onBundle]);
 const refresh=useCallback(async()=>{
  const seq=++sequence.current;
  try{
   const response=await fetch("/api/control-room?snapshot="+encodeURIComponent(id.current??""),{cache:"no-store"});
   const data=await response.json() as ControlState&{bundle?:Bundle;error?:string};
   if(seq!==sequence.current)return;
   if(!response.ok||data.storage==="error")throw Error(data.error||"Could not refresh the control room.");
   active.current=data.jobs.some(j=>j.status==="running"||j.status==="queued");setState(data);if(data.bundle){id.current=data.bundle.id;callback.current(data.bundle);}
  }catch(e){if(seq!==sequence.current)return;setState(previous=>({...previous,storage:"error",tokenConfigured:previous?.tokenConfigured??false,reviews:previous?.reviews??[],events:previous?.events??[],jobs:previous?.jobs??[],snapshotId:previous?.snapshotId??null,lastSuccessfulSync:previous?.lastSuccessfulSync??null,error:e instanceof Error?e.message:"Connection failed"}));}
 },[]);
 useEffect(()=>{let stopped=false;let timer:ReturnType<typeof setTimeout>;async function poll(){if(document.visibilityState!=="hidden")await refresh();if(!stopped)timer=setTimeout(poll,active.current?5000:60000);}void poll();return()=>{stopped=true;clearTimeout(timer);sequence.current++;};},[refresh]);
 return {state,refresh};
}
