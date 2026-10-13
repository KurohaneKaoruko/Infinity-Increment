/* Leaderboard store — Node self-hosted server.
 *
 * Zero-dependency JSON-file persistence. Deployments are expected to be small
 * (personal / friend-group servers); the whole table lives in one file and is
 * rewritten atomically (tmp + rename) on every accepted submission.
 *
 * All pure logic lives in ./leaderboard-core.mjs and is shared with the
 * Cloudflare Pages Function (functions/api/leaderboard.ts).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  compareEntries,
  isEntry,
  isBetter,
  LIMITS,
  sanitizeName,
  toBoardRows,
  upsertBoard,
  validateSubmission,
} from "./leaderboard-core.mjs";

// re-exported so existing importers (and tests) keep working unchanged
export {
  compareEntries,
  isBetter,
  isEntry,
  LIMITS,
  sanitizeName,
  toBoardRows,
  upsertBoard,
  validateSubmission,
};

export function createStore(dir, { now = () => Date.now() } = {}) {
  const file = join(dir, "leaderboard.json");
  // single-process server: read the table once, mutate in place afterwards
  let cache = null;

  function load() {
    if (cache !== null) return cache;
    try {
      if (!existsSync(file)) {
        cache = [];
        return cache;
      }
      const data = JSON.parse(readFileSync(file, "utf8"));
      cache = Array.isArray(data?.entries) ? data.entries.filter(isEntry) : [];
    } catch {
      cache = []; // corrupt file -> start clean rather than crash the server
    }
    return cache;
  }

  function persist(entries) {
    mkdirSync(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ entries }, null, 1));
    renameSync(tmp, file);
  }

  /** upsert by device (best-only). Returns { entry, improved, entries }. */
  function submit(entry) {
    // index.mjs always validates first; anything else is a programming error
    if (!isEntry(entry)) throw new Error("submit() expects a validated entry");
    const result = upsertBoard(load(), entry);
    if (result.improved) persist(result.entries);
    return { entry, improved: result.improved, entries: result.entries };
  }

  /** board rows for a device (its own row flagged `self`). */
  function board(limit, device) {
    const all = load();
    return { entries: toBoardRows(all, limit, device), total: all.length, generatedAt: now() };
  }

  return { load, submit, board, file };
}
