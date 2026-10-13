import { describe, it, expect } from "vitest";
import { initialState, type GameState } from "./state";
import {
  absoluteApproach,
  approach,
  buyDriver,
  buyDriverMax,
  buyEraGen,
  canBuyDriver,
  clickValue,
  buyClickUpgrade,
  buyMoneyGen,
  click,
  climbValue,
  convergeThreshold,
  currentRung,
  driversLeft,
  eraGenCost,
  eraOf,
  eraProgress,
  moneyRate,
  previewMoneyGen,
  nextDriverCost,
  omegaApproach,
  progressRank,
  rungFraction,
  rungRate,
  tick,
} from "./engine";
import { eraAt } from "./eras";
import {
  CLIMB_LENGTH,
  EPSILON_ZERO,
  FINAL_RUNG,
  FINITE_LAST,
  ordinalRung,
  rungAt,
  rungThreshold,
} from "./ops";
import {
  equal,
  fromNumber,
  omegaPow,
  add,
  compare,
  ONE,
  OMEGA,
  ZERO,
} from "../ordinal/ordinal";
import { formatOrd } from "../ordinal/format";
import { bn } from "../bignum";

function funded(over: Partial<GameState> = {}): GameState {
  const s = initialState(0);
  s.money = bn(1e30);
  return { ...s, ...over };
}

/** the era chain needs a lot more than the climb: era costs start at ~1e43 */
const RICH = bn("1e60");

/** run ticks until the predicate holds (or give up) */
function run(s: GameState, maxTicks: number, stop: (r: ReturnType<typeof tick>) => boolean) {
  for (let i = 0; i < maxTicks; i++) {
    const r = tick(s);
    if (stop(r)) return r;
    s = r.state;
  }
  return null;
}

/** always flush with cash, always buy every machine the rung allows */
function topUp(s: GameState): GameState {
  return buyDriverMax({ ...s, money: bn(1e30) }).state;
}

const FILL = 2200; // the ψ era converges at 1200; a unit fills in 1200 ticks

describe("tick model (4.1)", () => {
  it("is pure: input state is never mutated", () => {
    const s = funded({ gens: [2, 1], drivers: 3 });
    const snapshot = JSON.stringify({ ...s, money: s.money.toString() });
    tick(s);
    tick(s);
    expect(JSON.stringify({ ...s, money: s.money.toString() })).toBe(snapshot);
  });

  it("is deterministic: two ticks from the same state agree", () => {
    const s = funded({ drivers: 4 });
    const a = tick(s).state;
    const b = tick(s).state;
    expect(a.alpha).toEqual(b.alpha);
    expect(a.rungProgress).toBe(b.rungProgress);
    expect(a.money.toString()).toBe(b.money.toString());
  });

  it("idle state without machines: position frozen, only the base income drips", () => {
    const s = initialState(0);
    const { state } = tick(s);
    expect(state.alpha).toEqual(s.alpha);
    expect(state.rung).toBe(s.rung);
    expect(state.rungProgress).toBe(0);
    expect(state.money.gt(s.money)).toBe(true); // the ×1 manual floor
  });
});

describe("clicking (4.2)", () => {
  it("grants currency but never advances the climb", () => {
    const s = initialState(0);
    const { state, events } = click(s);
    expect(state.money.eq(bn(1))).toBe(true);
    expect(state.rungProgress).toBe(0);
    expect(events.some((e) => e.kind === "clicked" && !e.advanced)).toBe(true);
  });

  it("click upgrade raises click output (4.2)", () => {
    let s = funded();
    s = buyClickUpgrade(s).state;
    expect(s.clickLevel).toBe(2);
    expect(clickValue(s)).toBe(2);
  });

  it("clicking advances α only once the era chain has begun (5.1)", () => {
    const inEra = funded({ phase: "era", era: 1, alpha: omegaPow(fromNumber(1)) });
    let s = click(inEra).state;
    expect(formatOrd(s.alpha)).toBe("ω + 1");
    s = click(s).state;
    expect(formatOrd(s.alpha)).toBe("ω + 2");
  });
});

