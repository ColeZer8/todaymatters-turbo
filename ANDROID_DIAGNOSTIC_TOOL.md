# Android Physical Device Diagnostic Tool

## The Problem

The `startAndroidBackgroundLocationAsync` function has **multiple silent early returns** that fail without any error or logging. On a physical device, any of these could be failing:

1. Support status check fails
2. Location module not loaded
3. Location services disabled
4. Foreground permission not granted
5. Background permission not granted
6. Task already started (this is fine)

**All of these fail silently** - no errors, no logs (especially in production builds where `__DEV__` is false).

## Diagnostic Steps

### Step 1: Check if Background Task is Actually Started

Add this to the dev location screen or create a diagnostic function:

```typescript
import { loadExpoLocationAsync } from "@/lib/android-location";
import { ANDROID_BACKGROUND_LOCATION_TASK_NAME } from "@/lib/android-location/task-names";

async function checkAndroidLocationStatus() {
  const Location = await loadExpoLocationAsync();
  if (!Location) {
    console.error("❌ Location module not loaded");
    return;
  }

  const isStarted = await Location.hasStartedLocationUpdatesAsync(
    ANDROID_BACKGROUND_LOCATION_TASK_NAME,
  );
  console.log("📍 Background location task started:", isStarted);

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  console.log("📍 Location services enabled:", servicesEnabled);

  const fg = await Location.getForegroundPermissionsAsync();
  console.log("📍 Foreground permission:", fg.status);

  const bg = await Location.getBackgroundPermissionsAsync();
  console.log("📍 Background permission:", bg.status);
}
```

### Step 2: Check for Queued Samples

The samples might be collected but not uploaded. Check local queue:

```typescript
import { peekPendingAndroidLocationSamplesAsync } from "@/lib/android-location/queue";

const pending = await peekPendingAndroidLocationSamplesAsync(userId, 1000);
console.log("📍 Pending samples in queue:", pending.length);
```

If there are pending samples but no data in database, the **flush is failing**.

### Step 3: Check Foreground Service Notification

The foreground service notification should be visible. If it's not:

- Background location task is NOT running
- Android killed the service
- Notification permission denied

### Step 4: Check Build Type

On physical devices, if it's a **production build** (`__DEV__ = false`), all the console logs are stripped out. We need to add **production-safe logging** or use a logging service.

## Most Likely Causes

### 1. **Background Permission Not Actually Granted**

Even if the user thinks they granted it, Android 10+ requires:

- First grant foreground permission
- Then separately grant background permission
- Background permission might require going to Settings

**Check:**

```typescript
const bg = await Location.getBackgroundPermissionsAsync();
if (bg.status !== "granted") {
  // This is silently failing!
}
```

### 2. **Battery Optimization Killing the Task**

Even with all permissions, battery optimization can kill background tasks.

**Check:** Settings > Apps > TodayMatters > Battery > Should be "Unrestricted"

### 3. **Foreground Service Not Starting**

The foreground service might fail to start, which would prevent background location.

**Check:** Is the notification visible? If not, foreground service didn't start.

### 4. **TaskManager Not Registered**

The background task is only registered if `ExpoTaskManager` exists. On some builds, this might not be available.

**Check:** The task registration happens in `location-task.ts` - if `ExpoTaskManager` is missing, the task is never defined.

### 5. **Silent Failures in startAndroidBackgroundLocationAsync**

The function silently returns on ANY failure. We need to add error reporting.

## Recommended Fix

Add a diagnostic/status function that reports WHY the task isn't starting:

```typescript
export async function getAndroidLocationDiagnostics(): Promise<{
  support: string;
  locationModule: boolean;
  servicesEnabled: boolean;
  foregroundPermission: string;
  backgroundPermission: string;
  taskStarted: boolean;
  pendingSamples: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const diagnostics = {
    support: getAndroidLocationSupportStatus(),
    locationModule: false,
    servicesEnabled: false,
    foregroundPermission: "unknown",
    backgroundPermission: "unknown",
    taskStarted: false,
    pendingSamples: 0,
    errors,
  };

  if (diagnostics.support !== "available") {
    errors.push(`Support status: ${diagnostics.support}`);
    return diagnostics;
  }

  const Location = await loadExpoLocationAsync();
  if (!Location) {
    errors.push("Location module not loaded");
    return diagnostics;
  }
  diagnostics.locationModule = true;

  diagnostics.servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!diagnostics.servicesEnabled) {
    errors.push("Location services disabled on device");
  }

  const fg = await Location.getForegroundPermissionsAsync();
  diagnostics.foregroundPermission = fg.status;
  if (fg.status !== "granted") {
    errors.push(`Foreground permission: ${fg.status}`);
  }

  const bg = await getBackgroundPermissionsSafeAsync(Location);
  diagnostics.backgroundPermission = bg.status;
  if (bg.status !== "granted") {
    errors.push(`Background permission: ${bg.status}`);
  }

  diagnostics.taskStarted = await Location.hasStartedLocationUpdatesAsync(
    ANDROID_BACKGROUND_LOCATION_TASK_NAME,
  );
  if (!diagnostics.taskStarted && errors.length === 0) {
    errors.push("Task not started (unknown reason)");
  }

  // Check pending samples
  const userId = (await supabase.auth.getSession()).data.session?.user?.id;
  if (userId) {
    const pending = await peekPendingAndroidLocationSamplesAsync(userId, 1000);
    diagnostics.pendingSamples = pending.length;
  }

  return diagnostics;
}
```

## Immediate Action Items

1. **Add diagnostic function** to check all conditions
2. **Add production-safe logging** (not behind `__DEV__`)
3. **Check if foreground service notification is visible**
4. **Verify background permission is actually granted** (not just foreground)
5. **Check battery optimization settings**
6. **Verify TaskManager is registered** on the physical device build
