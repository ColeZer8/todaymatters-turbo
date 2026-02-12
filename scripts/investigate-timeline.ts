/**
 * Timeline Accuracy Investigation Script
 * Analyzes location_samples and activity_segments for Feb 11, 2026
 * User: Paul/Gravy (b9ca3335-9929-4d54-a3fc-18883c5f3375)
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = 'https://bqbbuysyiyzdtftctvdk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxYmJ1eXN5aXl6ZHRmdGN0dmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MzAzMjEsImV4cCI6MjA3NDMwNjMyMX0.29-1mBIzLl2B5ofJeI_F5pW5k9ZZ3tnuFwRFug-6oFI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const USER_ID = 'b9ca3335-9929-4d54-a3fc-18883c5f3375';

// Helper: Calculate distance in meters between two coordinates
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + 
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function investigateTimeline() {
  console.log('='.repeat(80));
  console.log('TIMELINE ACCURACY INVESTIGATION');
  console.log('User: Paul/Gravy (b9ca3335-9929-4d54-a3fc-18883c5f3375)');
  console.log('Date: Feb 11, 2026');
  console.log('='.repeat(80));
  console.log();

  // ===== PART 1: Raw Location Samples 5:30 PM - 7:00 PM =====
  console.log('█ PART 1: Raw Location Samples (5:30 PM - 7:00 PM CST)');
  console.log('-'.repeat(80));

  const { data: samples, error: samplesError } = await supabase
    .schema('tm')
    .from('location_samples')
    .select('recorded_at, latitude, longitude, speed_mps, heading_deg, accuracy_meters, activity_type')
    .eq('user_id', USER_ID)
    .gte('recorded_at', '2026-02-11T23:30:00Z') // 5:30 PM CST = 23:30 UTC
    .lte('recorded_at', '2026-02-12T01:00:00Z') // 7:00 PM CST = 01:00 UTC next day
    .order('recorded_at', { ascending: true });

  if (samplesError) {
    console.error('Error fetching samples:', samplesError);
    return;
  }

  console.log(`Found ${samples?.length || 0} samples in time range`);
  console.log();

  if (samples && samples.length > 0) {
    console.log('Time (CST)       | Lat        | Lon         | Speed | Distance | Activity');
    console.log('-'.repeat(80));

    let prevSample: any = null;
    for (const sample of samples) {
      const time = new Date(sample.recorded_at);
      const cstTime = new Date(time.getTime() - 6 * 60 * 60 * 1000);
      const timeStr = cstTime.toISOString().substring(11, 19);
      
      let distFromPrev = '';
      if (prevSample) {
        const dist = haversineDistance(
          prevSample.latitude, prevSample.longitude,
          sample.latitude, sample.longitude
        );
        distFromPrev = `${dist.toFixed(1)}m`;
      }

      console.log(
        `${timeStr} | ${sample.latitude?.toFixed(6)} | ${sample.longitude?.toFixed(6)} | ` +
        `${(sample.speed_mps || 0).toFixed(2)} | ${distFromPrev.padStart(8)} | ${sample.activity_type || '-'}`
      );

      prevSample = sample;
    }
  }
  console.log();

  // ===== PART 2: Activity Segments for the day =====
  console.log('█ PART 2: Activity Segments Created');
  console.log('-'.repeat(80));

  const { data: segments, error: segmentsError } = await supabase
    .schema('tm')
    .from('activity_segments')
    .select('id, started_at, ended_at, place_category, place_label, sample_count, inferred_activity, distance_m, latitude, longitude')
    .eq('user_id', USER_ID)
    .gte('started_at', '2026-02-11T17:00:00-06:00') // 5 PM CST
    .order('started_at', { ascending: true });

  if (segmentsError) {
    console.error('Error fetching segments:', segmentsError);
    return;
  }

  console.log(`Found ${segments?.length || 0} segments`);
  console.log();

  if (segments && segments.length > 0) {
    console.log('Start    | End      | Activity   | Place Label          | Samples | Distance');
    console.log('-'.repeat(80));

    for (const seg of segments) {
      const startTime = new Date(seg.started_at);
      const endTime = new Date(seg.ended_at);
      const startCst = new Date(startTime.getTime() - 6 * 60 * 60 * 1000);
      const endCst = new Date(endTime.getTime() - 6 * 60 * 60 * 1000);

      console.log(
        `${startCst.toISOString().substring(11, 16)} | ${endCst.toISOString().substring(11, 16)} | ` +
        `${(seg.inferred_activity || 'unknown').padEnd(10)} | ${(seg.place_label || '-').slice(0, 20).padEnd(20)} | ` +
        `${(seg.sample_count || 0).toString().padStart(7)} | ${(seg.distance_m || 0).toFixed(0)}m`
      );
    }
  }
  console.log();

  // ===== PART 3: Detailed analysis of 6:00-7:50 PM samples =====
  console.log('█ PART 3: Detailed Analysis 6:00 PM - 8:00 PM CST');
  console.log('-'.repeat(80));

  const { data: detailedSamples, error: detailedError } = await supabase
    .schema('tm')
    .from('location_samples')
    .select('recorded_at, latitude, longitude, speed_mps, accuracy_meters')
    .eq('user_id', USER_ID)
    .gte('recorded_at', '2026-02-12T00:00:00Z') // 6:00 PM CST = 00:00 UTC next day
    .lte('recorded_at', '2026-02-12T02:00:00Z') // 8:00 PM CST = 02:00 UTC
    .order('recorded_at', { ascending: true });

  if (detailedError) {
    console.error('Error fetching detailed samples:', detailedError);
    return;
  }

  console.log(`Found ${detailedSamples?.length || 0} samples in 6PM-8PM window`);
  console.log();

  if (detailedSamples && detailedSamples.length > 0) {
    // Calculate statistics
    let totalSpeed = 0;
    let maxSpeed = 0;
    let totalDistance = 0;
    let maxDistBetweenSamples = 0;
    let prevDSample: any = null;
    
    const locations: {lat: number, lon: number}[] = [];

    for (const sample of detailedSamples) {
      totalSpeed += sample.speed_mps || 0;
      maxSpeed = Math.max(maxSpeed, sample.speed_mps || 0);
      
      locations.push({ lat: sample.latitude, lon: sample.longitude });
      
      if (prevDSample) {
        const dist = haversineDistance(
          prevDSample.latitude, prevDSample.longitude,
          sample.latitude, sample.longitude
        );
        totalDistance += dist;
        maxDistBetweenSamples = Math.max(maxDistBetweenSamples, dist);
      }
      prevDSample = sample;
    }

    const avgSpeed = totalSpeed / detailedSamples.length;

    console.log('Statistics:');
    console.log(`  Avg Speed: ${avgSpeed.toFixed(3)} m/s`);
    console.log(`  Max Speed: ${maxSpeed.toFixed(3)} m/s`);
    console.log(`  Total cumulative distance: ${totalDistance.toFixed(1)} m`);
    console.log(`  Max distance between consecutive samples: ${maxDistBetweenSamples.toFixed(1)} m`);
    console.log();

    // Analyze GPS jitter / drift
    if (locations.length > 2) {
      // Find centroid
      const avgLat = locations.reduce((sum, l) => sum + l.lat, 0) / locations.length;
      const avgLon = locations.reduce((sum, l) => sum + l.lon, 0) / locations.length;
      
      let maxDeviation = 0;
      let totalDeviation = 0;
      for (const loc of locations) {
        const dev = haversineDistance(avgLat, avgLon, loc.lat, loc.lon);
        maxDeviation = Math.max(maxDeviation, dev);
        totalDeviation += dev;
      }
      const avgDeviation = totalDeviation / locations.length;

      console.log('GPS Cluster Analysis (6PM-8PM):');
      console.log(`  Centroid: ${avgLat.toFixed(6)}, ${avgLon.toFixed(6)}`);
      console.log(`  Avg deviation from centroid: ${avgDeviation.toFixed(1)} m`);
      console.log(`  Max deviation from centroid: ${maxDeviation.toFixed(1)} m`);
      console.log();

      console.log('Individual sample details:');
      console.log('Time (CST) | Speed    | Dist from prev | Deviation from centroid');
      console.log('-'.repeat(70));

      let prevS: any = null;
      for (const sample of detailedSamples) {
        const time = new Date(sample.recorded_at);
        const cstTime = new Date(time.getTime() - 6 * 60 * 60 * 1000);
        const timeStr = cstTime.toISOString().substring(11, 19);
        
        const deviation = haversineDistance(avgLat, avgLon, sample.latitude, sample.longitude);
        let distFromPrev = 0;
        if (prevS) {
          distFromPrev = haversineDistance(prevS.latitude, prevS.longitude, sample.latitude, sample.longitude);
        }

        console.log(
          `${timeStr}  | ${(sample.speed_mps || 0).toFixed(3)} m/s | ${distFromPrev.toFixed(1).padStart(13)}m | ${deviation.toFixed(1)}m`
        );
        prevS = sample;
      }
    }
  }
  console.log();

  // ===== PART 4: Check segment creation logic parameters =====
  console.log('█ PART 4: Threshold Analysis');
  console.log('-'.repeat(80));
  console.log();
  console.log('Current system thresholds (from code):');
  console.log('  - Anchor clustering radius: 200m');
  console.log('  - Commute detection: speed > 1 m/s OR distance > 100m');
  console.log();
  console.log('Issues identified:');
  console.log('  1. OR condition is too loose - GPS jitter of ~30m can trigger false commute');
  console.log('  2. No minimum duration check for stationary stops');
  console.log('  3. No smoothing/averaging of GPS positions');
  console.log();

  // ===== PART 5: All samples for the day =====
  console.log('█ PART 5: Full Day Sample Count');
  console.log('-'.repeat(80));

  const { data: allDaySamples, error: allDayError } = await supabase
    .schema('tm')
    .from('location_samples')
    .select('recorded_at, latitude, longitude, speed_mps')
    .eq('user_id', USER_ID)
    .gte('recorded_at', '2026-02-11T06:00:00Z') // Midnight CST
    .lte('recorded_at', '2026-02-12T06:00:00Z')
    .order('recorded_at', { ascending: true });

  if (!allDayError && allDaySamples) {
    console.log(`Total samples for Feb 11: ${allDaySamples.length}`);
    
    // Bucket by hour
    const hourBuckets: Record<number, number> = {};
    for (const s of allDaySamples) {
      const time = new Date(s.recorded_at);
      const cstHour = (time.getUTCHours() - 6 + 24) % 24;
      hourBuckets[cstHour] = (hourBuckets[cstHour] || 0) + 1;
    }
    
    console.log('Samples per hour (CST):');
    for (let h = 0; h < 24; h++) {
      if (hourBuckets[h]) {
        console.log(`  ${h.toString().padStart(2, '0')}:00 - ${(hourBuckets[h] || 0)} samples`);
      }
    }
  }
  
  console.log();
  console.log('='.repeat(80));
  console.log('INVESTIGATION COMPLETE');
  console.log('='.repeat(80));
}

investigateTimeline().catch(console.error);
