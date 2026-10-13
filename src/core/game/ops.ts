/* 运算阶梯 — the climb from 1 to Γ₀.
 *
 * The game is not "watch a number grow": it is a climb up the *operations*
 * themselves. Each rung owns one operation, and the value is never stored as
 * a magnitude — it is stored as (rung, progress) and the *notation* is
 * synthesised from that pair. 10↑↑↑↑1000 cannot be written down, let alone
 * stored in a float.
 *
 *   有限层(base 10)   8 级
 *     加法 → 乘法 → 乘方 → 迭代幂次(↑↑) → 五级(↑↑↑) → 六级(↑↑↑↑)
 *       → 七级(↑↑↑↑↑) → **箭头层数**
 *   ── 破级 ── 箭头记号里的 k 也需要被「算」而不是被「写」了 → ω
 *
 *   ω 层(base ω)      5 级
 *     后继(ω+n) → 乘法(ω·n) → 乘方(ω^n) → 迭代幂次(ω↑↑n)
 *       → **不动点层级 φ(k,0)**
 *   ── 破级 ── sup φ(k,0) = Γ₀,二元 Veblen 记号用尽,纪元链接手
 *
 * 为什么 ω 侧只有 5 级?因为箭头在 ω 上**塌缩**:ω↑↑↑n = ω↑↑ε₀ = ε₀
 * (ε₀ 是 ξ↦ω^ξ 的不动点,再多的箭头也推不动它)。所以 ω 之上的「多一个箭头」
 * 不再是重复上一级运算,而是**多取一次不动点** —— 运算阶梯换成了 Veblen
 * 不动点层级 φ(1,0)=ε₀、φ(2,0)=ζ₀、φ(3,0)=η₀…… 指标本身往上爬。
 * 有限层的箭头数 k 与 ω 层的 Veblen 指标 k 是同一个位置上的同一个东西。
 *
 * Breaking a rung is a *hard mutation*: the old notation can no longer
 * express the new value, so the way the number is written changes and every
 * machine built for the previous rung is scrapped (it cannot compute at the
 * new level). That is the whole point — the player should feel the notation
 * strain and then snap.
 *
 * The *count* is continuous across a mutation: breaking 加法 hands the count
 * over to 乘法, so the reading folds (1,800 → 10·1,800) instead of restarting
 * at 10·0 = 0. Only the operation changes, never the count.
 *
 * Pure core: no I/O, no DOM. Progress is a plain count (it never leaves the
 * rung's threshold), so no BigNum is needed on the hot path. */
import {
  ONE,
  OMEGA,
  ZERO,
  add,
  fromNumber,
  termOmega,
  termVeblen,
  type Ord,
} from "../ordinal/ordinal";
import { formatOrd } from "../ordinal/format";

export type ClimbPhase = "finite" | "ordinal";

export interface Rung {
  /** 1-based rung number across the whole climb */
  n: number;
  id: string;
  name: string;
  /** one-glyph summary for the ladder strip */
  glyph: string;
  phase: ClimbPhase;
  /** the progress unit ("计数" / "塔高" / "箭头数" …) */
  unit: string;
  /** 这一级的机器到底在算什么 */
  what: string;
  /** 破级瞬间发生了什么突变 */
  mutation: string;
  /** 破级之后数值改用什么记号书写 */
  nextNotation: string;
  /** 破级所需的进度(未填时按 CLIMB_THRESHOLD_GROWTH 推导) */
  threshold: number;
  /** 该级固定门槛:序数塔的塔高受引擎嵌套预算限制,不能无限增长 */
  fixedThreshold?: number;
  /** 每台机器每秒推进的进度 */
  rate: number;
  /** 第 1 台机器的价格(货币) */
  baseCost: number;
  /** 每多一台机器的价格倍率 */
  costMult: number;
  /** 这一级最多能部署多少台机器(超出的算力是浪费) */
  maxDrivers: number;
  /** 该进度对应的数值写法 */
  render: (progress: number) => string;
  /** 序数阶段:该进度对应的真实序数值 */
  ordinal?: (progress: number) => Ord;
  /** 进度 → 仪表上显示的自变量(计数跨级连续时就是 base + progress) */
  argOf?: (progress: number) => number;
  /** 进度满格时的自变量(进度条右端) */
  argMax?: number;
}

