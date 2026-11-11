import {type Cable,type Device,type Port} from './model.ts';
import {deviceWidth} from './geometry.ts';
import {cableGeometry,type XY} from './cable-path.ts';
import type {CableRoute} from './model.ts';
const emptyPorts=new Set<string>();
export function portUsage(edges:Record<string,Cable>){
 const used=new Map<string,Set<string>>();
 for(const e of Object.values(edges))for(const [node,port] of [[e.from,e.out],[e.to,e.input]]){let ports=used.get(node);if(!ports){ports=new Set();used.set(node,ports)}ports.add(port)}
 return used;
}
export function deviceLayout(n:Device,used:ReadonlySet<string>=emptyPorts,expanded=false){
 const counts={in:0,out:0},visible:Port[]=[],inputs:Port[]=[],outputs:Port[]=[],ports=new Map<string,Port>();
 for(const p of n.ports){ports.set(p.id,p);const first=counts[p.dir]++<4;if(expanded||first||used.has(p.id)){visible.push(p);(p.dir==='in'?inputs:outputs).push(p)}}
 const rows=Math.max(1,inputs.length,outputs.length),footer=n.ports.length>8?28:0,minHeight=88+rows*22+footer;
 const height=Math.max(n.height??88+rows*27+footer,minHeight),step=(height-88-footer)/rows,width=deviceWidth(n),points=new Map<string,{x:number;y:number}>();
 for(const list of [inputs,outputs])for(let i=0;i<list.length;i++){const p=list[i];points.set(p.id,{x:p.dir==='in'?0:width,y:73+step/2+i*step})}
 return {visible,inputs,outputs,ports,points,rows,minHeight,height,step,width};
}
export type DeviceLayout=ReturnType<typeof deviceLayout>;
export function portPoint(n:Device,layout:DeviceLayout,id:string){const p=layout.ports.get(id);if(!p)return {x:n.x,y:n.y};const offset=layout.points.get(id)||{x:p.dir==='in'?0:layout.width,y:73+layout.step/2};return {x:n.x+offset.x,y:n.y+offset.y}}
export class LayoutCache{
 private entries=new Map<string,{ports:Port[];used:ReadonlySet<string>;expanded:boolean;width?:number;height?:number;value:DeviceLayout}>();
 get(n:Device,used:ReadonlySet<string>=emptyPorts,expanded=false){
  const old=this.entries.get(n.id);
  if(old&&old.ports===n.ports&&old.used===used&&old.expanded===expanded&&old.width===n.width&&old.height===n.height)return old.value;
  const value=deviceLayout(n,used,expanded);this.entries.set(n.id,{ports:n.ports,used,expanded,width:n.width,height:n.height,value});return value;
 }
 prune(nodes:Record<string,Device>){for(const id of this.entries.keys())if(!nodes[id])this.entries.delete(id)}
}
export class CableLayoutCache{
 private entries=new Map<string,{ax:number;ay:number;bx:number;by:number;route?:CableRoute;value:ReturnType<typeof cableGeometry>}>();
 get(id:string,a:XY,b:XY,route?:CableRoute){const old=this.entries.get(id);if(old&&old.ax===a.x&&old.ay===a.y&&old.bx===b.x&&old.by===b.y&&old.route===route)return old.value;const value=cableGeometry(a,b,route);this.entries.set(id,{ax:a.x,ay:a.y,bx:b.x,by:b.y,route,value});return value}
 prune(edges:Record<string,Cable>){for(const id of this.entries.keys())if(!edges[id])this.entries.delete(id)}
}
