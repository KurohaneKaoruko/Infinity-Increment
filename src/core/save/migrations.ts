/* Migration chain: every historical save format upgrades to the current one.
 * Old formats are never mutated in place; migration always produces the
 * newest version. */
import { OrdinalError, compare, fromNumber } from "../ordinal/ordinal";
import { fromJSON, toJSON } from "../ordinal/serialize";
import { eraAt } from "../game/eras";
import {
  SAVE_VERSION,
  validateV1,
  validateV2,
  validateV3,
  type SaveDataV1,
  type SaveDataV2,
  type SaveDataV3,
} from "./schema";

/** v0: legacy prototype — position and money were plain JSON numbers. */
export interface SaveDataV0 {
  alpha: number;
  money: number;
  gens: number[];
  lastSeen: number;
}

function migrateV0toV1(raw: unknown): SaveDataV1 {
  if (typeof raw !== "object" || raw === null) throw new OrdinalError("save: expected object");
  const o = raw as Record<string, unknown>;
  if (typeof o.alpha !== "number" || !Number.isInteger(o.alpha) || (o.alpha as number) < 0) {
    throw new OrdinalError("save v0: bad alpha");
  }
  if (typeof o.money !== "number" || !Number.isFinite(o.money)) {
    throw new OrdinalError("save v0: bad money");
  }
  if (!Array.isArray(o.gens) || o.gens.some((g) => typeof g !== "number" || !Number.isInteger(g) || (g as number) < 0)) {
    throw new OrdinalError("save v0: bad gens");
  }
  return {
    version: 1,
    alpha: toJSON(fromNumber(o.alpha)),
    money: String(o.money),
    gens: o.gens as number[],
    alphaGens: [],
    clickLevel: 1,
    transcends: 0,
    axiom: null,
    lastSeen: typeof o.lastSeen === "number" ? o.lastSeen : 0,
  };
}

/** v1 -> v2: the flat cofinal-tier array becomes the era chain's first era. */
function upgradeV1toV2(v1: SaveDataV1): SaveDataV2 {
  return {
    version: 2,
    alpha: v1.alpha,
    money: v1.money,
    gens: v1.gens,
    era: 0,
    eraGens: [...v1.alphaGens],
    clickLevel: v1.clickLevel,
    transcends: v1.transcends,
    axiom: v1.axiom,
    lastSeen: v1.lastSeen,
  };
}

/** v2 -> v3: the operation ladder is inserted in front of the era chain.
 *
 * v2's era 1 was the binary-Veblen ladder (ε₀ → Γ₀). That whole range is now
 * the tail of the operation climb (ops.ts), so the era chain shifts down one
 * slot: v2 ψ (era 2) becomes v3 era 1, ℵ (era 3) becomes era 2, and the
 * cardinal tiers follow. A save parked on the Veblen ladder lands at the foot
 * of the ψ era, and its α is lifted to that era's start if it would otherwise
 * sit below it. A save still inside the old CNF era (era 0) restarts at the
 * foot of the ladder — the climb is new content — while everything the player
 * actually earned (money, machines, click level, axioms, transcendence count)
 * is preserved. */
function upgradeV2toV3(v2: SaveDataV2): SaveDataV3 {
  const inEraChain = v2.era > 0;
  const era = inEraChain ? Math.max(1, v2.era - 1) : 0;
  const startAlpha = toJSON(eraAt(era).startAlpha);
  const alpha =
    inEraChain && compare(fromJSON(v2.alpha), eraAt(era).startAlpha) < 0 ? startAlpha : v2.alpha;
  return {
    version: SAVE_VERSION,
    alpha,
    money: v2.money,
    gens: v2.gens,
    era,
    eraGens: [...v2.eraGens],
    clickLevel: v2.clickLevel,
    transcends: v2.transcends,
    axiom: v2.axiom,
    lastSeen: v2.lastSeen,
    phase: inEraChain ? "era" : "climb",
    rung: 1,
    rungProgress: 0,
    drivers: 0,
  };
}

/** Load any historical format and return a validated current save.
 * Throws (OrdinalError) when the payload matches no known format. */
export function migrate(raw: unknown): SaveDataV3 {
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const v = (raw as Record<string, unknown>).version;
    if (v === SAVE_VERSION) return validateV3(raw);
    if (v === 2) return upgradeV2toV3(validateV2(raw));
    if (v === 1) return upgradeV2toV3(upgradeV1toV2(validateV1(raw)));
    if (v === undefined) return upgradeV2toV3(upgradeV1toV2(migrateV0toV1(raw)));
  }
  throw new OrdinalError("save: unrecognized format");
}
