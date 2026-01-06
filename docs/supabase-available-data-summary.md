# Supabase Available Data Summary

**Date**: 2025-01-XX  
**Purpose**: Identify what data exists in Supabase that can be pulled into the app

## 📊 Available Data Tables

Based on the schema migrations and service implementations, here's what data structures exist:

### ✅ **1. User Profile Data** (`tm.profiles`)
**Service**: `services/profiles.ts` ✅ Built  
**Status**: Ready to fetch

Available fields:
- `full_name` - User's name
- `role` - User role from setup questions
- `mission` - Purpose/"Your Why" selection
- `ideal_work_day` - Wake time (time format)
- `ideal_sabbath` - Sleep time (time format)
- `birthday` - Date of birth
- `timezone` - User timezone
- `meta` (JSONB) - Stores preferences:
  - `joy_selections` - Array of joy items
  - `drain_selections` - Array of drain items
  - `focus_style` - Focus style preference
  - `coach_persona` - Coach persona selection
  - `morning_mindset` - Morning mindset preference
  - `permissions` - Calendar, health, location, etc.

**Usage**: Already integrated in onboarding screens

---

### ✅ **2. Profile Values** (`tm.profile_values`)
**Service**: `services/profile-values.ts` ✅ Built  
**Status**: Ready to fetch

Available fields:
- `value_label` - Core value name (e.g., "Family", "Integrity")
- `rank` - Priority/order (1, 2, 3...)

**Usage**: Already integrated in profile screen

---

### ✅ **3. Goals & Initiatives** (`tm.events` with `type='goal'`)
**Service**: `services/events.ts` ✅ Built  
**Status**: Ready to fetch

Available fields:
- `title` - Goal/initiative name
- `type` - 'goal' (used for both goals and initiatives)
- `meta.category` - 'goal' or 'initiative'
- `description` - Optional description
- `created_at`, `updated_at` - Timestamps

**Usage**: Already integrated in goals screen

---

### ✅ **4. Planned Calendar Events** (`tm.events` with `type='calendar_planned'`)
**Service**: `services/calendar-events.ts` ✅ Built  
**Status**: Ready to fetch (user-created events, NOT Google Calendar)

Available fields:
- `title` - Event title
- `description` - Event description
- `scheduled_start` - Start timestamp
- `scheduled_end` - End timestamp
- `meta.category` - Event category (work, personal, etc.)
- `meta.isBig3` - Whether it's a "Big 3" event

**Note**: ⚠️ These are **user-created planned events**, NOT synced from Google Calendar

**Usage**: Already integrated in comprehensive calendar screen

---

### ✅ **5. Routines** (`tm.routines` + `tm.routine_items`)
**Service**: `services/routines.ts` ✅ Built  
**Status**: Ready to fetch

Available fields:
- `kind` - Routine type (e.g., 'morning')
- `wake_time` - Wake time for routine
- Routine items:
  - `title` - Item name
  - `minutes` - Duration
  - `icon_key` - Icon identifier
  - `position` - Order in routine

**Usage**: Already integrated in routine builder

---

### ✅ **6. Ideal Day Templates** (`tm.ideal_day_templates` + `tm.ideal_day_categories`)
**Service**: `services/ideal-day.ts` ✅ Built  
**Status**: Ready to fetch

Available fields:
- `day_type` - 'weekdays', 'saturday', 'sunday'
- Categories:
  - `category_key` - Category identifier
  - `name` - Category name
  - `minutes` - Allocated minutes
  - `max_minutes` - Maximum minutes
  - `color` - Category color
  - `icon_name` - Icon identifier
  - `position` - Display order

**Usage**: Already integrated in ideal day screen

---

### ⚠️ **7. Health Metrics** (`tm.health_daily_metrics`, `tm.health_workouts`)
**Service**: ❌ Not built yet  
**Status**: Tables exist, but no service layer

Available data structures:
- **Daily Metrics**:
  - `local_date` - Date of metrics
  - `steps` - Step count
  - `active_energy_kcal` - Active calories
  - `distance_meters` - Distance traveled
  - `sleep_asleep_seconds` - Sleep duration
  - `heart_rate_avg_bpm` - Average heart rate
  - `resting_heart_rate_avg_bpm` - Resting heart rate
  - `hrv_sdnn_seconds` - HRV measurement
  - `workouts_count` - Number of workouts
  - `exercise_minutes` - Exercise duration
  - `stand_hours` - Standing hours

- **Workouts**:
  - `started_at`, `ended_at` - Workout timestamps
  - `duration_seconds` - Workout duration
  - `activity_type` - Type of workout
  - `total_energy_kcal` - Calories burned
  - `distance_meters` - Distance
  - `avg_heart_rate_bpm` - Average heart rate
  - `max_heart_rate_bpm` - Max heart rate

