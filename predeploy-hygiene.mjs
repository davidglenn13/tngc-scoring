
import fs from "node:fs";
const html=fs.readFileSync("index.html","utf8");
const app=fs.readFileSync("app.js","utf8");
if(html.toLowerCase().includes("provisional")) throw new Error("provisional copy remains");
for(const tee of ["White/Red Hybrid","Red: {rating:"]) {
  if(app.includes(tee)) throw new Error(`Unused tee remains: ${tee}`);
}
console.log("PASS: no provisional course-data copy remains");
console.log("PASS: unused White/Red and Red tees remain excluded");
