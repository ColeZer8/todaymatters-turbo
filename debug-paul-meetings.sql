-- Debug Paul's duplicate meetings issue
-- User: Paul Graeve (find his user_id first)

-- Find Paul's user_id
SELECT id, email FROM auth.users WHERE email LIKE '%paul%' OR email LIKE '%graeve%' LIMIT 5;

-- Check tm.events for duplicate meetings
SELECT 
    local_date,
    title,
    type,
    COUNT(*) as count,
    MIN(id) as first_id,
    MAX(created_at) as latest_created
FROM tm.events
WHERE user_id = (SELECT id FROM auth.users WHERE email LIKE '%paul%' LIMIT 1)
    AND title LIKE '%Meeting%'
    AND local_date = '2026-02-10'
GROUP BY local_date, title, type
HAVING COUNT(*) > 1
ORDER BY count DESC
LIMIT 20;

-- Check public.events for duplicates (if exists)
SELECT 
    local_date,
    title,
    type,
    COUNT(*) as count
FROM public.events
WHERE user_id = (SELECT id FROM auth.users WHERE email LIKE '%paul%' LIMIT 1)
    AND title LIKE '%Meeting%'
    AND local_date = '2026-02-10'
GROUP BY local_date, title, type
HAVING COUNT(*) > 1
ORDER BY count DESC
LIMIT 20;

-- Check all events for Paul today to see pattern
SELECT 
    id,
    title,
    type,
    scheduled_start_iso,
    scheduled_end_iso,
    meta,
    created_at
FROM tm.events
WHERE user_id = (SELECT id FROM auth.users WHERE email LIKE '%paul%' LIMIT 1)
    AND local_date = '2026-02-10'
    AND title LIKE '%Meeting%'
ORDER BY scheduled_start_iso
LIMIT 50;
