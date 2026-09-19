
import fs from "node:fs";
const app=fs.readFileSync("app.js","utf8");
const expected=[
 ['Black',75.7,146,7296],
 ['Gold',73.8,142,6904],
 ['Gold/Blue Hybrid',72.6,139,6637],
 ['Blue',71.1,137,6325],
 ['Blue/White Hybrid',"70.0",127,6004],
 ['White',68.2,120,5628]
];
for(const [name,rating,slope,yards] of expected){
  if(!app.includes(`${name.includes("/")?'"'+name+'"':name}: {rating:${rating},slope:${slope},yards:${yards}}`)){
    throw new Error(`Missing ${name}`);
  }
}
console.log("PASS: 6 active TNGC tee sets loaded");
