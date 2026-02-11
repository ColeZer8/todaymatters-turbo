# Family Controls Provisioning Profile Fix

**Date:** February 10, 2026
**Issue:** iOS builds failing with Family Controls provisioning profile errors

## Root Cause

The app's Swift code actively uses Family Controls APIs (FamilyControls, DeviceActivity, ManagedSettings) for Screen Time functionality, but:

1. The `with-ios-insights.js` plugin conditionally enables Family Controls entitlements based on `ENABLE_FAMILY_CONTROLS` environment variable
2. The `.env` file had `ENABLE_FAMILY_CONTROLS=1` (works for local builds)
3. **EAS cloud builds don't read `.env` files** - the env var wasn't set for EAS builds
4. Result: Provisioning profiles were generated WITHOUT Family Controls capability

## What I Fixed

### 1. Added `ENABLE_FAMILY_CONTROLS=1` to all EAS build profiles

Updated `apps/mobile/eas.json` to include:

```json
"env": {
  "ENABLE_FAMILY_CONTROLS": "1"
}
```

This ensures the `with-ios-insights.js` plugin will include Family Controls entitlements during EAS builds.

## What Still Needs to Be Done

### Step 1: Check Apple Developer Portal

**Action Required:** Verify that Family Controls capability is enabled for the App ID.

1. Go to [Apple Developer Portal → Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list)
2. Select App ID: **com.todaymatters.mobile**
3. Click **Edit**
4. Under **Capabilities**, check if these are enabled:
   - ✅ **Family Controls (Development)** - for Ad Hoc / internal / preview builds
   - ✅ **Family Controls (Distribution)** - for TestFlight and App Store

**If NOT enabled:**
   - If you have Apple approval: Enable both capabilities and Save
   - If you DON'T have Apple approval yet: You need to request it (Account Holder only can submit)
     - See `docs/ios-family-controls-setup.md` for the full request process
     - Typical approval time: 3-4 weeks

### Step 2: Regenerate Provisioning Profiles

After confirming the capability is enabled in Apple Developer Portal:

```bash
cd apps/mobile

# Clear existing provisioning profiles
eas credentials --platform ios

# In the interactive menu:
# 1. Select the build profile you're using (e.g., "preview")
# 2. Choose "Provisioning Profile"
# 3. Select "Remove" or "Clear"
# 4. Exit

# Rebuild - this will create fresh provisioning profiles with Family Controls
eas build --platform ios --profile preview
```

EAS will automatically sync the capabilities from Apple Developer Portal and generate new provisioning profiles that include Family Controls.

## Build Profile Reference

| Build Profile | Distribution | Entitlement Needed |
|---------------|---------------|--------------------|
| `preview` | internal (Ad Hoc) | Family Controls (Development) |
| `development-device` | internal | Family Controls (Development) |
| `testflight` | internal (TestFlight) | Family Controls (Distribution) |
| `production` | App Store | Family Controls (Distribution) |

## Testing the Fix

After regenerating provisioning profiles:

```bash
cd apps/mobile
eas build --platform ios --profile preview
```

The build should succeed without Family Controls provisioning errors.

## Why This Happened

Timeline:
- **Dec 27, 2025**: Family Controls initially added, always enabled
- **Later**: Changed to conditional logic to allow builds while waiting for Apple approval
- **Feb 10, 2026**: Error discovered - EAS builds didn't have the env var set

The conditional logic was designed to let builds succeed without Apple approval, but the Swift code wasn't made conditional - it still imports and uses Family Controls APIs. This created a mismatch where:
- Local builds: `.env` file → entitlements included → works
- EAS builds: No env var → entitlements removed → Swift code still uses APIs → build fails

## References

- Full setup guide: `docs/ios-family-controls-setup.md`
- Apple Family Controls docs: https://developer.apple.com/documentation/familycontrols
- EAS Build environment variables: https://docs.expo.dev/build-reference/variables/
