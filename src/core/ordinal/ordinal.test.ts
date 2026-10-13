import { describe, it, expect } from "vitest";
import {
  ZERO,
  ONE,
  OMEGA,
  add,
  canonicalize,
  compare,
  equal,
  fromNumber,
  height,
  mul,
  pow,
  termOmega,
} from "./ordinal";
import { formatOrd } from "./format";
import { fromJSON, toJSON } from "./serialize";

const n = fromNumber;
const w = OMEGA;

describe("canonical form (2.1)", () => {
  it("sorts terms by strictly decreasing exponent and merges equal ones", () => {
    const raw = [termOmega(ZERO, 5), termOmega(ONE, 3), termOmega(ONE, 4)];
    const a = canonicalize(raw);
    expect(formatOrd(a)).toBe("ω·7 + 5");
  });

  it("builds ω = ω^1 with height 2", () => {
    expect(formatOrd(OMEGA)).toBe("ω");
    expect(height(OMEGA)).toBe(2);
    expect(height(ZERO)).toBe(0);
    expect(height(ONE)).toBe(1);
  });
});

describe("comparison (2.2)", () => {
  it("golden: ω+1 < ω+2 < ω·2 < ω^2", () => {
    const a = add(w, n(1));
    const b = add(w, n(2));
    const c = mul(w, n(2));
    const d = mul(w, w);
    expect(compare(a, b)).toBe(-1);
    expect(compare(b, c)).toBe(-1);
    expect(compare(c, d)).toBe(-1);
  });

  it("golden: 1 + ω = ω (left absorption)", () => {
    expect(equal(add(n(1), w), w)).toBe(true);
  });

  it("golden: 2·ω = ω but ω·2 > ω+1", () => {
    expect(equal(mul(n(2), w), w)).toBe(true);
    expect(compare(add(w, n(1)), mul(w, n(2)))).toBe(-1);
  });

  it("golden: ω·2 = ω+ω", () => {
    expect(equal(mul(w, n(2)), add(w, w))).toBe(true);
  });
});

describe("addition (2.3)", () => {
  it("golden: (ω^2·3 + ω·4 + 5) + (ω^2 + ω + 1) = ω^2·4 + ω + 1", () => {
    const a = add(add(mul(mul(w, w), n(3)), mul(w, n(4))), n(5));
    const b = add(add(mul(mul(w, w), n(1)), mul(w, n(1))), n(1));
    const sum = add(a, b);
    expect(formatOrd(sum)).toBe("ω^2·4 + ω + 1");
  });

  it("absorbs middle terms: (ω^3 + ω^2·2) + ω^3·5 = ω^3·6", () => {
    // (ω^3 + ω^2·2) + ω^3·5 = ω^3·6 (the ω^2·2 is absorbed)
    const a = add([termOmega(n(3))], [termOmega(n(2), 2)]);
    const b = [termOmega(n(3), 5)];
    expect(formatOrd(add(a, b))).toBe("ω^3·6");
  });

  it("keeps higher terms then appends: (ω^ω + ω^2·2) + ω^3·5 = ω^ω + ω^3·5", () => {
    const wW = pow(w, w);
    if (!wW.ok) throw new Error("expected in range");
    const a = add(wW.value, [termOmega(n(2), 2)]);
    const b = [termOmega(n(3), 5)];
    expect(formatOrd(add(a, b))).toBe("ω^ω + ω^3·5");
  });
});

