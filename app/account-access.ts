export type AccountIdentity={id:string;email:string;username:string;name:string};
export function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')}
export async function tokenHash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('')}
export function bearer(req:Request){const m=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.get('Authorization')||'');return m?.[1]||null}
export async function verifiedAccount(request:Request,db:any):Promise<AccountIdentity|null>{
 const token=bearer(request);if(!token)return null;
 const row=await db.prepare('SELECT u.id,u.email,u.name,c.username FROM account_sessions s JOIN flow_users u ON u.id=s.user_id JOIN local_credentials c ON c.user_id=s.user_id WHERE s.token_hash=? AND s.expires>? AND s.credential_version=c.version').bind(await tokenHash(token),Date.now()).first();
 return row?{id:row.id,email:row.email,username:row.username,name:row.name}:null;
}
export function linkRole(row:any,key:unknown):'owner'|'editor'|'viewer'|null{if(typeof key!=='string'||!key)return null;return key===row.owner?'owner':key===row.editor?'editor':key===row.viewer?'viewer':null}

export async function projectSessionStatus(req:Request,db:any,project:string,ownerAccess=false){const managed=await db.prepare('SELECT user_id FROM account_owned_projects WHERE project=?').bind(project).first();if(!managed)return 'ok';const auth=new Request(req.url,{headers:{Authorization:req.headers.get('X-Flow-Session')||''}});const user=await verifiedAccount(auth,db);if(!user)return 'login';return ownerAccess&&user.id!==managed.user_id?'forbidden':'ok'}
export async function validProjectSession(req:Request,db:any,project:string,ownerAccess=false){return await projectSessionStatus(req,db,project,ownerAccess)==='ok'}
