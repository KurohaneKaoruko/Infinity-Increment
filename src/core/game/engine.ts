/* Pure game engine: every transition is (state) → (state, events).
 * Nothing here touches the DOM, storage, or timers (design D5).
 *
 * The model is one endless era chain: each era is a ladder of rungs.
 * Owning a rung's generator adds its term every tick; when the lead sits
 * on the rung with a filled coefficient, the rung delivers its limit —
 * the next rung, or the era wall, which transcends into the next era. */
import {
  add,
  compare,
  equal,
  fromNumber,
  type Ord,
  type Term,
} from "../ordinal/ordinal";
import { bn, type BigNum } from "../bignum";
import { bridgeMultiplierExp, rank } from "../ordinal/rank";
import {
  ERA_UNIT_COST_MULT,
  MONEY_GENS,
  TICKS_PER_SECOND,
  TIER_BOOST,
  axiomDef,
  clickUpgradeCost,
  moneyGenCost,
  type AxiomDef,
} from "./config";
import { eraAt, type EraDef, type GenDef } from "./eras";
import type { GameState } from "./state";

export type GameEvent =
  | { kind: "clicked"; money: number; advanced: boolean }
  | { kind: "bought"; what: string }
  | { kind: "converged"; to: string }
  | { kind: "waypoint"; label: string }
  | { kind: "transcended"; era: number; name: string; wall: string };

export interface TickResult {
  state: GameState;
  events: GameEvent[];
}

/* ------------------------------------------------------------------ */
/* Era resolution                                                      */
/* ------------------------------------------------------------------ */

export function eraOf(s: GameState): EraDef {
  return eraAt(s.era);
}

/** Head-equality of two terms, ignoring coefficients. */
function sameHead(x: Term, y: Term): boolean {
  return equal([{ head: x.head, coef: 1 }], [{ head: y.head, coef: 1 }]);
}

/** 0 → 1 across the current era's ladder (wall meter). */
export function eraProgress(s: GameState): number {
  const era = eraOf(s);
  const lead = s.alpha;
  const total = era.gens.length;
  if (total === 0 || lead.length === 0) return 0;
  const leadHeadOnly: Term = { head: lead[0]!.head, coef: 1 };
  let j = 0;
  for (; j < total; j++) {
    const rungTerm = era.gens[j]!.increment(lead, 1);
    if (compare([{ head: rungTerm.head, coef: 1 }], [leadHeadOnly]) >= 0) break;
  }
  if (j >= total) return 1;
  const rungTerm = era.gens[j]!.increment(lead, 1);
  const fill = sameHead(rungTerm, lead[0]!)
    ? Math.min(1, lead[0]!.coef / convergeThreshold(s))
    : 0;
  return (j + fill) / total;
}

/** Asymptotic approach to the absolute infinite Ω — never reaches 1. */
export function omegaApproach(s: GameState): number {
  return 1 - Math.exp(-rank(s.alpha) / 2 ** 60);
}

/* ------------------------------------------------------------------ */
/* Economy                                                             */
/* ------------------------------------------------------------------ */

/** g(α): ordinal position → the currency multiplier (rank bridge). */
export function alphaMult(a: Ord): BigNum {
  return bn(2).pow(bridgeMultiplierExp(a));
}

export function prestigeMult(s: GameState): number {
  return 1 + 2 * s.transcends;
}

function axiomOf(s: GameState): AxiomDef | null {
  return axiomDef(s.axiom);
}

export function convergeThreshold(s: GameState): number {
  return eraOf(s).converge * (axiomOf(s)?.convergeMult ?? 1);
}

/** currency per second (the g(α) bridge lives here) */
export function moneyRate(s: GameState): BigNum {
  let base = bn(0);
  for (let i = 0; i < MONEY_GENS.length; i++) {
    const count = s.gens[i] ?? 0;
    if (count <= 0) continue;
    const next = s.gens[i + 1] ?? 0;
    const boost = 1 + TIER_BOOST * next;
    base = base.add(bn(MONEY_GENS[i]!.baseRate * count * boost));
  }
  return base
    .mul(prestigeMult(s))
    .mul(bn(axiomOf(s)?.moneyMult ?? 1))
    .mul(alphaMult(s.alpha));
}

export function clickValue(s: GameState): number {
  return s.clickLevel * prestigeMult(s) * (axiomOf(s)?.clickMult ?? 1);
}

/** cost of the next unit of era generator idx */
export function eraGenCost(s: GameState, idx: number): number {
  const gen = eraOf(s).gens[idx];
  if (!gen) return Number.POSITIVE_INFINITY;
  const owned = s.eraGens[idx] ?? 0;
  return Math.ceil(gen.cost * Math.pow(ERA_UNIT_COST_MULT, owned));
}