/* ------------------------------------------------------------------ */
/* Balance constants (all pacing lives here)                           */
/* ------------------------------------------------------------------ */

/** 每破一级,算力 ×2^4 = 16 —— 破级本身就是产出突变 */
export const CLIMB_BRIDGE = 4;
/** 第一级的进度门槛 */
export const CLIMB_BASE_THRESHOLD = 1800;
/** 每级门槛 ×1.15 —— 越往上,同一级的台阶越高 */
export const CLIMB_THRESHOLD_GROWTH = 1.15;
/** 第一级第一台机器的价格(货币) */
export const CLIMB_BASE_COST = 6;
/** 机器价格倍率(每多一台) */
export const DRIVER_COST_MULT = 1.22;
/** 每台机器每秒推进的进度 */
export const DRIVER_RATE = 1;
/** 第 n 级的机器上限 */
export const DRIVER_BASE_LIMIT = 8;
export const DRIVER_LIMIT_STEP = 1;

/** 未固定门槛的级按这个公式推导 */
function growthThreshold(i: number): number {
  return Math.round(CLIMB_BASE_THRESHOLD * CLIMB_THRESHOLD_GROWTH ** i);
}

/** 第 n 级第 1 台机器的价格 */
export function driverBaseCost(n: number): number {
  return CLIMB_BASE_COST * (CLIMB_THRESHOLD_GROWTH * 2 ** CLIMB_BRIDGE) ** (n - 1);
}

/** 第 n 级第 owned+1 台机器的价格 */
export function driverCost(n: number, owned: number): number {
  return Math.ceil(driverBaseCost(n) * DRIVER_COST_MULT ** owned);
}

/** 第 n 级能部署的机器上限 */
export function driverLimit(n: number): number {
  return DRIVER_BASE_LIMIT + DRIVER_LIMIT_STEP * (n - 1);
}

/** 这一级破级瞬间的算力桥:2^(4·(n-1)) */
export function rungIncomeMult(n: number): number {
  return 2 ** (CLIMB_BRIDGE * (n - 1));
}

/* ------------------------------------------------------------------ */
/* Notation                                                            */
/* ------------------------------------------------------------------ */

/** Thousands-separated integer. */
function count(p: number): string {
  return Math.floor(p).toLocaleString("en-US");
}

/** "10" followed by n zeros, or the exponent form once that gets silly. */
function tens(exp: number): string {
  const e = Math.floor(exp);
  if (e <= 12) return String(10 ** e).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `10^${count(e)}`;
}

/** k 个 Knuth 上箭头,写成 a↑↑…↑b;k 大了就退回计数写法(这本身就是「写不下」的信号)。 */
export function arrowNotation(base: string, k: number, arg: string): string {
  const n = Math.max(2, Math.floor(k));
  if (n <= 8) return `${base}${"↑".repeat(n)}${arg}`;
  return `${base}↑^${count(n)} ${arg}`;
}

/** ω↑↑h — a tower of h ω's. h = 0 → 1, h = 1 → ω. */
export function omegaTower(h: number): Ord {
  let x: Ord = ONE;
  for (let i = 0; i < h; i++) x = [termOmega(x)];
  return x;
}

/** 第 12 级(ω↑↑n)的进度 → 塔高。进度就是塔高本身,所以界面上的
 *  「+X 塔高/s」与真实增长 1:1。塔高受引擎 DEPTH_LIMIT = 48 约束,封顶 42。 */
function omegaTowerHeight(progress: number): number {
  return Math.max(2, Math.min(42, 2 + Math.floor(progress)));
}

/** ω·n as a value (ω^1 · n). */
function omegaTimes(n: number): Ord {
  return [{ head: { kind: "omega", exp: ONE }, coef: Math.max(1, Math.floor(n)) }];
}

