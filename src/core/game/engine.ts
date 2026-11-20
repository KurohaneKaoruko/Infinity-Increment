/* Pure game engine: every transition is (state) → (state, events).
 * Nothing here touches the DOM, storage, or timers (design D5).
 *
 * Two layers, one direction of travel:
 *
 *   CLIMB — the operation ladder (ops.ts). The player deploys machines on the
 *   current rung; machines push progress; progress fills; the rung *breaks*
 *   and the notation changes. The finite ladder hands off at the ω checkpoint;
 *   the authored ω-side route then hands off at the Γ₀ checkpoint — and
 *   *that* is where the era chain begins.
 *
 *   ERA — one endless chain of notation systems, each a ladder of rungs.
 *   Owning a rung's generator adds its term every tick; when the lead sits on
 *   a filled coefficient triggers the authored checkpoint — the next rung, or
 *   the era wall, which transcends into the next era. */
import {
  add,
  compare,
  equal,
  fromNumber,
  type Ord,
  type Term,
} from "../ordinal/ordinal";
import { bn, type BigNum } from "../bignum";
import { rank } from "../ordinal/rank";
import {
  ERA_UNIT_COST_MULT,
  MONEY_GENS,
  TICKS_PER_SECOND,
  TIER_BOOST,
  PULSE_CAP_TICKS,
  runPolicy,
  clickUpgradeCost,
  moneyGenCost,
  type RunPolicy,
} from "./config";
import { eraAt, type EraDef, type GenDef } from "./eras";
import {
  CLIMB_LENGTH,
  FINAL_RUNG,
  FINITE_LAST,
  climbFraction,
  driverCost,
  driverLimit,
  finiteFraction,
  ordinalRung,
  rungAt,
  rungIncomeMult,
  rungNotation,
  type Rung,
} from "./ops";
import type { GameState } from "./state";

export type GameEvent =
  | { kind: "clicked"; money: number; advanced: boolean }
  | { kind: "bought"; what: string }
  | { kind: "checkpoint"; to: string }
  | { kind: "waypoint"; label: string }
  | { kind: "mutation"; rung: number; name: string; notation: string; mutation: string }
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
    ? Math.min(1, lead[0]!.coef / stageThreshold(s))
    : 0;
  return (j + fill) / total;
}

/* ------------------------------------------------------------------ */
/* Climb meters                                                        */
/* ------------------------------------------------------------------ */

/** The rung the player is standing on. */
export function currentRung(s: GameState): Rung {
  return rungAt(s.rung);
}

/** 当前这一级已经填了多少(0 → 1)。 */
export function rungFraction(s: GameState): number {
  const rung = currentRung(s);
  return rung.threshold <= 0 ? 0 : Math.min(1, s.rungProgress / rung.threshold);
}

/** The single "how far along am I" meter the UI reads. */
export function approach(s: GameState): number {
  return s.phase === "era" ? eraProgress(s) : climbFraction(s.rung, s.rungProgress);
}

/** 逼近 ω 的进度:阶梯走完就是 1,进了纪元链则永远停在 1(ω 已经到达)。 */
export function omegaApproach(s: GameState): number {
  return s.phase === "era" ? 1 : finiteFraction(s.rung, s.rungProgress);
}

/** The current position written in the notation the climb has reached. */
export function climbValue(s: GameState): string {
  if (s.phase === "era") return "";
  return rungAt(s.rung).render(s.rungProgress);
}

/* ------------------------------------------------------------------ */
/* Economy                                                             */
/* ------------------------------------------------------------------ */

/**
 * A game-only checkpoint reward. It deliberately does not convert ordinal
 * magnitude into money: the constants encode the authored route and pacing.
 */
export function checkpointMult(s: GameState): BigNum {
  if (s.phase === "era") {
    const checkpoints = Math.floor(eraProgress(s) * eraOf(s).gens.length);
    // Hand-tuned starts keep the cost tiers playable; these are not derived
    // from the represented ordinal. Checkpoint rewards are similarly discrete.
    const eraStartExponent = s.era === 1 ? 124 : s.era === 2 ? 176 : 184 + 2 * Math.min(12, s.era - 3);
    const routeExponent = eraStartExponent + 4 * Math.floor(checkpoints / 4);
    return bn(2).pow(routeExponent);
  }
  const rung = currentRung(s);
  const frac = rung.threshold <= 0 ? 0 : Math.min(1, s.rungProgress / rung.threshold);
  return bn(rungIncomeMult(s.rung) * (1 + 0.5 * frac));
}

