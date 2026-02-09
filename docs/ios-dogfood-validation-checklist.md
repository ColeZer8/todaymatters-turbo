# iOS Dogfood Validation Checklist (Same-Day)

Use this to validate iOS location quality in one evening.

## Goal
Quickly verify that iOS data is good enough for real user timelines:
- sample continuity
- trip segmentation
- place resolution

---

## 0) Prep (5 min)

1. On device, sign in to the target account.
2. Open **`/permissions`** and ensure location is granted.
3. Open **`/dev/location`** and note your **User ID** (shown on screen).
4. In Supabase SQL editor, set:

```sql
-- Replace values before running queries
-- Use local timezone for route windows (America/Chicago)
```

---

## 1) Real-world routes (one evening)

Track these 4 routes in order. Keep it simple.

### Route A — Walk (20–30 min)
- Walk outside (steady movement), then stop 5+ min at destination.
- Expected:
  - frequent samples while moving
  - at least one stationary segment at destination

### Route B — Drive (15–35 min)
- Drive from Place 1 to Place 2, with a real stop at end (5+ min).
- Expected:
  - commute/movement segment detected
  - separate destination segment after arrival

### Route C — Idle desk (60–90 min)
- Stay mostly in one place (desk/home office), normal phone use.
- Expected:
  - low-frequency but non-zero samples
  - one stable place over most of the period

### Route D — Overnight background (sleep window)
- Lock phone, leave app in background overnight.
- Expected:
  - overnight samples exist
  - morning timeline still anchored to home/sleep location

---

## 2) Pass/fail thresholds (iOS)

Use these thresholds for **same-day dogfood** (not final production SLAs).

### A) Sample continuity
- **Walk/Drive window**
  - total samples: **>= 6**
  - p90 sample gap: **<= 10 min**
  - max gap: **<= 20 min**
- **Idle desk (60–90 min)**
  - total samples: **>= 2**
  - max gap: **<= 45 min**
- **Overnight (6–9 hr)**
  - total samples: **>= 4**
  - no gap > **3 hr**

### B) Trip segmentation
- Walk/drive should produce at least:
  - **1 movement/commute segment** (`inferred_activity = 'commute'`) for Route B
  - destination dwell segment of **>= 5 min**
- Segments should not fragment excessively:
  - for each route window, total segments ideally **<= 6**

### C) Place resolution
From `tm.location_hourly` in route windows:
- rows with `place_label` or `google_place_name`: **>= 70%**
- unlabeled rows (both null): **<= 30%**
- for home/desk/known place windows: user-defined `place_label` should dominate

---

## 3) App screens to verify quality (exact)

### Screen 1: `/dev/location` (Location Activity)
Use for fast device sanity checks:
- **Today Samples Logged** increases
- **Local queue / Supabase** both non-zero after refresh/flush
- Tap **Refresh samples**
- Tap **Flush to Supabase**
- Optional: tap **Lookup places** to fill place names

### Screen 2: `/dev/pipeline-test`
- View mode: **Location Blocks** → check segmentation shape
- View mode: **Places** → check place naming / inferred places
- Use date picker to inspect today + overnight day

### Screen 3: `/settings/place-labels`
- Confirm Home/Work/Desk labels exist and radius looks sane
- Fix mislabeled or missing key places before re-checking

### Screen 4: `/permissions`
- Re-check location permission state if data is sparse

---

## 4) SQL verification pack (copy/paste)

> Replace placeholder values (`<USER_ID>`, `<DAY>`, `<WALK_START>`, etc.) before running. Use ISO timestamps, e.g. `2026-02-09 17:30:00-06`.

### Query 1 — Route continuity (counts + gap stats)

```sql
with params as (
  select '<USER_ID>'::uuid as user_id
),
route_windows as (
  -- Replace all timestamps with your real route windows
  select 'walk'::text as route, '<WALK_START>'::timestamptz as start_at, '<WALK_END>'::timestamptz as end_at
  union all
  select 'drive', '<DRIVE_START>'::timestamptz, '<DRIVE_END>'::timestamptz
  union all
  select 'idle_desk', '<IDLE_START>'::timestamptz, '<IDLE_END>'::timestamptz
  union all
  select 'overnight', '<SLEEP_START>'::timestamptz, '<SLEEP_END>'::timestamptz
),
samples as (
  select rw.route, ls.recorded_at
  from route_windows rw
  join params p on true
  join tm.location_samples ls
    on ls.user_id = p.user_id
   and ls.recorded_at >= rw.start_at
   and ls.recorded_at < rw.end_at
),
gaps as (
  select
    route,
    recorded_at,
    extract(epoch from (recorded_at - lag(recorded_at) over (partition by route order by recorded_at))) / 60.0 as gap_min
  from samples
)
select
  route,
  count(*) as sample_count,
  round(avg(gap_min)::numeric, 2) as avg_gap_min,
  round(percentile_cont(0.9) within group (order by gap_min)::numeric, 2) as p90_gap_min,
  round(max(gap_min)::numeric, 2) as max_gap_min
from gaps
group by route
order by route;
```