/** ω^p as a value. */
function omegaPow(p: number): Ord {
  return [termOmega(fromNumber(Math.max(1, Math.floor(p))))];
}

/** ω + p as a value. */
function omegaPlus(p: number): Ord {
  return add(OMEGA, fromNumber(Math.floor(p)));
}

/** φ(k, 0) —— 第 k 层不动点。k=1 → ε₀、2 → ζ₀、3 → η₀…… */
export function veblenFixpoint(k: number): Ord {
  return [termVeblen(fromNumber(Math.max(1, Math.floor(k))), ZERO)];
}

/* ------------------------------------------------------------------ */
/* The ladder                                                          */
/* ------------------------------------------------------------------ */

/** Argument offset per rung — filled in below from the balance constants.
 *  Rungs that keep counting (see CARRY) read `op(base + progress)` instead of
 *  `op(progress)`, so the reading never drops when the notation mutates. */
const BASE: number[] = [];

const RUNGS: Rung[] = [
  {
    n: 1,
    id: "add",
    name: "加法",
    glyph: "+",
    phase: "finite",
    unit: "计数",
    what: "反复执行 +1。数值就是累加的次数 —— 这一级能写下的最大数,是一个位数有限的整数。",
    mutation: "加法被折叠成乘法:同一个加数重复很多次,不必再逐次写下来。",
    nextNotation: "10·n",
    threshold: 0,
    rate: DRIVER_RATE,
    baseCost: 0,
    costMult: DRIVER_COST_MULT,
    maxDrivers: 0,
    render: (p) => count(p),
  },
  {
    n: 2,
    id: "mul",
    name: "乘法",
    glyph: "×",
    phase: "finite",
    unit: "倍数",
    what: "把加法折叠成乘法:同一个加数重复很多次。进度是倍数,数值是 10·进度。",
    mutation: "乘法被折叠成乘方:乘数本身开始被重复 —— 10·n 变成 10^n。",
    nextNotation: "10^n",
    threshold: 0,
    rate: DRIVER_RATE,
    baseCost: 0,
    costMult: DRIVER_COST_MULT,
    maxDrivers: 0,
    render: (p) => `10·${count(p)}`,
  },
  {
    n: 3,
    id: "pow",
    name: "乘方",
    glyph: "^",
    phase: "finite",
    unit: "指数",
    what: "把乘法折叠成乘方:同一个因数重复很多次。进度是指数,数值是 10^进度 —— 一个 1 后面跟那么多个 0。",
    mutation: "乘方被折叠成迭代幂次:指数自己也被重复 —— 箭头从一个变成两个。",
    nextNotation: "10↑↑n",
    threshold: 0,
    rate: DRIVER_RATE,
    baseCost: 0,
    costMult: DRIVER_COST_MULT,
    maxDrivers: 0,
    render: (p) => `10^${count(p)}`,
  },
  {
    n: 4,
    id: "tetration",
    name: "迭代幂次",
    glyph: "↑↑",
    phase: "finite",
    unit: "塔高",
    what: "把乘方折叠成迭代幂次(超运算第 4 级)。进度是塔高,数值是 10↑↑塔高 —— 10 的指数塔垒到那么高。",
    mutation: "再折一层:塔本身被重复,箭头从一个变成两个。",
    nextNotation: "10↑↑↑n",
    threshold: 0,
    rate: DRIVER_RATE,
    baseCost: 0,
    costMult: DRIVER_COST_MULT,
    maxDrivers: 0,
    render: (p) => `10↑↑${count(p)}`,
  },
  {
    n: 5,
    id: "pentation",
    name: "五级超运算",
    glyph: "↑↑↑",
    phase: "finite",
    unit: "高度",
    what: "超运算第 5 级:把迭代幂次再迭代一次。进度是高度,数值是 10↑↑↑高度。",
    mutation: "再折一层:三个箭头变成四个。",
    nextNotation: "10↑↑↑↑n",
    threshold: 0,
    rate: DRIVER_RATE,
    baseCost: 0,
    costMult: DRIVER_COST_MULT,
    maxDrivers: 0,
    render: (p) => `10↑↑↑${count(p)}`,
  },
  {
    n: 6,
    id: "hexation",
    name: "六级超运算",
    glyph: "↑↑↑↑",
    phase: "finite",
    unit: "高度",
    what: "超运算第 6 级。科学计数法早就失效,指数塔也写不下了 —— 但箭头还够用。",
    mutation: "再折一层:四个箭头变成五个。",
    nextNotation: "10↑↑↑↑↑n",
    threshold: 0,
    rate: DRIVER_RATE,
    baseCost: 0,
    costMult: DRIVER_COST_MULT,
    maxDrivers: 0,
    render: (p) => `10↑↑↑↑${count(p)}`,
  },
  {
    n: 7,
    id: "heptation",
    name: "七级超运算",
    glyph: "↑⁵",
    phase: "finite",
    unit: "高度",
    what: "超运算第 7 级,五个箭头。到这里,人已经不再逐层去数箭头了 —— 数的是「要写几个箭头」。",
    mutation: "箭头个数本身开始增长:不再固定几个箭头,而是让 k 自己往上爬。",
    nextNotation: "10↑^k 3",
    threshold: 0,
    rate: DRIVER_RATE,
    baseCost: 0,
    costMult: DRIVER_COST_MULT,
    maxDrivers: 0,
    render: (p) => `10↑↑↑↑↑${count(p)}`,
  },
  {
    n: 8,
    id: "arrows",
    name: "箭头层数",
    glyph: "↑^k",
    phase: "finite",
    unit: "箭头数",
    what: "进度就是箭头个数 k。数值是 10↑^k 3 —— 一个用 k 个箭头写出来的数,而 k 本身在长大。",
    mutation:
      "k 已经大到需要被「算」而不是被「写」—— 高德纳箭头记号用尽。再往上不是更大的数,而是另一种东西:第一个无穷序数 ω。",
    nextNotation: "ω",
    threshold: 0,
    rate: DRIVER_RATE,
    baseCost: 0,
    costMult: DRIVER_COST_MULT,
    maxDrivers: 0,
    render: (p) => arrowNotation("10", Math.max(6, p), "3"),
  },
  {
    n: 9,
    id: "omega-succ",
    name: "后继",
    glyph: "ω+",
    phase: "ordinal",
    unit: "后继步",
    what: "ω 之后的第一件事:一步一步往后数。ω+1、ω+2、ω+3…… 每加一步都比上一步更大,却永远回不到有限。",
    mutation: "把 ω 加了 ω 次 —— 尾项被吸收,得到 ω·2。加法在这里升级成乘法。",
    nextNotation: "ω·n",
    threshold: 0,
    rate: DRIVER_RATE,
    baseCost: 0,
    costMult: DRIVER_COST_MULT,
    maxDrivers: 0,
    render: (p) => (p < 1 ? "ω" : `ω + ${count(p)}`),
    ordinal: omegaPlus,
  },
  {
    n: 10,
    id: "omega-mul",
    name: "乘法",
    glyph: "ω×",
    phase: "ordinal",
    unit: "倍数",
    what: "反复加 ω:ω·2、ω·3、ω·4…… 序数乘法就是「加同一个极限序数很多次」。",
    mutation: "乘的次数本身变成了极限 —— ω·ω 就是 ω²。乘法升级成乘方。",
    nextNotation: "ω^n",
    threshold: 0,
    rate: DRIVER_RATE,
    baseCost: 0,
    costMult: DRIVER_COST_MULT,
    maxDrivers: 0,
    render: (p) => `ω·${count(Math.max(1, p))}`,
    ordinal: omegaTimes,
  },
  {
    n: 11,
    id: "omega-pow",
    name: "乘方",
    glyph: "ω^",
    phase: "ordinal",
    unit: "指数",
    what: "反复乘 ω:ω²、ω³、ω⁴…… 指数是写上去的那个数,一层就够。",
    mutation: "指数本身顶到了极限 —— ω^ω 不再是「ω 的某次方」,而是所有次方的上限。乘方升级成迭代幂次。",
    nextNotation: "ω↑↑n",
    threshold: 0,
    rate: DRIVER_RATE,
    baseCost: 0,
    costMult: DRIVER_COST_MULT,
    maxDrivers: 0,
    render: (p) => `ω^${count(Math.max(2, p))}`,
    ordinal: omegaPow,
  },
  {
    n: 12,
    id: "omega-tetr",
    name: "迭代幂次",
    glyph: "ω↑↑",
    phase: "ordinal",
    unit: "塔高",
    what: "ω 的指数塔:ω^ω、ω^(ω^ω)、ω^(ω^(ω^ω))…… 每加一层,就跳出上一层能写的全部范围。",
    mutation:
      "塔高顶到极限:所有有限高的塔的上限是 ε₀ = φ(1,0)。而从这一级起,箭头在 ω 上塌缩 —— ω↑↑↑n 并不比 ε₀ 更大(ε₀ 是不动点),所以再往上的「多一个箭头」变成了「多取一次不动点」。",
    nextNotation: "φ(k,0)",
    // 进度就是塔高:每 1 点进度长高一层,塔高 2 → 42。门槛只有 40,所以 rate
    // 相应缩小(0.005/台/秒),总时长与旧写法(400 × 0.05)完全一致。
    threshold: 40,
    fixedThreshold: 40,
    rate: 0.005,
    baseCost: 0,
    costMult: DRIVER_COST_MULT,
    maxDrivers: 0,
    render: (p) => `ω↑↑${omegaTowerHeight(p)}`,
    ordinal: (p) => omegaTower(omegaTowerHeight(p)),
    argOf: omegaTowerHeight,
  },
  {
    n: 13,
    id: "veblen-index",
    name: "不动点层级",
    glyph: "φ(k,0)",
    phase: "ordinal",
    unit: "不动点层",
    what: "进度是不动点层级 k:φ(1,0)=ε₀、φ(2,0)=ζ₀、φ(3,0)=η₀…… 在 ω 之上,「多一个箭头」与「多一层不动点」是同一件事。",
    mutation:
      "指标 k 自己顶到了极限 —— sup φ(k,0) = Γ₀,二元 Veblen 记号的尽头。再往上的每一序数,都要求新的坍缩函数。纪元链接手。",
    nextNotation: "Γ₀",
    threshold: 0,
    rate: DRIVER_RATE,
    baseCost: 0,
    costMult: DRIVER_COST_MULT,
    maxDrivers: 0,
    render: (p) => formatOrd(veblenFixpoint(p)),
    ordinal: veblenFixpoint,
    argOf: (p) => Math.max(1, Math.floor(p)), // 自变量就是不动点层级 k
  },
];

