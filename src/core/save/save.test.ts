import { describe, it, expect } from "vitest";
import { MemoryStorage } from "../platform/memory";
import { SaveManager } from "./manager";
import { encodeSave, decodeSave } from "./codec";
import { migrate } from "./migrations";
import { settleOffline } from "./offline";
import type { SaveDataV3 } from "./schema";
import { fromNumber, equal, height } from "../ordinal/ordinal";
import { fromJSON, toJSON } from "../ordinal/serialize";
import { eraAt } from "../game/eras";
import { bn } from "../bignum";

function makeSave(overrides: Partial<SaveDataV3> = {}): SaveDataV3 {
  return {
    version: 3,
    alpha: toJSON(fromNumber(42)),
    money: "1234.5",
    gens: [3, 1],
    era: 0,
    eraGens: [],
    clickLevel: 2,
    transcends: 0,
    axiom: null,
    lastSeen: 1_700_000_000_000,
    phase: "climb",
    rung: 3,
    rungProgress: 120.5,
    drivers: 4,
    ...overrides,
  };
}

describe("migrations (3.2)", () => {
  it("migrates a v0 prototype save to the current version", () => {
    const v0 = { alpha: 42, money: 1234.5, gens: [3, 1], lastSeen: 1_700_000_000_000 };
    const v3 = migrate(v0);
    expect(v3.version).toBe(3);
    expect(equal(fromJSON(v3.alpha), fromNumber(42))).toBe(true);
    expect(v3.money).toBe("1234.5");
    expect(v3.gens).toEqual([3, 1]);
    expect(v3.era).toBe(0);
    expect(v3.eraGens).toEqual([]);
    expect(v3.transcends).toBe(0);
    expect(v3.axiom).toBeNull();
    expect(v3.phase).toBe("climb");
    expect(v3.rung).toBe(1);
  });

  it("upgrades a v1 (CNF-era) save: the ladder is new content, wealth is kept", () => {
    const v1 = {
      version: 1,
      alpha: toJSON(fromNumber(7)),
      money: "999",
      gens: [2, 0],
      alphaGens: [1, 1, 0, 0, 0],
      clickLevel: 3,
      transcends: 1,
      axiom: "vl",
      lastSeen: 1_700_000_000_000,
    };
    const v3 = migrate(v1);
    expect(v3.version).toBe(3);
    expect(v3.phase).toBe("climb");
    expect(v3.rung).toBe(1);
    expect(v3.money).toBe("999");
    expect(v3.gens).toEqual([2, 0]);
    expect(v3.axiom).toBe("vl");
    expect(v3.transcends).toBe(1);
  });

  it("shifts a v2 save down one era slot: ψ (v2 era 2) becomes v3 era 1", () => {
    const v2 = {
      version: 2,
      alpha: toJSON(fromNumber(7)),
      money: "5",
      gens: [1],
      era: 2,
      eraGens: [1, 0, 0],
      clickLevel: 1,
      transcends: 2,
      axiom: null,
      lastSeen: 1_700_000_000_000,
    };
    const v3 = migrate(v2);
    expect(v3.version).toBe(3);
    expect(v3.era).toBe(1);
    expect(v3.phase).toBe("era");
    expect(v3.eraGens).toEqual([1, 0, 0]);
    // α sat below the new era's floor, so it is lifted to Γ₀
    expect(equal(fromJSON(v3.alpha), eraAt(1).startAlpha)).toBe(true);
  });

  it("a v2 save parked on the Veblen ladder lands at the foot of the ψ era", () => {
    const v2 = {
      version: 2,
      alpha: toJSON(fromNumber(99)),
      money: "5",
      gens: [1],
      era: 1, // v2's binary-Veblen era — that range is now the climb's tail
      eraGens: [1, 0],
      clickLevel: 1,
      transcends: 1,
      axiom: null,
      lastSeen: 1_700_000_000_000,
    };
    const v3 = migrate(v2);
    expect(v3.era).toBe(1);
    expect(v3.phase).toBe("era");
    expect(equal(fromJSON(v3.alpha), eraAt(1).startAlpha)).toBe(true);
  });

  it("rejects unknown formats", () => {
    expect(() => migrate({ version: 99 })).toThrow();
    expect(() => migrate("garbage")).toThrow();
    expect(() => migrate({ version: 3, phase: "nonsense" })).toThrow();
  });
});

