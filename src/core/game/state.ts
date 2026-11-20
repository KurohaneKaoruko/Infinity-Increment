/* Game state — plain data, mutated only by pure engine functions. */
import type { Ord } from "../ordinal/ordinal";
import { ZERO } from "../ordinal/ordinal";
import { fromJSON, toJSON } from "../ordinal/serialize";
import { bn, type BigNum } from "../bignum";
import type { SaveDataV3 } from "../save/schema";
import { MONEY_GENS, PULSE_CAP_TICKS, PULSE_COST_TICKS, runPolicy } from "./config";
import { eraAt } from "./eras";
import { CLIMB_LENGTH } from "./ops";

/** "climb" = 运算阶梯(1 → ω → Γ₀);"era" = 走完阶梯之后的纪元链。 */
export type Phase = "climb" | "era";

export interface GameState {
  /** 玩家位置。爬升阶段由 (rung, rungProgress) 推导,纪元阶段自行累加。 */
  alpha: Ord;
  money: BigNum;
  /** money generator counts per tier */
  gens: number[];
  /** index into the endless era chain (0 = the climb, 1 = ψ, 2 = ℵ …) */
  era: number;
  /** counts of the current era's generators, by rung */
  eraGens: number[];
  clickLevel: number;
  transcends: number;
  /** Current game policy (the v3 save's `axiom` field is legacy naming). */
  policy: string | null;
  /** @deprecated v3 compatibility only; use policy. */
  axiom?: string | null;
  lastSeen: number;

  /** 当前处于爬升还是纪元链 */
  phase: Phase;
  /** 1..CLIMB_LENGTH 的阶梯级号 */
  rung: number;
  /** 当前这一级已经积累的进度(永远 ≤ 该级门槛) */
  rungProgress: number;
  /** 当前这一级的机器台数 —— 破级时自动调谐到下一阶 */
  drivers: number;
  /** Stored active-play charge, in 10 Hz ticks; shared by both pulse actions. */
  pulseTicks: number;
}

export function initialState(now = 0, policy: string | null = null): GameState {
  const selected = runPolicy(policy)?.id ?? null;
  return {
    alpha: ZERO,
    money: bn(0),
    gens: MONEY_GENS.map(() => 0),
    era: 0,
    eraGens: eraAt(0).gens.map(() => 0),
    clickLevel: 1,
    transcends: 0,
    policy: selected,
    axiom: selected,
    lastSeen: now,
    phase: "climb",
    rung: 1,
    rungProgress: 0,
    drivers: 0,
    pulseTicks: PULSE_COST_TICKS,
  };
}

export function fromSave(d: SaveDataV3): GameState {
  const era = Math.max(0, Math.floor(d.era));
  const s = initialState(d.lastSeen, runPolicy(d.axiom)?.id ?? null);
  s.alpha = fromJSON(d.alpha);
  s.money = bn(d.money);
  s.gens = pad(d.gens, MONEY_GENS.length);
  s.era = era;
  s.eraGens = pad(d.eraGens, eraAt(era).gens.length);
  s.clickLevel = d.clickLevel;
  s.transcends = d.transcends;
  s.phase = d.phase;
  s.rung = Math.min(Math.max(1, Math.floor(d.rung)), CLIMB_LENGTH);
  s.rungProgress = Math.max(0, d.rungProgress);
  s.drivers = Math.max(0, Math.floor(d.drivers));
  s.pulseTicks = Math.min(PULSE_CAP_TICKS, Math.max(0, Math.floor(d.pulseTicks ?? PULSE_COST_TICKS)));
  if (s.phase === "era") s.rung = CLIMB_LENGTH;
  return s;
}

function pad(arr: number[], len: number): number[] {
  const out = arr.slice(0, len).map((x) => Math.max(0, Math.floor(x)));
  while (out.length < len) out.push(0);
  return out;
}

export function toSave(s: GameState, now: number): SaveDataV3 {
  const policy = runPolicy(s.policy) ?? runPolicy(s.axiom);
  return {
    version: 3,
    alpha: toJSON(s.alpha),
    money: s.money.toString(),
    gens: [...s.gens],
    era: s.era,
    eraGens: [...s.eraGens],
    clickLevel: s.clickLevel,
    transcends: s.transcends,
    axiom: policy?.id ?? null,
    lastSeen: now,
    phase: s.phase,
    rung: s.rung,
    rungProgress: s.rungProgress,
    drivers: s.drivers,
    pulseTicks: s.pulseTicks,
  };
}