export function cycleMult(s: GameState): number {
  return 1 + 2 * s.transcends;
}

function policyOf(s: GameState): RunPolicy | null {
  return runPolicy(s.policy) ?? runPolicy(s.axiom ?? null);
}

export function stageThreshold(s: GameState): number {
  return eraOf(s).threshold * (policyOf(s)?.thresholdMult ?? 1);
}

/** Legacy name for callers from the v3 game API. */
export const convergeThreshold = stageThreshold;

/** Currency per second. This is a game economy, not an ordinal magnitude. */
export function moneyRate(s: GameState): BigNum {
  return moneyBreakdown(s).total;
}

/** The income chain, item by item — the shop shows this so every purchase's
 *  effect is visible: 底数 × 检查点奖励 × 周目 × 策略 = 总产出. */
export interface MoneyBreakdown {
  /** 机器贡献的底数(货币/秒,未经任何倍率) */
  base: number;
  /** Game-only checkpoint reward; it is not a measure of ordinal size. */
  checkpoint: BigNum;
  cycle: number;
  policy: number;
  total: BigNum;
}

export function moneyBreakdown(s: GameState): MoneyBreakdown {
  // 底数 1:即便一台机器都没有,手动算力也还在转 —— 这是起手的唯一收入
  let base = 1;
  for (let i = 0; i < MONEY_GENS.length; i++) {
    const count = s.gens[i] ?? 0;
    if (count <= 0) continue;
    const next = s.gens[i + 1] ?? 0;
    const boost = 1 + TIER_BOOST * next;
    base += MONEY_GENS[i]!.baseRate * count * boost;
  }
  const cycle = cycleMult(s);
  const policy = policyOf(s)?.moneyMult ?? 1;
  const checkpoint = checkpointMult(s);
  return { base, checkpoint, cycle, policy, total: bn(base).mul(cycle).mul(policy).mul(checkpoint) };
}

export interface MoneyGenPreview {
  current: BigNum;
  afterPurchase: BigNum;
  increase: BigNum;
}

/** Exact UI preview for buying one unit, including tier boosts and all active multipliers. */
export function previewMoneyGen(s: GameState, tier: number): MoneyGenPreview {
  const current = moneyRate(s);
  if (!MONEY_GENS[tier]) return { current, afterPurchase: current, increase: bn(0) };
  const gens = [...s.gens];
  gens[tier] = (gens[tier] ?? 0) + 1;
  const afterPurchase = moneyRate({ ...s, gens });
  return { current, afterPurchase, increase: afterPurchase.sub(current) };
}

/** Best affordable return per cost, including the purchase's boost to the tier below. */
export function bestMoneyGen(s: GameState, budget: BigNum = s.money): number {
  let best = -1;
  let payback = bn(Number.POSITIVE_INFINITY);
  for (let tier = 0; tier < MONEY_GENS.length; tier++) {
    const generator = MONEY_GENS[tier]!;
    const cost = moneyGenCost(tier, s.gens[tier] ?? 0);
    if (!Number.isFinite(cost) || budget.lt(cost)) continue;
    const increase = generator.baseRate * (1 + TIER_BOOST * (s.gens[tier + 1] ?? 0))
      + (tier > 0 ? MONEY_GENS[tier - 1]!.baseRate * (s.gens[tier - 1] ?? 0) * TIER_BOOST : 0);
    const candidate = bn(cost).div(increase);
    if (candidate.lt(payback)) {
      best = tier;
      payback = candidate;
    }
  }
  return best;
}

/** 手动算力：点击只提供预算，不直接推进当前路线。 */
export function clickValue(s: GameState): number {
  return s.clickLevel * cycleMult(s) * (policyOf(s)?.clickMult ?? 1);
}

/* ------------------------------------------------------------------ */
/* Climb transitions                                                   */
/* ------------------------------------------------------------------ */

/** 当前这一级每秒推进多少进度。 */
export function rungRate(s: GameState): number {
  if (s.phase !== "climb") return 0;
  const rung = currentRung(s);
  return rung.rate * Math.min(s.drivers, rung.maxDrivers);
}

