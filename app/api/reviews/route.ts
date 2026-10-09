import {guard,json} from "@/lib/control-room/http";
import {storage,hasDatabase,workspaceId} from "@/lib/control-room/db";
import {reviewInput} from "@/lib/control-room/review-validation";
import {ConflictError} from "@/lib/control-room/storage";
import seed from "@/data/snapshot.json";
export async function GET(r:Request){
 const denied=guard(r);if(denied)return denied;
 const listId=new URL(r.url).searchParams.get("listId");if(!listId||!/^\d+$/.test(listId))return json({error:"Invalid List"},400);
 try{return json({events:await (await storage()).events(workspaceId(),listId)});}catch{return json({error:"Review history unavailable"},503);}
}
export async function POST(r:Request){
 const denied=guard(r,true);if(denied)return denied;
 if(!hasDatabase())return json({error:"Connect the database before saving review decisions."},503);
 const parsed=reviewInput.safeParse(await r.json().catch(()=>null));if(!parsed.success)return json({error:parsed.error.issues[0]?.message??"Invalid review"},400);
 try{
  const db=await storage(),workspace=workspaceId(),bundle=await db.latest(workspace);
  const snapshot=bundle?.snapshot??(seed.workspaceId===workspace?seed:null);
  if(!snapshot?.lists.some(l=>l.id===parsed.data.listId))return json({error:"This List is not in the current workspace snapshot. Refresh first."},409);
  const saved=await db.saveReview(workspace,parsed.data,process.env.ADMIN_USERNAME||"Local administrator");
  return json({review:saved});
 }catch(e){return e instanceof ConflictError?json({error:e.message},409):json({error:"Could not save review. Your changes have not been confirmed; refresh before retrying."},503);}
}
