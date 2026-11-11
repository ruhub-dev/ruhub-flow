export type Viewport={zoom:number;pan:{x:number;y:number}};
export type TouchPoint={x:number;y:number};
export type Pinch={distance:number;zoom:number;world:{x:number;y:number}};
export const clampZoom=(value:number)=>Math.max(.2,Math.min(2,value));
export function startPinch(a:TouchPoint,b:TouchPoint,view:Viewport,origin:TouchPoint):Pinch{
 const center={x:(a.x+b.x)/2-origin.x,y:(a.y+b.y)/2-origin.y};
 return {distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom:view.zoom,world:{x:(center.x-view.pan.x)/view.zoom,y:(center.y-view.pan.y)/view.zoom}};
}
export function pinchViewport(start:Pinch,a:TouchPoint,b:TouchPoint,origin:TouchPoint):Viewport{
 const zoom=clampZoom(start.zoom*Math.hypot(a.x-b.x,a.y-b.y)/start.distance);
 const center={x:(a.x+b.x)/2-origin.x,y:(a.y+b.y)/2-origin.y};
 return {zoom,pan:{x:center.x-start.world.x*zoom,y:center.y-start.world.y*zoom}};
}
export function zoomAt(view:Viewport,zoom:number,point:TouchPoint):Viewport{
 zoom=clampZoom(zoom);return {zoom,pan:{x:point.x-(point.x-view.pan.x)*zoom/view.zoom,y:point.y-(point.y-view.pan.y)*zoom/view.zoom}};
}
export function dragThreshold(pointerType:string){return pointerType==='touch'?8:4;}
