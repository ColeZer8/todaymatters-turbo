# Android Installation Guide for Clients

This guide walks you through building and installing the Today Matters app on an Android device.

## Prerequisites

1. **EAS CLI installed and authenticated:**
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. **Your Expo account** should be logged in (the project uses EAS project ID: `4e1c4706-73fc-4230-bc8d-a876941dbf1b`)

## ⚠️ Pre-Flight Checklist (CRITICAL)

**Before building, you MUST configure environment variables as EAS secrets.** The app needs these to connect to Supabase and other services.

### Required Environment Variables

Set these as EAS secrets for your project:

```bash
cd apps/mobile

# Supabase configuration (REQUIRED)
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-anon-key-here"

# OAuth API configuration (REQUIRED)
eas secret:create --scope project --name EXPO_PUBLIC_OAUTH_API_BASE_URL --value "https://your-api.execute-api.region.amazonaws.com"
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "your-google-client-id.apps.googleusercontent.com"

# Optional: ElevenLabs voice agent (if using voice features)
eas secret:create --scope project --name EXPO_PUBLIC_ELEVENLABS_AGENT_ID --value "your-agent-id"
eas secret:create --scope project --name EXPO_PUBLIC_ELEVENLABS_PRIVATE_AGENT --value "false"
```

### Verify Secrets Are Set

```bash
eas secret:list
```

You should see all the required secrets listed.

### Environment-Specific Variables (Optional)

If you want to use different values for preview vs production, you can set environment-specific variables:

```bash
# For production builds
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL_PROD --value "https://prod-project.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY_PROD --value "prod-anon-key"

# Set APP_ENV for preview builds (defaults to 'development' if not set)
eas secret:create --scope project --name APP_ENV --value "production"
```

**Note:** The `preview` profile defaults to `APP_ENV=development`, so it will use `EXPO_PUBLIC_SUPABASE_URL` (not `_PROD`). If you want preview to use production values, set `APP_ENV=production` as a secret.

## Important: Standalone vs Development Builds

**For client installation, you do NOT need a dev server or tunnel running.**

- **`preview` and `production` profiles** → **Standalone builds** (recommended for clients)
  - Fully self-contained APK/AAB
  - Client can use the app completely independently
  - No dev server needed
  - No tunnel needed
  - Works offline

- **`development-device` profile** → **Development build** (only for active development)
  - Requires your dev server to be running
  - Would need a tunnel if client is remote
  - Use only if you want the client to see live code changes

**For a one-time client install, use `preview` or `production` - no dev server required!**

## Option 1: Build APK for Direct Installation (Recommended for Testing)

This creates an APK file that can be directly installed on the Android device.

### Step 1: Configure Build Environment (If Needed)

The `preview` profile defaults to `APP_ENV=development`. If you want to use production Supabase/API endpoints, you have two options:

**Option A: Set APP_ENV as EAS secret (recommended)**
```bash
eas secret:create --scope project --name APP_ENV --value "production"
```

**Option B: Use production profile instead**
The `production` profile will use production environment variables by default.

### Step 2: Build the APK

From the workspace root, run:

```bash
cd apps/mobile
eas build --platform android --profile preview
```

Or for a production build:

```bash
eas build --platform android --profile production
```

**Note:** 
- The `preview` profile creates an APK suitable for internal testing
- The `production` profile creates an AAB (Android App Bundle) for Google Play Store by default, but you can configure it to build APK in `eas.json` if needed
- Both profiles create standalone builds that work without a dev server

### Step 2: Download the APK

Once the build completes:
1. EAS will provide a download URL
2. Download the APK file to your computer
3. Share it with your client via:
   - Email attachment
   - Cloud storage (Google Drive, Dropbox, etc.)
   - Direct file transfer

### Step 3: Client Installation Instructions

Send these instructions to your client:

#### On the Android Device:

1. **Enable Unknown Sources:**
   - Go to **Settings** → **Security** (or **Apps** → **Special app access**)
   - Enable **"Install unknown apps"** or **"Unknown sources"**
   - If prompted, select the app you'll use to install (e.g., Files, Chrome, Email)

