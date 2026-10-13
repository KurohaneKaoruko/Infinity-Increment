/* Total order on canonical values.
 *
 * Rules (derived from the underlying ordinal semantics):
 *   omega^e  vs omega^e'        -> compare(e, e')
 *   omega^e  vs X               -> compare(e, X)   for X in {phi(a>=1,b),
 *                                 psi(c), Omega^d, kappa}: every such X is a
 *                                 fixed point of xi -> omega^xi
 *                                 (omega^e < X  <=>  e < X).
 *   phi(a,b) vs phi(a',b')      -> if a = a' compare b,b';
 *                                 if a < a' then b < phi(a',b') decides
 *                                 (phi(a',b') is a common fixed point of
 *                                 phi(a, .) for every a <= a').
 *   psi(c)   vs psi(c')         -> compare(c, c')   (psi is increasing)
 *   psi(c)   vs veblen(a,b)     -> compare(b, psi(c)) — era-boundary
 *                                 convention only; mixed values never occur
 *                                 inside one era's play.
 *   countable (omega/phi/psi)   < uncountable (Omega^d, kappa)
 *   Omega^d  vs Omega^d'        -> compare(d, d')
 *   Omega^d  < kappa (tier order), kappa(t,i) vs kappa(t',i'):
 *                                 tier first, then compare(i, i').
 */
import { ALEPH_TIER, type Head, type Ord, type Term } from "./heads";

/** Wrap a single head as a one-term value. */
function single(h: Head, coef = 1): Ord {
  return [{ head: h, coef }];
}

function isCountable(h: Head): boolean {
  return h.kind === "omega" || h.kind === "veblen" || h.kind === "psi";
}

/** Compare two heads by ordinal value. Inputs must be canonical. */
export function compareHead(x: Head, y: Head): number {
  if (x.kind === "omega" && y.kind === "omega") return compare(x.exp, y.exp);
  if (x.kind === y.kind) {
    switch (x.kind) {
      case "veblen": {
        if (y.kind !== "veblen") break;
        const c = compare(x.a, y.a);
        if (c !== 0) return c < 0 ? compare(x.b, single(y)) : -compare(y.b, single(x));
        return compare(x.b, y.b);
      }
      case "psi":
        if (y.kind !== "psi") break;
        return compare(x.arg, y.arg);
      case "bigomega":
        if (y.kind !== "bigomega") break;
        return compare(x.exp, y.exp);
      case "card": {
        if (y.kind !== "card") break;
        if (x.axiom !== y.axiom) return x.axiom < y.axiom ? -1 : 1;
        return compare(x.idx, y.idx);
      }
      case "omega":
        break;
    }
  }
  if (x.kind === "omega") return compare(x.exp, single(y));
  if (y.kind === "omega") return -compare(y.exp, single(x));
  if (x.kind === "veblen" && y.kind === "psi") return compare(x.b, single(y));
  if (x.kind === "psi" && y.kind === "veblen") return -compare(y.b, single(x));
  const cx = isCountable(x);
  const cy = isCountable(y);
  if (cx !== cy) return cx ? -1 : 1;
  // bigomega < card (the Omega = aleph_1 identity is conflated by design;
  // gameplay never mixes the two notations in one value)
  if (x.kind === "bigomega") return -1;
  if (y.kind === "bigomega") return 1;
  return 0;
}

const COMPARE_DEPTH_LIMIT = 512;

/** Compare two canonical ordinals: -1, 0 or 1. */
export function compare(a: Ord, b: Ord): number {
  return compareAt(a, b, 0);
}

function compareAt(a: Ord, b: Ord, depth: number): number {
  if (depth > COMPARE_DEPTH_LIMIT) {
    throw new RangeError("ordinal compare: recursion limit");
  }
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const ta: Term = a[i]!;
    const tb: Term = b[j]!;
    const c = compareHead(ta.head, tb.head);
    if (c !== 0) return c;
    if (ta.coef !== tb.coef) return ta.coef < tb.coef ? -1 : 1;
    i++;
    j++;
  }
  if (i < a.length) return 1;
  if (j < b.length) return -1;
  return 0;
}

export function equal(a: Ord, b: Ord): boolean {
  return compare(a, b) === 0;
}

export function lessThan(a: Ord, b: Ord): boolean {
  return compare(a, b) < 0;
}

export { ALEPH_TIER };
