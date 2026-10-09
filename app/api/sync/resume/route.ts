import {z} from "zod";
import {start} from "workflow/api";
import {syncWorkspace} from "@/workflows/sync";
import {guard,json} from "@/lib/control-room/http";
import {storage,workspaceId} from "@/lib/control-room/db";
export async function POST(r:Request){
 const denied=guard(r,true);if(denied)return denied;
 const body=z.object({jobId:z.string().uuid()}).safeParse(await r.json().catch(()=>null));if(!body.success)return json({error:"Invalid sync ID"},400);
 try{
  const db=await storage();if(!await db.resumable(workspaceId(),body.data.jobId))return json({error:"Sync is still active or already finished."},409);
  const run=await start(syncWorkspace,[body.data.jobId]);await db.attachWorkflow(body.data.jobId,run.runId);return json({resumed:true},202);
 }catch{return json({error:"Could not resume. Try again in two minutes or cancel and start a new sync."},503);}
}
