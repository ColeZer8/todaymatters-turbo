# iOS Local Build Troubleshooting

## New Mac Setup Checklist

Before running `expo run:ios`, verify these on a fresh Mac:

### 1. Xcode and Command Line Tools

```bash
# Xcode installed?
xcode-select -p
# Should output: /Applications/Xcode.app/Contents/Developer

# Xcode version (must be recent)
xcodebuild -version

# ACCEPT XCODE LICENSE (often required on new Macs — can cause hangs if not done)
sudo xcodebuild -license accept
```

### 2. CocoaPods

```bash
# CocoaPods installed?
pod --version

# If not: brew install cocoapods
```

### 3. iOS dependencies (Pods)

```bash
cd apps/mobile/ios
pod install
cd ../..
```

### 4. Device detection

```bash
# List connected devices (iPhone must be connected, unlocked, trusted)
xcrun xctrace list devices
# Or: xcrun simctl list devices
```

### 5. Quick sanity check

```bash
# Can Xcode build the project at all?
cd apps/mobile/ios
xcodebuild -workspace mobile.xcworkspace -scheme mobile -destination 'generic/platform=iOS' -configuration Debug build
```

If step 5 fails, fix Xcode/code signing first. If it succeeds, the issue is likely with the Expo CLI flow.

### 6. **simctl hang (common on new Macs / Xcode 16+)**

`xcrun simctl list` can hang for minutes on fresh installs. Expo may call it even when targeting a physical device.

**Workaround:** Open the **Simulator app** once (Spotlight → "Simulator" or `open -a Simulator`), then close it. That often "warms up" CoreSimulator so subsequent commands don't hang.

```bash
open -a Simulator
# Wait for it to load, then quit (Cmd+Q). Then try:
pnpm --filter mobile ios
```

---

## "expo run:ios" hangs after "Skipping dev server"

### Causes & fixes

**1. Wrong project (root vs mobile)**

This repo has two iOS projects:
- `ios/` (root) — legacy `todaymattersturbo`, bundle ID `com.colezer8.todaymattersturbo`
- `apps/mobile/ios/` — main app `mobile`, bundle ID `com.todaymatters.mobile`

Always run the mobile app:

```bash
pnpm --filter mobile ios
# or from repo root:
pnpm ios
```

Both now delegate to the mobile app. Do not run `expo run:ios` from the repo root.

**2. Device selection prompt**

If the process stops after "Skipping dev server," it may be waiting for device selection. The `ios` script uses `--device` to target a connected iPhone.

- Connect your iPhone via USB
- Unlock the device and trust the computer if prompted
- Run: `pnpm --filter mobile ios`

**3. If it still hangs**

- Run from `apps/mobile` explicitly:
  ```bash
  cd apps/mobile
  pnpm ios
  ```
- For simulator instead of device:
  ```bash
  cd apps/mobile
  npx expo run:ios
  ```
  (omit `--device` to use simulator)

**4. Build from Xcode directly**

To isolate Expo vs Xcode:

1. Open `apps/mobile/ios/mobile.xcworkspace` in Xcode
2. Select your scheme (`mobile`) and device
3. Product → Run (⌘R)

If this works, the issue is likely with the Expo CLI flow.
