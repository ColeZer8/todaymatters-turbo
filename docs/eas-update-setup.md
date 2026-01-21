# EAS Update Setup - Fast Updates Without Rebuilding

You're all set! Here's what I configured and how to use it:

## What I Set Up

1. ✅ Added update channels to `eas.json`
2. ✅ Configured automatic update checking in `app.config.js`
3. ✅ Set up preview and production channels

## Your Workflow Now

### Step 1: Client Installs Current Build
- Share your current build URL with client
- Client installs the APK (one time, ~120 min wait)
- Done! They have the app installed

### Step 2: Make Changes Locally
- Edit your code as normal
- Test locally if you want
- No need to rebuild!

### Step 3: Push Update (30 seconds!)
```bash
cd apps/mobile
eas update --branch preview --message "Fixed login bug"
```

That's it! Client's app will automatically update on next launch.

## How It Works

1. **Client installs build** → Gets the base app with update capability
2. **You make changes** → Edit code locally
3. **You push update** → `eas update` uploads just the JavaScript bundle (~30 sec)
4. **Client opens app** → App checks for updates, downloads, applies automatically
5. **Client sees new version** → Brief loading screen (2-3 sec), then new version

## Commands You'll Use

```bash
# Push an update (after making code changes)
cd apps/mobile
eas update --branch preview --message "Description of changes"

# Check update status
eas update:list --branch preview

# View update details
eas update:view [UPDATE_ID]
```

## Important Notes

- ✅ **JavaScript/TypeScript changes** → Use `eas update` (30 seconds)
- ⚠️ **Native code changes** (new packages, native modules) → Need full rebuild (120 minutes)
- ✅ **Updates are automatic** → Client doesn't need to do anything
- ✅ **Works offline** → App works normally, checks for updates when online

## Testing Updates Locally

Before pushing to client, you can test updates:

```bash
# Start dev server
pnpm dev -- --filter=mobile

# Make changes and see them instantly
# Then push the update when ready
eas update --branch preview --message "Your changes"
```

## What Client Sees

When you push an update:
1. Client opens app (or app checks in background)
2. App detects update available
3. Downloads update silently
4. App shows brief loading screen (2-3 seconds)
5. App restarts with new version
6. All app data preserved

**No manual installation needed!**

## Next Steps

1. **Make your code changes** locally
2. **Test them** if you want (dev server or simulator)
3. **Share current build** with client (they install once)
4. **Push updates** as needed with `eas update` (30 seconds each!)

You're all set! 🚀
