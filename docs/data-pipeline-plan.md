# TodayMatters Data Pipeline Architecture Plan

**Date:** February 2, 2026  
**Authors:** Paul (Client), Cole (Developer)  
**Status:** Draft for Review

---

## Executive Summary

Paul proposed a three-layer data pipeline architecture (ALPHA → BRAVO → CHARLIE) to transform raw phone telemetry into meaningful, user-editable activity summaries. This document analyzes the current state, proposes the implementation architecture, and outlines a phased approach.

**Key Goals:**
1. Process raw data into understandable activity blocks
2. Enable hourly review cycles (so users can correct while memory is fresh)
3. Add confidence scoring and feedback loops
4. Reduce noise and overcounting (YouTube open ≠ watching)

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Proposed Architecture](#2-proposed-architecture)
3. [AI vs Algorithm Decision Framework](#3-ai-vs-algorithm-decision-framework)
4. [Database Schema Changes](#4-database-schema-changes)
5. [Implementation Pseudocode](#5-implementation-pseudocode)
6. [Cost Analysis](#6-cost-analysis)
7. [Implementation Phases](#7-implementation-phases)
8. [Open Questions](#8-open-questions)

---

## 1. Current State Analysis

### 1.1 Data Ingestion Flow (Current)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PHONE                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │ Location Service │  │ Screen Time API  │  │   HealthKit/     │       │
│  │  (Background)    │  │  (iOS/Android)   │  │  Health Connect  │       │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘       │
└───────────┼──────────────────────┼──────────────────────┼───────────────┘
            │                      │                      │
            ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  SUPABASE (tm schema)                                                    │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │ tm.location_     │  │ tm.screen_time_  │  │ tm.health_daily_ │       │
│  │    samples       │  │    app_sessions  │  │    metrics       │       │
│  │ (raw GPS points) │  │ (per-app usage)  │  │ (steps, sleep)   │       │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘       │
│           │                     │                     │                  │
│           └─────────────────────┼─────────────────────┘                  │
│                                 ▼                                        │
│                    ┌────────────────────────┐                            │
│                    │  actual-ingestion.ts   │                            │
│                    │  (sessionizeWindow)    │                            │
│                    └────────────┬───────────┘                            │
│                                 ▼                                        │
│                    ┌────────────────────────┐                            │
│                    │      tm.events         │◄── This is where data      │
│                    │   (derived events)     │    becomes user-visible    │
│                    └────────────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Current Tables (ALPHA Layer - Already Exists)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `tm.location_samples` | Raw GPS coordinates | `recorded_at`, `latitude`, `longitude`, `accuracy_m` |
| `tm.screen_time_daily` | Daily screen time totals | `local_date`, `total_seconds`, `pickups` |
| `tm.screen_time_app_sessions` | Per-app usage sessions | `app_id`, `started_at`, `ended_at`, `duration_seconds` |
| `tm.screen_time_app_hourly` | Hourly app breakdown | `hour`, `app_id`, `duration_seconds` |
| `tm.health_daily_metrics` | Daily health aggregates | `steps`, `sleep_asleep_seconds`, `workouts_count` |
| `tm.health_workouts` | Individual workouts | `activity_type`, `duration_seconds`, `started_at` |

### 1.3 Current Processing (What `actual-ingestion.ts` Does)

The current system already performs significant transformation:

1. **Location Segmentation** (`generateLocationSegments`)
   - Groups GPS samples by user-defined places (150m radius)
   - Requires 70% of samples to match a place
   - Detects commutes (movement between places)

2. **Sessionization** (`sessionizeWindow`)
   - Groups events into "session blocks" by place
   - Merges gaps < 5 minutes
   - Absorbs short sessions < 10 minutes

3. **Intent Classification** (`classifyIntent` in `app-categories.ts`)
   - Classifies app usage as: work, social, entertainment, comms, utility
   - Uses hardcoded defaults + user overrides from `tm.user_app_categories`
   - Generates session titles like "Cafe - Work"

4. **Reconciliation** (`event-reconciliation.ts`)
   - Computes insert/update/delete operations
   - Respects locked events (user-edited)
   - Extends trailing edges for continuous sessions

### 1.4 Current Problems

| Problem | Description | Paul's Insight |
|---------|-------------|----------------|
| **Overcounting** | YouTube open for 2h ≠ 2h of watching | Raw data measures "app active", not "engaged" |
| **No Confidence Scores** | Events show as absolute truth | Users can't tell what's uncertain |
| **No Feedback Loop** | User corrections don't improve future | System doesn't learn from edits |
| **Noisy Raw Data** | Location jitter, GPS drift | Creates artificial place changes |
| **Daily Chunks Too Big** | Hard to remember what you did at 9am by 10pm | Hourly review while memory fresh |
| **Labels Too Generic** | "Home - Work" vs "Home - Deep Focus on Project X" | Need richer descriptions |

---

## 2. Proposed Architecture

### 2.1 Three-Layer Pipeline (Paul's Vision)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ALPHA LAYER (Raw)                                                       │
│  ━━━━━━━━━━━━━━━━━                                                       │
│  What: Unprocessed phone telemetry                                       │
│  Where: tm.location_samples, tm.screen_time_*, tm.health_*              │
│  Mutability: Append-only (never modify raw data)                        │
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐             │
│  │ Location       │  │ Screen Time    │  │ Health         │             │
│  │ 15-min samples │  │ App sessions   │  │ Workout/Sleep  │             │
│  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘             │
└──────────┼───────────────────┼───────────────────┼──────────────────────┘
           │                   │                   │
           ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BRAVO LAYER (Enriched)                                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━                                                  │
│  What: Normalized, labeled, categorized data                            │
│  Where: tm.activity_segments (NEW), tm.enriched_sessions (NEW)          │
│  Mutability: Derived from ALPHA, recomputable                           │
│                                                                          │
│  Processing (ALGORITHMIC):                                               │
│  ├── Reverse geocode locations → "Starbucks on Main St"                 │
│  ├── Classify apps → work/social/entertainment                          │
│  ├── Detect activity types → commute, meeting, deep work                │
│  ├── Apply user place labels → "Office", "Home", "Gym"                  │
│  ├── Merge micro-gaps → continuous sessions                             │
│  └── Calculate engagement scores (active time vs idle)                  │
│                                                                          │
│  Output:                                                                 │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ {                                                               │     │
│  │   segment_id: "seg_abc123",                                     │     │
│  │   start: "2026-02-01T09:00:00Z",                               │     │
│  │   end: "2026-02-01T10:30:00Z",                                 │     │
│  │   place: { id: "place_xyz", label: "Office", type: "work" },   │     │
│  │   apps: [                                                       │     │
│  │     { id: "com.slack", minutes: 45, category: "comms" },       │     │
│  │     { id: "com.figma", minutes: 30, category: "work" }         │     │
│  │   ],                                                            │     │
│  │   inferred_activity: "collaborative_work",                      │     │
│  │   confidence: 0.85,                                             │     │
│  │   evidence: { location_samples: 12, screen_sessions: 8 }       │     │
│  │ }                                                               │     │
│  └────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  CHARLIE LAYER (Summarized)                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━                                               │
│  What: User-facing hourly summaries, editable                           │
│  Where: tm.hourly_summaries (NEW), tm.events (user-facing)              │
│  Mutability: User can edit, edits are "locked"                          │
│                                                                          │
│  Processing (AI-ASSISTED):                                               │
│  ├── Generate natural language descriptions                             │
│  ├── Detect anomalies ("Unusual: 3h social media on workday")           │
│  ├── Suggest missing activities from context                            │
│  └── Polish rough labels into readable summaries                        │
│                                                                          │
│  Output (Hourly Summary Card):                                           │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ 9:00 AM - 10:00 AM                              Confidence: 85% │     │
│  │ ─────────────────────────────────────────────────────────────── │     │
│  │ 📍 Office (1h)                                                  │     │
│  │                                                                  │     │
│  │ Summary: "Deep work on design project. Heavy Figma and Slack    │     │
│  │          collaboration with team."                               │     │
│  │                                                                  │     │
│  │ Apps: Figma (30m) • Slack (20m) • Chrome (10m)                  │     │
│  │                                                                  │     │
│  │ [✓ Accurate] [✗ Needs Correction] [Edit]                        │     │
│  └────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Layer Responsibilities

| Layer | Responsibility | Mutable? | AI Required? | Recomputable? |
|-------|---------------|----------|--------------|---------------|
| **ALPHA** | Store raw telemetry | Append-only | No | N/A (source of truth) |
| **BRAVO** | Enrich & normalize | Derived | No (algorithmic) | Yes, from ALPHA |
| **CHARLIE** | Summarize & present | User-editable | Optional | No (user edits preserved) |

### 2.3 Hourly Processing Cycle

```
Every Hour (triggered by app open or background task):

1. Check: Is the previous hour (H-1) unlocked?
   ├── Yes → Process it
   └── No → Skip (already processed or user locked it)

2. Pull ALPHA data for H-1:
   ├── Location samples for that hour
   ├── Screen time sessions for that hour
   └── Health data for that hour

3. Generate BRAVO segments:
   ├── Group by place (location clustering)
   ├── Attach app categories
   ├── Calculate confidence scores
   └── Store in tm.activity_segments

4. Generate CHARLIE summary:
   ├── Aggregate BRAVO segments
   ├── (Optional) AI polish the description
   ├── Create tm.hourly_summaries record
   └── Mark hour as processed

5. Surface to user:
   ├── Show notification: "How was your 9-10am?"
   └── Allow immediate correction while memory fresh
```

---

## 3. AI vs Algorithm Decision Framework

> **Cole's Principle:** "Use algorithm as workhorse, AI for polish"

### 3.1 What Can Be Done Algorithmically (BRAVO Layer)

| Task | Algorithm | Why AI Not Needed |
|------|-----------|-------------------|
| **Location Clustering** | Haversine distance + DBSCAN | Math problem, not language |
| **Place Matching** | Radius overlap with user places | Simple geometry |
| **App Categorization** | Static mappings + user overrides | Lookup table |
| **Commute Detection** | Speed + distance + time thresholds | Rule-based |
| **Session Merging** | Gap detection < 5 min | Simple time logic |
| **Confidence Scoring** | Sample density + match ratios | Statistical formula |
| **Intent Classification** | Weighted app category scoring | Already implemented |
| **Engagement Detection** | Session length + switch frequency | Behavioral heuristics |

### 3.2 Where AI Adds Value (CHARLIE Layer)

| Task | Why AI Helps | Alternative |
|------|--------------|-------------|
| **Natural Language Summary** | "Figma 30m + Slack 20m" → "Design collaboration" | Templates ("X at Y doing Z") |
| **Anomaly Detection** | Context-aware ("3h social is unusual for you on Tuesdays") | Statistical z-score |
| **Missing Activity Inference** | "Gap + gym location = probably workout" | Rule-based inference |
| **Contextual Naming** | "Meeting with John" from calendar + location | Calendar API integration |

### 3.3 Recommended AI Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TIERED AI USAGE                                                         │
│  ━━━━━━━━━━━━━━━━                                                        │
│                                                                          │
│  TIER 0: No AI (Default)                                                │
│  ├── Works for 80% of cases                                             │
│  ├── Template-based summaries: "{Place} - {Primary Activity}"           │
│  ├── Example: "Office - Work (Slack, Figma)"                           │
│  └── Cost: $0                                                           │
│                                                                          │
│  TIER 1: On-Demand AI (User-Triggered)                                  │
│  ├── User taps "Generate Better Summary"                                │
│  ├── AI polishes the template into prose                                │
│  ├── Example: "Collaborative design session with heavy Slack usage"    │
│  └── Cost: ~$0.002 per request (gpt-4o-mini)                           │
│                                                                          │
│  TIER 2: Daily AI Digest (Optional Premium Feature)                     │
│  ├── End-of-day AI summary: "Your Tuesday: 6h focused work, 2h social"│
│  ├── Weekly pattern analysis                                            │
│  └── Cost: ~$0.02/user/day (batched)                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema Changes

### 4.1 New Tables (BRAVO Layer)

```sql
-- =============================================================================
-- tm.activity_segments - Enriched activity blocks (BRAVO layer)
-- =============================================================================
CREATE TABLE tm.activity_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Time bounds
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  hour_bucket TIMESTAMPTZ NOT NULL, -- Floor to hour for indexing
  
  -- Location enrichment
  place_id UUID REFERENCES tm.user_places(id),
  place_label TEXT, -- Denormalized for display
  place_category TEXT, -- work, home, gym, etc.
  location_lat NUMERIC(10, 7),
  location_lng NUMERIC(10, 7),
  
  -- Activity inference
  inferred_activity TEXT, -- deep_work, meeting, commute, social, etc.
  activity_confidence NUMERIC(3, 2), -- 0.00 to 1.00
  
  -- App usage breakdown (denormalized)
  top_apps JSONB DEFAULT '[]', -- [{app_id, display_name, category, seconds}]
  total_screen_seconds INTEGER DEFAULT 0,
  
  -- Evidence tracking
  evidence JSONB DEFAULT '{}', -- {location_samples: 12, screen_sessions: 5, ...}
  
  -- Source linkage
  source_ids TEXT[], -- ALPHA layer record IDs used
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_activity_segments_user_hour 
  ON tm.activity_segments(user_id, hour_bucket DESC);
CREATE INDEX idx_activity_segments_place 
  ON tm.activity_segments(user_id, place_id);

-- RLS
ALTER TABLE tm.activity_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_segments_own" ON tm.activity_segments
  FOR ALL USING (auth.uid() = user_id);
```

### 4.2 New Tables (CHARLIE Layer)

```sql
-- =============================================================================
-- tm.hourly_summaries - User-facing hourly summaries (CHARLIE layer)
-- =============================================================================
CREATE TABLE tm.hourly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Time
  hour_start TIMESTAMPTZ NOT NULL, -- e.g., 2026-02-01T09:00:00Z
  local_date DATE NOT NULL, -- For easy querying by day
  hour_of_day SMALLINT NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day < 24),
  
  -- Summary content
  title TEXT NOT NULL, -- "Office - Deep Work"
  description TEXT, -- AI-polished or template-generated
  
  -- Aggregated data
  primary_place_id UUID REFERENCES tm.user_places(id),
  primary_place_label TEXT,
  primary_activity TEXT,
  
  app_breakdown JSONB DEFAULT '[]', -- [{app_id, display_name, category, minutes}]
  total_screen_minutes INTEGER DEFAULT 0,
  
  -- Quality indicators
  confidence_score NUMERIC(3, 2), -- 0.00 to 1.00
  evidence_strength TEXT, -- low, medium, high (based on data coverage)
  
  -- User feedback
  user_feedback TEXT, -- 'accurate', 'inaccurate', null
  user_edits JSONB, -- Track what user changed: {original_title, edited_title, ...}
  locked_at TIMESTAMPTZ, -- When user confirmed/edited (becomes immutable)
  
  -- AI tracking
  ai_generated BOOLEAN DEFAULT false,
  ai_model TEXT, -- Which model was used (if any)
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT hourly_summaries_unique UNIQUE (user_id, hour_start)
);

-- Indexes
CREATE INDEX idx_hourly_summaries_user_date 
  ON tm.hourly_summaries(user_id, local_date DESC);
CREATE INDEX idx_hourly_summaries_unlocked 
  ON tm.hourly_summaries(user_id, hour_start DESC) 
  WHERE locked_at IS NULL;

-- RLS
ALTER TABLE tm.hourly_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hourly_summaries_own" ON tm.hourly_summaries
  FOR ALL USING (auth.uid() = user_id);
```

### 4.3 Feedback Learning Table

```sql
-- =============================================================================
-- tm.activity_feedback - Learn from user corrections
-- =============================================================================
CREATE TABLE tm.activity_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- What was corrected
  hourly_summary_id UUID REFERENCES tm.hourly_summaries(id),
  segment_id UUID REFERENCES tm.activity_segments(id),
  
  -- Original vs corrected
  original_activity TEXT,
  corrected_activity TEXT,
  original_place_label TEXT,
  corrected_place_label TEXT,
  original_title TEXT,
  corrected_title TEXT,
  
  -- Context (for learning)
  context_data JSONB, -- Apps used, time of day, day of week, etc.
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for learning queries
CREATE INDEX idx_activity_feedback_user_context 
  ON tm.activity_feedback(user_id, created_at DESC);

-- RLS
ALTER TABLE tm.activity_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_feedback_own" ON tm.activity_feedback
  FOR ALL USING (auth.uid() = user_id);
```

---

## 5. Implementation Pseudocode

### 5.1 BRAVO Layer: Activity Segment Generation

```typescript
/**
 * Generate BRAVO layer activity segments from ALPHA layer data.
 * This is PURELY ALGORITHMIC - no AI calls.
 */
async function generateActivitySegments(
  userId: string,
  hourStart: Date,
  hourEnd: Date
): Promise<ActivitySegment[]> {
  // 1. Fetch ALPHA layer data for this hour
  const locationSamples = await fetchLocationSamples(userId, hourStart, hourEnd);
  const screenSessions = await fetchScreenTimeSessions(userId, hourStart, hourEnd);
  const healthData = await fetchHealthData(userId, hourStart, hourEnd);
  const userPlaces = await fetchUserPlaces(userId);
  const userAppCategories = await fetchUserAppCategories(userId);
  
  // 2. Generate location segments (existing algorithm)
  const locationSegments = generateLocationSegments(
    locationSamples,
    userPlaces,
    hourStart,
    hourEnd
  );
  
  // 3. Merge adjacent segments (existing algorithm)
  const mergedSegments = mergeAdjacentSegments(locationSegments);
  
  // 4. Enrich each segment with screen time data
  const enrichedSegments: ActivitySegment[] = [];
  
  for (const segment of mergedSegments) {
    // Find screen sessions overlapping this segment
    const overlappingSessions = screenSessions.filter(session =>
      sessionOverlapsSegment(session, segment)
    );
    
    // Calculate app breakdown
    const appBreakdown = calculateAppBreakdown(overlappingSessions, userAppCategories);
    
    // Infer activity type from app usage + location
    const inferredActivity = inferActivityType({
      placeCategory: segment.placeCategory,
      appBreakdown,
      timeOfDay: getHourOfDay(segment.start),
      dayOfWeek: getDayOfWeek(segment.start),
      healthData, // Include workout detection
    });
    
    // Calculate confidence score
    const confidence = calculateConfidenceScore({
      locationSampleCount: segment.sampleCount,
      screenSessionCount: overlappingSessions.length,
      placeMachRatio: segment.matchRatio,
      appCategoryConsensus: calculateCategoryConsensus(appBreakdown),
    });
    
    enrichedSegments.push({
      id: generateUuid(),
      userId,
      startedAt: segment.start,
      endedAt: segment.end,
      hourBucket: hourStart,
      placeId: segment.placeId,
      placeLabel: segment.placeLabel,
      placeCategory: segment.meta.kind === 'commute' ? 'commute' : userPlaces.find(p => p.id === segment.placeId)?.category,
      locationLat: segment.latitude,
      locationLng: segment.longitude,
      inferredActivity,
      activityConfidence: confidence,
      topApps: appBreakdown.slice(0, 5), // Top 5 apps
      totalScreenSeconds: appBreakdown.reduce((sum, app) => sum + app.seconds, 0),
      evidence: {
        locationSamples: segment.sampleCount,
        screenSessions: overlappingSessions.length,
        hasHealthData: healthData !== null,
      },
      sourceIds: [
        ...segment.sourceIds,
        ...overlappingSessions.map(s => s.id),
      ],
    });
  }
  
  return enrichedSegments;
}

/**
 * Infer activity type from enriched data.
 * Pure algorithmic logic - no AI.
 */
function inferActivityType(context: ActivityContext): string {
  const { placeCategory, appBreakdown, timeOfDay, dayOfWeek, healthData } = context;
  
  // Priority 1: Health data trumps everything
  if (healthData?.hasWorkout) {
    return 'workout';
  }
  if (healthData?.isSleeping) {
    return 'sleep';
  }
  
  // Priority 2: Commute detection
  if (placeCategory === 'commute') {
    return 'commute';
  }
  
  // Priority 3: Infer from app usage
  const dominantCategory = getDominantAppCategory(appBreakdown);
  const screenMinutes = getTotalMinutes(appBreakdown);
  
  // High screen time with work apps = deep work
  if (dominantCategory === 'work' && screenMinutes > 30) {
    // Check for comms mixed in
    const commsPercent = getPercentage(appBreakdown, 'comms');
    if (commsPercent > 40) {
      return 'collaborative_work'; // Meetings, pair programming
    }
    return 'deep_work';
  }
  
  // High comms with low work = meetings/calls
  if (dominantCategory === 'comms' && screenMinutes > 20) {
    return 'meeting';
  }
  
  // Entertainment during typical work hours = distracted
  if (dominantCategory === 'entertainment') {
    if (isWorkHours(timeOfDay, dayOfWeek)) {
      return 'distracted_time';
    }
    return 'leisure';
  }
  
  // Social media
  if (dominantCategory === 'social') {
    if (screenMinutes > 30) {
      return 'extended_social';
    }
    return 'social_break';
  }
  
  // Low screen time at known places
  if (screenMinutes < 5) {
    if (placeCategory === 'home') {
      return 'personal_time';
    }
    if (placeCategory === 'work') {
      return 'away_from_desk';
    }
    return 'offline_activity';
  }
  
  // Fallback
  return 'mixed_activity';
}

/**
 * Calculate confidence score (0-1) for an activity segment.
 */
function calculateConfidenceScore(evidence: Evidence): number {
  let score = 0;
  
  // Location confidence (0-0.4)
  if (evidence.locationSampleCount >= 10) {
    score += 0.4 * Math.min(1, evidence.placeMachRatio);
  } else if (evidence.locationSampleCount >= 5) {
    score += 0.2 * Math.min(1, evidence.placeMachRatio);
  }
  
  // Screen time confidence (0-0.3)
  if (evidence.screenSessionCount >= 5) {
    score += 0.3;
  } else if (evidence.screenSessionCount >= 2) {
    score += 0.15;
  }
  
  // Category consensus (0-0.3)
  score += 0.3 * evidence.appCategoryConsensus;
  
  return Math.min(1, Math.max(0, score));
}
```

### 5.2 CHARLIE Layer: Hourly Summary Generation

```typescript
/**
 * Generate CHARLIE layer hourly summary from BRAVO layer segments.
 * Uses OPTIONAL AI for polish, but works without it.
 */
async function generateHourlySummary(
  userId: string,
  hourStart: Date,
  options: { useAI?: boolean } = {}
): Promise<HourlySummary> {
  const hourEnd = addHours(hourStart, 1);
  
  // 1. Check if already locked (user confirmed/edited)
  const existing = await fetchHourlySummary(userId, hourStart);
  if (existing?.lockedAt) {
    return existing; // Don't overwrite user edits
  }
  
  // 2. Fetch BRAVO layer segments for this hour
  const segments = await fetchActivitySegments(userId, hourStart, hourEnd);
  
  if (segments.length === 0) {
    return createEmptySummary(userId, hourStart);
  }
  
  // 3. Aggregate segments
  const aggregated = aggregateSegments(segments);
  
  // 4. Generate title (template-based)
  const title = generateTitleFromTemplate(aggregated);
  // Example: "Office - Deep Work" or "Home - Leisure"
  
  // 5. Generate description
  let description: string;
  let aiGenerated = false;
  
  if (options.useAI) {
    // AI polish (optional, premium feature)
    description = await generateAIDescription(aggregated);
    aiGenerated = true;
  } else {
    // Template-based description (free, always works)
    description = generateTemplateDescription(aggregated);
    // Example: "30 min Figma, 20 min Slack at Office"
  }
  
  // 6. Calculate aggregate confidence
  const confidence = calculateAggregateConfidence(segments);
  
  // 7. Determine evidence strength
  const evidenceStrength = categorizeEvidenceStrength(segments);
  
  return {
    id: existing?.id ?? generateUuid(),
    userId,
    hourStart,
    localDate: toLocalDate(hourStart),
    hourOfDay: getHourOfDay(hourStart),
    title,
    description,
    primaryPlaceId: aggregated.dominantPlaceId,
    primaryPlaceLabel: aggregated.dominantPlaceLabel,
    primaryActivity: aggregated.dominantActivity,
    appBreakdown: aggregated.appBreakdown,
    totalScreenMinutes: Math.round(aggregated.totalScreenSeconds / 60),
    confidenceScore: confidence,
    evidenceStrength,
    aiGenerated,
    aiModel: aiGenerated ? 'gpt-4o-mini' : null,
    userFeedback: null,
    lockedAt: null,
  };
}

/**
 * Template-based title generation (no AI needed).
 */
function generateTitleFromTemplate(aggregated: AggregatedData): string {
  const place = aggregated.dominantPlaceLabel ?? 'Unknown Location';
  const activity = humanizeActivity(aggregated.dominantActivity);
  
  if (aggregated.dominantActivity === 'commute') {
    return `Commute to ${aggregated.destinationPlaceLabel ?? 'destination'}`;
  }
  
  return `${place} - ${activity}`;
}

/**
 * Template-based description (no AI needed).
 */
function generateTemplateDescription(aggregated: AggregatedData): string {
  const parts: string[] = [];
  
  // Time at place
  if (aggregated.dominantPlaceLabel) {
    const minutes = Math.round(aggregated.durationSeconds / 60);
    parts.push(`${minutes} min at ${aggregated.dominantPlaceLabel}`);
  }
  
  // Top apps
  const topApps = aggregated.appBreakdown
    .slice(0, 3)
    .filter(app => app.minutes >= 5)
    .map(app => `${app.displayName} (${app.minutes}m)`)
    .join(', ');
  
  if (topApps) {
    parts.push(topApps);
  }
  
  return parts.join('. ') || 'No activity data';
}

/**
 * AI-powered description generation (optional premium feature).
 */
async function generateAIDescription(aggregated: AggregatedData): Promise<string> {
  const prompt = `
Summarize this hour of activity in 1-2 sentences. Be concise and natural.

Location: ${aggregated.dominantPlaceLabel ?? 'Unknown'}
Activity Type: ${aggregated.dominantActivity}
Duration: ${Math.round(aggregated.durationSeconds / 60)} minutes
Top Apps: ${aggregated.appBreakdown.slice(0, 5).map(a => `${a.displayName}: ${a.minutes}m`).join(', ')}

Write a brief, human summary:`;

  const response = await callAI({
    model: 'gpt-4o-mini', // Cheap and fast
    maxTokens: 100,
    prompt,
  });
  
  return response.trim();
}
```

### 5.3 Feedback Loop Implementation

```typescript
/**
 * Record user feedback and correction for learning.
 */
async function recordUserFeedback(
  userId: string,
  summaryId: string,
  feedback: UserFeedback
): Promise<void> {
  const summary = await fetchHourlySummary(userId, summaryId);
  if (!summary) return;
  
  // 1. Update the summary with user feedback
  await updateHourlySummary(summaryId, {
    userFeedback: feedback.accurate ? 'accurate' : 'inaccurate',
    lockedAt: new Date(), // Lock after feedback
  });
  
  // 2. If corrections were made, store for learning
  if (feedback.corrections) {
    await insertActivityFeedback({
      userId,
      hourlySummaryId: summaryId,
      originalActivity: summary.primaryActivity,
      correctedActivity: feedback.corrections.activity ?? summary.primaryActivity,
      originalPlaceLabel: summary.primaryPlaceLabel,
      correctedPlaceLabel: feedback.corrections.placeLabel ?? summary.primaryPlaceLabel,
      originalTitle: summary.title,
      correctedTitle: feedback.corrections.title ?? summary.title,
      contextData: {
        hourOfDay: summary.hourOfDay,
        dayOfWeek: getDayOfWeek(summary.hourStart),
        topApps: summary.appBreakdown.slice(0, 3).map(a => a.appId),
        confidence: summary.confidenceScore,
      },
    });
    
    // 3. Apply correction to the summary
    await updateHourlySummary(summaryId, {
      title: feedback.corrections.title ?? summary.title,
      primaryActivity: feedback.corrections.activity ?? summary.primaryActivity,
      primaryPlaceLabel: feedback.corrections.placeLabel ?? summary.primaryPlaceLabel,
      userEdits: feedback.corrections,
    });
  }
}

/**
 * Learn from past corrections to improve future inferences.
 * Called periodically or before generating new summaries.
 */
async function getLearnedPatterns(userId: string): Promise<LearnedPatterns> {
  const recentFeedback = await fetchActivityFeedback(userId, {
    limit: 100,
    orderBy: 'created_at DESC',
  });
  
  // Build pattern map from corrections
  const patterns: LearnedPatterns = {
    placeActivityOverrides: new Map(),
    timeActivityOverrides: new Map(),
    appActivityOverrides: new Map(),
  };
  
  for (const fb of recentFeedback) {
    if (fb.correctedActivity && fb.correctedActivity !== fb.originalActivity) {
      // Learn: When at [place] with [apps], activity is [corrected]
      const context = fb.contextData as FeedbackContext;
      const key = `${fb.correctedPlaceLabel ?? 'unknown'}:${context.topApps.join(',')}`;
      patterns.appActivityOverrides.set(key, fb.correctedActivity);
    }
  }
  
  return patterns;
}
```

---

## 6. Cost Analysis

### 6.1 Storage Costs

| Table | Records/User/Day | Bytes/Record | Monthly (1K users) |
|-------|------------------|--------------|-------------------|
| `tm.location_samples` | 96 (15-min intervals) | ~200 | 576 MB |
| `tm.activity_segments` | 24-48 | ~500 | 360 MB |
| `tm.hourly_summaries` | 24 | ~800 | 576 MB |
| `tm.activity_feedback` | 1-5 | ~300 | 45 MB |

**Total Storage:** ~1.5 GB/month for 1,000 users ≈ **$0.75/month** (Supabase pricing)

### 6.2 AI Costs (If Used)

| Scenario | Tokens/Request | Cost/Request | Monthly (1K users) |
|----------|---------------|--------------|-------------------|
| No AI (templates only) | 0 | $0 | $0 |
| On-demand polish (10% of hours) | ~200 | $0.002 | ~$144 |
| Daily digest (1/user/day) | ~500 | $0.005 | ~$150 |
| Full AI summaries (all hours) | ~200 × 24 | $0.048/day | ~$1,440 |

**Recommendation:** Start with templates (Tier 0), add on-demand AI (Tier 1) as premium feature.

### 6.3 Compute Costs

- Hourly processing: ~100ms per user per hour = 2.4 seconds/user/day
- 1,000 users = 40 minutes of compute daily = negligible
- Background functions: Supabase Edge Functions free tier covers this

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal:** Create BRAVO layer infrastructure without changing user experience

- [ ] Create `tm.activity_segments` table (migration)
- [ ] Create `tm.hourly_summaries` table (migration)
- [ ] Create `tm.activity_feedback` table (migration)
- [ ] Implement `generateActivitySegments()` function
- [ ] Implement `aggregateSegments()` function
- [ ] Add hourly bucket processing to existing ingestion

**No user-facing changes. Runs in parallel with existing system.**

### Phase 2: CHARLIE Layer (Week 3-4)

**Goal:** Generate hourly summaries visible to users

- [ ] Implement `generateHourlySummary()` function
- [ ] Implement template-based title/description generation
- [ ] Add confidence score display to UI
- [ ] Create hourly summary card component
- [ ] Add "Was this accurate?" feedback buttons
- [ ] Wire up feedback storage

**Soft launch:** Show to internal testers first.

### Phase 3: Feedback Loop (Week 5-6)

**Goal:** Learn from corrections

- [ ] Implement `recordUserFeedback()` function
- [ ] Implement `getLearnedPatterns()` function
- [ ] Apply learned patterns to segment generation
- [ ] Add user override capability for activities
- [ ] Build correction history view

### Phase 4: AI Enhancement (Week 7-8, Optional)

**Goal:** Add optional AI polish

- [ ] Implement `generateAIDescription()` function
- [ ] Add "Generate Better Summary" button
- [ ] Create daily digest feature (premium)
- [ ] Implement cost tracking per user
- [ ] Add AI toggle in settings

---

## 8. Open Questions

### For Paul

1. **Review Cadence:** Should users be prompted hourly, or batch prompts (e.g., morning review of yesterday)?
2. **Confidence Threshold:** At what confidence (%) should we auto-lock summaries vs. ask for feedback?
3. **Overcounting Solution:** Should we cap app "active time" at 80% of session duration to account for idle?
4. **Place Learning:** Should the system automatically suggest new places from unlabeled locations?

### Technical Decisions

1. **Edge Functions vs Client Processing:** Process on Supabase Edge Functions or in the mobile app?
2. **Real-time vs Batch:** Process each hour immediately or batch at end of day?
3. **Existing Events Migration:** Backfill `tm.hourly_summaries` from existing `tm.events`?

### RALPH Integration

RALPH (`.ralph/`) is an autonomous coding agent used for implementing user stories. It could be used to:
- Implement the migration files
- Build the processing functions
- Create the UI components

However, RALPH is not a data processing framework—it's a development automation tool.

---

## Appendix A: Current File Inventory

| File | Purpose | Lines |
|------|---------|-------|
| `services/actual-ingestion.ts` | Session generation | 2,700+ |
| `services/event-reconciliation.ts` | DB sync logic | 1,900+ |
| `services/app-categories.ts` | App classification | 590+ |
| `services/evidence-data.ts` | ALPHA layer queries | 1,000+ |
| `services/screen-time-sync.ts` | Raw data ingestion | 400+ |
| `services/location-samples.ts` | GPS data handling | 150+ |
| `services/user-places.ts` | Place management | 380+ |

---

## Appendix B: Sample Data Flow

```
Raw Location Sample (ALPHA):
{
  "recorded_at": "2026-02-01T09:15:00Z",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "accuracy_m": 12
}

Activity Segment (BRAVO):
{
  "id": "seg_abc123",
  "started_at": "2026-02-01T09:00:00Z",
  "ended_at": "2026-02-01T10:00:00Z",
  "place_label": "Office",
  "inferred_activity": "deep_work",
  "activity_confidence": 0.85,
  "top_apps": [
    {"app_id": "com.figma", "minutes": 35, "category": "work"},
    {"app_id": "com.slack", "minutes": 15, "category": "comms"}
  ],
  "evidence": {"location_samples": 12, "screen_sessions": 8}
}

Hourly Summary (CHARLIE):
{
  "hour_start": "2026-02-01T09:00:00Z",
  "title": "Office - Deep Work",
  "description": "Focused design work with occasional Slack check-ins",
  "confidence_score": 0.85,
  "evidence_strength": "high",
  "user_feedback": null,
  "locked_at": null
}
```

---

*Document generated by subagent for review. Do not implement until Cole approves.*
