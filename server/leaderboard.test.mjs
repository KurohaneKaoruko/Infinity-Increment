/* Node file store tests — storage layer only; the pure logic (validation,
 * ordering, upsert) is covered by leaderboard-core.test.mjs. */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore, validateSubmission } from "./leaderboard.mjs";

const NOW = 1_700_000_000_000;

function validBody(over = {}) {
  return {
    name: "玩家甲",
    era: 2,
    rank: "12345",
    alpha: "ω^2·3 + 5",
    transcends: 4,
    device: "d-abc123",
    ...over,
  };
}

describe("createStore", () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "infinity-lb-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("upserts per device: best result wins, equal repeats are no-ops", () => {
    const store = createStore(dir, { now: () => NOW });
    expect(store.submit(validateSubmission(validBody(), NOW)).improved).toBe(true);
    expect(store.submit(validateSubmission(validBody({ rank: "1" }), NOW + 1)).improved).toBe(false); // worse
    expect(store.submit(validateSubmission(validBody({ rank: "99999" }), NOW + 2)).improved).toBe(true); // better
    expect(store.submit(validateSubmission(validBody({ rank: "99999" }), NOW + 3)).improved).toBe(false); // same
    const rows = store.load();
    expect(rows).toHaveLength(1);
    expect(rows[0].rank).toBe("99999");
    expect(rows[0].at).toBe(NOW + 2); // incumbent kept on ties
  });

  it("persists across store instances and flags the caller's row as self", () => {
    const first = createStore(dir, { now: () => NOW });
    first.submit(validateSubmission(validBody(), NOW));
    first.submit(validateSubmission(validBody({ device: "d-other", rank: "2" }), NOW));

    const second = createStore(dir, { now: () => NOW });
    const board = second.board(10, "d-other");
    expect(board.entries).toHaveLength(2);
    expect(board.entries[0].rank).toBe("12345"); // higher rank first
    expect(board.entries.find((e) => e.self === true)).toMatchObject({ rank: "2" });
    expect(board.entries.filter((e) => e.device !== undefined)).toHaveLength(0); // device never echoed
    expect(board.total).toBe(2);
  });

  it("recovers from a corrupt store file instead of crashing", () => {
    writeFileSync(join(dir, "leaderboard.json"), "{not json");
    const store = createStore(dir, { now: () => NOW });
    expect(store.load()).toEqual([]);
    expect(store.submit(validateSubmission(validBody(), NOW)).improved).toBe(true);
    expect(existsSync(join(dir, "leaderboard.json"))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, "leaderboard.json"), "utf8")).entries).toHaveLength(1);
  });

  it("drops tampered rows on load rather than trusting the file", () => {
    const good = validateSubmission(validBody({ device: "d-ok2", rank: "7" }), NOW);
    const seed = [{ ...validateSubmission(validBody({ device: "d-ok1" }), NOW), rank: "12x" }, good];
    writeFileSync(join(dir, "leaderboard.json"), JSON.stringify({ entries: seed }));
    const store = createStore(dir, { now: () => NOW });
    expect(store.load().map((e) => e.device)).toEqual(["d-ok2"]);
  });

  it("caps the board page at LIMITS.board", () => {
    const seed = Array.from({ length: 150 }, (_, i) => ({
      device: `d-${String(i).padStart(3, "0")}`,
      name: "p",
      era: 2,
      rank: String(i + 1),
      alpha: "ω",
      transcends: 4,
      at: NOW + i,
    }));
    writeFileSync(join(dir, "leaderboard.json"), JSON.stringify({ entries: seed }));
    const store = createStore(dir, { now: () => NOW });
    expect(store.load().length).toBe(150);
    expect(store.board(150).entries.length).toBe(100);
    expect(store.board(5).entries.length).toBe(5);
  });
});
