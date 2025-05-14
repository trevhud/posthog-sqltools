-- User retention analysis for the last 30 days
WITH first_seen AS (
  SELECT distinct_id,
    min(timestamp) as first_timestamp
  FROM events
  WHERE timestamp > now() - INTERVAL 30 DAY
  GROUP BY distinct_id
),
cohorts AS (
  SELECT toStartOfWeek(first_timestamp) as cohort_week,
    count(distinct distinct_id) as cohort_size
  FROM first_seen
  GROUP BY cohort_week
  ORDER BY cohort_week
),
weekly_activity AS (
  SELECT fs.distinct_id,
    toStartOfWeek(fs.first_timestamp) as cohort_week,
    toStartOfWeek(e.timestamp) as activity_week
  FROM first_seen fs
    JOIN events e ON fs.distinct_id = e.distinct_id
  WHERE e.timestamp > now() - INTERVAL 30 DAY
  GROUP BY fs.distinct_id,
    cohort_week,
    activity_week
)
SELECT c.cohort_week,
  c.cohort_size,
  wa.activity_week,
  count(distinct wa.distinct_id) as active_users,
  round(
    count(distinct wa.distinct_id) / c.cohort_size * 100,
    1
  ) as retention_percentage
FROM cohorts c
  JOIN weekly_activity wa ON c.cohort_week = wa.cohort_week
GROUP BY c.cohort_week,
  c.cohort_size,
  wa.activity_week
ORDER BY c.cohort_week,
  wa.activity_week