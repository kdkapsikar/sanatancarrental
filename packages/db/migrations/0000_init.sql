CREATE TYPE "public"."place_kind" AS ENUM('city', 'town', 'airport', 'cave_site', 'temple', 'fort', 'monument', 'nature');--> statement-breakpoint
CREATE TYPE "public"."document_owner_kind" AS ENUM('vendor', 'vehicle', 'driver');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('registration_certificate', 'tourist_permit', 'insurance', 'fitness_certificate', 'puc_certificate', 'driving_licence', 'psv_badge', 'police_verification', 'vendor_kyc', 'vendor_agreement');--> statement-breakpoint
CREATE TYPE "public"."trip_type" AS ENUM('outstation_one_way', 'outstation_round_trip', 'local', 'airport_transfer');--> statement-breakpoint
CREATE TYPE "public"."vendor_kind" AS ENUM('own_fleet', 'attached_partner', 'aggregator_partner');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('offered', 'accepted', 'rejected', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('quoted', 'pending_payment', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('web', 'whatsapp', 'phone', 'admin');--> statement-breakpoint
CREATE TYPE "public"."consent_purpose" AS ENUM('data_processing', 'whatsapp_utility', 'whatsapp_marketing', 'location_sharing', 'review_request');--> statement-breakpoint
CREATE TYPE "public"."conversation_channel" AS ENUM('whatsapp', 'web_chat');--> statement-breakpoint
CREATE TYPE "public"."ledger_direction" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('en', 'hi', 'mr');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('advance', 'balance', 'refund');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'authorized', 'captured', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending_moderation', 'published', 'hidden');--> statement-breakpoint
CREATE TABLE "itineraries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid,
	"title" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itinerary_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"itinerary_id" uuid NOT NULL,
	"day" smallint NOT NULL,
	"seq" smallint NOT NULL,
	"place_id" uuid NOT NULL,
	"planned_minutes" integer,
	"note" jsonb,
	CONSTRAINT "itinerary_stops_day_positive" CHECK ("itinerary_stops"."day" > 0)
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"kind" "place_kind" NOT NULL,
	"name" jsonb NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"location" geography(Point,4326),
	"district" text,
	"state_code" text DEFAULT 'MH' NOT NULL,
	"closed_days" jsonb,
	"opening_hours" jsonb,
	"entry_fees_paise" jsonb,
	"official_ticket_url" text,
	"unesco_site" boolean,
	"description" jsonb,
	"completeness_score" numeric(4, 3) DEFAULT 0 NOT NULL,
	"verified_source" text,
	"verified_at" timestamp with time zone,
	"needs_verification" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_score_range" CHECK ("places"."completeness_score" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"origin_place_id" uuid NOT NULL,
	"destination_place_id" uuid NOT NULL,
	"distance_km" numeric(7, 1),
	"drive_minutes" integer,
	"toll_estimate_paise" integer,
	"states_entered" text[],
	"stop_place_ids" uuid[],
	"best_season" jsonb,
	"notes" jsonb,
	"completeness_score" numeric(4, 3) DEFAULT 0 NOT NULL,
	"verified_source" text,
	"verified_at" timestamp with time zone,
	"needs_verification" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routes_distinct_ends" CHECK ("routes"."origin_place_id" <> "routes"."destination_place_id"),
	CONSTRAINT "routes_distance_positive" CHECK ("routes"."distance_km" is null or "routes"."distance_km" > 0),
	CONSTRAINT "routes_score_range" CHECK ("routes"."completeness_score" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" jsonb NOT NULL,
	"summary" jsonb,
	"days" smallint NOT NULL,
	"origin_place_id" uuid,
	"inclusions" jsonb,
	"exclusions" jsonb,
	"guide_available" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"completeness_score" numeric(4, 3) DEFAULT 0 NOT NULL,
	"verified_source" text,
	"verified_at" timestamp with time zone,
	"needs_verification" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "packages_days_positive" CHECK ("packages"."days" > 0)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_kind" "document_owner_kind" NOT NULL,
	"vendor_id" uuid,
	"vehicle_id" uuid,
	"driver_id" uuid,
	"type" "document_type" NOT NULL,
	"document_number" text,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"issued_on" date,
	"expires_on" date,
	"file_key" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_single_owner" CHECK (("documents"."owner_kind" = 'vendor' and "documents"."vendor_id" is not null and "documents"."vehicle_id" is null and "documents"."driver_id" is null)
       or ("documents"."owner_kind" = 'vehicle' and "documents"."vehicle_id" is not null and "documents"."vendor_id" is null and "documents"."driver_id" is null)
       or ("documents"."owner_kind" = 'driver' and "documents"."driver_id" is not null and "documents"."vendor_id" is null and "documents"."vehicle_id" is null)),
	CONSTRAINT "documents_verified_has_reviewer" CHECK ("documents"."status" = 'pending' or "documents"."reviewed_by" is not null)
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fare_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_class_code" text NOT NULL,
	"trip_type" "trip_type" NOT NULL,
	"version" integer NOT NULL,
	"rule" jsonb NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_example" boolean DEFAULT false NOT NULL,
	"effective_from" timestamp with time zone,
	"approved_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fare_rules_example_never_active" CHECK (not ("fare_rules"."is_example" and "fare_rules"."is_active")),
	CONSTRAINT "fare_rules_active_needs_approval" CHECK (not "fare_rules"."is_active" or "fare_rules"."approved_by" is not null)
);
--> statement-breakpoint
CREATE TABLE "guide_service_places" (
	"guide_id" uuid NOT NULL,
	"place_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"credential_type" text,
	"credential_number" text,
	"credential_verified_by" text,
	"credential_verified_at" timestamp with time zone,
	"credential_expires_on" date,
	"bio" jsonb,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_classes" (
	"code" text PRIMARY KEY NOT NULL,
	"name" jsonb NOT NULL,
	"seats" smallint NOT NULL,
	"luggage_bags" smallint,
	"example_models" text[] DEFAULT '{}'::text[] NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"vehicle_class_code" text NOT NULL,
	"registration_number" text NOT NULL,
	"make_model" text NOT NULL,
	"registration_year" smallint,
	"fuel" text,
	"seats" smallint,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "vendor_kind" NOT NULL,
	"legal_name" text NOT NULL,
	"display_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"gstin" text,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"status" "assignment_status" DEFAULT 'offered' NOT NULL,
	"eligibility" jsonb NOT NULL,
	"offered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "assignments_only_if_eligible" CHECK (("assignments"."eligibility"->>'eligible')::boolean)
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" "booking_status" DEFAULT 'quoted' NOT NULL,
	"channel" "channel" NOT NULL,
	"locale" "locale" NOT NULL,
	"trip_type" "trip_type" NOT NULL,
	"vehicle_class_code" text NOT NULL,
	"origin_place_id" uuid,
	"destination_place_id" uuid,
	"pickup_text" text NOT NULL,
	"drop_text" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"passengers" smallint NOT NULL,
	"luggage_bags" smallint,
	"route_id" uuid,
	"package_id" uuid,
	"itinerary_id" uuid,
	"guide_id" uuid,
	"fare_rule_id" uuid NOT NULL,
	"quote" jsonb NOT NULL,
	"quote_fingerprint" text NOT NULL,
	"quoted_total_paise" integer NOT NULL,
	"cancelled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "bookings_passengers_positive" CHECK ("bookings"."passengers" > 0),
	CONSTRAINT "bookings_end_after_start" CHECK ("bookings"."end_at" is null or "bookings"."end_at" >= "bookings"."start_at"),
	CONSTRAINT "bookings_total_nonneg" CHECK ("bookings"."quoted_total_paise" >= 0),
	CONSTRAINT "bookings_completed_has_time" CHECK ("bookings"."status" <> 'completed' or "bookings"."completed_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"phone" text NOT NULL,
	"purpose" "consent_purpose" NOT NULL,
	"granted" boolean NOT NULL,
	"source" text NOT NULL,
	"policy_version" text NOT NULL,
	"evidence" jsonb,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"body" text NOT NULL,
	"tool_calls" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" "conversation_channel" NOT NULL,
	"external_thread_id" text,
	"customer_id" uuid,
	"booking_id" uuid,
	"locale" "locale",
	"handed_off_to_human" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"full_name" text,
	"email" text,
	"preferred_locale" "locale" DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"txn_id" uuid NOT NULL,
	"booking_id" uuid,
	"payment_id" uuid,
	"vendor_id" uuid,
	"account" text NOT NULL,
	"direction" "ledger_direction" NOT NULL,
	"amount_paise" integer NOT NULL,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_amount_positive" CHECK ("ledger_entries"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"kind" "payment_kind" NOT NULL,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"amount_paise" integer NOT NULL,
	"live_mode" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"body" text,
	"locale" "locale" NOT NULL,
	"status" "review_status" DEFAULT 'pending_moderation' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_stops" ADD CONSTRAINT "itinerary_stops_itinerary_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_stops" ADD CONSTRAINT "itinerary_stops_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_origin_place_id_places_id_fk" FOREIGN KEY ("origin_place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_destination_place_id_places_id_fk" FOREIGN KEY ("destination_place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_origin_place_id_places_id_fk" FOREIGN KEY ("origin_place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fare_rules" ADD CONSTRAINT "fare_rules_vehicle_class_code_vehicle_classes_code_fk" FOREIGN KEY ("vehicle_class_code") REFERENCES "public"."vehicle_classes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guide_service_places" ADD CONSTRAINT "guide_service_places_guide_id_guides_id_fk" FOREIGN KEY ("guide_id") REFERENCES "public"."guides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_vehicle_class_code_vehicle_classes_code_fk" FOREIGN KEY ("vehicle_class_code") REFERENCES "public"."vehicle_classes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_class_code_vehicle_classes_code_fk" FOREIGN KEY ("vehicle_class_code") REFERENCES "public"."vehicle_classes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_origin_place_id_places_id_fk" FOREIGN KEY ("origin_place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_destination_place_id_places_id_fk" FOREIGN KEY ("destination_place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_itinerary_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guide_id_guides_id_fk" FOREIGN KEY ("guide_id") REFERENCES "public"."guides"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_fare_rule_id_fare_rules_id_fk" FOREIGN KEY ("fare_rule_id") REFERENCES "public"."fare_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "itinerary_stops_order_uq" ON "itinerary_stops" USING btree ("itinerary_id","day","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "places_slug_uq" ON "places" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "places_location_gix" ON "places" USING gist ("location");--> statement-breakpoint
CREATE UNIQUE INDEX "routes_slug_uq" ON "routes" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "routes_pair_uq" ON "routes" USING btree ("origin_place_id","destination_place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "packages_slug_uq" ON "packages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "documents_expiry_idx" ON "documents" USING btree ("expires_on") WHERE "documents"."status" = 'verified';--> statement-breakpoint
CREATE INDEX "documents_vehicle_idx" ON "documents" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "documents_driver_idx" ON "documents" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "documents_vendor_idx" ON "documents" USING btree ("vendor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fare_rules_version_uq" ON "fare_rules" USING btree ("vehicle_class_code","trip_type","version");--> statement-breakpoint
CREATE UNIQUE INDEX "fare_rules_one_active_uq" ON "fare_rules" USING btree ("vehicle_class_code","trip_type") WHERE "fare_rules"."is_active";--> statement-breakpoint
CREATE UNIQUE INDEX "guide_service_places_uq" ON "guide_service_places" USING btree ("guide_id","place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_registration_uq" ON "vehicles" USING btree ("registration_number");--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_one_live_per_booking_uq" ON "assignments" USING btree ("booking_id") WHERE "assignments"."status" in ('offered','accepted');--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_reference_uq" ON "bookings" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "bookings_start_idx" ON "bookings" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "consents_phone_purpose_idx" ON "consents" USING btree ("phone","purpose","recorded_at");--> statement-breakpoint
CREATE INDEX "conversation_messages_conv_idx" ON "conversation_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_uq" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "ledger_txn_idx" ON "ledger_entries" USING btree ("txn_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_ref_uq" ON "payments" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_booking_uq" ON "reviews" USING btree ("booking_id");