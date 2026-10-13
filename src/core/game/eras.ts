/* Era table — the ladder of notation systems the game climbs.
 *
 * Each era owns a generator family with three closures:
 *   increment(alpha)  — the term added per owned unit per tick
 *   saturates(alpha)  — does the current lead sit at this rung, filled?
 *   deliver(alpha)    — the limit delivered on saturation (or the wall)
 *
 * Convergence is mathematically real where it can be (sup of the rung is
 * the next rung); wall rungs and era jumps are the notation's practical
 * boundary, exactly like era I's CNF depth wall below epsilon_0.
 *
 * The chain is endless: static eras 0..3 hand over to a procedural
 * large-cardinal ladder (one EraDef per axiom tier, tier -> infinity). */
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
  saturates: (alpha: Ord, converge: number) => boolean;
  deliver: (alpha: Ord) => Ord;
  /** wall rungs fire the era wall instead of delivering a limit */
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
  /** the wall ordinal this era breaks at (fictional practical boundary) */
  wallName: string;
  wallDesc: string;
  /** coefficient threshold for convergence */
  converge: number;
  gens: GenDef[];
  /** dynamic eras rebuild gens per large-cardinal tier */
  dynamic?: boolean;
}

/* ---------------- shared helpers ---------------- */

const nat = fromNumber;
const BIGOMEGA: Ord = [termBigomega(ONE)]; // Omega
const EPS0: Ord = [termVeblen(ONE, ZERO)]; // epsilon_0
const ZETA0: Ord = [termVeblen(nat(2), ZERO)]; // zeta_0
const GAMMA0: Ord = [termPsi([termBigomega(BIGOMEGA)])]; // psi(Omega^Omega)

/** omega^k for a natural k. */
function wPow(k: number): Ord {
  return [termOmega(nat(k))];
}

/** lead head, or null for zero. */
function leadHead(a: Ord): Term | null {
  return a.length === 0 ? null : a[0]!;
}

/* ---------------- era 0: the finite layer (display only) ---------------- */

export const ERA_FINITE: EraDef = {
  id: "finite",
  name: "纪元 0 · 有限层",
  short: "有限",
  startAlpha: ZERO,
  wallName: "ω",
  wallDesc: "点击已经点不动了 —— 有限步永远够不到 ω。放出一条 cofinal 序列,让极限送你过去。",
  converge: 2000,
  gens: [],
};

/* ---------------- era 1: Cantor Normal Form ---------------- */

const CNF_LEVELS = 8;
// era I income climbs ~1.4×/rung with the rank bridge; costs track it
const CNF_COSTS = [1e4, 2.2e4, 4.8e4, 1.1e5, 2.3e5, 5.1e5, 1.1e6, 2.5e6];

export const ERA_CNF: EraDef = {
  id: "cnf",
  name: "纪元 I · Cantor 范式",
  short: "CNF",
  startAlpha: ZERO,
  wallName: "ε₀",
  wallDesc: "CNF 的表示深度即将越界 —— ε₀ 是 ω 的第一个不动点,有限层的幂梯已无法记述它。",
  converge: 2000,
  gens: Array.from({ length: CNF_LEVELS }, (_, k): GenDef => {
    const omegaK = wPow(k);
    return {
      id: `cf${k}`,
      name:
        k === 0
          ? "cofinal-0 · 第一条 cofinal 序列(有限序列的极限是 ω)"
          : `CNF 梯级 ${k} · 序列趋近 ${formatOrd(omegaK)}`,
      cost: CNF_COSTS[k]!,
      increment: (_alpha, count) => termOmega(nat(k), count),
      saturates: (a, converge) => {
        const t = leadHead(a);
        if (!t || t.head.kind !== "omega") return false;
        const e = t.head.exp;
        const isRung =
          k === 0
            ? e.length === 0
            : e.length === 1 &&
              e[0]!.head.kind === "omega" &&
              e[0]!.head.exp.length === 0 &&
              e[0]!.coef === k;
        return isRung && t.coef >= converge;
      },
      deliver: () => wPow(k + 1),
      wall: k === CNF_LEVELS - 1,
      waypoint:
        k === 1 ? "ω² —— 尾项吸收成为常态" : k === 3 ? "ω⁴" : k === 5 ? "ω⁶" : undefined,
    };
  }),
};

/* ---------------- era 2: binary Veblen ---------------- */