/* fill in the per-rung economy from the balance constants */
for (let i = 0; i < RUNGS.length; i++) {
  const r = RUNGS[i]!;
  r.threshold = r.fixedThreshold ?? growthThreshold(i);
  r.baseCost = driverBaseCost(r.n);
  r.maxDrivers = driverLimit(r.n);
}

/* The count carries across rungs that "fold" the previous operation
 * (加法→乘法→…, ω+→ω·), so the reading is monotone: a fresh rung starts
 * exactly where the last one stopped instead of restarting at `op(0)`.
 *
 *   rung 1 加法   0           → 1,800
 *   rung 2 乘法   10·1,800    → 10·3,870      ← keeps counting
 *   rung 3 乘方   10^3,870    → 10^6,251
 *   …
 *   rung 9 ω+     ω           → ω + 5,506     ← ω is a new block: base resets,
 *   rung 10 ω·    ω·5,506     → ω·11,838         but ω already dominates every
 *   rung 11 ω^    ω^11,838    → ω^19,120         finite reading
 *
 * The two "derived" rungs (ω↑↑h and φ(k,0)) are NOT carrying: their argument
 * is a tower height / fixpoint index, which is a function of progress, not a
 * count — and they still dominate the rung below them. */
const CARRY = new Set([2, 3, 4, 5, 6, 7, 8, 10, 11]);
for (let i = 0; i < RUNGS.length; i++) {
  const r = RUNGS[i]!;
  // default meter: the argument is just the progress (rung 1, 9, and the two
  // derived rungs override this in their own literal)
  r.argOf ??= (p) => p;
  if (CARRY.has(r.n)) {
    const prev = RUNGS[i - 1]!;
    const base = (CARRY.has(prev.n) ? BASE[i - 1]! : 0) + prev.threshold;
    BASE[i] = base;
    const rawRender = r.render;
    r.render = (p) => rawRender(base + p);
    if (r.ordinal) {
      const rawOrd = r.ordinal;
      r.ordinal = (p) => rawOrd(base + p);
    }
    r.argOf = (p) => base + p;
  }
  r.argMax = r.argOf(r.threshold);
}

