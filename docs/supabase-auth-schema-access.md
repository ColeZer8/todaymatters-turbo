# How Schema Access Works with Authentication

## How It Works

Your Supabase team set it up correctly! Here's the flow:

### 1. **Schema Exposure** (Infrastructure Level)

- The `tm` schema is exposed in API settings
- This allows the Supabase client to "see" the schema
- Without this, you'd get "schema does not exist" errors

### 2. **Authentication Token** (User Level)

- When a user signs in, they get a JWT token
- The token is automatically stored in AsyncStorage
- The Supabase client automatically includes this token in all requests

### 3. **Row Level Security (RLS)** (Data Access Level)

- Tables in `tm` schema have RLS policies enabled
- RLS policies check `auth.uid()` which requires a valid user token
- Users can only access their own data (where `user_id = auth.uid()`)

## The Flow

```
1. User signs in
   ↓
2. Supabase returns JWT token
   ↓
3. Token stored in AsyncStorage (via auth store)
   ↓
4. All queries automatically include token in headers
   ↓
5. RLS policies check: "Is this user authenticated? (token valid)"
   ↓
6. RLS policies check: "Does user_id match auth.uid()?"
   ↓
7. If both pass → data returned ✅
```

## Your Current Setup

✅ **Schema exposed**: `tm` schema is accessible via API  
✅ **RLS enabled**: Tables require authentication  
✅ **Token auto-included**: Supabase client handles this automatically

## What This Means for Your Code

**You don't need to do anything special!** Your existing code already works:

```typescript
// This automatically includes the user's token
const { data } = await supabase
  .schema("tm")
  .from("profile_values")
  .select("*")
  .eq("user_id", userId);
```

The Supabase client:

1. Gets the token from AsyncStorage (set during sign in)
2. Includes it in the request headers
3. RLS policies validate it
4. Returns data if user owns it

## Testing

To verify it's working:

1. **Sign in a user** (creates session with token)
2. **Try a query**:
   ```typescript
   const { data, error } = await supabase
     .schema("tm")
     .from("profiles")
     .select("*")
     .eq("user_id", userId);
   ```
3. **If it works** → Schema is exposed + RLS is working ✅
4. **If you get "schema does not exist"** → Schema not exposed yet
5. **If you get "permission denied"** → RLS policy issue or no token

## Important Notes

- **Anonymous users** (not signed in) cannot access `tm` schema data
- **Each user** can only see/modify their own rows (enforced by RLS)
- **The token** is automatically refreshed when it expires
- **No manual token handling** needed - Supabase client does it all

## Your Code is Already Set Up Correctly

Your `auth-store.ts` handles session management:

- `initialize()` gets the session (with token)
- `setSession()` stores it
- Supabase client uses it automatically

Your queries in `profile-values.ts` already use:

- `.schema('tm')` ✅
- `.eq('user_id', userId)` ✅
- RLS policies will enforce access ✅

## Next Steps

1. ✅ **Schema is exposed** (your team did this)
2. ✅ **RLS policies are set** (from DDL file)
3. ✅ **Your code is ready** (no changes needed)
4. 🧪 **Test it**: Sign in and try a query!

---

**TL;DR**: Yes, you need a user token first. Your Supabase client automatically includes it. Your code is already set up correctly! 🎉
