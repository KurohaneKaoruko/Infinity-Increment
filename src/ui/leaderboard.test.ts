/* Leaderboard client logic — pure parts only (no fetch, no DOM).
 * Network plumbing is thin and covered by the server test + manual smoke. */
import { describe, it, expect } from "vitest";
import {
  compareEntries,
  defaultName,
  eraLabel,
  formatRank,
  isBetter,
  sanitizeName,
  scoreOf,
  type LeaderboardEntry,
  type Submission,
} from "./leaderboard";
import {
  compareEntries as serverCompare,
  isBetter as serverIsBetter,
  type Entry,
} from "../../server/leaderboard-core.mjs";
import { initialState, type GameState } from "../core/game/state";
import { OMEGA, add, fromNumber, mul, pow } from "../core/ordinal/ordinal";
import { formatOrd } from "../core/ordinal/format";
import { rank } from "../core/ordinal/rank";
import { eraAt } from "../core/game/eras";

function okPow(a: Parameters<typeof pow>[0], b: Parameters<typeof pow>[1]): GameState["alpha"] {
  const r = pow(a, b);
  if (!r.ok) throw new Error("expected an in-range power");
  return r.value;
}

function stateWith(alpha: GameState["alpha"], extra: Partial<GameState> = {}): GameState {
  // these cases are about ordinal positions, i.e. the era chain
  return { ...initialState(1000), phase: "era", alpha, ...extra };
}

const memStore = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    map,
  };
};

describe("name handling", () => {
  it("strips control chars, collapses whitespace, clamps to 24", () => {
    expect(sanitizeName("  a\u0000b\t c  ")).toBe("ab c");
    expect(sanitizeName("x".repeat(40))).toHaveLength(24);
    expect(sanitizeName("   ")).not.toBe(""); // empty → default handle
  });

  it("default handle is stable per call shape", () => {
    expect(defaultName()).toMatch(/^匿名序学家·[0-9a-z]{4}$/);
  });
});

describe("scoreOf", () => {
  it("serializes rank as an integer digit string (double-safe)", () => {
    const s = scoreOf(stateWith(mul(OMEGA, fromNumber(3))), "甲", "dev1");
    expect(s.rank).toMatch(/^\d+$/);
    expect(Number(s.rank)).toBe(Math.floor(rank(mul(OMEGA, fromNumber(3)))));
    expect(s.era).toBe(0);
    expect(s.transcends).toBe(0);
    expect(s.device).toBe("dev1");
    expect(s.name).toBe("甲");
  });

  it("floors fractional era / transcends and clamps negatives", () => {
    const s = scoreOf(stateWith(OMEGA, { era: 2.9, transcends: -5 }), "n", "d");
    expect(s.era).toBe(2);
    expect(s.transcends).toBe(0);
  });

  it("embeds the formatted ordinal, truncated to 48 chars", () => {
    // Σ ω^k·k for k=20..1 (descending: left absorption keeps every term)
    let big = fromNumber(0);
    for (let k = 20; k >= 1; k--) big = add(big, mul(okPow(OMEGA, fromNumber(k)), fromNumber(k)));
    expect(formatOrd(big).length).toBeGreaterThan(48);
    const s = scoreOf(stateWith(big), "n", "d");
    expect(s.alpha.length).toBe(48);
    expect(s.alpha).toBe(formatOrd(big).slice(0, 48));
  });
});

