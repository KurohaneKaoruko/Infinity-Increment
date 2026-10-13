import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("vitest + fast-check are wired up", async () => {
    const fc = await import("fast-check");
    expect(() => fc.assert(fc.property(fc.integer(), () => true))).not.toThrow();
  });
});
