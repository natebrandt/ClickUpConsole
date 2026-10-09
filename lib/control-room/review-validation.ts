import {z} from "zod";
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,"Choose a valid date");
export const reviewInput=z.object({
 listId:z.string().regex(/^\d+$/),status:z.enum(["unreviewed","keep_active","needs_review","archive_candidate"]),
 owner:z.string().trim().max(120),reason:z.string().trim().max(2000),reviewDate:date.nullable(),
 version:z.number().int().min(0)
}).strict().refine(x=>x.status==="unreviewed"||x.reason.length>0,{message:"Add a reason for this decision",path:["reason"]});
