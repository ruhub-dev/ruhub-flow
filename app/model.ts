import {blackmagicCatalog} from './blackmagic-catalog.ts';
export function uid(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('')}
export type Port={id:string;label:string;type:string;connector?:string;dir:'in'|'out'};
export type ProfileInfo={sourceUrl?:string;verifiedAt?:string;profileScope?:string;profileNote?:string};
export type LibraryDevice=ProfileInfo&{brand:string;model:string;group:string;ports:Port[]};
export const MAX_PORTS=512;
export type Device=ProfileInfo&{id:string;model:string;brand:string;label:string;x:number;y:number;width?:number;height?:number;ports:Port[];note:string;color:string};
export type CableRoute={style:'curve'|'straight'|'orthogonal';control1?:{x:number;y:number};control2?:{x:number;y:number};lane?:number};
export type Cable={color?:string|null;route?:CableRoute;id:string;from:string;out:string;to:string;input:string;label:string;length:string;type:string};
export type Doc={title:string;nodes:Record<string,Device>;edges:Record<string,Cable>};
export type Op={kind:'node'|'edge'|'title';id?:string;value?:any;remove?:boolean;expected?:Partial<Pick<Cable,'from'|'out'|'to'|'input'>>};
export const colors:Record<string,string>={SDI:'#52a9fa',HDMI:'#ab8bfa',Audio:'#f1b664',LAN:'#61c9a0',USB:'#dd82af',Sync:'#e6d272',Power:'#e97c7c'};
export function cableColor(c:Pick<Cable,'type'|'color'>){return c.color&&/^#[0-9a-fA-F]{6}$/.test(c.color)?c.color:colors[c.type]||'#52a9fa'}
export const connectorOptions=['BNC','HDMI-A','HDMI-mini','DisplayPort','RJ45','XLR-3','Jack-6.3','Jack-3.5','RCA','USB-A','USB-B','USB-C','LC','SC','IEC','powerCON'];
export function connectorOf(p:Port):string{return p.connector||({SDI:'BNC',HDMI:'HDMI-A',Audio:'XLR-3',LAN:'RJ45',USB:'USB-C',Sync:'BNC',Power:'IEC'}[p.type]||p.type)}
export function canConnect(a:Port,b:Port):boolean{return a.dir!==b.dir&&a.type===b.type&&connectorOf(a)===connectorOf(b)}
export function apply(doc:Doc,ops:Op[]):Doc{
 const d:Doc={...doc,nodes:{...doc.nodes},edges:{...doc.edges}},reconfigured=new Set<string>();
 for(const o of ops){
  if(o.kind==='title'){d.title=String(o.value).slice(0,120);continue}
  const map=o.kind==='node'?d.nodes:d.edges,id=o.id!;
  if(o.remove){delete map[id];if(o.kind==='node')for(const [key,e] of Object.entries(d.edges))if(e.from===id||e.to===id)delete d.edges[key]}
  else {const value=structuredClone(o.value);if(map[id])map[id]={...map[id],...value};else if(value?.id===id)map[id]=value;}
  if(o.kind==='node'&&o.value?.ports)reconfigured.add(id);
 }
 // Only configuration changes prune affected existing cables. Invalid new cables
 // remain in the candidate document so server validation rejects the operation.
 for(const [id,e] of Object.entries(d.edges))if(reconfigured.has(e.from)||reconfigured.has(e.to)){
  const a=d.nodes[e.from]?.ports.find(p=>p.id===e.out&&p.dir==='out'),b=d.nodes[e.to]?.ports.find(p=>p.id===e.input&&p.dir==='in');
  if(!a||!b||!canConnect(a,b)||a.type!==e.type)delete d.edges[id];
 }
 return d
}
const ports=(type:string,n:number,dir:'in'|'out',prefix?:string):Port[]=>Array.from({length:n},(_,i)=>({id:dir+type+i,label:(prefix||type)+' '+(i+1),type,dir}));
const baseLibrary:LibraryDevice[]=[
{brand:'Blackmagic Design',model:'URSA Broadcast G2',group:'Камеры',ports:[...ports('SDI',1,'in','RETURN'),...ports('SDI',1,'out'),...ports('Audio',2,'in')]},
{brand:'Blackmagic Design',model:'ATEM Constellation 8K',group:'Видеопульты',ports:[...ports('SDI',40,'in'),...ports('SDI',24,'out')]},
{brand:'Blackmagic Design',model:'ATEM 2 M/E Production Studio 4K',group:'Видеопульты',ports:[...ports('SDI',20,'in'),...ports('SDI',7,'out').map((p,i)=>({...p,label:i===6?'PGM':'AUX '+(i+1)}))]},
{brand:'Blackmagic Design',model:'Videohub 40×40',group:'Матрицы',ports:[...ports('SDI',40,'in'),...ports('SDI',40,'out')]},
{brand:'Blackmagic Design',model:'DeckLink 8K Pro • 4× capture',group:'Захват',ports:ports('SDI',4,'in')},
{brand:'Blackmagic Design',model:'Micro Converter SDI → HDMI',group:'Конвертеры',ports:[...ports('SDI',1,'in'),...ports('HDMI',1,'out')]},
{brand:'Blackmagic Design',model:'Micro Converter HDMI → SDI',group:'Конвертеры',ports:[...ports('HDMI',1,'in'),...ports('SDI',2,'out')]},
{brand:'Blackmagic Design',model:'HyperDeck Studio',group:'Запись',ports:[...ports('SDI',1,'in'),...ports('SDI',1,'out'),...ports('HDMI',1,'out')]},
{brand:'Generic',model:'vMix • 4 SDI + Fullscreen',group:'Компьютеры',ports:[...ports('SDI',4,'in'),...ports('SDI',4,'out'),...ports('HDMI',1,'out'),...ports('LAN',1,'in')]},
{brand:'Generic',model:'Компьютер / Observer',group:'Компьютеры',ports:[...ports('HDMI',2,'out'),...ports('LAN',1,'in'),...ports('Audio',1,'out')]},
{brand:'Generic',model:'Монитор HDMI',group:'Мониторы',ports:ports('HDMI',1,'in')},
{brand:'Generic',model:'Монитор SDI',group:'Мониторы',ports:ports('SDI',1,'in')},
{brand:'Generic',model:'Сетевой коммутатор',group:'Сеть',ports:[...ports('LAN',8,'in'),...ports('LAN',8,'out')]},
{brand:'Generic',model:'Audio Embedder',group:'Конвертеры',ports:[...ports('SDI',1,'in'),...ports('Audio',2,'in'),...ports('SDI',1,'out')]},
];
export const library:LibraryDevice[]=[...baseLibrary.map((d,i)=>i===1?blackmagicCatalog.find(x=>x.model===d.model)!:i===3?blackmagicCatalog.find(x=>x.model==='Blackmagic Videohub 40x40 12G')!:d),...blackmagicCatalog.filter(x=>!['ATEM Constellation 8K','Blackmagic Videohub 40x40 12G'].includes(x.model))];
export function makeDevice(i:number,x:number,y:number):Device{const t=library[i];return {...t,id:uid(),model:t.model,brand:t.brand,label:t.model,x,y,ports:t.ports,note:'',color:'#579cf3'}}
export function example():Doc{const a=makeDevice(0,60,100),b=makeDevice(0,60,390),c=makeDevice(2,470,100),d=makeDevice(10,900,130),f=makeDevice(5,900,370);a.label='CAM 01 · Общий план';b.label='CAM 02 · Крупный план';c.label='ATEM · Основной эфир';d.label='Режиссёрский монитор';f.label='Конвертер · PGM';const connect=(from:Device,out:string,to:Device,input:string,label:string):Cable=>({id:uid(),from:from.id,out,to:to.id,input,label,length:'',type:'SDI'});const edges=[connect(a,'outSDI0',c,'inSDI0','CAM 01'),connect(b,'outSDI0',c,'inSDI1','CAM 02'),connect(c,'outSDI6',f,'inSDI0','PGM'),{...connect(f,'outHDMI0',d,'inHDMI0','PREVIEW'),type:'HDMI'}];return {title:'Схема эфирной аппаратной',nodes:Object.fromEntries([a,b,c,d,f].map(n=>[n.id,n])),edges:Object.fromEntries(edges.map(e=>[e.id,e]))}}
