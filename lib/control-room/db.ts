import postgres from "postgres";
import {Storage,type Connection} from "./storage";
import {schema} from "./schema";
export function workspaceId(){const id=process.env.CLICKUP_WORKSPACE_ID||"1230709";if(!/^\d+$/.test(id))throw Error("Invalid workspace configuration");return id;}
export function hasDatabase(){return !!(process.env.DATABASE_URL||process.env.POSTGRES_URL);}
let pending:Promise<Storage>|undefined;
export function storage(){
 if(!hasDatabase())throw Error("Database not configured");
 if(!pending)pending=(async()=>{
  const sql=postgres(process.env.DATABASE_URL||process.env.POSTGRES_URL!,{max:3,idle_timeout:20,connect_timeout:10,prepare:false});
  function connection(client:typeof sql):Connection{
   return {
    query:async <T extends Record<string,unknown>>(text:string,params:unknown[]=[])=>Array.from(await client.unsafe(text,params as never[])) as T[],
    transaction:async <T>(fn:(db:Connection)=>Promise<T>)=>await client.begin(tx=>fn(connection(tx as unknown as typeof sql))) as T
   };
  }
  const db=connection(sql);
  try{for(const statement of schema)await db.query(statement);}catch(e){await sql.end();throw e;}
  return new Storage(db);
 })().catch(e=>{pending=undefined;throw e;});
 return pending;
}