describe("comparison", () => {
  const entry = (over: Partial<LeaderboardEntry>): LeaderboardEntry => ({
    name: "p",
    era: 0,
    rank: "1",
    alpha: "ω",
    transcends: 0,
    at: 0,
    ...over,
  });
  const sub = (over: Partial<Submission>): Submission => ({
    name: "p",
    era: 0,
    rank: "1",
    alpha: "ω",
    transcends: 0,
    device: "d",
    ...over,
  });

  it("isBetter: rank dominates, then transcends; ties keep incumbent", () => {
    expect(isBetter(sub({ rank: "2" }), sub({ rank: "1" }))).toBe(true);
    expect(isBetter(sub({ rank: "1" }), sub({ rank: "2" }))).toBe(false);
    expect(isBetter(sub({ rank: "5", transcends: 1 }), sub({ rank: "5" }))).toBe(true);
    expect(isBetter(sub({ rank: "5" }), sub({ rank: "5" }))).toBe(false);
    // ranks beyond 2^53 must still compare exactly (strings, not numbers)
    expect(isBetter(sub({ rank: "9007199254740993" }), sub({ rank: "9007199254740992" }))).toBe(true);
  });

  it("compareEntries sorts descending, oldest first on ties", () => {
    const rows = [entry({ rank: "1", at: 5 }), entry({ rank: "3" }), entry({ rank: "3", at: -1 }), entry({ rank: "2", transcends: 9 })];
    const sorted = [...rows].sort(compareEntries);
    expect(sorted.map((r) => `${r.rank}/${r.at}`)).toEqual(["3/-1", "3/0", "2/0", "1/5"]);
  });
});

describe("display formatting", () => {
  it("small ranks get thousands separators, big ranks go scientific", () => {
    expect(formatRank("0")).toBe("0");
    expect(formatRank("1234567")).toBe("1,234,567");
    expect(formatRank("1" + "0".repeat(45))).toBe("1e45");
    expect(formatRank("1234" + "0".repeat(40))).toBe("1234e43");
  });

  it("non-numeric rank strings pass through untouched", () => {
    expect(formatRank("n/a")).toBe("n/a");
  });

  it("era label matches the core ladder", () => {
    expect(eraLabel(0)).toBe(eraAt(0).short);
    expect(eraLabel(4)).toBe(eraAt(4).short);
  });
});

describe("device id", () => {
  it("persists across reads from the same store", async () => {
    const { deviceId } = await import("./leaderboard");
    const store = memStore();
    const a = deviceId(store);
    expect(a).toMatch(/^d-[0-9a-z]+$/);
    expect(store.map.get("infinity.lb.device")).toBe(a);
    expect(deviceId(store)).toBe(a);
  });
});

/* The client mirrors the shared server core (server/leaderboard-core.mjs) —
 * these parity tests are what keeps the two orderings from drifting. */
describe("parity with the shared server core", () => {
  const raw = [
    { rank: "1", transcends: 0, at: 5 },
    { rank: "3", transcends: 0, at: 5 },
    { rank: "3", transcends: 0, at: -1 },
    { rank: "2", transcends: 9, at: 0 },
    { rank: "9007199254740993", transcends: 0, at: 0 },
  ];
  const clientRows: LeaderboardEntry[] = raw.map((r, i) => ({ name: "p", era: 0, ...r, device: `d-${i}`, alpha: "ω" }));
  const serverRows: Entry[] = raw.map((r, i) => ({ device: `d-${i}`, name: "p", era: 0, ...r, alpha: "ω" }));
  const key = (r: { rank: string; at: number }) => `${r.rank}/${r.at}`;

  it("compareEntries produces exactly the server's ordering", () => {
    expect([...clientRows].sort(compareEntries).map(key)).toEqual([...serverRows].sort(serverCompare).map(key));
    // and the winner really is the huge rank (exact BigInt comparison)
    expect([...clientRows].sort(compareEntries)[0]!.rank).toBe("9007199254740993");
  });

  it("isBetter agrees with the server on every comparison", () => {
    const mk = (rank: string, transcends: number): Submission => ({
      name: "a",
      era: 0,
      rank,
      alpha: "ω",
      transcends,
      device: "d1",
    });
    const cases: [Submission, Submission][] = [
      [mk("10", 0), mk("9", 99)],
      [mk("9", 99), mk("10", 0)],
      [mk("9", 1), mk("9", 2)],
      [mk("9", 2), mk("9", 2)],
      [mk("9007199254740993", 0), mk("9007199254740992", 0)],
    ];
    for (const [a, b] of cases) {
      expect(isBetter(a, b)).toBe(serverIsBetter(a, b));
    }
  });
});
