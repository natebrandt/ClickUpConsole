/** Pure rule contracts. No network writes, webhook registration, or HTTP receiver. */
export type Rule = {id:string;version:string;enabled:boolean;workspaceId:string;listIds:string[];event:string;condition:{statusEquals:string};action:{kind:"propose-task-status";status:string}};
export type EventEnvelope={workspaceId:string;listId:string;taskId:string;webhookId:string;event:string;historyItemId:string;status:string;causedByExecutor:boolean};
export interface DurableInbox {
 /** Must atomically insert and return false if already present. Persist before ACK. */
 insertIfAbsent(key:string,payload:EventEnvelope):Promise<boolean>;
}
export interface IntentQueue {enqueue(intent:RuleIntent):Promise<void>}
export type RuleIntent={idempotencyKey:string;ruleId:string;ruleVersion:string;taskId:string;action:Rule["action"];mode:"dry-run";executable:false};
export async function verifySignature(rawBody:string,signature:string,secret:string):Promise<boolean>{
 if(!secret||! /^[a-fA-F0-9]{64}$/.test(signature))return false;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
 const bytes=new Uint8Array(signature.match(/.{2}/g)!.map(h=>parseInt(h,16)));
 return crypto.subtle.verify("HMAC",key,bytes,new TextEncoder().encode(rawBody));
}
export function evaluateRules(event:EventEnvelope,rules:Rule[]):RuleIntent[]{
 if(!event.workspaceId||!event.listId||!event.taskId||!event.webhookId||!event.historyItemId)throw Error("Verified scope and stable event identity are required");
 if(event.causedByExecutor)return [];
 return rules.filter(r=>r.enabled&&r.workspaceId===event.workspaceId&&r.listIds.includes(event.listId)&&r.event===event.event&&r.condition.statusEquals===event.status&&r.action.status!==event.status).map(r=>({idempotencyKey:[event.webhookId,event.historyItemId,r.id,r.version].join(":"),ruleId:r.id,ruleVersion:r.version,taskId:event.taskId,action:r.action,mode:"dry-run",executable:false}));
}
