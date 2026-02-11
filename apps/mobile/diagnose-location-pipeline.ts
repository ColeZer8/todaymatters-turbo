/**
 * Comprehensive location pipeline diagnostic for Feb 11, 2026
 * 
 * Checks all data layers:
 * 1. location_samples (raw GPS data)
 * 2. activity_segments (BRAVO pipeline)
 * 3. location_hourly (aggregated location data)
 * 4. hourly_summaries (CHARLIE pipeline)
 * 
 * Run with: npx tsx diagnose-location-pipeline.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env file
config({ path: resolve(__dirname, '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials. Check .env file.');
  process.exit(1);
}

const USER_ID = 'b9ca3335-9929-4d54-a3fc-18883c5f3375';
const DATE = '2026-02-11';

async function diagnose() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 TodayMatters Location Pipeline Diagnostic');
  console.log(`📅 Date: ${DATE}`);
  console.log(`👤 User: ${USER_ID}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // ============================================================================
  // 1. CHECK LOCATION SAMPLES (raw GPS data)
  // ============================================================================
  console.log('1️⃣  LOCATION SAMPLES (Raw GPS Data)');
  console.log('─────────────────────────────────────────────────────────\n');

  const { data: samplesData, error: samplesError } = await (supabase as any)
    .schema('tm')
    .from('location_samples')
    .select('recorded_at, latitude, longitude, accuracy')
    .eq('user_id', USER_ID)
    .gte('recorded_at', `${DATE}T00:00:00`)
    .lt('recorded_at', `${DATE}T23:59:59`)
    .order('recorded_at', { ascending: true });

  if (samplesError) {
    console.error('❌ Error fetching location_samples:', samplesError.message);
  } else if (!samplesData || samplesData.length === 0) {
    console.log('❌ NO LOCATION SAMPLES FOUND FOR TODAY');
    console.log('   → This means GPS is not collecting data!');
    console.log('   → Check background location permissions');
    console.log('   → Check if location task is running\n');
  } else {
    console.log(`✅ Found ${samplesData.length} location samples`);
    console.log(`   First sample: ${new Date(samplesData[0].recorded_at).toLocaleString()}`);
    console.log(`   Last sample:  ${new Date(samplesData[samplesData.length - 1].recorded_at).toLocaleString()}`);
    
    // Group by hour
    const byHour = new Map<number, number>();
    samplesData.forEach((s: any) => {
      const hour = new Date(s.recorded_at).getHours();
      byHour.set(hour, (byHour.get(hour) || 0) + 1);
    });
    
    console.log('\n   Samples by hour:');
    for (let h = 0; h < 24; h++) {
      const count = byHour.get(h) || 0;
      if (count > 0) {
        console.log(`     ${h.toString().padStart(2, '0')}:00 - ${count} samples`);
      }
    }
    console.log('');
  }

  // ============================================================================
  // 2. CHECK ACTIVITY SEGMENTS (BRAVO pipeline)
  // ============================================================================
  console.log('2️⃣  ACTIVITY SEGMENTS (BRAVO Pipeline)');
  console.log('─────────────────────────────────────────────────────────\n');

  const { data: segmentsData, error: segmentsError } = await (supabase as any)
    .schema('tm')
    .from('activity_segments')
    .select(`
      id,
      started_at,
      ended_at,
      location_geohash7,
      place_id,
      place_label,
      place_category,
      inferred_activity,
      location_sample_count,
      location_lat,
      location_lng
    `)
    .eq('user_id', USER_ID)
    .gte('started_at', `${DATE}T00:00:00`)
    .lt('started_at', `${DATE}T23:59:59`)
    .order('started_at', { ascending: true });

  if (segmentsError) {
    console.error('❌ Error fetching activity_segments:', segmentsError.message);
  } else if (!segmentsData || segmentsData.length === 0) {
    console.log('❌ NO ACTIVITY SEGMENTS FOUND FOR TODAY');
    console.log('   → BRAVO pipeline may not be running');
    console.log('   → Check if segment creation logic is deployed');
    console.log('   → Earlier fix for single-sample segments may not be live\n');
  } else {
    console.log(`✅ Found ${segmentsData.length} activity segments\n`);
    
    segmentsData.forEach((seg: any, idx: number) => {
      const start = new Date(seg.started_at);
      const end = new Date(seg.ended_at);
      const duration = Math.round((end.getTime() - start.getTime()) / 60000);
      
      console.log(`   Segment ${idx + 1}:`);
      console.log(`     Time: ${start.toLocaleTimeString()} - ${end.toLocaleTimeString()} (${duration}min)`);
      console.log(`     Place: "${seg.place_label || 'NULL'}" (ID: ${seg.place_id || 'NULL'})`);
      console.log(`     Geohash7: ${seg.location_geohash7 || 'NULL'}`);
      console.log(`     Coords: ${seg.location_lat?.toFixed(5) || 'NULL'}, ${seg.location_lng?.toFixed(5) || 'NULL'}`);
      console.log(`     Activity: ${seg.inferred_activity || 'NULL'} (${seg.place_category || 'NULL'})`);
      console.log(`     Samples: ${seg.location_sample_count || 0}`);
      console.log('');
    });

    // Check for problematic segments
    const noGeohash = segmentsData.filter((s: any) => !s.location_geohash7);
    const noLabel = segmentsData.filter((s: any) => !s.place_label);
    const singleSample = segmentsData.filter((s: any) => s.location_sample_count === 1);

    if (noGeohash.length > 0) {
      console.log(`   ⚠️  ${noGeohash.length} segments missing geohash7`);
    }
    if (noLabel.length > 0) {
      console.log(`   ⚠️  ${noLabel.length} segments missing place_label`);
    }
    if (singleSample.length > 0) {
      console.log(`   ⚠️  ${singleSample.length} segments with only 1 sample (single-sample bug?)`);
    }
    console.log('');
  }

  // ============================================================================
  // 3. CHECK LOCATION_HOURLY (aggregated location data)
  // ============================================================================
  console.log('3️⃣  LOCATION_HOURLY (Aggregated Location Data)');
  console.log('─────────────────────────────────────────────────────────\n');

  const { data: hourlyData, error: hourlyError } = await (supabase as any)
    .schema('tm')
    .from('location_hourly')
    .select('hour_start, geohash7, samples, place_label, google_place_name, last_sample_at')
    .eq('user_id', USER_ID)
    .gte('hour_start', `${DATE}T00:00:00`)
    .lt('hour_start', `${DATE}T23:59:59`)
    .order('hour_start', { ascending: true });

  if (hourlyError) {
    console.error('❌ Error fetching location_hourly:', hourlyError.message);
  } else if (!hourlyData || hourlyData.length === 0) {
    console.log('❌ NO LOCATION_HOURLY ROWS FOUND FOR TODAY');
    console.log('   → Hourly aggregation may not be running');
    console.log('   → Check if location_hourly view/table exists\n');
  } else {
    console.log(`✅ Found ${hourlyData.length} hours with location data\n`);
    
    hourlyData.forEach((row: any) => {
      const hour = new Date(row.hour_start).getHours();
      const lastSample = row.last_sample_at ? new Date(row.last_sample_at).toLocaleTimeString() : 'NULL';
      
      console.log(`   ${hour.toString().padStart(2, '0')}:00`);
      console.log(`     Geohash7: ${row.geohash7 || '❌ NULL'}`);
      console.log(`     Samples: ${row.samples || 0}`);
      console.log(`     Place label: ${row.place_label || '❌ NULL'}`);
      console.log(`     Google name: ${row.google_place_name || 'NULL'}`);
      console.log(`     Last sample: ${lastSample}`);
      console.log('');
    });

    // Summary
    const noGeohash = hourlyData.filter((r: any) => !r.geohash7);
    const noLabel = hourlyData.filter((r: any) => !r.place_label);

    if (noGeohash.length > 0) {
      console.log(`   ⚠️  ${noGeohash.length} hours missing geohash7`);
    }
    if (noLabel.length > 0) {
      console.log(`   ⚠️  ${noLabel.length} hours missing place_label`);
    }
    console.log('');
  }

  // ============================================================================
  // 4. CHECK HOURLY_SUMMARIES (CHARLIE pipeline)
  // ============================================================================
  console.log('4️⃣  HOURLY_SUMMARIES (CHARLIE Pipeline)');
  console.log('─────────────────────────────────────────────────────────\n');

  const { data: summariesData, error: summariesError } = await (supabase as any)
    .schema('tm')
    .from('hourly_summaries')
    .select('hour_start, primary_activity, primary_place_label, primary_place_id')
    .eq('user_id', USER_ID)
    .gte('hour_start', `${DATE}T00:00:00`)
    .lt('hour_start', `${DATE}T23:59:59`)
    .order('hour_start', { ascending: true });

  if (summariesError) {
    console.error('❌ Error fetching hourly_summaries:', summariesError.message);
  } else if (!summariesData || summariesData.length === 0) {
    console.log('❌ NO HOURLY_SUMMARIES FOUND FOR TODAY');
    console.log('   → CHARLIE pipeline may not be running\n');
  } else {
    console.log(`✅ Found ${summariesData.length} hourly summaries\n`);
    
    summariesData.forEach((row: any) => {
      const hour = new Date(row.hour_start).getHours();
      
      console.log(`   ${hour.toString().padStart(2, '0')}:00`);
      console.log(`     Activity: ${row.primary_activity || 'NULL'}`);
      console.log(`     Place: "${row.primary_place_label || 'NULL'}" (ID: ${row.primary_place_id || 'NULL'})`);
      console.log('');
    });
  }

  // ============================================================================
  // DIAGNOSIS SUMMARY
  // ============================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 DIAGNOSIS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  const hasSamples = samplesData && samplesData.length > 0;
  const hasSegments = segmentsData && segmentsData.length > 0;
  const hasHourly = hourlyData && hourlyData.length > 0;
  const hasSummaries = summariesData && summariesData.length > 0;

  console.log('Pipeline Status:');
  console.log(`  ${hasSamples ? '✅' : '❌'} Location Samples (raw GPS)`);
  console.log(`  ${hasSegments ? '✅' : '❌'} Activity Segments (BRAVO)`);
  console.log(`  ${hasHourly ? '✅' : '❌'} Location Hourly (aggregation)`);
  console.log(`  ${hasSummaries ? '✅' : '❌'} Hourly Summaries (CHARLIE)`);
  console.log('');

  // Specific issues
  const issues: string[] = [];

  if (!hasSamples) {
    issues.push('🚨 NO GPS DATA - Background location tracking not working');
  }

  if (hasSamples && !hasSegments) {
    issues.push('🚨 BRAVO PIPELINE BROKEN - Segments not being created from samples');
  }

  if (hasSegments && segmentsData) {
    const believeCandleSegments = segmentsData.filter((s: any) => 
      s.place_label?.toLowerCase().includes('believe candle')
    );
    if (believeCandleSegments.length > 1) {
      issues.push(`🚨 MERGE LOGIC NOT WORKING - Found ${believeCandleSegments.length} "Believe Candle Co." segments that should be merged`);
      console.log('   Believe Candle Co. segments:');
      believeCandleSegments.forEach((seg: any, idx: number) => {
        const start = new Date(seg.started_at);
        const end = new Date(seg.ended_at);
        console.log(`     ${idx + 1}. ${start.toLocaleTimeString()} - ${end.toLocaleTimeString()} (ID: ${seg.place_id})`);
      });
      console.log('');
    }
  }

  if (hasSegments && !hasHourly) {
    issues.push('🚨 HOURLY AGGREGATION BROKEN - location_hourly not being populated');
  }

  if (issues.length === 0) {
    console.log('✅ All pipelines operational!');
    console.log('');
    console.log('If blocks still not merging in UI:');
    console.log('  1. Check app version - are recent fixes deployed?');
    console.log('  2. Check merge logic in group-location-blocks.ts');
    console.log('  3. Check if UI is using segment-based grouping');
  } else {
    console.log('❌ Issues Found:');
    issues.forEach(issue => console.log(`   ${issue}`));
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

diagnose().catch(console.error);
