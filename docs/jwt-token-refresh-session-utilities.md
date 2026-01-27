# JWT Token Refresh - Session Utilities

## Overview

This document describes the session utility functions added to support manual token refresh and pre-emptive session validation.

## New File: `apps/mobile/src/lib/supabase/session.ts`

### Purpose

Provides utility functions for:

1. Manual token refresh with error handling
2. Pre-emptive session validation before API calls
3. Token expiry checking

## Functions

### `refreshSession()`

Manually refreshes the current session.

**Returns:** `Promise<Session | null>`

**Behavior:**

- Attempts to refresh the current session
- Handles refresh errors gracefully
- Automatically signs out user if refresh fails
- Returns new session or null

**Error Handling:**

- `refresh_token_not_found` → Signs out user
- `invalid_refresh_token` → Signs out user
- `refresh_token_already_used` → Signs out user

**Example:**

```typescript
import { refreshSession } from "@/lib/supabase/session";

const session = await refreshSession();
if (session) {
  console.log("Session refreshed");
} else {
  console.log("Refresh failed, user signed out");
}
```

### `getValidSession()`

Gets a valid session, refreshing if token is about to expire.

**Returns:** `Promise<Session | null>`

**Behavior:**

- Checks if current session exists
- Checks if token expires within 5 minutes
- Automatically refreshes if needed
- Returns valid session or null

**Example:**

```typescript
import { getValidSession } from "@/lib/supabase/session";

async function makeApiCall() {
  const session = await getValidSession();
  if (!session) {
    throw new Error("Not authenticated");
  }

  // Token is guaranteed to be valid for at least 5 minutes
  // Make your API call here
}
```

### `isTokenExpiringSoon(session: Session, thresholdMinutes: number = 5)`

Checks if a session's token is expiring soon.

**Parameters:**

- `session: Session` - The session to check
- `thresholdMinutes: number` - Minutes before expiry to consider "soon" (default: 5)

**Returns:** `boolean`

**Example:**

```typescript
import { isTokenExpiringSoon } from "@/lib/supabase/session";

const session = await supabase.auth.getSession();
if (session.data.session && isTokenExpiringSoon(session.data.session)) {
  await refreshSession();
}
```

## Integration Points

### Before API Calls

Use `getValidSession()` before making authenticated API calls:

```typescript
import { getValidSession } from "@/lib/supabase/session";
import { supabase } from "@/lib/supabase";

async function fetchUserProfile() {
  const session = await getValidSession();
  if (!session) {
    throw new Error("Authentication required");
  }

  const { data, error } = await supabase
    .schema("tm")
    .from("profiles")
    .select("*")
    .eq("user_id", session.user.id)
    .single();

  return data;
}
```

### Manual Refresh

Use `refreshSession()` when you need to ensure a fresh token:

```typescript
import { refreshSession } from "@/lib/supabase/session";

// Before a critical operation
const session = await refreshSession();
if (!session) {
  // Handle authentication failure
  return;
}

// Proceed with operation
```

## Error Constants

The module exports error constants for refresh failures:

```typescript
export const REFRESH_ERRORS = {
  refresh_token_not_found: "Re-login required",
  invalid_refresh_token: "Re-login required",
  refresh_token_already_used: "Session expired",
};
```

## Testing

### Test Manual Refresh

```typescript
import { refreshSession } from "@/lib/supabase/session";

// Test successful refresh
const session = await refreshSession();
expect(session).toBeTruthy();
expect(session?.access_token).toBeTruthy();
```

### Test Pre-emptive Refresh

```typescript
import { getValidSession } from "@/lib/supabase/session";

// Mock session with expiring token
const expiringSession = { expires_at: Date.now() / 1000 + 60 }; // Expires in 1 minute

// Should automatically refresh
const session = await getValidSession();
expect(session).toBeTruthy();
```
