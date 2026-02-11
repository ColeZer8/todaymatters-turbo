/**
 * Debug script to check location_hourly data for Feb 11, 2026
 * 
 * Run with: npx tsx debug-location-data.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

async function checkLocationData() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Cole's user ID (you'll need to update this)
  const userId = 'YOUR_USER_ID'; // TODO: Update this

  const date = '2026-02-11';
  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59`;

  console.log(`\n🔍 Checking location_hourly data for ${date}...\n`);

  const { data, error } = await (supabase as any)
    .schema('tm')
    .from('location_hourly')
    .select('hour_start, geohash7, sample_count, place_label, google_place_name, radius_m')
    .eq('user_id', userId)
    .gte('hour_start', startOfDay)
    .lte('hour_start', endOfDay)
    .order('hour_start', { ascending: true });

  if (error) {
    console.error('❌ Error fetching data:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('❌ No location_hourly rows found for this date');
    return;
  }

  console.log(`✅ Found ${data.length} hours with location data:\n`);

  // Check specifically for the problem hours
  const problemHours = [0, 1, 4, 5, 6, 7]; // 12 AM, 1 AM, 4 AM - 7 AM

  data.forEach((row: any) => {
    const hour = new Date(row.hour_start).getHours();
    const isProblemHour = problemHours.includes(hour);
    const prefix = isProblemHour ? '⚠️ ' : '  ';
    
    console.log(`${prefix}${hour.toString().padStart(2, '0')}:00`);
    console.log(`   geohash7: ${row.geohash7 || '❌ NULL'}`);
    console.log(`   samples: ${row.sample_count}`);
    console.log(`   place_label: ${row.place_label || '❌ NULL'}`);
    console.log(`   google_place_name: ${row.google_place_name || '❌ NULL'}`);
    console.log(`   radius_m: ${row.radius_m || 'NULL'}`);
    console.log('');
  });

  // Summary
  const hoursWithNoLabel = data.filter((row: any) => !row.place_label);
  const hoursWithNoGeohash = data.filter((row: any) => !row.geohash7);

  console.log('\n📊 Summary:');
  console.log(`  Total hours: ${data.length}`);
  console.log(`  Hours with NO place_label: ${hoursWithNoLabel.length}`);
  console.log(`  Hours with NO geohash7: ${hoursWithNoGeohash.length}`);
  
  if (hoursWithNoLabel.length > 0) {
    console.log('\n⚠️  Hours missing place_label:');
    hoursWithNoLabel.forEach((row: any) => {
      const hour = new Date(row.hour_start).getHours();
      console.log(`  - ${hour}:00 (${row.sample_count} samples, geohash=${row.geohash7 || 'NULL'})`);
    });
  }
}

checkLocationData().catch(console.error);
