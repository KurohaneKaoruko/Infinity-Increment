/* Gold vectors for the extended heads: binary Veblen, Madore psi,
 * Omega powers, cardinals. Values marked (M) are from Madore's psi table
 * (Cantor's Attic). Cross-notation equalities (psi(Omega) = zeta_0) are
 * NOT tested as equalities: each era notates its own range. */
import { describe, it, expect } from "vitest";
import {
  ONE,
  OMEGA,
  ZERO,
  add,
  canonicalize,
  compare,
  equal,
  fromNumber,
  mul,
  rank,
  termBigomega,
  termCard,
  termOmega,
  termPsi,
  termVeblen,
  type Ord,
} from "./ordinal";
import { formatOrd } from "./format";
import { fromJSON, toJSON } from "./serialize";

const n = fromNumber;
const EPS0: Ord = [termVeblen(ONE, ZERO)]; // epsilon_0
const ZETA0: Ord = [termVeblen(n(2), ZERO)]; // zeta_0
const ETA0: Ord = [termVeblen(n(3), ZERO)]; // eta_0
const PHI40: Ord = [termVeblen(n(4), ZERO)]; // phi_4(0)
const OM: Ord = [termBigomega(ONE)]; // Omega
const OM2: Ord = [termBigomega(n(2))]; // Omega^2
const OMOM: Ord = [termBigomega(OM)]; // Omega^Omega = Gamma_0's code
const OMOM1: Ord = [termBigomega(add(OM, ONE))]; // Omega^(Omega+1)

describe("binary Veblen heads", () => {
  it("phi(0,b) canonicalizes to omega^b", () => {
    expect(equal(canonicalize([termVeblen(ZERO, n(5))]), [termOmega(n(5))])).toBe(true);
    expect(formatOrd(canonicalize([termVeblen(ZERO, n(5))]))).toBe("ω^5");
  });

  it("names the famous columns", () => {
    expect(formatOrd(EPS0)).toBe("ε₀");
    expect(formatOrd(ZETA0)).toBe("ζ₀");
    expect(formatOrd(ETA0)).toBe("η₀");
    expect(formatOrd(PHI40)).toBe("φ₄(₀)");
    expect(formatOrd(add(EPS0, ONE))).toBe("ε₀ + 1");
    expect(formatOrd([termVeblen(ONE, n(1), 2)])).toBe("ε₁·2");
  });

  it("column order: epsilons < zetas < etas", () => {
    expect(compare(EPS0, ZETA0)).toBe(-1);
    expect(compare(ZETA0, ETA0)).toBe(-1);
    expect(compare(EPS0, ETA0)).toBe(-1);
    expect(compare([termVeblen(ONE, n(5))], EPS0)).toBe(1); // eps_5 > eps_0
  });

  it("finite omega towers stay below epsilon_0", () => {
    const tower = [termOmega([termOmega([termOmega(n(3))])])]; // omega^omega^omega^3
    expect(compare(tower, EPS0)).toBe(-1);
  });

  it("recursive rule: phi(1, zeta_0+7) > phi(2, 0) (first arg does not dominate blindly)", () => {
    const b = add(ZETA0, n(7));
    const x: Ord = [termVeblen(ONE, b)];
    const y: Ord = [termVeblen(n(2), ZERO)];
    expect(compare(x, y)).toBe(1);
    expect(compare([termVeblen(ONE, n(5))], y)).toBe(-1);
  });

  it("omega^e vs phi: omega^(eps_0+1) = eps_0*omega > eps_0", () => {
    const x = [termOmega(add(EPS0, ONE))];
    expect(compare(x, EPS0)).toBe(1);
    const y = [termOmega([termOmega(n(5))])]; // omega^omega^5 < eps_0
    expect(compare(y, EPS0)).toBe(-1);
  });

  it("epsilon rewrite: omega^eps_0 = eps_0 and omega^psi(c) = psi(c)", () => {
    expect(equal(canonicalize([termOmega(EPS0)]), EPS0)).toBe(true);
    const psiC: Ord = [termPsi(OM)];
    expect(equal(canonicalize([termOmega(psiC)]), psiC)).toBe(true);
  });

  it("addition absorbs like CNF: eps_5 + eps_0*2 = eps_5 + eps_0*2, eps_0*2 + eps_5 = eps_5", () => {
    const eps5: Ord = [termVeblen(ONE, n(5))];
    const eps0x2: Ord = [termVeblen(ONE, ZERO, 2)];
    expect(formatOrd(add(eps0x2, eps5))).toBe("ε₅");
    expect(formatOrd(add(eps5, eps0x2))).toBe("ε₅ + ε₀·2");
    expect(formatOrd(add(eps0x2, EPS0))).toBe("ε₀·3");
  });
});

