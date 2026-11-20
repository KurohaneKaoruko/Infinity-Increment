/* Era table — the authored notation route used by the game.
 *
 * Each era owns a generator family with three closures:
 *   increment(alpha)  — the term added per owned unit per tick
 *   thresholdReached(alpha) — has the game-specific coefficient gate been met?
 *   nextCheckpoint(alpha)   — the next authored position after that gate
 *
 * Coefficient thresholds and checkpoint jumps are game rules. They are not
 * claims that a finite sequence converges to the next ordinal.
 *
 * Era 0 is not a generator ladder at all: it is the authored itinerary in
 * ops.ts. It uses exact ordinal checkpoints at ω and Γ₀, then switches to
 * further notation systems. The switch is game content, not a theorem that
 * one notation system has been mathematically exhausted. */
import {
  ONE,
  OMEGA,
  ZERO,
  add,
  equal,
  fromNumber,
  termBigomega,
  termCard,
  termOmega,
  termPsi,
  termVeblen,
  type Ord,
  type Term,
} from "../ordinal/ordinal";
import { formatOrd } from "../ordinal/format";
import { CARD_AXIOMS } from "../ordinal/heads";

export interface GenDef {
  id: string;
  name: string;
  /** flat cost in money for the first unit; extra units scale by ERA_UNIT_COST_MULT */
  cost: number;
  increment: (alpha: Ord, count: number) => Term;
  thresholdReached: (alpha: Ord, threshold: number) => boolean;
  nextCheckpoint: (alpha: Ord) => Ord;
  /** wall rungs fire the era wall instead of a normal game checkpoint */
  wall?: boolean;
  /** milestone label shown when the rung is first reached */
  waypoint?: string;
}

export interface EraDef {
  id: string;
  name: string;
  short: string;
  /** position when the era begins (after the previous transcendence) */
  startAlpha: Ord;
  /** named milestone at the end of this authored game route */
  wallName: string;
  wallDesc: string;
  /** finite coefficient gate used by this game route */
  threshold: number;
  gens: GenDef[];
  /** dynamic eras rebuild gens per large-cardinal tier */
  dynamic?: boolean;
}

/* ---------------- shared helpers ---------------- */

const nat = fromNumber;
const BIGOMEGA: Ord = [termBigomega(ONE)]; // Omega
const EPS0: Ord = [termVeblen(ONE, ZERO)]; // epsilon_0
const ZETA0: Ord = [termVeblen(nat(2), ZERO)]; // zeta_0
// Internal handoff code for the ψ era. The game labels the preceding route
// Γ₀, but this ψ expression is not presented as a definition of Γ₀.
const GAMMA0_ROUTE_CODE: Ord = [termPsi([termBigomega(BIGOMEGA)])];

/** omega^k for a natural k. */
function wPow(k: number): Ord {
  return [termOmega(nat(k))];
}

/** lead head, or null for zero. */
function leadHead(a: Ord): Term | null {
  return a.length === 0 ? null : a[0]!;
}

/* ---------------- era 0: the climb (driven by ops.ts) ---------------- */

/** Index 0 is not a generator ladder at all — it is the operation climb
 *  (see ops.ts). It is kept in the chain so era indices stay stable and the
 *  roadmap can name where the climb hands over. */
export const ERA_CLIMB: EraDef = {
  id: "climb",
  name: "运算阶梯 · 1 → ω → Γ₀",
  short: "阶梯",
  startAlpha: ZERO,
  wallName: "Γ₀",
  wallDesc:
    "游戏路线的两个数学检查点：sup(n<ω)=ω；对 F(α)=φ_α(0) 从 ε₀ 开始迭代，其上确界是 Γ₀。有限门槛和换记号是玩法抽象，不是“绝对无穷”的进度。",
  threshold: 0,
  gens: [],
};

/* ---------------- era 1: Madore's psi ---------------- */

