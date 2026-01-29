# Location-Informed Actual Ingestion — Simulation & Plan

**Scope:** This document captures (1) a 2‑hour simulation with *location ingestion in place*, (2) how the app should present/categorize results, and (3) concrete changes needed to get the system working as intended. It is grounded in the **current ingestion logic** (screen‑time evidence + reconciliation + gap fill), then extends it **conceptually** with location evidence.

> **No code changes in this doc.** This is a blueprint + simulation of expected outcomes.

---

## 1) Quick recap of current ingestion (what exists now)

- Evidence source: `tm.screen_time_app_sessions` only.
- Runs on the **previous 30‑minute window**.
- Sessions are **clipped** to window boundaries.
- Sessions < **60s** ignored; clipped segments < **30s** ignored.
- Adjacent same‑app segments within **60s** are merged.
- Reconciliation rules:
  - **Protected** sources (`user`, `actual_adjust`) are never overwritten.
  - **Replaceable** sources (`derived`, `evidence`, `ingestion`, `system`) can be replaced.
- Gaps ≥ **60s** are filled with **Unknown** blocks.

---

## 2) Add location ingestion (conceptual design)

**Goal:** Replace Unknown gaps with location‑aware “place blocks,” and provide an offline context when no screen evidence exists.

**Proposed evidence sources (already in DB):**
- `tm.location_samples`
- `tm.location_hourly`
- `tm.user_places`

**Proposed inference:**
- If a time range has **no screen evidence** but **consistent location**, mark as **"At Office" / "At Home" / "At Cafe"**.
- If location changes along a path, classify as **"Commute"** (or "Travel") with `category: mobility`.
- Where location isn’t confident, keep **Unknown**.

---

## 3) 2‑hour simulation with location ingestion in place

### 3.1 Human‑level activity (09:00–11:00)
- 09:00–09:08: Walking to cafe
- 09:08–09:18: Ordering coffee, short texting
- 09:18–09:40: Laptop work at cafe
- 09:40–09:50: Walking back to office
- 09:50–10:20: Focused work at desk
- 10:20–10:30: Short break, checked social
- 10:30–10:50: Meeting in office
- 10:50–11:00: Email catch‑up

### 3.2 Location evidence (what location tables would imply)

**Derived place timeline (conceptual):**
- 09:00–09:40: **Cafe** (place id: P_CAFE)
- 09:40–09:50: **Commute/Travel** (moving between P_CAFE → P_OFFICE)
- 09:50–11:00: **Office** (place id: P_OFFICE)

> These place blocks would be inferred from `location_hourly` or aggregated `location_samples`, plus `user_places` labeling.

### 3.3 Screen‑time evidence (same as previous example)

| session_id | started_at | ended_at | duration_seconds | app_id | display_name |
|---|---|---|---:|---|---|
| s1 | 09:09:00 | 09:14:00 | 300 | com.apple.imessage | Messages |
| s2 | 09:20:00 | 09:28:00 | 480 | com.google.chrome | Chrome |
| s3 | 09:29:00 | 09:34:00 | 300 | com.google.docs | Google Docs |
| s4 | 09:52:00 | 10:12:00 | 1200 | com.slack | Slack |
| s5 | 10:13:00 | 10:18:00 | 300 | com.google.docs | Google Docs |
| s6 | 10:21:00 | 10:26:00 | 300 | com.twitter.android | X |
| s7 | 10:33:00 | 10:47:00 | 840 | com.google.meet | Google Meet |
| s8 | 10:52:00 | 10:59:00 | 420 | com.google.gmail | Gmail |

### 3.4 Window‑by‑window result (with location inference)

#### Window A: 09:00–09:30
**Screen segments:** Messages (09:09–09:14), Chrome (09:20–09:28), Docs (09:29–09:30)

**Location evidence:** Cafe

