/**
 * Offline, GET-only ClickUp snapshot refresh. Token never enters app code.
 * Requires Node 22+, CLICKUP_API_TOKEN, optional CLICKUP_WORKSPACE_ID.
 */
import {writeFile,rename,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
const token=process.env.CLICKUP_API_TOKEN;
const workspaceId=process.env.CLICKUP_WORKSPACE_ID||"1230709";
if(!token)throw Error("Set CLICKUP_API_TOKEN in your local environment; never put it in browser code.");
if(!/^\d+$/.test(workspaceId))throw Error("Workspace ID must contain digits only");
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let lastRequest=0;
async function get(path){
 if(!/^\/(team|space|folder|list)(\/|$)/.test(path))throw Error("Read path not allowed");
 for(let attempt=0;attempt<5;attempt++){
  await delay(Math.max(0,650-(Date.now()-lastRequest)));lastRequest=Date.now();
  const response=await fetch("https://api.clickup.com/api/v2"+path,{method:"GET",headers:{Authorization:token},signal:AbortSignal.timeout(30000)});
  if(response.status===429||response.status>=500){
   const seconds=Number(response.headers.get("retry-after")||0);
   await delay(Math.max(seconds*1000,1000*2**attempt));continue;
  }
  if(!response.ok)throw Error("ClickUp read failed ("+response.status+") for "+path);
  return response.json();
 }
 throw Error("Retry limit reached for "+path);
}
function array(value,label){if(!Array.isArray(value))throw Error("Missing "+label+" collection; snapshot not replaced");return value;}
const errors=[];
async function fields(path){try{return array((await get(path)).fields,"fields");}catch(e){errors.push(e.message);return null;}}
const teams=array((await get("/team")).teams,"workspaces");
if(!teams.some(t=>String(t.id)===workspaceId))throw Error("Token cannot access the selected workspace");
const sourceSpaces=array((await get("/team/"+workspaceId+"/space?archived=false")).spaces,"spaces");
const spaces=[],folders=[],lists=[],seen=new Set();
for(const s of sourceSpaces){
 const spaceId=String(s.id);
 spaces.push({id:spaceId,name:s.name,settings:{features:s.features??null,private:s.private??null,statuses:s.statuses??null},fields:await fields("/space/"+spaceId+"/field")});
 const fs=array((await get("/space/"+spaceId+"/folder?archived=false")).folders,"folders");
 const locations=[{id:null,name:null,lists:array((await get("/space/"+spaceId+"/list?archived=false")).lists,"folderless lists")}];
 for(const f of fs){
  const id=String(f.id);folders.push({id,name:f.name,spaceId,parentFolderId:f.parent_folder??null,fields:await fields("/folder/"+id+"/field")});
  locations.push({id,name:f.name,lists:array((await get("/folder/"+id+"/list?archived=false")).lists,"folder lists")});
 }
 for(const folder of locations)for(const l of folder.lists){
  const id=String(l.id);if(seen.has(id))continue;seen.add(id);
  const record={id,name:l.name,spaceId,spaceName:s.name,folderId:folder.id,folderName:folder.name,content:null,statuses:null,fields:null,errors:[],settings:{statusInheritance:"unknown",views:"not collected",nativeAutomations:"unavailable",clickApps:"see captured Space settings"}};
  try{const detail=await get("/list/"+id);record.name=detail.name;record.content=typeof detail.content==="string"?detail.content:null;record.statuses=Array.isArray(detail.statuses)?detail.statuses:null;record.url="https://app.clickup.com/"+workspaceId+"/v/l/li/"+id;}catch(e){record.errors.push(e.message);}
  record.fields=await fields("/list/"+id+"/field");lists.push(record);
 }
 console.log("Read "+s.name+": "+lists.length+" Lists collected");
}
const snapshot={schemaVersion:1,workspaceId,capturedAt:new Date().toISOString(),source:"ClickUp public API GET-only importer",spaces,folders,lists,workspaceFields:await fields("/team/"+workspaceId+"/field"),coverage:{hierarchy:"Active accessible Spaces, Folders and Lists; archived=false",scopeErrors:errors,failedDetails:lists.filter(l=>l.errors.length).length}};
const path=resolve("data/snapshot.json");await mkdir(resolve("data"),{recursive:true});
await writeFile(path+".tmp",JSON.stringify(snapshot));await rename(path+".tmp",path);
console.log("Saved "+spaces.length+" Spaces, "+folders.length+" Folders and "+lists.length+" Lists. Review coverage errors, run tests and rebuild to publish this snapshot.");
