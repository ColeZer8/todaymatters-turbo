#!/usr/bin/env node

/**
 * Debug script to check location label saves in Supabase
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bqbbuysyiyzdtftctvdk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxYmJ1eXN5aXl6ZHRmdGN0dmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MzAzMjEsImV4cCI6MjA3NDMwNjMyMX0.29-1mBIzLl2B5ofJeI_F5pW5k9ZZ3tnuFwRFug-6oFI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('🔍 Debugging location label saves...\n');

  // 1. Get Cole's user ID (assuming he's authenticated via Google OAuth)
  console.log('1️⃣ Finding Cole\'s user ID...');
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();
  
  if (userError) {
    console.error('❌ Error fetching users:', userError);
    // Try alternative approach - check public.users or tm schema
    console.log('\n2️⃣ Checking tm.user_places directly...');
    const { data: places, error: placesError } = await supabase
      .schema('tm')
      .from('user_places')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (placesError) {
      console.error('❌ Error fetching user_places:', placesError);
      return;
    }
    
    console.log(`\n✅ Found ${places?.length || 0} recent user_places entries:`);
    console.table(places?.map(p => ({
      id: p.id.substring(0, 8),
      user_id: p.user_id?.substring(0, 8) || 'null',
      label: p.label,
      geohash7: p.geohash7,
      category: p.category,
      created_at: new Date(p.created_at).toLocaleString(),
    })));
    
    // Get unique user_ids
    const uniqueUserIds = [...new Set(places?.map(p => p.user_id).filter(Boolean))];
    console.log(`\n📊 Unique user IDs with saved places: ${uniqueUserIds.length}`);
    
    // For each user, show their places
    for (const userId of uniqueUserIds) {
      console.log(`\n👤 User ${userId.substring(0, 8)}...'s places:`);
      const userPlaces = places?.filter(p => p.user_id === userId);
      console.table(userPlaces?.map(p => ({
        label: p.label,
        geohash7: p.geohash7,
        category: p.category,
      })));
    }
    
    return;
  }

  console.log(`✅ Found ${users?.users?.length || 0} users in system`);
  
  // Find Cole (likely the most recent or check by email)
  const coleUser = users?.users?.find(u => 
    u.email?.includes('cole') || 
    u.user_metadata?.email?.includes('cole')
  ) || users?.users?.[0]; // fallback to first user
  
  if (!coleUser) {
    console.error('❌ Could not find Cole\'s user');
    return;
  }
  
  console.log(`\n👤 Cole's User ID: ${coleUser.id}`);
  console.log(`📧 Email: ${coleUser.email || 'N/A'}`);
  
  // 2. Check user_places table
  console.log('\n2️⃣ Checking tm.user_places table...');
  const { data: places, error: placesError } = await supabase
    .schema('tm')
    .from('user_places')
    .select('*')
    .eq('user_id', coleUser.id)
    .order('created_at', { ascending: false });
  
  if (placesError) {
    console.error('❌ Error fetching user_places:', placesError);
    return;
  }
  
  console.log(`\n✅ Found ${places?.length || 0} saved places for Cole:`);
  if (places && places.length > 0) {
    console.table(places.map(p => ({
      label: p.label,
      geohash7: p.geohash7,
      category: p.category,
      radius_m: p.radius_m,
      created: new Date(p.created_at).toLocaleString(),
      updated: new Date(p.updated_at).toLocaleString(),
    })));
  } else {
    console.log('⚠️  No saved places found! This explains why labels aren\'t persisting.');
  }
  
  // 3. Check location_hourly to see what geohash7 values are being used
  console.log('\n3️⃣ Checking recent location_hourly geohash7 values...');
  const today = new Date().toISOString().split('T')[0];
  const { data: locationData, error: locError } = await supabase
    .schema('tm')
    .from('location_hourly')
    .select('hour_start, geohash7, place_label, sample_count')
    .eq('user_id', coleUser.id)
    .gte('hour_start', `${today}T00:00:00`)
    .order('hour_start', { ascending: false })
    .limit(10);
  
  if (locError) {
    console.error('❌ Error fetching location_hourly:', locError);
  } else {
    console.log(`\n✅ Found ${locationData?.length || 0} recent location hours:`);
    if (locationData && locationData.length > 0) {
      console.table(locationData.map(l => ({
        hour: new Date(l.hour_start).toLocaleTimeString(),
        geohash7: l.geohash7,
        place_label: l.place_label || '(none)',
        samples: l.sample_count,
      })));
    }
  }
  
  // 4. Check if RLS policies might be blocking
  console.log('\n4️⃣ Testing INSERT permission (simulated save)...');
  const testGeohash = 'test123';
  const testLabel = 'TEST_LOCATION_DEBUG';
  
  const { data: insertData, error: insertError } = await supabase
    .schema('tm')
    .from('user_places')
    .insert({
      user_id: coleUser.id,
      label: testLabel,
      geohash7: testGeohash,
      center: 'POINT(-95.7129 37.0902)', // Geographic center of US
      radius_m: 100,
    })
    .select();
  
  if (insertError) {
    console.error('❌ INSERT failed! RLS might be blocking:', insertError);
  } else {
    console.log('✅ INSERT successful:', insertData);
    
    // Clean up test data
    await supabase
      .schema('tm')
      .from('user_places')
      .delete()
      .eq('user_id', coleUser.id)
      .eq('geohash7', testGeohash);
    console.log('🧹 Test record cleaned up');
  }
  
  console.log('\n📋 Summary:');
  console.log(`- User ID: ${coleUser.id}`);
  console.log(`- Saved places: ${places?.length || 0}`);
  console.log(`- Can INSERT: ${insertError ? '❌ NO' : '✅ YES'}`);
}

main().catch(console.error);
