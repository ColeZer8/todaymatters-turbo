#!/bin/bash

# Family Controls Configuration Checker
# Verifies that Family Controls is properly configured for EAS builds

set -e

echo "🔍 Family Controls Configuration Check"
echo "======================================"
echo ""

# Check 1: Verify eas.json has ENABLE_FAMILY_CONTROLS
echo "✓ Checking eas.json configuration..."
if grep -q "ENABLE_FAMILY_CONTROLS" eas.json; then
  echo "  ✅ ENABLE_FAMILY_CONTROLS found in eas.json"
else
  echo "  ❌ ENABLE_FAMILY_CONTROLS not found in eas.json"
  exit 1
fi

# Check 2: Verify .env has ENABLE_FAMILY_CONTROLS
echo "✓ Checking .env configuration..."
if [ -f ".env" ] && grep -q "ENABLE_FAMILY_CONTROLS=1" .env; then
  echo "  ✅ ENABLE_FAMILY_CONTROLS=1 found in .env (for local builds)"
else
  echo "  ⚠️  ENABLE_FAMILY_CONTROLS not set in .env (local builds won't have Family Controls)"
fi

# Check 3: Verify plugin exists
echo "✓ Checking plugin configuration..."
if [ -f "plugins/with-ios-insights.js" ]; then
  echo "  ✅ with-ios-insights.js plugin found"
else
  echo "  ❌ with-ios-insights.js plugin not found"
  exit 1
fi

# Check 4: Verify entitlements file
echo "✓ Checking iOS entitlements..."
if [ -f "ios/mobile/mobile.entitlements" ]; then
  if grep -q "com.apple.developer.family-controls" ios/mobile/mobile.entitlements; then
    echo "  ✅ Family Controls entitlements found in mobile.entitlements"
  else
    echo "  ⚠️  Family Controls entitlements not in mobile.entitlements (will be added by plugin)"
  fi
else
  echo "  ⚠️  ios/mobile/mobile.entitlements not found (will be created during build)"
fi

echo ""
echo "======================================"
echo "📋 Next Steps:"
echo ""
echo "1. ✅ DONE: Environment variables configured for EAS builds"
echo ""
echo "2. ⚠️  TODO: Verify Apple Developer Portal capability:"
echo "   → Go to: https://developer.apple.com/account/resources/identifiers/list"
echo "   → Select: com.todaymatters.mobile"
echo "   → Verify: Family Controls (Development) + (Distribution) are enabled"
echo ""
echo "3. ⚠️  TODO: Regenerate provisioning profiles:"
echo "   → Run: eas credentials --platform ios"
echo "   → Remove the provisioning profile for your build profile"
echo "   → Run: eas build --platform ios --profile preview"
echo ""
echo "Full instructions: See FAMILY_CONTROLS_FIX.md"
echo ""
