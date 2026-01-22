# Password Reset Setup - Supabase

## ✅ Yes, Password Reset is Fully Supported!

Password reset is **fully supported** by Supabase and follows their official React Native pattern. The implementation uses:

- `supabase.auth.resetPasswordForEmail()` - Sends password reset email
- `supabase.auth.updateUser({ password })` - Updates password after token verification
- Deep linking with `todaymatters://reset-password` - Handles reset links from email

## How It Works

1. **User requests reset** → Enters email on forgot password screen
2. **Supabase sends email** → Contains reset link with verification token
3. **User clicks link** → Supabase verifies token server-side → Redirects to app with tokens
4. **App creates session** → Temporary session created from reset tokens
5. **User sets new password** → Password updated via `updateUser()`
6. **Redirect to sign-in** → User can now sign in with new password

## Configuration Required

### 1. Add Redirect URL to Supabase Dashboard

**Critical:** You must add the password reset redirect URL to your Supabase project:

1. Go to: https://supabase.com/dashboard/project/bqbbuysyiyzdtftctvdk/auth/url-configuration
2. Under "Redirect URLs", add:
   ```
   todaymatters://reset-password
   ```
3. Click "Save"

**Without this, password reset links won't work!**

### 2. Verify Email Provider is Enabled

Password reset requires email authentication to be enabled:

1. Go to: **Authentication** → **Providers**
2. Ensure **Email** provider is enabled (toggle ON)
3. Save changes

## Implementation Details

### Code Location

- **Forgot Password Screen**: `apps/mobile/src/app/forgot-password.tsx`
- **Reset Password Screen**: `apps/mobile/src/app/reset-password.tsx`
- **Auth Functions**: `apps/mobile/src/lib/supabase/auth.ts`
  - `sendPasswordResetEmail()` - Sends reset email
  - `updatePassword()` - Updates password

### Deep Link Handling

The app automatically handles password reset deep links:

- URL format: `todaymatters://reset-password?access_token=...&refresh_token=...`
- Tokens are extracted and used to create a temporary session
- User is navigated to reset password screen
- After password update, session is cleared and user redirected to sign-in

### URL Parsing

The implementation uses `expo-auth-session/build/QueryParams` which handles both:
- `?` query parameters (standard)
- `#` fragment parameters (sometimes used by Supabase)

Both formats are automatically supported.

## Testing

1. **Request Reset**:
   - Go to sign-in screen
   - Click "Forgot password?"
   - Enter email address
   - Check email inbox

2. **Complete Reset**:
   - Click reset link in email
   - App should open to reset password screen
   - Enter new password (twice)
   - Should redirect to sign-in

3. **Sign In**:
   - Use new password to sign in
   - Should work normally

## Troubleshooting

### Reset Link Doesn't Open App

- **Check redirect URL**: Must be `todaymatters://reset-password` in Supabase dashboard
- **If you see `http://localhost:3000/#access_token=...&type=recovery`**: your Supabase **Site URL** (and/or the password recovery email template) is still pointing at `localhost:3000`, so the link will open a browser page that doesn’t exist on your machine. Update **Authentication → URL Configuration → Site URL** to `todaymatters://` (or your real web domain) and ensure your recovery email template uses the provided action/confirmation URL instead of hardcoding `{{ .SiteURL }}`.
- **Check email provider**: Must be enabled in Supabase
- **Check deep link config**: Verify `app.config.js` has correct scheme

### "Provider not enabled" Error

- Email authentication provider must be enabled in Supabase Dashboard
- Go to: **Authentication** → **Providers** → Enable **Email**

### Password Update Fails

- User must click reset link within token expiration time (default: 1 hour)
- Token must be valid (not expired or already used)
- Password must meet requirements (minimum length, etc.)

## Related Documentation

- `docs/SUPABASE_REDIRECT_SETUP.md` - General redirect URL configuration
- `docs/supabase-enable-email-auth.md` - Email authentication setup
- [Supabase Password Reset Docs](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)
