import {headers} from "next/headers";
import snapshot from "@/data/snapshot.json";
import activity from "@/data/activity.json";
import profiles from "@/config/profiles.json";
import {storage,hasDatabase,workspaceId} from "@/lib/control-room/db";
import Console from "./console";
import {accessState} from "@/lib/access";
import type {Snapshot,Profile} from "@/lib/governance/types";

// Keep the private snapshot out of static HTML and public client bundles.
export const dynamic="force-dynamic";
export default async function Home(){
 if(accessState((await headers()).get("authorization"))!=="allowed"){
   throw new Error("Private console access denied");
 }
 let saved=null;
 if(hasDatabase()){try{saved=await (await storage()).latest(workspaceId());}catch{/* Dashboard reports storage health without exposing connection details. */}}
 return <Console initialSnapshotId={saved?.id??null} activity={saved?.activity??activity} snapshot={saved?.snapshot??snapshot as unknown as Snapshot} profiles={profiles as Profile[]}/>;
}
