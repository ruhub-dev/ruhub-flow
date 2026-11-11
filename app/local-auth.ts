import {scryptAsync} from '@noble/hashes/scrypt.js';
import {randomToken,tokenHash} from './account-access.ts';
const SCRYPT={N:32768,r:8,p:3,dkLen:32,maxmem:40*1024*1024,asyncTick:10};
export class AuthError extends Error{status:number;retryAfter?:number;constructor(message:string,status=400,retryAfter?:number){super(message);this.status=status;this.retryAfter=retryAfter}}
export function normalizeUsername(value:unknown){
 if(typeof value!=='string')throw new AuthError('Укажите логин или email');const s=value.trim().toLowerCase();
 if(s.includes('@')){
  const parts=s.split('@'),local=parts[0],domain=parts[1]||'',labels=domain.split('.');
  const valid=parts.length===2&&s.length<=254&&local.length>0&&local.length<=64&&/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+$/.test(local)&&!local.startsWith('.')&&!local.endsWith('.')&&!local.includes('..')&&labels.length>=2&&labels.every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
  if(!valid)throw new AuthError('Укажите email в формате name@example.com');return s;
 }
 if(!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(s))throw new AuthError('Укажите email или логин из 3–32 латинских букв, цифр, точки, дефиса или подчёркивания');return s;
}
export function validatePassword(value:unknown){if(typeof value!=='string'||[...value].length<8||[...value].length>128||new TextEncoder().encode(value).length>512)throw new AuthError('Пароль должен содержать от 8 до 128 символов');return value}
function hex(bytes:Uint8Array){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
function equal(a:string,b:string){let v=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)v|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return v===0}
let hashing=false;
async function derive(password:string,salt:string){if(hashing)throw new AuthError('Сервер обрабатывает вход. Повторите через несколько секунд.',429,3);hashing=true;try{return hex(await scryptAsync(password,salt,SCRYPT))}finally{hashing=false}}
export async function passwordHash(password:string){const salt=randomToken().slice(0,32);return 'scrypt$32768$8$3$'+salt+'$'+await derive(password,salt)}
const DUMMY='scrypt$32768$8$3$0123456789abcdef0123456789abcdef$'+'0'.repeat(64);
export async function passwordMatches(password:string,encoded:string|null){const value=encoded||DUMMY;if(!/^scrypt\$32768\$8\$3\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(value))return false;const parts=value.split('$');return equal(await derive(password,parts[4]),parts[5])&&encoded!==null}
function recoveryCode(){return 'RF-'+randomToken().toUpperCase().match(/.{8}/g)!.join('-')}
export function recoveryValue(code:unknown){if(typeof code!=='string'||code.length>160)return null;const s=code.trim().replace(/^RF-/i,'').replace(/[\s-]/g,'').toLowerCase();return /^[a-f0-9]{64}$/.test(s)?s:null}
async function recoveryHash(userId:string,code:string){return tokenHash(userId+':recovery:'+recoveryValue(code))}
export async function throttle(db:any,action:string,username:string,ip:string,now=Date.now()){
 const period=action==='login'?600000:3600000,ipLimit=action==='login'?60:10,userLimit=action==='login'?10:5;
 const expires=(Math.floor(now/period)+1)*period,scope=action+':'+Math.floor(now/period),ipKey=scope+':ip:'+await tokenHash(ip),userKey=scope+':user:'+await tokenHash(username);
 const rows=await db.batch([db.prepare('DELETE FROM auth_throttle WHERE expires<?').bind(now),...([ipKey,userKey].map(key=>db.prepare('INSERT INTO auth_throttle(key,hits,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(key,expires)))]);
 if(Number(rows[1].results?.[0]?.hits)>ipLimit||Number(rows[2].results?.[0]?.hits)>userLimit)throw new AuthError('Слишком много попыток. Попробуйте позже.',429,Math.ceil((expires-now)/1000));
}
async function session(db:any,userId:string,version:number,expectedHash:string){const token=randomToken(),expires=Date.now()+7*86400000;const result=await db.prepare('INSERT INTO account_sessions(token_hash,user_id,expires,credential_version) SELECT ?,user_id,?,version FROM local_credentials WHERE user_id=? AND version=? AND password_hash=?').bind(await tokenHash(token),expires,userId,version,expectedHash).run();if(!result.meta.changes)throw new AuthError('Вход устарел. Повторите попытку.',401);return {token,expires}}
const invalid=()=>new AuthError('Неверный логин, пароль или резервный код',401);
export async function localAuth(action:'register'|'login'|'recover',body:any,db:any,ip:string){
 if(!body||typeof body!=='object')throw new AuthError('Неверные данные');
 const username=normalizeUsername(body.username);await throttle(db,action,username,ip);
 const password=validatePassword(body.password);
 if(action==='register'){
  const name=typeof body.name==='string'?body.name.trim().slice(0,50):username;if(!name||/[\u0000-\u001f\u007f]/.test(name))throw new AuthError('Укажите имя');
  if(await db.prepare('SELECT user_id FROM local_credentials WHERE username=?').bind(username).first())throw new AuthError('Этот логин уже занят',409);
  const encoded=await passwordHash(password),id=crypto.randomUUID(),recovery=recoveryCode(),hash=await recoveryHash(id,recovery),token=randomToken(),expires=Date.now()+7*86400000;
  try{await db.batch([db.prepare('INSERT INTO flow_users(id,google_sub,email,name,created) VALUES(?,?,?,?,?)').bind(id,'local:'+id,username.includes('@')?username:'',name,new Date().toISOString()),db.prepare('INSERT INTO local_credentials(user_id,username,password_hash,recovery_hash,version) VALUES(?,?,?,?,0)').bind(id,username,encoded,hash),db.prepare('INSERT INTO account_sessions(token_hash,user_id,expires,credential_version) VALUES(?,?,?,0)').bind(await tokenHash(token),id,expires)])}catch(e){if(await db.prepare('SELECT user_id FROM local_credentials WHERE username=?').bind(username).first())throw new AuthError('Этот логин уже занят',409);throw e}
  return {token,expires,recovery,user:{id,username,name,email:username.includes('@')?username:''}};
 }
 const row:any=await db.prepare('SELECT * FROM local_credentials WHERE username=?').bind(username).first();
 if(action==='login'){if(!await passwordMatches(password,row?.password_hash||null))throw invalid();return session(db,row.user_id,row.version,row.password_hash)}
 if(!row||!recoveryValue(body.recovery)||!equal(await recoveryHash(row.user_id,body.recovery),row.recovery_hash))throw invalid();
 const encoded=await passwordHash(password),recovery=recoveryCode(),hash=await recoveryHash(row.user_id,recovery);
 const changes=await db.batch([db.prepare('UPDATE local_credentials SET password_hash=?,recovery_hash=?,version=version+1 WHERE user_id=? AND version=? AND recovery_hash=? RETURNING version').bind(encoded,hash,row.user_id,row.version,row.recovery_hash),db.prepare('DELETE FROM account_sessions WHERE user_id=? AND credential_version<(SELECT version FROM local_credentials WHERE user_id=?)').bind(row.user_id,row.user_id)]);
 if(!changes[0].meta.changes)throw invalid();return {...await session(db,row.user_id,row.version+1,encoded),recovery};
}
