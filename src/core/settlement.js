export function assertZeroSum(net){
 const cents=Object.values(net).reduce((s,x)=>s+Math.round(Number(x||0)*100),0);
 if(cents!==0)throw new Error('Ledger is not zero-sum'); return true;
}
export function paymentsFromNet(net){
 const c=[],d=[];for(const [id,v] of Object.entries(net)){const x=Math.round(Number(v||0)*100);if(x>0)c.push({id,x});if(x<0)d.push({id,x:-x});}
 c.sort((a,b)=>b.x-a.x);d.sort((a,b)=>b.x-a.x);const out=[];let i=0,j=0;
 while(i<d.length&&j<c.length){const x=Math.min(d[i].x,c[j].x);out.push({from:d[i].id,to:c[j].id,amount:x/100});d[i].x-=x;c[j].x-=x;if(!d[i].x)i++;if(!c[j].x)j++;}
 return out;
}
