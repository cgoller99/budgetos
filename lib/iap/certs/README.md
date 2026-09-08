# Apple Root Certificates

Downloaded from https://www.apple.com/certificateauthority/ for App Store
Server Library `SignedDataVerifier`.

The runtime loads the same certificates from embedded base64 in
`appleRootCertificates.ts` so serverless deploys always include them.

Do not commit In-App Purchase `.p8` private keys here.
