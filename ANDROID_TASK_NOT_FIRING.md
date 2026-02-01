# 🔴 CRITICAL: Android Location Task NOT Firing

**Date**: 2026-01-31  
**Status**: ROOT CAUSE - Task registered but Android won't trigger it

---

## The Real Problem

Your logs show:
```
LOG  📍 [start] Background location task started successfully
```

But the task **NEVER fires**. The `defineTask()` callback at line 94-188 in `location-task.ts` is never being called by Android.

### Evidence:
- Stale heartbeat: 1176 minutes (19.6 hours)
- No console logs: `📍 [task] Background location task fired`
- Task "starts successfully" but never executes

---

## Why Android Won't Fire the Task

Looking at your configuration in `startLocationUpdatesAsync`:

```typescript
{
  accuracy: Location.Accuracy.Balanced,
  distanceInterval: 20,  // Need 20 meters movement
  timeInterval: 60 * 1000,  // OR 60 seconds
  deferredUpdatesInterval: 30 * 1000,
  activityType: Location.ActivityType.Other,
  // ...
}
```

### The Problem: Movement Threshold

Android will ONLY fire the task when:
1. **You move 20+ meters** OR
2. **60 seconds pass AND you've moved SOME distance**

**If you're stationary** (sitting at desk, not moving much):
- Android's motion detection thinks you're not moving
- Task never fires
- No locations collected

### Why "Capture Location Now" Works

The manual button uses `getCurrentPositionAsync()` which:
- Forces GPS to get ONE location immediately
- Doesn't require movement
- Different API than background updates

---

## The Fix: Remove Movement Requirement

Change the configuration to fire based on TIME ONLY:

```typescript
await Location.startLocationUpdatesAsync(
  ANDROID_BACKGROUND_LOCATION_TASK_NAME,
  {
    accuracy: Location.Accuracy.Balanced,
    // REMOVE distanceInterval entirely - let it fire on time alone
    // distanceInterval: 20,  ← REMOVE THIS
    timeInterval: 60 * 1000,  // Fire every 60 seconds regardless of movement
    deferredUpdatesInterval: 30 * 1000,
    deferredUpdatesDistance: 100,
    activityType: Location.ActivityType.Other,
    // ... rest of config
  },
);
```

**This will make the task fire every 60 seconds even if you're sitting still.**

---

## Alternative: Lower Movement Threshold

If you want to keep movement detection but make it more sensitive:

```typescript
distanceInterval: 5,  // Only need 5 meters instead of 20
```

This would fire when you move just 5 meters (walking around room).

---

## Why This Matters for Your Use Case

You're building a calendar app that tracks:
- Where you are (home, office, etc.)
- What you're doing (work, leisure, etc.)

**You NEED location even when stationary!**
- Sitting at home working: Need to know you're home
- Sitting at office: Need to know you're at office
- Not moving doesn't mean "don't track"

---

## Implementation

I'll apply the fix now by removing `distanceInterval`:
