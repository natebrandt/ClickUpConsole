import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {audit,summarize,inferProfile,createPlan,assertPlanFresh,applyStandard,buildGovernanceReport} from "../lib/governance/engine.ts";
import {verifySignature,evaluateRules} from "../lib/governance/rules.ts";
import {createHmac} from "node:crypto";
const snapshot=JSON.parse(readFileSync(new URL("../data/snapshot.json",import.meta.url)));
const profiles=JSON.parse(readFileSync(new URL("../config/profiles.json",import.meta.url)));
const profile=profiles[0];
const list={...snapshot.lists.find(l=>l.id===profile.sourceListId),name:"Example :: Website",content:"Project description"};
test("governance report packages review decisions without executable actions",()=>{
 const report=buildGovernanceReport(snapshot,profiles,{[list.id]:{profileId:profile.id,status:"approved",owner:"Admin",reviewer:"Lead"}});
 assert.equal(report.kind,"clickup-governance-review");
 assert.equal(report.mode,"read-only");
 assert.equal(report.summary.assigned,1);
 assert.equal(report.summary.approved,1);
 assert.equal(report.lists.find(item=>item.listId===list.id).assignment.owner,"Admin");
 assert.ok(report.lists.find(item=>item.listId===list.id).findings.every(f=>f.state!=="pass"));
});
test("seed workflow and canonical fields match draft; unavailable data remains unknown",()=>{
 const checks=audit(list,profile);
 assert.equal(checks.filter(c=>c.state==="drift").length,0);
 assert.ok(checks.some(c=>c.key==="views"&&c.state==="unknown"));
 assert.equal(summarize(checks).score,100);
 assert.ok(summarize(checks).coverage<100);
});
test("same name with a different field ID is a difference",()=>{
 const f=profile.fields[0];const changed={...list,fields:list.fields.map(x=>x.id===f.id?{...x,id:"other-id"}:x)};
 assert.equal(audit(changed,profile).find(c=>c.key==="field:"+f.id).state,"drift");
});
test("order, status category and duplicate names are detected",()=>{
 const changed=structuredClone(list);changed.statuses[0].type="closed";changed.statuses[0].orderindex=999;
 changed.fields.push({...changed.fields[0],id:"duplicate-id"});
 const checks=audit(changed,profile);
 assert.equal(checks.find(c=>c.key==="status-order").state,"drift");
 assert.ok(checks.some(c=>c.key.startsWith("duplicate:")));
 assert.ok(checks.some(c=>c.key.startsWith("status:")&&c.state==="drift"));
});
test("unknown inventory is never an empty, failed workflow",()=>{
 const checks=audit({...list,statuses:null,fields:null,content:null},profile);
 assert.equal(checks.filter(c=>c.state==="drift").length,0);
 assert.equal(checks.find(c=>c.key==="statuses").state,"unknown");
});
test("null required flag stays unknown",()=>{
 const f=profile.fields[0];const changed={...list,fields:list.fields.map(x=>x.id===f.id?{...x,required:null}:x)};
 assert.equal(audit(changed,profile).find(c=>c.key==="field:"+f.id).state,"unknown");
});
test("unrecognized Lists remain unassigned, time tracking outranks website naming",()=>{
 assert.equal(inferProfile({...list,name:"Mystery",folderName:null,spaceName:"Example"}).id,null);
 assert.equal(inferProfile({...list,name:"Website Time Tracking"}).id,"time");
});
test("plans are non-executable, reject duplicate targets, and detect stale data",async()=>{
 const plan=await createPlan(snapshot,[{list,profile}]);
 assert.equal(plan.executable,false);assert.ok(plan.items[0].findings.every(f=>f.executable===false));
 assert.equal(plan.items[0].beforeHash.length,64);await assertPlanFresh(plan,snapshot);
 const changed=structuredClone(snapshot);changed.lists[0].name+=" edited";
 await assert.rejects(assertPlanFresh(plan,changed),/Stale/);
 await assert.rejects(createPlan(snapshot,[{list,profile},{list,profile}]),/Duplicate/);
 assert.throws(applyStandard,/read-only/);
});
test("webhook signature uses exact raw body and fails tampering",async()=>{
 const raw='{"event":"taskStatusUpdated"}';const sig=createHmac("sha256","secret").update(raw).digest("hex");
 assert.equal(await verifySignature(raw,sig,"secret"),true);
 assert.equal(await verifySignature(raw+" ",sig,"secret"),false);
 assert.equal(await verifySignature(raw,"bad","secret"),false);
});
test("rules isolate workspace and List, prevent echo, and generate deterministic dry runs",()=>{
 const event={workspaceId:"w",listId:"l",taskId:"t",webhookId:"hook",event:"taskStatusUpdated",historyItemId:"h",status:"qa",causedByExecutor:false};
 const rule={id:"r",version:"1.0.0",enabled:true,workspaceId:"w",listIds:["l"],event:event.event,condition:{statusEquals:"qa"},action:{kind:"propose-task-status",status:"review"}};
 assert.equal(evaluateRules(event,[rule])[0].executable,false);
 assert.deepEqual(evaluateRules(event,[rule]),evaluateRules(event,[rule]));
 assert.equal(evaluateRules({...event,workspaceId:"other"},[rule]).length,0);
 assert.equal(evaluateRules({...event,causedByExecutor:true},[rule]).length,0);
 assert.throws(()=>evaluateRules({...event,historyItemId:""},[rule]),/identity/);
});
test("snapshot has unique IDs and resolvable parent relationships",()=>{
 assert.equal(new Set(snapshot.lists.map(l=>l.id)).size,snapshot.lists.length);
 for(const l of snapshot.lists){assert.ok(snapshot.spaces.some(s=>s.id===l.spaceId));if(l.folderId)assert.ok(snapshot.folders.some(f=>f.id===l.folderId));}
});
