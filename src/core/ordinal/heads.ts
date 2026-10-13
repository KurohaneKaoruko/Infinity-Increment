/* Unified ordinal value type — one representation for the whole ladder:
 * naturals, CNF powers, Veblen phi, Madore psi, Omega powers, cardinals.
 *
 * A value is a finite strictly-decreasing sum of terms:
 *   alpha = t1*c1 + t2*c2 + ... + tk*ck   (t1 > t2 > ... as ordinals)
 * The empty list is 0. See ordinal.ts for the full module surface. */

export type Term = { readonly head: Head; readonly coef: number };
/** An ordinal in canonical term form. `[]` is 0. */
export type Ord = readonly Term[];

export type Head =
  /** omega^exp (CNF). exp = [] means omega^0 = 1, so a natural n is
   *  { kind: "omega", exp: [] } with coefficient n. */
  | { readonly kind: "omega"; readonly exp: Ord }
  /** binary Veblen phi(a, b); canonical values keep a >= 1. */
  | { readonly kind: "veblen"; readonly a: Ord; readonly b: Ord }
  /** Madore's collapsing psi(arg); every psi value is an epsilon number. */
  | { readonly kind: "psi"; readonly arg: Ord }
  /** Omega^exp (the first uncountable ordinal's powers); appears inside
   *  psi arguments. Canonical exp >= 1. */
  | { readonly kind: "bigomega"; readonly exp: Ord }
  /** cardinal kappa: `axiom` indexes CARD_AXIOMS, `idx` is its index. */
  | { readonly kind: "card"; readonly axiom: number; readonly idx: Ord };

export const MAX_COEF = 2 ** 53 - 1;
/** Practical nesting budget for the pow() range guard (the epsilon-0 wall). */
export const DEPTH_LIMIT = 48;

export class OrdinalError extends Error {}
export class OrdinalOverflow extends OrdinalError {}

export type OutOfRange = { readonly kind: "out_of_range" };
export type OrdResult =
  | { readonly ok: true; readonly value: Ord }
  | { readonly ok: false; readonly reason: OutOfRange };

/** Axiom ladder for cardinal heads: tier order is the array order. */
export const CARD_AXIOMS = [
  { id: "aleph", tag: "Aleph", name: "Aleph ladder" },
  { id: "inaccessible", tag: "Inacc", name: "Inaccessible cardinal" },
  { id: "mahlo", tag: "Mahlo", name: "Mahlo cardinal" },
  { id: "weakly-compact", tag: "WComp", name: "Weakly compact cardinal" },
  { id: "ineffable", tag: "Ineff", name: "Ineffable cardinal" },
  { id: "remarkable", tag: "Remar", name: "Remarkable cardinal" },
  { id: "almost-huge", tag: "AHuge", name: "Almost huge cardinal" },
  { id: "huge", tag: "Huge", name: "Huge cardinal" },
  { id: "superhuge", tag: "SHuge", name: "Superhuge cardinal" },
] as const;

export const ALEPH_TIER = 0;

export const ZERO: Ord = [];
export const ONE: Ord = [{ head: { kind: "omega", exp: ZERO }, coef: 1 }];
/** omega = omega^1 */
export const OMEGA: Ord = [{ head: { kind: "omega", exp: ONE }, coef: 1 }];

export function checkCoef(c: number): number {
  if (!Number.isInteger(c) || c <= 0 || c > MAX_COEF) {
    throw new OrdinalOverflow(`coefficient out of range: ${c}`);
  }
  return c;
}

/** The natural number n as an ordinal. */
export function fromNumber(n: number): Ord {
  if (!Number.isInteger(n) || n < 0 || n > MAX_COEF) {
    throw new OrdinalOverflow(`natural out of range: ${n}`);
  }
  return n === 0 ? ZERO : [{ head: { kind: "omega", exp: ZERO }, coef: n }];
}

export function isNatural(a: Ord): boolean {
  return a.length === 0 || (a.length === 1 && a[0]!.head.kind === "omega" && a[0]!.head.exp.length === 0);
}

/** omega^e as a value (omega^0 = 1). Caller passes a canonical exponent. */
export function omegaPow(e: Ord): Ord {
  return e.length === 0 ? ONE : [{ head: { kind: "omega", exp: e }, coef: 1 }];
}

/** Height toward the practical nesting budget: max head nesting depth. */
export function height(a: Ord): number {
  let h = 0;
  for (const t of a) h = Math.max(h, termHeight(t) );
  return h;
}

function termHeight(t: Term): number {
  return Math.max(...headArgs(t.head).map((s) => height(s) + 1), 0);
}

/** Every sub-value referenced by a head (for height / traversal). */
export function headArgs(h: Head): Ord[] {
  switch (h.kind) {
    case "omega":
    case "bigomega":
      return [h.exp];
    case "veblen":
      return [h.a, h.b];
    case "psi":
      return [h.arg];
    case "card":
      return [h.idx];
  }
}

/** True when the value sits within the engine's practical nesting budget. */
export function inRange(a: Ord): boolean {
  return height(a) <= DEPTH_LIMIT;
}

export function checkRange(a: Ord): OrdResult {
  return inRange(a) ? { ok: true, value: a } : { ok: false, reason: { kind: "out_of_range" } };
}
