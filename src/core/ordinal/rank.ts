/* rank(): a monotone value -> magnitude map used by the economy bridge
 * g(alpha) and the era approach meters.
 *
 * Monotone for every value one era can produce (coefficients there stay
 * far below the 2^53 cap, exponents below the authored ladders). Scales:
 *   omega^e        -> rank(e)*K + 1            K = 4 (geometric ladder)
 *   phi(a,b)       -> rank(a)*MUL + rank(b) + 2 (first arg dominates)
 *   psi(c)         -> EPS_BASE + rank(c)       (psi values sit in the
 *                                               epsilon column, above CNF)
 *   Omega^d        -> rank(d)*MUL + OMEGA_BASE
 *   kappa(t,i)     -> CARD_BASE + t*CARD_STEP + rank(i)*MUL
 * Coefficients contribute log2(coef)/COEF_SCALE and tails a negligible
 * share, so bounded coefficients can never overtake the next rung. */
import type { Head, Ord, Term } from "./heads";

const K = 4;
const MUL = 2 ** 10;
const COEF_SCALE = 256;
const EPS_BASE = 2 ** 16;
const OMEGA_BASE = 2 ** 20;
const CARD_BASE = 2 ** 44;
// one large-cardinal tier ≈ +2.5 bridge levels, so each transcendence into a
// new axiom tier multiplies income by roughly 2^2.5 ≈ 5.7×
const CARD_STEP = 2 ** 45;

function headRank(h: Head): number {
  switch (h.kind) {
    case "omega":
      return rank(h.exp) * K + 1;
    case "veblen":
      return rank(h.a) * MUL + rank(h.b) + 2;
    case "psi":
      return EPS_BASE + rank(h.arg);
    case "bigomega":
      return rank(h.exp) * MUL + OMEGA_BASE;
    case "card":
      return CARD_BASE + h.axiom * CARD_STEP + rank(h.idx) * MUL;
  }
}

/** Monotone magnitude of an ordinal value (double precision). */
export function rank(a: Ord): number {
  if (a.length === 0) return 0;
  const t: Term = a[0]!;
  if (t.head.kind === "omega" && t.head.exp.length === 0 && a.length === 1) {
    return Math.log2(1 + t.coef); // naturals: log-compressed, below omega
  }
  let r = headRank(t.head) + Math.log2(t.coef) / COEF_SCALE;
  if (a.length > 1) r += rank(a.slice(1)) / (2 ** 20);
  return r;
}

/** The economy bridge exponent: multiplier = 2^bridgeLevel(alpha). */
export const BRIDGE_C = 4;

export function bridgeLevel(a: Ord): number {
  return BRIDGE_C * Math.log2(1 + rank(a));
}

/** Currency multiplier exponent, capped for sanity. */
export function bridgeMultiplierExp(a: Ord): number {
  return Math.min(1e6, Math.floor(bridgeLevel(a)));
}
