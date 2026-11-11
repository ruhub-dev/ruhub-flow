import {corsResponse,allowedOrigin} from './api-cors.ts';
import {localAuth,AuthError} from './local-auth.ts';
export async function authResponse(req:Request,db:any,configured:string,action:'register'|'login'|'recover'){
 const origin=req.headers.get('Origin');
 if(origin&&!allowedOrigin(req,configured)&&origin!==new URL(req.url).origin)return new Response(null,{status:403});
 let result:Response;
 try{
  if(!/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||''))throw new AuthError('Нужен JSON-запрос',415);
  if(Number(req.headers.get('Content-Length')||0)>4096)throw new AuthError('Слишком большой запрос',413);
  let raw='';if(req.body){const reader=req.body.getReader();const decoder=new TextDecoder();let size=0;for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>4096){await reader.cancel();throw new AuthError('Слишком большой запрос',413)}raw+=decoder.decode(chunk.value,{stream:true})}raw+=decoder.decode();}
  let body:any;try{body=JSON.parse(raw)}catch{throw new AuthError('Неверный запрос')}
  const data=await localAuth(action,body,db,req.headers.get('CF-Connecting-IP')||'unknown');
  result=Response.json(data,{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 }catch(e){const known=e instanceof AuthError;result=Response.json({error:known?e.message:'Не удалось выполнить вход. Повторите позже.'},{status:known?e.status:503,headers:{'Cache-Control':'no-store',...(known&&e.retryAfter?{'Retry-After':String(e.retryAfter)}:{})}})}
 return corsResponse(req,result,configured);
}
