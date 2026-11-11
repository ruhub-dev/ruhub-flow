import {spawn} from 'node:child_process';
import {createWriteStream,mkdirSync,writeFileSync,existsSync,unlinkSync,appendFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {PERMANENT_URL,hasGitHubKey,updateWindowsConnection,tunnelSignal,formatPublishFailure,PublishError} from './github-publisher.mjs';
const root=dirname(fileURLToPath(import.meta.url));const internet=process.argv.includes('--internet');const backup=process.argv.includes('--backup');
if(backup){const child=spawn(process.execPath,['--disable-warning=ExperimentalWarning',join(root,'app','server.mjs'),'--backup'],{cwd:root,stdio:'inherit'});child.on('exit',code=>process.exit(code??1))}
else {
 const port=Number(process.env.FLOW_PORT||8787),local='http://127.0.0.1:'+port;
 mkdirSync(join(root,'logs'),{recursive:true});
 try{const check=await fetch(local+'/healthz',{signal:AbortSignal.timeout(1000)});if(check.ok)throw new Error('Сервер на этом порту уже запущен. Используйте его окно или остановите Ctrl+C.')}catch(e){if(e.message?.startsWith('Сервер'))throw e;}
 const server=spawn(process.execPath,['--disable-warning=ExperimentalWarning',join(root,'app','server.mjs')],{cwd:root,stdio:'inherit'});
 let stopping=false,tunnel=null,publicUrl='',published=false,publishing=false,tunnelConnected=false,retryTimer=null,task=Promise.resolve();const instance=randomUUID();
 const configured=internet&&hasGitHubKey(root);
 async function publish(){
  if(stopping||publishing||published||!publicUrl||!configured||!tunnelConnected)return;
  publishing=true;
  task=(async()=>{try{
   if(stopping)return;
   await updateWindowsConnection(root,{url:publicUrl,instance});published=true;
   if(stopping)return;
   writeFileSync(join(root,'PERMANENT_URL.txt'),PERMANENT_URL+'\r\n');
   console.log('\nПОСТОЯННАЯ ССЫЛКА ДЛЯ ВАС И ИНЖЕНЕРОВ:\n'+PERMANENT_URL+'\nАдрес обновлён автоматически. Ссылки на схемы: кнопка «Поделиться».\n');open(PERMANENT_URL);
  }catch(e){const message=formatPublishFailure(e);console.error(message);try{appendFileSync(join(root,'logs','link-update.log'),new Date().toISOString()+' '+message+'\n')}catch{};if(e instanceof PublishError&&[401,403,404].includes(e.status)){clearInterval(retryTimer);console.error('Запустите SETUP_GITHUB.cmd для проверки или замены ключа. Прямой адрес: '+publicUrl)}}finally{publishing=false}})();
  await task;
 }
 async function stop(code=0){if(stopping)return;stopping=true;clearInterval(retryTimer);tunnel?.kill();const closed=server.exitCode!==null?Promise.resolve():new Promise(r=>server.once('exit',r));server.kill('SIGINT');
  const offline=(async()=>{await task;if(published&&publicUrl){try{await updateWindowsConnection(root,{url:publicUrl,instance,state:'offline'})}catch{}}})();
  await Promise.race([Promise.all([offline,closed]),new Promise(r=>setTimeout(r,7000))]);process.exit(code);
 }
 process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
 server.on('exit',code=>{if(!stopping){console.error('Сервер остановлен. Код:',code);void stop(code||1)}});
 let ready=false;for(let attempt=0;attempt<60&&!stopping;attempt++){try{const r=await fetch(local+'/healthz',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}
 if(!ready){console.error('Не удалось запустить сервер. Проверьте сообщение выше.');void stop(1)}
 else if(!internet){console.log('\nСайт работает на вашем компьютере: '+local+'\nДля остановки нажмите Ctrl+C.');open(local)}
 else {
  if(existsSync(join(root,'PUBLIC_URL.txt')))unlinkSync(join(root,'PUBLIC_URL.txt'));
  const executable=join(root,'runtime',process.platform==='win32'?'cloudflared.exe':'cloudflared');
  if(!existsSync(executable)){console.error('Не найден HTTPS-туннель: '+executable);void stop(1)}
  else {
   if(!configured)console.log('\nДля постоянной ссылки один раз запустите SETUP_GITHUB.cmd. Пока доступен прямой адрес туннеля.');
   const log=createWriteStream(join(root,'logs','tunnel.log'),{flags:'w'});let tail='';
   const config=join(root,'runtime','quick-tunnel.yml');writeFileSync(config,'{}\n');
   tunnel=spawn(executable,['tunnel','--config',config,'--no-autoupdate','--protocol','http2','--url',local],{cwd:root,stdio:['ignore','pipe','pipe'],windowsHide:true});
   const output=chunk=>{log.write(chunk);tail=(tail+chunk.toString()).slice(-16000);const signal=tunnelSignal(tail);
    if(signal.connected&&!tunnelConnected){tunnelConnected=true;console.log('Туннель подключён к Cloudflare.');}
    if(signal.url&&!publicUrl){publicUrl=signal.url;writeFileSync(join(root,'PUBLIC_URL.txt'),publicUrl+'\r\n');console.log('\nПрямой адрес сервера: '+publicUrl+'\nНе закрывайте это окно. Для остановки: Ctrl+C.\n');if(configured){console.log('Ожидаем подключения туннеля; затем обновим постоянную ссылку…');retryTimer=setInterval(()=>void publish(),15000)}else open(publicUrl)}
    if(configured&&publicUrl&&tunnelConnected&&!published&&!publishing)void publish();
   };
   tunnel.stdout.on('data',output);tunnel.stderr.on('data',output);
   tunnel.on('error',()=>{console.error('Не удалось запустить HTTPS-туннель. Локальный сайт: '+local);void stop(1)});
   tunnel.on('exit',code=>{log.end();if(!stopping){console.error('Туннель остановлен, код '+code+'. Подробности: logs/tunnel.log');void stop(code||1)}});
   setTimeout(()=>{if(!publicUrl&&!stopping)console.log('Туннель ещё подключается. Проверьте интернет и logs/tunnel.log. Локальная проверка: '+local)},30000).unref();
  }
 }
}
function open(url){if(process.platform==='win32'){const child=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{detached:true,stdio:'ignore',windowsHide:true});child.on('error',()=>{});child.unref()}}
