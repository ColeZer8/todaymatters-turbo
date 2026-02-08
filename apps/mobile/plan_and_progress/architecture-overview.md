# TodayMatters Architecture Overview

*Last updated: 2026-02-08*

## Project Structure

```
todaymatters-turbo/
├── apps/mobile/              # React Native Expo app (main product)
│   ├── src/
│   │   ├── app/              # Expo Router screens (file-based routing)
│   │   ├── components/       # Atomic Design: atoms → molecules → organisms → templates
│   │   ├── constants/        # Static data (churches, onboarding steps)
│   │   ├── features/         # Feature modules (voice coach)
│   │   ├── hooks/            # Top-level hooks (auth, user-name, voice-coach)
│   │   ├── lib/              # Business logic, services, utilities
│   │   │   ├── calendar/     # Calendar computation (events, verification, patterns)
│   │   │   ├── hooks/        # Domain-specific hooks (use-location-blocks-for-day)
│   │   │   ├── supabase/     # Backend client, auth, services, sync hooks
│   │   │   ├── types/        # Shared TypeScript types
│   │   │   └── utils/        # Pure utility functions
│   │   └── stores/           # Zustand state management
│   └── plan_and_progress/    # Planning docs, progress notes
└── packages/                 # Shared packages (if any)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React Native + Expo (SDK 52+) |
| **Navigation** | Expo Router (file-based) |
| **State** | Zustand (persisted via AsyncStorage) |
| **Backend** | Supabase (PostgreSQL, `tm` schema) + AWS Lambda |
| **Auth** | Supabase Auth + Google OAuth |
| **Background** | expo-task-manager (location tracking, ingestion) |
| **Animations** | react-native-reanimated |
| **Gestures** | react-native-gesture-handler |

## Component Architecture (Atomic Design)

```
Screen (app/*.tsx)
  └── Template (templates/*.tsx)     ← Layout + orchestration
        ├── Organism (organisms/*.tsx)  ← Complex, stateful sections
        │     ├── Molecule (molecules/*.tsx)  ← Composed UI elements
        │     │     └── Atom (atoms/*.tsx)     ← Primitive UI (Button, Icon, Card)
        │     └── ...
        └── ...
```

Screens are thin wrappers that connect stores/services to templates. Templates contain layout logic. Organisms contain complex stateful UI.

## Zustand Stores

| Store | Purpose | Persisted? |
|-------|---------|-----------|
| `useAuthStore` | User session, auth state | No |
| `useEventsStore` | Calendar events (planned + actual), date selection | Yes (AsyncStorage) |
| `useOnboardingStore` | Onboarding state, wake/sleep times | Yes |
| `useRoutineBuilderStore` | Morning/evening routine items | Yes |
| `useIdealDayStore` | Ideal day time allocations | Yes |
| `useGoalsStore` | User goals and tasks | Yes |
| `useInitiativesStore` | Initiatives and milestones | Yes |
| `useReviewTimeStore` | Review time blocks for reflection | No |
| `useAppCategoryOverridesStore` | User overrides for app→category mapping | No |
| `useUserPreferencesStore` | Verification strictness, gap filling, etc. | No |
| `useDemoStore` | Demo mode state (time simulation) | No |
| `useHomeBriefStore` | Daily brief data | No |
| `useGoogleServicesOAuthStore` | Google OAuth tokens | No |
| `useDevFlagsStore` | Feature flags (e.g., `useNewLocationPipeline`) | No |

## Data Pipelines

### ALPHA → BRAVO → CHARLIE Pipeline

This is the core data processing pipeline that transforms raw device signals into user-facing activity blocks.

```
ALPHA (Raw Data Collection)
├── Location samples (iOS/Android background tasks)
├── Screen time data (iOS ScreenTime API / Android UsageStats)
├── HealthKit data (workouts, sleep, steps)
└── Google Calendar events (backend sync)
    ↓
BRAVO (Activity Segmentation)
├── Activity segments (from location + screen time + health)
├── Place inference (14-day geohash clustering)
└── Movement detection (stationary/walking/driving)
    ↓
CHARLIE (Hourly Summaries)
├── Hourly summaries (aggregated per hour)
├── App breakdowns per hour
├── Confidence scores
└── Primary activity classification
    ↓
Display Layer
├── LocationBlock[] (grouped consecutive same-location hours)
├── TimelineEvent[] (for Activity Timeline)
└── ScheduledEvent[] (for Calendar Actual column)
```

**Key services:**
- `fetchHourlySummariesForDate()` — CHARLIE data
- `fetchActivitySegmentsForDate()` — BRAVO data
- `inferPlacesFromHistory()` — 14-day place inference
- `groupIntoLocationBlocks()` — CHARLIE → LocationBlock grouping

### Calendar Pipeline (New — Feature Flagged)

```
useLocationBlocksForDay (hook)
  │  Fetches CHARLIE summaries + location_hourly + place inference + BRAVO segments
  │  Enriches summaries with labels, inference descriptions
  │  Groups into LocationBlock[]
  ↓
locationBlocksToScheduledEvents (converter)
  │  Converts LocationBlock[] → ScheduledEvent[]
  │  Filters overlaps with user actual events
  │  Fills gaps (sleep/unknown)
  ↓
ComprehensiveCalendarTemplate
  │  Renders side-by-side Planned vs Actual columns
  │  Time grid with event cards
  ↓
verifyPlannedAgainstBlocks (simple-verification)
  │  Cross-references planned events against location blocks
  │  Returns verification status per event
```

**Feature flag:** `useDevFlagsStore.useNewLocationPipeline` (default: ON)

When OFF, falls back to legacy `buildActualDisplayEvents()` (3,453 lines).

### Calendar Pipeline (Legacy — Rollback Path)

```
comprehensive-calendar.tsx
  │  Fetches screen time, usage stats, verification evidence
  ↓
buildActualDisplayEvents() (actual-display-events.ts, 3453 lines)
  │  Complex evidence fusion, pattern recognition, gap filling
  │  Handles screen time, health, location, patterns
  ↓
ComprehensiveCalendarTemplate
```

## Navigation Structure

```
/ (index) → Auth check → /home or /signup
├── /home                    ← Main dashboard
├── /comprehensive-calendar  ← Calendar (planned + actual)
├── /activity-timeline       ← Activity timeline view
├── /actual-adjust           ← Adjust actual events
├── /actual-split            ← Split actual events
├── /add-event               ← Add planned/actual event
├── /analytics               ← Analytics dashboard
├── /profile                 ← User profile
├── /settings/               ← Settings screens
│   ├── daily-rhythm
│   ├── ideal-day
│   ├── build-routine
│   ├── coach-persona
│   ├── app-categories
│   └── place-labels
├── /dev/                    ← Dev tools (location, pipeline test, insights)
└── Onboarding flow:
    /name → /your-why → /core-values → /goals → etc.
```

## Background Tasks

| Task | Platform | Purpose |
|------|----------|---------|
| iOS Location | iOS | Background location sampling via `expo-location` |
| Android Location | Android | Background location via `expo-task-manager` |
| Actual Ingestion | Both | Periodic ALPHA→BRAVO→CHARLIE processing |

## Real-Time Updates

The calendar page subscribes to Supabase Realtime channels for:
- `tm.events` — planned/actual event changes
- `tm.screen_time_app_sessions` — new screen time data
- `tm.health_workouts` — new health data
- `tm.location_hourly` — new location data
- `tm.hourly_summaries` — new CHARLIE data (new pipeline only)

Plus a 30-minute polling interval as a fallback.

## Key Type Definitions

- **`ScheduledEvent`** — Calendar event with `startMinutes`, `duration`, `category`, `meta`
- **`LocationBlock`** — Contiguous time at one location (from CHARLIE grouping)
- **`TimelineEvent`** — Activity timeline row (actual, scheduled, comm, meeting)
- **`EnrichedSummary`** — Hourly summary with place inference, segments, labels
- **`CalendarEventMeta`** — Rich metadata (source, kind, evidence, location, etc.)
