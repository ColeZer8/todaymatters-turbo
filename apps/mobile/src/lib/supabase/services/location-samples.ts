import { supabase } from '../client';
import { handleSupabaseError } from '../utils/error-handler';
import type { Database } from '../database.types';

type LocationSamplesInsert = Database['tm']['Tables']['location_samples']['Insert'];

interface LocationSampleLike {
  recorded_at: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  altitude_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  is_mocked: boolean | null;
  source: string;
  dedupe_key: string;
  raw: LocationSamplesInsert['raw'];
}

export async function upsertLocationSamples(userId: string, samples: LocationSampleLike[]): Promise<void> {
  if (samples.length === 0) return;

  const rows: LocationSamplesInsert[] = samples.map((s) => ({
    user_id: userId,
    recorded_at: s.recorded_at,
    latitude: s.latitude,
    longitude: s.longitude,
    accuracy_m: s.accuracy_m,
    altitude_m: s.altitude_m,
    speed_mps: s.speed_mps,
    heading_deg: s.heading_deg,
    is_mocked: s.is_mocked,
    source: s.source,
    dedupe_key: s.dedupe_key,
    raw: s.raw,
  }));

  const { error } = await supabase
    .schema('tm')
    .from('location_samples')
    .upsert(rows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true });

  if (error) {
    throw handleSupabaseError(error);
  }
}


