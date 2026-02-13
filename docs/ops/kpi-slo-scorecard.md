# KPI + SLO Scorecard

This project now tracks one core SLO and three weekly product/reliability KPIs.

## Core SLO

Service: creator flow (`/create` submit path through `POST /api/create`)

Objective: availability and reliability for valid requests.

- SLI: `successful_create_requests / total_valid_create_requests`
- Target: `>= 99.5%` rolling 30 days
- Error budget: `0.5%` failed valid requests
- Burn alerts:
  - Fast burn: `> 5%` failures over 1 hour
  - Slow burn: `> 1%` failures over 24 hours

## Weekly KPIs

1. Creator Success Rate
   - Formula: `create.success / (create.success + create.invalid_payload + create.challenge_failed + create.kv_error + create.rate_limited)`
   - Target: `>= 95%`

2. Recipient Completion Rate
   - Formula: `submit.success / create.success`
   - Target: `>= 55%`

3. Trust and Delivery Reliability
   - Formula A: `submit.creator_webhook_sent / (submit.creator_webhook_sent + submit.creator_webhook_failed)`
   - Formula B: count of `client.csp_violation_client` + `client.image_load_error_client`
   - Targets:
     - A `>= 98%`
     - B week-over-week downward trend

## Data Sources

- Server logs from API events (`create.*`, `submit.*`, `legacy_submit.*`, `challenge.*`, `client.*`)
- Client telemetry endpoint (`POST /api/telemetry`)
- CI contract tests (`npm run test:contract`)

## Weekly Review Ritual

Every Monday:

1. Export previous 7 days API logs.
2. Compute scorecard values and compare with targets.
3. Record top 3 regressions and 3 wins.
4. Convert each regression into an owner + due date.
