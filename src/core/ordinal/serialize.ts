/* Lossless JSON (de)serialization of canonical ordinals.
 * Wire shape:
 *   omega head      [exp, coef]                 (legacy CNF-compatible)
 *   veblen phi(a,b) ["v", a, b, coef]
 *   psi(c)          ["p", arg, coef]
 *   Omega^d         ["w", exp, coef]
 *   kappa(t,i)      ["c", axiomTier, idx, coef]
 */
import type { Head, Ord, Term } from "./heads";
import { canonicalize, MAX_COEF, OrdinalError } from "./ordinal";

export type JSONOrd = readonly JSONTerm[];

type JSONTerm =
  | readonly [JSONOrd, number]
  | readonly ["v", JSONOrd, JSONOrd, number]
  | readonly ["p", JSONOrd, number]
  | readonly ["w", JSONOrd, number]
  | readonly ["c", number, JSONOrd, number];

export function toJSON(a: Ord): JSONOrd {
  return a.map((t) => termToJSON(t));
}

function termToJSON(t: Term): JSONTerm {
  const h: Head = t.head;
  switch (h.kind) {
    case "omega":
      return [toJSON(h.exp), t.coef];
    case "veblen":
      return ["v", toJSON(h.a), toJSON(h.b), t.coef];
    case "psi":
      return ["p", toJSON(h.arg), t.coef];
    case "bigomega":
      return ["w", toJSON(h.exp), t.coef];
    case "card":
      return ["c", h.axiom, toJSON(h.idx), t.coef];
  }
}

export function fromJSON(raw: unknown): Ord {
  if (raw === 0) return [];
  if (!Array.isArray(raw)) throw new OrdinalError("ordinal: expected array");
  const terms: Term[] = raw.map((item) => {
    if (!Array.isArray(item) || item.length < 2) {
      throw new OrdinalError("ordinal term: malformed");
    }
    const tag = item[0];
    if (typeof tag === "string") {
      const coef = expectCoef(item[item.length - 1]);
      switch (tag) {
        case "v":
          return {
            head: { kind: "veblen", a: fromJSON(item[1]), b: fromJSON(item[2]) },
            coef,
          };
        case "p":
          return { head: { kind: "psi", arg: fromJSON(item[1]) }, coef };
        case "w":
          return { head: { kind: "bigomega", exp: fromJSON(item[1]) }, coef };
        case "c": {
          const axiom = item[1];
          if (typeof axiom !== "number" || !Number.isInteger(axiom) || axiom < 0) {
            throw new OrdinalError("ordinal term: bad axiom tier");
          }
          return { head: { kind: "card", axiom, idx: fromJSON(item[2]) }, coef };
        }
        default:
          throw new OrdinalError(`ordinal term: unknown tag ${tag}`);
      }
    }
    // legacy omega form: [exp, coef]
    if (item.length !== 2) throw new OrdinalError("ordinal term: expected [exp, coef]");
    return { head: { kind: "omega", exp: fromJSON(tag) }, coef: expectCoef(item[1]) };
  });
  return canonicalize(terms);
}

function expectCoef(v: unknown): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0 || v > MAX_COEF) {
    throw new OrdinalError("ordinal coefficient out of range");
  }
  return v;
}