export const CLIMB_RUNGS: readonly Rung[] = RUNGS;
/** 阶梯总级数 */
export const CLIMB_LENGTH = RUNGS.length;
/** 最后一级(破掉它就进入纪元链) */
export const FINAL_RUNG = CLIMB_LENGTH;
/** 有限阶段结束于第几级(箭头用尽的那一级) */
export const FINITE_LAST = RUNGS.filter((r) => r.phase === "finite").length;
/** 阶梯尽头的墙 —— Γ₀ */
export const CLIMB_WALL = "Γ₀";

/** 1-based rung lookup, clamped. */
export function rungAt(n: number): Rung {
  const i = Math.min(Math.max(Math.floor(n), 1), RUNGS.length) - 1;
  return RUNGS[i]!;
}

/** 该级的进度门槛 */
export function rungThreshold(n: number): number {
  return rungAt(n).threshold;
}

/** 该级是有限阶段还是 ω 之后 */
export function rungPhase(n: number): ClimbPhase {
  return rungAt(n).phase;
}

/** 该进度的数值写法 */
export function renderRung(n: number, progress: number): string {
  return rungAt(n).render(progress);
}

/** 仪表上显示的自变量 —— 与 `renderRung` 用的是同一个数,所以「6,250 / 9,987」
 *  正好对应读数 `10↑↑6,250`。(计数跨级连续时它 = base + progress,不再是 0。) */
