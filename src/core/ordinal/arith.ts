/* Ordinal arithmetic over the unified head types.
 *
 * Addition is non-commutative; left summands below the right operand's
 * leading head are absorbed (1 + omega = omega). Multiplication and
 * exponentiation are kept for the CNF (omega-headed) layer where the game
 * engine needs them; they reject other heads explicitly. */
import {
  MAX_COEF,
  ONE,
  OrdinalOverflow,
  ZERO,
  type Head,
  type Ord,
  type Term,
} from "./heads";
import { compareHead, compare } from "./order";
import { canonicalize, termOmega } from "./canon";
import { checkRange } from "./heads";

/* ------------------------------------------------------------------ */
/* Addition — non-commutative; left absorption.                        */
/* ------------------------------------------------------------------ */

export function add(a: Ord, b: Ord): Ord {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const out: Term[] = [];
  let i = 0;
  for (const t of b) {
    while (i < a.length && compareHead(a[i]!.head, t.head) > 0) out.push(a[i++]!);
    if (i < a.length && compareHead(a[i]!.head, t.head) === 0) {
      const coef = a[i]!.coef + t.coef;
      if (coef > MAX_COEF) throw new OrdinalOverflow("coefficient overflow in add");
      out.push({ head: t.head, coef });
    } else {
      out.push({ head: t.head, coef: t.coef });
    }
    // everything left in `a` lies strictly below t.head and is absorbed
    i = a.length;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Multiplication — CNF layer (omega-headed values).                   */
/* ------------------------------------------------------------------ */

function mulCoef(x: number, y: number): number {
  const c = x * y;
  if (c > MAX_COEF) throw new OrdinalOverflow("coefficient overflow in mul");
  return c;
}

function lead(a: Ord): Ord {
  return a[0]!.head.kind === "omega" ? a[0]!.head.exp : ZERO;
}

function requireOmega(a: Ord): void {
  for (const t of a) {
    if (t.head.kind !== "omega") {
      throw new OrdinalOverflow(`mul/pow: unsupported head ${t.head.kind}`);
    }
  }
}

function mulTerm(a: Ord, t: Term): Ord {
  if (t.head.kind !== "omega") {
    throw new OrdinalOverflow(`mul: unsupported head ${t.head.kind}`);
  }
  const exp: Ord = t.head.exp;
  if (exp.length === 0) {
    const c = t.coef;
    if (a.length === 1 && a[0]!.head.kind === "omega" && a[0]!.head.exp.length === 0) {
      return [{ head: { kind: "omega", exp: ZERO }, coef: mulCoef(a[0]!.coef, c) }];
    }
    return a.map((term) =>
      term.head.kind === "omega" && term.head.exp.length === 0
        ? term
        : { head: term.head, coef: mulCoef(term.coef, c) },
    );
  }
  return [termOmega(add(lead(a), exp), t.coef)];
}

export function mul(a: Ord, b: Ord): Ord {
  if (a.length === 0 || b.length === 0) return ZERO;
  requireOmega(a);
  requireOmega(b);
  let result: Ord = ZERO;
  for (const t of b) result = add(result, mulTerm(a, t));
  return result;
}

/* ------------------------------------------------------------------ */
/* Exponentiation — CNF layer, with the nesting-budget guard.          */
/* ------------------------------------------------------------------ */

function powNatural(a: Ord, c: number): Ord {
  let base = a;
  let acc: Ord = ONE;
  let n = c;
  while (n > 0) {
    if (n % 2 === 1) acc = mul(acc, base);
    n = Math.floor(n / 2);
    if (n > 0) base = mul(base, base);
  }
  return acc;
}

/** Predecessor-side rule for finite bases: n^(omega^e) collapses to
 *  omega^(omega^(...)) as the epsilon tower demands. */
function finiteBaseExp(e: Ord): Ord {
  const last = e[e.length - 1]!;
  if (last.head.kind === "omega" && last.head.exp.length === 0) {
    const rest = e.slice(0, -1);
    if (last.coef === 1) return omegaHeadArg(rest);
    return omegaHeadArg([...rest, { head: { kind: "omega", exp: ZERO }, coef: last.coef - 1 }]);
  }
  return omegaHeadArg(e);
}

function omegaHeadArg(e: Ord): Ord {
  return e.length === 0 ? ONE : [{ head: { kind: "omega", exp: e }, coef: 1 }];
}

function powTerm(a: Ord, t: Term): Ord {
  if (t.head.kind !== "omega") {
    throw new OrdinalOverflow(`pow: unsupported head ${t.head.kind}`);
  }
  const exp: Ord = t.head.exp;
  if (exp.length === 0) return powNatural(a, t.coef);
  let stage: Ord;
  if (a.length === 1 && a[0]!.head.kind === "omega" && a[0]!.head.exp.length === 0) {
    // finite base n >= 2
    stage = [{ head: { kind: "omega", exp: finiteBaseExp(exp) }, coef: 1 }];
  } else {
    // infinite base a = omega^lambda*(...): a^(omega^e) = omega^(lambda*omega^e)
    const delta = mul(lead(a), omegaHeadArg(exp));
    stage = [termOmega(delta, 1)];
  }
  return t.coef === 1 ? stage : powNatural(stage, t.coef);
}

/** Ordinal exponentiation with the nesting-budget range guard. */
export function pow(a: Ord, b: Ord): { ok: true; value: Ord } | { ok: false; reason: { kind: "out_of_range" } } {
  try {
    requireOmega(a);
    requireOmega(b);
    const value = powInner(a, b);
    return checkRange(value);
  } catch (e) {
    if (e instanceof OrdinalOverflow) {
      return { ok: false, reason: { kind: "out_of_range" } };
    }
    throw e;
  }
}

function powInner(a: Ord, b: Ord): Ord {
  if (b.length === 0) return ONE;
  if (a.length === 0) return ZERO;
  if (a.length === 1 && a[0]!.head.kind === "omega" && a[0]!.head.exp.length === 0 && a[0]!.coef === 1) {
    return ONE;
  }
  let result: Ord = ONE;
  for (const t of b) result = mul(result, powTerm(a, t));
  return canonicalize(result);
}

export { compare };
