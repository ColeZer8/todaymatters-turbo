# Google Places API Integration

## Overview

TodayMatters uses Google Places API (New) to reverse geocode location coordinates into human-readable place names (e.g., "Starbucks", "Austin Christian University").

## Architecture

```
┌─────────────────┐     ┌──────────────────────────┐     ┌───────────────────┐
│   Mobile App    │────▶│  location-place-lookup   │────▶│  Google Places    │
│  (evidence-data)│     │   (Edge Function)        │     │  API (New)        │
└─────────────────┘     └──────────────────────────┘     └───────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────────┐
                        │  tm.location_place_cache │
                        │   (PostgreSQL + PostGIS) │
                        └──────────────────────────┘
```

## Components

### 1. Edge Function: `location-place-lookup`
- **Location**: `supabase/functions/location-place-lookup/index.ts`
- **Endpoint**: `POST /functions/v1/location-place-lookup`
- **Purpose**: Takes lat/lng points, returns place names from Google Places API
- **Caching**: Write-through cache with 180-day TTL

### 2. Cache Table: `tm.location_place_cache`
- **Migration**: `supabase/migrations/20260128_add_location_place_cache_google_places.sql`
- **Key**: `(user_id, geohash7)` - one cached entry per user per ~150m area
- **Stores**: `place_name`, `google_place_id`, `place_vicinity`, `place_types`, `expires_at`

### 3. View: `tm.location_hourly`
- **Migration**: `supabase/migrations/20260202_update_location_place_cache_radius_match.sql`
- **Joins**: Automatically includes `google_place_name` from cache using spatial matching

### 4. Client Service: `location-place-lookup.ts`
- **Location**: `apps/mobile/src/lib/supabase/services/location-place-lookup.ts`
- **Function**: `ensureGooglePlaceNamesForDay()` - called during evidence fetch
- **Logic**: Opportunistically populates cache for uncached locations

## Setup

### 1. Get a Google Places API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable "Places API (New)" from the API Library
4. Create credentials → API Key
5. Restrict the key:
   - API restrictions: Places API (New)
   - Application restrictions: None (or IP-based for server)

### 2. Set Supabase Secret

```bash
# Link your project first (if not already done)
supabase link --project-ref YOUR_PROJECT_REF

# Set the secret
supabase secrets set GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE

# Alternative for development (also accepted by the function)
supabase secrets set DEV_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
```

### 3. Deploy the Edge Function

```bash
supabase functions deploy location-place-lookup
```

### 4. Verify

Test from the mobile app's Dev → Location screen, or call directly:

```bash
curl -X POST \
  'https://YOUR_PROJECT.supabase.co/functions/v1/location-place-lookup' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"points": [{"latitude": 30.2672, "longitude": -97.7431}]}'
```

## API Details

### Request Format
```json
{
  "points": [
    { "latitude": 30.2672, "longitude": -97.7431 }
  ],
  "radiusMeters": 150,      // optional, default 150
  "ttlDays": 180,           // optional, default 180
  "forceRefresh": false     // optional, bypass cache
}
```

### Response Format
```json
{
  "results": [
    {
      "geohash7": "9v6kqpu",
      "latitude": 30.2672,
      "longitude": -97.7431,
      "placeName": "Starbucks",
      "googlePlaceId": "ChIJ...",
      "vicinity": "123 Congress Ave, Austin, TX",
      "types": ["cafe", "food", "establishment"],
      "source": "google_places_nearby",
      "expiresAt": "2026-08-02T00:00:00.000Z"
    }
  ]
}
```

## Pricing

Google Places API (New) pricing (as of 2024):
- **Nearby Search (Pro SKU)**: ~$32 per 1,000 requests
- **Caching significantly reduces costs**: Each geohash7 (~150m²) is cached for 180 days

Typical usage: ~100 unique locations/month = ~$3.20/month

## Troubleshooting

### "Missing GOOGLE_MAPS_API_KEY" error
```bash
supabase secrets set GOOGLE_MAPS_API_KEY=your-key-here
```

### "Google Places Nearby error" in logs
- Check API key is valid and not restricted to wrong APIs
- Verify "Places API (New)" is enabled in Google Cloud Console
- Check quota limits in Google Cloud Console

### Places not showing in app
1. Check edge function is deployed: `supabase functions list`
2. Check cache table: `SELECT * FROM tm.location_place_cache LIMIT 10;`
3. Check logs: `supabase functions logs location-place-lookup`
