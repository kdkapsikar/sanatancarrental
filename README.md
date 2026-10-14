# Cab + tour platform — Chhatrapati Sambhajinagar

Trilingual (en/hi/mr) outstation, airport and sightseeing booking platform. See `cab-platform-plan.md` for scope and `CLAUDE.md` for the rules every change must follow.

## Layout
| Path | What |
|---|---|
| `apps/web` | Next.js 16 App Router + next-intl + Tailwind 4: home, place and route pages, sitemap, robots |
| `packages/fare-engine` | Pure, itemised quote engine (the only place prices are computed) |
| `packages/compliance` | Document requirements, expiry, vehicle-age and the assignment eligibility gate |
| `packages/seo` | Canonical city slugs, hreflang, completeness-gated sitemap, JSON-LD builders |
| `packages/db` | Drizzle schema, SQL migrations, integrity triggers, seed data with provenance |
| `packages/jobs` | BullMQ queue definitions and a stub worker |
| `packages/assistant` | e-Taxi assistant: Claude + offline engines, tools, proposals, WhatsApp channel |
| `packages/config` | Env schema and feature flags (`AGGREGATOR_MODE=false`) |
| `audit/` | Phase 0 competitor audit scripts, CSVs and `findings.md` |
| `docs/next-session.md` | Proposal for the quote/booking flow and Razorpay test mode |

**ORM choice: Drizzle.** Migrations are plain SQL we commit and review, which matters for PostGIS `geography` columns, CHECK constraints, partial unique indexes and triggers. It has no query-engine binary, and types are inferred from the schema under TS strict. Prisma would have needed `Unsupported("geography")` and raw SQL for most of these guards anyway.

## Setup (macOS / Homebrew)
Prerequisites: Node ≥22, PostgreSQL 17 with PostGIS, Redis. Homebrew's PostGIS bottle supports PG17/18 only, so this machine runs PG17 on **port 5433** next to an existing PG16 on 5432.

```bash
brew install postgresql@17 postgis redis
```
Set `port = 5433` in `/opt/homebrew/var/postgresql@17/postgresql.conf`, then:
```bash
brew services run postgresql@17
```
```bash
brew services run redis
```
```bash
/opt/homebrew/opt/postgresql@17/bin/createdb -p 5433 cab_platform && /opt/homebrew/opt/postgresql@17/bin/createdb -p 5433 cab_platform_test
```
```bash
npm install
```
```bash
cp .env.example .env && cp .env.example apps/web/.env.local
```
```bash
npm run db:migrate && npm run db:seed
```
```bash
npm run typecheck && npm test
```
```bash
npm run build
```
```bash
npm run dev
```
Then open http://localhost:3000/en (also `/hi`, `/mr`, `/sitemap.xml`).

The migrate script enables the `postgis` and `pgcrypto` extensions before applying migrations. The seed is idempotent. DB integrity tests only touch `cab_platform_test`: they re-run migrations there and truncate the tables they fill.

Optional: run the stub job worker (needs Redis) with `npm run worker -w @cab/jobs`.

### Environment
See `.env.example`. `BUSINESS_NAME`, `BUSINESS_PHONE`, `BUSINESS_STREET` and `BUSINESS_POSTCODE` are deliberately absent. Until the client supplies real details, no LocalBusiness JSON-LD is emitted and the header shows a generic label.