describe("Madore psi heads", () => {
  const PSI0: Ord = [termPsi(ZERO)]; // psi(0) = eps_0 (M)
  const PSI1: Ord = [termPsi(ONE)]; // psi(1) = eps_1 (M)
  const PSIOM: Ord = [termPsi(OM)]; // psi(Omega) = zeta_0 (M)
  const GAMMA0: Ord = [termPsi(OMOM)]; // psi(Omega^Omega) = Gamma_0 (M)
  const SVOLIKE: Ord = [termPsi([termBigomega([termBigomega(n(3))])])]; // psi(Omega^(Omega^3))

  it("psi is increasing in its argument", () => {
    expect(compare(PSI0, PSI1)).toBe(-1);
    expect(compare(PSI1, PSIOM)).toBe(-1);
    expect(compare(PSIOM, GAMMA0)).toBe(-1);
    expect(compare(GAMMA0, [termPsi(OMOM1)])).toBe(-1); // Gamma_0 < phi(1,1,0) (M)
  });

  it("countable values stay below every psi value with uncountable argument", () => {
    const countable = mul(OMEGA, n(9));
    expect(compare(countable, PSIOM)).toBe(-1);
    expect(compare(EPS0, PSIOM)).toBe(-1); // (era-3 notation sits below psi(Omega))
  });

  it("SVO/LVO/BHO code points order correctly (M)", () => {
    // psi(Omega^(Omega^3)) < psi(Omega^(Omega^omega)) < psi(Omega^(Omega^Omega))
    const svo = [termPsi([termBigomega([termBigomega([termOmega(ONE)])])])]; // psi(Omega^(Omega^omega))
    const lvo = [termPsi([termBigomega([termBigomega([termBigomega(ONE)])])])]; // psi(Omega^(Omega^Omega))
    expect(compare(SVOLIKE, svo)).toBe(-1);
    expect(compare(svo, lvo)).toBe(-1);
  });

  it("addition: psi(c) absorbs smaller psi terms, merges equals", () => {
    expect(formatOrd(add(GAMMA0, [termPsi(OMOM1)]))).toBe("ψ(Ω^(Ω + 1))");
    expect(formatOrd(add(GAMMA0, GAMMA0))).toBe("ψ(Ω^Ω)·2");
    expect(formatOrd(add(GAMMA0, PSIOM))).toBe("ψ(Ω^Ω) + ψ(Ω)");
  });

  it("formats psi and Omega powers", () => {
    expect(formatOrd(PSI0)).toBe("ψ(0)");
    expect(formatOrd(PSIOM)).toBe("ψ(Ω)");
    expect(formatOrd(GAMMA0)).toBe("ψ(Ω^Ω)");
    expect(formatOrd(OM)).toBe("Ω");
    expect(formatOrd(OM2)).toBe("Ω^2");
    expect(formatOrd(add(OM2, OM))).toBe("Ω^2 + Ω");
  });
});

