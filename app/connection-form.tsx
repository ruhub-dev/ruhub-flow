'use client';
import {useState} from 'react';
import {Link2} from 'lucide-react';
import {type Doc,type Cable,connectorOf} from './model';
import {connectionCandidate,relinkCandidate,type CableEnd} from './relink';
export type ConnectionRequest={kind:'new';node?:string;port?:string}|{kind:'relink';edge:Cable;end:CableEnd};
export default function ConnectionForm({doc,request,onApply}:{doc:Doc;request:ConnectionRequest;onApply:(from:{node:string;port:string},to:{node:string;port:string})=>void}){
 const outputBusy=(node:string,port:string)=>Object.values(doc.edges).some(c=>c.from===node&&c.out===port);
 const freeOutput=(node:string)=>doc.nodes[node]?.ports.find(p=>p.dir==='out'&&!outputBusy(node,p.id))?.id||'';
 const list=Object.values(doc.nodes),initial=request.kind==='new'?doc.nodes[request.node||'']:undefined;
 const initialPort=initial?.ports.find(p=>p.id===(request.kind==='new'?request.port:undefined));
 const firstFrom=request.kind==='relink'?request.edge.from:initial?.ports.some(p=>p.dir==='out')&&initialPort?.dir!=='in'?initial.id:list.find(n=>n.ports.some(p=>p.dir==='out'))?.id||'';
 const firstTo=request.kind==='relink'?request.edge.to:initialPort?.dir==='in'||initial&&!initial.ports.some(p=>p.dir==='out')?initial!.id:list.find(n=>n.id!==firstFrom&&n.ports.some(p=>p.dir==='in'))?.id||'';
 const [fromNode,setFromNode]=useState(firstFrom),[toNode,setToNode]=useState(firstTo);
 const [out,setOut]=useState(request.kind==='relink'?request.edge.out:initialPort?.dir==='out'?initialPort.id:freeOutput(firstFrom));
 const [input,setInput]=useState(request.kind==='relink'?request.edge.input:initialPort?.dir==='in'?initialPort.id:'');
 const from={node:fromNode,port:out},to={node:toNode,port:input};
 const result=request.kind==='new'?connectionCandidate(doc,from,to,'preview'):relinkCandidate(doc,request.edge,request.end,request.end==='from'?fromNode:toNode,request.end==='from'?out:input);
 function allowedTarget(node:string,port:string){return request.kind==='new'?connectionCandidate(doc,from,{node,port},'preview'):relinkCandidate(doc,request.edge,request.end,node,port)}
 return <><span className="modal-icon"><Link2 size={24}/></span><h2>{request.kind==='new'?'Новое соединение':request.end==='from'?'Перенести источник кабеля':'Перенести получатель кабеля'}</h2><p className="muted">Выберите устройства и порты. Совместимость сигнала, разъёмов и занятость входа и выхода проверяются автоматически.</p>
 <div className="connection-fields"><fieldset disabled={request.kind==='relink'&&request.end==='to'}><legend>Источник сигнала</legend><label>Устройство<select aria-label="Устройство-источник" value={fromNode} onChange={e=>{setFromNode(e.target.value);setOut(request.kind==='new'?freeOutput(e.target.value):doc.nodes[e.target.value]?.ports.find(p=>p.dir==='out')?.id||'');if(request.kind==='new')setInput('')}}><option value="">Выберите устройство</option>{list.filter(n=>n.ports.some(p=>p.dir==='out')).map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></label><label>Выход<select aria-label="Выход источника" value={out} onChange={e=>{setOut(e.target.value);if(request.kind==='new')setInput('')}}><option value="">Выберите выход</option>{doc.nodes[fromNode]?.ports.filter(p=>p.dir==='out').map(p=>{const busy=request.kind==='new'&&outputBusy(fromNode,p.id),ok=!busy&&(request.kind!=='relink'||request.end!=='from'||allowedTarget(fromNode,p.id).cable);return <option key={p.id} value={p.id} disabled={!ok}>{p.label} · {p.type} · {connectorOf(p)}{busy?' — занят':!ok?' — не подходит':''}</option>})}</select></label></fieldset>
 <fieldset disabled={request.kind==='relink'&&request.end==='from'}><legend>Получатель сигнала</legend><label>Устройство<select aria-label="Устройство-получатель" value={toNode} onChange={e=>{setToNode(e.target.value);setInput('')}}><option value="">Выберите устройство</option>{list.filter(n=>n.ports.some(p=>p.dir==='in')).map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></label><label>Вход<select aria-label="Вход получателя" value={input} onChange={e=>setInput(e.target.value)}><option value="">Выберите совместимый вход</option>{doc.nodes[toNode]?.ports.filter(p=>p.dir==='in').map(p=>{const checked=request.kind==='relink'&&request.end==='from'?{cable:true,error:undefined}:allowedTarget(toNode,p.id);return <option key={p.id} value={p.id} disabled={!checked.cable}>{p.label} · {p.type} · {connectorOf(p)}{!checked.cable?' — '+checked.error:''}</option>})}</select></label></fieldset></div>
 {!result.cable&&<p className="connection-status" role="status">{!fromNode||!toNode||!out||!input?'Укажите источник, выход, получатель и вход.':result.error}</p>}
 <button className="primary full" disabled={!result.cable} onClick={()=>onApply(from,to)}>{request.kind==='new'?'Подключить кабель':'Применить перенос'}</button></>;
}
