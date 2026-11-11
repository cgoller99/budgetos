import assert from 'node:assert/strict';
import { summarizeVerifiedAppleStatus } from '../lib/iap/appleDiagnosticsPolicy.ts';
const transaction = {bundleId:'co.buxme.app',environment:'Production',originalTransactionId:'expected',productId:'com.buxme.pro.monthly',expiresDate:Date.parse('2026-12-01')};
const before = structuredClone(transaction);
assert.equal(summarizeVerifiedAppleStatus(transaction, 1, 'expected').appleStatus, 'active');
for (const [status,label] of [[2,'expired'],[3,'billing_retry'],[4,'grace_period'],[5,'revoked'],[99,'unknown']]) {
  assert.equal(summarizeVerifiedAppleStatus(transaction,status,'expected').appleStatus,label);
}
for (const change of [{bundleId:'another.app'},{environment:'Sandbox'},{originalTransactionId:'unrelated'}]) {
  assert.throws(()=>summarizeVerifiedAppleStatus({...transaction,...change},1,'expected'), /identity mismatch/);
}
const result=summarizeVerifiedAppleStatus({...transaction,revocationDate:Date.now()},5,'expected');
assert.equal(result.revoked,true);
assert.ok(!('originalTransactionId' in result));
assert.deepEqual(transaction,before);
console.log('Apple diagnostic identity checks passed');
