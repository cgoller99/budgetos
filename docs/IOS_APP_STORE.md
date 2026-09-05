# Buxme iOS App Store (Capacitor)

## Architecture decision

Buxme is a Next.js App Router app with SSR auth, API routes, Plaid, Stripe, and Supabase.
It **cannot** be fully statically exported into Capacitor `webDir` without breaking those
server flows.

The iOS app is therefore a **remote-URL Capacitor shell**:

| Setting | Value |
| --- | --- |
| `appId` | `co.buxme.app` |
| `appName` | `Buxme` |
| `webDir` | `native/www` (placeholder only) |
| `server.url` | `https://buxme.co` |

The web deployment is unchanged. Native plugins (keyboard, status bar, splash, deep links,
StoreKit via `@capgo/native-purchases`) run only when `Capacitor.isNativePlatform()` is true.

**Secrets stay on the server.** The native bundle does not embed Stripe secret keys,
Supabase service role, or Apple IAP private keys. Those remain Vercel / server env vars.

---

## Native UX shell (iOS)

When `Capacitor.isNativePlatform()` is true on iOS, the app uses an app-first shell:

- Bottom tabs: **Home · Accounts · Activity · Bills · More**
- More sheet: Income, Goals, Investments, Transactions, Reports, Calendar, Settings, Household, …
- Compact top bar, safe-area chrome, bottom sheets, haptics, pull-to-refresh, scroll restore
- Web / desktop navigation is unchanged

## Status

- Capacitor 8.5 + iOS platform project are committed.
- Native detection, deep-link routing, safe-area CSS, IAP UI path, account deletion, AASA,
  privacy manifest, dual-billing guards, and iOS UX polish are in code.
- **This environment cannot run Xcode.** Do **not** treat the app as App Store–ready until
  `Product → Archive` succeeds on a Mac.

---

## Commands on Windows (dev machine)

```powershell
cd path\to\buxme
git checkout cursor/capacitor-ios-app-store-88fd
npm install

# Web verification (does not require Mac)
npm run lint
npm run build
npm run test:capacitor-deep-links
npm run test:profile-privilege-guard
npm run test:stripe-checkout-privilege

# Apply Apple IAP DB columns (needs Supabase DB credentials in .env.local)
npm run apply:apple-iap-migration
npm run apply:profile-privilege-guard

# Sync Capacitor config into ios/ (safe on Windows; Xcode open is Mac-only)
npx cap sync ios
```

Optional Vercel env (server-only, never `NEXT_PUBLIC_`):

```text
APPLE_IAP_ISSUER_ID=
APPLE_IAP_KEY_ID=
APPLE_IAP_PRIVATE_KEY=
APPLE_IAP_APP_APPLE_ID=
# optional:
# APPLE_IAP_BUNDLE_ID=co.buxme.app
# APPLE_IAP_ENVIRONMENT=Production
# For Sandbox-only local testing you may set APPLE_IAP_ENVIRONMENT=Sandbox
# and omit APPLE_IAP_APP_APPLE_ID. Production (default) fails closed without it.
```

ASN V2 production URL:

```text
https://buxme.co/api/iap/apple/notifications
```

AASA appID is set to `Y7UJK54GL9.co.buxme.app` (Team ID `Y7UJK54GL9`).
Confirm production serves it at
`https://buxme.co/.well-known/apple-app-site-association`.

---

## Apple IAP backend architecture (Guideline 3.1.1)

Premium is granted only when **active Stripe** OR **active verified Apple**
subscription is present. Apple Premium is **never** granted from client-supplied
product/transaction/expiry fields alone.

