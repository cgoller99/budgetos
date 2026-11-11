import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync('app/api/admin/apple-diagnostics/route.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
let allowed=false, calls=0;
const denied={status:403,body:{error:'Forbidden'}};
const next={NextResponse:{json:(body,options={})=>({body,status:options.status??200,headers:options.headers})}};
const query={select(){return this;},eq(){return this;},not(){return this;},order(){return this;},limit(){return Promise.resolve({data:[{id:'user',full_name:'Example',subscription_status:'active',apple_original_transaction_id:'private-id'}],error:null});}};
const deps={
 '@/lib/iap/appleReconcile':{reconcileActiveAppleSubscription:async()=>({synced:true})},
 'next/server':next,
 '@apple/app-store-server-library':{Environment:{SANDBOX:'Sandbox',PRODUCTION:'Production'}},
 '@/lib/admin/apiAuth':{requireAdminApiUser:async()=>allowed?{adminSupabase:{from:()=>query}}:{response:denied}},
 '@/lib/iap/appleServerClient':{
  getVerifiedProductionSubscriptionStatus:async()=>({appleStatus:'expired'}),
  createAppleDiagnosticClient:()=>{calls++;return {requestTestNotification:async()=>({testNotificationToken:'token'}),getTestNotificationStatus:async()=>({signedPayload:'must-not-leak',sendAttempts:[{sendAttemptResult:'SUCCESS'}]})};},
 },
};
const mod={exports:{}};
vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`,{URL})(name=>{assert.ok(name in deps);return deps[name];},mod,mod.exports);
const {GET,POST}=mod.exports;
const req=(body,origin='https://buxme.co')=>new Request('https://buxme.co/api/admin/apple-diagnostics',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
assert.equal((await GET()).status,403);
assert.equal((await POST(req({action:'send_test',environment:'Production'}))).status,403);
assert.equal(calls,0);
allowed=true;
assert.equal((await POST(req({action:'send_test',environment:'Production'},'https://evil.example'))).status,403);
assert.equal((await POST(req({action:'check_test',environment:'Production'}))).status,400);
assert.equal(calls,0);
assert.equal((await POST(req({action:'send_test',environment:'Production'}))).body.token,'token');
const checked=await POST(req({action:'check_test',environment:'Production',token:'token'}));
assert.equal(checked.body.signedPayload,undefined);
assert.equal(checked.body.attempts[0].sendAttemptResult,'SUCCESS');
const audit=await GET();
assert.equal(audit.body.mode,'read_only');
assert.equal(audit.body.records[0].appleStatus,'expired');
assert.equal(audit.body.records[0].apple_original_transaction_id,undefined);
assert.equal(audit.headers['Cache-Control'],'no-store');
console.log('Apple diagnostic route authorization and read-only checks passed');
