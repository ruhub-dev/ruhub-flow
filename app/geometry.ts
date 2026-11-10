import type {Device} from './model';
export const MIN_DEVICE_WIDTH=180,MAX_DEVICE_WIDTH=1600,MAX_DEVICE_HEIGHT=12000;
export function deviceWidth(n:Device){return n.width??260}
export function resizeRect(original:{x:number;y:number;width:number;height:number},handle:string,dx:number,dy:number,minHeight:number){
 const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,Math.round(n)));
 const width=clamp(original.width+(handle.includes('e')?dx:handle.includes('w')?-dx:0),MIN_DEVICE_WIDTH,MAX_DEVICE_WIDTH);
 const height=clamp(original.height+(handle.includes('s')?dy:handle.includes('n')?-dy:0),minHeight,MAX_DEVICE_HEIGHT);
 return {x:handle.includes('w')?original.x+original.width-width:original.x,y:handle.includes('n')?original.y+original.height-height:original.y,width,height};
}
