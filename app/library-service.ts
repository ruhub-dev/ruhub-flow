import {z} from 'zod';
import {builtinTemplateId} from './library-model.ts';
import {verifiedAccount,linkRole} from './account-access.ts';
import {library,connectorOptions,type LibraryDevice} from './model.ts';
const identifier=z.string().min(1).max(100).refine(v=>!['__proto__','constructor','prototype'].includes(v));
const port=z.object({id:identifier,label:z.string().trim().min(1).max(80),type:z.enum(['SDI','HDMI','Audio','LAN','USB','Sync','Power']),dir:z.enum(['in','out']),connector:z.string().refine(v=>connectorOptions.includes(v)).optional()});
export const templateSchema=z.object({brand:z.string().trim().min(1).max(100),model:z.string().trim().min(1).max(160),group:z.string().trim().min(1).max(80),ports:z.array(port).min(1).max(512),sourceUrl:z.string().url().startsWith('https://www.blackmagicdesign.com/').optional(),verifiedAt:z.string().max(20).optional(),profileScope:z.string().max(500).optional(),profileNote:z.string().max(2000).optional()}).superRefine((v,ctx)=>{if(new Set(v.ports.map(p=>p.id)).size!==v.ports.length)ctx.addIssue({code:'custom',message:'Порты должны иметь разные ID'})});
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function items(db:any){const rows=(await db.prepare('SELECT * FROM flow_library ORDER BY id').all()).results as any[];const byId=new Map(rows.map(r=>[r.id,r]));return [...library.map((template,index)=>{const id=builtinTemplateId(template),r=byId.get(id);return {id,version:r?.version||0,builtin:true,overridden:!!r?.document,template:r?.document?JSON.parse(r.document):template}}),...rows.filter(r=>r.id.startsWith('custom:')&&r.document).map(r=>({id:r.id,version:r.version,builtin:false,overridden:true,template:JSON.parse(r.document)}))]}
export async function handleLibrary(req:Request,db:any){
 const user=await verifiedAccount(req,db);if(!user)return json({error:'Войдите в аккаунт'},401);
 if(req.method==='GET'){const row=await db.prepare('SELECT COALESCE(SUM(version),0) AS revision FROM flow_library').first();const revision=Number(row.revision);if(new URL(req.url).searchParams.get('revision')===String(revision))return json({unchanged:true,revision});return json({items:await items(db),revision})}
 const body=await req.json() as any;
 const project=typeof body.project==='string'?await db.prepare('SELECT * FROM projects WHERE id=?').bind(body.project).first():null;
 const role=project&&linkRole(project,body.key);if(!role||role==='viewer')return json({error:'Для общей библиотеки нужен доступ редактора к открытой схеме'},403);
 const managed=await db.prepare('SELECT user_id FROM account_owned_projects WHERE project=?').bind(project.id).first();if(role==='owner'&&managed&&managed.user_id!==user.id)return json({error:'Ссылка владельца доступна только владельцу'},403);
 const now=new Date().toISOString();
 if(body.action==='create'){
  const parsed=templateSchema.safeParse(body.template);if(!parsed.success)return json({error:'Проверьте названия, типы и ID портов'},400);
  const count=await db.prepare("SELECT count(*) AS n FROM flow_library WHERE id LIKE 'custom:%' AND document IS NOT NULL").first();if(count.n>=1000)return json({error:'Лимит общей библиотеки — 1000 своих устройств'},400);
  const id='custom:'+crypto.randomUUID();await db.prepare('INSERT INTO flow_library(id,document,version,updated,updated_by) VALUES(?,?,1,?,?)').bind(id,JSON.stringify(parsed.data),now,user.id).run();return json({id});
 }
 if(!['save','reset'].includes(body.action)||typeof body.id!=='string'||!Number.isInteger(body.version)||body.version<0)return json({error:'Неверная версия шаблона'},400);
 const isBuiltin=library.some(template=>builtinTemplateId(template)===body.id);
 if(!isBuiltin&&!/^custom:[a-f0-9-]{36}$/.test(body.id))return json({error:'Шаблон не найден'},404);
 if(body.action==='reset'&&!isBuiltin)return json({error:'Исходный шаблон не найден'},400);
 const old=await db.prepare('SELECT version FROM flow_library WHERE id=?').bind(body.id).first();if((old?.version||0)!==body.version)return json({error:'Другой инженер уже изменил шаблон. Закройте конфигурацию и откройте актуальную версию.'},409);
 if(!isBuiltin&&!old)return json({error:'Шаблон не найден'},404);
 const parsed=body.action==='save'?templateSchema.safeParse(body.template):null;if(parsed&&!parsed.success)return json({error:'Проверьте названия, типы и ID портов'},400);
 const document=parsed?.success?JSON.stringify(parsed.data):null;
 const result=old?await db.prepare('UPDATE flow_library SET document=?,version=version+1,updated=?,updated_by=? WHERE id=? AND version=?').bind(document,now,user.id,body.id,body.version).run():await db.prepare('INSERT INTO flow_library(id,document,version,updated,updated_by) VALUES(?,?,1,?,?) ON CONFLICT(id) DO NOTHING').bind(body.id,document,now,user.id).run();
 if(!result.meta.changes)return json({error:'Шаблон изменён одновременно другим инженером. Откройте его заново.'},409);
 return json({ok:true});
}
