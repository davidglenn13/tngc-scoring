import fs from "node:fs";
import path from "node:path";
const root=path.resolve(new URL("..",import.meta.url).pathname);
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const fail=m=>{throw new Error("PREFLIGHT: "+m);};

const course=JSON.parse(read("src/course-tngc.json"));
if(course.par.length!==18||course.strokeIndex.length!==18)fail("18-hole arrays invalid");
if(course.par.reduce((a,b)=>a+b,0)!==72)fail("par must total 72");
if(new Set(course.strokeIndex).size!==18||course.strokeIndex.some(x=>x<1||x>18))fail("stroke indexes invalid");
const expected=["Black","Gold","Gold/Blue Hybrid","Blue","Blue/White Hybrid","White"];
if(JSON.stringify(Object.keys(course.tees))!==JSON.stringify(expected))fail("active tee list changed");

const migrations=[
 "0002_v2_platform.sql",
 "0003_ballyhack_game_parity.sql",
 "0004_confirmation_recovery.sql",
 "0005_release_hardening.sql",
 "0006_game_config_parity.sql",
 "0007_security_offline.sql",
 "0008_live_round_guards.sql"
];
for(const m of migrations)if(!fs.existsSync(path.join(root,"migrations",m)))fail("missing "+m);

const app=read("app-v2.js");
for(const x of [
 "NASSAU_PRESETS","fortyBallSummary","Press the Press","mergeSnapshot",
 "checkEnvironment","renderConflictBanner","renderConfirmation",
 "flushOutbox","saveOrganizerToken","protectedValuesFromOutbox"
]) if(!app.includes(x))fail("app missing "+x);

const health=read("functions/api/v2/health.js");
if(!health.includes("TNGC_ENV")||!health.includes("database_reachable"))fail("health guard incomplete");

const scores=read("functions/api/v2/events/[id]/scores.js");
if(!scores.includes("Scorecard confirmed; organizer must unlock it for correction"))fail("confirmed-card server lock missing");
if(!scores.includes("v2_score_revisions")||!scores.includes("AND revision=?"))fail("atomic score revision guard missing");

const forty=read("migrations/0008_live_round_guards.sql");
if(!forty.includes("trg_v2_40_limit_insert")||!forty.includes("40 scores are already counted"))fail("40 Ball DB cap missing");

console.log("PREFLIGHT PASS");
console.log("Course: 18 holes · Par 72 · six approved men's tees");
console.log("Migrations: 0002–0008 present");
console.log("Ballyhack game parity: present");
console.log("Sync conflict protection: present");
console.log("Confirmed-card server lock: present");
console.log("40 Ball database cap: present");
console.log("Recovery + environment safeguards: present");
