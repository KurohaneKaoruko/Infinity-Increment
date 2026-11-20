/* Game balance tables — all numbers live here (design D4: data-driven).
 * These are gameplay rules, not consequences of ordinal arithmetic.
 * Era generator costs/thresholds live in eras.ts. */

export const TICKS_PER_SECOND = 10;
export const TICK_MS = 100;

/** Active-play budget. These timings are game balance, not mathematical claims. */
export const PULSE_RECHARGE_SECONDS = 45;
export const PULSE_MAX_CHARGES = 3;
export const PULSE_COST_TICKS = PULSE_RECHARGE_SECONDS * TICKS_PER_SECOND;
export const PULSE_CAP_TICKS = PULSE_COST_TICKS * PULSE_MAX_CHARGES;
export const PULSE_PROGRESS_SECONDS = 12;
export const PULSE_MONEY_SECONDS = 15;

export interface MoneyGenTier {
  name: string;
  baseCost: number;
  costMult: number;
  /** currency per second per unit */
  baseRate: number;
  /** 它到底在做什么 */
  what: string;
  /** 它影响哪个数 */
  affects: string;
  /** 为什么需要它 */
  why: string;
}

export const MONEY_GENS: MoneyGenTier[] = [
  {
    name: "计数器",
    baseCost: 50,
    costMult: 1.15,
    baseRate: 0.15,
    what: "一台只会 +1 的机器。",
    affects: "基础货币产出 +0.15/s；检查点奖励会在结算时统一相乘",
    why: "起手唯一买得起的东西。货币是算力预算 —— 它不改变数值,只决定你能部署多少台机器。",
  },
  {
    name: "求和器",
    baseCost: 750,
    costMult: 1.15,
    baseRate: 1.2,
    what: "提供更高的基础货币产出。",
    affects: "货币产出 +1.2/s",
    why: "单价比计数器高 8 倍,但产出高 8 倍 —— 数量堆上去之后更划算。",
  },
  {
    name: "乘算器",
    baseCost: 10_000,
    costMult: 1.15,
    baseRate: 6,
    what: "提供中等规模的基础货币产出。",
    affects: "货币产出 +6/s",
    why: "第一台真正「折叠」算力的机器。之后每一级阶梯的机器都更贵,得靠它撑住预算。",
  },
  {
    name: "幂算器",
    baseCost: 150_000,
    costMult: 1.15,
    baseRate: 40,
    what: "提供高阶基础货币产出。",
    affects: "货币产出 +40/s",
    why: "阶梯越高,一台机器就越贵。幂算器是中层预算的主力。",
  },
  {
    name: "超限算器",
    baseCost: 2_000_000,
    costMult: 1.15,
    baseRate: 250,
    what: "提供纪元阶段所需的高额基础货币产出。",
    affects: "货币产出 +250/s",
    why: "为 ω 之后的纪元链准备预算；它只影响货币，不改变 α。",
  },
];

/** higher tier i+1 boosts tier i: ×(1 + 0.25·count[i+1]) */
export const TIER_BOOST = 0.25;

/** each extra unit of an era (cofinal) generator costs this multiple more */
export const ERA_UNIT_COST_MULT = 1.2;

/** Optional gameplay policies. Their effects are balancing choices, not axioms. */
export interface RunPolicy {
  id: string;
  name: string;
  desc: string;
  moneyMult: number;
  /** game pacing multiplier; it is not a theorem about convergence */
  thresholdMult: number;
  /** legacy field kept for v3 integrations */
  convergeMult: number;
  clickMult: number;
}

export const RUN_POLICIES: RunPolicy[] = [
  {
    id: "steady",
    name: "稳态计划",
    desc: "游戏规则：货币产出 ×5、手点 ×5；阶段门槛 ×2。适合积累预算，推进较慢。",
    moneyMult: 5,
    thresholdMult: 2,
    convergeMult: 2,
    clickMult: 5,
  },
  {
    id: "sprint",
    name: "速推计划",
    desc: "游戏规则：货币产出 ×2、手点 ×2；阶段门槛 ×0.5。适合快速过关，预算增长较慢。",
    moneyMult: 2,
    thresholdMult: 0.5,
    convergeMult: 0.5,
    clickMult: 2,
  },
];

/** Keep old save IDs readable after the old axiom-themed labels were removed. */
export function runPolicy(id: string | null | undefined): RunPolicy | null {
  if (id == null) return null;
  const raw = id.trim().toLowerCase();
  const normalized =
    raw === "vl" || raw === "v=l" ? "steady" : raw === "forcing" ? "sprint" : raw;
  return RUN_POLICIES.find((policy) => policy.id === normalized) ?? null;
}

/** Compatibility names for saves and third-party integrations from v3. */
export type AxiomDef = RunPolicy;
export const AXIOMS = RUN_POLICIES;
export const axiomDef = runPolicy;

export function moneyGenCost(tier: number, count: number): number {
  const t = MONEY_GENS[tier]!;
  return Math.ceil(t.baseCost * Math.pow(t.costMult, count));
}

export function clickUpgradeCost(clickLevel: number): number {
  return Math.ceil(50 * Math.pow(4, clickLevel - 1));
}

/** 手动算力：点击只提供货币，不直接改变序数位置。 */
export const CLICK_UPGRADE = {
  name: "手动算力",
  what: "你亲手按下的那一次计算。",
  affects: "每次点击的收入 = 等级 × 周目奖励 × 策略倍率",
  why: "用于启动和补足预算；它不是序数推进操作。",
} as const;