**Note**: Tables exist with RLS policies, but no service functions built to fetch this data

---

### ⚠️ **8. Screen Time Data** (`tm.screen_time_daily`, `tm.screen_time_app_daily`, etc.)
**Service**: ❌ Not built yet  
**Status**: Tables exist, but no service layer

Available data structures:
- **Daily Screen Time**:
  - `local_date` - Date
  - `total_seconds` - Total screen time
  - `pickups` - Number of pickups
  - `notifications` - Number of notifications

- **App-Level Screen Time**:
  - `app_id` - App identifier
  - `display_name` - App name
  - `duration_seconds` - Time spent in app
  - `pickups` - Number of pickups
  - `notifications` - Notifications from app

- **Hourly Breakdown** (`tm.screen_time_app_hourly`):
  - Hour-by-hour usage per app

- **Session Breakdown** (`tm.screen_time_app_sessions`):
  - Individual usage sessions with start/end times

**Note**: Tables exist with RLS policies, but no service functions built to fetch this data

---

### ✅ **9. Links** (`tm.links`)
**Service**: `services/links.ts` ✅ Built  
**Status**: Ready to fetch

Available fields:
- Polymorphic links between objects (events, contacts, goals, tasks, etc.)
- `link_kind` - Type of relationship
- `obj1_type`, `obj1_id` - First object
- `obj2_type`, `obj2_id` - Second object

---

## 🔍 What About Google Calendar?

### ❌ **Google Calendar Integration: NOT IMPLEMENTED**

**Current State**:
- The app has **user-created planned events** stored in `tm.events` with `type='calendar_planned'`
- These are events the user creates in the app, NOT synced from Google Calendar
- The database structure *could* support Google Calendar events, but there's no integration

**What Would Be Needed**:
1. Google Calendar API integration
2. OAuth flow for Google Calendar access
3. Sync service to fetch events from Google Calendar API
4. Store events in `tm.events` with appropriate `type` and `meta.source='google'`
5. Periodic sync to keep events up to date

**Database Structure**: The `tm.events` table has fields that could support this:
- `external_id` - Could store Google Calendar event ID
- `source_provider` - Could identify 'google_calendar'
- `scheduled_start`, `scheduled_end` - Already support calendar events
- `meta` (JSONB) - Could store Google Calendar metadata

---

## 📋 Summary: What Can Be Pulled Into App Right Now

### ✅ **Already Integrated & Working**:
1. ✅ Profile data (name, role, mission, times, preferences)
2. ✅ Core values
3. ✅ Goals & initiatives
4. ✅ User-created planned calendar events
5. ✅ Routines
6. ✅ Ideal day templates
7. ✅ Links between objects

### ⚠️ **Tables Exist But No Services Built**:
1. ⚠️ Health metrics (`tm.health_daily_metrics`, `tm.health_workouts`)
   - **Need**: Service layer to fetch this data
   - **Tables**: Ready with RLS policies
   - **Data**: Would need to be synced from HealthKit/Health Connect first

2. ⚠️ Screen time data (`tm.screen_time_*` tables)
   - **Need**: Service layer to fetch this data
   - **Tables**: Ready with RLS policies
   - **Data**: Would need to be synced from iOS Screen Time API first

### ❌ **Not Available**:
1. ❌ Google Calendar events (no integration exists)
2. ❌ External calendar sync (only user-created events)
3. ❌ Email data (tables might exist in `public` schema, but not in `tm` schema)

---

## 🚀 Recommendations

### Immediate Next Steps (If Data Exists):
1. **Check if health/screen time data exists**: Query the tables to see if any data has been synced
2. **Build service layers**: Create services for health and screen time data if data exists
3. **Verify data existence**: Run test queries to see what data is actually in the database

### For Google Calendar Integration:
1. Research Google Calendar API for React Native/Expo
2. Set up OAuth flow
3. Create sync service
4. Store events in existing `tm.events` table
5. Handle periodic sync

### Quick Test Queries:
You could run these queries in Supabase SQL Editor to check for data:

```sql
-- Check if profile data exists
SELECT COUNT(*) FROM tm.profiles;

-- Check if events exist
SELECT type, COUNT(*) FROM tm.events GROUP BY type;

-- Check if health data exists
SELECT COUNT(*), MIN(local_date), MAX(local_date) FROM tm.health_daily_metrics;

-- Check if screen time data exists
SELECT COUNT(*), MIN(local_date), MAX(local_date) FROM tm.screen_time_daily;
```

---

## 📝 Notes

- All tables use the `tm` schema (not `public`)
- All queries must use `.schema('tm')` in Supabase client
- RLS policies are in place - users can only see their own data
- Services use TypeScript types from `database.types.ts`

