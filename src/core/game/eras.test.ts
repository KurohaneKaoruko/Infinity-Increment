/* Era table guards: every authored ladder must be strictly increasing,
 * rung by rung — a flat or descending rung would dead-end the engine. */
import { describe, it, expect } from "vitest";
import {
  ERA_ALEPH,
  ERA_CNF,
  ERA_FINITE,
  ERA_PSI,
  ERA_VEBLEN,
  eraAt,
  largeCardinalEra,
  type EraDef,
  type GenDef,
} from "./eras";
import { ZERO, compare, type Ord } from "../ordinal/ordinal";

/** the rung value a generator produces with one unit */
function rungOf(gen: GenDef): Ord {
  return [gen.increment(ZERO, 1)];
}

function expectStrictLadder(era: EraDef): void {
  const gens = era.gens;
  expect(gens.length).toBeGreaterThan(0);
  for (let j = 0; j < gens.length - 1; j++) {
    const lo = compare(rungOf(gens[j]!), rungOf(gens[j + 1]!));
    expect(lo, `${era.id} rung ${j} < rung ${j + 1}`).toBeLessThan(0);
  }
  // the last rung must be the wall
  expect(gens[gens.length - 1]!.wall, `${era.id} last rung is the wall`).toBe(true);
}

describe("era table (task 2)", () => {
  it("every static era's rungs strictly increase and end at a wall", () => {
    expectStrictLadder(ERA_CNF);
    expectStrictLadder(ERA_VEBLEN);
    expectStrictLadder(ERA_PSI);
    expectStrictLadder(ERA_ALEPH);
  });

  it("the large-cardinal ladder is endless and strictly increasing", () => {
    for (const tier of [1, 2, 8, 9, 42, 1000]) {
      const era = largeCardinalEra(tier);
      expectStrictLadder(era);
      expect(era.dynamic).toBe(true);
      // startAlpha is the tier's first cardinal
      expect(compare(era.startAlpha, rungOf(era.gens[0]!))).toBeLessThan(0);
    }
  });

  it("eraAt walks the chain: 0..3 static, then cardinal tiers", () => {
    expect(eraAt(0).id).toBe("cnf");
    expect(eraAt(1).id).toBe("veblen");
    expect(eraAt(2).id).toBe("psi");
    expect(eraAt(3).id).toBe("aleph");
    expect(eraAt(4).id).toBe("lc1"); // tier 1: inaccessible
    expect(eraAt(11).id).toBe("lc8"); // tier 8: superhuge
    expect(eraAt(12).id).toBe("lc9"); // procedural tiers onward
    expect(eraAt(12).name).toContain("第 9 级");
  });

  it("each era starts at or below its first rung", () => {
    for (const era of [ERA_CNF, ERA_VEBLEN, ERA_PSI, ERA_ALEPH]) {
      if (era.gens.length === 0) continue;
      expect(compare(era.startAlpha, rungOf(era.gens[0]!)), era.id).toBeLessThanOrEqual(0);
    }
  });
  it("the finite layer stays a display-only pre-era", () => {
    expect(ERA_FINITE.gens.length).toBe(0);
    expect(ERA_FINITE.wallName).toBe("ω");
  });
});
