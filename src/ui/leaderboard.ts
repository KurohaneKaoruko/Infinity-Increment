/* Leaderboard client — server-deployment only feature.
 *
 * Static deployments (file://, GitHub Pages, any static host) simply 404 on
 * the probe below and the UI hides itself. Progress never leaves the browser
 * unless the player explicitly presses submit, and there is no account —
 * submissions are honor-system progress receipts keyed by a local device id.
 *
 * Pure helpers (payload/comparison/formatting) live here and are unit-tested;
 * fetch plumbing is isolated behind probe/fetchBoard/submitScore. */
import type { GameState } from "../core/game/state";
import { formatOrd } from "../core/ordinal/format";
import { eraAt } from "../core/game/eras";
import { progressRank, climbValue } from "../core/game/engine";

export interface LeaderboardEntry {
  /** display name chosen by the player, server-clamped */
  name: string;
  /** index into the endless era chain */
  era: number;
  /** rank(alpha) as an integer string — doubles exceed 2^53 up the ladder */
  rank: string;
  /** formatted ordinal, truncated for display */
  alpha: string;
  transcends: number;
  /** submission time, epoch ms */
  at: number;
  /** true for the row belonging to this browser's submission */
  self?: boolean;
}

export interface LeaderboardBoard {
  entries: LeaderboardEntry[];
  total: number;
  generatedAt: number;
  /** server-side: did this device beat its own previous best? */
  improved?: boolean;
}

export interface Submission {
  name: string;
  era: number;
  rank: string;
  alpha: string;
  transcends: number;
  device: string;
}

const NAME_MAX = 24;
const ALPHA_MAX = 48;

/** A stable per-browser id (localStorage; never sent anywhere but submit). */
export function deviceId(storage: Pick<Storage, "getItem" | "setItem">): string {
  const key = "infinity.lb.device";
  const existing = storage.getItem(key);
  if (existing) return existing;
  const fresh = `d-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  storage.setItem(key, fresh);
  return fresh;
}

export function readName(storage: Pick<Storage, "getItem" | "setItem">): string {
  const v = storage.getItem("infinity.lb.name");
  if (v === null) {
    const fresh = defaultName();
    storage.setItem("infinity.lb.name", fresh); // persist so it stops changing
    return fresh;
  }
  return v;
}

/** random fallback handle, e.g. "匿名序学家·a3f9" */
export function defaultName(): string {
  const n = Math.random().toString(36).slice(2, 6);
  return `匿名序学家·${n}`;
}

export function sanitizeName(raw: string): string {
  // strip control chars, collapse whitespace, clamp length
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length === 0) return defaultName();
  return cleaned.length > NAME_MAX ? cleaned.slice(0, NAME_MAX) : cleaned;
}

/** Build the submission payload for a game state (pure). */
export function scoreOf(s: GameState, name: string, device: string): Submission {
  const climbing = s.phase === "climb";
  return {
    name: sanitizeName(name),
    era: Math.max(0, Math.floor(s.era)),
    // rank() is a double; stringify before it can exceed 2^53 precision
    rank: BigInt(Math.max(0, Math.floor(progressRank(s)))).toString(),
    alpha: (climbing ? climbValue(s) : formatOrd(s.alpha)).slice(0, ALPHA_MAX),
    transcends: Math.max(0, Math.floor(s.transcends)),
    device,
  };
}

/** strict ">" for submissions: rank, then transcends, then recency. */
export function isBetter(a: Submission, b: Submission): boolean {
  if (a.rank !== b.rank) return BigInt(a.rank) > BigInt(b.rank);
  if (a.transcends !== b.transcends) return a.transcends > b.transcends;
  return false; // equal standing: keep the incumbent
}

/** sort key used by the server and by tests (descending). */
export function compareEntries(x: LeaderboardEntry, y: LeaderboardEntry): number {
  const rx = BigInt(x.rank);
  const ry = BigInt(y.rank);
  if (rx !== ry) return rx > ry ? -1 : 1;
  if (x.transcends !== y.transcends) return y.transcends - x.transcends;
  return x.at - y.at; // earlier submissions first on a tie
}

/** big integer ranks read better compressed: 1234567 / 1.23e45 */
export function formatRank(r: string): string {
  if (!/^\d+$/.test(r)) return r;
  if (r.length <= 15) return r.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const e = r.length - 1;
  const m = r.slice(0, 4).replace(/0+$/, "");
  return `${m}e${e}`;
}

export function eraLabel(era: number): string {
  try {
    return eraAt(era).short;
  } catch {
    return `κ${era}`;
  }
}

/* ------------------------------------------------------------------ */
/* network (thin wrappers — all failures are the caller's to swallow)  */
/* ------------------------------------------------------------------ */

const PROBE_TIMEOUT_MS = 3000;

async function timedFetch(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function apiUrl(path: string): string {
  // document-relative: works at any mount depth and under every shell
  return new URL(`api/leaderboard${path}`, document.baseURI).href;
}

/** Does this deployment actually have a server? Static hosts 404 → false. */
export async function probeServer(): Promise<boolean> {
  try {
    const res = await timedFetch(apiUrl("?limit=1"), { method: "GET" }, PROBE_TIMEOUT_MS);
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchBoard(limit = 20): Promise<LeaderboardBoard> {
  const res = await timedFetch(apiUrl(`?limit=${limit}`), { method: "GET" }, PROBE_TIMEOUT_MS);
  if (!res.ok) throw new Error(`leaderboard ${res.status}`);
  const data: unknown = await res.json();
  const entries = Array.isArray((data as LeaderboardBoard).entries)
    ? (data as LeaderboardBoard).entries.map((e) => ({ ...e, alpha: truncateAlpha(e.alpha) }))
    : [];
  return {
    entries,
    total: Number((data as LeaderboardBoard).total) || entries.length,
    generatedAt: Number((data as LeaderboardBoard).generatedAt) || 0,
  };
}

export async function submitScore(sub: Submission): Promise<LeaderboardBoard> {
  const res = await timedFetch(apiUrl(""), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sub),
  }, PROBE_TIMEOUT_MS);
  if (!res.ok) throw new Error(`submit ${res.status}`);
  const data: unknown = await res.json();
  const b = data as LeaderboardBoard;
  const entries = Array.isArray(b?.entries)
    ? b.entries.map((e) => ({ ...e, alpha: truncateAlpha(e.alpha) }))
    : [];
  return {
    entries,
    total: Number(b?.total) || entries.length,
    generatedAt: Number(b?.generatedAt) || 0,
    improved: b?.improved === true,
  };
}

function truncateAlpha(a: unknown): string {
  const s = typeof a === "string" ? a : "";
  return s.length > ALPHA_MAX ? `${s.slice(0, ALPHA_MAX)}…` : s;
}
