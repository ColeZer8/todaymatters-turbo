/**
 * Supabase Database Types
 *
 * Generate types from your Supabase database schema using:
 * npx supabase gen types typescript --project-id your-project-ref > src/lib/supabase/types.ts
 *
 * Or for local development:
 * npx supabase gen types typescript --local > src/lib/supabase/types.ts
 */

// Placeholder types - replace with generated types from Supabase CLI
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // Add your table types here after generating from Supabase
      [key: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };
    Views: {
      [key: string]: {
        Row: Record<string, unknown>;
      };
    };
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
  };
}
