import {memo,type MutableRefObject} from 'react';
import {type Cable,cableColor} from './model';
import {type cableGeometry} from './cable-path';
type Props={cable:Cable;geometry:ReturnType<typeof cableGeometry>;from:string;to:string;dim:boolean;selected:boolean;labels:boolean;theme:string;actions:MutableRefObject<{hover:(id:string|null)=>void;select:(id:string)=>void}>};
export default memo(function CableView({cable:e,geometry:g,from,to,dim,selected,labels,theme,actions}:Props){return <g data-cable-id={e.id} className="cable" opacity={dim?.22:1} onPointerEnter={()=>actions.current.hover(e.id)} onPointerLeave={()=>actions.current.hover(null)} onPointerDown={ev=>ev.stopPropagation()} onClick={()=>actions.current.select(e.id)}>
 <title>{e.label||e.type} · {from} → {to}</title>
 <path className="cable-hit" d={g.path} fill="none" stroke="transparent" strokeWidth={16} vectorEffect="non-scaling-stroke"/>
 <path d={g.path} fill="none" stroke={theme==='dark'?'#0e1929':'#f5f7fa'} strokeWidth={selected?7:6} vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
 <path className="cable-line" d={g.path} fill="none" stroke={cableColor(e)} strokeWidth={selected?3:1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
 {e.label&&labels&&<g transform={`translate(${g.label.x},${g.label.y})`} className="cable-label"><rect x={-e.label.length*3.5-10} y="-10" width={e.label.length*7+20} height="21" rx="5" fill={theme==='dark'?'#16283f':'#f6f8fc'} stroke={theme==='dark'?'#354d6d':'#dbe3ee'}/><text textAnchor="middle" dominantBaseline="central" fill={theme==='dark'?'#c6dcfa':'#526c8d'} fontSize="10">{e.label}</text></g>}</g>});
