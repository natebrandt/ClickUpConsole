import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {schema} from "../lib/control-room/schema.ts";
import {Storage,ConflictError} from "../lib/control-room/storage.ts";
import {initialSync,commandPath,applyResponse} from "../lib/control-room/sync-machine.ts";
import {reviewInput} from "../lib/control-room/review-validation.ts";
import {todayInNewYork,reviewDue} from "../lib/control-room/review-queue.ts";
function adapter(pg){return {query:async(sql,args=[]) => (await pg.query(sql,args)).rows,transaction:async fn=>pg.transaction(tx=>fn(adapter(tx)))};}
test("saved reviews survive new storage instances, preserve history, and reject stale writes",async()=>{
 const pg=new PGlite();try{
 for(const sql of schema)await pg.exec(sql);
 const db=new Storage(adapter(pg));
 const value={listId:"12",status:"keep_active",owner:"Owner",reason:"Ongoing contract",reviewDate:"2026-12-01",version:0};
 const saved=await db.saveReview("1",value,"admin");assert.equal(saved.version,1);
 const fresh=new Storage(adapter(pg));assert.equal((await fresh.reviews("1"))[0].reason,"Ongoing contract");assert.deepEqual(await fresh.reviews("2"),[]);
 await assert.rejects(db.saveReview("1",value,"other"),ConflictError);
 assert.equal((await db.events("1")).length,1);
 await db.saveReview("1",{...value,status:"needs_review",reason:"Renewal pending",version:1},"admin");
 const events=await db.events("1");assert.equal(events.length,2);assert.equal(events[0].before.reason,"Ongoing contract");assert.equal(events[0].after.status,"needs_review");
 }finally{await pg.close();}
});
test("one active sync, leased workers, atomic publication, cancellation and failure preserve last good data",async()=>{
 const pg=new PGlite();try{
 for(const sql of schema)await pg.exec(sql);
 const db=new Storage(adapter(pg)),s=initialSync("1");
 const first=await db.createJob("1",s),duplicate=await db.createJob("1",s);assert.equal(first.id,duplicate.id);assert.equal(duplicate.created,false);
 const claim=await db.claim(first.id);assert.equal(await db.claim(first.id),"busy");
 assert.equal(await db.latest("1"),null);await db.checkpoint(first.id,claim.lease,claim.state);assert.equal(await db.latest("1"),null);
 const next=await db.claim(first.id);next.state.complete=true;next.state.activity.complete=true;next.state.snapshot.capturedAt="2026-10-09T12:00:00Z";
 assert.equal(await db.checkpoint(first.id,next.lease,next.state),true);assert.equal((await db.latest("1")).id,first.id);
 assert.equal(await db.checkpoint(first.id,next.lease,next.state),false);
 const second=await db.createJob("1",s),otherClaim=await db.claim(second.id);
 assert.equal(await db.cancel("2",second.id),false);await db.cancel("1",second.id);
 otherClaim.state.complete=true;assert.equal(await db.checkpoint(second.id,otherClaim.lease,otherClaim.state),false);
 assert.equal((await db.latest("1")).id,first.id);
 const third=await db.createJob("1",s);await db.fail(third.id);assert.equal((await db.latest("1")).id,first.id);
 assert.equal(await db.latest("2"),null);
 }finally{await pg.close();}
});
test("sync machine inventories folderless and folder Lists then scans all task pages before publishing",()=>{
 const s=initialSync("1"),now="2026-10-09T12:00:00Z";
 const responses={
 "/team/1/space?archived=false":{spaces:[{id:"10",name:"Space"}]},
 "/team/1/field":{fields:[]},
 "/space/10/folder?archived=false":{folders:[{id:"20",name:"Folder"}]},
 "/space/10/list?archived=false":{lists:[{id:"30",name:"Direct"}]},
 "/space/10/field":{fields:[]},
 "/folder/20/list?archived=false":{lists:[{id:"40",name:"Nested"}]},
 "/folder/20/field":{fields:[]},
 "/list/30":{name:"Direct",statuses:[]},
 "/list/40":{name:"Nested",statuses:[]},
 "/list/30/field":{fields:[{id:"f",name:"Field",type:"text"}]},
 "/list/40/field":{fields:[]},
 "/team/1/task?include_closed=true&subtasks=true&order_by=updated&page=0":{tasks:[{list:{id:"30"},date_updated:"1740000000000"},{list:{id:"30"},date_updated:"1750000000000"}],last_page:false},
 "/team/1/task?include_closed=true&subtasks=true&order_by=updated&page=1":{tasks:[{list:{id:"40"},date_updated:null}],last_page:true}
 };
 while(!s.complete){const path=commandPath(s);assert.ok(responses[path],path);applyResponse(s,responses[path],now);}
 assert.equal(s.snapshot.lists.length,2);assert.equal(s.snapshot.lists.find(l=>l.id==="40").folderId,"20");assert.equal(s.snapshot.lists.find(l=>l.id==="30").folderId,null);
 assert.equal(s.snapshot.lists[0].fields[0].required,null);
 assert.equal(s.activity.total,3);assert.equal(s.activity.pages,2);assert.equal(s.activity.activity["30"].lastActivityAt,new Date(1750000000000).toISOString());assert.equal(s.activity.activity["40"].missingDates,1);assert.equal(s.activity.complete,true);
 const broken=initialSync("1");assert.throws(()=>applyResponse(broken,{spaces:null},now));assert.equal(broken.complete,false);
});
test("review inputs bound text, reject impossible dates and use New York day boundaries",()=>{
 const value={listId:"1",status:"keep_active",owner:"A",reason:"Ongoing",reviewDate:"2026-02-30",version:0};
 assert.equal(reviewInput.safeParse(value).success,false);assert.equal(reviewInput.safeParse({...value,reviewDate:"2026-02-28"}).success,true);
 assert.equal(reviewInput.safeParse({...value,reviewDate:null,reason:""}).success,false);
 assert.equal(todayInNewYork(new Date("2026-10-10T02:00:00Z")),"2026-10-09");
 assert.equal(reviewDue({reviewDate:"2026-10-09"},"2026-10-09"),true);
});
