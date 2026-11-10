export function apiUrl(path:string,origin=''){
 if(!path.startsWith('/api/'))throw new Error('Invalid API path');
 return origin.replace(/\/+$/,'')+path;
}
export function shareUrl(origin:string,base:string,project:string,key:string){
 return origin+(base.endsWith('/')?base:base+'/')+'#'+new URLSearchParams({p:project,k:key}).toString();
}