describe("generators (4.3, 4.4)", () => {
  it("buying a generator makes currency grow faster", () => {
    const bare = initialState(0);
    const withGen = buyMoneyGen({ ...initialState(0), money: bn(100) }, 0).state;
    expect(withGen.gens[0]).toBe(1);
    expect(moneyRate(withGen).gt(moneyRate(bare))).toBe(true);
  });

  it("a higher tier boosts the tier below it", () => {
    const base = funded({ gens: [1, 0, 0, 0, 0] });
    const boosted = funded({ gens: [1, 1, 0, 0, 0] });
    expect(moneyRate(boosted).gt(moneyRate(base))).toBe(true);
  });

  it("previews the exact income change from one money-generator purchase", () => {
    const s = funded({ gens: [2, 1, 0, 0, 0] });
    const preview = previewMoneyGen(s, 1);
    const bought = buyMoneyGen(s, 1).state;
    expect(preview.current.eq(moneyRate(s))).toBe(true);
    expect(preview.afterPurchase.eq(moneyRate(bought))).toBe(true);
    expect(preview.increase.eq(preview.afterPurchase.sub(preview.current))).toBe(true);
    expect(preview.increase.gt(0)).toBe(true);
  });

  it("money generators get progressively more expensive", () => {
    const cheap = moneyRate(funded({ gens: [0, 0, 0, 0, 0] }));
    const rich = moneyRate(funded({ gens: [3, 0, 0, 0, 0] }));
    expect(rich.gt(cheap)).toBe(true);
    expect(buyMoneyGen({ ...initialState(0), money: bn(50) }, 0).events.length).toBe(1);
    expect(buyMoneyGen({ ...initialState(0), money: bn(49) }, 0).events.length).toBe(0);
  });
});