**Output (Actual):**
- 09:09–09:14 — Messages (screen_time)
- 09:20–09:28 — Chrome (screen_time)
- 09:29–09:30 — Docs (screen_time)
- 09:00–09:09 — **At Cafe** (location)
- 09:14–09:20 — **At Cafe** (location)
- 09:28–09:29 — **At Cafe** (location)

#### Window B: 09:30–10:00
**Screen segments:** Docs (09:30–09:34), Slack (09:52–10:00)

**Location evidence:** Cafe until 09:40, Commute 09:40–09:50, Office 09:50–10:00

**Output (Actual):**
- 09:30–09:34 — Docs (screen_time)
- 09:34–09:40 — **At Cafe** (location)
- 09:40–09:50 — **Commute** (location)
- 09:50–10:00 — Slack (screen_time)

#### Window C: 10:00–10:30
**Screen segments:** Slack (10:00–10:12), Docs (10:13–10:18), X (10:21–10:26)

**Location evidence:** Office

**Output (Actual):**
- 10:00–10:12 — Slack (screen_time)
- 10:12–10:13 — **At Office** (location)
- 10:13–10:18 — Docs (screen_time)
- 10:18–10:21 — **At Office** (location)
- 10:21–10:26 — X (screen_time)
- 10:26–10:30 — **At Office** (location)

#### Window D: 10:30–11:00
**Screen segments:** Meet (10:33–10:47), Gmail (10:52–10:59)

**Location evidence:** Office

**Output (Actual):**
- 10:30–10:33 — **At Office** (location)
- 10:33–10:47 — Meet (screen_time)
- 10:47–10:52 — **At Office** (location)
- 10:52–10:59 — Gmail (screen_time)
- 10:59–11:00 — **At Office** (location)

### 3.5 Sessionized view (collapsed blocks)
**What the user sees by default:**
- **09:00–09:40 — Cafe — Work**
  - Summary: Chrome (8m), Docs (5m), Messages (5m)
- **09:40–09:50 — Commute**
- **09:50–11:00 — Office — Work**
  - Summary: Slack (20m), Docs (5m), Meet (14m), Gmail (7m), X (5m)

> Note: This view collapses the tiny gaps and app switching into a single **place‑anchored session**. The granular view remains accessible on tap.

---

## 4) Visual timeline (location‑aware)

```
09:00 ───────────────────────────────────────────── 11:00
09:00-09:09  At Cafe      (location)
09:09-09:14  Messages     (screen_time)
09:14-09:20  At Cafe      (location)
09:20-09:28  Chrome       (screen_time)
09:28-09:29  At Cafe      (location)
09:29-09:34  Docs         (screen_time)
09:34-09:40  At Cafe      (location)
09:40-09:50  Commute      (location)
09:50-10:12  Slack        (screen_time)
10:12-10:13  At Office    (location)
10:13-10:18  Docs         (screen_time)
10:18-10:21  At Office    (location)
10:21-10:26  X            (screen_time)
10:26-10:30  At Office    (location)
10:30-10:33  At Office    (location)
10:33-10:47  Meet         (screen_time)
10:47-10:52  At Office    (location)
10:52-10:59  Gmail        (screen_time)
10:59-11:00  At Office    (location)
```

---

## 4.5) **Sessionized output (new source of truth)**

> **Key shift:** Instead of showing many tiny blocks (Messages → Chrome → Docs), the app should produce **location‑anchored session blocks** that summarize activity within the place. The granular timeline still exists, but it is revealed **only on tap**.

### 4.5.1 Session rules (high level)
- **Primary anchor = location block.**
- **Screen‑time attaches as “activity summary”** within that location block.
- **Commute stays its own block** (mobility category).
- **Micro‑gaps (<5 min)** are merged into adjacent session blocks.
- **Screen‑time does not break the session** unless it indicates a clearly different context (see “context split” rules below).

### 4.5.2 Example — 09:00–09:40 Cafe session (collapsed)
**Collapsed block:**
- **Title:** `Cafe — Work`
- **Subtitle:** `Chrome (8m), Docs (5m), Messages (5m)`
- **Tags:** `productive`, `focused` *(optional, derived)*
- **Category:** `place`
- **Icon:** location

