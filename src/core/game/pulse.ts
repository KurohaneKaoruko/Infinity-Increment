/* Active decisions with a shared, capped charge budget. No timers or I/O. */
import {
  PULSE_CAP_TICKS,
  PULSE_COST_TICKS,
  PULSE_MONEY_SECONDS,
  PULSE_PROGRESS_SECONDS,
  TICKS_PER_SECOND,
} from "./config";
import { checkpointEta, moneyRate, tick, type TickResult } from "./engine";
import type { GameState } from "./state";

export type PulseMode = "progress" | "money";

export function pulseCharges(s: GameState): number {
  return Math.floor(Math.min(PULSE_CAP_TICKS, Math.max(0, s.pulseTicks)) / PULSE_COST_TICKS);
}

export function pulseReadyIn(s: GameState): number {
  if (s.pulseTicks >= PULSE_CAP_TICKS) return 0;
  return Math.ceil((PULSE_COST_TICKS - s.pulseTicks % PULSE_COST_TICKS) / TICKS_PER_SECOND);
}

export function canUsePulse(s: GameState, mode: PulseMode): boolean {
  return pulseCharges(s) > 0 && (mode === "money" || Number.isFinite(checkpointEta(s)));
}

export function usePulse(s: GameState, mode: PulseMode): TickResult {
  if (!canUsePulse(s, mode)) return { state: s, events: [] };
  const remaining = s.pulseTicks - PULSE_COST_TICKS;
  if (mode === "money") {
    return {
      state: { ...s, pulseTicks: remaining, money: s.money.add(moneyRate(s).mul(PULSE_MONEY_SECONDS)) },
      events: [],
    };
  }

  let current = s;
  const events: TickResult["events"] = [];
  // Reuse real engine transitions. A pulse advances deployed machines only;
  // it grants neither passive money nor free recharge, and stops at a node.
  for (let i = 0; i < PULSE_PROGRESS_SECONDS * TICKS_PER_SECOND; i++) {
    const result = tick(current);
    current = { ...result.state, money: s.money, pulseTicks: remaining };
    events.push(...result.events);
    if (result.events.length > 0) break;
  }
  return { state: current, events };
}
