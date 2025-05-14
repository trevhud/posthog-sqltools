-- Query demonstrating event properties access
-- Shows top event properties and their values for a specific event
SELECT properties.$current_url as page_url,
  properties.$browser as browser,
  properties.$os as operating_system,
  count(*) as event_count
FROM events
WHERE event = 'pageview'
  AND timestamp > now() - INTERVAL 7 DAY
GROUP BY page_url,
  browser,
  operating_system
ORDER BY event_count DESC
LIMIT 20