**Expanded view (on tap):**
```
09:00-09:09  At Cafe      (location)
09:09-09:14  Messages     (screen_time)
09:14-09:20  At Cafe      (location)
09:20-09:28  Chrome       (screen_time)
09:28-09:34  Docs         (screen_time)
09:34-09:40  At Cafe      (location)
```

### 4.5.3 Session classification (work / social / distracted work)
Create a lightweight **app category mapping** and roll up durations into buckets:
- **Work:** Docs, Slack, Gmail, Meet, Calendar, Figma
- **Comms:** Messages, WhatsApp, SMS, Phone
- **Social:** Instagram, TikTok, X, Reddit
- **Entertainment:** YouTube, Netflix, Spotify
- **Utility:** Maps, Photos, Weather

Then compute **dominant intent** for the session:
- If **Work ≥ 60%** of screen‑time during the session → label as **Work**
- If **Social + Entertainment ≥ 60%** → label **Leisure**
- If **Work 40–60%** and **Social/Entertainment ≥ 25%** → label **Distracted Work**
- If no screen‑time (offline) → label **At [Place]**

**Example:** Cafe session with Docs+Chrome+Messages → **Work**
**Example:** Cafe session with Instagram+YouTube → **Cafe — Leisure**
**Example:** Office session with Slack+Docs + Instagram → **Office — Distracted Work**

### 4.5.4 Context split rules (when to break a session)
Inside the same location, split into two sessions if:
- **Category switches** and remains dominant for ≥ 15 minutes
- **App mix** shifts from Work → Entertainment for ≥ 15 minutes
- User explicitly edits the block (manual split)

### 4.5.5 Why this matters
- Humans remember **place‑anchored sessions**, not app‑by‑app switches.
- The timeline becomes **readable**, while details remain **discoverable**.

---

## 5) How the app should categorize these (Actual side)

**Screen‑time segments (ingestion):**
- `meta.source = "ingestion"`
- `meta.kind = "screen_time"`
- `meta.category = "digital"`
- `meta.app_id` + `meta.session_ids`

**Location segments (new inference):**
- `meta.source = "ingestion"` (or `"location"` if you want a separate provenance)
- `meta.kind = "location_block"`
- `meta.category = "place"` or `"mobility"`
- `meta.place_id` (if known)
- `meta.place_label` (Home/Office/Cafe)
- `meta.confidence` (from location_hourly or heuristic)

**Unknown segments:**
- Only when **neither screen evidence nor confident location evidence** exists.
- These should be **rare**, and ideally merged if small.

---

## 6) What should change to achieve this (no code changes yet, just design)

### 6.1 New data pipeline steps
1. **Fetch location evidence** for the same window:
   - Use `location_hourly` and/or `location_samples`.
   - Map location points to `user_places` where possible.
2. **Generate location segments** similar to screen segments:
   - Normalize into **contiguous blocks** by place.
   - Identify **movement** between places as Commute.
3. **Reconciliation priority order:**
   1. Protected user events (never touched)
   2. Screen‑time segments (direct evidence)
   3. Location blocks (secondary evidence)
   4. Unknown gaps (fallback)

### 6.2 Gap handling rules
- **Merge small Unknown gaps** between adjacent events (< 5 min) into neighbors.
- Avoid inserting Unknown **inside** protected events.
- Replace Unknown with location evidence when location confidence exceeds threshold.

### 6.3 Proposed “place inference” heuristics
- If 70%+ of location samples in a time span map to a single place → label as that place.
- If the window shows **rapid coordinate change** and no stable place → classify as Commute.
- If a place is unrecognized, label “At [City/Area]” or “Unlabeled place.”

### 6.4 Session block generation (new layer)
**Concept:** After reconciliation, run a **sessionization pass** that collapses location + screen‑time into **place‑anchored sessions**.

