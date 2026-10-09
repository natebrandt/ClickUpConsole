import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const password=randomBytes(24).toString('hex');
async function exercise(configured){
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100'],{env:{...process.env,ADMIN_USERNAME:configured?'test-owner':'',ADMIN_PASSWORD:configured?password:'',CLICKUP_API_TOKEN:''},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
 const origin='http://127.0.0.1:3100';
 try{
  for(let i=0;i<80;i++){if(logs.includes('Ready in'))break;if(child.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,100));}
  for(const suffix of ['/', '/?_rsc=test']){
   const response=await fetch(origin+suffix,{headers:suffix.includes('_rsc')?{RSC:'1'}:{}});
   assert.equal(response.status,configured?401:503);assert.ok(!(await response.text()).includes('Ardent'));
  }
  if(configured){
   const auth={Authorization:'Basic '+Buffer.from('test-owner:'+password).toString('base64')};
   assert.equal((await fetch(origin+'/api/sync')).status,401);
   const config=await fetch(origin+'/api/sync',{headers:auth});assert.equal(config.status,200);assert.deepEqual(await config.json(),{configured:false});
   assert.equal((await fetch(origin+'/api/sync',{method:'POST',headers:{...auth,Origin:'https://other.example','Content-Type':'application/json'},body:'{"kind":"hierarchy"}'})).status,403);
   const missing=await fetch(origin+'/api/sync',{method:'POST',headers:{...auth,Origin:origin,'Content-Type':'application/json'},body:'{"kind":"hierarchy"}'});assert.equal(missing.status,503);
   assert.match((await missing.json()).error,/CLICKUP_API_TOKEN/);
   console.log('PASS sync authentication, origin enforcement, and missing-token handling');
   const wrong=await fetch(origin,{headers:{Authorization:'Basic '+Buffer.from('test-owner:wrong').toString('base64')}});assert.equal(wrong.status,401);
   const ok=await fetch(origin,{headers:{Authorization:'Basic '+Buffer.from('test-owner:'+password).toString('base64')}});
   assert.equal(ok.status,200);assert.ok((await ok.text()).includes('Ardent'));assert.match(ok.headers.get('cache-control'),/private/);
  }
  console.log(configured?'PASS authorized HTML, rejected wrong credentials and anonymous HTML/RSC':'PASS unconfigured deployment returns 503 without workspace data');
 }finally{child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}
}
await exercise(false);await exercise(true);
