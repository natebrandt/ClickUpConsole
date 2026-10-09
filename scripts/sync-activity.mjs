/** Refresh task-activity metadata only. GET-only; never persists task content or secrets. */
import {readFile,writeFile,rename} from "node:fs/promises";
const snapshot=JSON.parse(await readFile("data/snapshot.json","utf8"));
const token=process.env.CLICKUP_API_TOKEN;
if(!token)throw Error("Set CLICKUP_API_TOKEN in your local environment.");
const workspace=String(snapshot.workspaceId);
if(!/^\d+$/.test(workspace))throw Error("Invalid workspace ID");
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const activity={};let total=0,pages=0;
for(let page=0;;page++){
 let response;
 for(let attempt=0;attempt<5;attempt++){
  await delay(650);
  response=await fetch("https://api.clickup.com/api/v2/team/"+workspace+"/task?include_closed=true&subtasks=true&order_by=updated&page="+page,{method:"GET",headers:{Authorization:token},signal:AbortSignal.timeout(30000)});
  if(response.status!==429&&response.status<500)break;
  await delay(Math.max(Number(response.headers.get("retry-after")||0)*1000,1000*2**attempt));
 }
 if(!response?.ok)throw Error("Activity read failed; prior snapshot retained (HTTP "+response?.status+")");
 const result=await response.json();if(!Array.isArray(result.tasks))throw Error("Malformed task page; prior snapshot retained");
 for(const task of result.tasks){
  if(!task.list?.id)throw Error("Task missing home List; prior snapshot retained");
  const id=String(task.list.id);activity[id]??={lastActivityAt:null,tasksScanned:0,missingDates:0};
  const entry=activity[id];entry.tasksScanned++;const n=Number(task.date_updated);
  if(task.date_updated&&Number.isFinite(n)&&n>0&&Number.isFinite(new Date(n).getTime())){const iso=new Date(n).toISOString();if(!entry.lastActivityAt||iso>entry.lastActivityAt)entry.lastActivityAt=iso;}else entry.missingDates++;
 }
 total+=result.tasks.length;pages++;
 if(pages%10===0)console.log("Scanned "+total+" tasks");
 if(result.last_page===true||result.tasks.length===0)break;
}
const report={checkedAt:new Date().toISOString(),pages,total,activity,complete:true,scope:"Accessible home-List tasks including closed tasks and subtasks. Task update timestamps only; List-only edits, deleted/archived tasks, and tasks linked from other home Lists may be excluded."};
await writeFile("data/activity.json.tmp",JSON.stringify(report,null,2));await rename("data/activity.json.tmp","data/activity.json");
console.log("Saved activity dates for "+Object.keys(activity).length+" Lists. Rebuild and deploy to publish.");
