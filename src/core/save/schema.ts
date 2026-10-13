/* Versioned save schema. v0 is the legacy prototype format (natural-number
 * position); v1 is the CNF-era format; v2 introduced the era chain; v3 adds
 * the operation ladder (phase + rung + progress + drivers) in front of it.
 * See migrations. */
import { fromJSON, type JSONOrd } from "../ordinal/serialize";
import { bn, type BigNum } from "../bignum";
import { OrdinalError } from "../ordinal/ordinal";

export const SAVE_VERSION = 3 as const;

export interface SaveDataV1 {
  version: 1;
  /** player position as a wire-format CNF ordinal */
  alpha: JSONOrd;
  /** spendable currency, Decimal string */
  money: string;
  /** money generator counts per tier */
  gens: number[];
  /** cofinal (alpha) generator counts per tier */
  alphaGens: number[];
  clickLevel: number;
  transcends: number;
  axiom: string | null;
  /** epoch ms of last save */
  lastSeen: number;
}

export interface SaveDataV2 {
  version: 2;
  alpha: JSONOrd;
  money: string;
  gens: number[];
  era: number;
  eraGens: number[];
  clickLevel: number;
  transcends: number;
  axiom: string | null;
  lastSeen: number;
}

export interface SaveDataV3 {
  version: typeof SAVE_VERSION;
  /** player position as a wire-format ordinal (any head) */
  alpha: JSONOrd;
  /** spendable currency, Decimal string */
  money: string;
  /** money generator counts per tier */
  gens: number[];
  /** index into the era chain (0 = the climb, 1 = ψ, 2 = ℵ …) */
  era: number;
  /** counts of the current era's generators, by rung */
  eraGens: number[];
  clickLevel: number;
  transcends: number;
  axiom: string | null;
  /** epoch ms of last save */
  lastSeen: number;
  /** "climb" = the operation ladder; "era" = the era chain */
  phase: "climb" | "era";
  /** 1-based rung on the operation ladder */
  rung: number;
  /** progress accumulated on the current rung */
  rungProgress: number;
  /** machines deployed on the current rung (scrapped on every mutation) */
  drivers: number;
}

/** The current save format. */
export type SaveData = SaveDataV3;

function expectObject(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new OrdinalError("save: expected object");
  }
  return raw as Record<string, unknown>;
}

function validateCommon(o: Record<string, unknown>): {
  money: string;
  gens: number[];
  clickLevel: number;
  transcends: number;
  axiom: string | null;
  lastSeen: number;
} {
  const money = expectString(o.money);
  let parsed: BigNum;
  try {
    parsed = bn(money);
  } catch {
    throw new OrdinalError("save: money unparseable");
  }
  if (Number.isNaN(parsed.m) || Number.isNaN(parsed.e)) throw new OrdinalError("save: money not finite");
  fromJSON(o.alpha); // validate structure
  return {
    money,
    gens: expectNumberArray(o.gens),
    clickLevel: expectNonNegativeInt(o.clickLevel),
    transcends: expectNonNegativeInt(o.transcends),
    axiom: o.axiom === null ? null : expectString(o.axiom),
    lastSeen: expectNonNegativeInt(o.lastSeen),
  };
}

export function validateV3(raw: unknown): SaveDataV3 {
  const o = expectObject(raw);
  if (o.version !== SAVE_VERSION) throw new OrdinalError("save: wrong version");
  const phase = o.phase;
  if (phase !== "climb" && phase !== "era") throw new OrdinalError("save: bad phase");
  return {
    version: SAVE_VERSION,
    alpha: o.alpha as JSONOrd,
    ...validateCommon(o),
    era: expectNonNegativeInt(o.era),
    eraGens: expectNumberArray(o.eraGens),
    phase,
    rung: expectNonNegativeInt(o.rung),
    rungProgress: expectNonNegativeNumber(o.rungProgress),
    drivers: expectNonNegativeInt(o.drivers),
  };
}

/** Strict validation of legacy v2 payloads (used by the migration chain). */
export function validateV2(raw: unknown): SaveDataV2 {
  const o = expectObject(raw);
  if (o.version !== 2) throw new OrdinalError("save: wrong version");
  return {
    version: 2,
    alpha: o.alpha as JSONOrd,
    ...validateCommon(o),
    era: expectNonNegativeInt(o.era),
    eraGens: expectNumberArray(o.eraGens),
  };
}

/** Strict validation of legacy v1 payloads (used by the migration chain). */
export function validateV1(raw: unknown): SaveDataV1 {
  const o = expectObject(raw);
  if (o.version !== 1) throw new OrdinalError("save: wrong version");
  return {
    version: 1,
    alpha: o.alpha as JSONOrd,
    ...validateCommon(o),
    alphaGens: expectNumberArray(o.alphaGens),
  };
}

function expectString(v: unknown): string {
  if (typeof v !== "string") throw new OrdinalError("save: expected string");
  return v;
}

function expectNonNegativeInt(v: unknown): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
    throw new OrdinalError("save: expected non-negative integer");
  }
  return v;
}

function expectNonNegativeNumber(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
    throw new OrdinalError("save: expected non-negative number");
  }
  return v;
}

function expectNumberArray(v: unknown): number[] {
  if (!Array.isArray(v)) throw new OrdinalError("save: expected array");
  return v.map((x) => expectNonNegativeInt(x));
}
