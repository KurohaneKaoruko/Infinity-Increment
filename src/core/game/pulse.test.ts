import { describe, expect, it } from "vitest";
import { bn } from "../bignum";
import { ZERO } from "../ordinal/ordinal";
import { fromSave, initialState, toSave } from "./state";
import { eraAt } from "./eras";
import { moneyRate, tick } from "./engine";
import { PULSE_CAP_TICKS, PULSE_COST_TICKS, PULSE_MONEY_SECONDS, PULSE_PROGRESS_SECONDS, TICKS_PER_SECOND } from "./config";
import { canUsePulse, pulseCharges, pulseReadyIn, usePulse } from "./pulse";

describe("shared active-play pulses", () => {
  it("starts with one charge and recharges at a capped deterministic rate", () => {
    let s = { ...initialState(), pulseTicks: 0 };
    for (let i = 0; i < PULSE_COST_TICKS; i++) s = tick(s).state;
    expect(pulseCharges(s)).toBe(1);
    expect(pulseReadyIn({ ...s, pulseTicks: 1 })).toBe(45);
    expect(tick({ ...s, pulseTicks: PULSE_CAP_TICKS }).state.pulseTicks).toBe(PULSE_CAP_TICKS);
    expect(pulseReadyIn({ ...s, pulseTicks: PULSE_CAP_TICKS })).toBe(0);
  });

  it("can turn a charge into meaningful income at any game stage", () => {
    const s = { ...initialState(), rung: 9, gens: [12, 3, 0, 0, 0], money: bn(100) };
    const next = usePulse(s, "money").state;
    expect(next.money.eq(s.money.add(moneyRate(s).mul(PULSE_MONEY_SECONDS)))).toBe(true);
    expect(next.pulseTicks).toBe(0);
    expect(next.alpha).toEqual(s.alpha);
    expect(s.pulseTicks).toBe(PULSE_COST_TICKS);
    expect(usePulse(next, "money").state).toBe(next);
  });

  it("advances actual deployed machines without double income or charge", () => {
    const s = { ...initialState(), drivers: 4 };
    const next = usePulse(s, "progress").state;
    expect(next.rungProgress).toBeCloseTo(PULSE_PROGRESS_SECONDS * 4);
    expect(next.money.eq(s.money)).toBe(true);
    expect(next.pulseTicks).toBe(0);
    expect(next.lastSeen).toBe(s.lastSeen);
  });

  it("cannot spend a progress charge with no active machines", () => {
    const s = initialState();
    expect(canUsePulse(s, "progress")).toBe(false);
    expect(usePulse(s, "progress").state).toBe(s);
    expect(canUsePulse(s, "money")).toBe(true);
  });

  it("stops at a real transition and preserves retuned machines", () => {
    const s = { ...initialState(), drivers: 8, rungProgress: 1799 };
    const result = usePulse(s, "progress");
    expect(result.state.rung).toBe(2);
    expect(result.state.rungProgress).toBe(0);
    expect(result.state.drivers).toBe(8);
    expect(result.events.some((event) => event.kind === "mutation")).toBe(true);
  });

  it("works on era nodes through the same ordinal engine", () => {
    const era = eraAt(1);
    const s = { ...initialState(), phase: "era" as const, era: 1, alpha: era.startAlpha,
      eraGens: era.gens.map((_, i) => i === 0 ? 1 : 0) };
    const next = usePulse(s, "progress").state;
    expect(next.alpha[0]!.coef).toBe(PULSE_PROGRESS_SECONDS * TICKS_PER_SECOND);
    expect(next.alpha[0]!.head).toEqual(era.gens[0]!.increment(ZERO, 1).head);
    expect(next.money.eq(s.money)).toBe(true);
  });

  it("round-trips spent charge and gives legacy saves one starting charge", () => {
    const saved = toSave({ ...initialState(), pulseTicks: 17 }, 500);
    expect(fromSave(saved).pulseTicks).toBe(17);
    delete saved.pulseTicks;
    expect(fromSave(saved).pulseTicks).toBe(PULSE_COST_TICKS);
  });
});