describe("the operation ladder (task 10)", () => {
  it("starts on rung 1 with nothing deployed", () => {
    const s = initialState(0);
    expect(s.phase).toBe("climb");
    expect(s.rung).toBe(1);
    expect(s.drivers).toBe(0);
    expect(climbValue(s)).toBe("0");
  });

  it("a machine pushes progress, and only up to the rung's limit", () => {
    const s = funded({ drivers: 3 });
    expect(rungRate(s)).toBe(3);
    const after = tick(s).state;
    expect(after.rungProgress).toBeCloseTo(0.3, 6);
    const capped = { ...s, drivers: rungAt(1).maxDrivers + 5 };
    expect(rungRate(capped)).toBe(rungAt(1).maxDrivers);
  });

  it("cannot deploy more machines than the rung allows", () => {
    const s = funded({ drivers: rungAt(1).maxDrivers });
    expect(driversLeft(s)).toBe(0);
    expect(canBuyDriver(s)).toBe(false);
    expect(buyDriver(s).events.length).toBe(0);
  });

  it("each extra machine costs more than the last", () => {
    const s = funded({ rung: 4, drivers: 0 });
    const first = nextDriverCost(s);
    const later = nextDriverCost({ ...s, drivers: 5 });
    expect(later).toBeGreaterThan(first);
  });

  it("filling the rung breaks it: notation changes and machines are scrapped", () => {
    const rung = rungAt(1);
    const s = funded({ drivers: rung.maxDrivers, rungProgress: rung.threshold - 0.05 });
    const r = tick(s);
    expect(r.events.some((e) => e.kind === "mutation")).toBe(true);
    expect(r.state.rung).toBe(2);
    expect(r.state.rungProgress).toBe(0);
    expect(r.state.drivers).toBe(0); // the old machines cannot compute at the new level
    // the count carries: 加法 ended at its threshold, so 乘法 reads 10·that
    expect(climbValue(r.state)).toBe(`10·${rung.threshold.toLocaleString("en-US")}`);
  });

  it("the notation actually changes with every rung", () => {
    const seen = new Set<string>();
    for (const rung of Array.from({ length: CLIMB_LENGTH }, (_, i) => i + 1)) {
      const s = funded({ rung, rungProgress: rungThreshold(rung) * 0.5 });
      seen.add(climbValue(s));
    }
    expect(seen.size).toBe(CLIMB_LENGTH);
  });

  it("breaking the last finite rung hands over to ω, not to a bigger finite number", () => {
    const s = funded({
      rung: FINITE_LAST,
      drivers: rungAt(FINITE_LAST).maxDrivers,
      rungProgress: rungThreshold(FINITE_LAST),
    });
    const r = tick(s);
    const mutation = r.events.find((e) => e.kind === "mutation");
    expect(mutation).toBeDefined();
    if (mutation?.kind === "mutation") expect(mutation.notation).toBe("ω");
    expect(r.state.rung).toBe(FINITE_LAST + 1);
    expect(formatOrd(r.state.alpha)).toBe("ω");
  });

  it("the ω-side ladder climbs ω+n → ω·n → ω^n → ω↑↑n → φ(k,0)", () => {
    const at = (rung: number, progress: number) => climbValue(funded({ rung, rungProgress: progress }));
    expect(at(9, 0)).toBe("ω");
    expect(at(9, 500)).toBe("ω + 500");
    // the ω block restarts its count at rung 9, so rung 10 picks it up there
    expect(at(10, 0)).toBe(`ω·${rungThreshold(9).toLocaleString("en-US")}`);
    expect(at(11, 0)).toBe(
      `ω^${(rungThreshold(9) + rungThreshold(10)).toLocaleString("en-US")}`,
    );
    expect(at(12, 38)).toBe("ω↑↑40");
    expect(at(13, 3)).toBe("η₀"); // φ(3,0)
  });

  it("the ω↑↑n rung still lands strictly below ε₀", () => {
    const top = ordinalRung(12, rungThreshold(12));
    expect(compare(top, EPSILON_ZERO)).toBeLessThan(0);
  });

  it("the whole ladder ends at Γ₀ and opens the era chain", () => {
    const s = funded({
      rung: FINAL_RUNG,
      drivers: rungAt(FINAL_RUNG).maxDrivers,
      rungProgress: rungThreshold(FINAL_RUNG),
    });
    const r = tick(s);
    expect(r.events.some((e) => e.kind === "transcended")).toBe(true);
    expect(r.state.phase).toBe("era");
    expect(r.state.era).toBe(1);
    expect(r.state.transcends).toBe(1);
    expect(eraOf(r.state).id).toBe("psi");
    expect(formatOrd(r.state.alpha)).toBe("ψ(Ω^Ω)"); // Γ₀ = Feferman–Schütte
    expect(r.state.eraGens.length).toBe(eraOf(r.state).gens.length);
    expect(r.state.eraGens.every((g) => g === 0)).toBe(true);
  });

  it("a machine-less climb never gets anywhere", () => {
    let s = initialState(0);
    for (let i = 0; i < 5000; i++) s = tick(s).state;
    expect(s.rung).toBe(1);
    expect(s.rungProgress).toBe(0);
  });

  it("the whole climb is finite and lands in the era chain", () => {
    let s: GameState = funded();
    let landed = false;
    for (let i = 0; i < 300_000 && !landed; i++) {
      s = topUp(s);
      const r = tick(s);
      s = r.state;
      if (r.events.some((e) => e.kind === "transcended")) landed = true;
    }
    expect(landed).toBe(true);
    expect(s.phase).toBe("era");
    expect(s.transcends).toBe(1);
  });

  it("no machines can be bought once the era chain has begun", () => {
    const s = funded({ phase: "era", era: 1, alpha: eraAt(1).startAlpha });
    expect(canBuyDriver(s)).toBe(false);
    expect(buyDriver(s).events.length).toBe(0);
  });
});

