import {connectorOf,type LibraryDevice} from './model.ts';
export type SharedTemplate={id:string;version:number;builtin:boolean;overridden:boolean;template:LibraryDevice};
export function templateFingerprint(t:LibraryDevice){return JSON.stringify([t.brand,t.model,t.group,t.ports.map(p=>[p.label,p.dir,p.type,connectorOf(p)])])}

export function builtinTemplateId(t:LibraryDevice){return 'builtin:'+encodeURIComponent(JSON.stringify([t.brand,t.model]))}
