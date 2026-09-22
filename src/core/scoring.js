import {holeStrokes} from './handicap.js';
export function netScore(gross,ph,si){
  if(gross===''||gross===null||gross===undefined)return null;
  const g=Number(gross); if(!Number.isFinite(g)||g<1)return null;
  return g-holeStrokes(ph,si);
}
export function stablefordPoints(net,par){
  if(net===null)return null;
  const d=Number(net)-Number(par);
  if(d<=-3)return 5;if(d===-2)return 4;if(d===-1)return 3;if(d===0)return 2;if(d===1)return 1;return 0;
}
