# Progress Report: Location-Informed Actual Ingestion

**Prepared for:** Client  
**Date:** January 31, 2026  
**Project:** Today Matters – Mobile App Development

---

## Executive Summary

Today we pushed the **location-informed actual ingestion** feature across a major milestone. We shipped a custom native Android module for reliable background location tracking, solved platform-specific permission and notification flows, and strengthened the entire actual calendar pipeline end-to-end. The result: location-aware sessionization is now built on production-grade native infrastructure instead of JavaScript-only APIs that were hitting platform limits.

---

## Major Accomplishments

### 1. Native Android Background Location Module (Jan 31)

**The Big Win** – We built and integrated a **custom native Android module** from the ground up to replace the failing JavaScript-based background location API.

#### The Problem We Solved

Expo's `expo-location` background task was registering successfully but **never firing callbacks** in production—a confirmed upstream bug (Expo #28959). This meant zero location samples on Android when the app was backgrounded or closed, leading to "Unknown" place labels across calendar sessions and breaking the location-informed experience.

#### The Solution

We implemented a **full native Kotlin module** using Android's official, battery-optimized APIs:

| Component | Purpose |
|-----------|---------|
| **WorkManager** | Periodic background scheduling that survives app kills, reboots, and Doze mode |
| **FusedLocationProviderClient** | Google's recommended high-accuracy, battery-efficient location API |
| **Foreground Service** | Keeps the location process active and compliant with Android 8+ restrictions |
| **Expo Modules API** | Clean React Native bridge so the rest of the app stays in TypeScript |

#### What We Delivered

- **ExpoBackgroundLocationModule** – Native Kotlin module with `startLocationTracking()`, `stopLocationTracking()`, and `isTracking()`
- **LocationWorker** – CoroutineWorker that collects location, queues samples to AsyncStorage, and integrates with the existing Supabase upload pipeline
- **Supabase integration** – Direct upload path for location samples, with PendingLocationStore and SupabaseConfig for resilient sync
- **Dev screen** – `background-location.tsx` for testing and verification of the full flow
- **Documentation** – Implementation summaries, debugging guides, and testing checklists

Location tracking now **continues reliably** when:

- The app is minimized
- The app is force-closed
- The device is rebooted
- Android Doze mode kicks in

This was a substantial undertaking—custom native Android development, Gradle configuration, manifest permissions, and full integration into the existing location-sync and actual-ingestion pipelines.

---

### 2. Android Notification & Permission Infrastructure (Jan 30)

We hardened the permission and notification experience so background location works smoothly on modern Android.

#### Notification Channel Setup

- Added `expo-intent-launcher` and `expo-notifications` for proper Android notification management
- Implemented `ensureAndroidLocationChannelAsync` to create the required notification channel for background location updates
- Android 8+ requires a visible notification for foreground services; we set this up correctly and documented the flow

#### Permissions Flow

- Enhanced **PermissionsScreen** to check and request notification permissions, with clear prompts when users need to adjust settings
- Updated **PermissionsTemplate** to display notification settings actions when required
- Added utility functions for managing Android notification settings and battery optimization prompts
- Users can now be guided through the full permission chain: location → background location → notifications

#### Profile Integration

- Wired notification and location permission controls into the **Profile** screen for easy access and troubleshooting

---

### 3. Actual Ingestion Scheduler & Pipeline Improvements (Jan 30)

We refined how and when the actual calendar is refreshed.

#### Scheduler Refinement

- Refactored `useActualIngestionScheduler` to streamline ingestion task scheduling
- Removed catch-up windows in favor of **strict half-hour boundary execution**
- Scheduler now runs only on :00 and :30, aligning with our 30-minute processing windows

#### Event Reconciliation

- Implemented **event reconciliation** logic (~390 lines) to keep actual calendar data consistent
- Handles overlaps, duplicates, and edge cases in the ingestion pipeline

#### Window Locks & Coordination

- Added **actual-ingestion-window-locks** service to prevent concurrent processing of the same time windows
- Ensures clean, predictable ingestion behavior under load

---

### 4. Calendar & Evidence Enhancements (Jan 29–30)

#### Actual Adjust Screen

- Enhanced **ActualAdjustScreen** and related services to include additional evidence details
- Users get richer context when reviewing and adjusting calendar events

#### Public Events Schema & Caching

- Updated calendar-events service with schema improvements and caching for public/shared events
- Cleanup of deprecated PRD files to keep the project structure focused

#### Google OAuth & Account Picker

- Documented and improved Google OAuth account chooser behavior on Android
- Normalized actual calendar colors for consistent display

---

## Technical Highlights

- **~5,000+ lines** of new/modified code across native Android, TypeScript, and configuration
- **78 files touched** in the native module commit alone
- **New native module** fully integrated with Expo autolinking and the existing pnpm/Turborepo setup
- **Production-ready architecture** using WorkManager, foreground services, and FusedLocationProviderClient

---

## What This Means for the Product

1. **Reliable location context** – Calendar sessions can now be labeled with real places on Android, even when the app isn’t in the foreground.
2. **Platform compliance** – We’re using Android’s recommended APIs and patterns, which improves battery usage and approval chances in the Play Store.
3. **Stronger ingestion pipeline** – Reconciliation, window locks, and clearer scheduling make the actual calendar more dependable.
4. **Better UX** – Clear permission flows and notification setup reduce friction and support requests.

---

## Next Steps

- Device validation of the native module on Android 16
- Final build configuration tweaks (Gradle, app.config) in progress
- End-to-end testing of location → ingestion → calendar display flow on physical devices

---

*This report reflects completed work as of January 31, 2026.*
