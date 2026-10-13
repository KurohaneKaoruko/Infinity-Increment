import { describe, it, expect } from "vitest";
import { describeEvent } from "./log";
import { AXIOMS, axiomDef } from "./config";
import { initialState, type GameState } from "./state";
import { buyDriver, tick } from "./engine";
import { eraAt } from "./eras";
import { rungAt } from "./ops";
import { bn } from "../bignum";

function funded(over: Partial<GameState> = {}): GameState {
  return { ...initialState(0), money: bn(1e30), ...over };
}

describe("event log text (5.1)", () => {
  it("a rung mutation announces the new notation", () => {
    const rung = rungAt(2);
    const s = funded({ rung: 2, drivers: rung.maxDrivers, rungProgress: rung.threshold });
    const r = tick(s);
    const mutation = r.events.find((e) => e.kind === "mutation");
    expect(mutation).toBeDefined();
    const text = describeEvent(mutation!)!;
    expect(text).toContain("乘法");
    expect(text).toContain("10^n");
    expect(text).toContain("报废");
  });

  it("the absorption beat is announced when a limit arrives", () => {
    // the ψ era starts at Γ₀; its first rung delivers the next one
    const era = eraAt(1);
    let s = funded({
      phase: "era",
      era: 1,
      alpha: era.startAlpha,
      eraGens: era.gens.map((_, j) => (j === 0 ? 1 : 0)),
    });
    let text: string | null = null;
    for (let i = 0; i < 3000 && !text; i++) {
      const r = tick(s);
      s = r.state;
      for (const ev of r.events) {
        const t = describeEvent(ev);
        if (t && t.includes("吸收")) text = t;
      }
    }
    expect(text).not.toBeNull();
    expect(text).toContain("ψ");
    expect(text).toContain("吸收");
  });

  it("era walls announce the new notation system", () => {
    const text = describeEvent({ kind: "transcended", era: 1, name: "纪元 II · 坍缩函数", wall: "Γ₀" });
    expect(text).toContain("Γ₀");
    expect(text).toContain("纪元 II");
  });

  it("buying a machine is logged", () => {
    const text = describeEvent(buyDriver(funded()).events[0]!);
    expect(text).toContain("加法");
  });

  it("click spam never reaches the log", () => {
    const { events } = tick(initialState(0));
    expect(events.every((e) => describeEvent(e) === null || e.kind !== "clicked")).toBe(true);
  });
});

describe("axiom registry (5.5)", () => {
  it("offers exactly two cards with distinct effects", () => {
    expect(AXIOMS.length).toBe(2);
    const a = AXIOMS[0]!;
    const b = AXIOMS[1]!;
    expect(a.moneyMult).not.toBe(b.moneyMult);
    expect(a.convergeMult).not.toBe(b.convergeMult);
  });

  it("unknown axiom ids fall back to no effect", () => {
    expect(axiomDef("nonexistent")).toBeNull();
    expect(axiomDef(null)).toBeNull();
  });
});
