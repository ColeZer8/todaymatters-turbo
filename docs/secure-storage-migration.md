# Secure Storage Migration Guide

## Overview

This document describes the migration process from AsyncStorage to secure storage for JWT tokens.

## Migration Process

### Automatic Migration

The migration happens automatically when the app starts:

1. **Check for existing session** in AsyncStorage
2. **Migrate to secure storage** if session found
3. **Clear old AsyncStorage keys** after successful migration
4. **Use secure storage** for all future operations

### Migration Flow

```
App Start
  ↓
Check AsyncStorage for session
  ↓
Session found?
  ├─ Yes → Migrate to SecureStorage
  │         ↓
  │       Clear AsyncStorage keys
  │         ↓
  │       Use SecureStorage
  └─ No → Use SecureStorage (new sessions)
```

## Implementation Details

### Migration Function

Located in `apps/mobile/src/lib/supabase/migration.ts`:

```typescript
export async function migrateSessionToSecureStorage(): Promise<boolean> {
  // 1. Check AsyncStorage for Supabase session
  // 2. If found, read session data
  // 3. Write to secure storage
  // 4. Clear AsyncStorage keys
  // 5. Return success status
}
```

### Storage Keys Migrated

- `sb-<project-ref>-auth-token` → `today-matters-auth`
- Any other Supabase-related keys → Cleared

### Error Handling

- **Migration fails**: Continue using AsyncStorage (fallback)
- **Partial migration**: Clear AsyncStorage, use secure storage
- **No session**: Skip migration, use secure storage for new sessions

## Testing Migration

### Test: New Installation

1. Fresh install of app
2. Sign in
3. Verify session stored in secure storage
4. Verify no AsyncStorage keys created

### Test: Existing Installation

1. App with existing AsyncStorage session
2. Restart app
3. Verify session migrated to secure storage
4. Verify AsyncStorage keys cleared
5. Verify session persists across restarts

### Test: Migration Failure

1. Simulate secure storage failure
2. Verify fallback to AsyncStorage
3. Verify app continues to work
4. Verify migration retries on next start

## Rollback Plan

If issues occur:

1. **Temporary**: Revert to AsyncStorage by updating `client.ts`
2. **Permanent**: Keep secure storage, fix migration issues
3. **Hybrid**: Use secure storage for new sessions, AsyncStorage for existing

## Monitoring

### Logs to Watch

- `🔐 Migrating session to secure storage...`
- `✅ Session migrated successfully`
- `⚠️ Migration failed, using AsyncStorage fallback`
- `🔐 Secure storage unavailable, using fallback`

### Metrics

- Migration success rate
- Storage operation failures
- Fallback usage frequency

## Troubleshooting

### Issue: Session not persisting

**Symptoms**: User needs to sign in after every app restart

**Solutions**:
1. Check secure storage permissions
2. Verify migration completed successfully
3. Check for storage errors in logs
4. Test secure storage directly

### Issue: Migration fails silently

**Symptoms**: Session exists but not migrated

**Solutions**:
1. Check AsyncStorage keys manually
2. Verify secure storage is available
3. Check error logs
4. Test migration function directly

### Issue: Both storages have sessions

**Symptoms**: Duplicate sessions in AsyncStorage and secure storage

**Solutions**:
1. Clear AsyncStorage keys manually
2. Verify migration clears old keys
3. Check migration error handling

## Future Improvements

1. **Biometric Protection**: Require Face ID/Touch ID for token access
2. **Migration Analytics**: Track migration success rates
3. **Selective Migration**: Only migrate critical tokens
4. **Backup Strategy**: Encrypted backup of tokens (optional)

