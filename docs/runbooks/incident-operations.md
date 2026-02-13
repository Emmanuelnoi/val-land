# Incident Operations and Ownership

## Environment and Secret Matrix

Production required:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `APP_BASE_URL`
- `ANTI_ABUSE_CHALLENGE_TOKEN`
- `CREATOR_NOTIFY_ENCRYPTION_KEY`
- `HEALTHCHECK_TOKEN`
- `DISCORD_WEBHOOK_URL` (legacy flow only)

## Failure Playbooks

1. Challenge failures spike (`*.challenge_failed`)
   - Verify challenge secret configured and unchanged
   - Verify client can fetch `/api/challenge`
   - Check user-agent/IP consistency through edge/proxy

2. Webhook failures spike (`submit.creator_webhook_failed`, `legacy_submit.webhook_failed`)
   - Validate Discord webhook health
   - Verify outbound connectivity and rate limits
   - Check payload size or content rejection

3. CSP/image issues spike (`client.csp_violation_client`, `client.image_load_error_client`)
   - Inspect blocked hosts/directives from telemetry logs
   - Confirm `vercel.json` CSP policy has expected directives
   - Decide if issue is host outage, bad URL, or policy regression

## Key-Person Risk Controls

1. Keep this runbook and release checklist current.
2. Rotate on-call ownership weekly.
3. Require at least one backup owner for deploy and incident response.
4. Store operational context in docs, not personal chat history.
