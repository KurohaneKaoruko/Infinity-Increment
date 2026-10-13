import { describe, it, expect } from "vitest";
import { initialState, type GameState } from "./state";
import {
  buyEraGen,
  clickValue,
  buyClickUpgrade,
  buyMoneyGen,
  click,
  convergeThreshold,
  eraGenCost,
  eraOf,
  eraProgress,
  moneyRate,
  omegaApproach,
  tick,
} from "./engine";
import { eraAt } from "./eras";
import { equal, fromNumber, omegaPow, add, ONE, OMEGA, ZERO, termVeblen } from "../ordinal/ordinal";
import { formatOrd } from "../ordinal/format";
import { bn } from "../bignum";

function funded(over: Partial<GameState> = {}): GameState {
  const s = initialState(0);
  s.money = bn(1e30);
  return { ...s, ...over };
}

/** ZETA0 = φ(2,0) as a value (an aleph-index-sized ordinal). */
const ZETA0 = [termVeblen(fromNumber(2), ZERO)];

/** run ticks until the predicate holds (or give up) */
function run(s: GameState, maxTicks: number, stop: (r: ReturnType<typeof tick>) => boolean) {
  for (let i = 0; i < maxTicks; i++) {
    const r = tick(s);
    if (stop(r)) return r;
    s = r.state;
  }
  return null;
}

const FILL = 2200; // era I converge is 2000; a unit fills in 2000 ticks

describe("tick model (4.1)", () => {
  it("is pure: input state is never mutated", () => {
    const s = funded({ gens: [2, 1] });
    const snapshot = JSON.stringify({ ...s, money: s.money.toString() });
    tick(s);
    tick(s);
    expect(JSON.stringify({ ...s, money: s.money.toString() })).toBe(snapshot);
  });

  it("is deterministic: two ticks from the same state agree", () => {
    const s = funded({ eraGens: [1, 0, 0, 0, 0] });
    const a = tick(s).state;
    const b = tick(s).state;
    expect(equal(a.alpha, b.alpha)).toBe(true);
    expect(a.money.toString()).toBe(b.money.toString());
  });

  it("idle state without generators changes nothing (pause-safe)", () => {
    const s = initialState(0);
    const { state } = tick(s);
    expect(equal(state.alpha, s.alpha)).toBe(true);
    expect(state.money.eq(s.money)).toBe(true);
  });
});

describe("clicking (4.2)", () => {
  it("grants currency and advances the position by 1", () => {
    const s = initialState(0);
    const { state, events } = click(s);
    expect(state.money.eq(bn(1))).toBe(true);
    expect(formatOrd(state.alpha)).toBe("1");
    expect(events.some((e) => e.kind === "clicked")).toBe(true);
  });

  it("click upgrade raises click output (4.2)", () => {
    let s = funded();
    s = buyClickUpgrade(s).state;
    expect(s.clickLevel).toBe(2);
    expect(clickValue(s)).toBe(2);
  });
});

describe("generators (4.3, 4.4)", () => {
  it("buying a generator makes currency grow on its own", () => {
    let s = buyMoneyGen({ ...initialState(0), money: bn(100) }, 0).state;
    expect(s.gens[0]).toBe(1);
    const baseline = s.money.toString();
    for (let i = 0; i < 10; i++) s = tick(s).state;
    expect(s.money.gt(bn(baseline))).toBe(true);
  });

  it("a higher tier boosts the tier below it", () => {
    const base = funded({ gens: [1, 0, 0, 0, 0] });
    const boosted = funded({ gens: [1, 1, 0, 0, 0] });
    expect(moneyRate(boosted).gt(moneyRate(base))).toBe(true);
  });

  it("era generator units get progressively more expensive", () => {
    const s = funded({ eraGens: [0, 0, 0, 0, 0] });
    const cheap = eraGenCost(s, 0);
    const owned = funded({ eraGens: [3, 0, 0, 0, 0] });
    expect(eraGenCost(owned, 0)).toBeGreaterThan(cheap);
  });
});

