export async function jsonRequest(url:string,init:RequestInit={},timeoutMs=20000,fetcher:typeof fetch=fetch){
 try{
  const response=await fetcher(url,{...init,signal:init.signal||AbortSignal.timeout(timeoutMs)});
  const data=await response.json();
  return {response,data};
 }catch(e){
  if(e instanceof Error&&['AbortError','TimeoutError'].includes(e.name))throw Error('Сервер отвечает слишком долго. Проверьте соединение и повторите попытку.');
  throw e;
 }
}
export function singleFlight<T>(task:()=>Promise<T>){
 let running=false;
 return async()=>{if(running)return;running=true;try{return await task()}finally{running=false}};
}
