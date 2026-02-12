# We Launched Gift-land to Make Gifting Feel Less Like Guesswork

The idea started with a problem that feels small until you live it enough times:

You buy a gift with good intentions.
They open it kindly.
You can tell it is not quite right.

No one says it out loud, but both people lose a little bit of joy.

I wanted to build something that kept the emotional part of gifting, but removed the guesswork.

That is how **Gift-land** started.

## The launch-day idea

The first version was narrowly scoped around Valentine’s Day. I thought I was building a themed microsite. What I actually needed to build was a two-sided product:

- one side for people who curate
- one side for people who choose

The core mechanic became simple:

1. Creator prepares a small gift collection.
2. Creator sends one link.
3. Recipient picks the three gifts they actually want.
4. Creator sees private results and optionally gets a Discord alert.

That one shift changed the tone of the whole app. It stopped being “a cute page” and became a lightweight decision product.

## The first version that felt right

When the flow clicked, it had two routes that mattered:

- `/create` for creators
- `/v/:slug` for recipients

Soon after, we added a third:

- `/v/:slug/results?key=...` for private creator results

That results URL was an important moment. I did not want “private” to mean “security through obscurity.” So each page creation now generates an admin key, returns it once, and stores only a hashed token in Redis.

That design forced the rest of the architecture to get cleaner.

## What we shipped under the hood

Gift-land runs on a pragmatic stack:

- React + TypeScript + Vite on the frontend
- Vercel serverless functions for API routes
- Upstash Redis for config and submissions
- Discord webhooks for optional creator notifications

No framework-heavy abstraction. No database migration layer. Just a deliberately small system with clear responsibilities.

- `api/create` validates and stores page config
- `api/config` exposes only public recipient-safe data
- `api/submit` validates picks, stores submission, optionally notifies Discord
- `api/results` verifies creator key and returns submissions

Keeping each endpoint narrow made iteration fast during launch week.

## The unglamorous work that made launch smoother

The nicest part of launch day is usually not a big feature. It is all the invisible constraints working.

We spent time on things that are easy to postpone in side projects:

### Defensive validation

All text is sanitized and capped. URLs must be valid `http/https`. Gift counts are bounded. Slugs are pattern validated.

That cut off a long tail of edge cases before they reached storage.

### Rate limiting

Every endpoint has per-IP limits and minimum request intervals, with `Retry-After` when blocked.

Not perfect. Still valuable.

### Secret handling

Discord webhooks stay server-side only. Private result keys are hashed and compared timing-safely.

Those two decisions alone prevented most obvious leaks.

### Failure handling on the client

For submission failures, we added a queue in `localStorage` with exponential backoff retries.

That means transient failures do not immediately become lost user intent.

## Product polish that changed behavior

After infrastructure and security were stable, we focused on how the app *felt*.

We added:

- a multi-theme system (19 presets)
- grouped theme discovery for easier selection
- copy that adapts by context (romance, birthday, neutral gift page)
- light celebratory motion (confetti bursts + transitions)

None of these features were “required.” All of them improved completion and share behavior.

The lesson was clear: trust is technical *and* emotional.

## What went wrong (and what we changed)

The first draft of the product had a stronger Valentine identity and weaker general gifting language. That worked for a seasonal launch but limited reuse.

We refactored copy, expanded theme families, and repositioned as **Gift-land** rather than a holiday-only tool.

We also adjusted defaults (theme and contrast) several times because usability beat aesthetics in real usage.

That was humbling and useful.

## What I would tell other builders

If you are launching a side project, this order worked for me:

1. Build the smallest meaningful user loop.
2. Add safety rails before you add more screens.
3. Instrument basic events so you can learn quickly.
4. Improve emotional quality with one layer of polish.
5. Keep your architecture boring and observable.

Gift-land is still a small product, but it now has the shape of software that can grow:

- clear flows
- clear boundaries
- clear trust model

That is what I wanted from this launch: not just a live URL, but a product people can use without wondering if it will break, leak, or feel awkward.

And if it helps one person give a better gift with less guesswork, it already did its job.
