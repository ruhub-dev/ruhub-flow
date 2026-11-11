import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,cpSync,mkdirSync,writeFileSync,readFileSync,chmodSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
if(process.platform==='win32'){console.log('Skipped Linux cloudflared stub test');process.exit(0)}
const root=mkdtempSync(join(tmpdir(),'ruhub-link-fix-'));let child,output='';
try{
 for(const d of ['app','public','migrations'])cpSync(join('outputs/selfhost',d),join(root,d),{recursive:true});
 for(const f of ['launcher.mjs','github-publisher.mjs'])cpSync(join('deployment/selfhost',f),join(root,f));
 mkdirSync(join(root,'runtime'));mkdirSync(join(root,'data'));writeFileSync(join(root,'data/github-token.dpapi'),'synthetic-placeholder-not-a-credential');
 const stub=join(root,'runtime/cloudflared');writeFileSync(stub,"#!/usr/bin/env node\nconsole.error('Requesting https://api.trycloudflare.com/tunnel');console.error('Visit https://launcher-regression-test-flow.trycloudflare.com');setTimeout(()=>console.error('INF Registered tunnel connection connIndex=0'),1600);setInterval(()=>{},1000);\n");chmodSync(stub,0o700);
 const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
 child=spawn(process.execPath,[join(root,'launcher.mjs'),'--internet'],{env:{...process.env,FLOW_PORT:String(port)},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>output+=b.toString());child.stderr.on('data',b=>output+=b.toString());
 for(let i=0;i<80&&!output.includes('Прямой адрес сервера:');i++){if(child.exitCode!==null)throw Error(output);await new Promise(r=>setTimeout(r,50))}
 assert(output.includes('Прямой адрес сервера:'));assert(!output.includes('Запрос GitHub выполняется на вашем Windows-компьютере.'));assert(!output.includes('api.trycloudflare.com'));assert.equal(readFileSync(join(root,'PUBLIC_URL.txt'),'utf8').trim(),'https://launcher-regression-test-flow.trycloudflare.com');
 for(let i=0;i<80&&!output.includes('Запрос GitHub выполняется на вашем Windows-компьютере.');i++)await new Promise(r=>setTimeout(r,50));
 assert(output.includes('Туннель подключён к Cloudflare.'));assert(output.includes('Запрос GitHub выполняется на вашем Windows-компьютере.'));assert(!output.includes('Не удалось обновить ссылку GitHub. Проверьте интернет; повторим автоматически.'));
 child.kill('SIGINT');await new Promise(r=>child.once('exit',r));assert.equal(child.exitCode,0);console.log('PASS: URL allocation does not publish prematurely; registered connection triggers update; no misleading public-health failure; child processes stop.');
}finally{if(child&&child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r))}rmSync(root,{recursive:true,force:true})}