describe("cardinal heads", () => {
  const ALEPH1: Ord = [termCard(0, ONE)]; // omega_1
  const ALEPHW: Ord = [termCard(0, OMEGA)]; // aleph_omega
  const INACC: Ord = [termCard(1, ZERO)]; // first inaccessible

  it("aleph_0 canonicalizes to omega; aleph_1 tops every countable", () => {
    expect(equal(canonicalize([termCard(0, ZERO)]), OMEGA)).toBe(true);
    expect(compare(ALEPH1, OMEGA)).toBe(1);
    expect(compare(ALEPH1, [termPsi([termBigomega([termBigomega([termBigomega(ONE)])])])])).toBe(1);
    expect(compare(ALEPHW, ALEPH1)).toBe(1);
    expect(formatOrd(ALEPH1)).toBe("ℵ₁");
    expect(formatOrd(ALEPHW)).toBe("ℵ{ω}");
  });

  it("axiom tiers order: aleph < inaccessible < mahlo", () => {
    expect(compare(ALEPH1, INACC)).toBe(-1);
    const mahlo: Ord = [termCard(2, ZERO)];
    expect(compare(INACC, mahlo)).toBe(-1);
    expect(compare(ALEPHW, mahlo)).toBe(-1);
    expect(formatOrd(mahlo)).toBe("Mahlo₀");
  });

  it("indices order within a tier", () => {
    const i5: Ord = [termCard(1, n(5))];
    const i9: Ord = [termCard(1, n(9))];
    expect(compare(i5, i9)).toBe(-1);
    const iw: Ord = [termCard(1, OMEGA)];
    expect(compare(i9, iw)).toBe(-1);
  });
});

describe("bridge rank is monotone along the ladder", () => {
  it("rank strictly increases across era-representative values", () => {
    const ladder: Ord[] = [
      fromNumber(5),
      mul(OMEGA, n(3)), // omega*3
      [termOmega(n(7))], // omega^7
      [termOmega([termOmega([termOmega(n(3))])])], // omega^omega^omega^3
      [termVeblen(ONE, ZERO)], // eps_0
      [termVeblen(ONE, n(9))], // eps_9
      [termVeblen(n(2), ZERO)], // zeta_0
      [termVeblen(n(3), ZERO)], // eta_0
      [termPsi([termBigomega(ONE)])], // psi(Omega)
      [termPsi([termBigomega([termBigomega(ONE)])])], // psi(Omega^Omega)
      [termCard(0, ONE)], // aleph_1
      [termCard(0, OMEGA)], // aleph_omega
      [termCard(1, ZERO)], // inaccessible
      [termCard(2, ZERO)], // mahlo
    ];
    for (let i = 1; i < ladder.length; i++) {
      expect(rank(ladder[i]!)).toBeGreaterThan(rank(ladder[i - 1]!));
    }
  });

  it("bounded coefficients never overtake the next omega rung", () => {
    const big: Ord = [termOmega(n(7), 10 ** 6)]; // omega^7 * 1e6
    const next: Ord = [termOmega(n(8))];
    expect(rank(big)).toBeLessThan(rank(next));
  });
});

describe("serialization of extended heads", () => {
  it("round-trips every head kind", () => {
    const values: Ord[] = [
      [termVeblen(ONE, n(3), 2)],
      [termPsi([termBigomega([termBigomega(ONE)])], 2)],
      [termBigomega([termOmega(ONE)], 3)],
      [termCard(2, [termVeblen(ONE, ZERO)])],
      add([termVeblen(n(2), ZERO)], [termVeblen(ONE, n(2))]),
    ];
    for (const v of values) {
      const back = fromJSON(JSON.parse(JSON.stringify(toJSON(v))));
      expect(equal(back, v)).toBe(true);
    }
  });

  it("rejects unknown tags and bad tiers", () => {
    expect(() => fromJSON([["x", [], 1]])).toThrow();
    expect(() => fromJSON([["c", -1, [], 1]])).toThrow();
    expect(() => fromJSON([["v", [], 1]])).toThrow();
  });
});
