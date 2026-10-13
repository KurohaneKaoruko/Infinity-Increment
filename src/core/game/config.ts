/* Game balance tables — all numbers live here (design D4: data-driven).
 * Era generator costs/thresholds live in eras.ts; this file owns the
 * meta economy (money generators, axiom cards, click upgrades). */

export const TICKS_PER_SECOND = 10;
export const TICK_MS = 100;

export interface MoneyGenTier {
  name: string;
  baseCost: number;
  costMult: number;
  /** currency per second per unit */
  baseRate: number;
}

export const MONEY_GENS: MoneyGenTier[] = [
  { name: "计数器", baseCost: 50, costMult: 1.15, baseRate: 0.15 },
  { name: "求和器", baseCost: 750, costMult: 1.15, baseRate: 1.2 },
  { name: "乘算器", baseCost: 10_000, costMult: 1.15, baseRate: 6 },
  { name: "幂算器", baseCost: 150_000, costMult: 1.15, baseRate: 40 },
  { name: "超限算器", baseCost: 2_000_000, costMult: 1.15, baseRate: 250 },
];

/** higher tier i+1 boosts tier i: ×(1 + 0.25·count[i+1]) */
export const TIER_BOOST = 0.25;

/** each extra unit of an era (cofinal) generator costs this multiple more */
export const ERA_UNIT_COST_MULT = 1.2;

/** axiom cards: offered at every era wall, applied as the current modifier */
export interface AxiomDef {
  id: string;
  name: string;
  desc: string;
  moneyMult: number;
  convergeMult: number;
  clickMult: number;
}

export const AXIOMS: AxiomDef[] = [
  {
    id: "vl",
    name: "V=L",
    desc: "可构造宇宙:一切皆有定义。产出 ×5、点击 ×5,但序列收敛更慢(阈值 ×2) —— 慢,才能看清每一级。",
    moneyMult: 5,
    convergeMult: 2,
    clickMult: 5,
  },
  {
    id: "forcing",
    name: "Forcing",
    desc: "力迫法:打开平行宇宙,规则可以改写。产出 ×2、点击 ×2,序列收敛更快(阈值 ×0.5) —— 快,就要接受更粗的粒度。",
    moneyMult: 2,
    convergeMult: 0.5,
    clickMult: 2,
  },
];

export function axiomDef(id: string | null): AxiomDef | null {
  return AXIOMS.find((a) => a.id === id) ?? null;
}

export function moneyGenCost(tier: number, count: number): number {
  const t = MONEY_GENS[tier]!;
  return Math.ceil(t.baseCost * Math.pow(t.costMult, count));
}

export function clickUpgradeCost(clickLevel: number): number {
  return Math.ceil(50 * Math.pow(4, clickLevel - 1));
}
