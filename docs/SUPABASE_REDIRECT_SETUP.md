# Supabase Redirect URL Configuration

## Problem

Email confirmation links from Supabase are redirecting to `localhost` which can't be reached on mobile devices.

## Solution

Configure Supabase to use your app's deep link scheme: `todaymatters://`

## Steps to Fix

### 1. Configure Redirect URLs in Supabase Dashboard

1. Go to your Supabase project dashboard:
   - https://supabase.com/dashboard/project/bqbbuysyiyzdtftctvdk/auth/url-configuration

2. Under "Redirect URLs", add:

   ```
   todaymatters://auth/confirm
   todaymatters://auth/callback
   todaymatters://reset-password
   ```

3. Click "Save"

### 2. Site URL Configuration

1. In the same page, set the "Site URL" to:
   ```
   todaymatters://
   ```
   Or leave it as your web URL if you have one.

### 3. Verify App Configuration

Your `app.json` already has the correct scheme:

```json
{
  "scheme": "todaymatters"
}
```

### 4. Test Email Confirmation

After configuring:

1. Sign up a new user
2. Check your email
3. Click the confirmation link
4. It should open your app (if installed) or prompt to open it

## For Development (Expo Go)

If testing with Expo Go, you might need to use:

```
exp://localhost:8081/--/auth/confirm
```

But for production/dev builds, use:

```
todaymatters://auth/confirm
```

## Additional Notes

- The code has been updated to automatically use `todaymatters://auth/confirm` for sign up
- Password reset uses `todaymatters://reset-password` for reset links
- Deep linking is already set up in `_layout.tsx` to handle these URLs
- The `handleAuthCallback` function will process the confirmation tokens and password reset tokens
- Supabase password reset is fully supported and follows the official Supabase React Native pattern
