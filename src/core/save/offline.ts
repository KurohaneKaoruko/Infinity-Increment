/* Offline settlement: timestamp-delta catch-up with hard caps.
 * Generic over the game state so it never depends on game internals:
 * the caller supplies the per-tick step and the closed-form money rate. */
import type { BigNum } from "../bignum";


export const OFFLINE_CAP_MS = 24 * 60 * 60 * 1000; // 24h
export const OFFLINE_MAX_TICKS = 36_000; // ~1h of 10tps ticks
export const OFFLINE_EFFICIENCY = 0.5;

export interface OfflineReport {
  /** settled wall-clock seconds (after capping) */
  seconds: number;
  /** closed-form currency gain: rate × seconds × efficiency */
  moneyGain: BigNum;
  ticksApplied: number;
  /** true when the step function stopped changing state (wall reached) */
  hitWall: boolean;
}

export interface OfflineOptions<S> {
  lastSeen: number;
  now: number;
  /** advance one discrete tick */
  step: (s: S) => S;
  /** equality check to detect "nothing changes any more" (the wall) */
  isEqual: (a: S, b: S) => boolean;
  /** closed-form currency rate per second at the settled state */
  moneyRate: (s: S) => BigNum;
  capMs?: number;
  maxTicks?: number;
}

export function settleOffline<S>(
  state: S,
  opts: OfflineOptions<S>,
): { state: S; report: OfflineReport } {
  const capMs = opts.capMs ?? OFFLINE_CAP_MS;
  const maxTicks = opts.maxTicks ?? OFFLINE_MAX_TICKS;
  const dt = Math.max(0, Math.min(opts.now - opts.lastSeen, capMs));
  const seconds = dt / 1000;

  let current = state;
  let ticksApplied = 0;
  let hitWall = false;
  const totalTicks = Math.min(Math.floor(dt / 100), maxTicks); // 10 ticks/s
  for (let i = 0; i < totalTicks; i++) {
    const next = opts.step(current);
    if (opts.isEqual(current, next)) {
      hitWall = true;
      break;
    }
    current = next;
    ticksApplied++;
  }

  const moneyGain = opts.moneyRate(current).mul(seconds * OFFLINE_EFFICIENCY);
  return { state: current, report: { seconds, moneyGain, ticksApplied, hitWall } };
}

export function formatOfflineGain(moneyGain: BigNum): string {
  return moneyGain.toString();
}
