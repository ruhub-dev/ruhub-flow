import {canConnect,type Doc} from './model.ts';
const portKey=(node:string,port:string)=>JSON.stringify([node,port]);
export function duplicateOutputs(doc:Doc){const groups=new Map<string,string[]>();for(const e of Object.values(doc.edges)){const key=portKey(e.from,e.out);groups.set(key,[...(groups.get(key)||[]),e.id])}return [...groups.values()].filter(ids=>ids.length>1)}
export function outputConnectionsAllowed(before:Doc,after:Doc){
 for(const ids of duplicateOutputs(after)){const edge=after.edges[ids[0]],old=new Set(Object.values(before.edges).filter(e=>e.from===edge.from&&e.out===edge.out).map(e=>e.id));if(ids.some(id=>!old.has(id)))return false}
 return true;
}
export function auditConnections(doc:Doc){const issues:{edge:string;message:string}[]=[],inputs=new Map<string,string>();const duplicates=new Set(duplicateOutputs(doc).flat());
 for(const e of Object.values(doc.edges)){
  const a=doc.nodes[e.from]?.ports.find(p=>p.id===e.out),b=doc.nodes[e.to]?.ports.find(p=>p.id===e.input);
  if(!a||!b)issues.push({edge:e.id,message:'Устройство или порт удалён'});
  else if(e.from===e.to||a.dir!=='out'||b.dir!=='in'||!canConnect(a,b)||a.type!==e.type)issues.push({edge:e.id,message:'Несовместимые порты, направление или тип сигнала'});
  const key=portKey(e.to,e.input);if(inputs.has(key))issues.push({edge:e.id,message:'Вход занят несколькими кабелями'});inputs.set(key,e.id);
  if(duplicates.has(e.id))issues.push({edge:e.id,message:'Выход занят несколькими кабелями'});
 }return issues;
}
