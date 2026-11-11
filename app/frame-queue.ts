export function frameQueue<T>(consume:(value:T)=>void,schedule:(callback:()=>void)=>number=cb=>requestAnimationFrame(cb),cancel:(id:number)=>void=id=>cancelAnimationFrame(id)){
 let frame:number|null=null,latest:T|undefined;
 const flush=()=>{if(frame!==null)cancel(frame);frame=null;const value=latest;latest=undefined;if(value!==undefined)consume(value)};
 return {push(value:T){latest=value;if(frame===null)frame=schedule(()=>{frame=null;flush()})},flush,cancel(){if(frame!==null)cancel(frame);frame=null;latest=undefined}};
}
