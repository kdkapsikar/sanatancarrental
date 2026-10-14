// Server-side AssistantData over PostgreSQL.
import { asc, eq } from "drizzle-orm";
import { assistantProposals, fareRules, places, routes, vehicleClasses, type Db } from "@cab/db";
import type { AssistantData, AssistantSnapshot, NewProposal } from "./data";

export class DbData implements AssistantData {
  constructor(private readonly db: Db) {}
  places() {
    return this.db.select().from(places).orderBy(asc(places.slug));
  }
  routes() {
    return this.db.select().from(routes).orderBy(asc(routes.slug));
  }
  vehicleClasses() {
    return this.db.select().from(vehicleClasses).orderBy(asc(vehicleClasses.sortOrder));
  }
  activeFareRules() {
    return this.db.select().from(fareRules).where(eq(fareRules.isActive, true));
  }
  async createProposal(p: NewProposal) {
    const [row] = await this.db
      .insert(assistantProposals)
      .values({ kind: p.kind, channel: p.channel, payload: p.payload, ownerRef: p.ownerRef, expiresAt: p.expiresAt })
      .returning({ id: assistantProposals.id });
    return row!.id;
  }
}

/** The public data the in-browser assistant needs, for the static site build. */
export async function buildSnapshot(db: Db): Promise<AssistantSnapshot> {
  const d = new DbData(db);
  return {
    generatedAt: new Date().toISOString(),
    places: await d.places(),
    routes: await d.routes(),
    vehicleClasses: await d.vehicleClasses(),
    fareRules: await d.activeFareRules(),
  };
}
