-- Integrity rules that CHECK constraints cannot express.

-- 1. Double-entry ledger: every txn_id must balance (sum of debits = sum of credits).
--    Deferred to commit so a transaction can insert its legs one by one.
CREATE OR REPLACE FUNCTION ledger_check_balanced() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  t uuid := COALESCE(NEW.txn_id, OLD.txn_id);
  imbalance bigint;
BEGIN
  SELECT COALESCE(SUM(CASE direction WHEN 'debit' THEN amount_paise ELSE -amount_paise END), 0)
    INTO imbalance FROM ledger_entries WHERE txn_id = t;
  IF imbalance <> 0 THEN
    RAISE EXCEPTION 'ledger txn % does not balance (off by % paise)', t, imbalance
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER ledger_balanced
  AFTER INSERT OR UPDATE OR DELETE ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_check_balanced();
--> statement-breakpoint

-- 2. Ledger rows are append-only: corrections are new reversing entries.
CREATE OR REPLACE FUNCTION append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; insert a new (reversing / withdrawing) row instead', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END $$;
--> statement-breakpoint
CREATE TRIGGER ledger_no_update_delete
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION append_only();
--> statement-breakpoint

-- 3. A review must belong to a completed booking made by the same customer.
CREATE OR REPLACE FUNCTION reviews_require_completed_booking() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  b record;
BEGIN
  SELECT status, customer_id INTO b FROM bookings WHERE id = NEW.booking_id;
  IF b.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'review requires a completed booking (booking % is %)', NEW.booking_id, b.status
      USING ERRCODE = 'check_violation';
  END IF;
  IF b.customer_id <> NEW.customer_id THEN
    RAISE EXCEPTION 'review customer does not match booking customer'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER reviews_completed_booking
  BEFORE INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION reviews_require_completed_booking();
--> statement-breakpoint

-- 4. Consent history is append-only (withdrawal = a new row with granted = false).
CREATE TRIGGER consents_append_only
  BEFORE UPDATE OR DELETE ON consents
  FOR EACH ROW EXECUTE FUNCTION append_only();
