# What Your Client Sees: Update Experience Guide

This guide explains what happens on your client's phone when you push updates, depending on which method you use.

---

## Method 1: Development Build + Dev Server (Active Development)

### What You Do:

```bash
# Start dev server with tunnel
pnpm dev -- --filter=mobile --tunnel

# Make code changes
# Save file → changes appear instantly
```

### What Client Sees:

**First Time (Initial Connection):**

1. Client opens the app
2. App shows "Connecting to development server..." (brief moment)
3. App connects and loads normally
4. Client sees your latest code immediately

**When You Push Updates:**

1. You save a file in your code editor
2. **Client's app automatically reloads** (1-2 seconds)
3. Client sees the new changes immediately
4. **No action required from client** - it just happens

**Visual Experience:**

- Brief white screen or loading indicator (1-2 seconds)
- App refreshes with new content
- Client continues using the app normally
- Feels like a page refresh in a browser

**If Dev Server Goes Offline:**

- App shows "Unable to connect to development server"
- Client can't use the app until you restart the dev server
- This is why it's only for active development sessions

---

## Method 2: EAS Update (Over-the-Air Updates)

### What You Do:

```bash
# Push an update
cd apps/mobile
eas update --branch preview --message "Fixed login bug"
```

### What Client Sees:

**When Update is Available:**

1. Client opens the app (or app checks in background)
2. App detects new update available
3. **Automatic download happens silently** (if configured)
4. App applies update on next launch

**Update Application:**

- **Option A: Automatic (Recommended)**
  - Client opens app normally
  - Brief loading screen (2-3 seconds) while update applies
  - App opens with new version
  - **Client doesn't need to do anything** - seamless experience

- **Option B: Manual Check**
  - Client can pull down to refresh (if you add this feature)
  - Or app checks on launch automatically
  - Shows "Update available" notification (if configured)

**Visual Experience:**

- Very brief loading screen (2-3 seconds)
- App restarts with new version
- All app data is preserved
- Feels like a normal app restart

**If Client is Offline:**

- App works normally with current version
- Update downloads automatically when they come back online
- No interruption to their experience

**Best For:**

- Stable releases
- Bug fixes
- Feature updates
- When you don't want to keep a dev server running

---

## Method 3: Full Rebuild (New APK)

### What You Do:

```bash
# Build new APK
cd apps/mobile
eas build --platform android --profile preview
# Wait 120 minutes...
# Share new APK with client
```

### What Client Sees:

**Installation Process:**

1. Client receives new APK (email, link, etc.)
2. Client downloads APK file
3. Client taps APK to install
4. Android shows "Install" button
5. Client taps "Install"
6. App installs (replaces old version)
7. Client opens app - sees new version

**Visual Experience:**

- Standard Android installation flow
- Client needs to manually install
- Takes 1-2 minutes total
- **More manual work for client**

**Important Notes:**

- If client has old version installed, they may need to uninstall first (signature mismatch)
- Client needs to enable "Install from Unknown Sources" (one-time setup)
- All app data is preserved (unless you change app structure)

**Best For:**

- Native code changes (new dependencies)
- Major version updates
- When EAS Update isn't configured

---

## Comparison: Client Experience

| Method           | Client Action Required | Update Speed      | Visual Experience        |
| ---------------- | ---------------------- | ----------------- | ------------------------ |
| **Dev Server**   | None (automatic)       | Instant (1-2 sec) | Brief reload             |
| **EAS Update**   | None (automatic)       | Fast (2-3 sec)    | Brief loading screen     |
| **Full Rebuild** | Manual install         | Slow (1-2 min)    | Standard Android install |

---

## Recommended User Experience

### For Active Development (You + Client Testing Together):

**Use Development Build + Dev Server**

- Client sees changes instantly as you code
- Perfect for real-time feedback
- Client just uses the app normally
- You keep dev server running during sessions

### For Stable Testing (Client Testing Independently):

**Use EAS Update**

- Client gets updates automatically
- No manual installation needed
- Seamless experience
- Works even when you're not available

### For Major Updates (Native Changes):

**Use Full Rebuild**

- Only when necessary (native code changes)
- Client installs new APK manually
- One-time process per major update

---

## Setting Up EAS Update for Seamless Experience

To enable automatic updates for your client:

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

### Step 2: Build Initial App

```bash
cd apps/mobile
eas build --platform android --profile preview
```

### Step 3: Install on Client's Device

Install the APK as normal.

### Step 4: Push Updates

```bash
cd apps/mobile
eas update --branch preview --message "Your update description"
```

**Result:** Client's app automatically checks for updates when they open it, downloads silently, and applies on next launch. They see a brief loading screen (2-3 seconds) and then the new version.

---

## What to Tell Your Client

### For Development Build:

> "I'm running a development server. When I make changes, the app will automatically refresh. You might see a brief loading screen, but that's normal. Just keep using the app as usual."

### For EAS Update:

> "The app will automatically update when new versions are available. When you open the app, it checks for updates and applies them automatically. You might see a brief loading screen when an update is being applied."

### For Full Rebuild:

> "I've sent you a new version of the app. Please download and install the APK file. If you already have the app installed, you may need to uninstall the old version first, then install the new one."

---

## Pro Tips

1. **Use EAS Update for client testing** - It's the most seamless experience
2. **Use Dev Server for active development** - When you're both testing together
3. **Minimize full rebuilds** - Only when absolutely necessary
4. **Communicate with client** - Let them know which method you're using so they know what to expect