// One flat ladder of phi(a,b) rungs from epsilon_0 up to the Gamma_0 wall.
// Each rung is a limit ordinal; filling its coefficient delivers the next.
const VEB_RUNGS: { a: Ord; b: Ord }[] = [
  { a: ONE, b: ZERO }, // phi(1,0) = epsilon_0
  { a: ONE, b: ONE }, // phi(1,1) = epsilon_1
  { a: ONE, b: OMEGA }, // phi(1,omega)
  { a: ONE, b: wPow(2) }, // phi(1,omega^2)
  { a: nat(2), b: ZERO }, // phi(2,0) = zeta_0
  { a: nat(2), b: OMEGA }, // phi(2,omega)
  { a: nat(3), b: ZERO }, // phi(3,0) = eta_0
  { a: OMEGA, b: ZERO }, // phi(omega,0)
  { a: add(OMEGA, ONE), b: ZERO }, // phi(omega+1,0)
  { a: add(OMEGA, OMEGA), b: ZERO }, // phi(omega*2,0)
  { a: wPow(2), b: ZERO }, // phi(omega^2,0)
  { a: [termOmega(OMEGA)], b: ZERO }, // phi(omega^omega,0)
  { a: [termOmega([termOmega(OMEGA)])], b: ZERO }, // phi(omega^(omega^omega),0)
  { a: EPS0, b: ZERO }, // phi(epsilon_0,0)
  { a: ZETA0, b: ZERO }, // phi(zeta_0,0) — the Gamma_0 wall rung
];

const VEB_BASE_COST = 6.5e18;
const VEB_COST_GROWTH = 1.3;

export const ERA_VEBLEN: EraDef = {
  id: "veblen",
  name: "纪元 II · Veblen 层谱",
  short: "Veblen",
  startAlpha: EPS0,
  wallName: "Γ₀",
  wallDesc:
    "φ 的第一参数已经能表示整个 Cantor 层谱 —— 记号开始自指。Γ₀ = φ(α,0) 的第一个不动点,Veblen 二元表示到此为止。",
  converge: 2000,
  gens: VEB_RUNGS.map((r, j): GenDef => {
    const rung = [termVeblen(r.a, r.b)];
    return {
      id: `veb${j}`,
      name: `Veblen 梯级 ${j} · ${formatOrd(rung)}`,
      cost: VEB_BASE_COST * VEB_COST_GROWTH ** j,
      increment: (_alpha, count) => termVeblen(r.a, r.b, count),
      saturates: (a, converge) => {
        const t = leadHead(a);
        if (!t || t.head.kind !== "veblen") return false;
        return equal(t.head.a, r.a) && equal(t.head.b, r.b) && t.coef >= converge;
      },
      deliver: () => [termVeblen(VEB_RUNGS[j + 1]!.a, VEB_RUNGS[j + 1]!.b)],
      wall: j === VEB_RUNGS.length - 1,
      waypoint:
        j === 0
          ? "ε₀ —— CNF 之外的第一个记号"
          : j === 4
            ? "ζ₀ —— ε 列的极限"
            : j === 6
              ? "η₀"
              : j === 7
                ? "φ(ω,0)"
                : j === 13
                  ? "φ(ε₀,0) —— 序数作为序数的参数"
                  : undefined,
    };
  }),
};

/* ---------------- era 3: Madore's psi ---------------- */

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
 * Climb: Ω+2 … Ω+ω^ω … Ω·2 … Ω² … Ω^ω (SVO) … Ω^Ω (LVO) … Ω^(ε_{Ω+1}) (BHO). */
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
  { label: bo(bo(OOm)) }, // Omega^(Omega^(Omega^Omega)) — the BHO-region wall
];

const PSI_BASE_COST = 8e42;
// the bridge is flat across rungs 0–25 (income 2^120), so costs must NOT
// outgrow it there: growth 1.12 keeps every rung a few minutes of income
const PSI_COST_GROWTH = 1.12;

export const ERA_PSI: EraDef = {
  id: "psi",
  name: "纪元 III · 坍缩函数",
  short: "ψ",
  startAlpha: GAMMA0,
  wallName: "BHO",
  wallDesc:
    "ψ 的参数已经含住整个 Ω 层谱 —— 可数序数的记述逼近巴赫曼-霍华德序数(BHO = ψ(ε_{Ω+1}))的边界。再往上的每一序数,都先要成为不可数。",
  converge: 1200,
  gens: PSI_LABELS.map(({ label, note }, j): GenDef => ({
    id: `psi${j}`,
    name:
      note === "svo"
        ? "ψ 序列 · SVO 航点(小 Veblen 序数)"
        : note === "lvo"
          ? "ψ 序列 · LVO 航点(大 Veblen 序数)"
          : `ψ 梯级 ${j} · ψ(${formatOrd(label)})`,
    cost: PSI_BASE_COST * PSI_COST_GROWTH ** j,
    increment: (_alpha, count) => termPsi(label, count),
    saturates: (a, converge) => {
      const t = leadHead(a);
      return !!t && t.head.kind === "psi" && equal(t.head.arg, label) && t.coef >= converge;
    },
    deliver: () => [termPsi(PSI_LABELS[j + 1]!.label)],
    wall: j === PSI_LABELS.length - 1,
    waypoint:
      note === "svo"
        ? "SVO · 小 Veblen 序数 ψ(Ω^(Ω^ω))"
        : note === "lvo"
          ? "LVO · 大 Veblen 序数 ψ(Ω^(Ω^Ω))"
          : undefined,
  })),
};

