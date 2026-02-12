-- Migration: Add activity detection columns to location_samples
-- Purpose: Store Transistorsoft activity data (walking/driving/still/cycling) for timeline accuracy
-- Bug 1 fix: Activity Detection Not Working

-- Add activity_type column (e.g., 'still', 'walking', 'on_foot', 'running', 'on_bicycle', 'in_vehicle', 'unknown')
ALTER TABLE tm.location_samples
ADD COLUMN IF NOT EXISTS activity_type text NULL;

-- Add activity_confidence column (0-100 percentage)
ALTER TABLE tm.location_samples
ADD COLUMN IF NOT EXISTS activity_confidence smallint NULL CHECK (activity_confidence IS NULL OR (activity_confidence >= 0 AND activity_confidence <= 100));

-- Add is_moving boolean for motion state
ALTER TABLE tm.location_samples
ADD COLUMN IF NOT EXISTS is_moving boolean NULL;

-- Create index for activity type queries
CREATE INDEX IF NOT EXISTS location_samples_activity_type_idx
ON tm.location_samples (user_id, activity_type)
WHERE activity_type IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN tm.location_samples.activity_type IS 'Motion activity type from device sensors: still, walking, on_foot, running, on_bicycle, in_vehicle, unknown';
COMMENT ON COLUMN tm.location_samples.activity_confidence IS 'Confidence percentage (0-100) for the activity detection';
COMMENT ON COLUMN tm.location_samples.is_moving IS 'Whether the device is currently in motion (from Transistorsoft motion change events)';
