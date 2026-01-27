# Secure Storage Implementation for JWT Tokens

## Overview

This document describes the implementation of secure storage for JWT tokens and sensitive authentication data using platform-native secure storage mechanisms (iOS Keychain, Android Keystore).

## Security Problem

**Before:** JWT tokens were stored in `AsyncStorage`, which:

- Stores data in plain text
- Accessible to other apps (on rooted/jailbroken devices)
- Included in unencrypted device backups
- Not suitable for production use

**After:** JWT tokens are stored in secure storage:

- Encrypted at rest
- Protected by device passcode/biometrics
- Hardware-backed encryption (on supported Android devices)
- Not accessible to other apps

## Implementation

### Platform-Specific Storage

#### iOS - Keychain Services

- Encrypted at rest
- Protected by device passcode/biometrics
- Not backed up to iCloud (configurable)
- Uses `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` for best balance

#### Android - Keystore

- Hardware-backed encryption (on supported devices)
- Protected by device credentials
- Encrypted SharedPreferences wrapper
- Requires API 23+ (Android 6.0)

### Technology Choice

**Using `expo-secure-store`** (not `react-native-keychain`):

- ✅ Works with Expo managed workflow
- ✅ No native code changes needed
- ✅ Handles iOS Keychain and Android Keystore automatically
- ✅ Simple API compatible with Supabase storage interface

## Architecture

### Storage Adapter

Created `apps/mobile/src/lib/supabase/secure-storage.ts`:

- Wraps `expo-secure-store` with Supabase-compatible interface
- Handles SSR/web fallback (secure storage not available on web)
- Error handling for storage failures
- Migration from AsyncStorage to secure storage

### Storage Keys

| Key                  | Content                | Purpose                  |
| -------------------- | ---------------------- | ------------------------ |
| `today-matters-auth` | Supabase session JSON  | Auth session with tokens |
| `tm-refresh-token`   | Refresh token (backup) | Manual refresh if needed |

### Session Data Structure

```typescript
interface StoredSession {
  access_token: string; // JWT access token (expires in 1 hour)
  refresh_token: string; // Used to get new access token
  expires_at: number; // Unix timestamp
  expires_in: number; // Seconds until expiry
  token_type: "bearer";
  user: {
    id: string; // UUID
    email: string;
    app_metadata: {
      provider: string;
      providers: string[];
    };
    user_metadata: {
      full_name?: string;
      avatar_url?: string;
    };
    created_at: string;
  };
}
```

## Migration Strategy

### Automatic Migration

When app starts:

1. Check if session exists in AsyncStorage
2. If found, migrate to secure storage
3. Clear old AsyncStorage keys
4. Use secure storage going forward

### Backward Compatibility

- Falls back to AsyncStorage if secure storage unavailable
- Handles SSR/web environments gracefully
- No breaking changes to existing code

## Usage

The secure storage is transparent to the rest of the app:

```typescript
// Supabase client automatically uses secure storage
import { supabase } from "@/lib/supabase";

// All auth operations use secure storage automatically
await supabase.auth.signInWithPassword({ email, password });
await supabase.auth.getSession();
await supabase.auth.signOut();
```

## Error Handling

### Storage Failures

- Network errors: Logged but don't crash app
- Permission errors: Fall back to AsyncStorage (development)
- Platform errors: Gracefully handled with fallback

### Migration Errors

- If migration fails, continue using AsyncStorage
- Log error for debugging
- Retry migration on next app start

## Testing

### Test Secure Storage

```typescript
import { SecureStorage } from "@/lib/supabase/secure-storage";

// Test basic operations
await SecureStorage.setItem("test-key", "test-value");
const value = await SecureStorage.getItem("test-key");
console.assert(value === "test-value", "Storage test failed");
await SecureStorage.removeItem("test-key");
const deleted = await SecureStorage.getItem("test-key");
console.assert(deleted === null, "Delete test failed");
```

### Test Migration

1. Sign in with old AsyncStorage
2. Restart app
3. Verify session migrated to secure storage
4. Verify old AsyncStorage keys cleared
5. Verify session persists across restarts

### Test Platform Support

- **iOS**: Verify Keychain storage works
- **Android**: Verify Keystore storage works
- **Web**: Verify fallback to no-op storage
- **SSR**: Verify no-op storage doesn't crash

## Security Considerations

### Keychain Accessibility (iOS)

Uses `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`:

- ✅ Best balance of security and usability
- ✅ Prevents access from backups on other devices
- ✅ Available after first unlock (no need to unlock for each access)

### EncryptedSharedPreferences (Android)

- ✅ Requires API 23+ (Android 6.0)
- ✅ Falls back to standard encryption on older devices
- ✅ Hardware-backed on supported devices

### Biometric Protection (Future)

Can optionally require Face ID/Touch ID/Fingerprint:

- Add `requireAuthentication` option
- Use `expo-local-authentication` for biometric checks
- Adds extra security for sensitive operations

## Files Modified

- `apps/mobile/package.json` - Added `expo-secure-store` dependency
- `apps/mobile/src/lib/supabase/secure-storage.ts` - New secure storage adapter
- `apps/mobile/src/lib/supabase/client.ts` - Updated to use secure storage
- `apps/mobile/src/lib/supabase/migration.ts` - New migration utility

## Related Documentation

- [expo-secure-store Documentation](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [iOS Keychain Services](https://developer.apple.com/documentation/security/keychain_services)
- [Android Keystore](https://developer.android.com/training/articles/keystore)
- [Supabase Auth Storage](https://supabase.com/docs/reference/javascript/auth-helpers/types#storage)
