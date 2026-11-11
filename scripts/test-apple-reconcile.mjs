import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync('lib/iap/appleReconcile.ts','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const base={id:'user',subscription_provider:'apple',apple_environment:'Production',stripe_subscription_id:null,apple_original_transaction_id:'original',apple_transaction_id:'stored'};
let row={...base},syncs=[],verifiedCalls=0;
let apple={appleStatus:'active',productId:'com.buxme.proplus.monthly',expiresAt:'2099-01-01T00:00:00Z',revoked:false};
const query={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:row,error:null})};
const deps={
 'server-only':{},
 '@/lib/iap/appleServerClient':{getVerifiedProductionSubscriptionStatus:async()=>{verifiedCalls++;return apple;}},
 '@/lib/iap/appleSubscriptionService':{syncVerifiedAppleSubscriptionToProfile:async input=>{syncs.push(input);}},
};
const mod={exports:{}};
vm.runInNewContext('(function(require,module,exports){'+code+'\n})')(name=>{assert.ok(name in deps);return deps[name];},mod,mod.exports);
const run=()=>mod.exports.reconcileActiveAppleSubscription({from:()=>query},'user');
for(const change of [{subscription_provider:'stripe'},{apple_environment:'Sandbox'},{stripe_subscription_id:'sub'},{apple_original_transaction_id:null}]){
 row={...base,...change};await assert.rejects(run);assert.equal(syncs.length,0);
}
assert.equal(verifiedCalls,0);
row={...base};
const valid={...apple};
for(const change of [{appleStatus:'expired'},{appleStatus:'billing_retry'},{revoked:true},{expiresAt:'2000-01-01'},{expiresAt:null},{productId:null}]){
 apple={...valid,...change};await assert.rejects(run);assert.equal(syncs.length,0);
}
apple=valid;
assert.equal((await run()).synced,true);
assert.equal(syncs.length,1);
assert.equal(syncs[0].userId,'user');
assert.equal(syncs[0].originalTransactionId,'original');
assert.equal(syncs[0].transactionId,'stored');
assert.equal(syncs[0].environment,'Production');
console.log('Apple reconciliation refusal and verified-sync checks passed');
