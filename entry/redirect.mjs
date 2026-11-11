export const CURRENT_URL='https://raw.githubusercontent.com/ruhub-dev/ruhub-flow/main/connection/current.json';
export function tunnelOrigin(value){
 if(typeof value!=='string')throw Error('Не указан адрес сервера');
 const u=new URL(value);
 if(u.protocol!=='https:'||!/^([a-z0-9]+(?:-[a-z0-9]+)+)\.trycloudflare\.com$/.test(u.hostname)||u.port||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Неверный адрес сервера');
 return u.origin;
}
export function destination(config,fragment=''){
 if(config?.version!==1||!['online','offline'].includes(config.state))throw Error('Неверный файл подключения');
 const origin=tunnelOrigin(config.url);
 // Project capabilities remain in the fragment; they never reach GitHub or raw.githubusercontent.com.
 const params=new URLSearchParams(fragment.replace(/^#/,'')),id=params.get('p'),key=params.get('k');
 const hash=id&&key&&id.length<=150&&key.length<=200?'#'+new URLSearchParams({p:id,k:key}).toString():'';
 return origin+'/'+hash;
}
export async function connect({fetcher=fetch,fragment='',signal}={}){
 const response=await fetcher(CURRENT_URL+'?t='+Date.now(),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal});
 if(!response.ok)throw Error('Не удалось получить адрес компьютера');
 const config=await response.json();
 return {url:destination(config,fragment),state:config.state};
}
if(typeof document!=='undefined'){
 const status=document.getElementById('status'),hint=document.getElementById('hint'),retry=document.getElementById('retry'),direct=document.getElementById('direct');
 let busy=false;
 async function run(){if(busy)return;busy=true;retry.disabled=true;direct.hidden=true;status.textContent='Подключаемся к RUHUB Flow…';hint.textContent='Ищем актуальный адрес вашего компьютера.';
  try{
   const {url,state}=await connect({fragment:location.hash,signal:AbortSignal.timeout(10000)});direct.href=url;direct.hidden=false;
   if(state==='offline'){status.textContent='Сервер сейчас выключен';hint.textContent='Запустите START_INTERNET.cmd на компьютере с RUHUB Flow, затем нажмите «Повторить». ';return;}
   status.textContent='Проверяем соединение…';
   const health=await fetch(new URL('/healthz',url),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(8000)});
   const data=await health.json();if(!health.ok||data.ok!==true||data.service!=='ruhub-flow-selfhost')throw Error('Сервер не отвечает');
   location.replace(url);
  }catch{status.textContent='Не удалось подключиться автоматически';hint.textContent=direct.hidden?'Проверьте интернет и повторите попытку.':'Проверьте, включён ли компьютер и запущен ли RUHUB Flow. Можно повторить проверку или открыть сервер напрямую.';}
  finally{busy=false;retry.disabled=false;}
 }
 retry.addEventListener('click',()=>void run());void run();
}
