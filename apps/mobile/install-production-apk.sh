#!/bin/bash
# Script to wait for EAS build completion, download APK, and install on device

set -e

BUILD_ID="303f2571-4666-4835-a730-1437cb9e911f"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APK_PATH="$SCRIPT_DIR/production-build.apk"

echo "🔨 Monitoring build: $BUILD_ID"
echo "📱 Checking for connected Android device..."

# Check for physical device (not emulator)
PHYSICAL_DEVICE=$(adb devices -l | grep -v "emulator" | grep "device" | head -1 | awk '{print $1}')

if [ -z "$PHYSICAL_DEVICE" ]; then
  echo "⚠️  No physical Android device detected via adb"
  echo "   Make sure your device is:"
  echo "   1. Connected via USB"
  echo "   2. USB debugging enabled"
  echo "   3. Authorized (check device for popup)"
  echo ""
  echo "   Or install manually after download:"
  echo "   1. Download APK from EAS dashboard"
  echo "   2. Transfer to device"
  echo "   3. Enable 'Install unknown apps' in Settings"
  echo "   4. Tap APK to install"
  exit 1
fi

echo "✅ Found device: $PHYSICAL_DEVICE"
echo ""
echo "⏳ Waiting for build to complete..."

# Poll for build completion
while true; do
  STATUS=$(npx eas-cli@latest build:list --platform android --limit 1 --json 2>/dev/null | jq -r '.[0].status // "unknown"')
  
  if [ "$STATUS" = "finished" ]; then
    echo "✅ Build completed!"
    break
  elif [ "$STATUS" = "errored" ] || [ "$STATUS" = "canceled" ]; then
    echo "❌ Build failed with status: $STATUS"
    echo "   Check logs: https://expo.dev/accounts/colezer8/projects/mobile/builds/$BUILD_ID"
    exit 1
  fi
  
  echo "   Status: $STATUS (checking again in 30s...)"
  sleep 30
done

echo ""
echo "📥 Downloading APK..."

# Get download URL and download
DOWNLOAD_URL=$(npx eas-cli@latest build:list --platform android --limit 1 --json 2>/dev/null | jq -r '.[0].artifacts.buildUrl // empty')

if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" = "null" ]; then
  echo "❌ Could not get download URL"
  echo "   Please download manually from: https://expo.dev/accounts/colezer8/projects/mobile/builds/$BUILD_ID"
  exit 1
fi

echo "   Downloading from: $DOWNLOAD_URL"
curl -L -o "$APK_PATH" "$DOWNLOAD_URL"

if [ ! -f "$APK_PATH" ]; then
  echo "❌ Download failed"
  exit 1
fi

echo "✅ Downloaded to: $APK_PATH"
echo ""
echo "📲 Installing on device: $PHYSICAL_DEVICE..."

# Install via adb
adb install -r "$APK_PATH"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Successfully installed production build!"
  echo "   APK saved at: $APK_PATH"
  echo ""
  echo "🚀 You can now open the app on your device"
else
  echo ""
  echo "❌ Installation failed"
  echo "   Try installing manually:"
  echo "   1. Transfer $APK_PATH to your device"
  echo "   2. Enable 'Install unknown apps' in Settings"
  echo "   3. Tap the APK file to install"
fi