describe("position & convergence in the era chain (4.5, 5.1, 5.2)", () => {
  it("clicks cannot produce ω on their own", () => {
    let s = initialState(0);
    for (let i = 0; i < 1000; i++) s = click(s).state;
    expect(s.rungProgress).toBe(0);
    expect(formatOrd(s.alpha)).toBe("0");
  });

  it("tail absorption math: X·2+7 +X = X·3 (5.1)", () => {
    const era = eraAt(1);
    const term = era.gens[0]!.increment(ZERO, 1);
    const s = funded({
      phase: "era",
      era: 1,
      alpha: add([{ head: term.head, coef: 2 }], fromNumber(7)), // X·2 + 7
      eraGens: era.gens.map((_, j) => (j === 0 ? 1 : 0)),
    });
    const { state } = tick(s);
    // X·2+7 +X → X·3 (the finite tail is swallowed, the coefficient adds)
    expect(state.alpha.length).toBe(1);
    expect(state.alpha[0]!.coef).toBe(3);
  });

  it("a rung opens only once the position has reached it (5.2)", () => {
    const era = eraAt(1);
    const start = funded({ phase: "era", era: 1, alpha: era.startAlpha, money: RICH });
    expect(buyEraGen(start, 1).events.some((e) => e.kind === "bought")).toBe(false);
    const later = funded({
      phase: "era",
      era: 1,
      alpha: [era.gens[1]!.increment(ZERO, 1)],
      money: RICH,
    });
    expect(buyEraGen(later, 1).events.some((e) => e.kind === "bought")).toBe(true);
    expect(buyEraGen(later, 2).events.some((e) => e.kind === "bought")).toBe(false);
  });

  it("the ψ ladder delivers its next rung once a coefficient fills", () => {
    const era = eraAt(1);
    const s = funded({
      phase: "era",
      era: 1,
      alpha: era.startAlpha,
      eraGens: era.gens.map((_, j) => (j === 0 ? 1 : 0)),
    });
    const r = run(s, FILL + 50, (x) => x.events.some((e) => e.kind === "converged"));
    expect(r).not.toBeNull();
    expect(equal(r!.state.alpha, [era.gens[1]!.increment(ZERO, 1)])).toBe(true);
  });

  it("era generator units get progressively more expensive", () => {
    const era = eraAt(1);
    const s = funded({ phase: "era", era: 1, alpha: era.startAlpha });
    const cheap = eraGenCost(s, 0);
    const owned = { ...s, eraGens: era.gens.map((_, j) => (j === 0 ? 3 : 0)) };
    expect(eraGenCost(owned, 0)).toBeGreaterThan(cheap);
  });
});

