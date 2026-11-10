import type {CableRoute} from './model';
export type XY={x:number;y:number};
export function cableGeometry(a:XY,b:XY,route?:CableRoute){
 const style=route?.style||'curve',k=Math.max(65,Math.abs(b.x-a.x)*.45);
 const c1={x:a.x+(route?.control1?.x??k),y:a.y+(route?.control1?.y??0)},c2={x:b.x+(route?.control2?.x??-k),y:b.y+(route?.control2?.y??0)};
 const lane=(a.x+b.x)/2+(route?.lane??0);
 if(style==='straight')return {path:`M${a.x} ${a.y} L${b.x} ${b.y}`,label:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},handles:[] as XY[],bounds:[a,b]};
 if(style==='orthogonal')return {path:`M${a.x} ${a.y} H${lane} V${b.y} H${b.x}`,label:{x:lane,y:(a.y+b.y)/2},handles:[{x:lane,y:(a.y+b.y)/2}],bounds:[a,b,{x:lane,y:a.y},{x:lane,y:b.y}]};
 return {path:`M${a.x} ${a.y} C${c1.x} ${c1.y},${c2.x} ${c2.y},${b.x} ${b.y}`,label:{x:(a.x+3*c1.x+3*c2.x+b.x)/8,y:(a.y+3*c1.y+3*c2.y+b.y)/8},handles:[c1,c2],bounds:[a,b,c1,c2]};
}
export function movedRoute(a:XY,b:XY,route:CableRoute|undefined,index:number,p:XY):CableRoute{
 const current=route||{style:'curve'};
 if(current.style==='orthogonal')return {...current,lane:p.x-(a.x+b.x)/2};
 const anchor=index===0?a:b;return {...current,[index===0?'control1':'control2']:{x:p.x-anchor.x,y:p.y-anchor.y}};
}
