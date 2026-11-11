import React from 'react';
import {createRoot} from 'react-dom/client';
import {readBackend,setBackend,type BackendState} from '../../app/backend-runtime.ts';
import '../../app/globals.css';
import './connection.css';
const root=createRoot(document.getElementById('root')!);
let mounted=false,busy=false,direct='',lastError='';
const appModule=import('../../app/page');appModule.catch(()=>{});
function Connection(){return <main className="flow-connect"><section><header><img src={import.meta.env.BASE_URL+'ruhub-logo.png'} alt="RUHUB"/><span>Flow<small>AV SYSTEM DESIGN</small></span></header><i/><h1>{lastError?'Нет соединения с компьютером':'Подключаемся к RUHUB Flow…'}</h1><p>{lastError||'Проверяем соединение с вашим сервером. Адрес сайта останется прежним.'}</p><div><button type="button" disabled={busy} onClick={()=>void refresh()}>{busy?'Подключаемся…':'Повторить'}</button>{direct&&<a href={direct+'/'+location.hash} rel="noreferrer">Открыть сервер напрямую →</a>}</div><footer>Сайт открыт по постоянному адресу GitHub.<br/>Аккаунты и схемы хранятся на вашем компьютере.</footer></section></main>}
function renderConnection(){if(!mounted)root.render(<Connection/>)}
async function refresh(){if(busy)return;busy=true;renderConnection();
 try{
  const next=await readBackend(fetch,AbortSignal.timeout(8000));direct=next.origin;
  if(!next.online){setBackend(next);throw Error('Компьютер с RUHUB Flow выключен или сервер остановлен. Запустите START_INTERNET.cmd.');}
  if(!mounted){setBackend(next);const {default:App}=await appModule;mounted=true;root.render(<App/>)}
  else setBackend(next);
  lastError='';
 }catch(e){if(!mounted)lastError=e instanceof Error&&e.name!=='TypeError'?e.message:'Не удалось получить адрес сервера. Проверьте интернет и нажмите «Повторить».';}
 finally{busy=false;renderConnection()}
}
renderConnection();void refresh();
setInterval(()=>void refresh(),10000);
