/* Leaderboard core — pure logic shared by every deployment shape:
 *   server/leaderboard.mjs      Node self-hosted store (fs persistence)
 *   functions/api/leaderboard.ts Cloudflare Pages Function (KV persistence)
 *
 * No I/O, no platform APIs — everything here is deterministic and unit-tested
 * (server/leaderboard-core.test.mjs), and the client-side mirrors in
 * src/ui/leaderboard.ts are parity-tested against it.
 */
export const LIMITS = {
  name: 24,
  alpha: 48,
  device: 64,
  rankDigits: 80, // decimal digits of 2^266 — far above any real run
  entries: 2000, // hard cap on stored rows
  board: 100, // max rows returned per request
  era: 1_000_000,
  transcends: 10_000_000,
};

/** mirror of the client's sanitizeName */
export function sanitizeName(raw) {
  const cleaned = String(raw ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > LIMITS.name ? cleaned.slice(0, LIMITS.name) : cleaned;
}

function digits(s) {
  return typeof s === "string" && /^\d+$/.test(s);
}

function intIn(v, lo, hi) {
  return typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
}

/** Validate a parsed request body. Returns an entry or an error string. */
export function validateSubmission(body, now) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return "body must be an object";
  const name = sanitizeName(body.name);
  if (name.length === 0) return "name is empty after sanitising";
  if (!digits(body.rank) || body.rank.length > LIMITS.rankDigits) return "rank must be a decimal digit string";
  if (body.rank.length > 1 && body.rank[0] === "0") return "rank must not have leading zeros";
  if (!intIn(body.era, 0, LIMITS.era)) return `era must be an integer 0..${LIMITS.era}`;
  if (!intIn(body.transcends, 0, LIMITS.transcends)) return `transcends must be an integer 0..${LIMITS.transcends}`;
  if (typeof body.alpha !== "string" || body.alpha.length > LIMITS.alpha) return `alpha must be a string <= ${LIMITS.alpha} chars`;
  if (typeof body.device !== "string" || body.device.length < 4 || body.device.length > LIMITS.device)
    return `device must be a string 4..${LIMITS.device} chars`;
  if (!/^[a-zA-Z0-9_-]+$/.test(body.device)) return "device may only contain [a-zA-Z0-9_-]";
  return {
    device: body.device,
    name,
    era: body.era,
    rank: body.rank,
    alpha: body.alpha,
    transcends: body.transcends,
    at: now, // server clock — client timestamps are never trusted
  };
}

/** a beats b (incumbent)? rank, then transcends; ties keep the incumbent. */
export function isBetter(a, b) {
  if (a.rank !== b.rank) return BigInt(a.rank) > BigInt(b.rank);
  if (a.transcends !== b.transcends) return a.transcends > b.transcends;
  return false;
}

/** descending: rank, transcends, then oldest first (stable boards). */
export function compareEntries(x, y) {
  const rx = BigInt(x.rank);
  const ry = BigInt(y.rank);
  if (rx !== ry) return rx > ry ? -1 : 1;
  if (x.transcends !== y.transcends) return y.transcends - x.transcends;
  return x.at - y.at;
}

/** upsert by device (best-only). Mutates and returns `entries` when improved. */
export function upsertBoard(entries, entry) {
  const rows = Array.isArray(entries) ? entries : [];
  const i = rows.findIndex((e) => e.device === entry.device);
  let improved = false;
  if (i === -1) {
    rows.push(entry);
    improved = true;
  } else if (isBetter(entry, rows[i])) {
    rows[i] = entry;
    improved = true;
  }
  if (!improved) return { entries: rows, improved };
  rows.sort(compareEntries);
  if (rows.length > LIMITS.entries) rows.length = LIMITS.entries; // in-place cap
  return { entries: rows, improved: true };
}

/** public board rows: capped page, device id stripped, own row flagged. */
export function toBoardRows(entries, limit, device) {
  const all = Array.isArray(entries) ? entries : [];
  const n = Math.max(1, Math.min(LIMITS.board, limit | 0));
  return all.slice(0, n).map((e) => ({
    name: e.name,
    era: e.era,
    rank: e.rank,
    alpha: e.alpha,
    transcends: e.transcends,
    at: e.at,
    self: device != null && e.device === device ? true : undefined,
  }));
}

/** shape check for rows loaded from disk / KV (defensive against tampering). */
export function isEntry(e) {
  return (
    e !== null &&
    typeof e === "object" &&
    typeof e.device === "string" &&
    typeof e.name === "string" &&
    typeof e.rank === "string" &&
    digits(e.rank) &&
    intIn(e.era, 0, LIMITS.era) &&
    intIn(e.transcends, 0, LIMITS.transcends) &&
    typeof e.alpha === "string" &&
    typeof e.at === "number"
  );
}
