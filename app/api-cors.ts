// Only explicitly configured front-end origins may call this API from a browser.
export function allowedOrigin(request:Request,configured=''){
 const origin=request.headers.get('Origin');if(!origin||origin==='null')return null;
 return configured.split(',').map(s=>s.trim()).includes(origin)?origin:null;
}
export function corsResponse(request:Request,response:Response,configured=''){
 const headers=new Headers(response.headers);headers.append('Vary','Origin');
 const origin=allowedOrigin(request,configured);if(origin)headers.set('Access-Control-Allow-Origin',origin);
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
export function corsOptions(request:Request,configured=''){
 const origin=allowedOrigin(request,configured),method=request.headers.get('Access-Control-Request-Method');
 const requested=(request.headers.get('Access-Control-Request-Headers')||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
 if(!origin||!method||!['GET','POST'].includes(method)||requested.some(s=>!['authorization','content-type','x-flow-session'].includes(s)))return new Response(null,{status:403,headers:{Vary:'Origin'}});
 return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, X-Flow-Session','Access-Control-Max-Age':'600',Vary:'Origin'}});
}
