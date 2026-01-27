import type { Json } from "@/lib/supabase/database.types";

export type AndroidLocationSupportStatus =
  | "notAndroid"
  | "expoGo"
  | "available";

export type AndroidLocationSampleSource = "background";

export interface AndroidLocationSample {
  recorded_at: string; // ISO timestamp
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  altitude_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  is_mocked: boolean | null;
  source: AndroidLocationSampleSource;
  dedupe_key: string;
  raw: Json | null;
}