/** 下一台机器的价格。 */
export function nextDriverCost(s: GameState): number {
  return driverCost(s.rung, s.drivers);
}

/** 这一级还能再放几台机器。 */
export function driversLeft(s: GameState): number {
  return Math.max(0, driverLimit(s.rung) - s.drivers);
}

/** 能不能买得起下一台。 */
export function canBuyDriver(s: GameState): boolean {
  return s.phase === "climb" && driversLeft(s) > 0 && s.money.gte(nextDriverCost(s));
}

export function buyDriver(s: GameState): TickResult {
  if (!canBuyDriver(s)) return { state: s, events: [] };
  const next: GameState = { ...s };
  next.money = s.money.sub(nextDriverCost(s));
  next.drivers = s.drivers + 1;
  return { state: next, events: [{ kind: "bought", what: `${currentRung(s).name} 机器` }] };
}

/** Buy machines until the money runs out (or the rung's limit is hit). */
export function buyDriverMax(s: GameState): TickResult {
  let cur = s;
  let bought = 0;
  while (canBuyDriver(cur)) {
    const r = buyDriver(cur);
    if (r.events.length === 0) break;
    cur = r.state;
    bought++;
    if (bought > 500) break; // safety valve
  }
  if (bought === 0) return { state: s, events: [] };
  return { state: cur, events: [{ kind: "bought", what: `${currentRung(s).name} 机器 ×${bought}` }] };
}

function tickClimb(s: GameState): TickResult {
  const events: GameEvent[] = [];
  const next: GameState = { ...s };

  next.money = next.money.add(moneyRate(s).div(TICKS_PER_SECOND));

  const rung = currentRung(s);
  const gain = rungRate(s) / TICKS_PER_SECOND;
  if (gain > 0) {
    next.rungProgress = Math.min(rung.threshold, s.rungProgress + gain);
  }
  // α 在爬升阶段是推导出来的:它不是被累加的,而是「当前记号的读数」
  next.alpha = ordinalRung(s.rung, next.rungProgress);

  if (next.rungProgress >= rung.threshold) {
    const broken = rung.n;
    const delivered = rungNotation(broken);
    events.push({
      kind: "mutation",
      rung: broken,
      name: rung.name,
      notation: delivered,
      mutation: rung.mutation,
    });
    next.rungProgress = 0;
    if (broken >= FINAL_RUNG) {
      // Γ₀ route checkpoint — the era chain begins
      next.drivers = 0;
      const to = 1;
      const nextEra = eraAt(to);
      next.phase = "era";
      next.era = to;
      next.eraGens = nextEra.gens.map(() => 0);
      next.transcends = s.transcends + 1;
      next.alpha = nextEra.startAlpha;
      next.rung = CLIMB_LENGTH;
      events.push({ kind: "transcended", era: to, name: nextEra.name, wall: delivered });
    } else {
      next.rung = broken + 1;
      // Operators retune to the next notation instead of being discarded.
      // The growing driver cap still leaves room for an upgrade decision.
      next.drivers = Math.min(s.drivers, driverLimit(next.rung));
      next.alpha = ordinalRung(next.rung, 0);
    }
  }

  return { state: next, events };
}

/* ------------------------------------------------------------------ */
/* Era transitions                                                     */
/* ------------------------------------------------------------------ */

/** owned rung indices, highest first */
function ownedRungs(s: GameState): number[] {
  const out: number[] = [];
  for (let j = s.eraGens.length - 1; j >= 0; j--) {
    if ((s.eraGens[j] ?? 0) > 0) out.push(j);
  }
  return out;
}

/** cost of the next unit of era generator idx */
export function eraGenCost(s: GameState, idx: number): number {
  const gen = eraOf(s).gens[idx];
  if (!gen) return Number.POSITIVE_INFINITY;
  const owned = s.eraGens[idx] ?? 0;
  return Math.ceil(gen.cost * Math.pow(ERA_UNIT_COST_MULT, owned));
}

