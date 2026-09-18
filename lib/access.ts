import {createHash,timingSafeEqual} from "node:crypto";

type Environment={NODE_ENV?:string;VERCEL?:string;ADMIN_USERNAME?:string;ADMIN_PASSWORD?:string};
export function accessState(authorization:string|null,env:Environment=process.env):"allowed"|"unconfigured"|"unauthorized"{
 const user=env.ADMIN_USERNAME,password=env.ADMIN_PASSWORD;
 if(env.NODE_ENV==="development"&&!env.VERCEL&&!user&&!password)return "allowed";
 if(!user||!password)return "unconfigured";
 if(!authorization?.startsWith("Basic "))return "unauthorized";
 const supplied=Buffer.from(authorization.slice(6),"base64").toString("utf8");
 const expected=user+":"+password;
 const digest=(value:string)=>createHash("sha256").update(value).digest();
 return timingSafeEqual(digest(supplied),digest(expected))?"allowed":"unauthorized";
}
