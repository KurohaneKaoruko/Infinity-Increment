import { describe, expect, it } from "vitest";
import { bn } from "../bignum";
import { OFFLINE_CAP_MS, OFFLINE_EFFICIENCY, OFFLINE_MAX_TICKS } from "../save/offline";
import { PULSE_CAP_TICKS, TICK_MS } from "./config";
import { moneyRate, tick } from "./engine";
import { settleGameOffline } from "./offline";
import { initialState } from "./state";

describe("game-aware offline settlement", () => {
  it("settles income once, at 50%, including a fractional tick", () => {
    const start = initialState();
    const result = settleGameOffline(start, 60_050, false);
    expect(result.state.money.toNumber()).toBeCloseTo(30.025, 8);
    expect(result.report.moneyGain.toNumber()).toBeCloseTo(30.025, 8);
    expect(result.report.ticksApplied).toBe(600);
    expect(result.state.lastSeen).toBe(60_050);
    expect(settleGameOffline(result.state, 60_050, false).report.moneyGain.eq(0)).toBe(true);
  });

  it("can start from no machines and buy while away when automation is on", () => {
    const start = initialState();
    const result = settleGameOffline(start, 60_000, true);
    expect(result.state.drivers).toBeGreaterThan(0);
    expect(result.state.rungProgress).toBeGreaterThan(0);
    expect(result.state.money.gte(0)).toBe(true);
    expect(start.drivers).toBe(0);
    expect(start.money.eq(0)).toBe(true);
  });

  it("preserves manual mode and recharges pulses even at a stopped node", () => {
    const result = settleGameOffline({ ...initialState(), pulseTicks: 0 }, 180_000, false);
    expect(result.state.drivers).toBe(0);
    expect(result.state.rungProgress).toBe(0);
    expect(result.state.pulseTicks).toBe(PULSE_CAP_TICKS);
    expect(result.report.hitWall).toBe(true);
  });

  it("integrates each checkpoint's income rather than backdating the final multiplier", () => {
    const start = { ...initialState(), drivers: 8, rungProgress: 1799 };
    let reference = start;
    let earned = bn(0);
    for (let i = 0; i < 20; i++) {
      const gain = moneyRate(reference).mul(0.1 * OFFLINE_EFFICIENCY);
      earned = earned.add(gain);
      const next = tick(reference).state;
      reference = { ...next, money: reference.money.add(gain) };
    }
    const result = settleGameOffline(start, 20 * TICK_MS, false);
    expect(result.state.rung).toBe(2);
    expect(result.state.money.eq(reference.money)).toBe(true);
    expect(result.report.moneyGain.eq(earned)).toBe(true);
    expect(result.report.moneyGain.lt(moneyRate(result.state).mul(2 * OFFLINE_EFFICIENCY))).toBe(true);
  });

  it("caps long absences and never generates income from future timestamps", () => {
    const result = settleGameOffline(initialState(), OFFLINE_CAP_MS * 10, false);
    expect(result.report.seconds).toBe(OFFLINE_CAP_MS / 1000);
    expect(result.report.ticksApplied).toBe(OFFLINE_MAX_TICKS);
    expect(result.state.money.toNumber()).toBeCloseTo(43_200, 6);
    const future = settleGameOffline({ ...initialState(), lastSeen: 1000, pulseTicks: 0 }, 0, false);
    expect(future.state.money.eq(0)).toBe(true);
    expect(future.state.pulseTicks).toBe(0);
  });
});
