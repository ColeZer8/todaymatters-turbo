# Android Transistor QA Lane (Samsung-first)

Use this for same-day Android dogfood before/while rolling out Transistor-backed location.

## 1) Samsung-first test matrix

> Run on **Samsung first** (One UI 6+). Optional control run on 1 Pixel after Samsung passes.

| Scenario | Window | Device/App state | What to do | Expected |
|---|---:|---|---|---|
| Foreground walk | 20–30 min | Screen on, app foreground | Walk outdoors continuously | Frequent samples, stable route shape |
| Background drive | 25–40 min | App background, screen mostly off | Drive A→B, stop 5+ min | Commute segment appears + destination dwell |
| Idle desk/home | 60–90 min | App background, mixed lock/unlock | Stay mostly stationary | Lower-frequency but non-zero samples |
| Short driving interrupt | 10–20 min | App background | Quick errand drive | Commute detected without timeline fragmentation |
| Overnight | 6–9 hr | App background, phone idle/charging | Leave phone overnight | Morning still anchored; no multi-hour data blackouts |

### Samsung setup (required before test)
1. Android Settings → App battery usage → TodayMatters → **Unrestricted**.
2. Location permission: **Allow all the time** + Precise ON.
3. Ensure app is not in Samsung sleeping/deep sleeping apps.

---

## 2) Acceptance thresholds (pass/fail)

### A) Gap rate + sample continuity
- **Moving windows (walk/drive):**
  - sample_count **>= 8**
  - p90 gap **<= 8 min**
  - max gap **<= 20 min**
  - gap_rate (`gap > 15m`) **<= 5%**
- **Idle window (60–90m):**
  - sample_count **>= 3**
  - max gap **<= 35 min**
- **Overnight (6–9h):**
  - sample_count **>= 6**
  - no gap **> 120 min**
  - gap_rate (`gap > 30m`) **<= 10%**

### B) Battery impact
- During 8h idle/overnight run: battery drain attributable to test should be roughly **<= 8% total** (target <=1%/hr).
- No repeated foreground-service/task restarts in `/dev/background-location`.

### C) Activity accuracy
- In drive windows, `inferred_activity='commute'` covers **>= 70%** of drive minutes.
- In idle windows, false commute minutes are **<= 10%** of idle window.

---

## 3) Same-day dogfood runbook (client device)

1. **Prep (5 min)**
   - Sign in on target Android device.
   - Open `/permissions` and confirm background location granted.
   - Open `/dev/location` and note User ID.
   - Record battery % at start.

2. **Run matrix in order**
   - Foreground walk → Background drive → Idle desk → Short driving interrupt → Overnight.
   - Note start/end times for each route window.

3. **In-app verification after each window**
   - `/dev/background-location`:
     - Tracking active
     - Native pending / JS pending not stuck
     - Last task fired updates
     - Run **Flush to Supabase**
   - `/dev/pipeline-test`:
     - Location Blocks shape sane (not fragmented into tiny blocks)
     - Commute appears for driving windows
   - `/settings/place-labels` (if labels look wrong): verify Home/Work labels.

4. **End-of-day checks**
   - Record battery % at end.
   - Run SQL pack below.

---

## 4) SQL verification pack

Replace placeholders: `<USER_ID>`, `<WALK_START>`, `<WALK_END>`, etc.

### Query 1 — Route continuity + gap rate

```sql
with route_windows as (
  select 'walk_fg'::text as route, '<WALK_START>'::timestamptz start_at, '<WALK_END>'::timestamptz end_at
  union all select 'drive_bg', '<DRIVE_START>'::timestamptz, '<DRIVE_END>'::timestamptz
  union all select 'idle', '<IDLE_START>'::timestamptz, '<IDLE_END>'::timestamptz
  union all select 'drive_short', '<DRIVE2_START>'::timestamptz, '<DRIVE2_END>'::timestamptz
  union all select 'overnight', '<SLEEP_START>'::timestamptz, '<SLEEP_END>'::timestamptz
),
samples as (
  select rw.route, ls.recorded_at
  from route_windows rw
  join tm.location_samples ls
    on ls.user_id = '<USER_ID>'::uuid
   and ls.recorded_at >= rw.start_at
   and ls.recorded_at < rw.end_at
),
gaps as (
  select
    route,
    extract(epoch from (recorded_at - lag(recorded_at) over (partition by route order by recorded_at))) / 60.0 as gap_min
  from samples
)
select
  route,
  count(*) + 1 as sample_count,
  round(percentile_cont(0.9) within group (order by gap_min)::numeric, 2) as p90_gap_min,
  round(max(gap_min)::numeric, 2) as max_gap_min,
  round(100.0 * count(*) filter (where gap_min > 15) / nullif(count(*),0), 1) as gap_rate_gt_15m_pct,
  round(100.0 * count(*) filter (where gap_min > 30) / nullif(count(*),0), 1) as gap_rate_gt_30m_pct
from gaps
where gap_min is not null
group by route
order by route;
```

### Query 2 — Activity accuracy (drive recall + idle false positives)

```sql
with windows as (
  select 'drive'::text as kind, '<DRIVE_START>'::timestamptz start_at, '<DRIVE_END>'::timestamptz end_at
  union all select 'drive', '<DRIVE2_START>'::timestamptz, '<DRIVE2_END>'::timestamptz
  union all select 'idle', '<IDLE_START>'::timestamptz, '<IDLE_END>'::timestamptz
),
seg as (
  select
    w.kind,
    greatest(s.started_at, w.start_at) as overlap_start,
    least(s.ended_at, w.end_at) as overlap_end,
    s.inferred_activity
  from windows w
  join tm.activity_segments s
    on s.user_id = '<USER_ID>'::uuid
   and s.started_at < w.end_at
   and s.ended_at > w.start_at
),
mins as (
  select
    kind,
    inferred_activity,
    extract(epoch from (overlap_end - overlap_start)) / 60.0 as overlap_min
  from seg
  where overlap_end > overlap_start
)
select
  kind,
  round(sum(overlap_min),1) as total_window_overlap_min,
  round(sum(overlap_min) filter (where inferred_activity = 'commute'),1) as commute_overlap_min,
  round(100.0 * sum(overlap_min) filter (where inferred_activity = 'commute') / nullif(sum(overlap_min),0),1) as commute_pct
from mins
group by kind
order by kind;
```

### Query 3 — Day sanity snapshot

```sql
select 'location_samples' as metric, count(*)::bigint as value
from tm.location_samples
where user_id = '<USER_ID>'::uuid
  and recorded_at::date = '<DAY>'::date
union all
select 'location_hourly_rows', count(*)
from tm.location_hourly
where user_id = '<USER_ID>'::uuid
  and hour_start::date = '<DAY>'::date
union all
select 'activity_segments', count(*)
from tm.activity_segments
where user_id = '<USER_ID>'::uuid
  and started_at::date = '<DAY>'::date;
```

---

## 5) Rollback procedure (feature-flag fallback)

Trigger rollback if any **hard fail** occurs on Samsung (overnight blackout, commute missing, severe battery drain, or repeated task death).

1. **Disable Android Transistor flag** for dogfood cohort (or set rollout to 0%).
2. **Revert provider to legacy Android location path** (keep iOS rollout unchanged).
3. Ask dogfood users to relaunch app and verify `/dev/background-location` is healthy.
4. Re-run a shortened validation set: foreground walk + background drive (same day).
5. Confirm SQL Query 1 continuity improves before re-attempting rollout.

Rollback is complete only after continuity metrics return within thresholds on Samsung.
