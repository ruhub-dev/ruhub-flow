import {verifiedAccount,linkRole,bearer,tokenHash} from './account-access.ts';
import {docSchema} from './validation.ts';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
export async function handleAccount(req:Request,db:any){
 if(req.method==='GET'&&new URL(req.url).searchParams.has('config'))return json({configured:new URL(req.url).searchParams.get('config')==='local',provider:'local'});
 const user=await verifiedAccount(req,db);if(!user)return json({error:'Войдите в личный кабинет'},401);

 if(req.method==='GET'){
  const result=await db.prepare('SELECT p.*,a.access_key FROM project_accounts a JOIN projects p ON p.id=a.project WHERE a.user_id=? ORDER BY p.updated DESC LIMIT 500').bind(user.id).all();
  const projects=result.results.flatMap((r:any)=>{const role=linkRole(r,r.access_key);if(!role)return [];const d=JSON.parse(r.document);return [{id:r.id,key:r.access_key,title:d.title,role,updated:r.updated,devices:Object.keys(d.nodes||{}).length,cables:Object.keys(d.edges||{}).length}]});
  return json({user,projects});
 }
 if(Number(req.headers.get('Content-Length')||0)>600000)return json({error:'Слишком большой запрос'},413);
 const raw=await req.text();if(raw.length>600000)return json({error:'Слишком большой запрос'},413);const b=JSON.parse(raw);
 if(b.action==='logout'){await db.prepare('DELETE FROM account_sessions WHERE token_hash=?').bind(await tokenHash(bearer(req)!)).run();return json({ok:true})}
 if(b.action==='create'){
  if(!docSchema.safeParse(b.document).success||JSON.stringify(b.document).length>500000)return json({error:'Неверная схема'},400);
  const id=crypto.randomUUID(),key=crypto.randomUUID()+crypto.randomUUID(),editor=crypto.randomUUID()+crypto.randomUUID(),viewer=crypto.randomUUID()+crypto.randomUUID(),now=new Date().toISOString();
  await db.batch([db.prepare('INSERT INTO projects(id,owner,editor,viewer,document,revision,updated) VALUES(?,?,?,?,?,0,?)').bind(id,key,editor,viewer,JSON.stringify(b.document),now),db.prepare('INSERT INTO project_accounts(project,user_id,access_key,created) VALUES(?,?,?,?)').bind(id,user.id,key,now),db.prepare('INSERT INTO account_owned_projects(project,user_id) VALUES(?,?)').bind(id,user.id)]);
  return json({project:{id,key,title:b.document.title,role:'owner'}});
 }
 if(b.action==='attach'){
  if(typeof b.id!=='string'||typeof b.key!=='string')return json({error:'Неверная ссылка'},400);
  const row:any=await db.prepare('SELECT * FROM projects WHERE id=?').bind(b.id).first();if(!row)return json({error:'Проект недоступен'},403);
  const role=linkRole(row,b.key);if(!role)return json({error:'Доступ отозван'},403);if(role==='owner'){const owner:any=await db.prepare('SELECT user_id FROM account_owned_projects WHERE project=?').bind(b.id).first();if(owner&&owner.user_id!==user.id)return json({error:'Ссылка владельца доступна только в его аккаунте'},403);}
  const prior:any=await db.prepare('SELECT access_key FROM project_accounts WHERE project=? AND user_id=?').bind(b.id,user.id).first();
  const rank:Record<string,number>={owner:3,editor:2,viewer:1};const previous=prior&&linkRole(row,prior.access_key);
  const key=previous&&rank[previous]>rank[role]?prior.access_key:b.key;
  await db.prepare('INSERT INTO project_accounts(project,user_id,access_key,created) VALUES(?,?,?,?) ON CONFLICT(project,user_id) DO UPDATE SET access_key=excluded.access_key').bind(b.id,user.id,key,new Date().toISOString()).run();
  return json({ok:true});
 }
 if(b.action==='remove'){
  if(typeof b.id!=='string')return json({error:'Неверный проект'},400);
  await db.prepare('DELETE FROM project_accounts WHERE project=? AND user_id=?').bind(b.id,user.id).run();return json({ok:true});
 }
 return json({error:'Неизвестное действие'},400);
}
