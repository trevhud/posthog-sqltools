SELECT event,
  COUNT()
FROM events
GROUP BY event
ORDER BY COUNT() DESC
limit 5