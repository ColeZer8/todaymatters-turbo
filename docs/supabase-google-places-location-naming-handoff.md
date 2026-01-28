## Supabase handoff: Google Places location naming

### Goal
When the app records background GPS coordinates, the product should show **venue-like names** (e.g. “Starbucks”) instead of raw coordinates or “traveled”.

We do this by:
- **Caching** Google Places results per-user in the DB
- **Joining** cached names into `tm.location_hourly`
- Letting the mobile app **opportunistically populate** the cache via an Edge Function

---

### What’s in this PR

#### 1) DB migration
File: `supabase/migrations/20260128_add_location_place_cache_google_places.sql`

Creates:
- `tm.location_place_cache` (per-user, TTL’d)

Updates:
- `tm.location_hourly` view now also returns:
  - `google_place_id`
  - `google_place_name`
  - `google_place_vicinity`
  - `google_place_types`

Key points:
- Cache is keyed by **`(user_id, geohash7)`** (geohash precision 7 ≈ ~150m cell).
- Cache TTL default is **180 days** (long to control cost).
- `tm.user_places` still wins whenever it matches (user-defined “Home/Work/Gym” etc.).

#### 2) Edge Function
File: `supabase/functions/location-place-lookup/index.ts`

Function name: `location-place-lookup`

Behavior:
- Validates the user via JWT (requires Authorization header).
- For each requested point:
  - Computes `geohash7` (in code)
  - Checks `tm.location_place_cache` for a fresh row
  - If missing/expired, calls **Google Places Nearby Search**
  - Upserts into `tm.location_place_cache` (write-through)
- Returns `results[]` with `placeName`, `vicinity`, `types`, `expiresAt`, and a `source` flag.

---

### Google Cloud setup (Supabase team)

#### Enable APIs
In Google Cloud Console:
- Enable **Places API** (required)

The function currently only calls Places Nearby Search, so Places API alone is sufficient.

#### Create an API key
Create a server-side API key and restrict it:
- **API restrictions**: restrict to *Places API*
- **Application restrictions**:
  - For Supabase Edge Functions, you typically can’t use HTTP referrer restrictions.
  - Prefer leaving “None” + strict API restriction, and rotate if leaked.

---

### Supabase secrets

Required:
- `GOOGLE_MAPS_API_KEY`: Google API key with Places API enabled

Optional (request override exists in function body anyway):
- none (TTL defaults to 180 days, radius defaults to 150m)

CLI example:

```bash
supabase secrets set GOOGLE_MAPS_API_KEY="YOUR_KEY"
```

---

### Deploy / apply

#### Apply migration
Run migrations as usual (CI or Supabase dashboard SQL editor).

#### Deploy Edge Function

```bash
supabase functions deploy location-place-lookup
```

---

### Request/response contract

#### Request (POST JSON)

```json
{
  "points": [
    { "latitude": 37.7749, "longitude": -122.4194 }
  ],
  "radiusMeters": 150,
  "ttlDays": 180,
  "forceRefresh": false
}
```

#### Response

```json
{
  "results": [
    {
      "geohash7": "9q8yyk8",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "placeName": "Starbucks",
      "googlePlaceId": "ChIJ...",
      "vicinity": "Market St, San Francisco",
      "types": ["cafe", "store", "food", "point_of_interest", "establishment"],
      "source": "google_places_nearby",
      "expiresAt": "2026-07-26T..."
    }
  ]
}
```

---

### Privacy & cost notes
- **Per-user cache**: we do *not* share cached names across users.
- **Cost control**: lookups happen at most once per geohash cell per user per TTL window.
- **User places**: anything the user explicitly saves should be stored in `tm.user_places` (non-expiring “source of truth”).

---

### How the mobile app uses this
- Evidence fetch (`apps/mobile/src/lib/supabase/services/evidence-data.ts`) now:
  - Fetches `tm.location_hourly`
  - Calls `location-place-lookup` for rows missing both `place_label` and `google_place_name`
  - Re-fetches `tm.location_hourly` so `google_place_name` is present immediately
- Display logic prefers:
  1) `place_label` (user place)
  2) `google_place_name` (Places)
  3) `place_category`