/** Omega^e as a value. */
const bo = (e: Ord): Ord => [termBigomega(e)];

// small ordinal pieces used inside Omega-exponents
const w2: Ord = [termOmega(nat(2))]; // omega^2
const ww: Ord = [termOmega(OMEGA)]; // omega^omega
const wx2: Ord = [termOmega(ONE, 2)]; // omega*2
const O2: Ord = [termBigomega(nat(2))]; // Omega^2
const Ox2: Ord = [termBigomega(ONE, 2)]; // Omega*2
const Ow: Ord = [termBigomega(OMEGA)]; // Omega^omega
const OOm: Ord = bo(BIGOMEGA); // Omega^Omega

/** Omega^(e + k). */
const boPlus = (e: Ord, k: number): Ord => bo(add(e, nat(k)));
/** Omega^(a + b + k) — a plain sum in the exponent, no extra nesting. */
const boSum3 = (a: Ord, b: Ord, k: number): Ord => bo(add(add(a, b), nat(k)));

/** psi-argument ladder: every next label strictly exceeds the previous.
 * The selected samples climb through Ω^(Ω+2), Ω^(Ω+ω^ω), Ω^(Ω·2),
 * Ω^(Ω²), Ω^(Ω^ω) (SVO), Ω^(Ω^Ω) (LVO), and finally
 * Ω^(Ω^(Ω^Ω)). */
const PSI_LABELS: { label: Ord; note?: string }[] = [
  { label: boPlus(BIGOMEGA, 2) }, // Omega^(Omega+2)
  { label: boPlus(BIGOMEGA, 4) },
  { label: boPlus(BIGOMEGA, 6) },
  { label: boSum3(BIGOMEGA, wx2, 2) }, // Omega^(Omega+omega*2+2)
  { label: boSum3(BIGOMEGA, wx2, 4) },
  { label: boSum3(BIGOMEGA, w2, 2) }, // Omega^(Omega+omega^2+2)
  { label: boSum3(BIGOMEGA, w2, 4) },
  { label: boSum3(BIGOMEGA, ww, 2) }, // Omega^(Omega+omega^omega+2)
  { label: boSum3(BIGOMEGA, ww, 4) },
  { label: boPlus(Ox2, 2) }, // Omega^(Omega*2+2)
  { label: boPlus(Ox2, 4) },
  { label: boSum3(Ox2, w2, 2) }, // Omega^(Omega*2+omega^2+2)
  { label: boPlus(O2, 2) }, // Omega^(Omega^2+2)
  { label: boSum3(O2, BIGOMEGA, 2) }, // Omega^(Omega^2+Omega+2)
  { label: boSum3(O2, Ox2, 2) }, // Omega^(Omega^2+Omega*2+2)
  { label: boSum3(O2, O2, 2) }, // Omega^(Omega^2*2+2)
  { label: bo(Ow), note: "svo" }, // Omega^Omega^omega — SVO = psi(Omega^(Omega^omega))
  { label: boPlus(Ow, 2) },
  { label: boSum3(Ow, BIGOMEGA, 2) },
  { label: boSum3(Ow, Ox2, 2) },
  { label: boSum3(Ow, O2, 2) },
  { label: boSum3(Ow, Ow, 2) }, // Omega^(Omega^omega*2+2)
  { label: boPlus(bo(add(OMEGA, ONE)), 2) }, // Omega^(Omega^(omega+1)+2)
  { label: boPlus(bo(wx2), 2) }, // Omega^(Omega^(omega*2)+2)
  { label: boPlus(bo(w2), 2) }, // Omega^(Omega^(omega^2)+2)
  { label: boPlus(bo(ww), 2) }, // Omega^(Omega^(omega^omega)+2)
  { label: bo(OOm), note: "lvo" }, // Omega^Omega^Omega — LVO = psi(Omega^(Omega^Omega))
  { label: boPlus(OOm, 2) },
  { label: boSum3(OOm, BIGOMEGA, 2) },
  { label: boSum3(OOm, Ox2, 2) },
  { label: boSum3(OOm, O2, 2) },
  { label: boSum3(OOm, Ow, 2) }, // Omega^(Omega^Omega+Omega^omega+2)
  { label: boSum3(OOm, OOm, 2) }, // Omega^(Omega^Omega*2+2)
  { label: bo(bo(OOm)), note: "endpoint" },
];

