# Data Handling Enhancements Proposal

**Date**: 2025-01-19  
**Purpose**: Comprehensive proposal to extend and improve the calendar actual events data handling logic

---

## Current System Overview

The current data handling system processes:
- **Screen Time**: Usage stats from Android/iOS → classified as "Doom Scroll", "Productive", or "Screen Time"
- **Sleep Detection**: Basic interruption detection with hardcoded "Ended early (Interrupted)" messages
- **Location**: Hourly location blocks with place labels
- **Workouts**: Health data integration for workout detection
- **Verification**: Planned vs actual event verification with confidence scores

---

## Proposed Enhancements

### 1. **Enhanced Sleep Analysis** 🛌

#### Current Limitations
- Hardcoded "Ended early (Interrupted)" message
- No sleep quality metrics
- No wake time detection
- No sleep pattern learning

#### Proposed Improvements

**1.1 Sleep Quality Scoring**
```typescript
interface SleepQualityMetrics {
  interruptions: number;           // Count of wake events during sleep
  totalInterruptionMinutes: number; // Total time awake during sleep period
  deepSleepMinutes: number;         // From HealthKit/Health Connect
  remSleepMinutes: number;          // From HealthKit/Health Connect
  heartRateVariability: number | null; // HRV during sleep
  restingHeartRate: number | null;    // Resting HR during sleep
  qualityScore: number;              // 0-100 composite score
}
```

**1.2 Contextual Sleep Descriptions**
Instead of hardcoded messages, generate dynamic descriptions:
- `"Sleep schedule • Interrupted 3 times (45 min awake)"`
- `"Sleep schedule • Poor quality (HRV: 25ms, below average)"`
- `"Sleep schedule • Woke up 2h early"`
- `"Sleep schedule • Restless (15 pickups detected)"`

**1.3 Sleep Pattern Learning**
- Track average sleep duration per day of week
- Detect deviations from personal baseline
- Flag chronic sleep debt patterns
- Suggest optimal sleep windows based on historical data

**1.4 Wake Time Detection**
- Use HealthKit/Health Connect sleep analysis data
- Detect actual wake time vs planned wake time
- Track "time to get out of bed" (wake time → first significant activity)

---

### 2. **Advanced App Classification** 📱

#### Current Limitations
- Static `DISTRACTION_APPS` list
- Binary classification (distraction vs productive)
- No user customization
- No context-aware classification

#### Proposed Improvements

**2.1 User-Defined App Categories**
```typescript
interface UserAppCategory {
  id: string;
  name: string;              // e.g., "Social Media", "News", "Learning"
  apps: string[];            // Package names or display names
  category: 'distraction' | 'productive' | 'neutral' | 'essential';
  timeOfDayRules?: {         // Context-aware rules
    allowedHours?: number[]; // e.g., [9, 10, 11] = 9am-11am only
    maxMinutesPerDay?: number;
    blockedCategories?: string[]; // Can't use during these event categories
  };
}
```

**2.2 Context-Aware Classification**
- Same app can be "productive" during work hours, "distraction" during sleep
- Time-of-day rules (e.g., social media blocked after 10pm)
- Location-based rules (e.g., work apps only at office)
- Event-context rules (e.g., no distractions during "family" events)

**2.3 App Usage Patterns**
- Track which apps are used together (e.g., Instagram → TikTok → YouTube)
- Detect "doom scroll sessions" (rapid app switching)
- Identify productive app clusters
- Measure app switching frequency (indicator of distraction)

**2.4 App Intensity Scoring**
```typescript
interface AppUsageIntensity {
  appName: string;
  sessionCount: number;
  avgSessionDuration: number;
  totalMinutes: number;
  switchFrequency: number;    // How often user switches away
  timeOfDay: number[];        // Hours when most used
  intensityScore: number;     // 0-100 (100 = very intense usage)
}
```

---

### 3. **Gap Filling Intelligence** 🔍

