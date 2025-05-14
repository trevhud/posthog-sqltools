-- Query demonstrating person properties and time-based functions
-- Shows active users with their browser information for the last 7 days
SELECT person.properties.$initial_browser as browser,
  person.properties.$initial_browser_version as browser_version,
  count(distinct person_id) as unique_users,
  count(*) as total_events
FROM events
  LEFT JOIN persons ON events.person_id = persons.id
WHERE timestamp > now() - INTERVAL 7 DAY
  AND person.properties.$initial_browser IS NOT NULL
GROUP BY browser,
  browser_version
ORDER BY unique_users DESC,
  browser
LIMIT 20