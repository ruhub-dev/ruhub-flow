import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({publicDir:false,ssr:{noExternal:true},build:{ssr:fileURLToPath(new URL('./server.ts',import.meta.url)),target:'node24',outDir:fileURLToPath(new URL('../../outputs/selfhost/app',import.meta.url)),emptyOutDir:true,rollupOptions:{output:{entryFileNames:'server.mjs'}}}});
