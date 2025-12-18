-- ============================================================================
-- Profile Values Table DDL
-- ============================================================================
-- Table: tm.profile_values
-- Purpose: Store user's core values (e.g., "Family", "Integrity", "Creativity")
--          with ordering via rank field
-- ============================================================================

-- Create the table in tm schema
CREATE TABLE IF NOT EXISTS tm.profile_values (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Foreign key to auth.users
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- The actual value text (e.g., "Family", "Integrity")
    value_label TEXT NOT NULL,
    
    -- Ordering/rank (0 = first, 1 = second, etc.)
    -- Nullable to allow flexibility, but typically set
    rank INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Index for fetching all values for a user (most common query)
CREATE INDEX IF NOT EXISTS idx_profile_values_user_id 
    ON tm.profile_values(user_id);

-- Composite index for ordered queries (user_id + rank)
CREATE INDEX IF NOT EXISTS idx_profile_values_user_rank 
    ON tm.profile_values(user_id, rank);

-- ============================================================================
-- Constraints
-- ============================================================================

-- Prevent duplicate values for the same user
-- (User can't have "Family" twice)
ALTER TABLE tm.profile_values
    ADD CONSTRAINT profile_values_user_value_unique 
    UNIQUE (user_id, value_label);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE tm.profile_values ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile values
CREATE POLICY "Users can view own profile values"
    ON tm.profile_values
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own profile values
CREATE POLICY "Users can insert own profile values"
    ON tm.profile_values
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own profile values
CREATE POLICY "Users can update own profile values"
    ON tm.profile_values
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own profile values
CREATE POLICY "Users can delete own profile values"
    ON tm.profile_values
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- Trigger for updated_at timestamp
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION tm.update_profile_values_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER profile_values_updated_at
    BEFORE UPDATE ON tm.profile_values
    FOR EACH ROW
    EXECUTE FUNCTION tm.update_profile_values_updated_at();

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Grant usage on schema (if not already granted)
GRANT USAGE ON SCHEMA tm TO anon, authenticated;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON tm.profile_values TO authenticated;

-- ============================================================================
-- Notes
-- ============================================================================
-- 
-- Column Details:
--   - id: UUID primary key, auto-generated
--   - user_id: UUID, references auth.users(id), required
--   - value_label: TEXT, the actual value text, required
--   - rank: INTEGER, ordering (0 = first, 1 = second, etc.), nullable
--   - created_at: TIMESTAMPTZ, auto-set on insert
--   - updated_at: TIMESTAMPTZ, auto-updated on row change
--
-- Usage Example:
--   INSERT INTO tm.profile_values (user_id, value_label, rank)
--   VALUES 
--     ('user-uuid-here', 'Family', 0),
--     ('user-uuid-here', 'Integrity', 1),
--     ('user-uuid-here', 'Creativity', 2);
--
-- Query Example:
--   SELECT value_label, rank 
--   FROM tm.profile_values 
--   WHERE user_id = 'user-uuid-here'
--   ORDER BY rank ASC;
--