## e-Taxi assistant
Built the same way as Saathi (irctc-api-integration), with मदतनीस's front end (e-nagarparishad):
- **Engines**: `ClaudeAssistant` (Claude tool use, streamed; model from `ASSISTANT_MODEL`, effort `low`, server-side refusal fallback on) when `ANTHROPIC_API_KEY` is set, otherwise `OfflineAssistant`. The offline engine matches English/Hindi/Marathi intents and calls the **same tools**. When the daily token cap is reached, the assistant switches to offline mode for the rest of the IST day. Rate limit per IP / WhatsApp sender.
- **Tools** (`packages/assistant/src/tools.ts`): search_places, get_place, list_routes, get_route, list_vehicle_classes, **get_quote** (the fare engine; the only source of prices), explain_fares, site_help, request_callback. Facts come back as verified / not_verified / unknown.
- **Writes are proposals**: request_callback creates a card. Only **Confirm** stores the customer, an append-only consent row (`2026-10-callback-v1`) and a hand-off conversation for the ops team (`conversations.handed_off_to_human`, `handoff_note`). Cards expire after 30 min, run once, and only for their owner.
- **Web**: floating mascot widget with a teaser, quick-reply chips, a streaming panel, confirm cards, mic input and read-aloud (Web Speech API, hidden where unsupported). Website chats are **not stored on the server**; history lives in the tab's sessionStorage.
- **WhatsApp** (`/api/whatsapp/webhook`): verify-token handshake, `X-Hub-Signature-256` check, idempotent per message id, replies inside the 24-hour service window only, quick replies and confirm/cancel as reply buttons. Returns 404 until `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are set. Point the Meta app's webhook at `https://<site>/api/whatsapp/webhook` and subscribe to `messages`. WhatsApp threads **are** stored (`conversation_messages`) for context. **Decide a retention period** (DPDP) before going live.

## Scripts
| Command | Does |
|---|---|
| `npm run typecheck` | `tsc` in every workspace |
| `npm test` | Vitest: fare engine, compliance, completeness, seed guards, DB integrity, SEO, i18n parity, hardcoded-fare guard |
| `npm run db:generate` | `drizzle-kit generate` (then review the SQL; see CLAUDE.md) |
| `npm run db:migrate` / `db:seed` | apply migrations / seed data |
| `npm run audit:*` | re-run the competitor audit (uses the cache in `audit/raw/`) |

## What I could not verify (open items)
Content and facts
- **Ellora weekly closing day:** travel guides say Tuesday, while an ASI page snippet says Monday. `asimustsee.nic.in` did not resolve from this network (shell, browser and fetch all failed). The field is stored as NULL with the conflict recorded.
- **Ajanta closing day (Monday), ASI entry fees and timings** for all monuments: secondary sources only, so they are NULL.
- **Road distances, drive times and toll estimates for all 20 routes:** not sourced, so NULL. Measure them with the chosen maps provider. Do not copy competitor figures. As a result every route scores 0 and is `noindex`.
- **Railway station code CPSN** (renamed 25 Oct 2025?) and the **airport's current official name**.
- **District name for Shirdi/Shani Shingnapur** after the Ahmednagar → Ahilyanagar rename.
- **Hindi/Marathi UI strings** are all `TODO_TRANSLATE` placeholders, so the hi/mr pages are `noindex`. Place names in hi/mr come from Wikipedia interlanguage titles and need a native-speaker check. The city's Hindi name is the official form, not Wikipedia's.
- Coordinates come from Wikipedia (a secondary source).

Commercial / legal (client decisions)
- **Fare rules:** none are active. Only two inactive EXAMPLE rules exist, so the site shows "fares being finalised".
- **GST rate and treatment** for passenger transport and packages (confirm with the client's CA). The engine supports a per-rule GST rate on taxable lines only.
- **Aggregator licence question** (Maharashtra Motor Vehicle Aggregator Rules 2026). The flag stays off. Max vehicle age defaults to 9 years from the *draft* rules; confirm it against the final rules.
- **Document list for vendors/drivers:** the operational baseline from the plan; legal confirmation is needed.
- **Guide credential type** (tourism department).
- **DPDP Act** consent requirements: consent records are append-only, but the current rules haven't been checked.

Assistant
- **Only offline mode has been exercised** end to end. The Claude engine is covered by tests with a mocked SDK; a live run needs `ANTHROPIC_API_KEY` + `ASSISTANT_MODEL` in `.env`.
- **WhatsApp** was tested against a local mock Graph API only. A real sandbox number and BSP/Meta app are needed, plus a decision on message retention.
- **Offline replies are English** for now (hi/mr wording is TODO_TRANSLATE). Marathi and Hindi questions are understood; the Claude engine replies in the user's language.
- **Voice** uses the browser's own speech engines, so quality varies by device. Server-side voice (as मदतनीस does with Bhashini) is not wired in.

Audit gaps
- **Field INP (CrUX):** the PageSpeed Insights API returned 429 without an API key. Lab LCP/CLS/TBT were recorded.
- Backlinks, indexed page counts, GBP ratings and rankings need Search Console, Ahrefs/Semrush or GBP access.
