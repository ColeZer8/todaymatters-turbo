/**
 * Location Merge Debugging Utility
 * 
 * Call this from the React Native console or a debug button to extract
 * detailed merge decision data for troubleshooting.
 * 
 * Usage:
 *   import { debugLocationMerge } from '@/lib/diagnostics/location-merge-debug';
 *   debugLocationMerge('b9ca3335-9929-4d54-a3fc-18883c5f3375', '2026-02-11');
 */

import { supabase } from '../supabase/client';
import { fetchActivitySegmentsForDate } from '../supabase/services/activity-segments';

interface SegmentDebugInfo {
  id: string;
  startTime: string;
  endTime: string;
  placeLabel: string | null;
  placeId: string | null;
  geohash7: string | null;
  lat: number | null;
  lng: number | null;
  duration: number; // minutes
}

/**
 * Extract and format segment data for debugging merge issues
 */
export async function debugLocationMerge(userId: string, date: string): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🔍 LOCATION MERGE DEBUG');
  console.log(`📅 Date: ${date}`);
  console.log(`👤 User: ${userId}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Fetch activity segments
    const segments = await fetchActivitySegmentsForDate(userId, date);
    
    if (segments.length === 0) {
      console.log('❌ NO SEGMENTS FOUND');
      console.log('   Possible causes:');
      console.log('   - BRAVO pipeline not running');
      console.log('   - No location samples for this date');
      console.log('   - Segment creation logic not deployed\n');
      return;
    }

    console.log(`✅ Found ${segments.length} activity segments\n`);

    // Sort by start time
    const sorted = [...segments].sort(
      (a, b) => a.startedAt.getTime() - b.startedAt.getTime()
    );

    // Format segment data
    const debugInfo: SegmentDebugInfo[] = sorted.map((seg) => ({
      id: seg.id.substring(0, 8),
      startTime: seg.startedAt.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }),
      endTime: seg.endedAt.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }),
      placeLabel: seg.placeLabel,
      placeId: seg.placeId ? seg.placeId.substring(0, 12) + '...' : null,
      geohash7: seg.locationGeohash7,
      lat: seg.locationLat ? Number(seg.locationLat.toFixed(5)) : null,
      lng: seg.locationLng ? Number(seg.locationLng.toFixed(5)) : null,
      duration: Math.round((seg.endedAt.getTime() - seg.startedAt.getTime()) / 60000),
    }));

    // Print table
    console.log('📊 SEGMENTS:\n');
    console.table(debugInfo);

    // Find potential merge candidates (same label, adjacent time)
    console.log('\n🔍 MERGE CANDIDATES:\n');
    let foundCandidates = false;

    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];

      // Check if they have the same non-null label
      if (
        curr.placeLabel &&
        next.placeLabel &&
        curr.placeLabel.trim().toLowerCase() === next.placeLabel.trim().toLowerCase()
      ) {
        foundCandidates = true;
        const gap = (next.startedAt.getTime() - curr.endedAt.getTime()) / 1000 / 60; // minutes
        
        console.log(`\n  Segment ${i + 1} & ${i + 2}: "${curr.placeLabel}"`);
        console.log(`  ├─ Time:     ${debugInfo[i].startTime} - ${debugInfo[i].endTime}`);
        console.log(`  │            ${debugInfo[i + 1].startTime} - ${debugInfo[i + 1].endTime}`);
        console.log(`  ├─ Gap:      ${gap.toFixed(1)} min`);
        console.log(`  ├─ Place ID: ${curr.placeId || 'NULL'} vs ${next.placeId || 'NULL'}`);
        
        if (curr.placeId !== next.placeId) {
          console.log(`  ├─ ⚠️  DIFFERENT PLACE IDs - This is why they're not merging!`);
        }
        
        console.log(`  ├─ Geohash:  ${curr.locationGeohash7 || 'NULL'} vs ${next.locationGeohash7 || 'NULL'}`);
        
        if (curr.locationLat && curr.locationLng && next.locationLat && next.locationLng) {
          const distance = haversineDistance(
            curr.locationLat,
            curr.locationLng,
            next.locationLat,
            next.locationLng
          );
          console.log(`  └─ Distance: ${Math.round(distance)}m`);
          
          if (distance > 200) {
            console.log(`     ⚠️  > 200m threshold - This is why they're not merging!`);
          }
        } else {
          console.log(`  └─ Distance: Cannot calculate (missing coords)`);
        }
      }
    }

    if (!foundCandidates) {
      console.log('  ✅ No adjacent segments with matching labels found');
      console.log('     (This is expected if all segments are at different locations)');
    }

    // Check for specific problem case from screenshot
    const believeCandleSegments = sorted.filter((s) =>
      s.placeLabel?.toLowerCase().includes('believe candle')
    );

    if (believeCandleSegments.length > 1) {
      console.log('\n\n🎯 SPECIFIC ISSUE: Multiple "Believe Candle" segments detected!\n');
      believeCandleSegments.forEach((seg, idx) => {
        console.log(`  Segment ${idx + 1}:`);
        console.log(`  ├─ Time:     ${seg.startedAt.toLocaleTimeString()} - ${seg.endedAt.toLocaleTimeString()}`);
        console.log(`  ├─ Label:    "${seg.placeLabel}"`);
        console.log(`  ├─ Place ID: ${seg.placeId || 'NULL'}`);
        console.log(`  ├─ Geohash:  ${seg.locationGeohash7 || 'NULL'}`);
        console.log(`  └─ Coords:   ${seg.locationLat?.toFixed(5)}, ${seg.locationLng?.toFixed(5)}\n`);
      });

      // Compare the first two
      if (believeCandleSegments.length >= 2) {
        const seg1 = believeCandleSegments[0];
        const seg2 = believeCandleSegments[1];

        console.log('  ROOT CAUSE ANALYSIS:\n');

        if (seg1.placeId !== seg2.placeId) {
          console.log('  ❌ DIFFERENT PLACE IDs');
          console.log(`     Seg 1: ${seg1.placeId || 'NULL'}`);
          console.log(`     Seg 2: ${seg2.placeId || 'NULL'}`);
          console.log('     → FIX: Merge logic should check label+proximity even if place_id differs\n');
        }

        if (seg1.locationLat && seg1.locationLng && seg2.locationLat && seg2.locationLng) {
          const distance = haversineDistance(
            seg1.locationLat,
            seg1.locationLng,
            seg2.locationLat,
            seg2.locationLng
          );
          console.log(`  Distance: ${Math.round(distance)}m`);
          if (distance > 200) {
            console.log('  ❌ EXCEEDS 200m THRESHOLD');
            console.log('     → FIX: Increase proximity threshold OR use geohash7 matching\n');
          } else {
            console.log('  ✅ Within 200m threshold\n');
          }
        }

        if (seg1.locationGeohash7 === seg2.locationGeohash7) {
          console.log(`  ✅ SAME GEOHASH7: ${seg1.locationGeohash7}`);
          console.log('     → Merge logic should use this as a strong signal\n');
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Debug complete! Share this output for analysis.');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

/**
 * Calculate distance between two coordinates in meters
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Quick test function to verify merge logic is loaded
 */
export function checkMergeLogicVersion(): void {
  // This will trigger the version banner log if the file is loaded
  import('../utils/group-location-blocks').then((module) => {
    console.log('✅ Merge logic module loaded');
    console.log('   Check console for version banner: 🔥🔥🔥 GROUP-LOCATION-BLOCKS.TS LOADED');
  });
}