### Query 2 — Segmentation quality per route window

```sql
with params as (
  select '<USER_ID>'::uuid as user_id
),
route_windows as (
  select 'walk'::text as route, '<WALK_START>'::timestamptz as start_at, '<WALK_END>'::timestamptz as end_at
  union all
  select 'drive', '<DRIVE_START>'::timestamptz, '<DRIVE_END>'::timestamptz
  union all
  select 'idle_desk', '<IDLE_START>'::timestamptz, '<IDLE_END>'::timestamptz
  union all
  select 'overnight', '<SLEEP_START>'::timestamptz, '<SLEEP_END>'::timestamptz
)
select
  rw.route,
  count(*) as segment_count,
  count(*) filter (where s.inferred_activity = 'commute') as commute_segments,
  round(sum(extract(epoch from (s.ended_at - s.started_at))) / 60.0, 1) as total_segment_minutes,
  round(avg(extract(epoch from (s.ended_at - s.started_at))) / 60.0, 1) as avg_segment_minutes
from route_windows rw
join params p on true
left join tm.activity_segments s
  on s.user_id = p.user_id
 and s.started_at < rw.end_at
 and s.ended_at > rw.start_at
group by rw.route
order by rw.route;
```

### Query 3 — Place resolution coverage (hourly)

```sql
with params as (
  select '<USER_ID>'::uuid as user_id
),
route_windows as (
  select 'walk'::text as route, '<WALK_START>'::timestamptz as start_at, '<WALK_END>'::timestamptz as end_at
  union all
  select 'drive', '<DRIVE_START>'::timestamptz, '<DRIVE_END>'::timestamptz
  union all
  select 'idle_desk', '<IDLE_START>'::timestamptz, '<IDLE_END>'::timestamptz
  union all
  select 'overnight', '<SLEEP_START>'::timestamptz, '<SLEEP_END>'::timestamptz
)
select
  rw.route,
  count(*) as hourly_rows,
  count(*) filter (where lh.place_label is not null or lh.google_place_name is not null) as resolved_rows,
  round(
    100.0 * count(*) filter (where lh.place_label is not null or lh.google_place_name is not null)
    / nullif(count(*), 0),
    1
  ) as resolved_pct,
  count(*) filter (where lh.place_label is null and lh.google_place_name is null) as unresolved_rows
from route_windows rw
join params p on true
left join tm.location_hourly lh
  on lh.user_id = p.user_id
 and lh.hour_start >= rw.start_at
 and lh.hour_start < rw.end_at
group by rw.route
order by rw.route;
```

### Query 4 — Day-level sanity snapshot

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
  and started_at::date = '<DAY>'::date
union all
select 'commute_segments', count(*)
from tm.activity_segments
where user_id = '<USER_ID>'::uuid
  and started_at::date = '<DAY>'::date
  and inferred_activity = 'commute';
```

---

## 5) Quick troubleshooting (iOS permissions)

### If Location = “While Using” (not Always)
Symptoms:
- good samples only when app foregrounded
- sparse/none overnight

Fix:
1. iOS Settings → **Privacy & Security → Location Services → TodayMatters**
2. Set to **Always**
3. Keep **Precise Location ON** if possible
4. Re-open app → `/dev/location` → Refresh + Flush

### If Precise Location = OFF
Symptoms:
- place jitter / wrong place labels
- more “unknown” or nearby area labels

Fix:
1. Same location settings screen
2. Toggle **Precise Location ON**
3. Re-test walk or drive route

### If Background App Refresh = OFF
Symptoms:
- sparse background updates
- delayed sync after long lock periods

Fix:
1. iOS Settings → **General → Background App Refresh**
2. Ensure global BAR is ON and TodayMatters allowed
3. Keep Low Power Mode OFF during test session

## If still sparse after all above
- Confirm device-level Location Services are ON
- Open `/dev/location`, verify samples increment locally
- Tap **Flush to Supabase**
- Verify in SQL Query 4 that `location_samples` count increases

---

## 6) Done criteria (ship/no-ship for dogfood)

Pass tonight if:
- All 4 routes executed
- Route thresholds mostly pass (allow 1 soft miss)
- Drive route shows commute segmentation
- Place resolution is >=70% on 3/4 routes
- No hard permission blocker remains