function tickEra(s: GameState): TickResult {
  const events: GameEvent[] = [];
  const next: GameState = { ...s, gens: [...s.gens], eraGens: [...s.eraGens] };

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

  // Apply the next game checkpoint when its finite threshold is met.
  const threshold = stageThreshold(s);
  for (const j of owned) {
    const gen: GenDef = era.gens[j]!;
    if (!gen.thresholdReached(next.alpha, threshold)) continue;
    if (gen.wall) {
      const to = s.era + 1;
      const nextEra = eraAt(to);
      next.era = to;
      next.eraGens = nextEra.gens.map(() => 0);
      next.transcends = s.transcends + 1;
      next.alpha = nextEra.startAlpha;
      events.push({ kind: "transcended", era: to, name: nextEra.name, wall: era.wallName });
    } else {
      next.alpha = gen.nextCheckpoint(next.alpha);
      events.push({ kind: "checkpoint", to: era.gens[j + 1]!.name });
      if (gen.waypoint) events.push({ kind: "waypoint", label: gen.waypoint });
    }
    break;
  }

  return { state: next, events };
}

export function tick(s: GameState): TickResult {
  const result = s.phase === "era" ? tickEra(s) : tickClimb(s);
  result.state.pulseTicks = Math.min(PULSE_CAP_TICKS, s.pulseTicks + 1);
  return result;
}

/* ------------------------------------------------------------------ */
/* Player actions                                                      */
/* ------------------------------------------------------------------ */

export function click(s: GameState): TickResult {
  const events: GameEvent[] = [];
  const next: GameState = { ...s };
  const gain = clickValue(s);
  next.money = next.money.add(gain);
  if (s.phase === "era") {
    // right successor α+1: climbs the fine structure on top of any limit
    // (ω → ω+1 → ω+2 …); never absorbed — absorption belongs to the limits.
    next.alpha = add(s.alpha, fromNumber(1));
    events.push({ kind: "clicked", money: gain, advanced: true });
  } else {
    // 阶梯阶段手点不推进位置 —— 位置只能靠机器算出来
    events.push({ kind: "clicked", money: gain, advanced: false });
  }
  return { state: next, events };
}

export function buyMoneyGen(s: GameState, tier: number): TickResult {
  if (!MONEY_GENS[tier]) return { state: s, events: [] };
  const cost = moneyGenCost(tier, s.gens[tier] ?? 0);
  if (s.money.lt(cost)) return { state: s, events: [] };
  const next: GameState = { ...s, gens: [...s.gens] };
  next.money = next.money.sub(cost);
  next.gens[tier] = (next.gens[tier] ?? 0) + 1;
  return { state: next, events: [{ kind: "bought", what: MONEY_GENS[tier]!.name }] };
}

/** Buy as many units as are currently affordable (with a safety cap). */
export function buyMoneyGenMax(s: GameState, tier: number): TickResult {
  let current = s;
  let bought = 0;
  while (bought < 500) {
    const result = buyMoneyGen(current, tier);
    if (result.events.length === 0) break;
    current = result.state;
    bought++;
  }
  return bought === 0
    ? { state: s, events: [] }
    : { state: current, events: [{ kind: "bought", what: `${MONEY_GENS[tier]!.name} ×${bought}` }] };
}

/** Has the climb reached rung idx's position? (rung 0 is always open.) */
export function rungReached(s: GameState, idx: number): boolean {
  if (!Number.isInteger(idx) || idx < 0) return false;
  const gen = eraOf(s).gens[idx];
  if (!gen) return false;
  if (idx === 0) return true;
  const lead = s.alpha;
  if (lead.length === 0) return false;
  const rungTerm = gen.increment(lead, 1);
  return (
    compare([{ head: lead[0]!.head, coef: 1 }], [{ head: rungTerm.head, coef: 1 }]) >= 0
  );
}

/** The current route position, not the first hole in the owned-generator array. */
export function eraFrontier(s: GameState): number {
  if (s.phase !== "era") return -1;
  const generators = eraOf(s).gens;
  for (let i = generators.length - 1; i >= 0; i--) {
    if (rungReached(s, i)) return i;
  }
  return -1;
}

