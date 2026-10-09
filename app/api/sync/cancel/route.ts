import {z} from "zod";
import {guard,json} from "@/lib/control-room/http";
import {storage,workspaceId} from "@/lib/control-room/db";
export async function POST(r:Request){
 const denied=guard(r,true);if(denied)return denied;
 const body=z.object({jobId:z.string().uuid()}).safeParse(await r.json().catch(()=>null));if(!body.success)return json({error:"Invalid sync ID"},400);
 try{const cancelled=await (await storage()).cancel(workspaceId(),body.data.jobId);return json({cancelled});}
 catch{return json({error:"Could not cancel sync. Try again."},503);}
}
