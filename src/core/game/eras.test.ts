/* Era table guards: every authored ladder must be strictly increasing,
 * rung by rung — a flat or descending rung would dead-end the engine. */
import { describe, it, expect } from "vitest";
import {
  ERA_ALEPH,
  ERA_CLIMB,
  ERA_PSI,
  eraAt,
  largeCardinalEra,
  type EraDef,
  type GenDef,
} from "./eras";
import { ZERO, compare, type Ord } from "../ordinal/ordinal";
import {
  CLIMB_RUNGS,
  CLIMB_LENGTH,
  FINAL_RUNG,
  FINITE_LAST,
  renderRung,
  rungArgument,
  rungArgumentMax,
  rungThreshold,
} from "./ops";

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

  it("eraAt walks the chain: 0 is the climb, 1..2 static, then cardinal tiers", () => {
    expect(eraAt(0).id).toBe("climb");
    expect(eraAt(1).id).toBe("psi");
    expect(eraAt(2).id).toBe("aleph");
    expect(eraAt(3).id).toBe("lc1"); // tier 1: inaccessible
    expect(eraAt(10).id).toBe("lc8"); // tier 8: superhuge
    expect(eraAt(11).id).toBe("lc9"); // procedural tiers onward
    expect(eraAt(11).name).toContain("第 9 级");
  });

  it("each era starts at or below its first rung", () => {
    for (const era of [ERA_PSI, ERA_ALEPH]) {
      if (era.gens.length === 0) continue;
      expect(compare(era.startAlpha, rungOf(era.gens[0]!)), era.id).toBeLessThanOrEqual(0);
    }
  });

  it("the climb is a display-only era slot — its ladder lives in ops.ts", () => {
    expect(ERA_CLIMB.gens.length).toBe(0);
    expect(ERA_CLIMB.wallName).toBe("Γ₀");
  });
});

describe("operation ladder (ops.ts)", () => {
  it("is a strictly growing ladder of notations", () => {
    expect(CLIMB_LENGTH).toBe(13);
    expect(FINAL_RUNG).toBe(CLIMB_LENGTH);
    for (let i = 0; i < CLIMB_RUNGS.length; i++) {
      expect(CLIMB_RUNGS[i]!.n).toBe(i + 1);
    }
  });

  it("thresholds and machine prices grow monotonically", () => {
    for (let i = 1; i < CLIMB_RUNGS.length; i++) {
      const prev = CLIMB_RUNGS[i - 1]!;
      const cur = CLIMB_RUNGS[i]!;
      expect(cur.baseCost).toBeGreaterThan(prev.baseCost);
      expect(cur.maxDrivers).toBeGreaterThanOrEqual(prev.maxDrivers);
      if (cur.fixedThreshold === undefined) {
        expect(cur.threshold).toBeGreaterThan(prev.threshold);
      } else {
        // the ω-tower rung is capped by the engine's nesting budget
        expect(cur.threshold).toBeGreaterThan(0);
      }
    }
  });

  it("the first eight rungs are finite, the rest are ordinal", () => {
    expect(FINITE_LAST).toBe(8);
    expect(CLIMB_RUNGS.slice(0, FINITE_LAST).every((r) => r.phase === "finite")).toBe(true);
    expect(CLIMB_RUNGS.slice(FINITE_LAST).every((r) => r.phase === "ordinal")).toBe(true);
  });

  it("the finite side runs all the way to 'Knuth arrows run out'", () => {
    // rung 8's progress *is* the arrow count k — the point where k itself
    // has to be computed rather than written
    const arrows = CLIMB_RUNGS[7]!;
    expect(arrows.id).toBe("arrows");
    expect(arrows.unit).toBe("箭头数");
    expect(arrows.nextNotation).toBe("ω");
    expect(renderRung(8, 0)).toContain("↑^");
    // and the rung before it is the fifth hyperoperation, not the sixth
    expect(CLIMB_RUNGS[6]!.id).toBe("heptation");
  });

  it("the ω side runs past tetration to the Veblen fixpoint ladder", () => {
    const ids = CLIMB_RUNGS.slice(FINITE_LAST).map((r) => r.id);
    expect(ids).toEqual(["omega-succ", "omega-mul", "omega-pow", "omega-tetr", "veblen-index"]);
    expect(CLIMB_RUNGS[CLIMB_LENGTH - 1]!.nextNotation).toBe("Γ₀");
  });

  it("the count carries across a mutation — a fresh rung never reads op(0)", () => {
    // 加法 ends at its threshold; 乘法 folds that same count instead of restarting
    expect(renderRung(2, 0)).toBe(`10·${rungThreshold(1).toLocaleString("en-US")}`);
    expect(renderRung(2, 0)).not.toBe("10·0");
    expect(renderRung(3, 0)).toBe(
      `10^${(rungThreshold(1) + rungThreshold(2)).toLocaleString("en-US")}`,
    );
    // the ω block restarts its own count — but ω already dominates every
    // finite reading, so there is no dip at the handover
    expect(renderRung(9, 0)).toBe("ω");
    expect(renderRung(10, 0)).toBe(`ω·${rungThreshold(9).toLocaleString("en-US")}`);
    // the two "derived" rungs argue over a tower height / fixpoint index
    expect(renderRung(12, 0)).toBe("ω↑↑2");
    expect(renderRung(13, 0)).toBe("ε₀");
  });

  it("every rung's notation matches the operation it is named after", () => {
    // the ladder must not be off by one: 加法 → 10·n (乘法), 乘法 → 10^n (乘方),
    // 乘方 → 10↑↑n (迭代幂次) …
    expect(CLIMB_RUNGS[0]!.nextNotation).toBe("10·n");
    expect(CLIMB_RUNGS[1]!.nextNotation).toBe("10^n");
    expect(CLIMB_RUNGS[2]!.nextNotation).toBe("10↑↑n");
    expect(renderRung(2, 0).startsWith("10·")).toBe(true); // 乘法 is a product
    expect(renderRung(3, 0).startsWith("10^")).toBe(true); // 乘方 is a power
    expect(renderRung(4, 0).startsWith("10↑↑")).toBe(true); // 迭代幂次 is a tower
  });

  it("the meter reads exactly the argument the value is written from", () => {
    // 乘方 at 100 progress: the reading is 10^3,970, so the meter must not say "100"
    const carry = rungThreshold(1) + rungThreshold(2);
    expect(rungArgument(3, 100)).toBe(carry + 100);
    expect(rungArgumentMax(3)).toBe(carry + rungThreshold(3));
    expect(renderRung(3, 100)).toBe(`10^${(carry + 100).toLocaleString("en-US")}`);
    // the derived rungs meter their own argument (tower height / fixpoint index)
    expect(rungArgument(12, 0)).toBe(2);
    expect(rungArgumentMax(12)).toBe(42);
    expect(rungArgument(13, 0)).toBe(1);
    expect(rungArgumentMax(13)).toBe(Math.floor(rungThreshold(13)));
  });

  it("ordinal rungs build strictly increasing ordinal values", () => {
    let prev: Ord = ZERO;
    for (const r of CLIMB_RUNGS.filter((x) => x.phase === "ordinal")) {
      const v = r.ordinal!(r.threshold);
      expect(compare(prev, v), `rung ${r.n} > previous`).toBeLessThan(0);
      prev = v;
    }
  });
});
