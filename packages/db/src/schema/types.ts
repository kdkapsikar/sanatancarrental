import { customType } from "drizzle-orm/pg-core";

/** PostGIS geography(Point, 4326). Stored as WKT on write; read back as { lng, lat }. */
export const geographyPoint = customType<{
  data: { lng: number; lat: number };
  driverData: string;
}>({
  dataType() {
    return "geography(Point,4326)";
  },
  toDriver({ lng, lat }) {
    return `SRID=4326;POINT(${lng} ${lat})`;
  },
  fromDriver(value) {
    // postgres.js returns EWKB hex for geography; parse the point coordinates.
    return parseEwkbPoint(value);
  },
});

/** Parse a little/big-endian (E)WKB hex Point. */
export function parseEwkbPoint(hex: string): { lng: number; lat: number } {
  const buf = Buffer.from(hex, "hex");
  const le = buf.readUInt8(0) === 1;
  const type = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
  const hasSrid = (type & 0x20000000) !== 0;
  const offset = 5 + (hasSrid ? 4 : 0);
  const lng = le ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset);
  const lat = le ? buf.readDoubleLE(offset + 8) : buf.readDoubleBE(offset + 8);
  return { lng, lat };
}

/** Localised text: en is required for content we publish; hi/mr may be TODO_TRANSLATE. */
export type LocalisedText = { en: string; hi?: string; mr?: string };

/** Field-level verification gaps: field name → why it is unverified / which sources conflict. */
export type NeedsVerification = Record<string, string>;
