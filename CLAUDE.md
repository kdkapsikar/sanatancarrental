# Project
Trilingual (en/hi/mr) cab + tour booking platform for Chhatrapati Sambhajinagar.
Priorities: SEO quality, price transparency, compliance, WhatsApp-first.
Positioning: outstation, airport, sightseeing and packages — not intra-city ride-hailing.
Source of truth for scope and open questions: `cab-platform-plan.md`. Anything marked [verify] there must be checked, not assumed.

# Non-negotiables
- The fare engine (`packages/fare-engine`) is the only source of prices. UI, bot and emails call it; nothing hardcodes a fare. `apps/web/src/guards.test.ts` fails the build on rupee amounts elsewhere.
- Never claim certifications, reviews or ratings that are not real data in the DB. `AggregateRating` is built only from published `reviews` rows (`packages/seo`), and reviews can only exist for completed bookings (DB trigger).
- Never generate indexable pages from incomplete data records. Pages below `INDEX_COMPLETENESS_THRESHOLD`, or in a locale not yet signed off in `INDEXABLE_LOCALES`, are `noindex` and left out of the sitemap/hreflang.
- Vendors, vehicles or drivers with missing or expired documents cannot receive assignments: `checkEligibility()` in `packages/compliance` is the only gate, and the DB rejects an assignment row whose stored eligibility is not `eligible: true`.
- Respect closing days and drive times in every itinerary.
- All user-facing strings go through i18n (en/hi/mr). Both city names are supported.
- `AGGREGATOR_MODE` stays `false` until the client's lawyer confirms licensing in writing. Do not make legal claims in copy.
- Never invent opening days, fees, distances, timings, prices or reviews. Unknown = `NULL` plus a reason in `needs_verification`.

# Conventions
- TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), npm workspaces, Node ≥22. Relative imports are extensionless (Turbopack requirement).
- **DB:** Drizzle ORM + drizzle-kit migrations (SQL committed in `packages/db/migrations`). PostgreSQL 17 + PostGIS on `localhost:5433` (PG16 on 5432 is unrelated). After `drizzle-kit generate`, check the SQL: drizzle quotes custom types, so `"geography(Point,4326)"` must be unquoted by hand. Integrity rules CHECK can't express go in hand-written migrations (see `0001_integrity_triggers.sql`).
- **Money:** integer paise everywhere. **Distance:** km, billed rounded up to whole km. **Time:** ISO 8601 with offset; business logic uses IST (`Asia/Kolkata`, fixed +05:30).
- **Content provenance:** every Place/Route/Package row has `completeness_score` (computed by `computeCompleteness`, never typed in), `verified_source`, `verified_at` and `needs_verification` (field → reason). A flagged field counts as missing even if a value is present. `verified_source` names where the non-null fields came from; it is not a human sign-off.
- **Fare rules** are versioned DB rows. `is_example` rows can never be active (CHECK), and active rules need `approved_by`. One active rule per vehicle class + trip type.
- **Quotes** are itemised lines plus inclusion/exclusion notes, all as i18n codes (`quote.line.*`, `quote.note.*`). Bookings store the quote JSON and its fingerprint; an invoice must match it.
- **i18n:** next-intl, locale-prefixed URLs (`/en`, `/hi`, `/mr`). Add every new string to all three message files. Hindi/Marathi render for everyone but are indexed only when listed in `INDEXABLE_LOCALES` (default `en`), after native-speaker review. The offline bot's wording lives in `packages/assistant/src/offline-strings.ts` (same three languages).
- **SEO:** canonical city slug token `chhatrapati-sambhajinagar`. Old-name / bare `sambhajinagar` URL tokens 301 via `src/proxy.ts` (Next 16's name for middleware). No FAQPage markup. No meta keywords.
- **Tests:** Vitest projects per package. Fare, compliance, completeness, SEO and i18n logic must have tests. DB integrity tests run against `TEST_DATABASE_URL` and re-migrate it.
- **Commits:** small, with a clear message. Run `npm run typecheck && npm test` before each commit. No secrets in the repo (`.env*` is gitignored; `.env.example` documents the variables).
- **Competitor audit (`/audit`):** respect robots.txt, ≥3 s between requests per host, capped and cached. Raw HTML stays in gitignored `audit/raw/`. Never copy competitor copy, prices or distances into our content or seed data.
- **Assistant (e-Taxi)**: every fact or price it states must come from a tool result in the same turn (`packages/assistant/src/tools.ts`); prices only via `get_quote` → fare engine. New capabilities are new tools, used by both engines. Anything that writes personal data is a proposal the person must confirm (`confirmProposal`), which also records consent. Keep the system prompt stable (it is cached); per-request context goes in the second system block.
- Out of scope until scheduled: payments (Razorpay test mode first) and the vendor portal UI. The WhatsApp channel exists but stays off until credentials are configured.