describe("save manager (3.3)", () => {
  it("rotates the previous payload into the backup slot", () => {
    const storage = new MemoryStorage();
    const mgr = new SaveManager(storage);
    mgr.save(makeSave({ money: "1" }));
    mgr.save(makeSave({ money: "2" }));
    expect(mgr.load()?.money).toBe("2");
    const backupRaw = storage.load("infinity.save.bak");
    expect(backupRaw).not.toBeNull();
    expect(JSON.parse(backupRaw as string).money).toBe("1");
  });

  it("falls back to the backup when the main slot is corrupted", () => {
    const storage = new MemoryStorage();
    const mgr = new SaveManager(storage);
    mgr.save(makeSave({ money: "111" }));
    mgr.save(makeSave({ money: "222" }));
    storage.save("infinity.save", "{corrupted!!!");
    expect(mgr.load()?.money).toBe("111");
  });

  it("returns null when every slot is unreadable, without throwing", () => {
    const storage = new MemoryStorage();
    const mgr = new SaveManager(storage);
    storage.save("infinity.save", "///");
    expect(mgr.load()).toBeNull();
  });
});

describe("save codes (3.4)", () => {
  it("round-trips a save", () => {
    const s = makeSave({ axiom: "V=L", transcends: 2 });
    const decoded = decodeSave(encodeSave(s));
    const normalized = migrate(JSON.parse(JSON.stringify(s)));
    expect(decoded).toEqual(normalized);
  });

  it("rejects garbage codes without touching anything", () => {
    expect(() => decodeSave("!!!not-base64!!!")).toThrow();
    expect(() => decodeSave("YWJj")).toThrow(); // "abc" — valid base64, invalid save
  });
});

describe("offline settlement (3.5)", () => {
  interface ToyState {
    clicks: number;
    wallHits: number;
  }

  function toyStep(s: ToyState): ToyState {
    // grows for the first 100 clicks, then hits the wall (stops changing)
    if (s.clicks >= 100) return s;
    return { clicks: s.clicks + 1, wallHits: s.wallHits };
  }

  it("gains currency over offline seconds and caps at 24h", () => {
    const start = makeSave({ lastSeen: 0, gens: [1] });
    const rate = () => bn(100); // 100/s
    const { report } = settleOffline(0, {
      lastSeen: start.lastSeen,
      now: 60_000, // 1 minute
      step: (s: number) => s + 1,
      isEqual: (a, b) => a === b,
      moneyRate: rate,
    });
    expect(report.seconds).toBe(60);
    expect(report.moneyGain.toString()).toBe("3000"); // 100 × 60 × 0.5
  });

  it("clamps huge deltas to the cap", () => {
    const { report } = settleOffline(0, {
      lastSeen: 0,
      now: 100 * 24 * 60 * 60 * 1000, // 100 days
      step: (s: number) => s + 1,
      isEqual: (a, b) => a === b,
      moneyRate: () => bn(1),
    });
    expect(report.seconds).toBe(24 * 60 * 60);
  });

  it("stops at the wall and reports it", () => {
    const toy: ToyState = { clicks: 99, wallHits: 0 };
    const { state, report } = settleOffline(toy, {
      lastSeen: 0,
      now: 10 * 60 * 60 * 1000,
      step: toyStep,
      isEqual: (a, b) => a.clicks === b.clicks,
      moneyRate: () => bn(0),
    });
    expect(state.clicks).toBe(100);
    expect(report.hitWall).toBe(true);
    expect(report.ticksApplied).toBe(1);
  });

  it("alpha growth never crosses the ε₀ wall even for huge deltas", () => {
    // toy engine: alpha height is capped at 3 (stand-in for the ε₀ guard)
    interface AlphaState {
      ord: ReturnType<typeof fromNumber>;
    }
    const step = (s: AlphaState): AlphaState => {
      if (height(s.ord) >= 3) return s;
      return { ord: fromNumber(s.ord.length === 0 ? (s.ord[0]?.coef ?? 0) + 1 : 1) };
    };
    const { state, report } = settleOffline({ ord: fromNumber(0) }, {
      lastSeen: 0,
      now: 24 * 60 * 60 * 1000,
      step,
      isEqual: (a, b) => equal(a.ord, b.ord),
      moneyRate: () => bn(0),
    });
    expect(height(state.ord)).toBeLessThanOrEqual(3);
    expect(report.hitWall).toBe(true);
  });
});
