/* Pure, compact presentation helpers. They never change the stored ordinal. */
import { bn, type BigNum } from "../core/bignum";
import { climbValue, moneyRate } from "../core/game/engine";
import { FINAL_RUNG } from "../core/game/ops";
import type { GameState } from "../core/game/state";

export function compactClimbValue(s: GameState): string {
  if (s.phase === "climb" && s.rung === FINAL_RUNG) {
    const steps = Math.max(0, Math.min(40, Math.floor(s.rungProgress)));
    return steps === 0 ? "ε₀" : `F^${steps}(ε₀)`;
  }
  return climbValue(s);
}

/** Estimate with today's production only; spending or upgrades change it. */
export function affordIn(s: GameState, cost: BigNum | number): number {
  const remaining = bn(cost).sub(s.money);
  if (remaining.lte(0)) return 0;
  const rate = moneyRate(s);
  return rate.gt(0) ? remaining.div(rate).toNumber() : Infinity;
}
