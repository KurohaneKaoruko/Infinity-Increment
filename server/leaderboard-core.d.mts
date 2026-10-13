/* Hand-written types for leaderboard-core.mjs — lets TS consumers (the
 * Cloudflare Pages Function, the parity tests) import the shared core with
 * full type safety without adding a build step to the plain-JS server. */

export interface Entry {
  device: string;
  name: string;
  era: number;
  /** rank(alpha) as an integer decimal string (may exceed 2^53) */
  rank: string;
  alpha: string;
  transcends: number;
  /** submission time, epoch ms (server clock) */
  at: number;
}

export interface BoardRow {
  name: string;
  era: number;
  rank: string;
  alpha: string;
  transcends: number;
  at: number;
  self?: boolean;
}

export interface Limits {
  readonly name: number;
  readonly alpha: number;
  readonly device: number;
  readonly rankDigits: number;
  readonly entries: number;
  readonly board: number;
  readonly era: number;
  readonly transcends: number;
}

export declare const LIMITS: Limits;
export declare function sanitizeName(raw: unknown): string;
export declare function validateSubmission(body: unknown, now: number): Entry | string;
export declare function isBetter(
  a: Pick<Entry, "rank" | "transcends">,
  b: Pick<Entry, "rank" | "transcends">,
): boolean;
export declare function compareEntries(x: Entry, y: Entry): number;
/** Mutates `entries` in place when the submission improves the table. */
export declare function upsertBoard(
  entries: Entry[] | undefined,
  entry: Entry,
): { entries: Entry[]; improved: boolean };
export declare function toBoardRows(
  entries: Entry[] | undefined,
  limit: number,
  device?: string,
): BoardRow[];
/** Shape check for rows loaded from disk / KV (defensive against tampering). */
export declare function isEntry(e: unknown): e is Entry;
