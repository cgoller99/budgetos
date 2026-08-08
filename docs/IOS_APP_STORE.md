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
- More sheet: Income, Goals, Debt, Investments, Reports, Calendar, Household, Settings, …
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
```

AASA appID is set to `Y7UJK54GL9.co.buxme.app` (Team ID `Y7UJK54GL9`).
Confirm production serves it at
`https://buxme.co/.well-known/apple-app-site-association`.

---

## Commands on Mac (required for native build)

```bash
cd path/to/buxme
git pull
npm install
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
5. Build & run on a simulator/device.
6. Product → Archive → Distribute to TestFlight / App Store Connect.

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

### App Store Connect

1. Create app with bundle id `co.buxme.app`, name **Buxme**.
2. Create auto-renewable subscriptions:
   - `co.buxme.app.pro.monthly` → Pro
   - `co.buxme.app.proplus.monthly` → Pro+
3. Attach subscriptions to an App Store subscription group.
4. Complete Privacy Nutrition Labels to match `PrivacyInfo.xcprivacy`.
5. Provide App Privacy Policy URL (`https://buxme.co/...` when published).
6. Account deletion: already available in Settings inside the app.
7. Add Sandbox testers for IAP.

### Apple Developer

1. App ID `co.buxme.app` with Associated Domains + In-App Purchase.
2. Team ID `Y7UJK54GL9` is configured in AASA as `Y7UJK54GL9.co.buxme.app`.
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
a Stripe subscription is active.

---

## Remaining App Store blockers

1. **Xcode Archive must succeed** on a Mac (signing, capabilities, SPM packages).
2. Confirm production AASA serves `Y7UJK54GL9.co.buxme.app`.
3. **Create StoreKit products** in App Store Connect matching product IDs above.
4. **App Store Server API verification** — wire `APPLE_IAP_*` env vars and harden
   `/api/iap/apple/verify` before review (currently soft-validates until credentials exist).
5. **App icons / screenshots / review notes / privacy policy** for Connect metadata.
6. **Guideline 3.1.1** — confirm reader-app / multiplatform exception if you later expose
   external Stripe manage links for existing web subscribers (current iOS path uses IAP only
   for new purchases; web Stripe subscribers are recognized and directed to manage on web).
7. **Manual device QA** of auth, Plaid OAuth, and IAP sandbox purchases.

Until items 1–4 are done, the app is **not** ready for App Store submission.
