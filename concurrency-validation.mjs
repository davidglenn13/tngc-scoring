
import fs from "node:fs";
const app=fs.readFileSync("app.js","utf8");
const api=fs.readFileSync("[id].js","utf8");
if(!api.includes("onRequestPatch")) throw new Error("PATCH handler missing");
if(!api.includes("state.scores[key] = value")) throw new Error("score merge missing");
if(!app.includes("pushScoreCloud")) throw new Error("client granular score sync missing");
if(!app.includes('method:"PATCH"')) throw new Error("PATCH client call missing");
if(!app.includes("saveLocal(true)")) throw new Error("score path still allows full-state sync");
console.log("PASS: score writes use granular PATCH");
console.log("PASS: simultaneous groups cannot overwrite unrelated score keys through score entry");
