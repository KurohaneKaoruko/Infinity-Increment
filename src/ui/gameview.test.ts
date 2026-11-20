import { describe, expect, it } from "vitest";
import { bn } from "../core/bignum";
import { climbValue } from "../core/game/engine";
import { FINAL_RUNG } from "../core/game/ops";
import { initialState } from "../core/game/state";
import { affordIn, compactClimbValue } from "./gameview";

describe("compact game presentation", () => {
  it("keeps nested Γ₀ samples compact without changing the engine value", () => {
    const state = { ...initialState(), rung: FINAL_RUNG, rungProgress: 38.1 };
    const original = climbValue(state);
    expect(original.length).toBeGreaterThan(200);
    expect(compactClimbValue(state)).toBe("F^38(ε₀)");
    expect(climbValue(state)).toBe(original);
    expect(compactClimbValue({ ...state, rungProgress: 0 })).toBe("ε₀");
  });

  it("leaves ordinary notation unchanged", () => {
    const state = { ...initialState(), rung: 9, rungProgress: 50 };
    expect(compactClimbValue(state)).toBe(climbValue(state));
  });

  it("estimates affordability with big numbers without modifying the budget", () => {
    const state = { ...initialState(), money: bn(10) };
    expect(affordIn(state, 50)).toBe(40);
    expect(affordIn(state, 5)).toBe(0);
    expect(Number.isFinite(affordIn(state, bn("1e250")))).toBe(true);
    expect(state.money.eq(10)).toBe(true);
  });
});
