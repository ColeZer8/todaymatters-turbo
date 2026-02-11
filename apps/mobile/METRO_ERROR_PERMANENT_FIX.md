# Metro Bundler "Unable to resolve ../../App" - PERMANENT FIX

## Problem
Metro kept trying to resolve `../../App` from Expo's AppEntry.js even after:
- Deleting App.tsx
- Setting `"main": "expo-router/entry"` in package.json
- Clearing all caches multiple times
- Reinstalling node_modules

The error would temporarily disappear but come back.

## Root Cause
The monorepo root `package.json` had `expo`, `react`, and `react-native` listed as dependencies:

```json
{
  "dependencies": {
    "expo": "~54.0.23",
    "react": "19.1.0",
    "react-native": "0.81.5"
  }
}
```

Due to pnpm's `shamefully-hoist=true` configuration, these packages were being installed at the root `node_modules/`. The root-level `expo/AppEntry.js` was hardcoded to import `../../App`, causing Metro to sometimes resolve the wrong entry point.

## The Permanent Fix

### 1. Remove React Native Dependencies from Root
Removed `expo`, `react`, and `react-native` from `/Users/colezerman/Projects/todaymatters-turbo/package.json`:

```diff
{
  "packageManager": "pnpm@9.0.0",
  "engines": {
    "node": ">=18"
  },
- "version": "1.0.0",
- "dependencies": {
-   "expo": "~54.0.23",
-   "react": "19.1.0",
-   "react-native": "0.81.5"
- }
+ "version": "1.0.0"
}
```

**Why this works:**
- React Native dependencies should ONLY be in workspace packages, not the monorepo root
- Even with `shamefully-hoist=true`, pnpm will still hoist them correctly from workspace packages
- This prevents duplicate/conflicting expo installations at different levels

### 2. Clean Install
```bash
cd /Users/colezerman/Projects/todaymatters-turbo
rm -rf node_modules
pnpm install
```

### 3. Clear Metro Cache (one final time)
```bash
cd apps/mobile
rm -rf .expo
npx expo start --clear
```

## Verification
✅ Metro starts successfully with no "Unable to resolve App" error
✅ Status endpoint responds: `packager-status:running`
✅ Expo Router correctly uses `src/app/` as root directory
✅ No App.tsx file exists or is needed

## Why Previous Fixes Were Temporary
- Just deleting App.tsx and clearing cache worked temporarily
- But pnpm would reinstall packages, and Metro might sometimes resolve the root-level `expo/AppEntry.js`
- The root-level dependencies were the persistent source of the problem

## How to Prevent This in the Future
**Rule:** In pnpm monorepos with React Native:
- ✅ DO declare React Native dependencies in workspace packages (`apps/mobile/package.json`)
- ❌ DON'T declare them in the root `package.json`
- ✅ DO keep `shamefully-hoist=true` in root `.npmrc` (required for React Native)

## Testing
1. Metro is running at `http://localhost:8081`
2. Connect your dev client with QR code or URL: `exp+mobile://expo-development-client/?url=http%3A%2F%2F192.168.1.172%3A8081`
3. Test the Activity Timeline fix!

---

**Status:** ✅ PERMANENTLY FIXED
**Date:** 2026-02-11
**Agent:** todaymatters subagent
