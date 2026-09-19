
const COURSE={
 par:[4,5,3,4,4,4,3,5,4,4,4,5,3,4,3,5,4,4],
 handicap:[8,6,14,12,4,2,16,18,10,1,7,15,9,5,17,11,13,3],
 tees:{
  Black:{rating:76.1,slope:147},Gold:{rating:74.3,slope:140},
  Blue:{rating:71.2,slope:135},White:{rating:68.4,slope:122},Red:{rating:65.2,slope:104}
 }
};
const players=[
 {id:"A",name:"A",index:1.2,tee:"Black",g:1,side:"a"},
 {id:"B",name:"B",index:5.8,tee:"Gold",g:1,side:"b"},
 {id:"C",name:"C",index:10.6,tee:"Blue",g:1,side:"a"},
 {id:"D",name:"D",index:17.4,tee:"White",g:1,side:"b"},
 {id:"E",name:"E",index:3.1,tee:"Black",g:2,side:"a"},
 {id:"F",name:"F",index:8.9,tee:"Gold",g:2,side:"b"},
 {id:"G",name:"G",index:14.2,tee:"Blue",g:2,side:"a"},
 {id:"H",name:"H",index:22.5,tee:"Red",g:2,side:"b"}
];
function ch(p){const t=COURSE.tees[p.tee];return Math.round(p.index*(t.slope/113)+(t.rating-72))}
function strokes(p,h){const c=ch(p);if(c<=0)return 0;const base=Math.floor(c/18),rem=c%18,si=COURSE.handicap[h-1];return base+(si<=rem?1:0)}
function pts(p,h,gross){const n=gross-strokes(p,h),d=n-COURSE.par[h-1];return d<=-3?5:d===-2?4:d===-1?3:d===0?2:d===1?1:0}

const scores={};
for(const p of players){
 scores[p.id]={};
 for(let h=1;h<=18;h++){
   const mod=((p.id.charCodeAt(0)*3+h*5)%5)-1;
   scores[p.id][h]=Math.max(2,COURSE.par[h-1]+mod);
 }
}
if(Object.values(scores).reduce((s,m)=>s+Object.keys(m).length,0)!==144) throw new Error("144 scores not created");

function net(p,h){return scores[p.id][h]-strokes(p,h)}
function teams(g){const gp=players.filter(p=>p.g===g);return {a:gp.filter(p=>p.side==="a"),b:gp.filter(p=>p.side==="b")}}
function match(g,holes){
 const t=teams(g);let aw=0,bw=0;
 for(const h of holes){
  const av=Math.min(...t.a.map(p=>net(p,h))),bv=Math.min(...t.b.map(p=>net(p,h)));
  if(av<bv)aw++;else if(bv<av)bw++;
 }
 return {winner:aw>bw?"a":bw>aw?"b":"half",aw,bw};
}
const front=[1,2,3,4,5,6,7,8,9],back=[10,11,12,13,14,15,16,17,18],overall=[...front,...back];
const before=match(1,front);

// Verify post-entry editing against the ball that actually counts for Team A.
// Force BOTH Team A players above Team B on Hole 1, capture the state,
// then lower one Team A player's score enough to become the counted winning ball.
const teamBNet=Math.min(net(players[1],1),net(players[3],1));
for(const p of [players[0],players[2]]){
  const targetNet=teamBNet+3;
  scores[p.id][1]=Math.max(1,targetNet+strokes(p,1));
}
const editBefore=match(1,front);

scores.A[1]=Math.max(1,(teamBNet-2)+strokes(players[0],1));
const editAfter=match(1,front);
if(editBefore.aw===editAfter.aw && editBefore.bw===editAfter.bw) throw new Error("post-round counted-ball edit did not alter Nassau state");

function press(g,from,to){return match(g,Array.from({length:to-from+1},(_,i)=>from+i))}
const p1=press(1,4,9),p2=press(2,5,9),p3=press(1,13,18);
for(const p of [p1,p2,p3]) if(!["a","b","half"].includes(p.winner)) throw new Error("press outcome invalid");

function forty(g){
 const arr=[];
 players.filter(p=>p.g===g).forEach(p=>{for(let h=1;h<=18;h++)arr.push(pts(p,h,scores[p.id][h]))});
 arr.sort((a,b)=>b-a);
 return arr.slice(0,40).reduce((a,b)=>a+b,0);
}
const forty1=forty(1),forty2=forty(2);
if(!(forty1>0&&forty2>0)) throw new Error("40 Ball failed");

const ledger=Object.fromEntries(players.map(p=>[p.id,0]));
function apply(g,winner,amt){
 if(winner==="half")return;
 const t=teams(g),win=winner==="a"?t.a:t.b,lose=winner==="a"?t.b:t.a;
 win.forEach(p=>ledger[p.id]+=amt);lose.forEach(p=>ledger[p.id]-=amt);
}
for(const g of [1,2]){
 for(const holes of [front,back,overall])apply(g,match(g,holes).winner,5);
}
apply(1,p1.winner,5);apply(2,p2.winner,5);apply(1,p3.winner,5);
const fortyWinner=forty1>forty2?1:forty2>forty1?2:0;
if(fortyWinner) players.forEach(p=>ledger[p.id]+=p.g===fortyWinner?5:-5);
const ledgerSum=Object.values(ledger).reduce((a,b)=>a+b,0);
if(ledgerSum!==0) throw new Error("ledger not zero sum after full regression");

delete scores.H[18];
if(Object.keys(scores.H).length!==17) throw new Error("incomplete score state invalid");
scores.H[18]=5;

console.log("PASS: created and validated all 144 gross scores");
console.log("PASS: post-entry score edit recalculates Nassau");
console.log("PASS: three manual press outcomes calculated");
console.log(`PASS: 40 Ball recalculated (${forty1} vs ${forty2})`);
console.log("PASS: full outing ledger remains zero-sum");
console.log("PASS: incomplete score can be removed and restored safely");
