# Making Changes Before Client Installs

If your client hasn't installed the app yet, you can freely make changes and rebuild. Here's how:

## Quick Process

### Step 1: Make Your Changes
Edit your code as normal - fix bugs, add features, update UI, etc.

### Step 2: Rebuild the APK
```bash
cd apps/mobile
eas build --platform android --profile preview
```

This will create a new build with your latest changes.

### Step 3: Share the New Build
Once the build completes (120 minutes), you'll get a new download URL. Share this with your client instead of the old one.

**Important:** The old build URL will still work, but you want to give them the new one with your latest changes.

---

## What Happens to the Old Build?

- The old build still exists and can be downloaded
- But you'll share the new build URL with your client
- Client installs the new build (with your changes) on first install
- No issues since they never installed the old one

---

## Alternative: Set Up EAS Update Now

If you think you'll want to push updates after the client installs, set up EAS Update now:

### Step 1: Configure eas.json
```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    }
  },
  "update": {
    "preview": {
      "channel": "preview",
      "checkAutomatically": "ON_LOAD"
    }
  }
}
```

### Step 2: Make Your Changes & Rebuild
```bash
cd apps/mobile
eas build --platform android --profile preview
```

### Step 3: After Client Installs
You can push updates instantly:
```bash
eas update --branch preview --message "Your changes"
```

This way:
- Client installs the build once
- Future updates are automatic (no rebuild needed for JS changes)
- Much faster iteration

---

## Recommendation

**If you're still making changes:**
1. Make all your changes now
2. Rebuild once with everything included
3. Share the final build with client

**If you expect ongoing updates:**
1. Set up EAS Update (see above)
2. Make your changes and rebuild
3. Client installs once
4. Push future updates with `eas update` (30 seconds vs 120 minutes)

---

## Quick Commands

```bash
# Make your code changes first, then:

# Rebuild with latest changes
cd apps/mobile
eas build --platform android --profile preview

# Check build status
eas build:list --platform android --limit 1

# Once complete, get the new download URL
eas build:view [BUILD_ID]
```
