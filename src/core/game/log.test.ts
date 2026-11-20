import { describe, it, expect } from "vitest";
import { describeEvent } from "./log";
import { RUN_POLICIES, runPolicy } from "./config";
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
  });

  it("a finite coefficient gate is described as a game checkpoint", () => {
    // the ψ era starts at the Γ₀ route handoff; its first rung unlocks the next checkpoint
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
        if (t && t.includes("检查点")) text = t;
      }
    }
    expect(text).not.toBeNull();
    expect(text).toContain("ψ");
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

describe("game policy registry", () => {
  it("offers two explicit play policies with distinct tradeoffs", () => {
    expect(RUN_POLICIES.length).toBe(2);
    const a = RUN_POLICIES[0]!;
    const b = RUN_POLICIES[1]!;
    expect(a.moneyMult).not.toBe(b.moneyMult);
    expect(a.thresholdMult).not.toBe(b.thresholdMult);
  });

  it("legacy V=L and Forcing save IDs migrate to policy aliases", () => {
    expect(runPolicy("vl")?.id).toBe("steady");
    expect(runPolicy("V=L")?.id).toBe("steady");
    expect(runPolicy("forcing")?.id).toBe("sprint");
    expect(runPolicy("Forcing")?.id).toBe("sprint");
    expect(runPolicy("nonexistent")).toBeNull();
    expect(runPolicy(null)).toBeNull();
  });
});
