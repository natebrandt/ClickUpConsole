import {start} from "workflow/api";
import {syncWorkspace} from "@/workflows/sync";
import {storage,hasDatabase,workspaceId} from "@/lib/control-room/db";
import {initialSync} from "@/lib/control-room/sync-machine";
import {guard,json} from "@/lib/control-room/http";
export const runtime="nodejs";
export const maxDuration=60;
export async function GET(r:Request){const denied=guard(r);if(denied)return denied;return json({configured:!!process.env.CLICKUP_API_TOKEN,storageConfigured:hasDatabase()});}
export async function POST(r:Request){
 const denied=guard(r,true);if(denied)return denied;
 if(!process.env.CLICKUP_API_TOKEN)return json({error:"Add CLICKUP_API_TOKEN to Vercel and redeploy to enable sync."},503);
 if(!hasDatabase())return json({error:"Connect a Postgres database in Vercel and redeploy to enable persistent background sync."},503);
 try{
  const db=await storage(),workspace=workspaceId(),job=await db.createJob(workspace,initialSync(workspace));
  if(job.created){
   try{const run=await start(syncWorkspace,[job.id]);await db.attachWorkflow(job.id,run.runId);}
   catch{await db.fail(job.id);return json({error:"Could not queue background sync. Please try again."},503);}
  }
  return json({jobId:job.id,alreadyRunning:!job.created},202);
 }catch{return json({error:"Database unavailable. Existing saved data has not changed."},503);}
}
