# I Built a Pick-Your-Gift App With React, Vercel, and Upstash Redis

Most gifting apps optimize for the sender.

I wanted to optimize for both people:
- the creator still curates meaningful options
- the recipient gets agency and chooses what they actually want

So I built **Gift-land** (originally a Valentine app): a small web app where creators publish a themed gift page and recipients pick exactly three gifts.

## What the app does

There are two flows:

1. **Creator flow** (`/create`)
- Enter recipient name + message
- Add 3-12 gifts (title, description, image, optional link)
- Pick one of 19 themes
- Optionally add a Discord webhook
- Generate:
  - public link: `/v/:slug`
  - private results link: `/v/:slug/results?key=...`

2. **Recipient flow** (`/v/:slug`)
- View the personalized page
- Choose exactly 3 gifts
- Submit picks
- Creator receives optional Discord notification

## Stack

- React + TypeScript + Vite + Tailwind
- Vercel serverless functions (`api/create`, `api/config`, `api/submit`, `api/results`)
- Upstash Redis for config + submissions
- Discord webhook embeds for notifications

I also used a small custom client-side router instead of bringing in a full routing framework. For this app size, it keeps things fast and easy to reason about.

## Engineering choices that mattered

### 1. Store only hashed admin tokens

The results page is private. When a page is created, the app returns a one-time results key in the URL but stores only `sha256(token)` in Redis.

`/api/results` hashes the incoming key and compares with timing-safe equality.

Outcome: even if storage is leaked, raw admin keys are not.

### 2. Validate and sanitize everything

Before writing anything to storage:
- text fields are sanitized and length-limited
- URLs are required to be valid `http/https`
- slugs are pattern-validated
- gift counts are bounded

Outcome: predictable payload shape and lower abuse surface.

### 3. Add practical rate limiting

Each API endpoint has in-memory rate limiting with:
- per-IP max requests in a time window
- minimum interval between requests
- `Retry-After` headers

Outcome: not enterprise-level, but absolutely worth it for side projects.

### 4. Keep webhook secrets server-side

Creator webhooks are validated and stored only in backend config records. They never appear in client bundles.

Outcome: no accidental credential leak through frontend code.

## UX features that made it feel “real”

- 19 curated themes grouped by mood/use case
- copy changes by theme family (valentine, birthday, neutral)
- confetti bursts at key interaction moments
- share link normalization (`slug`, `/v/...`, or full URL)
- results key stored in session, then removed from URL

These are small touches, but they move the app from “demo” to product.

## Reliability pattern I’d reuse

There is a local submission queue (`localStorage`) with exponential backoff retries.

If submission fails (network/server), the payload is queued and retried later.

Outcome:
- fewer lost actions
- less user frustration
- controlled retries without API hammering

## Test coverage

Vitest tests cover the creator flow API end-to-end behavior (with Redis mocked):
- create endpoint returns links
- config endpoint strips sensitive fields
- submit endpoint persists picks and can notify webhook
- results endpoint enforces hashed key access

Enough testing to ship with confidence, without overbuilding.

## What I learned

1. Small products can still have serious architecture decisions.
2. Security posture is mostly good defaults applied consistently.
3. UX polish is cumulative; tiny details stack into trust.
4. Serverless + Redis is a great pair for lightweight, real-world apps.

If you are building a side project, this is my recommendation: design the emotional core first, then add security and reliability as default behavior, not as “later tasks.”