describe("meters", () => {
  it("the rung meter runs 0 → 1 and the climb meter never goes backwards", () => {
    const rung = rungAt(3);
    expect(rungFraction(funded({ rung: 3, rungProgress: 0 }))).toBe(0);
    expect(rungFraction(funded({ rung: 3, rungProgress: rung.threshold / 2 }))).toBeCloseTo(0.5, 6);
    const early = approach(funded({ rung: 2, rungProgress: 0 }));
    const late = approach(funded({ rung: 5, rungProgress: 0 }));
    expect(late).toBeGreaterThan(early);
    expect(approach(funded({ rung: CLIMB_LENGTH, rungProgress: rungThreshold(CLIMB_LENGTH) }))).toBe(1);
  });

  it("the ω meter reaches 1 exactly when the finite ladder ends", () => {
    expect(omegaApproach(initialState(0))).toBe(0);
    const mid = omegaApproach(funded({ rung: 3, rungProgress: rungThreshold(3) / 2 }));
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(omegaApproach(funded({ rung: FINITE_LAST + 1, rungProgress: 0 }))).toBe(1);
    expect(omegaApproach(funded({ phase: "era", era: 1 }))).toBe(1);
  });

  it("Ω approach is 0 during the climb and never reaches 1 afterwards", () => {
    expect(absoluteApproach(initialState(0))).toBe(0);
    const uncountable = funded({ phase: "era", era: 3, alpha: eraAt(3).startAlpha });
    expect(absoluteApproach(uncountable)).toBeGreaterThan(0);
    const deep = funded({ phase: "era", era: 11, alpha: eraAt(11).startAlpha });
    expect(absoluteApproach(deep)).toBeGreaterThan(absoluteApproach(uncountable));
    expect(absoluteApproach(deep)).toBeLessThan(1);
  });

  it("era progress runs 0 → 1 across the ladder", () => {
    const era = eraAt(1);
    // standing on the first rung (the ψ era starts at Γ₀, just below it)
    const atStart = funded({
      phase: "era",
      era: 1,
      alpha: [era.gens[0]!.increment(ZERO, 1)],
      eraGens: era.gens.map((_, j) => (j === 0 ? 1 : 0)),
    });
    const early = eraProgress(atStart);
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(0.1);
    const last = era.gens.length - 1;
    const late = funded({
      phase: "era",
      era: 1,
      alpha: [era.gens[last]!.increment(ZERO, 1900)],
      eraGens: era.gens.map(() => 1),
    });
    expect(eraProgress(late)).toBeGreaterThan(0.9);
  });
});

describe("leaderboard bridge", () => {
  it("grows monotonically with the climb, then switches to the ordinal rank", () => {
    const rungFrac = (rung: number, frac: number) =>
      progressRank(funded({ rung, rungProgress: rungThreshold(rung) * frac }));
    expect(progressRank(initialState(0))).toBe(0);
    expect(rungFrac(1, 0.5)).toBeGreaterThan(0);
    expect(rungFrac(FINITE_LAST, 1)).toBeGreaterThan(rungFrac(3, 0.5));
    // the finite ladder never reports an ω-sized rank
    expect(rungFrac(FINITE_LAST, 1)).toBeLessThan(5);
    // crossing into ω is a visible jump
    expect(progressRank(funded({ rung: FINITE_LAST + 1, rungProgress: 0 }))).toBeGreaterThanOrEqual(5);
    expect(
      progressRank(funded({ phase: "era", era: 1, alpha: eraAt(1).startAlpha })),
    ).toBeGreaterThan(progressRank(funded({ rung: FINITE_LAST + 1, rungProgress: 0 })));
  });
});

describe("axiom modifiers (5.5)", () => {
  it("axiom cards produce observably different runs", () => {
    const vl = funded({ phase: "era", era: 1, axiom: "vl", transcends: 1, gens: [1, 0, 0, 0, 0] });
    const forcing = funded({ phase: "era", era: 1, axiom: "forcing", transcends: 1, gens: [1, 0, 0, 0, 0] });
    expect(convergeThreshold(vl)).toBe(2400);
    expect(convergeThreshold(forcing)).toBe(600);
    expect(moneyRate(vl).gt(moneyRate(forcing))).toBe(true);
  });

  it("transcends accelerate income", () => {
    const fresh = funded({ gens: [1, 0, 0, 0, 0] });
    const veteran = funded({ gens: [1, 0, 0, 0, 0], transcends: 5 });
    expect(moneyRate(veteran).gt(moneyRate(fresh))).toBe(true);
  });
});

describe("state plumbing", () => {
  it("initial state sits at the foot of the ladder", () => {
    const s = initialState(0);
    expect(s.era).toBe(0);
    expect(s.eraGens.length).toBe(0); // era 0 is the climb, not a generator ladder
    expect(equal(s.alpha, ZERO)).toBe(true);
    expect(s.phase).toBe("climb");
    expect(s.rung).toBe(1);
    expect(currentRung(s).name).toBe("加法");
    expect(OMEGA).toBeDefined();
    expect(ONE).toBeDefined();
  });
});