const PSI_BASE_COST = 8e42;
// the initial ψ bridge is around 2^124, so costs must NOT
// outgrow it there: growth 1.12 keeps every rung a few minutes of income
const PSI_COST_GROWTH = 1.12;

export const ERA_PSI: EraDef = {
  id: "psi",
  name: "纪元 II · 坍缩函数",
  short: "ψ",
  startAlpha: GAMMA0_ROUTE_CODE,
  wallName: "ψ(Ω^(Ω^(Ω^Ω)))",
  wallDesc:
    "此路线的最后一个参数样本是 Ω^(Ω^(Ω^Ω))。它不是 BHO 的标准定义 ψ(ε_{Ω+1})；本游戏只把它作为选定的 ψ 参数终点，不宣称穷尽所有可数序数。",
  threshold: 1200,
  gens: PSI_LABELS.map(({ label, note }, j): GenDef => ({
    id: `psi${j}`,
    name:
      note === "svo"
        ? "ψ 序列 · SVO 航点(小 Veblen 序数)"
        : note === "lvo"
          ? "ψ 序列 · LVO 航点(大 Veblen 序数)"
          : note === "endpoint"
            ? `ψ 路线终点 · ψ(${formatOrd(label)})`
          : `ψ 梯级 ${j} · ψ(${formatOrd(label)})`,
    cost: PSI_BASE_COST * PSI_COST_GROWTH ** j,
    increment: (_alpha, count) => termPsi(label, count),
    thresholdReached: (a, threshold) => {
      const t = leadHead(a);
      return !!t && t.head.kind === "psi" && equal(t.head.arg, label) && t.coef >= threshold;
    },
    nextCheckpoint: () => [termPsi(PSI_LABELS[j + 1]!.label)],
    wall: j === PSI_LABELS.length - 1,
    waypoint:
      note === "svo"
        ? "SVO · 小 Veblen 序数 ψ(Ω^(Ω^ω))"
        : note === "lvo"
          ? "LVO · 大 Veblen 序数 ψ(Ω^(Ω^Ω))"
          : note === "endpoint"
            ? "ψ 参数样本路线终点"
          : undefined,
  })),
};

/* ---------------- era 2: the aleph layer ---------------- */

// A finite authored sample of aleph indices. It is not the set of all
// countable ordinals; the game deliberately switches notation at its wall.
const ALEPH_INDICES: Ord[] = [
  nat(1),
  nat(2),
  nat(3),
  nat(4),
  OMEGA,
  wPow(2),
  [termOmega(OMEGA)],
  EPS0,
  ZETA0,
  GAMMA0_ROUTE_CODE,
];

const ALEPH_BASE_COST = 2e60;
const ALEPH_COST_GROWTH = 1.2;