2. **Transfer the APK:**
   - If emailed: Open the email on the device and download the attachment
   - If on cloud storage: Download the APK using the cloud storage app
   - If via USB: Transfer the APK file to the device's Downloads folder

3. **Install the APK:**
   - Open the **Files** app (or your file manager)
   - Navigate to **Downloads** (or wherever you saved the APK)
   - Tap the APK file
   - Tap **Install** when prompted
   - Wait for installation to complete
   - Tap **Open** to launch the app

4. **Grant Permissions:**
   - The app will request permissions (microphone, location, etc.)
   - Grant the necessary permissions for the app to function properly

## Option 2: Internal Distribution via EAS (Alternative)

This method allows clients to install via a link without manually handling APK files.

### Step 1: Build and Submit

```bash
cd apps/mobile
eas build --platform android --profile preview
```

### Step 2: Create Internal Distribution

After the build completes:

```bash
eas submit --platform android --latest
```

Or share the build URL directly from the EAS dashboard.

### Step 3: Client Installation

Your client will:
1. Receive a link (via email or message)
2. Open the link on their Android device
3. Follow the on-screen instructions to install

## ⚡ Fast Iteration for Testing

**Don't want to wait 120 minutes for each update?** See [`docs/fast-iteration-testing.md`](./fast-iteration-testing.md) for strategies to update the app in seconds instead of hours.

Quick summary:
- **Development build + dev server**: Build once (~20-30 min), then get instant updates via tunnel
- **EAS Update**: Build once (120 min), then push updates in ~30 seconds
- **Local network**: If client is nearby, use WiFi for fastest connection

## Option 3: Development Build (For Active Development)

**⚠️ Only use this if you need the client to see live code changes. Otherwise, use Option 1.**

If you're actively developing and want the client to test the latest changes:

### Step 1: Build Development APK

```bash
cd apps/mobile
eas build --platform android --profile development-device
```

### Step 2: Start Your Dev Server with Tunnel

**You MUST have your dev server running with a tunnel for the client to connect:**

```bash
# Start dev server with tunnel (for remote clients)
pnpm dev -- --filter=mobile --tunnel

# Or if using Expo CLI directly
cd apps/mobile
npx expo start --tunnel
```

### Step 3: Install on Device

The development build includes the Expo dev client:
1. Install the APK as described in Option 1
2. The app will automatically connect to your dev server via the tunnel
3. Any code changes you make will hot-reload in the client's app

**Note:** The client's app will only work when your dev server is running and accessible via the tunnel.

## Troubleshooting

### Build Fails
- Ensure you're logged into EAS: `eas login`
- Check that your EAS project is properly configured
- **Verify all required environment variables are set as EAS secrets** (see Pre-Flight Checklist above)
- Check build logs: `eas build:view [BUILD_ID]`

### App Crashes or Can't Connect to Services
- **Most common issue:** Missing or incorrect environment variables
  - Verify secrets are set: `eas secret:list`
  - Check that Supabase URL and keys are correct
  - Ensure OAuth API URL is accessible from the client's network
- The app will fail silently if Supabase connection fails - check device logs if possible

### Client Can't Install APK
- **"App not installed" error:** The device may not allow unknown sources. Re-check security settings.
- **"Parse error" or "Corrupted file":** Re-download the APK file
- **"App not compatible":** Check that the device meets minimum Android version (API 26+ based on your config)

### App Crashes After Installation
- Check device logs: `adb logcat` (if you have Android SDK installed)
- Verify the app has necessary permissions
- Ensure the device meets minimum requirements (Android 8.0+ / API 26+)

## Quick Reference Commands

```bash
# Build preview APK
cd apps/mobile && eas build --platform android --profile preview

# Build production AAB (for Play Store)
cd apps/mobile && eas build --platform android --profile production

# Build development APK
cd apps/mobile && eas build --platform android --profile development-device

# Check build status
eas build:list

# View build details
eas build:view [BUILD_ID]
```

## Security Notes

- APK files from `preview` and `development-device` profiles are signed with EAS credentials
- Production builds should use your own signing key for Play Store distribution
- Never commit APK files to version control
- Share APK files securely (encrypted email, secure file sharing)
