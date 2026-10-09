import {NextRequest,NextResponse} from "next/server";
import {accessState} from "@/lib/access";
export const runtime="nodejs";
export const maxDuration=60;
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
const allowed=(r:NextRequest)=>accessState(r.headers.get("authorization"))==="allowed";
export async function GET(r:NextRequest){if(!allowed(r))return json({error:"Unauthorized"},401);return json({configured:!!process.env.CLICKUP_API_TOKEN});}
export async function POST(r:NextRequest){
 if(!allowed(r))return json({error:"Unauthorized"},401);
 const origin=r.headers.get("origin");
 if(!origin||!/^https?:$/.test(URL.canParse(origin)?new URL(origin).protocol:"")||new URL(origin).host!==r.headers.get("host"))return json({error:"Same-origin requests required"},403);
 const token=process.env.CLICKUP_API_TOKEN;if(!token)return json({error:"Add CLICKUP_API_TOKEN to this Vercel project's environment variables, then redeploy to enable sync."},503);
 const workspace=process.env.CLICKUP_WORKSPACE_ID||"1230709";
 if(!/^\d+$/.test(workspace))return json({error:"Invalid workspace configuration"},503);
 async function get(path:string){
  for(let attempt=0;attempt<2;attempt++){
   await new Promise(r=>setTimeout(r,650+attempt*1500));
   const response=await fetch("https://api.clickup.com/api/v2"+path,{headers:{Authorization:token!},cache:"no-store",signal:AbortSignal.timeout(8000)});
   if(response.status===429||response.status>=500){if(attempt===1)throw Error("ClickUp is busy or rate-limited. Retry sync shortly.");continue;}
   if(!response.ok)throw Error("ClickUp read failed (HTTP "+response.status+"). Check token permissions.");
   return await response.json() as Record<string, any>;
  }
  throw Error("ClickUp retry limit reached");
 }
 try{
  const body=await r.json() as {kind:string;id?:string;page:number};const id=String(body.id??"");
  if(["space","folder","list"].includes(body.kind)&&!/^\d+$/.test(id))return json({error:"Invalid location ID"},400);
  if(body.kind==="hierarchy"){
   const s=await get("/team/"+workspace+"/space?archived=false"),f=await get("/team/"+workspace+"/field");
   if(!Array.isArray(s.spaces)||!Array.isArray(f.fields))throw Error("Incomplete hierarchy response");
   return json({workspaceId:workspace,spaces:s.spaces.map((x:{id:string;name:string;features:unknown;statuses:unknown})=>({id:String(x.id),name:x.name,settings:{features:x.features??null,statuses:x.statuses??null}})),workspaceFields:f.fields});
  }
  if(body.kind==="space"){
   const f=await get("/space/"+id+"/folder?archived=false"),l=await get("/space/"+id+"/list?archived=false"),fields=await get("/space/"+id+"/field");
   if(!Array.isArray(f.folders)||!Array.isArray(l.lists)||!Array.isArray(fields.fields))throw Error("Incomplete Space response");
   return json({folders:f.folders.map((x:{id:string;name:string})=>({id:String(x.id),name:x.name})),lists:l.lists.map((x:{id:string;name:string})=>({id:String(x.id),name:x.name})),fields:fields.fields});
  }
  if(body.kind==="folder"){
   const l=await get("/folder/"+id+"/list?archived=false"),f=await get("/folder/"+id+"/field");
   if(!Array.isArray(l.lists)||!Array.isArray(f.fields))throw Error("Incomplete Folder response");
   return json({lists:l.lists.map((x:{id:string;name:string})=>({id:String(x.id),name:x.name})),fields:f.fields});
  }
  if(body.kind==="list"){
   const l=await get("/list/"+id),f=await get("/list/"+id+"/field");
   if(!Array.isArray(l.statuses)||!Array.isArray(f.fields))throw Error("Incomplete List response");
   return json({name:l.name,content:typeof l.content==="string"?l.content:null,statuses:l.statuses,fields:f.fields,url:"https://app.clickup.com/"+workspace+"/v/l/li/"+id});
  }
  if(body.kind==="tasks"){
   if(!Number.isInteger(body.page)||body.page<0)return json({error:"Invalid page"},400);
   const d=await get("/team/"+workspace+"/task?include_closed=true&subtasks=true&order_by=updated&page="+body.page);
   if(!Array.isArray(d.tasks))throw Error("Incomplete activity response");
   return json({done:d.last_page===true||d.tasks.length===0,tasks:d.tasks.map((t:{list?:{id:string};date_updated?:string})=>({listId:t.list?.id,dateUpdated:t.date_updated??null}))});
  }
  return json({error:"Unknown sync step"},400);
 }catch(e){return json({error:e instanceof Error?e.message:"Sync failed; previous data retained"},502);}
}
