-- Advanced time-based filtering examples
-- Shows events for the current quarter
SELECT event,
  count(*) as event_count,
  min(timestamp) as first_seen,
  max(timestamp) as last_seen
FROM events
WHERE -- Filter for events in the current quarter
  toStartOfQuarter(timestamp) = toStartOfQuarter(now())
GROUP BY event
ORDER BY event_count DESC
LIMIT 15 -- Uncomment to use other time-based filters:
  -- Events from last week (Sunday to Saturday)
  -- WHERE toStartOfWeek(timestamp) = toStartOfWeek(now()) - INTERVAL 7 DAY
  -- Events from specific hours of the day (9 AM to 5 PM)
  -- WHERE toHour(timestamp) BETWEEN 9 AND 17
  -- Events from weekdays only (Monday to Friday)
  -- WHERE toDayOfWeek(timestamp) BETWEEN 1 AND 5
  -- Events from a specific date range
  -- WHERE timestamp BETWEEN toDateTime('2023-01-01 00:00:00') AND toDateTime('2023-01-31 23:59:59')