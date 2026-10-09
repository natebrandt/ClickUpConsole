import {randomUUID} from "node:crypto";
import type {Bundle,Review,ReviewEvent,Job} from "./types";
import type {SyncState} from "./sync-machine";
export interface Connection {
 query<T extends Record<string,unknown>=Record<string,unknown>>(text:string,params?:unknown[]):Promise<T[]>;
 transaction<T>(fn:(db:Connection)=>Promise<T>):Promise<T>;
}
export class ConflictError extends Error {}
const iso=(x:unknown)=>x instanceof Date?x.toISOString():String(x);
function review(r:Record<string,unknown>):Review{return {listId:String(r.list_id),status:r.status as Review["status"],owner:String(r.owner),reason:String(r.reason),reviewDate:r.review_date?iso(r.review_date).slice(0,10):null,version:Number(r.version),updatedAt:iso(r.updated_at),updatedBy:String(r.updated_by)};}
function job(r:Record<string,unknown>):Job{return {id:String(r.id),status:r.status as Job["status"],progress:String(r.progress),createdAt:iso(r.created_at),updatedAt:iso(r.updated_at),finishedAt:r.finished_at?iso(r.finished_at):null,error:r.error?String(r.error):null};}
export class Storage{
 readonly db:Connection;
 constructor(db:Connection){this.db=db;}
 async latestMeta(workspace:string){const [r]=await this.db.query("SELECT id,created_at FROM cr_snapshots WHERE workspace_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1",[workspace]);return r?{id:String(r.id),createdAt:iso(r.created_at)}:null;}
 async latest(workspace:string):Promise<Bundle|null>{
  const [r]=await this.db.query("SELECT id,snapshot,activity FROM cr_snapshots WHERE workspace_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1",[workspace]);
  return r?{id:String(r.id),snapshot:r.snapshot as Bundle["snapshot"],activity:r.activity as Bundle["activity"]}:null;
 }
 async reviews(workspace:string){return (await this.db.query("SELECT * FROM cr_reviews WHERE workspace_id=$1 AND version>0",[workspace])).map(review);}
 async events(workspace:string,listId?:string):Promise<ReviewEvent[]>{
  return (await this.db.query("SELECT * FROM cr_review_events WHERE workspace_id=$1 AND ($2::text IS NULL OR list_id=$2) ORDER BY created_at DESC,id DESC LIMIT 100",[workspace,listId??null])).map(r=>({id:String(r.id),listId:String(r.list_id),before:r.before_value as Review|null,after:r.after_value as Review,at:iso(r.created_at),actor:String(r.actor)}));
 }
 async saveReview(workspace:string,value:Pick<Review,"listId"|"status"|"owner"|"reason"|"reviewDate"|"version">,actor:string){
  return this.db.transaction(async db=>{
   await db.query("INSERT INTO cr_reviews(workspace_id,list_id,status,updated_by) VALUES($1,$2,'unreviewed',$3) ON CONFLICT DO NOTHING",[workspace,value.listId,actor]);
   const [row]=await db.query("SELECT * FROM cr_reviews WHERE workspace_id=$1 AND list_id=$2 FOR UPDATE",[workspace,value.listId]);
   const before=review(row);
   if(before.version!==value.version)throw new ConflictError("This review changed in another session. Reload the latest review before saving.");
   const [updated]=await db.query("UPDATE cr_reviews SET status=$3,owner=$4,reason=$5,review_date=$6,version=version+1,updated_at=now(),updated_by=$7 WHERE workspace_id=$1 AND list_id=$2 RETURNING *",[workspace,value.listId,value.status,value.owner,value.reason,value.reviewDate,actor]);
   const after=review(updated);
   await db.query("INSERT INTO cr_review_events(id,workspace_id,list_id,before_value,after_value,actor) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6)",[randomUUID(),workspace,value.listId,before.version?JSON.stringify(before):null,JSON.stringify(after),actor]);
   return after;
  });
 }
 async jobs(workspace:string){return (await this.db.query("SELECT id,status,progress,error,created_at,updated_at,finished_at FROM cr_jobs WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 10",[workspace])).map(job);}
 async createJob(workspace:string,state:SyncState){
  return this.db.transaction(async db=>{
   const id=randomUUID();
   const rows=await db.query("INSERT INTO cr_jobs(id,workspace_id,status,state) VALUES($1,$2,'queued',$3::jsonb) ON CONFLICT DO NOTHING RETURNING id",[id,workspace,JSON.stringify(state)]);
   if(rows.length)return {id,created:true};
   const [existing]=await db.query("SELECT id FROM cr_jobs WHERE workspace_id=$1 AND status IN ('queued','running')",[workspace]);
   if(!existing)throw new ConflictError("Sync state changed. Please try again.");
   return {id:String(existing.id),created:false};
  });
 }
 async attachWorkflow(id:string,runId:string){await this.db.query("UPDATE cr_jobs SET workflow_id=$2 WHERE id=$1",[id,runId]);}
 async claim(id:string){
  const lease=randomUUID();
  const [r]=await this.db.query("UPDATE cr_jobs SET status='running',lease_token=$2,lease_until=now()+interval '90 seconds',updated_at=now() WHERE id=$1 AND status IN ('queued','running') AND (lease_until IS NULL OR lease_until<now()) RETURNING state,workspace_id",[id,lease]);
  if(r)return {lease,state:r.state as SyncState,workspace:String(r.workspace_id)};
  const [existing]=await this.db.query("SELECT status FROM cr_jobs WHERE id=$1",[id]);
  return existing&&["queued","running"].includes(String(existing.status))?"busy":null;
 }
 async checkpoint(id:string,lease:string,state:SyncState){
  return this.db.transaction(async db=>{
   const [r]=await db.query("SELECT workspace_id FROM cr_jobs WHERE id=$1 AND lease_token=$2 AND status='running' FOR UPDATE",[id,lease]);
   if(!r)return false;
   if(state.complete){
    await db.query("INSERT INTO cr_snapshots(id,workspace_id,snapshot,activity) VALUES($1,$2,$3::jsonb,$4::jsonb) ON CONFLICT DO NOTHING",[id,r.workspace_id,JSON.stringify(state.snapshot),JSON.stringify(state.activity)]);
   }
   await db.query("UPDATE cr_jobs SET state=$3::jsonb,progress=$4,status=$5,lease_token=NULL,lease_until=NULL,updated_at=now(),finished_at=CASE WHEN $5='completed' THEN now() ELSE NULL END WHERE id=$1 AND lease_token=$2",[id,lease,JSON.stringify(state.complete?{complete:true}:state),state.progress,state.complete?"completed":"running"]);
   return true;
  });
 }
 async release(id:string,lease:string){await this.db.query("UPDATE cr_jobs SET lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2",[id,lease]);}
 async fail(id:string){await this.db.query("UPDATE cr_jobs SET status='failed',error='Sync could not finish after retries. Check the ClickUp token and connection, then start a new sync. Previous saved data is unchanged.',finished_at=now(),updated_at=now(),lease_token=NULL,lease_until=NULL,state='{}'::jsonb WHERE id=$1 AND status IN ('queued','running')",[id]);}
 async cancel(workspace:string,id:string){const r=await this.db.query("UPDATE cr_jobs SET status='cancelled',finished_at=now(),updated_at=now(),state='{}'::jsonb WHERE workspace_id=$1 AND id=$2 AND status IN ('queued','running') RETURNING id",[workspace,id]);return r.length>0;}
 async resumable(workspace:string,id:string){const [r]=await this.db.query("UPDATE cr_jobs SET updated_at=now() WHERE workspace_id=$1 AND id=$2 AND status IN ('queued','running') AND updated_at<now()-interval '2 minutes' AND (lease_until IS NULL OR lease_until<now()) RETURNING id",[workspace,id]);return !!r;}
}
