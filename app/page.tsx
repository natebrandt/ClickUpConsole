import snapshot from "@/data/snapshot.json";
import profiles from "@/config/profiles.json";
import Console from "./console";
import type {Snapshot,Profile} from "@/lib/governance/types";
export default function Home(){return <Console snapshot={snapshot as unknown as Snapshot} profiles={profiles as Profile[]}/>;}
