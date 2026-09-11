# Buxme App Store Build 13 Review Gate

Date: 2026-09-10
Branch: `app-store-build13-release-blocker`

## Why Build 13 exists

Build 12 was rejected for two issues:

1. Guideline 3.1.2(c): the subscription screen did not clearly expose all required subscription information and legal links.
2. Guideline 2.1(b): App Review reported that the in-app purchase catalog did not load on an iPad Pro M4 running iPadOS 27.

Build 13 must not be submitted until every gate in this document passes.

## Code changes completed

- Exact product IDs remain `com.buxme.pro.monthly` and `com.buxme.proplus.monthly`.
- Native paywall now shows Buxme Pro / Buxme Pro+, one-month duration, and StoreKit-localized prices.
- Privacy Policy and Apple Standard EULA links are available directly from the native billing screen.
- StoreKit catalog loading now uses bounded retries, manual retry, online retry, and app-resume retry.
- Partial catalog responses are preserved across attempts and cannot be mistaken for a complete catalog.
- A plan cannot be purchased unless its exact StoreKit product and localized price were returned.
- Reviewer-safe catalog diagnostics include environment, storefront, app/build, returned/missing IDs, and StoreKit errors without logging JWS, private keys, or account tokens.
- `@capgo/native-purchases` is upgraded within the Capacitor 8-compatible major line.
- Purchase-time `appAccountToken` ownership binding and server verification protections remain unchanged.
- Restore requests only current subscription entitlements to reduce stale historical transactions.
- Apple API health now fails when the configured preferred environment fails authentication instead of hiding a Production failure behind a Sandbox success.

## Automated verification completed

The following must pass before the branch moves to the Mac:

- `npm run test:app-store-review`
- `npm run test:apple-iap`
- `npm run test:apple-iap-crypto`
- `npm run test:ios-settings-nav`
- `npm run test:ios-native-nav`
- `npm run test:ios-nav-insights`
- `npm run test:ios-polish-data-intel`
- `npm run test:capacitor-deep-links`
- `npm run test:plaid-entitlements`
- `npm run test:account-deletion`
- `npm run test:public-support-page`
- targeted ESLint on changed files
- `npx tsc --noEmit`
- `npm run build`
- `git diff --check`

Production dependency audit: zero production vulnerabilities at the time of this release preparation.
## App Store Connect preflight

Before submitting Build 13, verify all of the following in App Store Connect:

- Both subscriptions are in the intended subscription group.
- Pro: `com.buxme.pro.monthly`, display name Buxme Pro, duration 1 Month, US reference price $7.99.
- Pro+: `com.buxme.proplus.monthly`, display name Buxme Pro+, duration 1 Month, US reference price $14.99.
- Pro+ is the higher subscription level than Pro.
- Availability includes the reviewer storefront and all intended sale regions.
- Each subscription has complete localization, review screenshot, and review notes with no missing-metadata status.
- If this is the first auto-renewable subscription/group submission, the app version, subscription group, and both subscriptions are in the same draft submission.
- Paid Apps Agreement is Active and no banking/tax action blocks IAP.
- App Privacy policy URL is `https://buxme.co/privacy`.
- License Agreement remains Apple Standard EULA unless a custom agreement is intentionally configured.
- App Review credentials open a clean Free, non-Founder Buxme account with no active Stripe or Apple entitlement.

Exact App Description line to include:

`Terms of Use (Apple Standard EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`

Reviewer navigation path:

`Sign in → Settings → Plan & billing`
## Physical TestFlight gate

Use a real Apple device after Build 13 is uploaded to TestFlight. Prefer testing both an iPhone and iPad because the rejection was reproduced by App Review on iPad.

Record one continuous, unedited video if practical:

1. Fresh-launch Buxme.
2. Sign into the clean review account.
3. Open Settings → Plan & billing.
4. Show both plan names, StoreKit-localized prices, and `1 month · auto-renewable`.
5. Open Privacy Policy, return to Buxme.
6. Open Terms of Use / Apple Standard EULA, return to Buxme.
7. Tap Pro or Pro+ and show the Apple purchase sheet with the matching localized price.
8. Complete the TestFlight/Sandbox purchase.
9. Return to Buxme and show the active entitlement/current plan.
10. Exercise Restore Purchases if needed and confirm it does not bind a foreign historical entitlement.

Do not claim this gate passed until it is actually completed on the physical device.

## Production Apple API health

The current production Apple server API probe previously authenticated in Sandbox but returned HTTP 401 in Production. That is not the cause of an empty StoreKit product catalog because native product discovery is device-to-Apple StoreKit, and normal clean purchases prefer the signed StoreKit JWS verification path.
Still, Production API authentication should be cleared before submission if possible. Do not rotate or replace the key blindly. Verify the In-App Purchase key status/permissions, Issuer ID, Key ID, app Apple ID, Paid Apps Agreement, and Vercel Production secret values first.

## App Review reply draft

Use only after the App Store Connect and physical-device gates above are complete:

> Hello App Review,
>
> Thank you for the detailed feedback regarding Guidelines 3.1.2(c) and 2.1(b). We addressed both issues in a new build. The subscription screen now clearly displays Buxme Pro and Buxme Pro+, their one-month auto-renewable duration, localized App Store pricing, a functional Privacy Policy link, and a functional Terms of Use link to Apple’s Standard EULA.
>
> We also completed a StoreKit 2 review and hardened product loading for the exact product IDs `com.buxme.pro.monthly` and `com.buxme.proplus.monthly`. The app now retries transient catalog failures, provides a manual retry, retries after connectivity/resume events, preserves partial product responses, and prevents a purchase until the corresponding StoreKit product and localized price are available.
>
> StoreKit diagnostics now capture the app/build, StoreKit environment, storefront, requested/returned product IDs, and safe error details without sensitive transaction data. Existing purchase verification and appAccountToken ownership protections remain in place, and Restore Purchases remains available.
>
> Review path: Sign in → Settings → Plan & billing.
>
> Thank you.

Only add a sentence claiming that the subscription group/products are included in the submission after that has been directly verified in App Store Connect.
