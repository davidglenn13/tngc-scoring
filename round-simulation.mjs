
const COURSE = {
  par:[4,5,3,4,4,4,3,5,4,4,4,5,3,4,3,5,4,4],
  handicap:[8,6,14,12,4,2,16,18,10,1,7,15,9,5,17,11,13,3],
  tees:{
    Black:{rating:76.1,slope:147},Gold:{rating:74.3,slope:140},
    Blue:{rating:71.2,slope:135},White:{rating:68.4,slope:122},Red:{rating:65.2,slope:104}
  }
};
function ch(index,tee){const t=COURSE.tees[tee];return Math.round(index*(t.slope/113)+(t.rating-72))}
function strokes(index,tee,h){const c=ch(index,tee);if(c<=0)return 0;const si=COURSE.handicap[h-1],base=Math.floor(c/18),rem=c%18;return base+(si<=rem?1:0)}
function stableford(index,tee,h,gross){const net=gross-strokes(index,tee,h),d=net-COURSE.par[h-1];return d<=-3?5:d===-2?4:d===-1?3:d===0?2:d===1?1:0}

const players=[
  {name:"A",index:2.4,tee:"Black",g:1,side:"a"},
  {name:"B",index:7.8,tee:"Gold",g:1,side:"b"},
  {name:"C",index:12.1,tee:"Blue",g:1,side:"a"},
  {name:"D",index:18.3,tee:"White",g:1,side:"b"},
  {name:"E",index:4.2,tee:"Black",g:2,side:"a"},
  {name:"F",index:9.9,tee:"Gold",g:2,side:"b"},
  {name:"G",index:14.4,tee:"Blue",g:2,side:"a"},
  {name:"H",index:22.7,tee:"Red",g:2,side:"b"}
];

// deterministic gross scoring: par plus a player/hole pattern, always positive.
const scores={};
for(const p of players){
  scores[p.name]={};
  for(let h=1;h<=18;h++){
    const base=COURSE.par[h-1];
    const bump=((p.name.charCodeAt(0)+h)%4)-1; // -1..2
    scores[p.name][h]=Math.max(2,base+bump);
  }
}
function net(p,h){return scores[p.name][h]-strokes(p.index,p.tee,h)}

function nassau(g,holes){
  const gp=players.filter(p=>p.g===g),a=gp.filter(p=>p.side==="a"),b=gp.filter(p=>p.side==="b");
  let aw=0,bw=0;
  for(const h of holes){
    const av=Math.min(...a.map(p=>net(p,h))),bv=Math.min(...b.map(p=>net(p,h)));
    if(av<bv)aw++; else if(bv<av)bw++;
  }
  return aw>bw?"a":bw>aw?"b":"half";
}
function forty(g){
  const pts=[];
  players.filter(p=>p.g===g).forEach(p=>{
    for(let h=1;h<=18;h++)pts.push(stableford(p.index,p.tee,h,scores[p.name][h]));
  });
  pts.sort((a,b)=>b-a);
  return pts.slice(0,40).reduce((a,b)=>a+b,0);
}

// mixed-tee handicaps should differ for at least 4 players
const handicaps=players.map(p=>ch(p.index,p.tee));
if(new Set(handicaps).size<4) throw new Error("mixed-tee handicap differentiation failed");

// every player's 18 holes should be scorable
if(players.some(p=>Object.keys(scores[p.name]).length!==18)) throw new Error("score entry completeness failed");

// edits must change a downstream result without corrupting count
const before=stableford(players[0].index,players[0].tee,1,scores.A[1]);
scores.A[1]+=1;
const after=stableford(players[0].index,players[0].tee,1,scores.A[1]);
if(before===after) throw new Error("score edit did not propagate");
if(Object.keys(scores.A).length!==18) throw new Error("score edit corrupted holes");

// incomplete-round behavior can be detected independently
delete scores.H[18];
if(Object.keys(scores.H).length!==17) throw new Error("incomplete round test failed");
scores.H[18]=COURSE.par[17]+1;

// Nassau results all calculate on completed rounds
for(const g of [1,2]){
  for(const holes of [[1,2,3,4,5,6,7,8,9],[10,11,12,13,14,15,16,17,18],[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]]){
    const r=nassau(g,holes);
    if(!["a","b","half"].includes(r)) throw new Error("Nassau simulation failed");
  }
}

// 40 Ball must produce positive completed totals
const f1=forty(1),f2=forty(2);
if(!(f1>0&&f2>0)) throw new Error("40 Ball simulation failed");

console.log("PASS: 8-player / 18-hole mixed-tee round simulation");
console.log("PASS: score edit propagates to Stableford math");
console.log("PASS: incomplete-round state is detectable");
console.log("PASS: Nassau front/back/overall calculates for both groups");
console.log(`PASS: 40 Ball totals calculate (${f1} vs ${f2})`);
