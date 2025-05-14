-- Funnel analysis query
-- Shows conversion rates between steps in a user journey
WITH step1 AS (
  SELECT distinct_id,
    min(timestamp) as step1_time
  FROM events
  WHERE event = 'page_view'
    AND properties.$current_url = '/signup'
    AND timestamp > now() - INTERVAL 30 DAY
  GROUP BY distinct_id
),
step2 AS (
  SELECT distinct_id,
    min(timestamp) as step2_time
  FROM events
  WHERE event = 'signup_form_submitted'
    AND timestamp > now() - INTERVAL 30 DAY
  GROUP BY distinct_id
),
step3 AS (
  SELECT distinct_id,
    min(timestamp) as step3_time
  FROM events
  WHERE event = 'account_created'
    AND timestamp > now() - INTERVAL 30 DAY
  GROUP BY distinct_id
),
step4 AS (
  SELECT distinct_id,
    min(timestamp) as step4_time
  FROM events
  WHERE event = 'first_project_created'
    AND timestamp > now() - INTERVAL 30 DAY
  GROUP BY distinct_id
)
SELECT count(distinct step1.distinct_id) as viewed_signup_page,
  count(distinct step2.distinct_id) as submitted_form,
  count(distinct step3.distinct_id) as created_account,
  count(distinct step4.distinct_id) as created_project,
  round(
    count(distinct step2.distinct_id) / count(distinct step1.distinct_id) * 100,
    1
  ) as form_submission_rate,
  round(
    count(distinct step3.distinct_id) / count(distinct step2.distinct_id) * 100,
    1
  ) as account_creation_rate,
  round(
    count(distinct step4.distinct_id) / count(distinct step3.distinct_id) * 100,
    1
  ) as project_creation_rate,
  round(
    count(distinct step4.distinct_id) / count(distinct step1.distinct_id) * 100,
    1
  ) as overall_conversion_rate
FROM step1
  LEFT JOIN step2 ON step1.distinct_id = step2.distinct_id
  AND step2.step2_time >= step1.step1_time
  LEFT JOIN step3 ON step2.distinct_id = step3.distinct_id
  AND step3.step3_time >= step2.step2_time
  LEFT JOIN step4 ON step3.distinct_id = step4.distinct_id
  AND step4.step4_time >= step3.step3_time