#### Current Limitations
- Simple "Unknown" blocks for gaps
- No pattern recognition
- No learning from user corrections

#### Proposed Improvements

**3.1 Pattern-Based Gap Filling**
```typescript
interface GapFillingStrategy {
  // Use historical patterns
  historicalPatterns: {
    dayOfWeek: number;        // 0-6
    timeOfDay: number;         // 0-1439 (minutes)
    commonActivity: string;    // Most common activity at this time
    confidence: number;         // 0-1, based on frequency
  }[];
  
  // Use location context
  locationBased: {
    placeLabel: string;
    commonActivities: string[];
    timeRanges: { start: number; end: number }[];
  }[];
  
  // Use adjacent events
  contextBased: {
    beforeEvent: ScheduledEvent | null;
    afterEvent: ScheduledEvent | null;
    inferredActivity: string;
  };
}
```

**3.2 User Feedback Loop**
- When user assigns an "Unknown" block, learn from it
- Store user corrections in `tm.events` with `meta.learned_from: true`
- Use corrections to improve future gap filling
- Track accuracy of suggestions

**3.3 Confidence Scoring for Derived Events**
```typescript
interface DerivedEventConfidence {
  eventId: string;
  confidence: number;          // 0-1
  evidenceSources: {
    type: 'location' | 'screen_time' | 'health' | 'pattern' | 'user_history';
    weight: number;
    details: string;
  }[];
  suggestedCategory: EventCategory;
  alternativeCategories?: Array<{
    category: EventCategory;
    confidence: number;
  }>;
}
```

---

### 4. **Activity Transition Detection** 🔄

#### Current Limitations
- No detection of activity transitions
- No "getting ready" or "winding down" periods
- Events are treated as discrete blocks

#### Proposed Improvements

**4.1 Transition Periods**
```typescript
interface ActivityTransition {
  fromEvent: ScheduledEvent;
  toEvent: ScheduledEvent;
  transitionMinutes: number;
  transitionType: 'smooth' | 'abrupt' | 'delayed' | 'early';
  detectedActivities: string[]; // e.g., ["commute", "prep", "transition"]
}
```

**4.2 Pre/Post Activity Buffers**
- Detect "prep time" before events (e.g., getting ready for work)
- Detect "wind down" after events (e.g., decompressing after work)
- Auto-suggest buffer blocks based on event type and user patterns

**4.3 Commute Detection**
- Use location changes to detect commutes
- Classify commute type (walk, drive, transit) based on duration and distance
- Auto-fill commute blocks between location changes

---

### 5. **Multi-Source Evidence Fusion** 🔗

#### Current Limitations
- Evidence sources processed somewhat independently
- No weighted fusion of conflicting evidence
- Limited cross-validation

#### Proposed Improvements

**5.1 Evidence Fusion Engine**
```typescript
interface EvidenceFusion {
  eventId: string;
  sources: {
    location: LocationEvidence | null;
    screenTime: ScreenTimeEvidence | null;
    health: HealthEvidence | null;
    userHistory: PatternEvidence | null;
  };
  fusedConfidence: number;
  conflicts: Array<{
    source1: string;
    source2: string;
    conflict: string;
    resolution: 'source1_wins' | 'source2_wins' | 'compromise' | 'unresolved';
  }>;
  finalCategory: EventCategory;
  finalDescription: string;
}
```

**5.2 Cross-Validation Rules**
- If location says "home" but screen time shows work apps → flag inconsistency
- If sleep detected but high screen time → mark as "interrupted"
- If workout detected but no location change → verify with heart rate data

**5.3 Temporal Consistency**
- Ensure events don't overlap impossibly (e.g., same person in two places)
- Smooth out rapid location changes (GPS noise)
- Validate screen time sessions against device state

---

### 6. **Behavioral Pattern Recognition** 📊

#### Current Limitations
- No learning from user behavior
- No pattern detection across days
- No predictive capabilities

#### Proposed Improvements

