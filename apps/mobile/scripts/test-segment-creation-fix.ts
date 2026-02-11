/**
 * Test script to verify single-sample segment creation fix
 * 
 * Run this in the React Native app console or as a test function
 * to verify that segments are now being created for hours with only 1 location sample.
 */

import { generateActivitySegments } from '../src/lib/supabase/services/activity-segments';
import { supabase } from '../src/lib/supabase/client';

const USER_ID = 'b9ca3335-9929-4d54-a3fc-18883c5f3375';
const TEST_DATE = '2026-02-11'; // Cole's test date

async function testSegmentCreation() {
  console.log('🧪 Testing segment creation for 2026-02-11...\n');

  // Test hours that should have segments (based on Cole's screenshot)
  const testHours = [
    { hour: 2, expected: 'Believe Candle Co.', samples: 1 },
    { hour: 3, expected: 'Believe Candle Co.', samples: 1 },
    { hour: 7, expected: 'Should exist', samples: '?' },
  ];

  for (const test of testHours) {
    const hourStart = new Date(`${TEST_DATE}T${test.hour.toString().padStart(2, '0')}:00:00.000-06:00`);
    
    console.log(`\n📍 Testing hour ${test.hour}:00 (expecting "${test.expected}", ${test.samples} sample(s))...`);
    
    // Check location samples first
    const { data: samples, error: samplesError } = await supabase
      .schema('tm')
      .from('location_samples')
      .select('recorded_at, latitude, longitude')
      .eq('user_id', USER_ID)
      .gte('recorded_at', hourStart.toISOString())
      .lt('recorded_at', new Date(hourStart.getTime() + 60 * 60 * 1000).toISOString());

    if (samplesError) {
      console.error(`❌ Failed to fetch samples: ${samplesError.message}`);
      continue;
    }

    console.log(`   ✅ Found ${samples?.length ?? 0} location sample(s)`);
    if (samples && samples.length > 0) {
      samples.forEach(s => {
        console.log(`      - ${s.recorded_at} @ (${s.latitude}, ${s.longitude})`);
      });
    }

    // Generate segments for this hour
    try {
      const segments = await generateActivitySegments(USER_ID, hourStart);
      console.log(`   🔷 Generated ${segments.length} segment(s)`);
      
      if (segments.length === 0) {
        console.log(`   ⚠️  WARNING: No segments created despite having samples!`);
      } else {
        segments.forEach((seg, idx) => {
          const duration = Math.round((seg.endedAt.getTime() - seg.startedAt.getTime()) / 60000);
          console.log(`      Segment ${idx + 1}: ${seg.placeLabel ?? 'Unknown'}`);
          console.log(`         Start: ${seg.startedAt.toISOString()}`);
          console.log(`         End: ${seg.endedAt.toISOString()}`);
          console.log(`         Duration: ${duration} minutes`);
          console.log(`         Samples: ${seg.evidence.locationSamples}`);
          console.log(`         Confidence: ${(seg.activityConfidence * 100).toFixed(1)}%`);
        });
      }

      // Check if segments were saved to database
      const { data: dbSegments, error: dbError } = await supabase
        .schema('tm')
        .from('activity_segments')
        .select('id, started_at, ended_at, place_label')
        .eq('user_id', USER_ID)
        .eq('hour_bucket', hourStart.toISOString());

      if (dbError) {
        console.error(`   ❌ Failed to check DB: ${dbError.message}`);
      } else {
        console.log(`   💾 Found ${dbSegments?.length ?? 0} segment(s) in database`);
        if (dbSegments && dbSegments.length > 0) {
          dbSegments.forEach(s => {
            const duration = Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000);
            console.log(`      - ${s.place_label ?? 'Unknown'} (${duration} min)`);
          });
        }
      }
    } catch (error) {
      console.error(`   ❌ Error generating segments:`, error);
    }
  }

  console.log('\n\n📊 SUMMARY:');
  console.log('If the fix works, you should see:');
  console.log('1. ✅ Location samples exist for hours 2 and 3');
  console.log('2. ✅ Segments are generated with duration > 0 minutes');
  console.log('3. ✅ Segments are saved to the database');
  console.log('4. ✅ Place labels match expected locations');
}

// Export for use in app
export { testSegmentCreation };

// Run immediately if executed directly
if (require.main === module) {
  testSegmentCreation()
    .then(() => {
      console.log('\n✅ Test complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}
