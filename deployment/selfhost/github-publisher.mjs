import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
export const PERMANENT_URL='https://ruhub-dev.github.io/ruhub-flow/';
const API='https://api.github.com/repos/ruhub-dev/ruhub-flow/contents/connection/current.json';
export class PublishError extends Error{constructor(message,status=0){super(message);this.status=status}}
export function validTunnel(value){const u=new URL(value);if(u.protocol!=='https:'||!/^([a-z0-9]+(?:-[a-z0-9]+)+)\.trycloudflare\.com$/.test(u.hostname)||u.port||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new PublishError('Неверный адрес туннеля');return u.origin;}
export async function updateGitHub({token,url,instance,state='online',fetcher=fetch,now=()=>new Date().toISOString()}){
 url=validTunnel(url);if(!/^[a-zA-Z0-9-]{1,80}$/.test(instance)||!['online','offline'].includes(state))throw new PublishError('Неверные данные подключения');
 if(typeof token!=='string'||!token||/[\r\n]/.test(token))throw new PublishError('Не задан ключ GitHub');
 const headers={Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'RUHUB-Flow-local-server'};
 for(let attempt=0;attempt<3;attempt++){
  const old=await fetcher(API+'?ref=main',{headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
  let sha,current;
  if(old.ok){const data=await old.json();sha=data.sha;if(typeof sha!=='string'||!/^[a-f0-9]{40}$/.test(sha))throw new PublishError('Неверный ответ GitHub');try{current=JSON.parse(Buffer.from(data.content||'','base64').toString('utf8'))}catch{if(state==='offline')return false}}
  else if(old.status!==404)throw new PublishError('GitHub: HTTP '+old.status+'. Проверьте ключ и права Contents: Read and write.',old.status);
  if(state==='offline'&&(!current||current.instance!==instance||current.url!==url))return false;
  if(current?.url===url&&current.instance===instance&&current.state===state)return true;
  const value={version:1,url,state,instance,updatedAt:now()};
  const result=await fetcher(API,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(12000),body:JSON.stringify({message:'Update local server connection',branch:'main',...(sha?{sha}:{}),content:Buffer.from(JSON.stringify(value,null,2)+'\n').toString('base64')})});
  if(result.ok)return true;
  if(result.status===409)continue;
  throw new PublishError('GitHub: HTTP '+result.status+'. Проверьте ключ и права Contents: Read and write.',result.status);
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
