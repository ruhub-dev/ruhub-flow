import {spawnSync} from 'node:child_process';
import {cpSync,copyFileSync,mkdirSync,readdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
for(const config of ['server.vite.config.ts','vite.config.ts']){const r=spawnSync(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'build','--config','deployment/selfhost/'+config],{cwd:root,stdio:'inherit'});if(r.status!==0)process.exit(r.status||1)}
const dest=join(root,'outputs','selfhost');mkdirSync(join(dest,'migrations'),{recursive:true});mkdirSync(join(dest,'data'),{recursive:true});
for(const f of readdirSync(join(root,'drizzle')).filter(f=>f.endsWith('.sql')))copyFileSync(join(root,'drizzle',f),join(dest,'migrations',f));
for(const f of ['launcher.mjs','github-publisher.mjs','github-request.ps1','SETUP_GITHUB.cmd','SETUP_GITHUB.ps1','PERMANENT_LINK_RU.txt','START_LOCAL.cmd','START_INTERNET.cmd','BACKUP.cmd','READ_ME_RU.txt'])copyFileSync(join(root,'deployment','selfhost',f),join(dest,f));
console.log('Standalone build: '+dest);
