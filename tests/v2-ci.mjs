import fs from "node:fs";
import {courseHandicap,relativePlayingHandicaps,holeStrokes} from "../src/core/handicap.js";
import {NASSAU_PRESETS,rotatingTeams,pressAvailability,nassauGroupNet} from "../src/core/games/nassau.js";
import {selectionKey,fortyBallSummary,fortyBallMatch} from "../src/core/games/forty-ball.js";
import {assertZeroSum,paymentsFromNet} from "../src/core/settlement.js";
import {mergeSnapshot} from "../src/core/sync.js";
import {outboxUpsert,protectedValuesFromOutbox} from "../src/core/outbox.js";

const course=JSON.parse(fs.readFileSync(new URL("../src/course-tngc.json",import.meta.url),"utf8"));
const fail=m=>{throw new Error(m);};

if(course.par.length!==18||course.par.reduce((a,b)=>a+b,0)!==72)fail("course integrity");
if(courseHandicap(5.6,course.tees.Blue,72)!==6)fail("GHIN example Nick");
if(courseHandicap(8.0,course.tees.Blue,72)!==9)fail("GHIN example Scott");
if(courseHandicap(12.4,course.tees.Blue,72)!==14)fail("GHIN example David");
const mixed=[
 {id:"a",index:-1.0,tee:"Black"},{id:"b",index:5.6,tee:"Blue"},
 {id:"c",index:12.7,tee:"White"},{id:"d",index:8.0,tee:"Gold"}
];
const rows=relativePlayingHandicaps(mixed,course.tees,72);
if(rows.length!==4||Math.min(...rows.map(x=>x.playingHandicap))!==0)fail("mixed tee normalization");
if(holeStrokes(-1,18)!==-1)fail("plus handicap allocation");

const ps=[{id:"A"},{id:"B"},{id:"C"},{id:"D"}];
const rots=[0,1,2].map(i=>rotatingTeams(ps,i).map(t=>t.map(x=>x.id).join("")));
if(JSON.stringify(rots)!==JSON.stringify([["AB","CD"],["AC","BD"],["AD","BC"]]))fail("Nassau rotations");
if(NASSAU_PRESETS["5-5-5-1-1-1"].length!==6||NASSAU_PRESETS["6-6-6"].length!==3)fail("Nassau presets");
const seg=NASSAU_PRESETS["5-5-5-1-1-1"][0];
const net=(p,h)=>h===1?({A:4,B:4,C:5,D:6}[p.id]):null;
const press=pressAvailability({segment:seg,players:ps,presses:[],getNet:net});
if(press.kind!=="press"||press.nextHole!==2||press.pressedBy!=="b")fail("Nassau press eligibility");
if(pressAvailability({segment:NASSAU_PRESETS["5-5-5-1-1-1"][3],players:ps,presses:[],getNet:()=>4}).kind!==null)fail("single-hole press guard");

const selections={};let n=0;
for(const p of ps)for(let h=1;h<=18&&n<40;h++){selections[selectionKey(p.id,h)]=true;n++;}
const summary=fortyBallSummary({players:ps,selections,getNet:()=>4,getPar:()=>4});
if(summary.count!==40||!summary.complete)fail("manual 40 Ball");
const match=fortyBallMatch({group1:ps,group2:ps,selections1:selections,selections2:selections,getNet:()=>4,getPar:()=>4});
if(!match.complete||match.winner!==0)fail("40 Ball match");

const cash=nassauGroupNet({players:ps,preset:"6-6-6",wager:5,presses:[],getNet:(p,h)=>["A","B"].includes(p.id)?4:5});
assertZeroSum(cash);
const pays=paymentsFromNet(cash);
if(!pays.length)fail("settlement compression");

let out=[];
out=outboxUpsert(out,{playerId:"A",hole:1,gross:4,queuedAt:1});
const merged=mergeSnapshot({
 remoteRows:[{player_id:"A",hole:1,gross:5,revision:2}],
 localScores:{"A-1":4},localRevisions:{"A-1":1},
 protectedValues:protectedValuesFromOutbox(out)
});
if(merged.scores["A-1"]!==4)fail("pending score poll protection");

const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const scores=read("functions/api/v2/events/[id]/scores.js");
const common=read("functions/api/v2/_common.js");
const games=read("functions/api/v2/events/[id]/games.js");
const trigger=read("migrations/0008_live_round_guards.sql");
const html=read("index.html");
const app=read("app-v2.js");
const theme=read("tngc-theme.css");
if(!scores.includes("AND revision=?")||!scores.includes("Scorecard confirmed; organizer must unlock it for correction"))fail("server score guards");
if(!common.includes("requireOrganizer")||!common.includes("sha256Hex"))fail("organizer capability auth");
if(!games.includes("Bulk game replacement is locked after scoring begins"))fail("live game config guard");
if(!trigger.includes("trg_v2_40_limit_insert"))fail("40 Ball DB trigger");
if(!html.includes("Step 1<span>Details</span>")||!html.includes("Step 4<span>Review</span>"))fail("explicit setup step labels");
if(html.indexOf("top-game-nav")>html.indexOf("scoring-panel"))fail("Score Games Ledger navigation must be above scoring");
if(!app.includes("classList.toggle('hidden',!scoreSelected)"))fail("top navigation pane switching");
if(!html.includes("shareGameBtn")||!app.includes("function shareGame()"))fail("unique game share link");
if(!app.includes("Choose a previous player")||!app.includes("SAVED_PLAYERS_KEY"))fail("saved player picker");
if(!app.includes("Nassau Format(s)")||app.includes("trusted Ballyhack logic"))fail("Nassau setup copy");
if(!app.includes("showJoinGate")||!app.includes("lockedViewer")||!app.includes("only show individual scores for your foursome"))fail("shared-link foursome privacy");
if(!app.includes("Press the Press")||!app.includes("40 Ball — Live Scoring"))fail("live game parity UI");
if(!theme.includes("--gold:")||!theme.includes(".forty-ball-tracker")||!theme.includes(".live-nassau"))fail("TNGC theme and game surfaces");

console.log("V2 CI PASS");
console.log("Course + handicap examples");
console.log("Nassau + presses + 40 Ball parity");
console.log("Ledger zero-sum settlement");
console.log("Offline/poll merge protection");
console.log("Organizer auth + atomic scores + live-round guards");
console.log("TNGC setup + sharing + foursome privacy UI");