/* ---------------- era 4: the aleph layer ---------------- */

// Index ladder for the alephs: 1, 2, 3, 4, omega, omega^2, omega^omega,
// epsilon_0, zeta_0, Gamma_0 — the countable indices, then the wall.
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
  GAMMA0,
];

const ALEPH_BASE_COST = 2e60;
const ALEPH_COST_GROWTH = 1.2;

export const ERA_ALEPH: EraDef = {
  id: "aleph",
  name: "纪元 IV · 阿列夫层谱",
  short: "ℵ",
  startAlpha: [termCard(0, nat(1))], // aleph_1 — the first uncountable ordinal
  wallName: "第一不可达基数",
  wallDesc:
    "阿列夫的指标已经可数穷尽 —— ℵ_δ 对任何可数 δ 都够不到正则强极限。第一个不可达基数不是任何阿列夫序列的极限,它要求一条新公理。",
  converge: 2400,
  gens: ALEPH_INDICES.map((idx, j): GenDef => ({
    id: `al${j}`,
    name: `阿列夫梯级 ${j} · ${formatOrd([termCard(0, idx)])}`,
    cost: ALEPH_BASE_COST * ALEPH_COST_GROWTH ** j,
    increment: (_alpha, count) => termCard(0, idx, count),
    saturates: (a, converge) => {
      const t = leadHead(a);
      if (!t || t.head.kind !== "card" || t.head.axiom !== 0) return false;
      return equal(t.head.idx, idx) && t.coef >= converge;
    },
    deliver: () => [termCard(0, ALEPH_INDICES[j + 1]!)],
    wall: j === ALEPH_INDICES.length - 1,
    waypoint:
      idx === OMEGA
        ? "ℵ_ω —— 指标越过 ω"
        : idx === EPS0
          ? "ℵ_{ε₀} —— 可数序数成为基数指标"
          : idx === GAMMA0
            ? "ℵ_{Γ₀} —— 可数指标的尽头"
            : undefined,
  })),
};

/* ---------------- era 5+: the large-cardinal ladder (procedural) ---------------- */

const LARGE_LEVELS = 8;
const LARGE_BASE_COST = 1.5e62;
const LARGE_COST_GROWTH = 1.3;
const LARGE_CONVERGE = 3000;

/** Human name of axiom tier t (authored table, then procedural). */
export function axiomTierName(tier: number): string {
  const ax = CARD_AXIOMS[tier];
  return ax ? ax.name : `第 ${tier} 级大基数公理`;
}

/** One era per large-cardinal axiom tier; the chain never ends. */
export function largeCardinalEra(tier: number): EraDef {
  const ax = CARD_AXIOMS[tier];
  const first: Ord = [termCard(tier, ZERO)];
  return {
    id: `lc${tier}`,
    name: `纪元 ${["V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][tier - 1] ?? tier} · ${axiomTierName(tier)}`,
    short: ax ? ax.tag : `κ${tier}`,
    startAlpha: first,
    wallName: axiomTierName(tier + 1),
    wallDesc: `第 ${tier} 级公理的最后一个序号也已经填满 —— 层谱攀上了 ${axiomTierName(tier + 1)}。公理没有尽头:每一层「更大」都以上一层为起点。`,
    converge: LARGE_CONVERGE,
    dynamic: true,
    gens: Array.from({ length: LARGE_LEVELS }, (_, j): GenDef => {
      const idx = nat(j + 1);
      return {
        id: `lc${tier}_${j}`,
        name: `${axiomTierName(tier)} · 第 ${j + 1} 个`,
        cost: LARGE_BASE_COST * LARGE_COST_GROWTH ** j,
        increment: (_alpha, count) => termCard(tier, idx, count),
        saturates: (a, converge) => {
          const t = leadHead(a);
          if (!t || t.head.kind !== "card" || t.head.axiom !== tier) return false;
          return equal(t.head.idx, idx) && t.coef >= converge;
        },
        deliver: () => [termCard(tier, nat(j + 2))],
        wall: j === LARGE_LEVELS - 1,
        waypoint: j === 0 ? `${axiomTierName(tier)} 抵达` : undefined,
      };
    }),
  };
}

/* ---------------- the endless chain ---------------- */

export const STATIC_ERAS: EraDef[] = [ERA_CNF, ERA_VEBLEN, ERA_PSI, ERA_ALEPH];

const DYNAMIC_CACHE = new Map<number, EraDef>();

/** The era at a chain index; index >= 4 runs the procedural cardinal ladder. */
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
