/* Terminal-facing ordinal formatting: "ω^2·3 + ω·7 + 5", "ε₀", "ζ₁·2",
 * "ψ(Ω^2)", "ℵ_{ε₀}", "Mahlo_3". Math notation stays math notation. */
import type { Ord, Term } from "./heads";
import { isNatural } from "./heads";
import { CARD_AXIOMS } from "./heads";

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

function subscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUBSCRIPTS[Number(d)] ?? d)
    .join("");
}

function nat(t: Term): number | null {
  return t.head.kind === "omega" && t.head.exp.length === 0 ? t.coef : null;
}

function naturalValue(a: Ord): number | null {
  return a.length === 1 ? nat(a[0]!) : null;
}

export function formatOrd(a: Ord): string {
  if (a.length === 0) return "0";
  return a.map(formatTerm).join(" + ");
}

function formatTerm(t: Term): string {
  const { head, coef } = t;
  const suffix = coef === 1 ? "" : `·${coef}`;
  switch (head.kind) {
    case "omega":
      if (head.exp.length === 0) return String(coef);
      return formatExp(head.exp) + suffix;
    case "veblen":
      return formatVeblen(head.a, head.b) + suffix;
    case "psi":
      return `ψ(${formatOrd(head.arg)})` + suffix;
    case "bigomega":
      return formatOmegaExp(head.exp) + suffix;
    case "card": {
      const ax = CARD_AXIOMS[head.axiom];
      if (head.axiom === 0) return `ℵ${formatIdx(head.idx)}` + suffix;
      return `${ax ? ax.tag : "K"}${formatIdx(head.idx)}` + suffix;
    }
  }
}

function formatIdx(idx: Ord): string {
  if (idx.length === 0) return "₀";
  const n = naturalValue(idx);
  if (n !== null && n <= 9) return subscript(n);
  return `{${formatOrd(idx)}}`;
}

function formatVeblen(a: Ord, b: Ord): string {
  const na = naturalValue(a);
  if (na !== null && na >= 1 && na <= 3) {
    const greek = ["", "ε", "ζ", "η"][na]!;
    return `${greek}${formatIdx(b)}`;
  }
  if (na !== null) return `φ${subscript(na)}(${formatIdx(b)})`;
  return `φ(${formatOrd(a)}, ${formatOrd(b)})`;
}

function formatExp(e: Ord): string {
  // exponent 1 -> "ω"; natural n -> "ω^n"; pure ω -> "ω^ω"; else ω^(...)
  if (isNatural(e)) {
    if (e.length === 0) return "ω^0?";
    const n = e[0]!.coef;
    return n === 1 ? "ω" : `ω^${n}`;
  }
  if (
    e.length === 1 &&
    e[0]!.coef === 1 &&
    e[0]!.head.kind === "omega" &&
    e[0]!.head.exp.length === 1 &&
    e[0]!.head.exp[0]!.head.kind === "omega" &&
    e[0]!.head.exp[0]!.head.exp.length === 0
  ) {
    return "ω^ω";
  }
  return `ω^(${formatOrd(e)})`;
}

function formatOmegaExp(e: Ord): string {
  const n = naturalValue(e);
  if (n === 1) return "Ω";
  if (n !== null) return `Ω^${n}`;
  if (e.length === 1 && e[0]!.head.kind === "bigomega" && e[0]!.coef === 1) return "Ω^Ω";
  return `Ω^(${formatOrd(e)})`;
}
