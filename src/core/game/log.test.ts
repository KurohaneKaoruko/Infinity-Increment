import { describe, it, expect } from "vitest";
import { describeEvent } from "./log";
import { AXIOMS, axiomDef } from "./config";
import { initialState } from "./state";
import { buyEraGen, tick } from "./engine";
import { bn } from "../bignum";

describe("event log text (5.1)", () => {
  it("the absorption beat is announced when a limit arrives", () => {
    let s = { ...initialState(0), money: bn(1e9) };
    s = buyEraGen(s, 0).state;
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
    expect(text).toContain("cofinal-0");
    expect(text).toContain("吸收");
  });

  it("era walls announce the new notation system", () => {
    const text = describeEvent({ kind: "transcended", era: 1, name: "纪元 II · Veblen 层谱", wall: "ε₀" });
    expect(text).toContain("ε₀");
    expect(text).toContain("Veblen");
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
