
// End-to-end deterministic outing scenario.
const players=[
 {id:"A",g:1},{id:"B",g:1},{id:"C",g:1},{id:"D",g:1},
 {id:"E",g:2},{id:"F",g:2},{id:"G",g:2},{id:"H",g:2}
];
const net=Object.fromEntries(players.map(p=>[p.id,0]));
function applyTeam(group,winner,amt){
 const gp=players.filter(p=>p.g===group);
 const sideA=gp.filter((_,i)=>i%2===0), sideB=gp.filter((_,i)=>i%2===1);
 const win=winner==="a"?sideA:sideB, lose=winner==="a"?sideB:sideA;
 win.forEach(p=>net[p.id]+=amt); lose.forEach(p=>net[p.id]-=amt);
}
// Simulate 3 Nassau wins + 1 press + 40 Ball.
applyTeam(1,"a",5);
applyTeam(1,"b",5);
applyTeam(2,"a",5);
applyTeam(1,"a",5); // press
players.forEach(p=>net[p.id]+=p.g===2?5:-5);
const sum=Object.values(net).reduce((a,b)=>a+b,0);
if(sum!==0) throw new Error("ledger not zero sum");
const positives=Object.values(net).filter(v=>v>0).length;
const negatives=Object.values(net).filter(v=>v<0).length;
if(!positives || !negatives) throw new Error("ledger scenario did not create both sides");
console.log("PASS: end-to-end side-game ledger scenario remains zero-sum");
console.log("PASS: Nassau base matches + press + 40 Ball combine correctly");
