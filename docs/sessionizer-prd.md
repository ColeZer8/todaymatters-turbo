# PRD — Location‑Anchored Sessionizer for Actual Timeline

## Summary
We need the Actual timeline to display **place‑anchored session blocks** (e.g., “Cafe — Work”, “Office — Distracted Work”) instead of overlapping micro‑blocks. The system should preserve raw evidence (location + screen time + workouts) but present a **sessionized view** by default. A tap should expand the session into granular segments.

## Problem
The current pipeline creates overlapping blocks:
- Hour‑long **location** blocks
- Long **screen‑time** blocks that merge across short gaps

This produces cluttered, conflicting timelines that don’t match how people remember their day. Users want a readable summary that remains faithful to the underlying evidence.

## Goals
1. **Sessionized display**: One block per place + intent (Work/Leisure/Distracted Work).
2. **Faithful evidence**: Raw evidence remains accessible via expand view.
3. **Clear movement**: Commute shown only when ≥10 min; otherwise annotate next session.
4. **Minimal Unknown**: Unknown only when neither location nor screen‑time is confident.
5. **Deterministic**: Same inputs always yield same sessions.

## Non‑Goals
- Full semantic inference beyond place + app categories.
- New third‑party APIs.
- iOS‑specific ingestion improvements (can come later).

## Inputs (Existing)
- `tm.location_hourly` (location evidence)
- `tm.user_places` (labels/categories)
- `tm.screen_time_app_sessions` (screen evidence)
- `tm.health_workouts` (workouts)

## Output (New)
- **Session blocks** (new layer), each with:
  - `start/end`
  - `place_label`, `place_category`
  - `intent`: Work / Leisure / Distracted Work / Mixed / Offline
  - `summary`: top apps + minutes
  - `confidence`
  - `children`: list of granular event IDs

## UX
- Default timeline shows **session blocks** only.
- Tap → expand to granular segments (location + screen time + workout + unknown).

## Key Rules
1. **Priority order**
   - User edits (protected)
   - Screen time (specific)
   - Location (context)
   - Unknown (fallback)

2. **Session anchoring**
   - Start a new session on **location change**.
   - Attach overlapping screen‑time to the active session.

3. **Intent labeling**
   - Work ≥ 60% → Work
   - Social+Entertainment ≥ 60% → Leisure
   - Work 40–60% and Social/Entertainment ≥ 25% → Distracted Work
   - No screen time → “At [Place]”

4. **Commute rule**
   - Movement ≥ 10 min → Commute block
   - Movement < 10 min → annotate next session (“traveled X min to Office”)

5. **Micro‑gap smoothing**
   - Gaps < 5 min merge into adjacent blocks.

## Risks
- Location accuracy variance
- Sparse data leading to Unknowns
- Conflicts between location and screen‑time signals

## Success Metrics
- 80% reduction in Unknown minutes (non‑travel windows)
- ≥ 70% of sessions labeled Work/Leisure/Distracted Work
- Fewer overlapping events in default timeline
- Users report improved readability (qualitative)

## Open Questions
- Should session blocks be persisted or computed on the fly?
- App category mapping defaults vs user overrides?
- What UI shows when intent is Mixed?

---

# Ralph‑Formatted PRD (JSON)
**Filename suggestion:** `.ralph/prd-sessionizer.json`

```json
{
  "name": "Today Matters — Location‑Anchored Sessionizer",
  "version": "0.1.0",
  "owner": "Cole",
  "status": "draft",
  "branchName": "feat/sessionizer-actual-timeline",
  "problem": {
    "summary": "Actual timeline is noisy and overlapping due to independent location and screen-time blocks.",
    "root_causes": [
      "Location blocks and screen-time blocks overlap instead of collapsing into sessions.",
      "No intent labeling (Work/Leisure/Distracted Work) at the session level.",
      "Commute handling is not aligned with UX needs (<10m should annotate, not create a block)."
    ]
  },
  "goal": {
    "primary": "Create a sessionizer layer that outputs place‑anchored, intent‑labeled Actual sessions with expandable granular detail.",
    "success_metrics": [
      "Default timeline shows sessions (no overlapping blocks).",
      "Unknown minutes reduced by 80% in non‑travel windows.",
      "Session labels reflect app category mix (Work/Leisure/Distracted Work)."
    ]
  },
  "non_goals": [
    "Advanced semantic inference beyond place + app categories.",
    "New third‑party APIs."
  ],
  "userStories": [
    {
      "id": "US-001",
      "title": "Generate location‑anchored session blocks",
      "description": "Collapse location + screen time into place‑anchored sessions with summaries.",
      "acceptance_criteria": [
        "Sessions start/end at location changes.",
        "Each session includes top apps + minutes.",
        "Granular events remain accessible via expansion."
      ],
      "priority": 1,
      "passes": false
    },
    {
      "id": "US-002",
      "title": "Intent labeling (Work/Leisure/Distracted Work)",
      "description": "Label sessions based on app category mix.",
      "acceptance_criteria": [
        "Work ≥ 60% → Work.",
        "Social+Entertainment ≥ 60% → Leisure.",
        "Work 40–60% + Social/Entertainment ≥ 25% → Distracted Work."
      ],
      "priority": 2,
      "passes": false
    },
    {
      "id": "US-003",
      "title": "Commute handling <10 min",
      "description": "Only create Commute blocks when travel ≥ 10 min; otherwise annotate next session.",
      "acceptance_criteria": [
        "Travel ≥ 10 min creates Commute block.",
        "Travel < 10 min becomes annotation on next session."
      ],
      "priority": 3,
      "passes": false
    },
    {
      "id": "US-004",
      "title": "Micro‑gap smoothing",
      "description": "Merge gaps <5 min into adjacent blocks.",
      "acceptance_criteria": [
        "No standalone blocks for gaps <5 minutes.",
        "Adjacent session times are extended accordingly."
      ],
      "priority": 4,
      "passes": false
    },
    {
      "id": "US-005",
      "title": "Default UI uses session blocks",
      "description": "Calendar renders session blocks by default; granular details on tap.",
      "acceptance_criteria": [
        "Default view shows session blocks only.",
        "Tap expands to granular segments."
      ],
      "priority": 5,
      "passes": false
    }
  ],
  "principles": [
    "Session blocks are summaries; raw evidence remains the truth.",
    "Deterministic output for identical inputs.",
    "Respect user edits and protected events."
  ]
}
```
