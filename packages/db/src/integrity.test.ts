// Database-level integrity tests against TEST_DATABASE_URL (a throwaway DB).
// Skipped, with a warning, only if the test database is unreachable.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const URL_ = process.env["TEST_DATABASE_URL"] ?? "postgres://localhost:5433/cab_platform_test";
const sql = postgres(URL_, { max: 1, onnotice: () => {} });

let reachable = true;
try {
  await sql`select 1`;
} catch {
  reachable = false;
  console.warn(`[db integrity tests] skipped: cannot reach ${URL_}`);
}

describe.runIf(reachable)("database integrity", () => {
  beforeAll(() => {
    // Fresh schema each run.
    execFileSync(
      "npx",
      ["tsx", fileURLToPath(new URL("./migrate.ts", import.meta.url)), URL_],
      { stdio: "pipe", env: { ...process.env, DATABASE_URL: URL_ } },
    );
  }, 60_000);
  afterAll(() => sql.end());

  async function fixtures() {
    await sql`truncate vehicle_classes, vendors, customers, places cascade`;
    await sql`insert into vehicle_classes (code, name, seats) values ('sedan', '{"en":"Sedan"}', 4)`;
    const [rule] = await sql`
      insert into fare_rules (vehicle_class_code, trip_type, version, rule, is_example)
      values ('sedan', 'outstation_round_trip', 1, '{}', true) returning id`;
    const [cust] = await sql`insert into customers (phone) values ('+910000000001') returning id`;
    const booking = async (status: string) => {
      const [b] = await sql`
        insert into bookings (reference, customer_id, status, channel, locale, trip_type,
          vehicle_class_code, pickup_text, start_at, passengers, fare_rule_id, quote,
          quote_fingerprint, quoted_total_paise, completed_at)
        values (${"T-" + Math.random().toString(36).slice(2, 8)}, ${cust!.id}, ${status}, 'web', 'en',
          'outstation_round_trip', 'sedan', 'test', now(), 2, ${rule!.id}, '{}', 'fp', 0,
          ${status === "completed" ? sql`now()` : null})
        returning id`;
      return b!.id as string;
    };
    return { ruleId: rule!.id as string, customerId: cust!.id as string, booking };
  }

  it("an example fare rule can never be active", async () => {
    const { ruleId } = await fixtures();
    await expect(
      sql`update fare_rules set is_active = true, approved_by = 'x' where id = ${ruleId}`,
    ).rejects.toThrow(/fare_rules_example_never_active/);
  });

  it("an active fare rule needs an approver", async () => {
    await fixtures();
    await expect(
      sql`insert into fare_rules (vehicle_class_code, trip_type, version, rule, is_active)
          values ('sedan', 'local', 1, '{}', true)`,
    ).rejects.toThrow(/fare_rules_active_needs_approval/);
  });

  it("reviews require a completed booking by the same customer", async () => {
    const { booking, customerId } = await fixtures();
    const pending = await booking("confirmed");
    await expect(
      sql`insert into reviews (booking_id, customer_id, rating, locale)
          values (${pending}, ${customerId}, 5, 'en')`,
    ).rejects.toThrow(/completed booking/);
    const done = await booking("completed");
    await sql`insert into reviews (booking_id, customer_id, rating, locale)
              values (${done}, ${customerId}, 4, 'en')`;
    await expect(
      sql`insert into reviews (booking_id, customer_id, rating, locale)
          values (${done}, ${customerId}, 5, 'en')`,
    ).rejects.toThrow(/reviews_booking_uq/);
  });

  it("ledger transactions must balance and are append-only", async () => {
    await fixtures();
    const txn = crypto.randomUUID();
    await expect(
      sql.begin(async (tx) => {
        await tx`insert into ledger_entries (txn_id, account, direction, amount_paise)
                 values (${txn}, 'customer_receivable', 'debit', 1000)`;
        await tx`insert into ledger_entries (txn_id, account, direction, amount_paise)
                 values (${txn}, 'platform_revenue', 'credit', 900)`;
      }),
    ).rejects.toThrow(/does not balance/);

    const ok = crypto.randomUUID();
    await sql.begin(async (tx) => {
      await tx`insert into ledger_entries (txn_id, account, direction, amount_paise)
               values (${ok}, 'customer_receivable', 'debit', 1000)`;
      await tx`insert into ledger_entries (txn_id, account, direction, amount_paise)
               values (${ok}, 'platform_revenue', 'credit', 1000)`;
    });
    await expect(sql`delete from ledger_entries where txn_id = ${ok}`).rejects.toThrow(/append-only/);
  });

  it("a document belongs to exactly one owner matching owner_kind", async () => {
    await fixtures();
    const [v] = await sql`insert into vendors (kind, legal_name, display_name, phone)
                          values ('own_fleet', 'T', 'T', '+910000000002') returning id`;
    await expect(
      sql`insert into documents (owner_kind, vehicle_id, type) values ('vendor', null, 'vendor_kyc')`,
    ).rejects.toThrow(/documents_single_owner/);
    await sql`insert into documents (owner_kind, vendor_id, type) values ('vendor', ${v!.id}, 'vendor_kyc')`;
  });

  it("an assignment cannot be stored with a failed eligibility result", async () => {
    const { booking } = await fixtures();
    const b = await booking("confirmed");
    const [v] = await sql`insert into vendors (kind, legal_name, display_name, phone)
                          values ('own_fleet', 'T', 'T', '+910000000003') returning id`;
    const [veh] = await sql`insert into vehicles (vendor_id, vehicle_class_code, registration_number, make_model)
                            values (${v!.id}, 'sedan', 'MH20XX0000', 'Test') returning id`;
    const [d] = await sql`insert into drivers (vendor_id, full_name, phone)
                          values (${v!.id}, 'D', '+910000000004') returning id`;
    await expect(
      sql`insert into assignments (booking_id, vendor_id, vehicle_id, driver_id, eligibility)
          values (${b}, ${v!.id}, ${veh!.id}, ${d!.id}, ${sql.json({ eligible: false, reasons: [], warnings: [] })})`,
    ).rejects.toThrow(/assignments_only_if_eligible/);
  });

  it("stores and reads a PostGIS point", async () => {
    await fixtures();
    await sql`insert into places (slug, kind, name, location)
              values ('t', 'city', '{"en":"T"}', 'SRID=4326;POINT(75.34 19.88)')`;
    const [r] = await sql`select st_x(location::geometry) x, st_y(location::geometry) y from places where slug = 't'`;
    expect([Number(r!.x), Number(r!.y)]).toEqual([75.34, 19.88]);
  });
});
