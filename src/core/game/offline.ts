/* Game-aware catch-up: real transitions + optional purchasing, never a final
 * rate retroactively applied to time spent at an earlier checkpoint. */
import { bn } from "../bignum";
import {
  OFFLINE_CAP_MS,
  OFFLINE_EFFICIENCY,
  OFFLINE_MAX_TICKS,
  type OfflineReport,
} from "../save/offline";
import { PULSE_CAP_TICKS, TICK_MS, TICKS_PER_SECOND } from "./config";
import { autoPurchase, checkpointEta, moneyRate, tick, type GameEvent } from "./engine";
import type { GameState } from "./state";

export function settleGameOffline(s: GameState, now: number, automatic: boolean): {
  state: GameState;
  report: OfflineReport;
  events: GameEvent[];
} {
  const elapsed = Math.max(0, Math.min(now - s.lastSeen, OFFLINE_CAP_MS));
  const ticks = Math.min(Math.floor(elapsed / TICK_MS), OFFLINE_MAX_TICKS);
  let current = s;
  let moneyGain = bn(0);
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const gain = moneyRate(current).mul(OFFLINE_EFFICIENCY / TICKS_PER_SECOND);
    const result = tick(current);
    current = { ...result.state, money: current.money.add(gain) };
    moneyGain = moneyGain.add(gain);
    events.push(...result.events);
    if (automatic) current = autoPurchase(current);
  }

  // Beyond the bounded simulation, only passive income is settled. Position
  // is frozen at the simulation horizon; the UI exposes this cap explicitly.
  const passiveSeconds = (elapsed - ticks * TICK_MS) / 1000;
  const passiveGain = moneyRate(current).mul(passiveSeconds * OFFLINE_EFFICIENCY);
  moneyGain = moneyGain.add(passiveGain);
  current = {
    ...current,
    money: current.money.add(passiveGain),
    pulseTicks: Math.min(PULSE_CAP_TICKS, s.pulseTicks + Math.floor(elapsed / TICK_MS)),
    lastSeen: Math.max(s.lastSeen, now),
  };
  if (automatic && passiveSeconds > 0) current = autoPurchase(current);

  return {
    state: current,
    events,
    report: {
      seconds: elapsed / 1000,
      moneyGain,
      ticksApplied: ticks,
      hitWall: !Number.isFinite(checkpointEta(current)),
    },
  };
}
