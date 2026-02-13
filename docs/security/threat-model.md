# Threat Model (Creator + Recipient Flows)

Date: 2026-02-13

## Scope

- Public endpoints: `create`, `submit`, `valentine`, `challenge`, `config`, `results`, `telemetry`
- Data: recipient metadata, gift links/images, submission choices, optional creator webhook

## Assets

1. Creator webhook secrets
2. Private results admin key
3. Submission integrity (exactly 3 unique gifts)
4. Service availability under abuse

## Trust Boundaries

1. Browser to API boundary (all payloads untrusted)
2. API to KV boundary (persistence and consistency)
3. API to Discord webhook boundary (external dependency)

## Main Threats and Controls

1. Automated abuse / spam
   - Controls: anti-abuse challenge, rate limiting, fail-closed in prod for RL backend failures

2. SSRF and local network targeting via URLs
   - Controls: strict URL sanitization, HTTPS-only public hostname checks

3. Secret leakage
   - Controls: encrypted webhook storage, admin token hashing, secret redaction in logs

4. Host header poisoning
   - Controls: `APP_BASE_URL` canonical origin in production

5. Client-side content policy drift
   - Controls: CSP headers + telemetry for violation events

## Residual Risks

1. External image hosts can still track recipient IP/user-agent.
2. Discord outage can degrade notification reliability.
3. In-memory rate limiter state does not share across regions without Redis.

## Mitigations Planned

1. Optional image proxy mode with domain reputation checks.
2. Alerting on webhook failure ratios and challenge failure spikes.
3. Periodic secret rotation runbook and quarterly tabletop exercise.
