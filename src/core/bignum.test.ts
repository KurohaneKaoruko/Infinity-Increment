import { describe, it, expect } from "vitest";
import { bn, BN_ZERO } from "./bignum";

describe("bignum wrapper", () => {
  it("handles magnitudes far beyond Number", () => {
    const big = bn("1e1000");
    expect(big.mul(big).toString()).toBe("1e+2000");
  });

  it("exposes zero constant and comparison", () => {
    expect(BN_ZERO.lt(bn(1))).toBe(true);
    expect(bn(5).gte(bn(5))).toBe(true);
  });
});
