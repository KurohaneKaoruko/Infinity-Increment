import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { bn } from "../core/bignum";
import { eraAt } from "../core/game/eras";
import { initialState, toSave, type GameState } from "../core/game/state";
import { encodeSave } from "../core/save/codec";
import App from "./App";
import { autoMode, confirmImport, saveCode, state, toggleAutoMode } from "./gamestore";

describe("compact play interactions", () => {
  let dispose: (() => void) | undefined;
  let host: HTMLDivElement;

  function load(overrides: Partial<GameState> = {}): void {
    confirmImport(encodeSave(toSave({ ...initialState(Date.now()), ...overrides }, Date.now())));
    host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(() => App(), host);
  }

  function button(text: string): HTMLButtonElement {
    const found = [...host.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes(text));
    if (!found) throw new Error(`Missing button: ${text}`);
    return found;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline test"));
    localStorage.clear();
    if (autoMode()) toggleAutoMode();
  });

  afterEach(() => {
    dispose?.();
    document.body.innerHTML = "";
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("spends one shared pulse, persists it, and makes both unavailable", () => {
    load({ drivers: 4, money: bn(100), rungProgress: 100, pulseTicks: 450 });
    button("推进 +12s").click();
    expect(state().rungProgress).toBeCloseTo(148);
    expect(state().pulseTicks).toBe(0);
    expect(button("推进 +12s").disabled).toBe(true);
    expect(button("补给 +").disabled).toBe(true);
    expect(JSON.parse(localStorage.getItem("infinity.save")!).pulseTicks).toBe(0);
    expect(host.querySelector("[role=status]")?.textContent).toContain("脉冲推进");
    vi.advanceTimersByTime(6500);
    expect(host.querySelector("[role=status]")).toBeNull();
  });

  it("edits a real import code, clears the modal, and resets its settlement clock", () => {
    load();
    button("商店").click();
    host.querySelector<HTMLDetailsElement>(".utility-block")!.open = true;
    button("导入").click();
    expect(host.querySelector("header")?.inert).toBe(true);
    const code = encodeSave(toSave({ ...initialState(), rung: 9, pulseTicks: 17 }, 0));
    const input = host.querySelector<HTMLTextAreaElement>("textarea")!;
    input.value = code;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(saveCode()).toBe(code);
    host.querySelector<HTMLButtonElement>("[role=dialog] .primary-action")!.click();
    expect(state().rung).toBe(9);
    expect(state().pulseTicks).toBe(17);
    expect(state().lastSeen).toBe(Date.now());
    expect(host.querySelector("[role=dialog]")).toBeNull();
    expect(host.querySelector("header")?.inert).toBe(false);
  });

  it("targets advanced progress rather than an old unowned node", () => {
    const era = eraAt(1);
    load({ phase: "era", era: 1, alpha: [era.gens[3]!.increment([], 1)],
      eraGens: era.gens.map(() => 0), money: bn("1e50") });
    expect(host.querySelector(".era-target")?.textContent).toContain(`节点 4/${era.gens.length}`);
    expect(host.querySelector<HTMLButtonElement>(".node-row button")?.disabled).toBe(true);
    host.querySelector<HTMLButtonElement>(".era-target .primary-action")!.click();
    expect(state().eraGens[3]).toBe(1);
    expect(state().eraGens[0]).toBe(0);
    expect(host.querySelector(".node-progress")?.textContent).not.toContain("购买后开始推进");
    button("选择运行策略").click();
    expect(host.querySelector("[aria-label=选择策略]")).not.toBeNull();
    button("速推计划").click();
    expect(state().policy).toBe("sprint");
  });
});
