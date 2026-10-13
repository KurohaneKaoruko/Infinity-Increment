/* Property tests: the laws of ordinal arithmetic are the test oracle (design D7).
 * Random ords are built through `canonicalize`, so every generated value is
 * a legitimate canonical CNF. */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  add,
  canonicalize,
  compare,
  equal,
  fromNumber,
  height,
  mul,
  OMEGA,
  ONE,
  pow,
  ZERO,
  termOmega,
  type Ord,
  type Term,
} from "./ordinal";
import { fromJSON, toJSON } from "./serialize";

const MAX_TEST_COEF = 40;

function ordArb(depth: number): fc.Arbitrary<Ord> {
  const termArb = (d: number): fc.Arbitrary<{ exp: Ord; coef: number }> =>
    fc.record({
      exp: ordArb(d - 1),
      coef: fc.integer({ min: 1, max: MAX_TEST_COEF }),
    });
  if (depth <= 0) return fc.constant([]);
  return fc
    .array(termArb(depth), { maxLength: 3 })
    .chain((terms) => fc.constant(canonicalize(terms.map((t) => termOmega(t.exp, t.coef)))));
}

const smallOrd = ordArb(2);
const tinyOrd = ordArb(1);

describe("ordinal laws (fast-check)", () => {
  it("addition is associative", () => {
    fc.assert(
      fc.property(smallOrd, smallOrd, smallOrd, (a, b, c) => {
        expect(equal(add(add(a, b), c), add(a, add(b, c)))).toBe(true);
      }),
    );
  });

  it("addition identities: a+0 = a = 0+a", () => {
    fc.assert(
      fc.property(smallOrd, (a) => {
        expect(equal(add(a, ZERO), a)).toBe(true);
        expect(equal(add(ZERO, a), a)).toBe(true);
      }),
    );
  });

  it("left absorption: 1 + α = α whenever α is infinite", () => {
    fc.assert(
      fc.property(smallOrd, (a) => {
        fc.pre(a.length > 0 && a[0]!.head.kind === "omega" && a[0]!.head.exp.length > 0); // alpha >= omega
        expect(equal(add(fromNumber(1), a), a)).toBe(true);
      }),
    );
  });

  it("multiplication is associative", () => {
    fc.assert(
      fc.property(smallOrd, tinyOrd, tinyOrd, (a, b, c) => {
        expect(equal(mul(mul(a, b), c), mul(a, mul(b, c)))).toBe(true);
      }),
    );
  });

  it("multiplication identities: 1·a = a = a·1", () => {
    fc.assert(
      fc.property(smallOrd, (a) => {
        expect(equal(mul(ONE, a), a)).toBe(true);
        expect(equal(mul(a, ONE), a)).toBe(true);
      }),
    );
  });

  it("left distributivity: a·(b+c) = a·b + a·c", () => {
    fc.assert(
      fc.property(tinyOrd, tinyOrd, tinyOrd, (a, b, c) => {
        expect(equal(mul(a, add(b, c)), add(mul(a, b), mul(a, c)))).toBe(true);
      }),
    );
  });

  it("right absorption: c·ω = ω for finite c ≥ 1", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: MAX_TEST_COEF }), (c) => {
        expect(equal(mul(fromNumber(c), OMEGA), OMEGA)).toBe(true);
      }),
    );
  });

  it("comparison: total, antisymmetric, transitive", () => {
    fc.assert(
      fc.property(smallOrd, smallOrd, smallOrd, (a, b, c) => {
        const ab = compare(a, b);
        const ba = compare(b, a);
        expect(ba).toBe(ab === 0 ? 0 : -ab);
        expect(ab !== 0 || equal(a, b)).toBe(true);
        const bc = compare(b, c);
        if (ab <= 0 && bc <= 0) expect(compare(a, c)).toBeLessThanOrEqual(0);
        if (ab >= 0 && bc >= 0) expect(compare(a, c)).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("canonical uniqueness: equal ordinals have identical formatting", () => {
    fc.assert(
      fc.property(smallOrd, smallOrd, (a, b) => {
        if (compare(a, b) === 0) {
          expect(a.length).toBe(b.length);
          expect(toJSON(a)).toEqual(toJSON(b));
        }
      }),
    );
  });

  it("serialization round-trip preserves value", () => {
    fc.assert(
      fc.property(smallOrd, (a) => {
        const back = fromJSON(JSON.parse(JSON.stringify(toJSON(a))));
        expect(equal(back, a)).toBe(true);
      }),
    );
  });

  it("exponent laws: a^(b+c) = a^b·a^c and (a^b)^c = a^(b·c)", () => {
    fc.assert(
      fc.property(tinyOrd, tinyOrd, tinyOrd, (a, b, c) => {
        const rb = pow(a, b);
        const rc = pow(a, c);
        const rsum = pow(a, add(b, c));
        fc.pre(rb.ok && rc.ok && rsum.ok);
        expect(equal(rsum.value, mul(rb.value, rc.value))).toBe(true);
        const rbc = pow(a, mul(b, c));
        if (rbc.ok) {
          const rbrac = pow(rb.value, c);
          if (rbrac.ok) expect(equal(rbc.value, rbrac.value)).toBe(true);
        }
      }),
    );
  });

  it("height respects the range guard", () => {
    fc.assert(
      fc.property(smallOrd, (a) => {
        const r = pow(a, fromNumber(2));
        if (r.ok) expect(height(r.value)).toBeLessThanOrEqual(48);
      }),
    );
  });
});