**Inputs:**
- Location segments (place + commute)
- Screen‑time segments (apps + durations)
- User‑edited events (protected)

**Outputs:**
- Session blocks with summaries (Work / Leisure / Distracted Work)

**Rules:**
1. Start a new session at every **location change**.
2. Attach overlapping screen‑time to the current session.
3. Compute session label + summary using category weights.
4. If a different intent becomes dominant for ≥ 15 minutes, **split** into a new session within the same location.

### 6.5 Data model proposal (no code yet)
**Option A (recommended):** Keep granular events in `tm.events` but add a **second layer** of “session blocks” that the UI reads by default.

Session event example:
```json
{
  "type": "calendar_actual",
  "title": "Cafe — Work",
  "scheduled_start": "2026-01-29T09:00:00Z",
  "scheduled_end": "2026-01-29T09:40:00Z",
  "meta": {
    "source": "sessionizer",
    "kind": "session_block",
    "category": "place",
    "place_id": "P_CAFE",
    "place_label": "Cafe",
    "intent": "work",
    "summary": [
      { "label": "Chrome", "seconds": 480 },
      { "label": "Docs", "seconds": 300 },
      { "label": "Messages", "seconds": 300 }
    ],
    "confidence": 0.86,
    "children": ["event_id_1", "event_id_2", "event_id_3"]
  }
}
```

**Option B:** Store session blocks as **derived views** (not in DB), computed at query time. Less storage, more compute.

---

## 7) How this should look in the app (UX expectations)

**Actual timeline view (default = session blocks):**
- **Session blocks** appear as the primary timeline units (e.g., *Cafe — Work*).
- Tapping a session **expands** to reveal granular segments (apps + gaps).
- Screen‑time segments appear as **digital** blocks with app icon (expanded view).
- Location segments appear as **place** blocks (Home/Office/Cafe) with location icon (expanded view).
- Commute appears as a **mobility** block (car/train/walk icon if inferred).
- Unknown should be **rare** and visually distinct (greyed).

**Consistency:**
- If a user edits a block, it becomes **protected** and future ingestion won’t overwrite it.
- Location blocks should collapse when there is heavy screen‑time usage (screen‑time “wins” for those minutes).

**Two subtle UX rules:**
1. **No micro‑gaps:** If the gap is < 5 minutes, merge into adjacent block.
2. **Location explains offline time:** Most “offline” minutes become place blocks rather than Unknown.

---

## 8) Questions / Decisions to finalize

1. **Priority:** Should location blocks **override** “screen_time” when both exist? (My recommendation: **no** — screen_time is more specific.)
2. **Minimum duration:** What’s the **minimum length** for a location block? (e.g., 2 min? 5 min?)
3. **Commute rules:** How do we define commute? Speed threshold? Place change within X minutes?
4. **Place confidence:** Do we want a single confidence threshold, or a tiered approach (High = auto, Low = Unknown)?
5. **Category taxonomy:** Do we want `category=place` vs `category=mobility` vs `category=unknown` as the standard set?
6. **Labels:** Should “At Office” be a **standardized label** or a **user‑editable title** tied to `user_places`?
7. **Conflict resolution:** If location says **Office** but screen time says **Instagram**, do we need a combined label or keep screen time only?
8. **Session storage:** Should session blocks be persisted (Option A) or computed on the fly (Option B)?
9. **Distracted work rules:** Do we agree on thresholds (Work 40–60% + Social ≥ 25%) or should these be configurable per user?
10. **Summary length:** How many top apps should we show in the session subtitle? (3? 5?)

---

## 9) Summary (what this gets us)

- **Much fewer Unknown blocks** — offline time becomes meaningful.
- **Timeline feels coherent**: screen time + place = real life.
- **Session blocks match human memory** (Cafe → Work, Office → Meeting).
- **Deterministic, stable ingestion** maintained.

---

## 10) Next steps (non‑code)

