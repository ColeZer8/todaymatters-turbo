-- Count all Private Event meetings for Paul
SELECT 
  COUNT(*) as total_private_events,
  MIN(scheduled_start) as earliest,
  MAX(scheduled_end) as latest
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND type = 'meeting'
  AND title = 'Private Event';

-- Sample 10 Private Events to see date range
SELECT 
  id,
  title,
  scheduled_start,
  scheduled_end,
  EXTRACT(EPOCH FROM (scheduled_end - scheduled_start))/3600 as duration_hours
FROM tm.events
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND type = 'meeting'
  AND title = 'Private Event'
ORDER BY scheduled_start DESC
LIMIT 10;
