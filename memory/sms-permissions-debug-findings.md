# SMS Permissions Debug Findings

**Date:** 2026-02-13  
**Status:** ✅ ROOT CAUSE FOUND AND FIXED

---

## 🐛 THE BUG

### Root Cause
The `@maniac-tech/react-native-expo-read-sms` library (version 9.0.2-alpha) has a **critical bug** in the `requestReadSMSPermission()` function.

### Technical Details

**Location:** `node_modules/@maniac-tech/react-native-expo-read-sms/index.js` lines 107-110

**Buggy Code:**
```javascript
const status = await PermissionsAndroid.requestMultiple([
  PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
  PermissionsAndroid.PERMISSIONS.READ_SMS,
]);

if (status === PermissionsAndroid.RESULTS.GRANTED) return true; // ❌ BUG HERE
```

**The Problem:**
- `PermissionsAndroid.requestMultiple()` returns an **object** like:
  ```javascript
  {
    'android.permission.READ_SMS': 'granted',
    'android.permission.RECEIVE_SMS': 'granted'
  }
  ```
- The code compares this **object** to the string `'granted'`
- This comparison **always fails**, so the function **always returns false**

**Correct Implementation:**
```javascript
const status = await PermissionsAndroid.requestMultiple([...]);

// Check BOTH permissions individually
if (
  status['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED &&
  status['android.permission.RECEIVE_SMS'] === PermissionsAndroid.RESULTS.GRANTED
) {
  return true;
}
```

---

## 📋 INVESTIGATION RESULTS

### ✅ AndroidManifest.xml
**Status:** CORRECT

Permissions are properly declared:
```xml
<uses-permission android:name="android.permission.READ_SMS"/>
<uses-permission android:name="android.permission.RECEIVE_SMS"/>
```

### ✅ Library Installation
**Status:** INSTALLED (but buggy version)

- Package: `@maniac-tech/react-native-expo-read-sms`
- Version: `9.0.2-alpha` ⚠️ (alpha = unstable)
- Installation: Present in `node_modules`

### ❌ Library Function
**Status:** BROKEN

The library's `requestReadSMSPermission()` function has the bug described above.

### ✅ UI Code
**Status:** CORRECT (but blocked by library bug)

The permissions screen code in `src/app/permissions.tsx`:
- Correctly calls `requestSMSPermissions()`
- Only toggles the switch if permissions are granted
- Has proper error handling

**Why the toggle doesn't flip:**
1. User taps SMS toggle
2. Code calls `ensureAndroidSMSPermissionIfNeeded()`
3. That calls our `requestSMSPermissions()` wrapper
4. That calls the buggy library function `requestReadSMSPermission()`
5. Library function **always returns false** (due to bug)
6. Our code does `if (!ok) return;` and exits early
7. `togglePermission('sms')` is **never called**
8. Toggle doesn't flip

---

## 🛠️ THE FIX

### What We Changed

**File:** `src/lib/android/sms-service.ts`

**Before:**
```typescript
export async function requestSMSPermissions(): Promise<boolean> {
  const granted = await requestReadSMSPermission(); // Uses buggy library function
  return granted;
}
```

**After:**
```typescript
export async function requestSMSPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    // Check if already granted
    const hasPermission = await checkIfHasSMSPermission();
    if (hasPermission.hasReadSmsPermission && hasPermission.hasReceiveSmsPermission) {
      return true;
    }

    // Request permissions using React Native API directly
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      PermissionsAndroid.PERMISSIONS.READ_SMS,
    ]);

    // Check BOTH permissions correctly
    return (
      granted['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED &&
      granted['android.permission.RECEIVE_SMS'] === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return false;
  }
}
```

**Key Changes:**
1. ✅ Bypass the buggy library function
2. ✅ Use React Native's `PermissionsAndroid` API directly
3. ✅ Correctly check the object returned by `requestMultiple()`
4. ✅ Add extensive debug logging

### Additional Changes

**File:** `src/app/permissions.tsx`

Added comprehensive debug logging:
- 🔵 When toggle is tapped
- 🔵 When permission request is called
- 🔵 Permission request results
- ✅ When permission is granted
- 🔴 When permission is denied
- 🔴 When errors occur

This helps track the entire flow in the console.

---

## 🧪 TESTING INSTRUCTIONS

### Test Environment
- Device: Android physical device or emulator
- App: TodayMatters mobile app
- Build: Development build with latest changes

### Test Steps

#### 1. Fresh Install Test
```bash
# Rebuild the app with the fix
cd /Users/colezerman/Projects/todaymatters-turbo/apps/mobile
pnpm run android:dev

# Or if already built, just restart Metro
pnpm run dev
```

