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

Audit gaps
- **Field INP (CrUX):** the PageSpeed Insights API returned 429 without an API key. Lab LCP/CLS/TBT were recorded.
- Backlinks, indexed page counts, GBP ratings and rankings need Search Console, Ahrefs/Semrush or GBP access.
