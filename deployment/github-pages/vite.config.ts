import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 root:fileURLToPath(new URL('./',import.meta.url)),
 base:process.env.FLOW_PAGES_BASE_PATH||'/ruhub-flow/',
 publicDir:fileURLToPath(new URL('../../public',import.meta.url)),
 plugins:[react()],
 define:{'import.meta.env.VITE_FLOW_API_ORIGIN':JSON.stringify(process.env.FLOW_API_ORIGIN||'https://ruhub-signal-flow.hubwork-1806.chatgpt.site'),'import.meta.env.VITE_FLOW_SYNC_MS':'5000','import.meta.env.VITE_FLOW_HEARTBEAT_MS':'10000'},
 build:{outDir:fileURLToPath(new URL('../../outputs/github-pages',import.meta.url)),emptyOutDir:true},
 css:{postcss:fileURLToPath(new URL('../../',import.meta.url))}
});
