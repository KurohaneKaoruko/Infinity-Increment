/* Balance probe (task 4.6 / task 12): greedy-policy simulation across the
 * operation ladder and the era chain.
 * Targets: the climb reaches ω → Γ₀ in roughly an hour and a half, no era wall
 * arrives in seconds (the climb must feel endless) and no era wall is
 * unreachable (costs must track the income bridge). */
import { describe, it, expect } from "vitest";
import { initialState, type GameState } from "./state";
import {
  autoPurchase,
  buyDriver,
  buyEraGen,
  buyClickUpgrade,
  buyMoneyGen,
  canBuyDriver,
  click,
  eraGenCost,
  eraOf,
  nextDriverCost,
  rungReached,
  tick,
} from "./engine";
import { canUsePulse, usePulse } from "./pulse";
import { PULSE_COST_TICKS } from "./config";
import { eraAt } from "./eras";
import { MONEY_GENS, TICKS_PER_SECOND, moneyGenCost } from "./config";
import { bn } from "../bignum";

interface Policy {
  s: GameState;
  clicks: number;
}

/* ---------------- the climb ---------------- */

/** a player who buys machines the moment they can afford them, and sinks
 *  spare change into infrastructure without derailing the next machine */
function climbStep(s: GameState): GameState {
  if (canBuyDriver(s)) return buyDriver(s).state;
  const reserve = nextDriverCost(s) * 0.2;
  for (let tier = MONEY_GENS.length - 1; tier >= 0; tier--) {
    const cost = moneyGenCost(tier, s.gens[tier] ?? 0);
    if (cost <= reserve && s.money.gte(cost)) {
      const r = buyMoneyGen(s, tier);
      if (r.events.length > 0) return r.state;
    }
  }
  return s;
}

/** seconds until the climb hands over to the era chain (Infinity on budget out) */
function playClimb(budgetSeconds: number): number {
  let s = initialState(0);
  const totalTicks = budgetSeconds * TICKS_PER_SECOND;
  for (let t = 0; t < totalTicks; t++) {
    s = climbStep(s);
    const r = tick(s);
    s = r.state;
    if (r.events.some((e) => e.kind === "transcended")) return t / TICKS_PER_SECOND;
  }
  return Number.POSITIVE_INFINITY;
}

/* ---------------- the era chain ---------------- */

function step(p: Policy, t: number): void {
  // casual player: ~3 clicks/second early, trailing off later
  if (t % 3 === 0) {
    p.s = click(p.s).state;
    p.clicks++;
  }
  const era = eraOf(p.s);
  // frontier rung: the first unowned rung that has been reached
  let frontier = -1;
  for (let j = 0; j < era.gens.length; j++) {
    if ((p.s.eraGens[j] ?? 0) === 0) {
      frontier = j;
      break;
    }
  }
  const reserve = frontier >= 0 && rungReached(p.s, frontier) ? eraGenCost(p.s, frontier) : 0;
  // 1. the ladder has priority
  if (frontier >= 0 && rungReached(p.s, frontier)) {
    const r = buyEraGen(p.s, frontier);
    if (r.events.length > 0) {
      p.s = r.state;
      return;
    }
  }
  // 2. rich beyond the reserve: top up the frontier rung to fill faster
  if (frontier >= 0 && (p.s.eraGens[frontier] ?? 0) > 0 && p.s.money.gt(bn(reserve * 4))) {
    const r = buyEraGen(p.s, frontier);
    if (r.events.length > 0) {
      p.s = r.state;
      return;
    }
  }
  // 3. surplus goes to infrastructure only when the ladder is funded
  if (p.s.money.gt(bn(reserve * 2))) {
    for (let tier = 0; tier < MONEY_GENS.length; tier++) {
      const r = buyMoneyGen(p.s, tier);
      if (r.events.length > 0) {
        p.s = r.state;
        break;
      }
    }
  }
  if (t % (10 * TICKS_PER_SECOND) === 0) p.s = buyClickUpgrade(p.s).state;
}

/** seconds until the wall of era `eraIndex` breaks (Infinity on budget out) */
function play(eraIndex: number, budgetSeconds: number): number {
  let p: Policy = { s: initialState(0), clicks: 0 };
  if (eraIndex > 0) {
    // a veteran arrives: money generators maxed (trivial by then), no currency
    p.s = {
      ...p.s,
      phase: "era",
      era: eraIndex,
      eraGens: eraAt(eraIndex).gens.map(() => 0),
      alpha: eraAt(eraIndex).startAlpha,
      transcends: eraIndex,
      gens: MONEY_GENS.map(() => 30),
    };
  }
  const totalTicks = budgetSeconds * TICKS_PER_SECOND;
  for (let t = 0; t < totalTicks; t++) {
    step(p, t);
    const r = tick(p.s);
    p.s = r.state;
    if (r.events.some((e) => e.kind === "transcended")) return t / TICKS_PER_SECOND;
  }
  return Number.POSITIVE_INFINITY;
}