describe("multiplication (2.4)", () => {
  it("golden: (ω+5)·2 = ω·2 + 5 (finite part not doubled)", () => {
    const a = add(w, n(5));
    expect(formatOrd(mul(a, n(2)))).toBe("ω·2 + 5");
  });

  it("golden: (ω^2·3 + ω·4 + 5)·3 = ω^2·9 + ω·12 + 5", () => {
    const a = add(add(mul(mul(w, w), n(3)), mul(w, n(4))), n(5));
    expect(formatOrd(mul(a, n(3)))).toBe("ω^2·9 + ω·12 + 5");
  });

  it("golden: (ω+5)·ω = ω^2", () => {
    expect(formatOrd(mul(add(w, n(5)), w))).toBe("ω^2");
  });

  it("golden: ω·(ω+5) = ω^2 + ω·5", () => {
    expect(formatOrd(mul(w, add(w, n(5))))).toBe("ω^2 + ω·5");
  });

  it("golden: 1·a = a", () => {
    const a = add(mul(mul(w, w), n(3)), n(9));
    expect(equal(mul(ONE, a), a)).toBe(true);
    expect(equal(mul(a, ONE), a)).toBe(true);
  });
});

describe("exponentiation (2.5)", () => {
  it("golden: ω^2 = ω·ω", () => {
    const r = pow(w, n(2));
    expect(r.ok).toBe(true);
    if (r.ok) expect(equal(r.value, mul(w, w))).toBe(true);
  });

  it("golden: ω^ω formats as ω^ω", () => {
    const r = pow(w, w);
    expect(r.ok).toBe(true);
    if (r.ok) expect(formatOrd(r.value)).toBe("ω^ω");
  });

  it("golden: n^ω = ω for finite n ≥ 2", () => {
    const r = pow(n(7), w);
    expect(r.ok).toBe(true);
    if (r.ok) expect(equal(r.value, w)).toBe(true);
  });

  it("golden: n^(ω·2) = n^(ω+ω) = ω·ω = ω^2", () => {
    const r = pow(n(7), mul(w, n(2)));
    expect(r.ok).toBe(true);
    if (r.ok) expect(equal(r.value, mul(w, w))).toBe(true);
  });

  it("golden: (ω+5)^2 = ω^2 + ω·5 + 5", () => {
    const r = pow(add(w, n(5)), n(2));
    expect(r.ok).toBe(true);
    if (r.ok) expect(formatOrd(r.value)).toBe("ω^2 + ω·5 + 5");
  });

  it("golden: ω^(ω+1) = ω^ω · ω", () => {
    const wW = pow(w, w);
    expect(wW.ok).toBe(true);
    if (!wW.ok) return;
    const r = pow(w, add(w, ONE));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(equal(r.value, mul(wW.value, w))).toBe(true);
  });

  it("golden: a^1 = a, a^0 = 1, 0^b = 0 (b>0), 1^b = 1", () => {
    const a = add(w, n(3));
    const r1 = pow(a, ONE);
    expect(r1.ok && equal(r1.value, a)).toBe(true);
    const r0 = pow(a, ZERO);
    expect(r0.ok && equal(r0.value, ONE)).toBe(true);
    const rz = pow(ZERO, ONE);
    expect(rz.ok && equal(rz.value, ZERO)).toBe(true);
    const ro = pow(ONE, w);
    expect(ro.ok && equal(ro.value, ONE)).toBe(true);
  });

  it("range guard: deep towers report out_of_range (2.5)", () => {
    // build ω^ω^...^ω with nesting beyond DEPTH_LIMIT via iterated pow
    let e = w;
    let guard = 0;
    while (guard < 64) {
      const r = pow(w, e);
      if (!r.ok) break;
      e = r.value;
      guard++;
    }
    expect(guard).toBeLessThan(64);
    expect(guard).toBeGreaterThanOrEqual(46); // stopped because of the wall, not an error
  });
});

describe("serialization (2.6)", () => {
  it("round-trips ω^ω·3 + ω·2 + 1", () => {
    const wW = pow(w, w);
    expect(wW.ok).toBe(true);
    if (!wW.ok) return;
    const a = add(add(mul(wW.value, n(3)), mul(w, n(2))), n(1));
    const json = toJSON(a);
    const back = fromJSON(JSON.parse(JSON.stringify(json)));
    expect(equal(back, a)).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(() => fromJSON({ bad: true })).toThrow();
    expect(() => fromJSON([[ZERO, 0]])).toThrow();
  });
});
