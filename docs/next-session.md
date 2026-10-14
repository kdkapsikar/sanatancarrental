# Next session proposal: quote → booking flow, payments in test mode

## Preconditions (need the client)
1. At least one **approved fare rule** per vehicle class and trip type (inserted with `approved_by`, `is_example=false`), plus the GST treatment confirmed by their CA.
2. **Measured road distances and drive times** for the launch routes. Pick a maps provider: compare Google Routes API vs an OSM router (OSRM/Valhalla) on cost at expected volume.
3. A **Razorpay test-mode** account with test keys in `.env` (never committed). Advance-payment policy: percentage or fixed, refund/cancellation rules.
4. Business name, phone and address for JSON-LD and invoices.

## Scope
### 1. Quote API (`apps/web/src/app/api/quote/route.ts`)
- Input is validated with zod: trip type, vehicle class, pickup/drop (place id or free text plus coordinates), start/end, passengers, luggage, airport flags.
- Resolve the route: known `routes` row → stored distance; otherwise the maps provider, with the result cached (and flagged as estimated).
- `selectRule()` over active rules → `quote()`. Return the Quote plus a signed, short-lived **quote token** (HMAC of fingerprint + expiry) so a booking can't alter the price.
- Rate limiting (Redis) and no PII in logs.

### 2. Quote widget (server-rendered page plus a small client island)
- Place autocomplete over `places.name` / `aliases` (both city names, Devanagari, transliterations) using pg_trgm.
- Shows itemised lines, inclusions and exclusions (existing `QuoteBreakdown`), and a vehicle-class comparison built from separate quotes (never "same price for every class").
- All strings in messages; hi/mr stay TODO until translated.

### 3. Booking creation
- `POST /api/bookings`: quote token + customer phone/name + consent checkboxes (data processing required; WhatsApp utility optional). Writes `customers`, append-only `consents`, and a `bookings` row with the stored quote, fingerprint and `status='pending_payment'`.
- Reference format, e.g. `CSN-2610-XXXX` (human-readable, unique index).
- Phone OTP is deferred; the WhatsApp bot handles verification later.

### 4. Payments in Razorpay test mode
- Create a Razorpay Order for the advance amount (paise) → `payments` row (`live_mode=false`).
- Checkout on the client, then server-side signature verification and webhook handling (`payment.captured`, `payment.failed`, `refund.processed`), idempotent on `provider_ref`.
- On capture: a ledger txn (debit `cash_gateway_clearing`, credit `customer_advance`) and booking `confirmed`. The balance is collected later (cash/UPI to driver, recorded by the driver PWA in phase 3).
- Refunds per the cancellation policy, as a reversing ledger txn.
- Guard: refuse live keys while `NODE_ENV !== 'production'`, and refuse to start if the key prefix doesn't match `rzp_test_` when test mode is on.

### 5. Manual dispatch (admin-only API, no UI yet)
- `assignVehicle(bookingId, vendorId, vehicleId, driverId)` loads documents → `checkEligibility()` → inserts an `assignments` row with the eligibility snapshot (the DB rejects ineligible ones). `aggregator_partner` vendors are rejected while `AGGREGATOR_MODE=false`.

### 6. Tests
- Quote API contract tests, and a check that the token tampering is rejected.
- Booking + payment happy path and failure paths against the test DB, with Razorpay webhooks replayed from recorded fixtures (no network in CI).
- Ledger balance after capture/refund.
- Invoice total equals the quoted total for an unchanged trip (fingerprint match).

## Explicitly still out of scope
WhatsApp bot, vendor portal UI, driver PWA, live payments, package builder.

## Open decisions for the client
Advance %, cancellation/refund windows, whether tolls are "included (estimate)" or "at actuals" per trip type, night-halt window, waiting-charge blocks, and whether airport transfers are flat or per-km.
