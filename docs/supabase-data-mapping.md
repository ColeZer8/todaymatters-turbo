# Supabase Data Mapping - Complete Integration Plan

## Data Mapping Table

| App Data | Supabase Table | Field/Strategy | Status |
|----------|---------------|----------------|--------|
| **Profile** | | | |
| Profile Name | `profiles` | `full_name` | ✅ Ready |
| Daily Rhythm Wake | `profiles` | `ideal_work_day` | ✅ Ready |
| Daily Rhythm Sleep | `profiles` | `ideal_sabbath` | ✅ Ready |
| Your Why/Purpose | `profiles` | `mission` | ✅ Ready |
| Role | `profiles` | `role` | ⚠️ Needs column |
| **Preferences** | | | |
| Joy Selections | `profiles` | `meta.joy_selections` (JSONB) | ✅ Can do now |
| Drain Selections | `profiles` | `meta.drain_selections` (JSONB) | ✅ Can do now |
| Focus Style | `profiles` | `meta.focus_style` (JSONB) | ✅ Can do now |
| Coach Persona | `profiles` | `meta.coach_persona` (JSONB) | ✅ Can do now |
| Morning Mindset | `profiles` | `meta.morning_mindset` (JSONB) | ✅ Can do now |
| **Goals & Initiatives** | | | |
| Goals | `events` | `type='goal'`, `meta.category='goal'` | ✅ Ready |
| Initiatives | `events` | `type='goal'`, `meta.category='initiative'` | ✅ Ready |
| **Core Values** | | | |
| Core Values | `profile_values` | `value_label`, `rank` | ✅ Already connected |
| **Ideal Day** | | | |
| Ideal Day Hours | `ideal_day` | Various columns | ⚠️ Needs schema clarification |
| **Routine** | | | |
| Routine Items | `events` | `type='task'`, `meta` | ⚠️ Needs decision |

## Strategy: Use profiles.meta JSONB for Preferences

Since there's no dedicated table for preferences, we'll store them in `profiles.meta` JSONB:

```json
{
  "joy_selections": ["Reading", "Exercise", "Music"],
  "drain_selections": ["Long meetings", "Traffic"],
  "focus_style": "flow",
  "coach_persona": "strategist",
  "morning_mindset": "slow"
}
```

This allows us to:
- ✅ Store all preferences without new tables
- ✅ Query easily (JSONB is queryable)
- ✅ Extend easily in the future
- ✅ Works with existing schema




