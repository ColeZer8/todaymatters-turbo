# XcodeBuildMCP Device Test - Metro Connection Issue

**Date:** January 2, 2026  
**Device:** Cole's iPhone (91E4F412-A83A-521A-A479-355C1F10F873)  
**Status:** ⚠️ App launches but terminates - Metro connection issue suspected

## Test Results

### App Launch Status
✅ **App builds and installs successfully**  
✅ **App launches on device**  
⚠️ **App terminates after ~6-8 seconds**

### Logs Analysis

The device logs show:
1. App initializes successfully
2. React Native bridge starts
3. UIManagerBinding warnings (normal during initialization)
4. App terminates with signal 15 (SIGTERM)

**Key Log Entries:**
```
LK setup
_setUpFeatureFlags called with release level 2
UIManagerBinding.cpp:135] instanceHandle is null, event of type topContentSizeChange will be dropped
App terminated due to signal 15.
```

### Issue Identified

**Metro Server Configuration:**
- Metro is running with `--host localhost`
- Mac's network IP: `192.168.86.250`
- Physical devices cannot connect to `localhost` - they need the network IP

**Solution Options:**

1. **Restart Metro with LAN access:**
   ```bash
   pnpm --filter mobile start --host lan
   ```
   This makes Metro accessible on the local network.

2. **Use Expo tunnel (if on different networks):**
   ```bash
   pnpm --filter mobile start --host tunnel
   ```

3. **Check Metro console for connection errors:**
   - Look for "Unable to connect to Metro" or similar errors
   - Check if device is attempting to connect to Metro

### Next Steps

1. ✅ Verify Metro is running (confirmed)
2. ⚠️ Restart Metro with `--host lan` to allow device connection
3. 🔄 Relaunch app and verify connection
4. 📊 Check Metro console for successful connection logs

### Notes

- The app's native code initializes correctly
- React Native bridge starts successfully
- Termination likely due to Metro connection failure or JavaScript error
- Once Metro connection is established, the app should load the JavaScript bundle

