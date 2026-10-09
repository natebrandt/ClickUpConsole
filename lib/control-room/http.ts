import {NextResponse} from "next/server";
import {accessState} from "../access";
export const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{"Cache-Control":"private, no-store"}});
export function guard(request:Request,write=false){
 if(accessState(request.headers.get("authorization"))!=="allowed")return json({error:"Unauthorized"},401);
 if(write){const origin=request.headers.get("origin");if(!origin||!URL.canParse(origin)||!/^https?:$/.test(new URL(origin).protocol)||new URL(origin).host!==request.headers.get("host"))return json({error:"Same-origin requests required"},403);}
 return null;
}