export function rungArgument(n: number, progress: number): number {
  return Math.floor(rungAt(n).argOf!(progress));
}

/** 该级进度满格时的自变量(进度条右端) */
export function rungArgumentMax(n: number): number {
  return Math.floor(rungAt(n).argMax!);
}

/** 序数阶段:该进度对应的真实序数(有限阶段返回 0) */
export function ordinalRung(n: number, progress: number): Ord {
  const r = rungAt(n);
  return r.ordinal ? r.ordinal(progress) : [];
}

/** 破级时交付的记号名字 */
export function rungNotation(n: number): string {
  return rungAt(n).nextNotation;
}

/** ε₀ —— ω↑↑n 的极限,第 12 级的出口。 */
export const EPSILON_ZERO: Ord = veblenFixpoint(1);

/** 整个阶梯走完的比例(0 → 1),按「门槛」加权,让长台阶占更多份额。 */
export function climbFraction(n: number, progress: number): number {
  let total = 0;
  let done = 0;
  for (const r of RUNGS) {
    total += r.threshold;
    if (r.n < n) done += r.threshold;
    else if (r.n === n) done += Math.min(progress, r.threshold);
  }
  return total === 0 ? 0 : Math.min(1, done / total);
}

/** 有限阶段的整体进度(0 → 1):走完它就是 ω。 */
export function finiteFraction(n: number, progress: number): number {
  let total = 0;
  let done = 0;
  for (const r of RUNGS) {
    if (r.phase !== "finite") continue;
    total += r.threshold;
    if (r.n < n) done += r.threshold;
    else if (r.n === n) done += Math.min(progress, r.threshold);
  }
  return total === 0 ? 0 : Math.min(1, done / total);
}

/** ω 之后的序数阶梯上,破到第几级了(1-based,9 是 ω 之后的第一级)。 */
export function ordinalLevel(n: number): number {
  return Math.max(1, n - FINITE_LAST);
}

export { OMEGA };
