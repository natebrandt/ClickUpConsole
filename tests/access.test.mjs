import test from "node:test";
import assert from "node:assert/strict";
import {accessState} from "../lib/access.ts";
const env={NODE_ENV:"production",ADMIN_USERNAME:"owner",ADMIN_PASSWORD:"test-password"};
const basic=value=>"Basic "+Buffer.from(value).toString("base64");
test("production fails closed without credentials",()=>{
 assert.equal(accessState(null,{NODE_ENV:"production"}),"unconfigured");
 assert.equal(accessState(basic("owner:test-password"),{NODE_ENV:"production",ADMIN_USERNAME:"owner"}),"unconfigured");
});
test("only matching credentials allow private data",()=>{
 assert.equal(accessState(null,env),"unauthorized");
 assert.equal(accessState(basic("owner:wrong"),env),"unauthorized");
 assert.equal(accessState(basic("other:test-password"),env),"unauthorized");
 assert.equal(accessState(basic("owner:test-password"),env),"allowed");
});
test("local development bypass never applies on Vercel",()=>{
 assert.equal(accessState(null,{NODE_ENV:"development"}),"allowed");
 assert.equal(accessState(null,{NODE_ENV:"development",VERCEL:"1"}),"unconfigured");
});
