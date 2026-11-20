import { describe, it, expect, vi, afterEach } from "vitest";
import { findCodex, CODEX } from "./codex";
import { formatMoney, formatSeconds } from "./format";
import { bn } from "../core/bignum";
import { render } from "solid-js/web";
import App from "./App";
import { CLIMB_RUNGS } from "../core/game/ops";

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
    expect(formatMoney(bn("9.9999e49"))).toBe("1e50");
  });

  it("offline duration formats readably", () => {
    expect(formatSeconds(30)).toContain("秒");
    expect(formatSeconds(600)).toContain("分钟");
    expect(formatSeconds(7200)).toContain("小时");
  });
});

describe("the climb screen renders", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("shows the current goal and compact purchase controls", () => {
    // bootGame() starts timers and probes the leaderboard; neither is wanted here
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const host = document.createElement("div");
    document.body.appendChild(host);
    const dispose = render(() => App(), host);
    const text = host.textContent ?? "";
    expect(text).toContain("INFINITY");
    expect(text).toContain("主线");
    expect(text).toContain("加法");
    expect(text).toContain("部署 1 台");
    expect(text).toContain("下一节点");

    const routeTab = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "路线");
    expect(routeTab).toBeDefined();
    routeTab!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const routeText = host.textContent ?? "";
    for (const r of CLIMB_RUNGS) expect(routeText).toContain(r.name);

    const shopTab = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "商店");
    expect(shopTab).toBeDefined();
    shopTab!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const shopText = host.textContent ?? "";
    expect(shopText).toContain("检查点");
    expect(shopText).toContain("升级手算");
    dispose();
  });
});
