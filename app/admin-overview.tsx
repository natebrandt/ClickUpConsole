"use client";
import type {Snapshot} from "@/lib/governance/types";
import {activityFlag,type ActivityReport} from "@/lib/governance/staleness";
import {reviewLabels,type ControlState} from "@/lib/control-room/types";
import {reviewDue,todayInNewYork} from "@/lib/control-room/review-queue";
import {readableTime} from "./sync-workspace";
import {Button} from "@/components/ui/button";
export default function AdminOverview({snapshot,activity,state,onQueue,onAudit}:{snapshot:Snapshot;activity:ActivityReport;state:ControlState|null;onQueue:(filter:string,id?:string)=>void;onAudit:()=>void}){
 const reviews=state?.reviews??[],byId=new Map(reviews.map(r=>[r.listId,r])),ids=new Set(snapshot.lists.map(l=>l.id)),current=reviews.filter(r=>ids.has(r.listId)),today=todayInNewYork();
 const stale=snapshot.lists.filter(l=>["critical","warning"].includes(activityFlag(activity.activity[l.id],activity.checkedAt,activity.complete)));
 const awaiting=stale.filter(l=>!byId.get(l.id)||byId.get(l.id)?.status==="unreviewed");
 const due=current.filter(r=>reviewDue(r,today)).sort((a,b)=>a.reviewDate!.localeCompare(b.reviewDate!));
 const cards=[{count:awaiting.length,label:"Stale Lists awaiting a decision",detail:stale.length+" Lists flagged by activity",filter:"stale_unreviewed"},{count:due.length,label:"Follow-ups due",detail:"Today or earlier · New York time",filter:"due"},{count:current.filter(r=>r.status==="needs_review").length,label:"Needs review",detail:"Decisions requiring follow-up",filter:"needs_review"},{count:current.filter(r=>r.status==="archive_candidate").length,label:"Archive candidates",detail:"Review only · no Lists archived",filter:"archive_candidate"}];
 return <><div className="metrics">{cards.map(c=><button className="metric overview-metric" key={c.filter} onClick={()=>onQueue(c.filter)}><span>{c.label}</span><strong>{state?.storage==="ready"?c.count:c.filter==="stale_unreviewed"?awaiting.length:"—"}</strong><small>{c.detail}</small></button>)}</div><div className="overview-columns">
 <section className="panel"><div className="topline"><h2>Follow-up queue</h2><Button variant="outline" onClick={()=>onQueue("all")}>All reviews</Button></div>{!due.length?<p className="subtle mt-5">{state?.storage==="ready"?"No follow-ups are due. Review a List to record an owner and date.":"Connect saved data to see follow-ups."}</p>:due.slice(0,8).map(r=><button key={r.listId} className="overview-row" onClick={()=>onQueue("all",r.listId)}><strong>{snapshot.lists.find(l=>l.id===r.listId)?.name}</strong><span>{r.owner||"No owner"} · Due {r.reviewDate}</span></button>)}
 <div className="callout"><strong>Start with the inactive Lists</strong><p>{stale.length} Lists have activity flags as of {activity.checkedAt?.slice(0,10)||"the last scan"}. Record a decision before planning cleanup.</p><Button className="mt-3" variant="outline" onClick={()=>onQueue("stale")}>Review flagged Lists</Button></div></section>
 <section className="panel"><h2>Recent decisions</h2>{!state?.events.length?<p className="subtle mt-5">Saved decisions will appear here with their author and date.</p>:state.events.slice(0,8).map(e=><article className="review-event" key={e.id}><strong>{snapshot.lists.find(l=>l.id===e.listId)?.name??"List "+e.listId}</strong><p>{reviewLabels[e.after.status]}</p><small>{readableTime(e.at)} ET · {e.actor}</small></article>)}</section></div>
 <section className="panel mt-5"><div className="topline"><div><h2>Configuration health</h2><p className="subtle">{snapshot.spaces.length} Spaces · {snapshot.folders.length} Folders · {snapshot.lists.length} Lists. Compare workflows and fields against your draft standards.</p></div><Button onClick={onAudit}>Open workspace audit</Button></div></section></>;
}
