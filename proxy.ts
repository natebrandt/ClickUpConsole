import {NextRequest,NextResponse} from "next/server";
import {accessState} from "./lib/access";
export function proxy(request:NextRequest){
 const state=accessState(request.headers.get("authorization"));
 if(state==="unconfigured")return new NextResponse("Configure ADMIN_USERNAME and ADMIN_PASSWORD to enable this private console.",{status:503,headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"}});
 if(state==="unauthorized")return new NextResponse("Authentication required.",{status:401,headers:{"WWW-Authenticate":'Basic realm="ClickUp Admin Console", charset="UTF-8"',"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"}});
 const response=NextResponse.next();
 response.headers.set("Cache-Control","private, no-store");
 response.headers.set("X-Robots-Tag","noindex, nofollow");
 return response;
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.svg).*)"]};