/** Time to the next local checkpoint at the current deployment, with no future purchases. */
export function checkpointEta(s: GameState): number {
  if (s.phase === "climb") {
    const speed = rungRate(s);
    return speed > 0 ? Math.max(0, currentRung(s).threshold - s.rungProgress) / speed : Infinity;
  }
  const frontier = eraFrontier(s);
  const count = s.eraGens[frontier] ?? 0;
  if (count <= 0) return Infinity;
  const generator = eraOf(s).gens[frontier];
  const lead = s.alpha[0];
  const filled = generator && lead && sameHead(generator.increment(s.alpha, 1), lead) ? lead.coef : 0;
  return Math.ceil(Math.max(0, stageThreshold(s) - filled) / count) / TICKS_PER_SECOND;
}

/** era rung generators: a rung opens only once the position has reached it */
export function buyEraGen(s: GameState, idx: number): TickResult {
  if (s.phase !== "era") return { state: s, events: [] };
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

/** Buy as many units of one unlocked era generator as the budget allows. */
export function buyEraGenMax(s: GameState, idx: number): TickResult {
  let current = s;
  let bought = 0;
  while (bought < 500) {
    const result = buyEraGen(current, idx);
    if (result.events.length === 0) break;
    current = result.state;
    bought++;
  }
  if (bought === 0) return { state: s, events: [] };
  const name = eraOf(s).gens[idx]!.name;
  return { state: current, events: [{ kind: "bought", what: `${name} ×${bought}` }] };
}

/**
 * One conservative automatic-purchase pass. Position machines and the
 * current era frontier have priority; only the remaining budget may fund one
 * currency generator. This is a game convenience, not ordinal arithmetic.
 */
export function autoPurchase(s: GameState): GameState {
  let current = s;
  if (current.phase === "climb") {
    current = buyDriverMax(current).state;
    const reserve = driversLeft(current) > 0 ? nextDriverCost(current) * 2 : 0;
    const tier = bestMoneyGen(current, current.money.sub(reserve));
    return tier < 0 ? current : buyMoneyGen(current, tier).state;
  }

  const frontier = eraFrontier(current);
  if (frontier < 0) return current;
  const cost = eraGenCost(current, frontier);
  // Always start the current node. Extra units only use surplus, so buying
  // position speed cannot continually starve infrastructure of its budget.
  if ((current.eraGens[frontier] ?? 0) === 0 || current.money.gte(bn(cost).mul(4))) {
    current = buyEraGen(current, frontier).state;
  }
  const reserve = eraGenCost(current, frontier) * ((current.eraGens[frontier] ?? 0) > 0 ? 1 : 2);
  const tier = bestMoneyGen(current, current.money.sub(reserve));
  return tier < 0 ? current : buyMoneyGen(current, tier).state;
}

export function buyClickUpgrade(s: GameState): TickResult {
  const cost = clickUpgradeCost(s.clickLevel);
  if (s.money.lt(cost)) return { state: s, events: [] };
  const next: GameState = { ...s };
  next.money = next.money.sub(cost);
  next.clickLevel += 1;
  return { state: next, events: [{ kind: "bought", what: "手动算力 +1" }] };
}

/** Select a game pacing policy at an era wall. */
export function setPolicy(s: GameState, id: string): GameState {
  const policy = runPolicy(id);
  if (!policy) return s;
  return { ...s, policy: policy.id, axiom: policy.id };
}

/** Legacy internal API name; the choice is a game policy, not an axiom. */
export const setAxiom = setPolicy;

/* ------------------------------------------------------------------ */
/* Leaderboard score bridge                                            */
/* ------------------------------------------------------------------ */

/** Monotone magnitude for the leaderboard. While climbing the position is a
 *  notation, not an ordinal, so we report the climb's own rank:
 *  the finite ladder fills [0, 5) — strictly below rank(ω) = 5 — and the
 *  ω-side ladder fills [5, 1026) — strictly below the Γ₀ route handoff. Crossing a
 *  mutation is therefore always a visible jump. */
export function progressRank(s: GameState): number {
  if (s.phase === "era") return rank(s.alpha);
  const rung = currentRung(s);
  if (rung.phase === "finite") return finiteFraction(s.rung, s.rungProgress) * 4.9;
  const span = CLIMB_LENGTH - FINITE_LAST; // the ω-side rungs
  const level = s.rung - FINITE_LAST;
  const frac = rung.threshold <= 0 ? 0 : Math.min(1, s.rungProgress / rung.threshold);
  return 5 + ((level - 1 + frac) / span) * 1020;
}
