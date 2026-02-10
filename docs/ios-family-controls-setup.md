# Family Controls (Screen Time) — Setup Guide for iOS Builds

This guide explains how to enable Family Controls so TodayMatters can pull Screen Time data on iOS. The build failure you're seeing occurs because the provisioning profile doesn't include the Family Controls entitlement.

## The Error

```
Provisioning profile "*[expo] com.todaymatters.mobile AdHoc ..." doesn't support the Family Controls (Development) capability.
Provisioning profile "*[expo] com.todaymatters.mobile AdHoc ..." doesn't include the com.apple.developer.family-controls entitlement.
```

## Overview

Family Controls is a **restricted capability**. Apple requires:

1. **Request approval** from Apple (only the **Account Holder** can submit; Admin is insufficient)
2. **Enable the capability** in the Apple Developer Portal for your App ID
3. **Include both entitlements** in your app: distribution (for TestFlight/App Store) and development (for Ad Hoc/internal builds)

---

## Step 1: Request Family Controls Entitlement from Apple

**Who:** Only the **Account Holder** of your Apple Developer Program can submit the request.

**Process:**

1. Go to [developer.apple.com](https://developer.apple.com) and sign in
2. Navigate to **Contact** → **Request Capability** (or similar; the exact path varies)
   - Alternative: [developer.apple.com/contact](https://developer.apple.com/contact) and look for "Request additional capabilities" or "Request entitlement"
3. Request the **Family Controls** entitlement for `com.todaymatters.mobile`
4. Provide a clear explanation of why TodayMatters needs it, e.g.:
   > "TodayMatters is a wellbeing app that helps users understand and improve their digital habits. We use the Family Controls / Screen Time APIs to provide personalized insights and recommendations. Data stays on-device and is never shared externally."

**Timeline:** Approval typically takes **3–4 weeks** (sometimes longer). Apply early.

**Important:** If you have a Device Activity Report extension (e.g. `IosInsightsReport`), you must request the entitlement for **each bundle ID** that needs it:
- `com.todaymatters.mobile` (main app)
- `com.todaymatters.mobile.IosInsightsReport` (if that extension exists)

---

## Step 2: Enable Capabilities in Apple Developer Portal

After Apple approves:

1. Go to [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list)
2. Select your App ID: **com.todaymatters.mobile**
3. Click **Edit**
4. Under **Additional Capabilities** (or **Capabilities**), enable:
   - **Family Controls (Development)** — required for Ad Hoc / internal / preview builds
   - **Family Controls (Distribution)** — required for TestFlight and App Store
5. Save

Repeat for any extension App IDs (e.g. Device Activity Report extension).

---

## Step 3: Configure Entitlements in the App

This project uses the `with-ios-insights` plugin to add entitlements. The plugin now includes:

- `com.apple.developer.family-controls` — for distribution (TestFlight, App Store)
- `com.apple.developer.family-controls.development` — for Ad Hoc / internal builds

These are set in `apps/mobile/plugins/with-ios-insights.js`. No extra config needed if the plugin is used.

---

## Step 4: Regenerate Provisioning Profiles (EAS)

After enabling capabilities in the Developer Portal:

1. **Invalidate existing credentials** so EAS creates fresh profiles:

   ```bash
   cd apps/mobile
   eas credentials --platform ios
   ```

   Choose **Remove** or **Clear** for the provisioning profile associated with your build profile (e.g. preview).

2. **Rebuild**:

   ```bash
   eas build --platform ios --profile preview
   ```

EAS will sync capabilities from the Developer Portal and generate new provisioning profiles that include Family Controls.

---

## Build Profiles and Entitlements

| Build Profile | Distribution | Entitlement Needed |
|---------------|---------------|--------------------|
| `preview` | internal (Ad Hoc) | Family Controls (Development) |
| `development-device` | internal | Family Controls (Development) |
| `testflight` | internal (TestFlight) | Family Controls (Distribution) |
| `production` | App Store | Family Controls (Distribution) |

---

## Testing Locally (Without Approval)

Family Controls is **available during development** for local Xcode builds — no approval needed.

**To test Location + Health + Screen Time on your phone:**

1. Add to `apps/mobile/.env`:
   ```
   ENABLE_FAMILY_CONTROLS=1
   ```
   (Keeps Family Controls in the build when prebuild runs.)

2. Connect your iPhone via USB, then:
   ```bash
   cd apps/mobile
   pnpm --filter mobile ios
   # or: npx expo run:ios
   ```

This builds with your development provisioning profile and runs on your device. Screen Time should work locally. (.env is gitignored, so this won't affect EAS cloud builds.)

**For EAS cloud builds** (preview, production), Family Controls is omitted until you have approval. So:

- **Local build** → Full testing (Location, Health, Screen Time)
- **EAS cloud build** → Location + Health only (until approved)

## When You Get Approval

1. Enable the capability in the Developer Portal (Step 2 above)
2. Add `ENABLE_FAMILY_CONTROLS=1` as an EAS secret (or in your build env)
3. Rebuild with EAS

---

## References

- [Apple Family Controls docs](https://developer.apple.com/documentation/familycontrols)
- [Device Activity framework](https://developer.apple.com/documentation/deviceactivity)
- [EAS iOS capabilities](https://docs.expo.dev/build-reference/ios-capabilities/)
- [Expo GitHub issue #2715](https://github.com/expo/eas-cli/issues/2715) — Family Controls + EAS Build
