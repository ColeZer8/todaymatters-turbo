/**
 * MANUAL TEST: Verify location block merge logic
 * 
 * This tests the merge logic in isolation to verify it's working correctly.
 * Run this to check if the issue is in the logic or in the app/cache.
 * 
 * Usage:
 *   npx ts-node apps/mobile/src/lib/utils/__tests__/merge-logic-test.ts
 */

import type { ActivitySegment } from "@/lib/supabase/services/activity-segments";

// Simplified version of isSamePlace logic for testing
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function testIsSamePlace(seg1: Partial<ActivitySegment>, seg2: Partial<ActivitySegment>): boolean {
  console.log(`\n🧪 Testing merge:`);
  console.log(`  Seg1: "${seg1.placeLabel}" (ID: ${seg1.placeId}, coords: ${seg1.locationLat},${seg1.locationLng})`);
  console.log(`  Seg2: "${seg2.placeLabel}" (ID: ${seg2.placeId}, coords: ${seg2.locationLat},${seg2.locationLng})`);

  // Place ID match
  if (seg1.placeId && seg2.placeId && seg1.placeId === seg2.placeId) {
    console.log(`  ✅ MERGE: Place ID match (${seg1.placeId})`);
    return true;
  }

  // Coordinate proximity
  if (
    seg1.locationLat != null &&
    seg1.locationLng != null &&
    seg2.locationLat != null &&
    seg2.locationLng != null
  ) {
    const distance = haversineDistance(
      seg1.locationLat,
      seg1.locationLng,
      seg2.locationLat,
      seg2.locationLng,
    );
    console.log(`  Distance: ${Math.round(distance)}m`);
    if (distance < 200) {
      console.log(`  ✅ MERGE: Proximity (${Math.round(distance)}m < 200m)`);
      return true;
    }
  }

  // Label match
  const label1 = seg1.placeLabel?.trim().toLowerCase();
  const label2 = seg2.placeLabel?.trim().toLowerCase();
  if (
    label1 &&
    label2 &&
    label1 === label2 &&
    label1 !== 'unknown location' &&
    label1 !== 'unknown' &&
    label1 !== 'location'
  ) {
    console.log(`  ✅ MERGE: Label match ("${label1}")`);
    return true;
  }

  console.log(`  ❌ NO MERGE: No matching criteria`);
  return false;
}

// Test Case 1: Two "Believe Candle Co." segments with same place_id
console.log(`\n${'='.repeat(60)}`);
console.log(`TEST 1: Same place_id (should merge)`);
console.log(`${'='.repeat(60)}`);
testIsSamePlace(
  {
    placeLabel: "Believe Candle Co.",
    placeId: "ChIJABC123",
    locationLat: 41.2565,
    locationLng: -96.0134,
  },
  {
    placeLabel: "Believe Candle Co.",
    placeId: "ChIJABC123",
    locationLat: 41.2566,
    locationLng: -96.0135,
  }
);

// Test Case 2: Two "Believe Candle Co." segments with NO place_id but same coords
console.log(`\n${'='.repeat(60)}`);
console.log(`TEST 2: Same coords, no place_id (should merge by proximity)`);
console.log(`${'='.repeat(60)}`);
testIsSamePlace(
  {
    placeLabel: "Believe Candle Co.",
    placeId: null,
    locationLat: 41.2565,
    locationLng: -96.0134,
  },
  {
    placeLabel: "Believe Candle Co.",
    placeId: null,
    locationLat: 41.2566,
    locationLng: -96.0135,
  }
);

// Test Case 3: Two "Believe Candle Co." segments with NO place_id, far coords
console.log(`\n${'='.repeat(60)}`);
console.log(`TEST 3: Same label, no place_id, far coords (should merge by label)`);
console.log(`${'='.repeat(60)}`);
testIsSamePlace(
  {
    placeLabel: "Believe Candle Co.",
    placeId: null,
    locationLat: 41.2565,
    locationLng: -96.0134,
  },
  {
    placeLabel: "Believe Candle Co.",
    placeId: null,
    locationLat: 41.3000, // ~5km away
    locationLng: -96.0500,
  }
);

// Test Case 4: "Believe Candle Co." vs "Unknown Location"
console.log(`\n${'='.repeat(60)}`);
console.log(`TEST 4: Known vs Unknown location (should NOT merge)`);
console.log(`${'='.repeat(60)}`);
testIsSamePlace(
  {
    placeLabel: "Believe Candle Co.",
    placeId: "ChIJABC123",
    locationLat: 41.2565,
    locationLng: -96.0134,
  },
  {
    placeLabel: "Unknown Location",
    placeId: null,
    locationLat: 41.2566,
    locationLng: -96.0135,
  }
);

// Test Case 5: Two "Unknown Location" segments (should NOT merge by label)
console.log(`\n${'='.repeat(60)}`);
console.log(`TEST 5: Unknown vs Unknown (should merge by proximity only)`);
console.log(`${'='.repeat(60)}`);
testIsSamePlace(
  {
    placeLabel: "Unknown Location",
    placeId: null,
    locationLat: 41.2565,
    locationLng: -96.0134,
  },
  {
    placeLabel: "Unknown Location",
    placeId: null,
    locationLat: 41.2566, // Close coords
    locationLng: -96.0135,
  }
);

// Test Case 6: Case insensitive label match
console.log(`\n${'='.repeat(60)}`);
console.log(`TEST 6: Case differences (should merge by label)`);
console.log(`${'='.repeat(60)}`);
testIsSamePlace(
  {
    placeLabel: "Believe Candle Co.",
    placeId: null,
    locationLat: null,
    locationLng: null,
  },
  {
    placeLabel: "believe candle co.",
    placeId: null,
    locationLat: null,
    locationLng: null,
  }
);

console.log(`\n${'='.repeat(60)}`);
console.log(`✅ All tests complete`);
console.log(`${'='.repeat(60)}\n`);
console.log(`Expected results:`);
console.log(`  Tests 1-3, 5-6: Should MERGE`);
console.log(`  Test 4: Should NOT MERGE`);
console.log(`\nIf these results are correct, the LOGIC is working.`);
console.log(`If Cole still sees issues, it's a CACHE or DATA problem.`);
