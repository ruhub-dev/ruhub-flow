import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
export const PERMANENT_URL='https://ruhub-dev.github.io/ruhub-flow/';
const API='https://api.github.com/repos/ruhub-dev/ruhub-flow/contents/connection/current.json';
export class PublishError extends Error{constructor(message,status=0){super(message);this.status=status}}
export function validTunnel(value){const u=new URL(value);if(u.protocol!=='https:'||!/^([a-z0-9]+(?:-[a-z0-9]+)+)\.trycloudflare\.com$/.test(u.hostname)||u.port||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new PublishError('Неверный адрес туннеля');return u.origin;}
export async function updateGitHub({token,url,instance,state='online',fetcher=fetch,now=()=>new Date().toISOString()}){
 url=validTunnel(url);if(!/^[a-zA-Z0-9-]{1,80}$/.test(instance)||!['online','offline'].includes(state))throw new PublishError('Неверные данные подключения');
 if((token!=null&&(typeof token!=='string'||!token||/[\r\n]/.test(token)))||(token==null&&fetcher===fetch))throw new PublishError('Не задан ключ GitHub');
 const headers={Accept:'application/vnd.github+json',...(token?{Authorization:'Bearer '+token}:{}),'X-GitHub-Api-Version':'2022-11-28','User-Agent':'RUHUB-Flow-local-server'};
 for(let attempt=0;attempt<3;attempt++){
  const old=await fetcher(API+'?ref=main',{headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
  let sha,current;
  if(old.ok){const data=await old.json();sha=data.sha;if(typeof sha!=='string'||!/^[a-f0-9]{40}$/.test(sha))throw new PublishError('Неверный ответ GitHub');try{current=JSON.parse(Buffer.from(data.content||'','base64').toString('utf8'))}catch{if(state==='offline')return false}}
  else if(old.status!==404)throw githubHttpError(old.status);
  if(state==='offline'&&(!current||current.instance!==instance||current.url!==url))return false;
  if(current?.url===url&&current.instance===instance&&current.state===state)return true;
  const value={version:1,url,state,instance,updatedAt:now()};
  const result=await fetcher(API,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(12000),body:JSON.stringify({message:'Update local server connection',branch:'main',...(sha?{sha}:{}),content:Buffer.from(JSON.stringify(value,null,2)+'\n').toString('base64')})});
  if(result.ok)return true;
  if(result.status===409)continue;
  throw githubHttpError(result.status);
 }
 throw new PublishError('Адрес одновременно изменён. Повторите запуск.',409);
}
export function hasGitHubKey(root){return existsSync(join(root,'data','github-token.dpapi'))}
export async function readGitHubKey(root){
 if(process.platform!=='win32')throw new PublishError('Ключ GitHub настраивается на вашем Windows-компьютере.');
 if(!hasGitHubKey(root))throw new PublishError('Один раз запустите SETUP_GITHUB.cmd, чтобы разрешить обновление ссылки.');
 const code="$ErrorActionPreference='Stop'; $s=Get-Content -LiteralPath $env:FLOW_GH_CREDENTIAL -Raw | ConvertTo-SecureString; $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }";
 return await new Promise((resolve,reject)=>{
  const processHandle=spawn('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{windowsHide:true,env:{...process.env,FLOW_GH_CREDENTIAL:join(root,'data','github-token.dpapi')},stdio:['ignore','pipe','pipe']});
  let value='';processHandle.stdout.on('data',b=>{value+=b.toString();if(value.length>4096)processHandle.kill()});processHandle.stderr.resume();
  const timer=setTimeout(()=>{processHandle.kill();reject(new PublishError('Не удалось открыть локальный ключ GitHub. Повторите SETUP_GITHUB.cmd.'))},12000);
  processHandle.on('error',()=>{clearTimeout(timer);reject(new PublishError('Не удалось открыть PowerShell для ключа GitHub.'))});
  processHandle.on('exit',exitCode=>{clearTimeout(timer);if(exitCode===0&&/^(?:github_pat_|ghp_)[A-Za-z0-9_]+$/.test(value.trim()))resolve(value.trim());else reject(new PublishError('Не удалось расшифровать ключ. Запустите SETUP_GITHUB.cmd под текущим пользователем Windows.'))});
 });
}
export async function publicHealth(url,fetcher=fetch){const response=await fetcher(validTunnel(url)+'/healthz',{signal:AbortSignal.timeout(8000),cache:'no-store',redirect:'error'});if(!response.ok)return false;const value=await response.json();return value.ok===true&&value.service==='ruhub-flow-selfhost';}

export function tunnelSignal(text){return {url:text.match(/https:\/\/[a-z0-9]+(?:-[a-z0-9]+)+\.trycloudflare\.com/)?.[0]||'',connected:/Registered tunnel connection/.test(text)}}
export function formatPublishFailure(error){
 if(error instanceof PublishError)return error.message;
 const raw=error?.cause?.code||error?.code||error?.name||'UnknownError';
 const allowed=['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ECONNRESET','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN','AbortError','TimeoutError','TypeError','SyntaxError'];
 const code=allowed.includes(raw)?raw:'NetworkError';
 return 'Обновление GitHub: ошибка '+code+'. Повторим автоматически. Подробности: logs/link-update.log';
}
export function decodeWindowsReply(output){
 let value;try{value=JSON.parse(output.replace(/^\uFEFF/,''))}catch{throw new PublishError('GitHub: Windows вернула неполный ответ. Повторите запуск.')}
 if(Number.isInteger(value.status)&&value.status>=200&&value.status<=599)return new Response(value.status===204?null:String(value.body||''),{status:value.status});
 const messages={CredentialError:'GitHub: не удалось прочитать сохранённый ключ Windows. Повторите SETUP_GITHUB.cmd под своим пользователем Windows.',NameResolutionFailure:'GitHub: Windows не смогла найти api.github.com (DNS). Проверьте подключение и DNS.',ProxyNameResolutionFailure:'GitHub: Windows не смогла найти настроенный прокси.',ConnectFailure:'GitHub: Windows не смогла подключиться к api.github.com. Проверьте сеть или прокси.',Timeout:'GitHub: истекло время ожидания ответа api.github.com.',TrustFailure:'GitHub: Windows не доверяет сертификату HTTPS. Проверка сертификатов остаётся включённой.',SecureChannelFailure:'GitHub: Windows не смогла установить защищённое HTTPS-соединение.',CredentialMissing:'Один раз запустите SETUP_GITHUB.cmd.'};
 throw new PublishError(messages[value.errorCode]||'GitHub: ошибка сетевого запроса Windows. Проверьте сеть и повторите запуск.');
}
export async function windowsGitHubRequest(root,url,options={}){
 if(process.platform!=='win32')throw new PublishError('Запрос GitHub выполняется на вашем Windows-компьютере.');
 if(![API,API+'?ref=main'].includes(url)||!['GET','PUT'].includes(options.method||'GET'))throw new PublishError('Неверный адрес запроса GitHub');
 if(!hasGitHubKey(root))throw new PublishError('Один раз запустите SETUP_GITHUB.cmd.');
 return await new Promise((resolve,reject)=>{
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(root,'github-request.ps1')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  child.stdout.setEncoding('utf8');let output='',settled=false;const finish=(error,response)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else resolve(response)};
  const timer=setTimeout(()=>{finish(new PublishError('GitHub: Windows не ответила за 25 секунд. Проверьте подключение.'));child.kill()},25000);
  child.stdout.on('data',bytes=>{output+=bytes.toString('utf8');if(output.length>131072){finish(new PublishError('GitHub: получен слишком большой ответ Windows.'));child.kill()}});child.stderr.resume();
  child.on('error',()=>finish(new PublishError('GitHub: не удалось запустить Windows PowerShell.')));
  child.stdin.on('error',()=>finish(new PublishError('GitHub: не удалось передать запрос Windows PowerShell.')));
  child.on('close',code=>{if(settled)return;try{if(code!==0)throw new PublishError('GitHub: ошибка запуска Windows PowerShell.');finish(null,decodeWindowsReply(output))}catch(e){finish(e)}});
  // The credential is read and decrypted inside PowerShell. It never enters arguments, stdin or logs.
  child.stdin.end(JSON.stringify({url,method:options.method||'GET',body:options.body||''}));
 });
}
export async function updateWindowsConnection(root,options){return await updateGitHub({...options,token:undefined,fetcher:(url,request)=>windowsGitHubRequest(root,url,request)})}

export function githubHttpError(status){
 const details={401:'ключ недействителен или истёк. Повторите SETUP_GITHUB.cmd.',403:'нет разрешения на обновление или достигнут лимит API. Проверьте Contents: Read and write для ruhub-flow.',404:'репозиторий или файл недоступен этому ключу. Проверьте выбор ruhub-dev/ruhub-flow.',407:'прокси Windows требует авторизации. Проверьте подключение через системный прокси.',429:'достигнут лимит запросов. Повторим позже.'};
 return new PublishError('GitHub: HTTP '+status+'. '+(details[status]||(status>=500?'временная ошибка GitHub или прокси. Повторим автоматически.':'GitHub не принял обновление файла подключения.')),status);
}