describe("position & convergence (4.5, 5.1, 5.2)", () => {
  it("cofinal generator drives α to ω and the limit arrives", () => {
    let s = funded({ eraGens: [1, 0, 0, 0, 0] });
    const r = run(s, FILL + 50, (x) => x.events.some((e) => e.kind === "converged"));
    expect(r).not.toBeNull();
    s = r!.state;
    expect(formatOrd(s.alpha)).toBe("ω");
  });

  it("clicks cannot produce ω on their own (no cofinal sequence → no convergence)", () => {
    let s = initialState(0);
    for (let i = 0; i < 1000; i++) s = click(s).state;
    // still finite — the limit never arrives from clicks alone
    expect(formatOrd(s.alpha)).toBe("1000");
  });

  it("clicking at ω climbs the fine structure: ω → ω+1 → ω+2 (5.1)", () => {
    let s = funded({ alpha: omegaPow(fromNumber(1)) });
    s = click(s).state;
    expect(formatOrd(s.alpha)).toBe("ω + 1");
    s = click(s).state;
    expect(formatOrd(s.alpha)).toBe("ω + 2");
  });

  it("tail absorption math: ω·2+7 +ω = ω·3 (5.1)", () => {
    const w2 = add(omegaPow(fromNumber(1)), omegaPow(fromNumber(1))); // ω·2
    const s = funded({
      alpha: add(w2, fromNumber(7)), // ω·2 + 7
      eraGens: [1, 1, 0, 0, 0],
    });
    const { state } = tick(s);
    // ω·2+7 +ω → ω·3 (tail swallowed), then cofinal-0 adds +1 → ω·3+1
    expect(formatOrd(state.alpha)).toBe("ω·3 + 1");
  });

  it("a rung opens only once the position has reached it (5.2)", () => {
    // at the origin nothing beyond rung 0 is deployable
    expect(buyEraGen(funded(), 1).events.some((e) => e.kind === "bought")).toBe(false);
    // having climbed to ω, the ω-rung (rung 1) opens
    const atOmega = funded({ alpha: omegaPow(fromNumber(1)) });
    expect(buyEraGen(atOmega, 1).events.some((e) => e.kind === "bought")).toBe(true);
    // rung 2 (ω²) stays shut until the ω-rung completes
    expect(buyEraGen(atOmega, 2).events.some((e) => e.kind === "bought")).toBe(false);
  });

  it("convergence continues up the ladder: ω → ω²", () => {
    let s = funded({ alpha: omegaPow(fromNumber(1)), eraGens: [1, 1, 0, 0, 0] });
    const r = run(s, FILL + 50, (x) => x.events.some((e) => e.kind === "converged"));
    expect(r).not.toBeNull();
    s = r!.state;
    expect(formatOrd(s.alpha)).toBe("ω^2");
  });

  it("the era wall transcends into the Veblen era", () => {
    // sit on the last CNF rung (ω^7) and let it fill
    let s = funded({ alpha: omegaPow(fromNumber(7)), eraGens: [0, 0, 0, 0, 0, 0, 0, 1] });
    const r = run(s, FILL + 50, (x) => x.events.some((e) => e.kind === "transcended"));
    expect(r).not.toBeNull();
    s = r!.state;
    expect(s.era).toBe(1);
    expect(s.transcends).toBe(1);
    expect(eraOf(s).id).toBe("veblen");
    expect(formatOrd(s.alpha)).toBe("ε₀"); // the Veblen era's starting position
    expect(s.eraGens.length).toBe(eraOf(s).gens.length);
    expect(s.eraGens.every((g) => g === 0)).toBe(true);
  });

  it("the Veblen ladder delivers φ(1,1) = ε₁ from ε₀", () => {
    let s = funded({ era: 1, eraGens: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    const r = run(s, FILL + 50, (x) => x.events.some((e) => e.kind === "converged"));
    expect(r).not.toBeNull();
    expect(formatOrd(r!.state.alpha)).toBe("ε₁");
  });
});

describe("meters", () => {
  it("era progress runs 0 → 1 across the ladder", () => {
    const eps0 = [termVeblen(ONE, ZERO)]; // the Veblen era's first rung
    expect(eraProgress(funded({ era: 1, eraGens: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }))).toBe(0);
    const atStart = funded({
      era: 1,
      alpha: eps0,
      eraGens: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    const early = eraProgress(atStart);
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(0.1);
    // mid-ladder: the φ(2,ω) rung nearly filled
    const mid = funded({
      era: 1,
      alpha: [termVeblen(fromNumber(2), OMEGA, 1900)],
      eraGens: [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(eraProgress(mid)).toBeGreaterThan(0.2);
    expect(eraProgress(mid)).toBeLessThan(0.6);
    // at the wall rung, nearly filled
    const late = funded({
      era: 1,
      alpha: [termVeblen(ZETA0, ZERO, 1900)],
      eraGens: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    });
    expect(eraProgress(late)).toBeGreaterThan(0.9);
  });

  it("Ω approach never reaches 1, however far the climb", () => {
    expect(omegaApproach(initialState(0))).toBe(0);
    const uncountable = funded({ alpha: eraAt(3).startAlpha });
    expect(omegaApproach(uncountable)).toBeGreaterThan(0);
    const deep = funded({ alpha: eraAt(11).startAlpha }); // the superhuge wall
    expect(omegaApproach(deep)).toBeGreaterThan(omegaApproach(uncountable));
    expect(omegaApproach(deep)).toBeLessThan(1);
  });
});

describe("axiom modifiers (5.5)", () => {
  it("axiom cards produce observably different runs", () => {
    const vl = funded({ axiom: "vl", transcends: 1, gens: [1, 0, 0, 0, 0] });
    const forcing = funded({ axiom: "forcing", transcends: 1, gens: [1, 0, 0, 0, 0] });
    expect(convergeThreshold(vl)).toBe(4000);
    expect(convergeThreshold(forcing)).toBe(1000);
    expect(moneyRate(vl).gt(moneyRate(forcing))).toBe(true);
  });

  it("transcends accelerate income", () => {
    const fresh = funded({ gens: [1, 0, 0, 0, 0] });
    const veteran = funded({ gens: [1, 0, 0, 0, 0], transcends: 5 });
    expect(moneyRate(veteran).gt(moneyRate(fresh))).toBe(true);
  });
});

describe("state plumbing", () => {
  it("initial state sits at the CNF era with its rungs", () => {
    const s = initialState(0);
    expect(s.era).toBe(0);
    expect(s.eraGens.length).toBe(eraOf(s).gens.length);
    expect(equal(s.alpha, ZERO)).toBe(true);
  });
});
