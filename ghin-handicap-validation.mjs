
function courseHandicap(index,rating,slope,par=72){
  return Math.round(index*(slope/113)+(rating-par));
}
function strokesOff(indexes,rating=71.1,slope=137,par=72){
  const ch=indexes.map(x=>courseHandicap(x,rating,slope,par));
  const low=Math.min(...ch);
  return {ch,so:ch.map(x=>x-low)};
}

// Screenshot set 1: Nick, Scott, William, Bill, Joseph, Jason — all Blue tees.
const s1=strokesOff([5.6,8.0,10.9,12.7,14.0,14.7]);
const expCh1=[6,9,12,14,16,17], expSo1=[0,3,6,8,10,11];
if(JSON.stringify(s1.ch)!==JSON.stringify(expCh1)) throw new Error(`GHIN set 1 CH mismatch ${s1.ch}`);
if(JSON.stringify(s1.so)!==JSON.stringify(expSo1)) throw new Error(`GHIN set 1 SO mismatch ${s1.so}`);

// Screenshot set 2: David, Tyler, Scott, Joseph — all Blue tees.
const s2=strokesOff([12.4,12.6,8.0,14.0]);
const expCh2=[14,14,9,16], expSo2=[5,5,0,7];
if(JSON.stringify(s2.ch)!==JSON.stringify(expCh2)) throw new Error(`GHIN set 2 CH mismatch ${s2.ch}`);
if(JSON.stringify(s2.so)!==JSON.stringify(expSo2)) throw new Error(`GHIN set 2 SO mismatch ${s2.so}`);

console.log("PASS: GHIN Blue-tee Course Handicaps match screenshots");
console.log("PASS: GHIN Strokes Off low player match both screenshots");
