import {sleep} from "workflow";
import {storage} from "@/lib/control-room/db";
import {commandPath,applyResponse} from "@/lib/control-room/sync-machine";

export async function syncWorkspace(jobId:string){
 "use workflow";
 try{while(!(await advance(jobId)))await sleep("1s");}
 catch{await recordFailure(jobId);}
}
async function advance(jobId:string){
 "use step";
 const db=await storage(),claim=await db.claim(jobId);
 if(!claim)return true;if(claim==="busy")return false;
 try{
  const token=process.env.CLICKUP_API_TOKEN;if(!token)throw Error("ClickUp token missing");
  const state=claim.state;
  // Each durable step performs at most four bounded GETs, then saves one checkpoint.
  for(let i=0;i<4&&!state.complete;i++){
   await new Promise(resolve=>setTimeout(resolve,700));
   const r=await fetch("https://api.clickup.com/api/v2"+commandPath(state),{method:"GET",headers:{Authorization:token},cache:"no-store",signal:AbortSignal.timeout(8000)});
   if(!r.ok)throw Error("ClickUp read failed: "+r.status);
   applyResponse(state,await r.json(),new Date().toISOString());
  }
  const applied=await db.checkpoint(jobId,claim.lease,state);
  return !applied||state.complete;
 }catch(e){await db.release(jobId,claim.lease);throw e;}
}
async function recordFailure(jobId:string){
 "use step";
 await (await storage()).fail(jobId);
}
