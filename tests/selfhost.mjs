import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,cpSync,readFileSync,readdirSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {DatabaseSync} from 'node:sqlite';
const built=resolve('outputs/selfhost'),root=mkdtempSync(join(tmpdir(),'ruhub-flow-test-'));
for(const d of ['app','public','migrations','data'])cpSync(join(built,d),join(root,d),{recursive:true});
const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
const base='http://127.0.0.1:'+port;let child,stderr='';
async function start(){child=spawn(process.execPath,['--disable-warning=ExperimentalWarning',join(root,'app/server.mjs')],{env:{...process.env,FLOW_HOME:root,FLOW_PORT:String(port)},stdio:['ignore','pipe','pipe']});child.stderr.on('data',c=>stderr+=c.toString());for(let i=0;i<100;i++){try{if((await fetch(base+'/healthz')).ok)return}catch{}if(child.exitCode!==null)throw Error('Server failed: '+stderr);await new Promise(r=>setTimeout(r,100))}throw Error('Startup timed out')}
async function stop(){const p=child;if(!p||p.exitCode!==null)return;p.kill('SIGTERM');await new Promise((r,j)=>{p.once('exit',r);setTimeout(()=>j(Error('Shutdown timed out')),12000).unref()})}
async function call(path,{body,token,key,session,headers={},method}={}){const r=await fetch(base+path,{method:method||(body?'POST':'GET'),headers:{...(body?{'Content-Type':'application/json'}:{}),...(token||key?{Authorization:'Bearer '+(token||key)}:{}),...(session?{'X-Flow-Session':'Bearer '+session}:{}),...headers},body:body?JSON.stringify(body):undefined});let data;try{data=await r.json()}catch{}return {status:r.status,data}}
try{
 await start();assert.equal((await fetch(base+'/healthz')).headers.get('Access-Control-Allow-Origin'),'https://ruhub-dev.github.io');assert.equal((await fetch(base+'/')).status,200);const html=await(await fetch(base+'/')).text();assert(!html.includes('chatgpt.site'));const js=readdirSync(join(root,'public/assets')).find(x=>x.endsWith('.js'));assert(!readFileSync(join(root,'public/assets',js),'utf8').includes('hubwork-1806.chatgpt.site'));
 const pages='https://ruhub-dev.github.io';
 const preflight=await fetch(base+'/api/project',{method:'OPTIONS',headers:{Origin:pages,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization, content-type, x-flow-session'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),pages);assert(preflight.headers.get('Access-Control-Allow-Headers').includes('X-Flow-Session'));
 for(const badHeaders of [{'Access-Control-Request-Headers':'x-unknown'},{'Access-Control-Request-Method':'DELETE'}]){const r=await fetch(base+'/api/project',{method:'OPTIONS',headers:{Origin:pages,'Access-Control-Request-Method':'POST',...badHeaders}});assert.equal(r.status,403)}
 const forbidden=await fetch(base+'/api/account?config=local',{headers:{Origin:'https://evil.test'}});assert.equal(forbidden.status,403);assert.equal(forbidden.headers.get('Access-Control-Allow-Origin'),null);
 const allowed=await fetch(base+'/api/account?config=local',{headers:{Origin:pages}});assert.equal(allowed.status,200);assert.equal(allowed.headers.get('Access-Control-Allow-Origin'),pages);
 for(const path of ['/data/flow.sqlite','/app/server.mjs','/migrations/0000.sql','/../data/flow.sqlite','/api/migration-export'])assert.equal((await fetch(base+path)).status,404);
 assert.equal((await call('/api/auth/login',{body:{username:'anyone',password:'12345678'},headers:{Origin:'https://other.test'}})).status,403);
 assert.equal((await call('/api/account?config=local')).data.configured,true);
 const password='test1234';const a=await call('/api/auth/register',{headers:{Origin:pages},body:{username:'qa-selfhost-a@example.test',password,name:'QA owner'}});assert.equal(a.status,200);const b=await call('/api/auth/register',{body:{username:'qa-selfhost-b',password}});assert.equal(b.status,200);
 const owner=a.data.token,guest=b.data.token;
 assert.equal((await call('/api/account',{token:owner})).data.projects.length,0);
 const created=await call('/api/account',{token:owner,headers:{Origin:pages},body:{action:'create',document:{title:'Self-host persistence',nodes:{},edges:{}}}});assert.equal(created.status,200);const p=created.data.project;const path='/api/project?id='+encodeURIComponent(p.id);
 assert.equal((await call(path,{key:p.key})).status,401);assert.equal((await call(path,{key:p.key,session:guest})).status,403);
 const share=await call(path,{key:p.key,session:owner,body:{action:'share'}});assert.equal(share.status,200);const {editor,viewer}=share.data;
 assert.equal((await call(path,{key:viewer,session:guest,body:{ops:[{kind:'title',value:'Forbidden'}]}})).status,403);
 assert.equal((await call(path,{key:editor,session:guest,headers:{Origin:pages},body:{ops:[{kind:'title',value:'Updated on own server'}],name:'QA'}})).status,200);
 assert.equal((await call('/api/account',{token:guest})).data.projects.length,0);
 assert.equal((await call('/api/account',{token:guest,body:{action:'attach',id:p.id,key:editor}})).status,200);
 assert.equal((await call('/api/account',{token:guest})).data.projects[0].role,'editor');
 assert.equal((await call(path,{key:p.key,session:owner})).data.document.title,'Updated on own server');
 await stop();await start();assert.equal((await call(path,{key:p.key,session:owner})).data.document.title,'Updated on own server');
 const login=await call('/api/auth/login',{headers:{Origin:pages},body:{username:'QA-SELFHOST-A@EXAMPLE.TEST',password}});assert.equal(login.status,200);
 const recovery=await call('/api/auth/recover',{body:{username:'qa-selfhost-a@example.test',password:'new12345',recovery:a.data.recovery}});assert.equal(recovery.status,200);assert.equal((await call(path,{key:p.key,session:owner})).status,401);
 assert.equal((await call(path,{key:p.key,session:recovery.data.token,body:{action:'share',rotate:true}})).status,200);assert.equal((await call(path,{key:editor,session:guest})).status,403);assert.equal((await call('/api/account',{token:guest})).data.projects.length,0);
 await stop();const db=new DatabaseSync(join(root,'data/flow.sqlite'));assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);db.close();assert(readdirSync(join(root,'backups')).filter(x=>x.endsWith('.sqlite')).length>=2);
 console.log('PASS: imported database integrity; static isolation; same-origin policy; email login; account isolation; owner/editor/viewer access; editing; restart persistence; recovery; link revocation; backups.');
}finally{await stop();rmSync(root,{recursive:true,force:true})}
