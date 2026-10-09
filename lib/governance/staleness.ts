export type ListActivity={lastActivityAt:string|null;tasksScanned:number;missingDates:number};
export type ActivityReport={checkedAt:string|null;pages:number;total:number;activity:Record<string,ListActivity>;scope:string;complete:boolean};
export function monthsBefore(iso:string,months:number){
 const d=new Date(iso);const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-months);
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.getTime();
}
export function activityFlag(a:ListActivity|undefined,checkedAt:string|null,complete=true):"critical"|"warning"|"recent"|"unknown"{
 if(!complete||!checkedAt||!Number.isFinite(Date.parse(checkedAt))||!a?.lastActivityAt||a.missingDates>0)return "unknown";
 const n=Date.parse(a.lastActivityAt);if(!Number.isFinite(n)||n>Date.parse(checkedAt))return "unknown";
 if(n<monthsBefore(checkedAt,12))return "critical";
 if(n<monthsBefore(checkedAt,6))return "warning";
 return "recent";
}
