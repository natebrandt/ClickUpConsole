import type {ListRecord,Profile,Check,Snapshot} from "./types.ts";
export const normalize=(s:string)=>s.trim().replace(/\s+/g," ").toLowerCase();
export function inferProfile(l:ListRecord):{id:string|null;reason:string} {
 const n=normalize(l.name),context=normalize([l.name,l.folderName,l.spaceName].join(" "));
 if(/time tracking|work log|transition hours|administrative/.test(n))return {id:"time",reason:"List name indicates time or administration"};
 if(/ticket|customer support/.test(context))return {id:"support",reason:"Support Space or ticket List"};
 if(/retainer|hosting & maintenance/.test(context))return {id:"retainer",reason:"Retainer or maintenance naming"};
 if(/internal/.test(context))return {id:"internal",reason:"Internal Space, Folder, or List"};
 if(/digital|content|marketing|html|social|creative|branding|signage|collateral|brochure|logo|ads/.test(n))return {id:"digital",reason:"Digital or creative naming"};
 if(/website|wordpress|web |rebuild|redesign|webflow|development|wp updates/.test(n))return {id:"website",reason:"Website or development naming"};
 return {id:null,reason:"No reliable naming match; select a comparison standard"};
}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const ordered=(s:NonNullable<ListRecord["statuses"]>)=>[...s].sort((a,b)=>a.orderindex-b.orderindex);
const statusValue=(s:NonNullable<ListRecord["statuses"]>[number])=>({name:normalize(s.status),type:s.type,color:s.color.toLowerCase()});
const options=(f:Profile["fields"][number])=>((f.type_config.options??[]) as {id?:string;name?:string;label?:string;orderindex?:number;color?:string}[]).map(o=>({id:o.id,name:o.name??o.label,order:o.orderindex,color:o.color}));
export function audit(l:ListRecord,p:Profile):Check[]{
 const rows:Check[]=[];
 const add=(key:string,area:string,label:string,state:Check["state"],actual:unknown,expected:unknown,delivery:Check["delivery"],reason="")=>rows.push({key,area,label,state,actual,expected,delivery,reason});
 if(l.statuses===null)add("statuses","Statuses","Status workflow","unknown",null,p.statuses,"inspect","Statuses could not be read");
 else {
  const actual=ordered(l.statuses),target=ordered(p.statuses);
  for(const e of target){const a=actual.find(x=>normalize(x.status)===normalize(e.status));add("status:"+normalize(e.status),"Statuses",e.status,a&&equal(statusValue(a),statusValue(e))?"pass":"drift",a??null,e,"manual",a?"Compare name, category and color":"Missing status");}
  for(const a of actual.filter(a=>!target.some(e=>normalize(e.status)===normalize(a.status))))add("extra-status:"+normalize(a.status),"Statuses","Extra: "+a.status,"drift",a,null,"manual","Keep until task migration is explicitly reviewed; no automatic deletion");
  const a=actual.map(s=>normalize(s.status)),b=target.map(s=>normalize(s.status));
  add("status-order","Statuses","Workflow order",equal(a,b)?"pass":"drift",a,b,"manual","Status IDs differ by location and are not compared");
 }
 for(const f of p.fields){
  const a=l.fields?.find(x=>x.id===f.id);
  const shapeMatches=a&&normalize(a.name)===normalize(f.name)&&a.type===f.type&&equal(options(a),options(f));
  const state=l.fields===null?"unknown":!shapeMatches?"drift":a!.required===null||f.required===null?"unknown":a!.required===f.required?"pass":"drift";
  add("field:"+f.id,"Custom fields",f.name,state,a??null,f,"manual",!a?"Match canonical field ID, not just its name":"Compare type, required flag, option IDs, order, labels and colors");
 }
 if(l.fields!==null){const groups=new Map<string,typeof l.fields>();for(const f of l.fields){const key=normalize(f.name);groups.set(key,[...(groups.get(key)??[]),f]);}for(const [name,fs]of groups)if(new Set(fs.map(f=>f.id)).size>1)add("duplicate:"+name,"Custom fields","Duplicate name: "+name,"drift",fs.map(f=>({id:f.id,type:f.type})), "One reviewed canonical field","manual","Different IDs can hold different data; merge is never automatic");}
 if(p.namingPattern)add("name","Naming","List naming",new RegExp(p.namingPattern).test(l.name)?"pass":"drift",l.name,"Client :: Project","future-api","Rename requires a reviewed exact target name");
 if(p.descriptionRequired)add("description","Settings","List description",l.content===null?"unknown":l.content.trim()?"pass":"drift",l.content,"Nonempty project description","future-api",l.content===null?"Connector omitted description; absence is not confirmed":"");
 add("views","Views","Required views","unknown",null,p.views,"inspect","Views are not exposed by the connected tools");
 for(const c of p.clickApps)add("clickapp:"+c,"Settings",c,"unknown",null,true,"inspect","Space ClickApps are not exposed by the connected tools");
 add("automation","Automations","Automation package","unknown",null,p.automationPackage,"inspect","Native automation definitions cannot be inventoried through this connector");
 add("inheritance","Settings","Status inheritance","unknown",null,"Review parent scope before changes","inspect","Effective statuses are known; inheritance origin is not");
 return rows;
}
export function summarize(checks:Check[]){const passed=checks.filter(c=>c.state==="pass").length,drift=checks.filter(c=>c.state==="drift").length,unknown=checks.filter(c=>c.state==="unknown").length;return {passed,drift,unknown,known:passed+drift,total:checks.length,score:passed+drift?Math.round(100*passed/(passed+drift)):null,coverage:checks.length?Math.round(100*(passed+drift)/checks.length):0};}
export function canonical(value:unknown):string{if(Array.isArray(value))return "["+value.map(canonical).join(",")+"]";if(value&&typeof value==="object")return "{"+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+":"+canonical(v)).join(",")+"}";return JSON.stringify(value)??"null";}
export async function fingerprint(value:unknown){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(canonical(value)));return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,"0")).join("");}
export async function createPlan(snapshot:Snapshot,targets:{list:ListRecord;profile:Profile}[]){
 if(!targets.length)throw Error("Select at least one List");
 if(new Set(targets.map(t=>t.list.id)).size!==targets.length)throw Error("Duplicate List targets");
 const items=await Promise.all(targets.map(async({list,profile})=>({listId:list.id,listName:list.name,spaceId:list.spaceId,folderId:list.folderId,profile:{id:profile.id,version:profile.version,state:profile.state,hash:await fingerprint(profile)},beforeHash:await fingerprint(list),before:list,findings:audit(list,profile).filter(c=>c.state!=="pass").map(c=>({...c,executable:false,action:c.state==="unknown"?"verify":c.key.startsWith("extra-status")?"review-retain-or-map":c.delivery==="future-api"?"propose-reviewed-value":"manual-configuration",risk:c.area==="Statuses"||c.area==="Custom fields"?"high":"medium"}))})));
 return {schemaVersion:1,kind:"clickup-standard-dry-run",mode:"read-only",executable:false,createdAt:new Date().toISOString(),snapshotAt:snapshot.capturedAt,workspaceId:snapshot.workspaceId,snapshotHash:await fingerprint(snapshot),items,guards:["Approve the draft profile and each exact List assignment","Re-read live configuration and reject changed beforeHash","Resolve unknowns and inheritance scope","Map tasks before any status removal; preserve custom field values","Review permission and API support per operation","Use an audited executor with idempotency, partial-failure reporting and recovery"],rollback:"Before snapshots are evidence, not a guarantee of reversible task or field migrations"};
}
export async function assertPlanFresh(plan:Awaited<ReturnType<typeof createPlan>>,live:Snapshot){if(plan.workspaceId!==live.workspaceId||await fingerprint(live)!==plan.snapshotHash)throw Error("Stale plan: regenerate from the current snapshot");}
export function applyStandard():never{throw Error("Phase 1 is read-only. No ClickUp mutation executor is installed.");}
