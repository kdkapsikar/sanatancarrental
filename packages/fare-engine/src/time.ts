// India has no DST, so IST is a fixed UTC+05:30 offset. We work in "IST minutes since epoch".
const IST_OFFSET_MIN = 330;
const DAY_MIN = 1440;

export function toIstMinutes(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new RangeError(`invalid datetime: ${iso}`);
  if (!/(Z|[+-]\d\d:?\d\d)$/.test(iso)) {
    throw new RangeError(`datetime must carry an offset: ${iso}`);
  }
  return Math.floor(ms / 60000) + IST_OFFSET_MIN;
}

function hhmm(s: string): number {
  const m = /^(\d\d):(\d\d)$/.exec(s);
  if (!m) throw new RangeError(`invalid HH:MM: ${s}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Calendar days (IST) touched by [start, end], inclusive. A same-day trip is 1 day. */
export function calendarDays(startMin: number, endMin: number): number {
  return Math.floor(endMin / DAY_MIN) - Math.floor(startMin / DAY_MIN) + 1;
}

/**
 * Night windows fully contained in [start, end]. Window may cross midnight (e.g. 22:00–06:00).
 */
export function nightsSpanned(
  startMin: number,
  endMin: number,
  windowStart: string,
  windowEnd: string,
): number {
  const ws = hhmm(windowStart);
  const we = hhmm(windowEnd);
  const len = we > ws ? we - ws : DAY_MIN - ws + we;
  let count = 0;
  const firstDay = Math.floor(startMin / DAY_MIN) - 1;
  const lastDay = Math.floor(endMin / DAY_MIN);
  for (let d = firstDay; d <= lastDay; d++) {
    const s = d * DAY_MIN + ws;
    if (s >= startMin && s + len <= endMin) count++;
  }
  return count;
}
