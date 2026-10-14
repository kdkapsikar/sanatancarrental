// What the tools read and write, behind one small interface so the same engine runs on the server
// (database) and in the browser (a published read-only snapshot). Browser-safe: type imports only.
import type { fareRules, places, routes, vehicleClasses } from "@cab/db";
import type { Channel } from "./types";

export type PlaceRow = typeof places.$inferSelect;
export type RouteRow = typeof routes.$inferSelect;
export type VehicleClassRow = typeof vehicleClasses.$inferSelect;
export type FareRuleRow = typeof fareRules.$inferSelect;

export interface NewProposal {
  kind: "request_callback";
  channel: Channel;
  payload: Record<string, unknown>;
  ownerRef: string | null;
  expiresAt: Date;
}

export interface AssistantData {
  places(): Promise<PlaceRow[]>;
  routes(): Promise<RouteRow[]>;
  vehicleClasses(): Promise<VehicleClassRow[]>;
  /** Approved, active fare rules only. */
  activeFareRules(): Promise<FareRuleRow[]>;
  /** Stores a proposal and returns its id, or null where nothing can be stored (no server). */
  createProposal(p: NewProposal): Promise<string | null>;
}

/** Public, read-only data published with the static site (no people, no proposals). */
export interface AssistantSnapshot {
  generatedAt: string;
  places: PlaceRow[];
  routes: RouteRow[];
  vehicleClasses: VehicleClassRow[];
  fareRules: FareRuleRow[];
}

const bySlug = <T extends { slug: string }>(a: T, b: T) => a.slug.localeCompare(b.slug);

export class SnapshotData implements AssistantData {
  constructor(private readonly s: AssistantSnapshot) {}
  async places() {
    return [...this.s.places].sort(bySlug);
  }
  async routes() {
    return [...this.s.routes].sort(bySlug);
  }
  async vehicleClasses() {
    return [...this.s.vehicleClasses].sort((a, b) => a.sortOrder - b.sortOrder);
  }
  async activeFareRules() {
    return this.s.fareRules.filter((r) => r.isActive);
  }
  async createProposal() {
    return null;
  }
}
