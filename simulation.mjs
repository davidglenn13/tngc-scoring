
// High-level scenario simulation for TNGC beta math.
function payments(net){
  const cr=[],db=[];
  Object.entries(net).forEach(([name,v])=>{const c=Math.round(v*100);if(c>0)cr.push({name,c});if(c<0)db.push({name,c:-c})});
  cr.sort((a,b)=>b.c-a.c);db.sort((a,b)=>b.c-a.c);
  const out=[];let i=0,j=0;
  while(i<db.length&&j<cr.length){
    const c=Math.min(db[i].c,cr[j].c);
    out.push({from:db[i].name,to:cr[j].name,amount:c/100});
    db[i].c-=c;cr[j].c-=c;if(!db[i].c)i++;if(!cr[j].c)j++;
  }
  return out;
}
const sample={A:15,B:15,C:-15,D:-15};
const p=payments(sample);
if(p.reduce((s,x)=>s+x.amount,0)!==30) throw new Error("payment balancing failed");
if(Object.values(sample).reduce((a,b)=>a+b,0)!==0) throw new Error("net not zero");
console.log("PASS: settlement simulation balances to zero");