- Confirm priority and thresholds (questions above).
- Decide naming conventions for location‑based Actual events.
- Agree on **session block** taxonomy (Work / Leisure / Distracted Work / Mixed).
- Agree on UX representation (icons/colors).
- Then implement: location evidence extraction + reconciliation order + gap rules + sessionization layer.

---

---

## 11) Second simulation — Weekend (gym + errands + home)

### 11.1 Human‑level activity (13:00–15:00)
- 13:00–13:10: Drive to gym
- 13:10–13:55: Workout
- 13:55–14:05: Drive to grocery store
- 14:05–14:35: Grocery shopping
- 14:35–14:50: Drive home
- 14:50–15:00: Chill on couch, scroll social

### 11.2 Location evidence (conceptual)
- 13:00–13:10: **Commute** (Home → Gym)
- 13:10–13:55: **Gym** (place id: P_GYM)
- 13:55–14:05: **Commute** (Gym → Grocery)
- 14:05–14:35: **Grocery Store** (place id: P_GROCERY)
- 14:35–14:50: **Commute** (Grocery → Home)
- 14:50–15:00: **Home** (place id: P_HOME)

### 11.3 Screen‑time evidence (sample)
| session_id | started_at | ended_at | duration_seconds | app_id | display_name |
|---|---|---|---:|---|---|
| w1 | 13:12:00 | 13:14:00 | 120 | com.spotify | Spotify |
| w2 | 13:25:00 | 13:27:00 | 120 | com.spotify | Spotify |
| w3 | 14:08:00 | 14:11:00 | 180 | com.target.app | Target |
| w4 | 14:12:00 | 14:14:00 | 120 | com.apple.imessage | Messages |
| w5 | 14:52:00 | 14:59:00 | 420 | com.instagram.android | Instagram |

### 11.4 Sessionized output (collapsed view)
- **13:00–13:10 — Commute**
- **13:10–13:55 — Gym — Fitness**
  - Summary: Spotify (4m)
- **13:55–14:05 — Commute**
- **14:05–14:35 — Grocery — Errands**
  - Summary: Target (3m), Messages (2m)
- **14:35–14:50 — Commute**
- **14:50–15:00 — Home — Leisure**
  - Summary: Instagram (7m)

### 11.5 Expanded view (on tap)
```
13:00-13:10  Commute       (location)
13:10-13:55  At Gym        (location)
13:12-13:14  Spotify       (screen_time)
13:25-13:27  Spotify       (screen_time)
13:55-14:05  Commute       (location)
14:05-14:35  At Grocery    (location)
14:08-14:11  Target        (screen_time)
14:12-14:14  Messages      (screen_time)
14:35-14:50  Commute       (location)
14:50-15:00  At Home       (location)
14:52-14:59  Instagram     (screen_time)
```

---

## 12) Formal rules table (sessionization + labeling)

| Rule | Description | Default Threshold | Example |
|---|---|---:|---|
| Location anchoring | Session blocks begin/end at location changes | N/A | Cafe → Office → Home |
| Commute detection | Movement without stable place | ≥ 10 min moving | 09:40–09:50 commute |
| Screen‑time dominance | If screen‑time exists, it informs intent | Work ≥ 60% | “Cafe — Work” |
| Distracted work | Mixed work + social | Work 40–60% + Social ≥ 25% | “Office — Distracted Work” |
| Leisure | Social + entertainment dominates | ≥ 60% | “Home — Leisure” |
| Offline place | No screen evidence | N/A | “At Office” |
| Intent split | Shift in dominant intent within same location | ≥ 15 min | Work → Leisure split |
| Micro‑gap merge | Small gaps merged | < 5 min | 2–3 min gaps removed |
| Unknown fallback | No screen and no confident place | Confidence < threshold | “Unknown” |
| Summary size | Number of apps in subtitle | 3 (configurable) | Chrome, Docs, Slack |

---

*This document is the working source of truth for the pipeline. When we implement, we should track deviations explicitly.*
