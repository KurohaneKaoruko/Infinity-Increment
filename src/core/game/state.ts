/* Game state — plain data, mutated only by pure engine functions. */
import type { Ord } from "../ordinal/ordinal";
import { ZERO } from "../ordinal/ordinal";
import { fromJSON, toJSON } from "../ordinal/serialize";
import { bn, type BigNum } from "../bignum";
import type { SaveDataV2 } from "../save/schema";
import { MONEY_GENS } from "./config";
import { eraAt } from "./eras";

export interface GameState {
  alpha: Ord;
  money: BigNum;
  /** money generator counts per tier */
  gens: number[];
  /** index into the endless era chain (0 = CNF … 4+ = cardinal ladder) */
  era: number;
  /** counts of the current era's generators, by rung */
  eraGens: number[];
  clickLevel: number;
  transcends: number;
  axiom: string | null;
  lastSeen: number;
}

export function initialState(now = 0, axiom: string | null = null): GameState {
  return {
    alpha: ZERO,
    money: bn(0),
    gens: MONEY_GENS.map(() => 0),
    era: 0,
    eraGens: eraAt(0).gens.map(() => 0),
    clickLevel: 1,
    transcends: 0,
    axiom,
    lastSeen: now,
  };
}

export function fromSave(d: SaveDataV2): GameState {
  const era = Math.max(0, Math.floor(d.era));
  const s = initialState(d.lastSeen, d.axiom);
  s.alpha = fromJSON(d.alpha);
  s.money = bn(d.money);
  s.gens = pad(d.gens, MONEY_GENS.length);
  s.era = era;
  s.eraGens = pad(d.eraGens, eraAt(era).gens.length);
  s.clickLevel = d.clickLevel;
  s.transcends = d.transcends;
  return s;
}

function pad(arr: number[], len: number): number[] {
  const out = arr.slice(0, len).map((x) => Math.max(0, Math.floor(x)));
  while (out.length < len) out.push(0);
  return out;
}

export function toSave(s: GameState, now: number): SaveDataV2 {
  return {
    version: 2,
    alpha: toJSON(s.alpha),
    money: s.money.toString(),
    gens: [...s.gens],
    era: s.era,
    eraGens: [...s.eraGens],
    clickLevel: s.clickLevel,
    transcends: s.transcends,
    axiom: s.axiom,
    lastSeen: now,
  };
}
