import { describe, it, expect } from "vitest";
import { findCodex, CODEX } from "./codex";
import { formatMoney, formatSeconds } from "./format";
import { bn } from "../core/bignum";

describe("codex data (点选图鉴)", () => {
  it("every entry is reachable via at least one alias", () => {
    for (const c of CODEX) {
      expect(findCodex(c.id)?.id).toBe(c.id);
      expect(findCodex(c.aliases[0] ?? "")?.id).toBe(c.id);
    }
  });

  it("entries carry readable explanations", () => {
    for (const c of CODEX) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.text.length).toBeGreaterThan(10);
    }
  });
});

describe("formatting", () => {
  it("small numbers stay plain, large go scientific", () => {
    expect(formatMoney(bn("1"))).toBe("1");
    expect(formatMoney(bn("1234.5"))).toBe("1,234");
    expect(formatMoney(bn("1e15"))).toBe("1e15");
    expect(formatMoney(bn("1.5e45"))).toBe("1.5e45");
  });

  it("offline duration formats readably", () => {
    expect(formatSeconds(30)).toContain("秒");
    expect(formatSeconds(600)).toContain("分钟");
    expect(formatSeconds(7200)).toContain("小时");
  });
});
