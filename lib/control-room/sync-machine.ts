import type {Snapshot,Field,Status,ListRecord} from "../governance/types";
import type {ActivityReport} from "../governance/staleness";
type Command={kind:"spaces"|"workspaceFields"|"folders"|"folderLists"|"spaceLists"|"spaceFields"|"folderFields"|"list"|"listFields"|"tasks";id?:string;spaceId?:string;folderId?:string;page?:number};
export type SyncState={snapshot:Snapshot;activity:ActivityReport;queue:Command[];stage:"configuration"|"activity";complete:boolean;progress:string;requests:number};
export function initialSync(workspaceId:string):SyncState{
 return {snapshot:{schemaVersion:1,workspaceId,capturedAt:"",source:"ClickUp API · durable background sync",spaces:[],folders:[],lists:[],workspaceFields:[]},activity:{checkedAt:null,pages:0,total:0,activity:{},complete:false,scope:"Accessible home-List task update timestamps, including closed tasks and subtasks. List-only edits, deleted/archived tasks, and updates in other home Lists may be excluded."},queue:[{kind:"spaces"},{kind:"workspaceFields"}],stage:"configuration",complete:false,progress:"Queued",requests:0};
}
export function commandPath(s:SyncState){
 const c=s.queue[0];if(!c)throw Error("Missing sync command");const id=c.id;
 switch(c.kind){
 case "spaces":return "/team/"+s.snapshot.workspaceId+"/space?archived=false";
 case "workspaceFields":return "/team/"+s.snapshot.workspaceId+"/field";
 case "folders":return "/space/"+id+"/folder?archived=false";
 case "spaceLists":return "/space/"+id+"/list?archived=false";
 case "folderLists":return "/folder/"+id+"/list?archived=false";
 case "spaceFields":return "/space/"+id+"/field";
 case "folderFields":return "/folder/"+id+"/field";
 case "listFields":return "/list/"+id+"/field";
 case "list":return "/list/"+id;
 case "tasks":return "/team/"+s.snapshot.workspaceId+"/task?include_closed=true&subtasks=true&order_by=updated&page="+c.page;
 }
}
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid ClickUp object");return value as Record<string,unknown>;}
function array(value:unknown):Record<string,unknown>[]{if(!Array.isArray(value))throw Error("Incomplete ClickUp collection");return value.map(object);}
function id(value:unknown){const s=String(value);if(!/^\d+$/.test(s))throw Error("Invalid location ID");return s;}
function name(value:unknown){if(typeof value!=="string")throw Error("Missing location name");return value;}
function fields(value:unknown):Field[]{return array(value).map(f=>({id:name(f.id),name:name(f.name),type:name(f.type),required:typeof f.required==="boolean"?f.required:null,type_config:f.type_config?object(f.type_config):{}}));}
function statuses(value:unknown):Status[]{return array(value).map((s,i)=>({status:name(s.status),type:name(s.type),color:typeof s.color==="string"?s.color:"#808080",orderindex:typeof s.orderindex==="number"?s.orderindex:i}));}
export function applyResponse(state:SyncState,response:unknown,now:string){
 const s=state,c=s.queue[0],d=object(response);
 if(!c||s.complete)throw Error("Sync has no pending work");
 // The worker only checkpoints after successful validation. Any thrown response discards this batch.
 if(c.kind==="spaces"){
  s.snapshot.spaces=array(d.spaces).map(x=>({id:id(x.id),name:name(x.name),settings:{features:x.features??null,statuses:x.statuses??null}}));
  for(const x of s.snapshot.spaces)s.queue.push({kind:"folders",id:x.id},{kind:"spaceLists",id:x.id,spaceId:x.id},{kind:"spaceFields",id:x.id});
 }else if(c.kind==="workspaceFields")s.snapshot.workspaceFields=fields(d.fields);
 else if(c.kind==="spaceFields")s.snapshot.spaces.find(x=>x.id===c.id)!.fields=fields(d.fields);
 else if(c.kind==="folderFields")s.snapshot.folders.find(x=>x.id===c.id)!.fields=fields(d.fields);
 else if(c.kind==="folders"){
  for(const x of array(d.folders)){const f={id:id(x.id),name:name(x.name),spaceId:c.id!};s.snapshot.folders.push(f);s.queue.push({kind:"folderLists",id:f.id,spaceId:f.spaceId,folderId:f.id},{kind:"folderFields",id:f.id});}
 }else if(c.kind==="spaceLists"||c.kind==="folderLists"){
  const space=s.snapshot.spaces.find(x=>x.id===c.spaceId)!;
  for(const x of array(d.lists)){
   const listId=id(x.id);if(s.snapshot.lists.some(l=>l.id===listId))continue;
   const folder=s.snapshot.folders.find(f=>f.id===c.folderId);
   const l:ListRecord={id:listId,name:name(x.name),spaceId:space.id,spaceName:space.name,folderId:folder?.id??null,folderName:folder?.name??null,statuses:null,fields:null,content:null,settings:{statusInheritance:"unknown",views:"not collected",nativeAutomations:"unavailable"}};
   s.snapshot.lists.push(l);s.queue.push({kind:"list",id:listId},{kind:"listFields",id:listId});
  }
 }else if(c.kind==="list"){
  const l=s.snapshot.lists.find(x=>x.id===c.id)!;l.name=name(d.name);l.content=typeof d.content==="string"?d.content:null;l.statuses=statuses(d.statuses);l.url="https://app.clickup.com/"+s.snapshot.workspaceId+"/v/l/li/"+l.id;
 }else if(c.kind==="listFields")s.snapshot.lists.find(x=>x.id===c.id)!.fields=fields(d.fields);
 else if(c.kind==="tasks"){
  const tasks=array(d.tasks);
  for(const t of tasks){const listId=id(object(t.list).id);const a=s.activity.activity[listId]??={lastActivityAt:null,tasksScanned:0,missingDates:0};a.tasksScanned++;s.activity.total++;
   const n=Number(t.date_updated);if(n>0&&Number.isFinite(new Date(n).getTime())){const date=new Date(n).toISOString();if(!a.lastActivityAt||date>a.lastActivityAt)a.lastActivityAt=date;}else a.missingDates++;
  }
  s.activity.pages++;
  if(d.last_page!==true&&tasks.length>0)s.queue.push({kind:"tasks",page:c.page!+1});
 }
 s.requests++;s.queue.shift();
 if(!s.queue.length){
  if(s.stage==="configuration"){s.stage="activity";s.queue.push({kind:"tasks",page:0});}
  else{s.complete=true;s.snapshot.capturedAt=now;s.activity.checkedAt=now;s.activity.complete=true;}
 }
 s.progress=s.complete?"Saved "+s.snapshot.lists.length+" Lists and "+s.activity.total.toLocaleString("en-US")+" task records":s.stage==="activity"?"Reading activity: "+s.activity.total.toLocaleString("en-US")+" task records":"Reading configuration: "+s.snapshot.lists.length+" Lists found · "+s.queue.length+" reads remaining";
 return s;
}
