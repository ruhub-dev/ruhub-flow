import {canConnect} from './model';
import type {Doc,Cable,Op} from './model';
export type CableEnd='from'|'to';
export const endpoints=(e:Cable)=>({from:e.from,out:e.out,to:e.to,input:e.input});
export function sameEndpoints(a:Cable,b:Cable){return a.from===b.from&&a.out===b.out&&a.to===b.to&&a.input===b.input}
export function relinkCandidate(doc:Doc,e:Cable,end:CableEnd,nodeId:string,portId:string):{cable?:Cable;error?:string}{
 const node=doc.nodes[nodeId],p=node?.ports.find(p=>p.id===portId);
 if(!p)return {error:'Порт не найден'};
 const fixedNode=doc.nodes[end==='from'?e.to:e.from],fixed=fixedNode?.ports.find(p=>p.id===(end==='from'?e.input:e.out));
 if(!fixed)return {error:'Второй конец кабеля больше не существует'};
 if(p.dir!==(end==='from'?'out':'in'))return {error:end==='from'?'Выберите выход устройства':'Выберите вход устройства'};
 if(!canConnect(p,fixed))return {error:'Несовместимый сигнал или разъём'};
 if(nodeId===fixedNode.id)return {error:'Нельзя соединить устройство само с собой'};
 const next={...e,...(end==='from'?{from:nodeId,out:portId}:{to:nodeId,input:portId})};
 if(Object.values(doc.edges).some(other=>other.id!==e.id&&other.to===next.to&&other.input===next.input))return {error:'Этот вход уже занят другим кабелем'};
 return {cable:next};
}
export function expectationsMet(doc:Doc,ops:Op[]):boolean{return ops.every(o=>!o.expected||(o.kind==='edge'&&!!doc.edges[o.id!]&&Object.entries(o.expected).every(([k,v])=>['from','to','out','input'].includes(k)&&(doc.edges[o.id!] as any)[k]===v)))}

export function connectionCandidate(doc:Doc,origin:{node:string;port:string},target:{node:string;port:string},id:string):{cable?:Cable;error?:string}{
 const a=doc.nodes[origin.node]?.ports.find(p=>p.id===origin.port),b=doc.nodes[target.node]?.ports.find(p=>p.id===target.port);
 if(!a||!b)return {error:'Порт больше не существует'};
 if(origin.node===target.node)return {error:'Нельзя соединить устройство само с собой'};
 if(!canConnect(a,b))return {error:'Несовместимый сигнал, разъём или направление'};
 const out=a.dir==='out'?origin:target,input=a.dir==='in'?origin:target;
 if(Object.values(doc.edges).some(e=>e.to===input.node&&e.input===input.port))return {error:'Этот вход уже занят другим кабелем'};
 return {cable:{id,from:out.node,out:out.port,to:input.node,input:input.port,label:'',length:'',type:a.type}};
}
