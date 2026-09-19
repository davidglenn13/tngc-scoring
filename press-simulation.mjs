
function outcome(scores,fromHole){
  let a=0,b=0;
  for(let h=fromHole;h<=9;h++){
    const x=scores.a[h],y=scores.b[h];
    if(x<y)a++; else if(y<x)b++;
  }
  return a>b?"a":b>a?"b":"half";
}
const scores={a:{},b:{}};
for(let h=1;h<=9;h++){scores.a[h]=4;scores.b[h]=4;}
scores.b[2]=5; // B goes 1 down after hole 2
if(outcome(scores,3)!=="half") throw new Error("press initial state failed");
scores.b[5]=5; // A wins press from 3
if(outcome(scores,3)!=="a") throw new Error("press outcome failed");
console.log("PASS: manual Nassau press from current match hole settles independently");
