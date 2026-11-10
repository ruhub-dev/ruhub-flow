// Fail before publishing a frontend that cannot save shared projects.
const configured=process.env.FLOW_API_ORIGIN||'https://ruhub-signal-flow.hubwork-1806.chatgpt.site';
const owner=process.env.GITHUB_REPOSITORY_OWNER;
const origin=process.env.FLOW_PAGES_ORIGIN||(owner?`https://${owner.toLowerCase()}.github.io`:null);
if(!origin)throw Error('Set FLOW_PAGES_ORIGIN or GITHUB_REPOSITORY_OWNER');
const response=await fetch(new URL('/api/projects',configured),{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'},signal:AbortSignal.timeout(15000)});
if(response.status!==204||response.headers.get('Access-Control-Allow-Origin')!==origin)throw Error(`Shared editing is not configured for ${origin}. Add that exact origin to FLOW_ALLOWED_ORIGINS on the API server before deploying Pages.`);
console.log('Shared-project API accepts the configured Pages origin.');
