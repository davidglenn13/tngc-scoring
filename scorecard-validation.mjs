
import fs from "node:fs";
const app=fs.readFileSync("app.js","utf8");
const par=[4, 5, 3, 4, 4, 4, 3, 5, 4, 4, 4, 5, 3, 4, 3, 5, 4, 4];
const hcp=[8, 6, 14, 12, 4, 2, 16, 18, 10, 1, 7, 15, 9, 5, 17, 11, 13, 3];
if(!app.includes(`par: [${par.join(",")}]`)) throw new Error("Par array mismatch");
if(!app.includes(`handicap: [${hcp.join(",")}]`)) throw new Error("Men's stroke-index array mismatch");
if(par.reduce((a,b)=>a+b,0)!==72) throw new Error("Par total is not 72");
if(new Set(hcp).size!==18 || Math.min(...hcp)!==1 || Math.max(...hcp)!==18) throw new Error("Stroke indexes invalid");
console.log("PASS: TNGC scorecard par confirmed for all 18 holes");
console.log("PASS: TNGC men's stroke indexes confirmed 1–18 with no duplicates");
console.log("PASS: total par = 72");