export const ERA_ALEPH: EraDef = {
  id: "aleph",
  name: "纪元 III · 阿列夫层谱",
  short: "ℵ",
  startAlpha: [termCard(0, nat(1))], // aleph_1 — the first uncountable ordinal
  wallName: "第一不可达基数",
  wallDesc:
    "本游戏选取有限个 ℵ_δ 样本后切换到大基数路线。数学上不存在“有限样本穷尽所有可数指标”这一结论；第一不可达基数是另一个大基数性质，不是由本路线有限步算出。",
  threshold: 2400,
  gens: ALEPH_INDICES.map((idx, j): GenDef => ({
    id: `al${j}`,
    name: `阿列夫梯级 ${j} · ${formatOrd([termCard(0, idx)])}`,
    cost: ALEPH_BASE_COST * ALEPH_COST_GROWTH ** j,
    increment: (_alpha, count) => termCard(0, idx, count),
    thresholdReached: (a, threshold) => {
      const t = leadHead(a);
      if (!t || t.head.kind !== "card" || t.head.axiom !== 0) return false;
      return equal(t.head.idx, idx) && t.coef >= threshold;
    },
    nextCheckpoint: () => [termCard(0, ALEPH_INDICES[j + 1]!)],
    wall: j === ALEPH_INDICES.length - 1,
    waypoint:
      idx === OMEGA
        ? "ℵ_ω —— 指标越过 ω"
        : idx === EPS0
          ? "ℵ_{ε₀} —— 可数序数成为基数指标"
          : idx === GAMMA0_ROUTE_CODE
            ? "ℵ_{Γ₀} —— 本路线的最后样本"
            : undefined,
  })),
};

/* ---------------- era 3+: the large-cardinal ladder (procedural) ---------------- */

const LARGE_LEVELS = 8;
const LARGE_BASE_COST = 1.5e62;
const LARGE_COST_GROWTH = 1.3;
const LARGE_CONVERGE = 3000;

/** Human name of the selected large-cardinal route tier. */
export function axiomTierName(tier: number): string {
  const ax = CARD_AXIOMS[tier];
  return ax ? ax.name : `第 ${tier} 级大基数主题`;
}

/** One authored game era per selected large-cardinal tier; the route is open-ended. */
export function largeCardinalEra(tier: number): EraDef {
  const ax = CARD_AXIOMS[tier];
  const first: Ord = [termCard(tier, ZERO)];
  return {
    id: `lc${tier}`,
    name: `纪元 ${["IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"][tier - 1] ?? tier} · ${axiomTierName(tier)}`,
    short: ax ? ax.tag : `κ${tier}`,
    startAlpha: first,
    wallName: axiomTierName(tier + 1),
    wallDesc: `本游戏的第 ${tier} 层大基数路线已完成，下一检查点标为 ${axiomTierName(tier + 1)}。这是一条选定的数学主题路线，不表示存在唯一的“大基数大小序列”。`,
    threshold: LARGE_CONVERGE,
    dynamic: true,
    gens: Array.from({ length: LARGE_LEVELS }, (_, j): GenDef => {
      const idx = nat(j + 1);
      return {
        id: `lc${tier}_${j}`,
        name: `${axiomTierName(tier)} · 第 ${j + 1} 个`,
        cost: LARGE_BASE_COST * LARGE_COST_GROWTH ** j,
        increment: (_alpha, count) => termCard(tier, idx, count),
        thresholdReached: (a, threshold) => {
          const t = leadHead(a);
          if (!t || t.head.kind !== "card" || t.head.axiom !== tier) return false;
          return equal(t.head.idx, idx) && t.coef >= threshold;
        },
        nextCheckpoint: () => [termCard(tier, nat(j + 2))],
        wall: j === LARGE_LEVELS - 1,
        waypoint: j === 0 ? `${axiomTierName(tier)} 抵达` : undefined,
      };
    }),
  };
}

/* ---------------- the endless chain ---------------- */

export const STATIC_ERAS: EraDef[] = [ERA_CLIMB, ERA_PSI, ERA_ALEPH];

const DYNAMIC_CACHE = new Map<number, EraDef>();

/** The era at a chain index; index >= 3 runs the procedural cardinal ladder. */
export function eraAt(index: number): EraDef {
  if (index < STATIC_ERAS.length) return STATIC_ERAS[index]!;
  const tier = index - STATIC_ERAS.length + 1;
  let era = DYNAMIC_CACHE.get(tier);
  if (!era) {
    era = largeCardinalEra(tier);
    DYNAMIC_CACHE.set(tier, era);
  }
  return era;
}
