/* Canonicalization: every constructor output is a canonical term list
 * (strictly decreasing heads, merged equal heads, rewritten heads).
 *
 * Head rewrites:
 *   phi(0, b)  -> omega^b            (phi's first argument is 0)
 *   omega^e    -> e                 when e is a single epsilon term
 *                                      (phi(1,x) or psi(c)), coef 1
 *   Omega^0    -> 1                 (the natural 1)
 *   kappa(aleph, 0) -> omega^1      (aleph_0 = omega)
 */
import {
  checkCoef,
  MAX_COEF,
  ONE,
  OrdinalOverflow,
  type Head,
  type Ord,
  type Term,
} from "./heads";
import { compareHead } from "./order";

/** Canonicalize a raw term list. */
export function canonicalize(terms: readonly Term[]): Ord {
  const rewritten: Term[] = [];
  for (const t of terms) {
    const head = canonHead(t.head);
    const coef = checkCoef(t.coef);
    rewritten.push({ head, coef });
  }
  rewritten.sort((x, y) => compareHead(y.head, x.head));
  const out: Term[] = [];
  for (const t of rewritten) {
    const last = out[out.length - 1];
    if (last && compareHead(last.head, t.head) === 0) {
      const coef = last.coef + t.coef;
      if (coef > MAX_COEF) throw new OrdinalOverflow("coefficient overflow in canonicalize");
      out[out.length - 1] = { head: last.head, coef };
    } else {
      out.push(t);
    }
  }
  return out;
}

/** True when the value is a single epsilon term phi(1,x) or psi(c) (coef 1). */
function epsilonTerm(a: Ord): Head | null {
  if (a.length !== 1) return null;
  const t = a[0]!;
  if (t.coef !== 1) return null;
  if (t.head.kind === "psi") return t.head;
  if (t.head.kind === "veblen") {
    const x = t.head.a;
    if (x.length === 1 && x[0]!.head.kind === "omega" && x[0]!.head.exp.length === 0 && x[0]!.coef === 1) {
      return t.head;
    }
  }
  return null;
}

function isNaturalZero(a: Ord): boolean {
  return a.length === 0;
}

function isNaturalOne(a: Ord): boolean {
  return a.length === 1 && a[0]!.head.kind === "omega" && a[0]!.head.exp.length === 0 && a[0]!.coef === 1;
}

function canonHead(h: Head): Head {
  switch (h.kind) {
    case "omega": {
      const e = canonicalize(h.exp);
      const eps = epsilonTerm(e);
      // omega^(eps) = eps, so the whole term collapses onto the epsilon head
      if (eps) return eps;
      return { kind: "omega", exp: e };
    }
    case "veblen": {
      const a = canonicalize(h.a);
      const b = canonicalize(h.b);
      if (isNaturalZero(a)) return { kind: "omega", exp: b }; // phi(0,b) = omega^b
      return { kind: "veblen", a, b };
    }
    case "psi":
      return { kind: "psi", arg: canonicalize(h.arg) };
    case "bigomega": {
      const e = canonicalize(h.exp);
      if (isNaturalZero(e)) return { kind: "omega", exp: [] }; // Omega^0 = 1
      return { kind: "bigomega", exp: e };
    }
    case "card": {
      const idx = canonicalize(h.idx);
      if (h.axiom === 0 && isNaturalZero(idx)) {
        return { kind: "omega", exp: ONE }; // aleph_0 = omega
      }
      return { kind: "card", axiom: h.axiom, idx };
    }
  }
}

/* ---------------- term constructors (all canonicalize) ---------------- */

export function termOmega(exp: Ord, coef = 1): Term {
  return { head: { kind: "omega", exp }, coef };
}

export function termVeblen(a: Ord, b: Ord, coef = 1): Term {
  return { head: { kind: "veblen", a, b }, coef };
}

export function termPsi(arg: Ord, coef = 1): Term {
  return { head: { kind: "psi", arg }, coef };
}

export function termBigomega(exp: Ord, coef = 1): Term {
  return { head: { kind: "bigomega", exp }, coef };
}

export function termCard(axiom: number, idx: Ord, coef = 1): Term {
  return { head: { kind: "card", axiom, idx }, coef };
}

export { ONE };
