import {guard,json} from "@/lib/control-room/http";
import {storage,hasDatabase,workspaceId} from "@/lib/control-room/db";
export async function GET(r:Request){
 const denied=guard(r);if(denied)return denied;
 const base={tokenConfigured:!!process.env.CLICKUP_API_TOKEN,reviews:[],events:[],jobs:[],snapshotId:null,lastSuccessfulSync:null};
 if(!hasDatabase())return json({...base,storage:"missing"});
 try{
  const db=await storage(),workspace=workspaceId();
  const [meta,reviews,events,jobs]=await Promise.all([db.latestMeta(workspace),db.reviews(workspace),db.events(workspace),db.jobs(workspace)]);
  const bundle=meta&&new URL(r.url).searchParams.get("snapshot")!==meta.id?await db.latest(workspace):null;
  return json({...base,storage:"ready",reviews,events,jobs,snapshotId:meta?.id??null,lastSuccessfulSync:meta?.createdAt??null,
   ...(bundle&&new URL(r.url).searchParams.get("snapshot")!==bundle.id?{bundle}:{})});
 }catch{return json({...base,storage:"error",error:"Saved data is temporarily unavailable. Showing the last loaded snapshot."},503);}
}
