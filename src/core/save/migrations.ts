/* Migration chain: every historical save format upgrades to the current one.
 * Old formats are never mutated in place; migration always produces v2. */
import { fromNumber } from "../ordinal/ordinal";
import { toJSON } from "../ordinal/serialize";
import {
  SAVE_VERSION,
  validateV1,
  validateV2,
  type SaveDataV1,
  type SaveDataV2,
} from "./schema";
import { OrdinalError } from "../ordinal/ordinal";

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
    version: SAVE_VERSION,
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

/** Load any historical format and return a validated current save.
 * Throws (OrdinalError) when the payload matches no known format. */
export function migrate(raw: unknown): SaveDataV2 {
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const v = (raw as Record<string, unknown>).version;
    if (v === SAVE_VERSION) return validateV2(raw);
    if (v === 1) return upgradeV1toV2(validateV1(raw));
    if (v === undefined) return upgradeV1toV2(migrateV0toV1(raw));
  }
  throw new OrdinalError("save: unrecognized format");
}
