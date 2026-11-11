import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,writeFileSync,unlinkSync,readdirSync} from 'node:fs';
import {resolve,join,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openDatabase,backupDatabase,importSnapshot} from './database.mjs';
import {handleAccount} from '../../app/account-service.ts';
import {authResponse} from '../../app/auth-response.ts';
import {projectHandler} from '../../app/project-service.ts';
const root=resolve(process.env.FLOW_HOME||fileURLToPath(new URL('../',import.meta.url))),publicRoot=join(root,'public');
const db=openDatabase(root);
const seed=join(root,'data','initial-backup.json');
if(existsSync(seed)){
 const marker=join(root,'data','initial-import.done');
 if(!existsSync(marker)){
  importSnapshot(db,JSON.parse(readFileSync(seed,'utf8')));
  writeFileSync(marker,new Date().toISOString());
 }
}
if(process.argv.includes('--backup')){console.log('Backup saved: '+await backupDatabase(db,root));db.sqlite.close();process.exit(0)}
await backupDatabase(db,root);
const port=Number(process.env.FLOW_PORT||8787);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid FLOW_PORT');
const handleProject=projectHandler(db);
const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.json':'application/json; charset=utf-8'};
const fail=(status:number,error:string)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
const server=createServer(async(incoming,outgoing)=>{
 let response:Response;
 try{
  const host=incoming.headers.host||'127.0.0.1:'+port;
  if(!/^(?:[a-z0-9-]+\.)*[a-z0-9-]+(?::\d+)?$/i.test(host))throw Error('Invalid host');
  const forwarded=incoming.headers['x-forwarded-proto'];const scheme=forwarded==='https'?'https':'http';
  const url=new URL(incoming.url||'/',scheme+'://'+host);if(url.host!==host)throw Error('Invalid URL');
  const method=incoming.method||'GET';
  if(url.pathname.startsWith('/api/')){
   if(!['GET','POST','OPTIONS'].includes(method)){response=fail(405,'Метод недоступен')}
   else if(incoming.headers.origin&&incoming.headers.origin!==url.origin){response=fail(403,'Запрос с другого сайта запрещён')}
   else if(method==='OPTIONS'){response=new Response(null,{status:204})}
   else {
    const max=url.pathname.startsWith('/api/auth/')?4096:600000;
    let body:Buffer|undefined;
    if(method==='POST'){
     if(!/^application\/json(?:;|$)/i.test(incoming.headers['content-type']||'')){outgoing.writeHead(415);outgoing.end();incoming.resume();return}
     const chunks:Buffer[]=[];let bytes=0;for await(const chunk of incoming){bytes+=chunk.length;if(bytes>max){outgoing.writeHead(413,{'Connection':'close'});outgoing.end();return}chunks.push(chunk)}body=Buffer.concat(chunks);
    }
    const headers=new Headers();for(const [key,value] of Object.entries(incoming.headers)){if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value)}
    // cloudflared is the only non-browser caller on loopback; direct clients cannot choose a remote IP.
    headers.set('CF-Connecting-IP',incoming.headers['cf-connecting-ip'] as string||incoming.socket.remoteAddress||'local');
    const request=new Request(url,{method,headers,body:body?new Uint8Array(body):undefined});
    const action=/^\/api\/auth\/(register|login|recover)$/.exec(url.pathname)?.[1];
    if(action)response=await authResponse(request,db,'',action as 'register'|'login'|'recover');
    else if(url.pathname==='/api/account')response=await handleAccount(request,db);
    else if(url.pathname==='/api/project')response=await handleProject(request);
    else response=fail(404,'Адрес не найден');
   }
  }else if(url.pathname==='/healthz'){response=Response.json({ok:true,service:'ruhub-flow-selfhost'})}
  else if(!['GET','HEAD'].includes(method)){response=fail(405,'Метод недоступен')}
  else {
   const path=resolve(publicRoot,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   if(!path.startsWith(publicRoot+sep)||!existsSync(path)||!statSync(path).isFile())response=fail(404,'Файл не найден');
   else response=new Response(method==='HEAD'?null:readFileSync(path),{headers:{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':url.pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"}});
  }
 }catch(e){console.error('Request failed:',e instanceof Error?e.name:'Error');response=fail(400,'Не удалось выполнить запрос')}
 response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','no-referrer');response.headers.set('X-Frame-Options','DENY');
 outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(Buffer.from(await response.arrayBuffer()));
});
server.requestTimeout=20000;server.headersTimeout=10000;server.maxHeadersCount=60;
let backupRunning=false;const timer=setInterval(async()=>{if(backupRunning)return;backupRunning=true;try{await backupDatabase(db,root);const files=readdirSync(join(root,'backups')).filter(x=>/^flow-.*\.sqlite$/.test(x)).sort();for(const old of files.slice(0,-48))unlinkSync(join(root,'backups',old));db.sqlite.prepare('DELETE FROM presence WHERE updated<?').run(Date.now()-60000);db.sqlite.prepare('DELETE FROM account_sessions WHERE expires<?').run(Date.now())}catch{console.error('Automatic backup failed')}finally{backupRunning=false}},3600000);timer.unref();
server.listen(port,'127.0.0.1',()=>{console.log('RUHUB Flow: http://127.0.0.1:'+port);console.log('Accounts and diagrams: '+join(root,'data','flow.sqlite'));console.log('Keep this window open. Press Ctrl+C to stop.');});
let stopping=false;async function stop(){if(stopping)return;stopping=true;clearInterval(timer);server.close(async()=>{try{await backupDatabase(db,root)}finally{db.sqlite.close();process.exit(0)}});setTimeout(()=>process.exit(1),10000).unref()}
process.on('SIGINT',stop);process.on('SIGTERM',stop);server.on('error',e=>{console.error(e.message);db.sqlite.close();process.exit(1)});
