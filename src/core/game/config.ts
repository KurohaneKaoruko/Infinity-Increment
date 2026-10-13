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
    affects: "货币产出 +0.15/s(乘上位置桥之后才是真实收入)",
    why: "起手唯一买得起的东西。货币是算力预算 —— 它不改变数值,只决定你能部署多少台机器。",
  },
  {
    name: "求和器",
    baseCost: 750,
    costMult: 1.15,
    baseRate: 1.2,
    what: "把计数器的输出加总。",
    affects: "货币产出 +1.2/s",
    why: "单价比计数器高 8 倍,但产出高 8 倍 —— 数量堆上去之后更划算。",
  },
  {
    name: "乘算器",
    baseCost: 10_000,
    costMult: 1.15,
    baseRate: 6,
    what: "把求和折叠成乘法。",
    affects: "货币产出 +6/s",
    why: "第一台真正「折叠」算力的机器。之后每一级阶梯的机器都更贵,得靠它撑住预算。",
  },
  {
    name: "幂算器",
    baseCost: 150_000,
    costMult: 1.15,
    baseRate: 40,
    what: "把乘法折叠成乘方。",
    affects: "货币产出 +40/s",
    why: "阶梯越高,一台机器就越贵。幂算器是中层预算的主力。",
  },
  {
    name: "超限算器",
    baseCost: 2_000_000,
    costMult: 1.15,
    baseRate: 250,
    what: "不再处理有限数,直接处理极限。",
    affects: "货币产出 +250/s",
    why: "为 ω 之后的纪元链准备的算力。到了纪元链,产出桥会换成 α 自己的量级,这里的底子越厚越轻松。",
  },
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

/** 手动算力:点击这条线刻意不随位置桥增长 —— 它只是启动资金。 */
export const CLICK_UPGRADE = {
  name: "手动算力",
  what: "你亲手按下的那一次计算。",
  affects: "每次点击的收入 = 等级 × 转生倍率 × 公理点击倍率",
  why: "只在前几分钟有用:机器一开动,手点就追不上了。它是启动资金,不是主引擎 —— 数值只能靠机器算出来。",
} as const;
