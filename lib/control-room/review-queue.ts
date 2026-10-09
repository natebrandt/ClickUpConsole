import type {Review} from "./types";
export function todayInNewYork(now=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);}
export function reviewDue(review:Review|undefined,today:string){return !!review?.reviewDate&&review.reviewDate<=today;}
