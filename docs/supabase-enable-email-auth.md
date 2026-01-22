# Enable Email Authentication in Supabase

## Problem

Users get this error when trying to authenticate:
```json
{
  "code": 400,
  "error_code": "validation_failed",
  "msg": "Unsupported provider: provider is not enabled"
}
```

This error can occur for different reasons:

1. **Email provider not enabled** - If email sign-in/sign-up doesn't work
2. **OAuth provider not enabled** - If user clicked Apple/Google button and those providers aren't enabled
3. **Sign-up specific issue** - If email sign-in works but sign-up doesn't

## Diagnosis

**If email sign-in works but sign-up fails:**
- Email provider IS enabled ✅
- Check if client clicked OAuth button (Apple/Google) instead of email/password
- Verify redirect URL configuration for sign-up emails

**If both sign-in and sign-up fail:**
- Email provider is likely disabled ❌

## Solution

Enable the Email provider in your Supabase Dashboard.

## Steps to Fix

### 1. Go to Authentication Providers Settings

1. Open your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project (project ref: `bqbbuysyiyzdtftctvdk`)
3. Navigate to: **Authentication** → **Providers** (or go directly to: https://supabase.com/dashboard/project/bqbbuysyiyzdtftctvdk/auth/providers)

### 2. Enable Email Provider

1. Find the **Email** provider in the list
2. Toggle it **ON** (it should show as enabled/green)
3. Configure email settings if needed:
   - **Enable email confirmations**: Optional (can be disabled for development)
   - **Enable secure email change**: Recommended to keep enabled
   - **Double email confirmations**: Optional

### 3. Save Changes

Click **Save** at the bottom of the page.

### 4. Verify Configuration

After enabling, users should be able to:
- Sign up with email/password
- Sign in with email/password

## Additional Configuration (If Needed)

### Email Templates

If you want to customize confirmation emails:
1. Go to **Authentication** → **Email Templates**
2. Customize the templates as needed
3. Make sure redirect URLs match your app's deep link scheme: `todaymatters://auth/confirm`

### Redirect URLs

Ensure your redirect URLs are configured:
1. Go to **Authentication** → **URL Configuration**
2. Add these redirect URLs:
   ```
   todaymatters://auth/confirm
   todaymatters://auth/callback
   ```

See `docs/SUPABASE_REDIRECT_SETUP.md` for more details.

## Testing

After enabling email authentication:

1. Try signing up a new user with email/password
2. Try signing in with an existing user
3. The error should no longer appear

## Troubleshooting OAuth Providers

If the error occurs when clicking **Apple** or **Google** buttons:

1. Go to **Authentication** → **Providers**
2. Enable the specific OAuth provider (Apple or Google)
3. Configure OAuth credentials:
   - **Apple**: Requires Apple Developer account setup
   - **Google**: Requires Google Cloud Console OAuth client setup
4. See Supabase docs for OAuth setup: https://supabase.com/docs/guides/auth/social-login

**Note:** If you don't need OAuth, you can hide those buttons in the UI or disable the providers entirely.

## Note About Local Development

The `supabase/config.toml` file only affects **local development** when running `supabase start`. It does NOT affect your production Supabase project. You must enable providers in the Supabase Dashboard for production.

## Redirect URLs Configuration

**Important:** Redirect URLs for email sign-up/sign-in are configured on your **Supabase team's side** in the Supabase Dashboard.

For email authentication to work properly, your Supabase team needs to configure:

1. **Redirect URLs** (Authentication → URL Configuration):
   ```
   todaymatters://auth/confirm
   todaymatters://auth/callback
   ```

2. **Site URL** can be set to:
   ```
   todaymatters://
   ```
   Or your web URL if you have one.

These settings are managed in the Supabase Dashboard and are required for:
- Email confirmation links (sign-up)
- Password reset links
- Email change confirmation links

**You don't need to configure these in code** - they're already set up in the app. Your Supabase team just needs to add them to the dashboard.

## Related Documentation

- `docs/SUPABASE_REDIRECT_SETUP.md` - Configure redirect URLs
- `docs/supabase-integration.md` - General Supabase setup guide