const MIN_PER_ERA = 25; // minutes — no wall may break faster than this
const MAX_PER_ERA = 200; // minutes — no wall may be out of reach

describe("operation ladder pacing (task 12)", () => {
  it("the climb from 1 to Γ₀ lands in the target window", () => {
    const minutes = playClimb(240 * 60) / 60;
    expect(minutes).toBeGreaterThan(60);
    expect(minutes).toBeLessThan(150);
  }, 300_000);
});

describe("era chain pacing (4.6)", () => {
  it("era I (ψ parameter samples) breaks its wall in a sane window", () => {
    const minutes = play(1, 220 * 60) / 60;
    expect(minutes).toBeGreaterThanOrEqual(MIN_PER_ERA);
    expect(minutes).toBeLessThanOrEqual(MAX_PER_ERA);
  }, 300_000);

  it("era II (aleph → first inaccessible) breaks its wall in a sane window", () => {
    const minutes = play(2, 220 * 60) / 60;
    expect(minutes).toBeGreaterThanOrEqual(MIN_PER_ERA);
    expect(minutes).toBeLessThanOrEqual(MAX_PER_ERA);
  }, 300_000);

  it("era III (cardinal tier 1) breaks its wall in a sane window", () => {
    const minutes = play(3, 220 * 60) / 60;
    expect(minutes).toBeGreaterThanOrEqual(MIN_PER_ERA);
    expect(minutes).toBeLessThanOrEqual(MAX_PER_ERA);
  }, 300_000);

  it("the cardinal ladder keeps going (era IV wall reachable)", () => {
    const minutes = play(4, 220 * 60) / 60;
    expect(minutes).toBeGreaterThanOrEqual(MIN_PER_ERA);
    expect(minutes).toBeLessThanOrEqual(MAX_PER_ERA);
  }, 300_000);

  it("procedural tiers stay reachable far down the endless ladder", () => {
    // era 12 = the 10th axiom tier — no authored content left, still playable
    const minutes = play(12, 220 * 60) / 60;
    expect(minutes).toBeGreaterThan(0);
    expect(minutes).toBeLessThanOrEqual(MAX_PER_ERA);
  }, 300_000);
});

describe("the actual automatic-play loop", () => {
  function automaticRun(start: GameState, budgetSeconds: number, active = false, firstCheckpoint = true): number {
    let s = start;
    for (let i = 0; i < budgetSeconds * TICKS_PER_SECOND; i++) {
      s = autoPurchase(tick(s).state);
      if (active && i % PULSE_COST_TICKS === 0) {
        const mode = canUsePulse(s, "progress") ? "progress" : "money";
        s = autoPurchase(usePulse(s, mode).state);
      }
      if (s.era > start.era || s.phase !== start.phase || (firstCheckpoint && start.rung === 1 && s.rung > 1)) {
        return (i + 1) / TICKS_PER_SECOND;
      }
    }
    return Infinity;
  }

  it("starts without clicking and gives active pulses a measurable advantage", () => {
    const idle = automaticRun(initialState(), 600);
    const active = automaticRun(initialState(), 600, true);
    expect(idle).toBeLessThan(6 * 60);
    expect(active).toBeLessThan(idle - 10);
  });

  it("reaches the era chain from a fresh save without input", () => {
    const elapsed = automaticRun(initialState(), 150 * 60, false, false);
    expect(elapsed).toBeGreaterThan(30 * 60);
    expect(elapsed).toBeLessThan(150 * 60);
  });

  it.each([1, 2, 3])("continues through era %i with the real automatic buyer", (index) => {
    const era = eraAt(index);
    const start = {
      ...initialState(), phase: "era" as const, era: index,
      alpha: era.startAlpha, eraGens: era.gens.map(() => 0),
      transcends: index, gens: MONEY_GENS.map(() => 30),
    };
    const elapsed = automaticRun(start, 200 * 60);
    expect(elapsed).toBeGreaterThan(30);
    expect(elapsed).toBeLessThan(200 * 60);
  });
});
