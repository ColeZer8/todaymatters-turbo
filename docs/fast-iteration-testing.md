# Fast Iteration for Testing - No More 120-Minute Waits! 🚀

When actively testing with a client, you don't want to wait 2 hours for each change. Here are your options for fast iteration:

## Strategy 1: Development Build + Dev Server (Fastest for Active Development)

**Best for:** When you're actively making changes and testing with the client

### How It Works
1. Build a **development build** once (takes ~20-30 minutes, but only once)
2. Install it on the client's device
3. Connect to your dev server for **instant JavaScript updates** (no rebuild needed!)

### Setup Steps

#### Step 1: Build Development APK (One Time)
```bash
cd apps/mobile
eas build --platform android --profile development-device
```

This creates an APK with the Expo dev client built in.

#### Step 2: Install on Client's Device
Follow the installation steps from the main guide to install the APK.

#### Step 3: Start Your Dev Server with Tunnel
```bash
# From workspace root
pnpm dev -- --filter=mobile --tunnel
```

Or if you prefer Expo CLI directly:
```bash
cd apps/mobile
npx expo start --tunnel
```

The `--tunnel` flag creates a public URL that the client's device can connect to from anywhere.

#### Step 4: Client Connects to Dev Server
When the client opens the app:
- The development build will automatically detect your dev server
- Or they can scan the QR code from your terminal
- The app will connect and load your latest JavaScript code

### Benefits
- ✅ **Instant updates** - Changes appear in seconds, not hours
- ✅ **Hot reload** - See changes as you code
- ✅ **Fast feedback loop** - Perfect for active development
- ✅ **No rebuild needed** for JavaScript/TypeScript changes

### Limitations
- ⚠️ Requires your dev server to be running
- ⚠️ Client needs internet connection to reach your tunnel
- ⚠️ Native code changes (new dependencies, native modules) still require rebuild

---

## Strategy 2: EAS Update (Over-the-Air Updates)

**Best for:** When you want to push updates without rebuilding, but don't want to keep a dev server running

### How It Works
1. Build a standalone app once (preview or production)
2. Push JavaScript updates via `eas update` (takes ~30 seconds)
3. Client's app automatically downloads and applies updates

### Setup Steps

#### Step 1: Configure EAS Update in eas.json
```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "channel": "production"
    }
  },
  "update": {
    "preview": {
      "channel": "preview"
    },
    "production": {
      "channel": "production"
    }
  }
}
```

#### Step 2: Build Initial App
```bash
cd apps/mobile
eas build --platform android --profile preview
```

#### Step 3: Install on Client's Device
Install the APK as normal.

#### Step 4: Push Updates (Fast!)
```bash
cd apps/mobile
eas update --branch preview --message "Fixed login bug"
```

This takes ~30 seconds and the client's app will automatically update on next launch (or you can configure it to check for updates in-app).

### Benefits
- ✅ **Fast updates** - ~30 seconds vs 120 minutes
- ✅ **No dev server needed** - Updates are pushed to EAS servers
- ✅ **Automatic updates** - Client's app updates automatically
- ✅ **Works offline** - App works normally, just checks for updates when online

### Limitations
- ⚠️ Only updates JavaScript/TypeScript code
- ⚠️ Native code changes still require full rebuild
- ⚠️ Requires EAS Update subscription (free tier available)

---

## Strategy 3: Local Network Development (If Client is Nearby)

**Best for:** When client is on the same WiFi network

### How It Works
1. Build development build once
2. Start dev server on local network (no tunnel needed)
3. Client connects via local IP

### Setup Steps

#### Step 1: Build Development APK
```bash
cd apps/mobile
eas build --platform android --profile development-device
```

#### Step 2: Start Dev Server (No Tunnel)
```bash
# From workspace root
pnpm dev -- --filter=mobile
```

This will show a local network URL like `exp://192.168.1.100:8081`

#### Step 3: Client Connects
- Client opens the app
- Scans QR code or enters the local URL
- Connects directly via WiFi (much faster than tunnel)

### Benefits
- ✅ **Fastest connection** - Direct WiFi, no tunnel overhead
- ✅ **No internet required** - Works on local network
- ✅ **Instant updates** - Same as Strategy 1

### Limitations
- ⚠️ Client must be on same network
- ⚠️ Requires your dev server running
- ⚠️ Not suitable for remote clients

---

## Comparison Table

| Strategy | Initial Build | Update Time | Dev Server Needed | Best For |
|----------|--------------|-------------|-------------------|----------|
| **Development Build + Tunnel** | 20-30 min | Instant | Yes | Active development |
| **EAS Update** | 120 min | ~30 sec | No | Periodic updates |
| **Local Network** | 20-30 min | Instant | Yes | Same network |
| **Full Rebuild** | 120 min | 120 min | No | Native changes only |

---

## Recommended Workflow

### For Active Testing/Development:
1. **First time:** Build development build (`development-device` profile) - 20-30 min
2. **Daily:** Start dev server with tunnel - instant connection
3. **Make changes:** Code, save, see changes instantly in client's app
4. **Only rebuild when:** Adding new native dependencies or changing native code

### For Stable Testing:
1. **First time:** Build preview build - 120 min (but standalone)
2. **Updates:** Use `eas update` for JavaScript changes - 30 sec
3. **Rebuild only when:** Native code changes needed

---

## Quick Commands Reference

```bash
# Development build (one time, ~20-30 min)
cd apps/mobile
eas build --platform android --profile development-device

# Start dev server with tunnel (for remote clients)
pnpm dev -- --filter=mobile --tunnel

# Start dev server on local network (for nearby clients)
pnpm dev -- --filter=mobile

# Push OTA update (after configuring EAS Update)
cd apps/mobile
eas update --branch preview --message "Your update message"

# Full rebuild (only when needed)
cd apps/mobile
eas build --platform android --profile preview
```

---

## Pro Tips

1. **Use development builds for active testing** - The 20-30 minute initial build is worth it for instant iteration
2. **Keep dev server running** - Leave it running in a terminal during testing sessions
3. **Use EAS Update for stable releases** - Once features are stable, switch to preview builds + EAS Update
4. **Rebuild only when necessary** - Most changes are JavaScript and don't need native rebuilds

---

## Troubleshooting

### Dev Server Won't Connect
- Check tunnel is working: Look for `exp://` URL in terminal
- Verify client has internet connection
- Try restarting dev server: `Ctrl+C` then restart

### Updates Not Appearing
- For dev server: Check app is connected (should show "Connected" in dev menu)
- For EAS Update: Check update was published successfully: `eas update:list`
- Force app restart to check for updates

### Build Fails
- Check EAS secrets are set (see main installation guide)
- Verify environment variables are correct
- Check build logs: `eas build:view [BUILD_ID]`
