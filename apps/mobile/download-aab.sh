#!/bin/bash
# Script to download the AAB file once the build completes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AAB_PATH="$SCRIPT_DIR/production-build.aab"

echo "🔍 Checking latest Android production build..."

# Get the latest build
BUILD_INFO=$(npx eas-cli@latest build:list --platform android --limit 1 --json 2>/dev/null)
BUILD_ID=$(echo "$BUILD_INFO" | jq -r '.[0].id // empty')
STATUS=$(echo "$BUILD_INFO" | jq -r '.[0].status // "unknown"')
DOWNLOAD_URL=$(echo "$BUILD_INFO" | jq -r '.[0].artifacts.buildUrl // empty')

if [ -z "$BUILD_ID" ] || [ "$BUILD_ID" = "null" ]; then
  echo "❌ Could not find build"
  exit 1
fi

echo "Build ID: $BUILD_ID"
echo "Status: $STATUS"
echo ""

if [ "$STATUS" != "finished" ]; then
  echo "⏳ Build is still $STATUS"
  echo "   Check status: npx eas-cli@latest build:list --platform android --limit 1"
  echo "   View logs: https://expo.dev/accounts/colezer8/projects/mobile/builds/$BUILD_ID"
  exit 1
fi

if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" = "null" ]; then
  echo "❌ Could not get download URL"
  echo "   Please download manually from: https://expo.dev/accounts/colezer8/projects/mobile/builds/$BUILD_ID"
  exit 1
fi

echo "📥 Downloading AAB file..."
echo "   URL: $DOWNLOAD_URL"
echo "   Saving to: $AAB_PATH"
echo ""

curl -L -o "$AAB_PATH" "$DOWNLOAD_URL"

if [ ! -f "$AAB_PATH" ]; then
  echo "❌ Download failed"
  exit 1
fi

FILE_SIZE=$(du -h "$AAB_PATH" | cut -f1)
echo "✅ Successfully downloaded AAB file!"
echo "   Location: $AAB_PATH"
echo "   Size: $FILE_SIZE"
echo ""
echo "📦 This AAB file is ready for Google Play Console upload"
echo "   Upload it at: https://play.google.com/console"
