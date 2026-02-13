# ADR 0001: External Image Delivery and CSP Strategy

Date: 2026-02-13

Status: Accepted

## Context

Gift images are user-provided HTTPS URLs. Blocking to a fixed allowlist reduces abuse surface, but breaks normal creator use cases (Amazon, Walmart, Samsung, etc.). We need security controls without hard-blocking legitimate domains.

## Decision

Use direct HTTPS image loading from arbitrary public hosts and constrain risk with telemetry + browser policy.

- Keep CSP `img-src 'self' data: https:`
- Keep API URL validation strict (`sanitizePublicHttpsUrl`) to prevent local/private-network fetch targets
- Instrument client failures:
  - CSP violations (`securitypolicyviolation`)
  - image load failures (`window error` capture for `<img>`)
- Instrument server for webhook and challenge failures

## Tradeoffs

Pros:

- Maximum creator flexibility
- No allowlist maintenance overhead
- Fewer false negatives for valid commerce links

Cons:

- More third-party tracking/image beacon exposure at render time
- Harder to guarantee performance/availability of remote assets
- Abuse detection depends on observability and response process

## Alternatives Considered

1. Static domain allowlist
   - Rejected: too restrictive for user-generated links
2. Server-side image proxy/CDN rewrite
   - Deferred: stronger control but adds infra cost and abuse surface to backend

## Follow-ups

1. Add optional proxy mode once traffic justifies infra cost.
2. Add image hostname reputation checks for known abuse domains.
3. Add dashboard for top failing image hosts.
