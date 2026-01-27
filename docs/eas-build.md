# EAS Build Configuration

This document covers EAS (Expo Application Services) Build setup and usage for dev builds.

## Resources

- [EAS CLI Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Build Configuration (eas.json)](https://docs.expo.dev/eas/json/)
- [Development Builds](https://docs.expo.dev/development/introduction/)

## Setup

The project is configured with `eas.json` in `apps/mobile/` with the following build profiles:

- **development-simulator**: For iOS simulator and Android emulator builds
- **development-device**: For physical device builds
- **preview**: For internal distribution preview builds
- **production**: For production app store builds

## Building Dev Builds

### For iOS Simulator

```bash
cd apps/mobile
npx eas-cli@latest build:dev --platform ios --profile development-simulator
```

### For Android Emulator

```bash
cd apps/mobile
npx eas-cli@latest build:dev --platform android --profile development-simulator
```

### For Physical Devices

```bash
# iOS
npx eas-cli@latest build:dev --platform ios --profile development-device

# Android
npx eas-cli@latest build:dev --platform android --profile development-device
```

## Installing on Physical Devices

### iOS (iPhone/iPad)

#### Step 1: Register Your Device (First Time Only)

Before building for a physical iOS device, you need to register your device's UDID:

```bash
cd apps/mobile
npx eas-cli@latest device:create
```

This will prompt you to:

- Connect your iPhone via USB or provide the UDID manually
- If connected via USB, it will detect your device automatically
- Give your device a name (e.g., "My iPhone")

**To find your UDID manually:**

- On Mac: Connect device, open Finder → Select device → See UDID
- Or: Settings → General → About → Copy the Identifier (UDID)

#### Step 2: Build for Physical Device

You have two options:

**Option A: Local Build (Recommended - No Paid Account Needed)**

Build locally on your Mac using Xcode (works with free Apple Developer account):

```bash
cd apps/mobile
npx eas-cli@latest build:dev --platform ios --profile development-device --local
```

This builds on your Mac using your local Xcode installation, just like you did before. The `withoutCredentials: true` setting in `eas.json` allows this to work without a paid Apple Developer account.

**Option B: Cloud Build (Requires Paid Apple Developer Account)**

Build in the cloud via EAS:

```bash
cd apps/mobile
npx eas-cli@latest build:dev --platform ios --profile development-device
```

**Note:** Cloud builds require a paid Apple Developer account ($99/year). For local builds, you can use a free Apple Developer account.

#### Step 3: Install on Your iPhone

After the build completes, you have several options:

**Option A: Direct Download & Install**

1. The build command will provide a download URL
2. Open the URL on your iPhone's Safari browser
3. Download the `.ipa` file
4. Install via Settings → General → VPN & Device Management → Trust the developer

**Option B: Via EAS Dashboard**

1. Visit [expo.dev](https://expo.dev) → Your Project → Builds
2. Click on the completed build
3. Click "Download" to get the `.ipa` file
4. Transfer to your iPhone and install

**Option C: Via TestFlight (Recommended for easier updates)**

1. Submit the build to TestFlight (requires App Store Connect setup)
2. Install TestFlight app on your iPhone
3. Accept the invitation and install the app

### Android

#### Step 1: Build for Physical Device

```bash
cd apps/mobile
npx eas-cli@latest build:dev --platform android --profile development-device
```

#### Step 2: Install on Your Android Phone

After the build completes:

**Option A: Direct Download**

1. The build command will provide a download URL
2. Open the URL on your Android phone's browser
3. Download the `.apk` file
4. Enable "Install from Unknown Sources" in Settings if prompted
5. Tap the downloaded APK to install

**Option B: Via ADB (Android Debug Bridge)**

1. Download the `.apk` file to your computer
2. Connect your Android phone via USB with USB debugging enabled
3. Run: `adb install path/to/your-app.apk`

**Option C: Via EAS Dashboard**

1. Visit [expo.dev](https://expo.dev) → Your Project → Builds
2. Click on the completed build
3. Click "Download" to get the `.apk` file
4. Transfer to your phone and install

## Authentication

Make sure you're logged into EAS:

```bash
npx eas-cli@latest login
```

## Credentials

For development builds:

- **iOS Simulator**: No credentials needed
- **iOS Device**: Requires Apple Developer account credentials (configured via `eas credentials:configure-build`)
- **Android**: No credentials needed for APK builds

## Configuration Reference

The `eas.json` file supports:

- `developmentClient: true` - Enables Expo Dev Client
- `distribution: "internal"` - For internal testing
- `ios.simulator: true` - Builds for iOS simulator
- `android.buildType: "apk"` - Builds APK for Android
