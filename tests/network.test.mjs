import {test} from 'node:test';
import assert from 'node:assert/strict';
import {jsonRequest,singleFlight} from '../app/network.ts';

test('Slow polling cannot pile up concurrent requests and resumes after completion or error',async()=>{
 let release,calls=0;
 const poll=singleFlight(async()=>{calls++;return new Promise(resolve=>{release=resolve})});
 const first=poll();await poll();await poll();assert.equal(calls,1);release('ok');assert.equal(await first,'ok');
 const next=poll();assert.equal(calls,2);release('again');await next;
 let failures=0;const failed=singleFlight(async()=>{failures++;throw Error('offline')});
 await assert.rejects(failed);await assert.rejects(failed);assert.equal(failures,2);
});
test('Request deadline also covers reading the response body and reports a useful error',async()=>{
 const keepAlive=setTimeout(()=>{},500);
 try{await assert.rejects(()=>jsonRequest('https://flow.test/api/account',{},10,async(url,init)=>({json:()=>new Promise((resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true})})})),/отвечает слишком долго/)}finally{clearTimeout(keepAlive)}
});
test('HTTP status and JSON error are preserved; write requests are never automatically repeated',async()=>{
 let calls=0;const {response,data}=await jsonRequest('https://flow.test/api/project',{method:'POST',body:'{}'},1000,async()=>{calls++;return Response.json({error:'occupied'},{status:409})});
 assert.equal(response.status,409);assert.equal(data.error,'occupied');assert.equal(calls,1);
 await assert.rejects(()=>jsonRequest('https://flow.test/api/account',{},1000,async()=>{throw new TypeError('network offline')}),/network offline/);
});