| Path | Behavior |
| --- | --- |
| `POST /api/iap/apple/verify` | Requires Apple credentials. Verifies StoreKit `signedTransactionInfo` (JWS) and/or looks up `transactionId` via App Store Server API, cryptographically verifies with Apple Root CAs, checks bundle id + allowed product IDs + expiry/revocation, then writes profile. |
| `POST /api/iap/apple/notifications` | App Store Server Notifications V2. Verifies `signedPayload`, applies renew/expire/refund/revoke/grace states. Idempotent. Never overwrites an active Stripe entitlement. |
| `GET /api/entitlements` | Shared Premium gate. Apple rows without a future `subscription_current_period_end` fail closed. Expired Apple access is cleared as a hygiene fallback. |
| Restore purchases | Native restore still calls `/api/iap/apple/verify` (same trusted path). |
| Ownership binding | New purchases pass the authenticated Buxme user UUID as StoreKit `appAccountToken` via `@capgo/native-purchases` `purchaseProduct({ appAccountToken })`. If Apple’s verified transaction includes `appAccountToken`, it must match the authenticated user. |

### Legacy / restore without `appAccountToken`

Purchases created before ownership binding may omit `appAccountToken`. For a **cryptographically verified** Apple transaction where `appAccountToken` is absent:

- first-link to the verifying Buxme user is allowed (restore / legacy compatibility)
- `originalTransactionId` uniqueness still prevents moving a subscription already linked to another Buxme account
- client fields still never grant Premium

Allowed product IDs (must match App Store Connect exactly):

- `com.buxme.pro.monthly` → Pro ($7.99/month in US storefront; UI shows StoreKit `priceString`)
- `com.buxme.proplus.monthly` → Pro+ ($14.99/month in US storefront; UI shows StoreKit `priceString`)

> Note: These IDs intentionally do **not** use the `co.buxme.app` bundle-id prefix. ASC products were created as `com.buxme.*`.

---

## App icon (TestFlight / StoreKit purchase sheet)

The Apple purchase sheet uses the **native AppIcon** from the uploaded binary — not the web favicon and not Capgo/web updates.

| Setting | Required value |
| --- | --- |
| Asset catalog | `ios/App/App/Assets.xcassets/AppIcon.appiconset` |
| App Icons Source / Primary App Icon Set Name | `AppIcon` (`ASSETCATALOG_COMPILER_APPICON_NAME`) |
| `CFBundleIconName` / `INFOPLIST_KEY_CFBundleIconName` | `AppIcon` |
| Icon art | Navy background + bright blue folded-ribbon **B** (never the Capacitor white grid / blue mark) |

Verify before archiving:

```bash
npm run test:ios-appicon
```

In Xcode → target **App** → **General** → **App Icons and Launch Screen**: App Icons Source must be **AppIcon**.  
Then **Product → Clean Build Folder**, delete DerivedData for this project if an old placeholder still appears, Archive, and upload a **new** TestFlight build. Install that build before judging the purchase-sheet icon.

---

## Commands on Mac (required for native build)

```bash
cd path/to/buxme
git pull
npm install
npm run test:ios-appicon
npx cap sync ios
npx cap open ios
```

In Xcode:

1. Select team signing for target **App** (`co.buxme.app`).
2. Confirm **Associated Domains** capability includes:
   - `applinks:buxme.co`
   - `applinks:www.buxme.co`
   - `webcredentials:buxme.co`
3. Confirm URL scheme `buxme` is present (Info → URL Types).
4. Confirm **In-App Purchase** capability is enabled.
5. Confirm **App Icons Source = AppIcon** and the navy Buxme icon (not Capacitor white).
6. Product → Clean Build Folder, then Archive → Distribute to TestFlight / App Store Connect (new build number).

Verify flows inside the native shell:

- [ ] Signup / login
- [ ] Email confirmation (Universal Link → app)
- [ ] Password reset
- [ ] Plaid Link + OAuth return (`/oauth/plaid`)
- [ ] Household invitations
- [ ] Stripe web subscriber still shows Pro after login
- [ ] IAP purchase Pro / Pro+ (Sandbox)
- [ ] Restore Purchases
- [ ] Manage App Store subscription link
- [ ] Account deletion
- [ ] External https links open in system browser
- [ ] Keyboard does not cover inputs; safe areas OK on notched iPhones

---

## Apple dashboard tasks

