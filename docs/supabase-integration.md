# Supabase Integration Guide for TodayMatters Mobile App

## Overview

This document outlines the Supabase integration setup for the TodayMatters mobile app built with Expo and React Native. Supabase provides authentication, database, storage, and real-time capabilities.

## Key Resources

- **Official Expo + Supabase Guide**: https://docs.expo.dev/guides/using-supabase/
- **Supabase React Native Quickstart**: https://supabase.com/docs/guides/auth/quickstarts/react-native
- **Supabase Expo Tutorial**: https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
- **Native Mobile Deep Linking**: https://supabase.com/docs/guides/auth/native-mobile-deep-linking
- **Supabase JavaScript Client**: https://supabase.com/docs/reference/javascript/introduction

## Architecture Decisions

### Why Supabase Client (Not Prisma)

- **Supabase Client**: Direct integration with Supabase's REST API and real-time subscriptions
- **No Prisma Needed**: Supabase provides type-safe queries via TypeScript types generated from your database schema
- **Simpler Stack**: Fewer dependencies, easier to maintain
- **Native Features**: Built-in auth, storage, and real-time capabilities

### Native Code Requirements

For Expo managed workflow:
- **Deep Linking**: Uses `expo-linking` and `expo-auth-session` (no custom native code needed)
- **OAuth**: Uses `expo-web-browser` for OAuth flows
- **Storage**: Uses `@react-native-async-storage/async-storage` for session persistence
- **Custom Native Modules**: Only needed if you require platform-specific APIs not available through Expo

## Required Packages

```bash
pnpm add @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
pnpm add -D @types/react-native-url-polyfill
```

For OAuth flows (if needed):
```bash
pnpm add expo-auth-session expo-web-browser expo-linking
```

## Environment Variables

Create `.env` files (never commit these):

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Note**: Expo requires the `EXPO_PUBLIC_` prefix for environment variables to be accessible in the app.

## ⚠️ Important: Using TM Schema

**This project uses the `tm` schema, NOT `public`.**

- All tables are in the `tm` schema
- Client is configured with `db: { schema: 'tm' }`
- All queries explicitly use `.schema('tm')` for clarity
- Types must be regenerated from `tm` schema (not `public`)

See `docs/supabase-tm-schema-integration-plan.md` for detailed integration plan.

## Client Setup

### Basic Client Configuration

Location: `apps/mobile/src/lib/supabase/client.ts`

```typescript
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'tm', // Use tm schema instead of public
  },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for React Native
  },
});
```

### Querying TM Schema

All queries should explicitly specify the schema:

```typescript
// ✅ Correct - explicit schema
const { data } = await supabase
  .schema('tm')
  .from('profiles')
  .select('*');

// ❌ Wrong - would query public schema
const { data } = await supabase
  .from('profiles')
  .select('*');
```

## Authentication Flow

### Email/Password Authentication

```typescript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});

// Sign out
const { error } = await supabase.auth.signOut();
```

### Magic Link Authentication

```typescript
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';

const redirectTo = makeRedirectUri();

const { error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com',
  options: {
    emailRedirectTo: redirectTo,
  },
});
```

### OAuth Authentication (Google, Apple, etc.)

See `apps/mobile/src/lib/supabase/auth.ts` for OAuth implementation details.

## Deep Linking Configuration

### app.json Configuration

```json
{
  "scheme": "todaymatters",
  "ios": {
    "bundleIdentifier": "com.todaymatters.mobile",
    "associatedDomains": ["applinks:your-project.supabase.co"]
  },
  "android": {
    "package": "com.todaymatters.mobile",
    "intentFilters": [
      {
        "action": "VIEW",
        "data": [
          {
            "scheme": "todaymatters"
          }
        ]
      }
    ]
  }
}
```

### Handling Auth Callbacks

Location: `apps/mobile/src/lib/supabase/auth.ts`

```typescript
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import { supabase } from './client';

export const createSessionFromUrl = async (url: string) => {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  
  if (errorCode) throw new Error(errorCode);
  
  const { access_token, refresh_token } = params;
  
  if (!access_token) return;
  
  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  
  if (error) throw error;
  return data.session;
};
```

## Database Queries

### Basic Query Example

```typescript
// Fetch data
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  .eq('user_id', userId);

// Insert data
const { data, error } = await supabase
  .from('tasks')
  .insert([{ title: 'New task', user_id: userId }]);

// Update data
const { data, error } = await supabase
  .from('tasks')
  .update({ completed: true })
  .eq('id', taskId);

// Delete data
const { error } = await supabase
  .from('tasks')
  .delete()
  .eq('id', taskId);
```

### Real-time Subscriptions

```typescript
useEffect(() => {
  const channel = supabase
    .channel('tasks')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        console.log('Change received!', payload);
        // Update local state
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [userId]);
```

## TypeScript Types

Generate types from your Supabase database:

```bash
npx supabase gen types typescript --project-id your-project-ref > apps/mobile/src/lib/supabase/database.types.ts
```

Then use typed client:

```typescript
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  // ... config
});
```

## Security Best Practices

1. **Never expose service role key** in client code
2. **Use Row Level Security (RLS)** policies in Supabase
3. **Validate data** on the server side (Supabase Edge Functions)
4. **Store sensitive tokens** using Expo SecureStore if needed
5. **Use environment variables** for all Supabase credentials

## Testing

### Local Development

1. Use Supabase local development: `npx supabase start`
2. Update `.env` to point to local instance
3. Test auth flows with Expo Go or development build

### Production

1. Ensure environment variables are set in EAS Build
2. Configure deep linking URLs in Supabase dashboard
3. Test OAuth redirects on physical devices

## Troubleshooting

### Common Issues

1. **Session not persisting**: Ensure `AsyncStorage` is properly configured
2. **Deep linking not working**: Check `app.json` scheme configuration
3. **OAuth redirect fails**: Verify redirect URLs match in Supabase dashboard
4. **Type errors**: Regenerate types after schema changes

## Next Steps

- Set up Row Level Security policies in Supabase
- Implement offline-first patterns with local caching
- Add error boundaries for auth failures
- Set up analytics tracking for auth events

