import {spawn} from 'node:child_process';
import {createWriteStream,mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));const internet=process.argv.includes('--internet');const backup=process.argv.includes('--backup');
if(backup){const child=spawn(process.execPath,['--disable-warning=ExperimentalWarning',join(root,'app','server.mjs'),'--backup'],{cwd:root,stdio:'inherit'});child.on('exit',code=>process.exit(code??1))}
else {
 const port=Number(process.env.FLOW_PORT||8787),local='http://127.0.0.1:'+port;
 mkdirSync(join(root,'logs'),{recursive:true});
 try{const check=await fetch(local+'/healthz',{signal:AbortSignal.timeout(1000)});if(check.ok)throw new Error('Сервер на этом порту уже запущен. Используйте его окно или остановите Ctrl+C.')}catch(e){if(e.message?.startsWith('Сервер'))throw e;}
 const server=spawn(process.execPath,['--disable-warning=ExperimentalWarning',join(root,'app','server.mjs')],{cwd:root,stdio:'inherit'});
 let stopping=false,tunnel=null;
 function stop(code=0){if(stopping)return;stopping=true;tunnel?.kill();server.kill('SIGINT');setTimeout(()=>process.exit(code),1500)}
 process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
 server.on('exit',code=>{if(!stopping){console.error('Сервер остановлен. Код:',code);stop(code||1)}});
 let ready=false;for(let attempt=0;attempt<60&&!stopping;attempt++){try{const r=await fetch(local+'/healthz',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}
 if(!ready){console.error('Не удалось запустить сервер. Проверьте сообщение выше.');stop(1)}
 else if(!internet){console.log('\nСайт работает на вашем компьютере: '+local+'\nДля остановки нажмите Ctrl+C.');open(local)}
 else {
  const executable=join(root,'runtime',process.platform==='win32'?'cloudflared.exe':'cloudflared');
  if(!existsSync(executable)){console.error('Не найден HTTPS-туннель: '+executable);stop(1)}
  else {
   const log=createWriteStream(join(root,'logs','tunnel.log'),{flags:'w'});let announced=false,tail='';
   // An empty dedicated config prevents a user's existing named tunnel settings from changing this quick tunnel.
   const config=join(root,'runtime','quick-tunnel.yml');writeFileSync(config,'{}\n');
   tunnel=spawn(executable,['tunnel','--config',config,'--no-autoupdate','--protocol','http2','--url',local],{cwd:root,stdio:['ignore','pipe','pipe'],windowsHide:true});
   const output=chunk=>{log.write(chunk);tail=(tail+chunk.toString()).slice(-4000);const url=Array.from(tail.matchAll(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g),m=>m[0]).find(u=>!/^https:\/\/(api|www)\./.test(u));if(url&&!announced){announced=true;writeFileSync(join(root,'PUBLIC_URL.txt'),url+'\r\n');console.log('\nАДРЕС ДЛЯ ВАС И ИНЖЕНЕРОВ:\n'+url+'\n\nНе закрывайте это окно. Для остановки: Ctrl+C.\nПосле перезапуска будет новый адрес. Входите по нему и создавайте ссылки на схемы там.\n');open(url)}};
   tunnel.stdout.on('data',output);tunnel.stderr.on('data',output);
   tunnel.on('error',()=>{console.error('Не удалось запустить HTTPS-туннель. Локальный сайт: '+local);stop(1)});
   tunnel.on('exit',code=>{log.end();if(!stopping){console.error('Туннель остановлен, код '+code+'. Подробности: logs/tunnel.log');stop(code||1)}});
   setTimeout(()=>{if(!announced&&!stopping)console.log('Туннель ещё подключается. Проверьте интернет и logs/tunnel.log. Локальная проверка: '+local)},30000).unref();
  }
 }
}
function open(url){if(process.platform==='win32'){const child=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{detached:true,stdio:'ignore',windowsHide:true});child.on('error',()=>{});child.unref()}}
