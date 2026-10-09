import type {Snapshot} from "../governance/types";
import type {ActivityReport} from "../governance/staleness";
export const reviewLabels={unreviewed:"Not reviewed",keep_active:"Keep active",needs_review:"Needs review",archive_candidate:"Archive candidate"} as const;
export type ReviewStatus=keyof typeof reviewLabels;
export type Review={listId:string;status:ReviewStatus;owner:string;reason:string;reviewDate:string|null;version:number;updatedAt:string;updatedBy:string};
export type ReviewEvent={id:string;listId:string;before:Review|null;after:Review;at:string;actor:string};
export type Job={id:string;status:"queued"|"running"|"completed"|"failed"|"cancelled";progress:string;createdAt:string;updatedAt:string;finishedAt:string|null;error:string|null};
export type Bundle={id:string;snapshot:Snapshot;activity:ActivityReport};
export type ControlState={storage:"ready"|"missing"|"error";tokenConfigured:boolean;error?:string;reviews:Review[];events:ReviewEvent[];jobs:Job[];snapshotId:string|null;lastSuccessfulSync:string|null};