**6.1 Daily Pattern Detection**
```typescript
interface DailyPattern {
  dayOfWeek: number;
  timeSlots: Array<{
    startMinutes: number;
    endMinutes: number;
    commonActivities: Array<{
      activity: string;
      frequency: number;      // 0-1, how often this happens
      avgDuration: number;
    }>;
  }>;
  confidence: number;
}
```

**6.2 Anomaly Detection**
- Flag days that deviate significantly from patterns
- Detect new habits forming (consistent new activity for 7+ days)
- Identify broken routines (missed activity that's usually present)

**6.3 Predictive Suggestions**
- Suggest likely activities for upcoming time slots
- Pre-fill calendar based on patterns
- Warn about potential conflicts (e.g., "You usually sleep at 10pm, but you have an event until 11pm")

---

### 7. **Enhanced Verification & Confidence** ✅

#### Current Limitations
- Binary verification status
- Limited confidence granularity
- No explanation of why verification failed

#### Proposed Improvements

**7.1 Granular Verification Status**
```typescript
type VerificationStatus = 
  | 'verified'           // Strong evidence
  | 'mostly_verified'    // Good evidence, minor gaps
  | 'partially_verified' // Some evidence
  | 'unverified'         // No evidence
  | 'contradicted'        // Evidence contradicts
  | 'distracted'          // User was distracted
  | 'early'              // Started early
  | 'late'               // Started late
  | 'shortened'          // Ended early
  | 'extended';          // Ran over
```

**7.2 Detailed Verification Reports**
```typescript
interface VerificationReport {
  eventId: string;
  status: VerificationStatus;
  confidence: number;
  evidenceBreakdown: {
    location: { matches: boolean; details: string };
    screenTime: { matches: boolean; details: string };
    health: { matches: boolean; details: string };
  };
  discrepancies: Array<{
    type: 'timing' | 'location' | 'activity' | 'duration';
    expected: string;
    actual: string;
    severity: 'minor' | 'moderate' | 'major';
  }>;
  suggestions: string[];
}
```

**7.3 Verification Learning**
- Track which verification rules are most accurate
- Adjust confidence weights based on user corrections
- Learn user-specific patterns (e.g., "this user often starts work 15min early")

---

### 8. **Real-Time Event Updates** ⚡

#### Current Limitations
- Events processed after the fact
- No real-time detection
- No live updates during events

#### Proposed Improvements

**8.1 Live Event Tracking**
- Update events in real-time as evidence comes in
- Show "live" status indicators (e.g., "Currently working" with confidence)
- Detect when events start/end in real-time

**8.2 Proactive Notifications**
- "You planned to sleep at 10pm, but you're still on your phone"
- "You're at the gym, but no workout detected yet"
- "Your meeting was supposed to start 5 minutes ago"

**8.3 Auto-Correction**
- Automatically adjust event times based on real evidence
- Ask user to confirm major changes
- Learn from user confirmations/rejections

---

### 9. **Data Quality & Reliability** 🔧

#### Current Limitations
- No data quality metrics
- No handling of missing/incomplete data
- No data freshness tracking

#### Proposed Improvements

**9.1 Data Quality Scoring**
```typescript
interface DataQualityMetrics {
  source: 'android_usage' | 'ios_screen_time' | 'health_kit' | 'health_connect' | 'location';
  freshness: number;          // Minutes since last update
  completeness: number;       // 0-1, how complete the data is
  reliability: number;        // 0-1, confidence in data accuracy
  gaps: Array<{
    startMinutes: number;
    endMinutes: number;
    reason: string;
  }>;
}
```

**9.2 Missing Data Handling**
- Detect when data sources are unavailable
- Use fallback strategies (e.g., use hourly buckets if sessions unavailable)
- Flag low-confidence derived events
- Show data quality indicators in UI

**9.3 Data Validation**
- Validate timestamps (no future events, no negative durations)
- Check for impossible overlaps
- Detect GPS anomalies (sudden location jumps)
- Flag suspicious patterns (e.g., 24h of continuous screen time)

---

### 10. **User Personalization** 👤

#### Current Limitations
- One-size-fits-all rules
- No user preferences
- No learning from user behavior

#### Proposed Improvements

**10.1 User Preferences**
```typescript
interface UserDataHandlingPreferences {
  // App classification
  customAppCategories: UserAppCategory[];
  
  // Sleep preferences
  preferredSleepWindow: { start: number; end: number };
  sleepQualityThresholds: {
    good: number;      // HRV threshold
    acceptable: number;
  };
  
  // Activity preferences
  defaultGapFilling: 'conservative' | 'aggressive' | 'manual';
  autoSuggestEvents: boolean;
  confidenceThreshold: number; // Minimum confidence to auto-create events
  
  // Notification preferences
  realTimeUpdates: boolean;
  verificationAlerts: boolean;
}
```

**10.2 Adaptive Learning**
- Learn user's typical schedule patterns
- Adapt thresholds based on user's lifestyle
- Personalize app classifications based on actual usage
- Adjust verification rules based on user corrections

---

## Implementation Priority

### Phase 1: Foundation (High Impact, Medium Effort)
1. ✅ Enhanced sleep analysis with quality metrics
2. ✅ Contextual sleep descriptions (replace hardcoded messages)
3. ✅ User-defined app categories
4. ✅ Confidence scoring for derived events

### Phase 2: Intelligence (High Impact, High Effort)
5. ✅ Pattern-based gap filling
6. ✅ Activity transition detection
7. ✅ Multi-source evidence fusion
8. ✅ Behavioral pattern recognition

### Phase 3: Polish (Medium Impact, Medium Effort)
9. ✅ Enhanced verification reports
10. ✅ Real-time event updates
11. ✅ Data quality metrics
12. ✅ User personalization

---

## Technical Considerations

### New Data Structures Needed

1. **User Preferences Table**
   ```sql
   CREATE TABLE tm.user_data_preferences (
     user_id uuid PRIMARY KEY REFERENCES auth.users(id),
     app_categories jsonb,
     sleep_preferences jsonb,
     gap_filling_preferences jsonb,
     updated_at timestamptz DEFAULT now()
   );
   ```

2. **Pattern Learning Table**
   ```sql
   CREATE TABLE tm.activity_patterns (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid REFERENCES auth.users(id),
     day_of_week integer,
     time_slot_start integer,
     time_slot_end integer,
     common_activity text,
     frequency numeric,
     confidence numeric,
     learned_from jsonb,
     created_at timestamptz DEFAULT now()
   );
   ```

3. **Event Confidence Metadata**
   - Extend `tm.events.meta` to include confidence scores
   - Store evidence breakdown in meta
   - Track verification history

### New Services Needed

1. `apps/mobile/src/lib/calendar/sleep-analysis.ts` - Advanced sleep processing
2. `apps/mobile/src/lib/calendar/pattern-recognition.ts` - Pattern detection
3. `apps/mobile/src/lib/calendar/evidence-fusion.ts` - Multi-source fusion
4. `apps/mobile/src/lib/calendar/gap-filling.ts` - Intelligent gap filling
5. `apps/mobile/src/lib/calendar/user-preferences.ts` - User customization

### Performance Considerations

- Pattern recognition should run asynchronously (background jobs)
- Cache pattern data to avoid recomputation
- Batch process evidence fusion for efficiency
- Use database indexes for pattern queries

---

## Success Metrics

1. **Accuracy**: % of derived events that user confirms as correct
2. **Coverage**: % of day covered by derived events (vs "Unknown")
3. **User Satisfaction**: User feedback on suggestions
4. **Performance**: Time to generate derived events
5. **Data Quality**: % of events with high confidence scores

---

## Next Steps

1. Review and prioritize proposals
2. Create detailed technical specs for Phase 1 items
3. Set up database migrations for new tables
4. Implement Phase 1 enhancements incrementally
5. Test with real user data
6. Iterate based on feedback
