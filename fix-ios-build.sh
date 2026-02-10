#!/bin/bash
# Fix iOS Build Issues on New Mac
# Run this to reset iOS build environment

set -e

echo "🔧 Fixing iOS Build Environment..."
echo ""

# 1. Kill all simulator processes
echo "1️⃣  Killing stuck simulator processes..."
killall -9 "Simulator" 2>/dev/null || true
killall -9 "simctl" 2>/dev/null || true
pkill -9 -f CoreSimulator 2>/dev/null || true
pkill -9 -f com.apple.CoreSimulator 2>/dev/null || true
sleep 2

# 2. Reset CoreSimulator service
echo "2️⃣  Resetting CoreSimulator service..."
launchctl remove com.apple.CoreSimulator.CoreSimulatorService 2>/dev/null || true
sleep 1

# 3. Clean Xcode derived data
echo "3️⃣  Cleaning Xcode derived data..."
rm -rf ~/Library/Developer/Xcode/DerivedData/*
rm -rf ~/Library/Caches/com.apple.dt.Xcode

# 4. Clean iOS build artifacts
echo "4️⃣  Cleaning iOS build folder..."
cd "$(dirname "$0")/apps/mobile"
rm -rf ios/build
rm -rf ios/Pods
rm -rf ios/.xcode.env.local

# 5. Clean watchman
echo "5️⃣  Cleaning watchman..."
watchman watch-del-all 2>/dev/null || true

# 6. Clean Metro cache
echo "6️⃣  Cleaning Metro bundler cache..."
rm -rf node_modules/.cache
rm -rf $TMPDIR/metro-* $TMPDIR/react-* $TMPDIR/haste-* 2>/dev/null || true

# 7. Reinstall pods
echo "7️⃣  Reinstalling CocoaPods..."
cd ios
pod deintegrate 2>/dev/null || true
pod install --repo-update

echo ""
echo "✅ iOS environment reset complete!"
echo ""
echo "Next steps:"
echo "  1. Close Xcode completely"
echo "  2. Disconnect/reconnect your iPhone"
echo "  3. Trust this Mac on your iPhone (Settings → General → Device Management)"
echo "  4. Run: pnpm --filter mobile ios"
echo ""
