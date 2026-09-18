import {headers} from "next/headers";
import snapshot from "@/data/snapshot.json";
import profiles from "@/config/profiles.json";
import Console from "./console";
import {accessState} from "@/lib/access";
import type {Snapshot,Profile} from "@/lib/governance/types";

// Keep the private snapshot out of static HTML and public client bundles.
export const dynamic="force-dynamic";
export default async function Home(){
 if(accessState((await headers()).get("authorization"))!=="allowed"){
   throw new Error("Private console access denied");
 }
 return <Console snapshot={snapshot as unknown as Snapshot} profiles={profiles as Profile[]}/>;
}
