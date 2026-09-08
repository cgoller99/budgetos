# Apple App Store Server Library test fixtures

Vendored from Apple's official open-source Node library (MIT):

https://github.com/apple/app-store-server-library-node

Paths (upstream `main`):

- `tests/resources/certs/testCA.der`
- `tests/resources/mock_signed_data/transactionInfo`
- `tests/resources/mock_signed_data/testNotification`
- `tests/resources/mock_signed_data/missingX5CHeaderClaim`

These are Apple's deterministic mock-signed JWTs + test CA used by
`SignedDataVerifier` unit tests. They are **not** production customer
transactions.

Used by `scripts/test-apple-iap-crypto.mjs` to execute real
`SignedDataVerifier.verifyAndDecode*` calls.
