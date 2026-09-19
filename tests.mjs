
import fs from "node:fs";
const app=fs.readFileSync("app.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const api=fs.readFileSync("outings.js","utf8");
const apiId=fs.readFileSync("[id].js","utf8");
const common=fs.readFileSync("_common.js","utf8");
const schema=fs.readFileSync("0001_init.sql","utf8");
const checks=[
 ["8-player cap",app.includes("state.players.length >= 8")],
 ["no PIN workflow",!html.toLowerCase().includes("pin")],
 ["mixed tee selector",app.includes("COURSE.tees")],
 ["two-foursome setup",app.includes("hasSecondFoursome")&&app.includes("state.players.length >= 5")],
 ["single foursome does not require foursome two",app.includes("hasSecondFoursome() && (g1===0 || g2===0)")],
 ["foursome selector hidden for 1-4 players",app.includes("showFoursomeSelector")&&html.includes('id="foursomeTabs"')],
 ["circular navigation after 18",app.includes("state.visited18")],
 ["TNGC branding",html.includes("TNGC Scoring")],
 ["shared outing create API",api.includes("INSERT INTO outings")],
 ["shared outing get/update API",apiId.includes("UPDATE outings")],
 ["D1 schema",schema.includes("CREATE TABLE IF NOT EXISTS outings")],
 ["share-link support",app.includes('searchParams.set("outing"')],
 ["shared game join flow",app.includes("showJoinGame")&&app.includes("Join Game")&&app.includes("tngc-joined-")],
 ["multi-device polling",app.includes("setInterval")&&app.includes("3000")],
 ["rotating Nassau engine",app.includes("allNassauResults")&&app.includes("Holes 1–5")&&app.includes("Holes 16–18")&&app.includes("pairing:2")],
 ["explicit Nassau teams",app.includes("nassauTeamsForGroup")&&html.includes('id="nassauTeams"')],
 ["manual Nassau presses",app.includes("addPress")&&app.includes("Press Now")&&app.includes("pressOutcome")],
 ["press the press",app.includes("Press the Press")&&app.includes('type:"press-back"')&&app.includes("parentId")],
 ["presses included in ledger",app.includes("for(const p of (state.games.nassau.presses||[]))")],
 ["organizer mode",html.includes('id="organizerMode"')&&app.includes("applyOrganizerMode")],
 ["40 Ball engine",app.includes("fortyBallResult")&&app.includes("slice(0,40)")],
 ["ledger settlement",app.includes("paymentsFromNet")&&html.includes("The Ledger")],
 ["gross scorecard",app.includes("renderScorecard")&&html.includes("Scorecard")],
 ["game config cloud sync",common.includes("games:")&&common.includes("nassau")&&common.includes("forty")],
 ["team config cloud sync",common.includes("nassauTeams")],
 ["organizer cloud sync",common.includes("organizerMode")],
 ["score stepper controls",html.includes('id="groupProgress"')&&app.includes('data-step="1"')],
 ["foursome-size validation",app.includes("Each foursome can have no more than 4 players")],
 ["duplicate-name validation",app.includes("Player names must be unique")],
 ["round complete detection",app.includes("Round complete.")],
 ["sync status handling",html.includes('id="syncStatus"')&&app.includes("setSyncStatus")],
 ["offline fallback indicator",app.includes('Offline · scoring locally')],
 ["new outing resets wagers",app.includes('state.games={nassau:{enabled:false,wager:5,presses:[]}')],
 ["scorecard completion status",app.includes("playerRoundStatus")],
 ["six active tees",app.includes('"Gold/Blue Hybrid"')&&app.includes('"Blue/White Hybrid"')&&!app.includes('"White/Red Hybrid"')],
 ["strokes-off helper",app.includes("strokesOffForGroup")]
];
let fail=false;for(const [n,ok]of checks){console.log(`${ok?"PASS":"FAIL"}: ${n}`);if(!ok)fail=true}if(fail)process.exit(1);