#### 2. Test the SMS Toggle

1. **Open the app** and navigate to the Permissions screen
2. **Open Android Logcat** to watch console logs:
   ```bash
   adb logcat | grep -E "Permissions|SMS Service"
   ```
3. **Tap the SMS toggle**
4. **Watch for:**
   - Permission dialog should appear
   - Console logs starting with 🔵, 🟢, ✅, or 🔴
5. **Grant the permission** in the dialog
6. **Verify:**
   - Toggle flips to ON ✅
   - Console shows: `✅ [Permissions] SMS permissions granted!`

#### 3. Verify System Settings

1. Open **Android Settings**
2. Go to **Apps** → **TodayMatters** → **Permissions**
3. **Verify:** You should see **SMS** permission listed
4. **Verify:** It should show as "Allowed"

#### 4. Test Permission Persistence

1. Close and reopen the app
2. Go to Permissions screen
3. **Verify:** SMS toggle is still ON
4. Console should show: `🟢 [SMS Service] Permissions already granted`

#### 5. Test Denial Flow

1. Deny SMS permission (in Settings or during request)
2. Tap the toggle again
3. **Verify:**
   - Alert appears: "SMS permission needed"
   - "Open Settings" button works
   - Toggle stays OFF

---

## 🎯 SUCCESS CRITERIA

### ✅ Must Pass
- [ ] SMS toggle flips when tapped and permission granted
- [ ] Permission dialog actually appears
- [ ] Android Settings shows SMS permission for TodayMatters
- [ ] Console logs show the permission flow
- [ ] Toggle stays ON after app restart (if permission granted)

### ✅ Edge Cases
- [ ] Toggle stays OFF when permission denied
- [ ] Alert appears when permission denied
- [ ] "Open Settings" button works
- [ ] No crashes or errors

---

## 📊 CONSOLE LOG EXAMPLES

### Successful Permission Grant
```
🔵 [Permissions] SMS toggle tapped, requesting permission...
🔵 [Permissions] ensureAndroidSMSPermissionIfNeeded called
🔵 [Permissions] Calling requestSMSPermissions()...
🟢 [SMS Service] requestSMSPermissions called
🟢 [SMS Service] Current permission status: { hasReadSmsPermission: false, hasReceiveSmsPermission: false }
🟢 [SMS Service] Requesting permissions...
🟢 [SMS Service] Permission results: { 'android.permission.READ_SMS': 'granted', 'android.permission.RECEIVE_SMS': 'granted' }
🟢 [SMS Service] Final result: { readSmsGranted: true, receiveSmsGranted: true, bothGranted: true }
🔵 [Permissions] requestSMSPermissions() returned: true
✅ [Permissions] SMS permissions granted!
✅ [Permissions] Permission granted, will toggle
🔵 [Permissions] Calling togglePermission for key: sms
```

### Permission Already Granted
```
🟢 [SMS Service] requestSMSPermissions called
🟢 [SMS Service] Current permission status: { hasReadSmsPermission: true, hasReceiveSmsPermission: true }
✅ [SMS Service] Permissions already granted
✅ [Permissions] SMS permissions granted!
```

### Permission Denied
```
🟢 [SMS Service] Requesting permissions...
🟢 [SMS Service] Permission results: { 'android.permission.READ_SMS': 'denied', ... }
🟢 [SMS Service] Final result: { readSmsGranted: false, receiveSmsGranted: false, bothGranted: false }
🔵 [Permissions] requestSMSPermissions() returned: false
🔵 [Permissions] Permissions not granted, showing alert
🔴 [Permissions] Permission denied, not toggling
```

---

## 🚀 NEXT STEPS

1. **Cole to test** following the testing instructions above
2. **Verify** all success criteria pass
3. **Check** console logs match expected output
4. **Report back** any issues or unexpected behavior

---

## 📝 NOTES

### Why Not Fix the Library?
- It's an alpha version (9.0.2-alpha) - unstable by nature
- We don't control the package
- Easier to work around than wait for upstream fix
- Our implementation is simpler and more reliable

### Should We Remove the Library?
**Not yet.** We still use:
- `checkIfHasSMSPermission()` - works correctly
- `startReadSMS()` - for actually reading SMS messages

Only `requestReadSMSPermission()` is broken, which we've now bypassed.

### Future Consideration
If more bugs appear, consider:
1. Finding a different SMS library
2. Using React Native's PermissionsAndroid directly for everything
3. Building our own native module

---

**Status:** Ready for testing! 🚀
