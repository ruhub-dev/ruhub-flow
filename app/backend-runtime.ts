export type BackendState={origin:string;online:boolean};
let current:BackendState|null=null;
export const BACKEND_ADDRESS_URL='https://raw.githubusercontent.com/ruhub-dev/ruhub-flow/main/connection/current.json';
export function parseBackend(value:any):BackendState{
 if(value?.version!==1||!['online','offline'].includes(value.state)||typeof value.url!=='string')throw Error('Неверные настройки подключения');
 const u=new URL(value.url);
 if(u.protocol!=='https:'||!/^([a-z0-9]+(?:-[a-z0-9]+)+)\.trycloudflare\.com$/.test(u.hostname)||u.port||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Недопустимый адрес сервера');
 return {origin:u.origin,online:value.state==='online'};
}
export function setBackend(next:BackendState){const changed=current?.origin!==next.origin||current?.online!==next.online;current=next;if(changed&&typeof window!=='undefined')window.dispatchEvent(new Event('flow-backend-changed'));return changed;}
export function remoteApiOrigin(){if(!current||!current.online)throw Error('Компьютер с RUHUB Flow сейчас недоступен');return current.origin;}
export async function readBackend(fetcher:typeof fetch=fetch,signal?:AbortSignal){
 const r=await fetcher(BACKEND_ADDRESS_URL+'?t='+Date.now(),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal});
 if(!r.ok)throw Error('Не удалось получить адрес компьютера');return parseBackend(await r.json());
}
