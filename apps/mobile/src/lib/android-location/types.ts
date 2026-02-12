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
  // Activity detection from Transistorsoft (matches iOS fields)
  /** Motion activity type: 'still', 'walking', 'on_foot', 'running', 'on_bicycle', 'in_vehicle', 'unknown' */
  activity_type: string | null;
  /** Confidence percentage (0-100) for activity detection */
  activity_confidence: number | null;
  /** Whether device is currently in motion */
  is_moving: boolean | null;
}
