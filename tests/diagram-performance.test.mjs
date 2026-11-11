import {test} from 'node:test';
import assert from 'node:assert/strict';
import {library,makeDevice,example,apply} from '../app/model.ts';
import {deviceLayout,portPoint,portUsage,LayoutCache,CableLayoutCache} from '../app/diagram-layout.ts';
import {deviceWidth} from '../app/geometry.ts';
import {frameQueue} from '../app/frame-queue.ts';

function original(n,used,expanded){const visible=expanded?n.ports:n.ports.filter(p=>used.has(p.id)||n.ports.filter(q=>q.dir===p.dir).indexOf(p)<4),rows=Math.max(1,visible.filter(p=>p.dir==='in').length,visible.filter(p=>p.dir==='out').length),minHeight=88+rows*22+(n.ports.length>8?28:0),height=Math.max(n.height??88+rows*27+(n.ports.length>8?28:0),minHeight),step=(height-88-(n.ports.length>8?28:0))/rows;return {visible,rows,minHeight,height,step,point(id){const p=n.ports.find(p=>p.id===id);if(!p)return {x:n.x,y:n.y};const list=visible.filter(x=>x.dir===p.dir);return {x:n.x+(p.dir==='in'?0:deviceWidth(n)),y:n.y+73+step/2+Math.max(0,list.findIndex(x=>x.id===id))*step}}}}
test('Optimized layout keeps exact port coordinates, visibility and dimensions for all device profiles',()=>{
 for(let i=0;i<library.length;i++)for(const expanded of [false,true])for(const size of [false,true]){
  const n={...makeDevice(i,123,-40),...(size?{width:600,height:5000}:{})},used=new Set(n.ports.filter((p,j)=>j%9===0).map(p=>p.id)),old=original(n,used,expanded),next=deviceLayout(n,used,expanded);
  assert.deepEqual(next.visible.map(p=>p.id),old.visible.map(p=>p.id));for(const key of ['rows','minHeight','height','step'])assert.equal(next[key],old[key]);
  for(const p of n.ports){const a=portPoint(n,next,p.id),b=old.point(p.id);assert.equal(a.x,b.x);assert(Math.abs(a.y-b.y)<1e-8);}assert.deepEqual(portPoint(n,next,'missing'),{x:n.x,y:n.y});
 }
});
test('Moving a device reuses port layouts and only changes its connected cable geometry',()=>{
 const d=example(),usage=portUsage(d.edges),cache=new LayoutCache(),cables=new CableLayoutCache(),edge=Object.values(d.edges)[0],node=d.nodes[edge.from],layout=cache.get(node,usage.get(node.id));
 const moved={...node,x:node.x+80,y:node.y+20};assert.strictEqual(cache.get(moved,usage.get(node.id)),layout);
 const before=portPoint(node,layout,edge.out),after=portPoint(moved,layout,edge.out),target=d.nodes[edge.to],end=portPoint(target,cache.get(target,usage.get(target.id)),edge.input),g=cables.get(edge.id,before,end);
 assert.strictEqual(cables.get(edge.id,{...before},{...end}),g);assert.notStrictEqual(cables.get(edge.id,after,end),g);
 assert.notStrictEqual(cache.get({...node,height:800},usage.get(node.id)),layout);assert.notStrictEqual(cache.get(node,usage.get(node.id),true),layout);
});
test('Frame queue coalesces pointer bursts, flushes final position on release and cancels rollback previews',()=>{
 const scheduled=new Map(),seen=[];let id=0;
 const q=frameQueue(value=>seen.push(value),callback=>{scheduled.set(++id,callback);return id},key=>scheduled.delete(key));
 for(let i=0;i<1000;i++)q.push(i);assert.equal(scheduled.size,1);q.flush();assert.deepEqual(seen,[999]);assert.equal(scheduled.size,0);
 q.push('cancelled');q.cancel();assert.equal(scheduled.size,0);q.flush();assert.deepEqual(seen,[999]);
 q.push('next');const callback=[...scheduled.values()][0];scheduled.clear();callback();assert.deepEqual(seen,[999,'next']);
});
test('Editing one object preserves unchanged references without modifying the previous document or operation',()=>{
 const d=example(),snapshot=structuredClone(d),nodes=Object.values(d.nodes),moved=apply(d,[{kind:'node',id:nodes[0].id,value:{x:900}}]);
 assert.deepEqual(d,snapshot);assert.notStrictEqual(moved.nodes[nodes[0].id],nodes[0]);assert.strictEqual(moved.nodes[nodes[0].id].ports,nodes[0].ports);assert.strictEqual(moved.nodes[nodes[1].id],nodes[1]);
 for(const id of Object.keys(d.edges))assert.strictEqual(moved.edges[id],d.edges[id]);
 const ports=[{id:'replacement',label:'SDI',dir:'out',type:'SDI'}],configured=apply(d,[{kind:'node',id:nodes[0].id,value:{ports}}]);
 ports[0].label='Changed after commit';assert.equal(configured.nodes[nodes[0].id].ports[0].label,'SDI');assert.deepEqual(d,snapshot);
 assert.equal(Object.values(configured.edges).filter(e=>e.from===nodes[0].id).length,0);
});