/* ------------------------------------------------------------------ */
/* Transitions                                                         */
/* ------------------------------------------------------------------ */

/** owned rung indices, highest first */
function ownedRungs(s: GameState): number[] {
  const out: number[] = [];
  for (let j = s.eraGens.length - 1; j >= 0; j--) {
    if ((s.eraGens[j] ?? 0) > 0) out.push(j);
  }
  return out;
}

export function tick(s: GameState): TickResult {
  const events: GameEvent[] = [];
  const next: GameState = { ...s, gens: [...s.gens], eraGens: [...s.eraGens] };

  // currency: closed rate per tick
  next.money = next.money.add(moneyRate(s).div(TICKS_PER_SECOND));

  const era = eraOf(s);
  const owned = ownedRungs(next);

  // position: add every owned rung's term, highest first so lower rungs'
  // closures see the updated lead (the Veblen-era pattern needs this).
  let alpha = next.alpha;
  for (const j of owned) {
    const count = next.eraGens[j]!;
    alpha = add(alpha, [era.gens[j]!.increment(alpha, count)]);
  }
  next.alpha = alpha;

  // convergence: the highest owned rung that sits filled delivers its limit
  const threshold = convergeThreshold(s);
  for (const j of owned) {
    const gen: GenDef = era.gens[j]!;
    if (!gen.saturates(next.alpha, threshold)) continue;
    if (gen.wall) {
      const to = s.era + 1;
      const nextEra = eraAt(to);
      next.era = to;
      next.eraGens = nextEra.gens.map(() => 0);
      next.transcends = s.transcends + 1;
      next.alpha = nextEra.startAlpha;
      events.push({ kind: "transcended", era: to, name: nextEra.name, wall: era.wallName });
    } else {
      next.alpha = gen.deliver(next.alpha);
      events.push({ kind: "converged", to: gen.name });
      if (gen.waypoint) events.push({ kind: "waypoint", label: gen.waypoint });
    }
    break;
  }

  return { state: next, events };
}

export function click(s: GameState): TickResult {
  const events: GameEvent[] = [];
  const next: GameState = { ...s };
  next.money = next.money.add(clickValue(s));
  // right successor α+1: climbs the fine structure on top of any limit
  // (ω → ω+1 → ω+2 …); never absorbed — absorption belongs to the limits.
  next.alpha = add(s.alpha, fromNumber(1));
  events.push({ kind: "clicked", money: clickValue(s), advanced: true });
  return { state: next, events };
}

export function buyMoneyGen(s: GameState, tier: number): TickResult {
  const cost = moneyGenCost(tier, s.gens[tier] ?? 0);
  if (s.money.lt(cost)) return { state: s, events: [] };
  const next: GameState = { ...s, gens: [...s.gens] };
  next.money = next.money.sub(cost);
  next.gens[tier] = (next.gens[tier] ?? 0) + 1;
  return { state: next, events: [{ kind: "bought", what: MONEY_GENS[tier]!.name }] };
}

/** Has the climb reached rung idx's position? (rung 0 is always open.) */
export function rungReached(s: GameState, idx: number): boolean {
  if (idx <= 0) return true;
  const gen = eraOf(s).gens[idx];
  if (!gen) return false;
  const lead = s.alpha;
  if (lead.length === 0) return false;
  const rungTerm = gen.increment(lead, 1);
  return (
    compare([{ head: lead[0]!.head, coef: 1 }], [{ head: rungTerm.head, coef: 1 }]) >= 0
  );
}

/** era rung generators: a rung opens only once the position has reached it */
export function buyEraGen(s: GameState, idx: number): TickResult {
  const era = eraOf(s);
  const gen = era.gens[idx];
  if (!gen) return { state: s, events: [] };
  if (!rungReached(s, idx)) return { state: s, events: [] };
  const cost = eraGenCost(s, idx);
  if (s.money.lt(cost)) return { state: s, events: [] };
  const next: GameState = { ...s, eraGens: [...s.eraGens] };
  next.money = next.money.sub(cost);
  next.eraGens[idx] = (next.eraGens[idx] ?? 0) + 1;
  return { state: next, events: [{ kind: "bought", what: gen.name }] };
}

export function buyClickUpgrade(s: GameState): TickResult {
  const cost = clickUpgradeCost(s.clickLevel);
  if (s.money.lt(cost)) return { state: s, events: [] };
  const next: GameState = { ...s };
  next.money = next.money.sub(cost);
  next.clickLevel += 1;
  return { state: next, events: [{ kind: "bought", what: "click+" }] };
}

/** pick (or re-pick) the axiom modifier — offered at every era wall */
export function setAxiom(s: GameState, id: string): GameState {
  if (!axiomDef(id)) return s;
  return { ...s, axiom: id };
}
