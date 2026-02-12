# I Built a "Pick-Your-Gift" App So Giving Feels Personal Again

Most gift experiences still feel one-sided.

One person guesses. The other person smiles politely.
Everyone pretends it worked.

I wanted something better: a tiny app where a creator can set up a beautiful gift page, share one link, and let someone pick the three gifts they actually want.

That project became **Gift-land** (originally a Valentine-themed SPA), and it turned into a fun mix of product design, security, and serverless architecture.

If you are building side projects and want to ship something that feels both playful and production-aware, this breakdown is for you.

## What Gift-land Does

At a high level, there are two journeys:

1. **Creator flow** (`/create`)
   - Add recipient name and message
   - Add 3-12 gifts (title, description, image, optional link)
   - Pick a theme
   - Optionally add a creator Discord webhook
   - Generate two links:
     - public share link (`/v/:slug`)
     - private results link (`/v/:slug/results?key=...`)

2. **Recipient flow** (`/v/:slug`)
   - See a curated gift page
   - Pick exactly 3 gifts
   - Submit picks
   - Creator gets optional Discord notification

The detail I care about most: the recipient gets agency, and the creator still gets the joy of curating.

## Stack and Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind
- **Backend**: Vercel Serverless Functions (`api/*`)
- **Storage**: Upstash Redis (REST)
- **Notifications**: Discord webhook embeds

I intentionally kept the frontend as an SPA with a lightweight custom router. Routes are parsed from `window.location` and mapped to:

- home
- create
- recipient (`/v/:slug`)
- results (`/v/:slug/results?key=...`)

That was enough routing power without adding framework overhead.

## The Data Model (Simple, but Practical)

Each created gift page stores:

- `slug`
- `toName`
- `message`
- `gifts[]`
- `creatorNotify` (optional webhook, server-side)
- `adminTokenHash` (never store raw token)
- `theme`
- `createdAt`

Submissions are appended under a separate key (`val:subs:${slug}`), capped to avoid unbounded growth.

Simple key patterns, no ORM, no migrations, easy to reason about.

## Security Decisions That Actually Matter

This project is playful on the surface, but the backend still enforces hard boundaries.

### 1. Strict input validation + sanitization

All endpoints sanitize text and URLs, and reject malformed payloads early.

- Gift counts are bounded
- URLs must be `http` or `https`
- Slugs are constrained to a safe pattern

### 2. Rate limiting at the edge function level

Each API route has an in-memory limiter with:

- max requests per window
- minimum interval between requests
- `Retry-After` response headers

This is not enterprise-grade distributed rate limiting, but it is a real abuse guard for a side project and a big step above "no protection."

### 3. Private results with hashed token + timing-safe compare

When a creator page is generated, the app creates an admin token, returns it once in the results URL, and stores only `sha256(token)`.

Later, `/api/results` validates using timing-safe comparison.

That means leaked storage does not expose raw admin keys.

### 4. Webhooks never exposed client-side

Creator webhook URLs are validated server-side and stored only in backend config records.

No webhook secrets in browser code. No accidental frontend leaks.

## UX Choices That Made It Feel Better

I did not want this to be "just a form + submit button." A few small decisions made a big difference:

- **Theme system with 19 presets** across romance, birthday, color, and mono groups
- **Theme-family copy adaptation** so text tone matches context (valentine, birthday, or neutral gifting)
- **Confetti bursts + micro-transitions** around key moments (first yes, final selection)
- **Share link normalization** so users can paste full URLs, slugs, or `/v/...` paths
- **Session-based key persistence** for results pages, then URL key cleanup for better safety

These are tiny touches individually. Together, they make the product feel intentional.

## Reliability: Handling Failure Gracefully

One part I am proud of is the fallback queue logic.

The project includes a local submission queue that can store failed submissions in `localStorage` and retry with exponential backoff.

That pattern gives you:

- better resilience against transient network errors
- no immediate data loss for a user action
- controlled retry cadence (not hammering the API)

For small projects, this is a surprisingly high-leverage reliability upgrade.

## Tests Kept the API Honest

I added Vitest coverage for the core creator flow, including:

- create endpoint returning share/results links
- public config omitting sensitive fields
- submit endpoint persisting picks and triggering webhook
- results endpoint validating key hashes correctly

I use Redis mocking in tests so I can verify behavior without real infrastructure.

For side projects, this level of testing is enough to ship confidently without getting buried in test scaffolding.

## What I Learned Building This

1. **A narrow product can still be deep engineering work.**
2. **Security posture is mostly about good defaults, not complexity.**
3. **Small UX details are where delight actually happens.**
4. **Serverless + Redis is a great combo for "real" lightweight apps.**
5. **If you design for joy, users forgive a lot of missing features.**

## If You Want to Build Something Similar

Start with this order:

1. Build the recipient experience first (the emotional core).
2. Add creator tooling second.
3. Protect sensitive flows early (hashed keys, rate limits, validation).
4. Add one delightful visual layer (themes, motion, or sound).
5. Ship, watch behavior, then iterate quickly.

The point is not to build "a Valentine app." The point is to build software that helps people create meaningful moments with very little friction.

That is the kind of product users remember.

---

If you want, I can also turn this into:

- a shorter dev.to version (~4 min read)
- a more narrative Medium version with launch-story framing
- a version with architecture diagrams and code snippets
