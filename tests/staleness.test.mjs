import test from "node:test";import assert from "node:assert/strict";
import {activityFlag,monthsBefore} from "../lib/governance/staleness.ts";
const at="2026-10-09T12:00:00.000Z";
const a=date=>({lastActivityAt:date,tasksScanned:1,missingDates:0});
test("strict 6 and 12 calendar month boundaries",()=>{
 assert.equal(activityFlag(a("2026-04-09T12:00:00.000Z"),at),"recent");
 assert.equal(activityFlag(a("2026-04-09T11:59:59.999Z"),at),"warning");
 assert.equal(activityFlag(a("2025-10-09T12:00:00.000Z"),at),"warning");
 assert.equal(activityFlag(a("2025-10-09T11:59:59.999Z"),at),"critical");
});
test("unknown, incomplete, missing, and future dates do not become stale",()=>{
 for(const value of [undefined,a(null),a("bad"),a("2027-01-01"),{...a("2020-01-01"),missingDates:1}])assert.equal(activityFlag(value,at),"unknown");
 assert.equal(activityFlag(a("2020-01-01"),at,false),"unknown");
});
test("calendar month subtraction clamps end of month and leap years",()=>{
 assert.equal(new Date(monthsBefore("2024-08-31T00:00:00Z",6)).toISOString(),"2024-02-29T00:00:00.000Z");
});