### App Store Connect — subscriptions

1. Create app with bundle id `co.buxme.app`, name **Buxme**.
2. Create a subscription group (e.g. **Buxme Premium**).
3. Create auto-renewable subscriptions in that group:
   - `com.buxme.pro.monthly` → **Buxme Pro** (1 month, e.g. $7.99 US)
   - `com.buxme.proplus.monthly` → **Buxme Pro+** (1 month, e.g. $14.99 US)
4. Set pricing, localization, and review screenshot/notes for each product.
5. Confirm products are in the same subscription group so upgrades/downgrades work.
6. Do **not** invent yearly Apple products for this release unless intentionally added later.
7. Add Sandbox testers (Users and Access → Sandbox).
8. Complete Privacy Nutrition Labels to match `PrivacyInfo.xcprivacy`.
9. Provide App Privacy Policy URL (`https://buxme.co/privacy`).
10. Account deletion: Settings → Account → Delete Account.

### App Store Connect — IAP API key + ASN V2

1. Users and Access → Integrations → **In-App Purchase** → create key.
2. Download the `.p8` once. Store only in Vercel / password manager — never commit.
3. Note **Issuer ID** and **Key ID**.
4. App Information → copy numeric **Apple ID** → `APPLE_IAP_APP_APPLE_ID`.
5. App → App Store Server Notifications → Production / Sandbox URL:
   - `https://buxme.co/api/iap/apple/notifications`
6. Prefer Version 2 notifications.

### Vercel Production env (manual; do not auto-deploy from this PR)

```text
APPLE_IAP_ISSUER_ID=<issuer uuid>
APPLE_IAP_KEY_ID=<key id>
APPLE_IAP_PRIVATE_KEY=<PEM with \n newlines>
APPLE_IAP_APP_APPLE_ID=<numeric app Apple ID>   # required for Production
# optional
APPLE_IAP_BUNDLE_ID=co.buxme.app
APPLE_IAP_ENVIRONMENT=Production
```

Production verification/ASN **fail closed** if `APPLE_IAP_APP_APPLE_ID` is missing.
Set `APPLE_IAP_ENVIRONMENT=Sandbox` only for Sandbox-focused testing (App Apple ID may be omitted there).

### Apple Developer

1. App ID `co.buxme.app` with Associated Domains + In-App Purchase.
2. Team ID `Y7UJK54GL9` is already configured in AASA as `Y7UJK54GL9.co.buxme.app`
   (unrelated to IAP crypto; leave as-is unless Universal Links fail).
3. Validate AASA: [Apple CDN validator](https://search.developer.apple.com/appsearch-validation-tool/).

### Supabase Auth

Add redirect URLs:

- `https://buxme.co/auth/callback`
- `https://buxme.co/auth/confirm`
- `buxme://auth/callback`

### Plaid

Keep production redirect URI:

- `https://buxme.co/oauth/plaid`

(Universal Links reopen the Capacitor app.)

### Stripe

Web checkout remains on **web only**. The iOS UI hides Stripe Checkout and uses StoreKit.
Server blocks Stripe checkout when an Apple subscription is active, and blocks Apple sync when
a Stripe subscription is active. ASN never clobbers an active Stripe entitlement.

---

## Remaining App Store blockers

1. **Xcode Archive must succeed** on a Mac (signing, capabilities, SPM packages).
2. Confirm production AASA serves `Y7UJK54GL9.co.buxme.app`.
3. **Create StoreKit products** in App Store Connect matching product IDs above.
4. **Add `APPLE_IAP_*` secrets to Vercel** and configure ASN V2 URL (code is ready; credentials are manual).
5. **App icons / screenshots / review notes / privacy policy** for Connect metadata.
6. **Manual device QA** of auth, Plaid OAuth, sandbox IAP purchase, restore, and Stripe web subscriber access on iOS.
7. Confirm **In-App Purchase** capability in Xcode.

Until items 1–4 and sandbox purchase verification are done, the app is **not** ready for App Store submission.
