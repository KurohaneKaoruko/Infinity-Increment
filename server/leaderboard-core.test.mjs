/* Shared leaderboard core — pure logic used by BOTH the Node server and the
 * Cloudflare Pages Function, and mirrored by src/ui/leaderboard.ts. */
import { describe, it, expect } from "vitest";
import {
  compareEntries,
  isBetter,
  isEntry,
  LIMITS,
  sanitizeName,
  toBoardRows,
  upsertBoard,
  validateSubmission,
} from "./leaderboard-core.mjs";

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

describe("sanitizeName", () => {
  it("strips control chars (incl. tab), folds whitespace, clamps to 24", () => {
    expect(sanitizeName("  a\u0000b\t c  ")).toBe("ab c");
    expect(sanitizeName("a\n\nb")).toBe("ab");
    expect(sanitizeName("x".repeat(40))).toHaveLength(LIMITS.name);
    expect(sanitizeName(" ")).toBe("");
    expect(sanitizeName(undefined)).toBe("");
  });
});

describe("validateSubmission", () => {
  it("accepts a well-formed body and stamps the server clock", () => {
    const r = validateSubmission(validBody(), NOW);
    expect(typeof r).toBe("object");
    expect(r).toMatchObject({ device: "d-abc123", era: 2, rank: "12345", at: NOW });
  });

  it("rejects malformed bodies with readable errors", () => {
    expect(validateSubmission(null, NOW)).toBe("body must be an object");
    expect(validateSubmission([], NOW)).toBe("body must be an object");
    expect(validateSubmission(validBody({ rank: "12x" }), NOW)).toMatch(/rank/);
    expect(validateSubmission(validBody({ rank: "0123" }), NOW)).toMatch(/leading zeros/);
    expect(validateSubmission(validBody({ rank: "9".repeat(LIMITS.rankDigits + 1) }), NOW)).toMatch(/digit string/);
    expect(validateSubmission(validBody({ era: -1 }), NOW)).toMatch(/era/);
    expect(validateSubmission(validBody({ era: 1.5 }), NOW)).toMatch(/era/);
    expect(validateSubmission(validBody({ transcends: 1.5 }), NOW)).toMatch(/transcends/);
    expect(validateSubmission(validBody({ alpha: "x".repeat(LIMITS.alpha + 1) }), NOW)).toMatch(/alpha/);
    expect(validateSubmission(validBody({ device: "x" }), NOW)).toMatch(/device/);
    expect(validateSubmission(validBody({ device: "bad device!" }), NOW)).toMatch(/device/);
    expect(validateSubmission(validBody({ name: " \t " }), NOW)).toMatch(/name is empty/);
  });
});

describe("ordering", () => {
  it("isBetter: rank dominates, then transcends; ties keep the incumbent", () => {
    expect(isBetter({ rank: "10", transcends: 0 }, { rank: "9", transcends: 99 })).toBe(true);
    expect(isBetter({ rank: "9", transcends: 99 }, { rank: "10", transcends: 0 })).toBe(false);
    expect(isBetter({ rank: "9", transcends: 2 }, { rank: "9", transcends: 1 })).toBe(true);
    expect(isBetter({ rank: "9", transcends: 1 }, { rank: "9", transcends: 2 })).toBe(false);
    expect(isBetter({ rank: "9" }, { rank: "9" })).toBe(false);
    // exact comparison beyond 2^53 (string ranks, never numbers)
    expect(isBetter({ rank: "9007199254740993" }, { rank: "9007199254740992" })).toBe(true);
  });

  it("compareEntries: descending rank, then transcends, then oldest first", () => {
    const rows = [
      { rank: "1", transcends: 0, at: 5 },
      { rank: "3", transcends: 0, at: 5 },
      { rank: "3", transcends: 0, at: -1 },
      { rank: "2", transcends: 9, at: 0 },
    ];
    expect([...rows].sort(compareEntries).map((r) => `${r.rank}/${r.at}`)).toEqual(["3/-1", "3/5", "2/0", "1/5"]);
  });
});

describe("upsertBoard", () => {
  const make = (over = {}) => {
    const r = validateSubmission(validBody(over), NOW);
    if (typeof r === "string") throw new Error(`fixture invalid: ${r}`);
    return r;
  };

  it("first submission for a device is an improvement", () => {
    const r = upsertBoard([], make({ device: "d-x1" }));
    expect(r.improved).toBe(true);
    expect(r.entries).toHaveLength(1);
  });

  it("keeps only the best result per device; equal repeats are no-ops", () => {
    let table = upsertBoard([], make({ device: "d-x1", rank: "10" })).entries;
    table = upsertBoard(table, make({ device: "d-x1", rank: "9", transcends: 99 })).entries;
    expect(table).toHaveLength(1);
    expect(table[0].rank).toBe("10");
    const r = upsertBoard(table, make({ device: "d-x1", rank: "10" }));
    expect(r.improved).toBe(false); // tie keeps the incumbent timestamp
  });

  it("sorts the table and caps it at LIMITS.entries", () => {
    // build an over-full, out-of-order table directly
    const rows = [];
    for (let i = 0; i < LIMITS.entries + 5; i++) {
      rows.push(make({ device: `d-${String(i).padStart(4, "0")}`, rank: String(LIMITS.entries + 5 - i) }));
    }
    const r = upsertBoard(rows, make({ device: "d-new1", rank: String(LIMITS.entries + 100) }));
    expect(r.improved).toBe(true);
    expect(r.entries).toHaveLength(LIMITS.entries);
    expect(r.entries[0].rank).toBe(String(LIMITS.entries + 100)); // strongest kept
    expect(r.entries[r.entries.length - 1].rank).not.toBe("1"); // weakest rows dropped
  });

  it("survives a garbage table (non-array / corrupt rows)", () => {
    const r = upsertBoard(undefined, make({ device: "d-y1" }));
    expect(r.improved).toBe(true);
    expect(r.entries).toHaveLength(1);
  });
});

describe("toBoardRows", () => {
  const rows = [
    { device: "d-1", name: "a", era: 0, rank: "5", alpha: "ω", transcends: 1, at: 1 },
    { device: "d-2", name: "b", era: 1, rank: "9", alpha: "ω^2", transcends: 2, at: 2 },
  ];

  it("strips device ids and flags the caller's own row", () => {
    const board = toBoardRows(rows, 10, "d-2");
    expect(board).toHaveLength(2);
    expect(board[0].rank).toBe("5"); // input order is preserved (no re-sorting here)
    expect(board.some((r) => "device" in r)).toBe(false);
    expect(board.find((r) => r.self === true)?.name).toBe("b");
  });

  it("clamps the page size into 1..LIMITS.board", () => {
    expect(toBoardRows(rows, 0, undefined)).toHaveLength(1);
    expect(toBoardRows(rows, -5, undefined)).toHaveLength(1);
    expect(toBoardRows(rows, LIMITS.board + 99, undefined)).toHaveLength(2);
  });
});

describe("isEntry", () => {
  it("accepts validated entries and rejects tampered rows", () => {
    const r = validateSubmission(validBody(), NOW);
    if (typeof r === "string") throw new Error("fixture invalid");
    expect(isEntry(r)).toBe(true);
    expect(isEntry({ ...r, rank: "12x" })).toBe(false);
    expect(isEntry({ ...r, era: -1 })).toBe(false);
    expect(isEntry(null)).toBe(false);
    expect(isEntry("nope")).toBe(false);
  });
});
